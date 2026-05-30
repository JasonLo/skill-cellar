//! The curated catalog that backs the Featured shop.
//!
//! The catalog lives in a hand-curated, public, read-only GitHub gist (I-5) so
//! it can be re-curated without an app release, and is cached on disk so the
//! shop stays usable offline. Resolution layers two guarantees:
//!
//! - **Staleness-gated refresh (I-5 outcome 3):** a cached copy younger than the
//!   threshold is served as-is; only a stale (or absent) cache triggers a gist
//!   fetch when the network is reachable.
//! - **Offline fallback (I-1):** if the fetch fails, fall back to the cache,
//!   then to the bundled snapshot, so the shop is never empty.
//!
//! Parsing and per-entry validation live in [`parse`] so one malformed gist
//! entry is skipped rather than breaking the whole shop (I-5 outcome 2). The
//! catalog is metadata only and never touches the optional Turso sync store
//! (P-4/P-7/P-8).

mod cache;
mod fetcher;
mod parse;

pub use fetcher::RegistryFetcher;
pub use parse::parse_catalog;

use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// How old a cached catalog may get before a reachable network triggers a
/// refresh from the gist (I-5 outcome 3). Curation is hand-edited and
/// infrequent, so a daily refresh balances freshness against needless fetches.
pub const DEFAULT_STALENESS: Duration = Duration::from_secs(24 * 60 * 60);

/// One installable skill advertised by the registry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct RegistryEntry {
    pub name: String,
    pub description: String,
    /// `owner/name` of the hosting repo.
    pub repo: String,
    /// Path to the skill directory within the repo, if not the repo root.
    pub subdir: Option<String>,
    /// Tag/branch/sha; the repo's default branch when `None`.
    pub git_ref: Option<String>,
    pub featured: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct RegistryManifest {
    pub schema_version: u32,
    pub generated_at: String,
    pub entries: Vec<RegistryEntry>,
}

/// Where the manifest the UI is showing actually came from. Lets the shop tell
/// the user it is running on cached/offline data.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "lowercase")]
pub enum RegistrySource {
    Network,
    Cache,
    Bundled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct RegistryResult {
    pub manifest: RegistryManifest,
    pub source: RegistrySource,
}

/// Resolve the catalog with a staleness-gated refresh plus offline fallback,
/// using the real wall clock and the [`DEFAULT_STALENESS`] threshold. This is
/// what the Shop's IPC command calls; [`resolve_catalog`] is the
/// clock-injected core that the EARS tests drive.
pub fn get_registry(
    fetcher: &dyn RegistryFetcher,
    app_data_dir: &Path,
) -> AppResult<RegistryResult> {
    resolve_catalog(fetcher, app_data_dir, SystemTime::now(), DEFAULT_STALENESS)
}

/// Catalog resolution with the clock and staleness threshold injected so the
/// outcome tests can exercise fresh/stale/offline transitions deterministically.
///
/// 1. A cached copy younger than `max_age` is served directly (`Cache`) — no
///    network touch (I-5 outcome 3).
/// 2. Otherwise fetch the gist; on success parse + cache it and report
///    `Network` (I-5 outcomes 1 & 2).
/// 3. If the fetch (or parse) fails, fall back to any cached copy — even a
///    stale one — and report `Cache`; with no cache, the bundled snapshot
///    (`Bundled`). This is the I-1 offline guarantee.
///
/// Only returns `Err` if even the bundled snapshot fails to parse.
pub fn resolve_catalog(
    fetcher: &dyn RegistryFetcher,
    app_data_dir: &Path,
    now: SystemTime,
    max_age: Duration,
) -> AppResult<RegistryResult> {
    let cached = cache::read_cache(app_data_dir).ok();

    // Fresh cache short-circuits the network entirely.
    if let Some(c) = &cached {
        if !is_stale(c.fetched_at_unix, now, max_age) {
            return Ok(RegistryResult {
                manifest: c.manifest.clone(),
                source: RegistrySource::Cache,
            });
        }
    }

    // Stale or absent cache: try the gist, falling back on any error.
    match fetch_and_parse(fetcher) {
        Ok(manifest) => {
            // Best-effort cache refresh; a write failure must not break the shop.
            let _ = cache::write_cache(app_data_dir, &manifest, to_unix(now));
            Ok(RegistryResult {
                manifest,
                source: RegistrySource::Network,
            })
        }
        Err(_) => match cached {
            Some(c) => Ok(RegistryResult {
                manifest: c.manifest,
                source: RegistrySource::Cache,
            }),
            None => Ok(RegistryResult {
                manifest: cache::bundled_snapshot()?,
                source: RegistrySource::Bundled,
            }),
        },
    }
}

/// Fetch the raw catalog text from the gist and parse it tolerantly. A network
/// error or a hopelessly-malformed envelope both surface as `Err` here, so the
/// caller treats them identically (fall back to cache/bundled).
fn fetch_and_parse(fetcher: &dyn RegistryFetcher) -> AppResult<RegistryManifest> {
    let text = fetcher.fetch_catalog()?;
    parse::parse_catalog(&text)
}

fn to_unix(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

/// A cache is stale once it is older than `max_age`. `saturating_sub` keeps a
/// clock that jumped backwards (cache "from the future") from underflowing into
/// a bogus stale verdict.
fn is_stale(fetched_at_unix: u64, now: SystemTime, max_age: Duration) -> bool {
    to_unix(now).saturating_sub(fetched_at_unix) > max_age.as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::AppError;

    fn sample_json(marker: &str) -> String {
        format!(
            r#"{{
                "schema_version": 1,
                "generated_at": "2026-05-29T12:00:00Z",
                "entries": [
                    {{ "name": "{marker}", "description": "fetched live", "repo": "agentskills/examples", "subdir": null, "git_ref": null, "featured": true }}
                ]
            }}"#
        )
    }

    /// A fake gist: hands back a fixed raw JSON document, as the live HTTP
    /// fetcher would after GETting the gist's raw content.
    struct GistFetcher(String);
    impl RegistryFetcher for GistFetcher {
        fn fetch_catalog(&self) -> AppResult<String> {
            Ok(self.0.clone())
        }
    }

    struct OfflineFetcher;
    impl RegistryFetcher for OfflineFetcher {
        fn fetch_catalog(&self) -> AppResult<String> {
            Err(AppError::Network("simulated offline".to_string()))
        }
    }

    fn at(secs: u64) -> SystemTime {
        UNIX_EPOCH + Duration::from_secs(secs)
    }

    /// I-5 outcome 1: opening the Shop loads the catalog from the gist and
    /// persists it to the local cache for offline reuse.
    #[test]
    fn catalog_loads_from_gist_and_caches() {
        let dir = tempfile::tempdir().unwrap();
        let gist = GistFetcher(sample_json("from-gist"));

        let live = get_registry(&gist, dir.path()).unwrap();
        assert_eq!(live.source, RegistrySource::Network);
        assert_eq!(live.manifest.entries[0].name, "from-gist");
        assert!(
            dir.path().join("registry-cache.json").exists(),
            "the fetched catalog must be persisted for offline reuse"
        );

        // The persisted copy backs the Shop without re-fetching.
        let reused = get_registry(&OfflineFetcher, dir.path()).unwrap();
        assert_eq!(reused.source, RegistrySource::Cache);
        assert_eq!(reused.manifest, live.manifest);
    }

    /// I-5 outcome 2: a malformed catalog entry is skipped, the valid ones
    /// survive, and the Shop never fails on one bad entry.
    #[test]
    fn catalog_skips_invalid_entries() {
        let dir = tempfile::tempdir().unwrap();
        // Middle entry is missing the required `repo` field.
        let json = r#"{
            "schema_version": 1,
            "generated_at": "2026-05-29T12:00:00Z",
            "entries": [
                { "name": "valid-one", "description": "ok", "repo": "acme/one", "featured": true },
                { "name": "broken", "description": "no repo", "featured": false },
                { "name": "valid-two", "description": "ok", "repo": "acme/two", "featured": false }
            ]
        }"#;

        let res = get_registry(&GistFetcher(json.to_string()), dir.path()).unwrap();
        assert_eq!(res.source, RegistrySource::Network);
        let names: Vec<_> = res
            .manifest
            .entries
            .iter()
            .map(|e| e.name.as_str())
            .collect();
        assert_eq!(
            names,
            ["valid-one", "valid-two"],
            "only the bad entry is dropped"
        );
    }

    /// I-5 outcome 3: a fresh cache is served as-is; once it ages past the
    /// threshold a reachable network refreshes it; while stale-and-offline it
    /// still serves the cached copy.
    #[test]
    fn catalog_refreshes_when_stale() {
        let dir = tempfile::tempdir().unwrap();
        let max_age = Duration::from_secs(24 * 60 * 60);
        let t0 = 1_000_000;

        // Prime the cache from the gist at t0.
        let primed =
            resolve_catalog(&GistFetcher(sample_json("v1")), dir.path(), at(t0), max_age).unwrap();
        assert_eq!(primed.source, RegistrySource::Network);

        // 1h later (within threshold): served from cache, NOT refreshed, even
        // though the gist now advertises different data.
        let fresh = resolve_catalog(
            &GistFetcher(sample_json("v2")),
            dir.path(),
            at(t0 + 3_600),
            max_age,
        )
        .unwrap();
        assert_eq!(fresh.source, RegistrySource::Cache);
        assert_eq!(
            fresh.manifest.entries[0].name, "v1",
            "fresh cache is not refreshed"
        );

        // 25h later (stale) with the network reachable: refreshed from the gist.
        let refreshed = resolve_catalog(
            &GistFetcher(sample_json("v2")),
            dir.path(),
            at(t0 + 25 * 3_600),
            max_age,
        )
        .unwrap();
        assert_eq!(refreshed.source, RegistrySource::Network);
        assert_eq!(
            refreshed.manifest.entries[0].name, "v2",
            "stale cache refreshes"
        );

        // Stale again but offline: serve the (now v2) cached copy.
        let offline =
            resolve_catalog(&OfflineFetcher, dir.path(), at(t0 + 50 * 3_600), max_age).unwrap();
        assert_eq!(offline.source, RegistrySource::Cache);
        assert_eq!(offline.manifest.entries[0].name, "v2");
    }

    /// I-1 offline guarantee (kept honest here): with no cache and an
    /// unreachable gist, the shop falls back to the bundled snapshot.
    #[test]
    fn registry_falls_back_to_cache_when_offline() {
        let dir = tempfile::tempdir().unwrap();

        // Online priming writes the cache and reports Network.
        let online = get_registry(&GistFetcher(sample_json("from-network")), dir.path()).unwrap();
        assert_eq!(online.source, RegistrySource::Network);

        // A warm (fresh) cache is served while offline.
        let cached = get_registry(&OfflineFetcher, dir.path()).unwrap();
        assert_eq!(cached.source, RegistrySource::Cache);
        assert_eq!(cached.manifest, online.manifest);

        // No cache + offline falls back to the bundled snapshot.
        let cold = tempfile::tempdir().unwrap();
        let bundled = get_registry(&OfflineFetcher, cold.path()).unwrap();
        assert_eq!(bundled.source, RegistrySource::Bundled);
        assert!(
            !bundled.manifest.entries.is_empty(),
            "bundled snapshot must keep the Featured shop populated"
        );
    }

    #[test]
    fn bundled_snapshot_parses() {
        let m = cache::bundled_snapshot().expect("bundled default_registry.json must parse");
        assert!(m.entries.iter().any(|e| e.featured));
    }
}
