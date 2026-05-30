//! The curated registry that backs the Featured shop, plus the offline
//! fallback chain (Outcome 3): try the network, then the on-disk cache, then
//! the bundled snapshot, so the shop is always usable.

mod cache;
mod fetcher;

pub use fetcher::RegistryFetcher;

use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::path::Path;

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

/// Resolve the registry with graceful degradation:
///
/// 1. Ask the fetcher. On success, refresh the cache and report `Network`.
/// 2. On a network error, fall back to the on-disk cache and report `Cache`.
/// 3. If there is no usable cache, fall back to the bundled snapshot and
///    report `Bundled`.
///
/// Only returns `Err` if even the bundled snapshot fails to parse.
pub fn get_registry(fetcher: &dyn RegistryFetcher, app_data_dir: &Path) -> AppResult<RegistryResult> {
    match fetcher.fetch_manifest() {
        Ok(manifest) => {
            // Best-effort cache refresh; a write failure must not break the shop.
            let _ = cache::write_cache(app_data_dir, &manifest);
            Ok(RegistryResult {
                manifest,
                source: RegistrySource::Network,
            })
        }
        Err(_network_err) => match cache::read_cache(app_data_dir) {
            Ok(manifest) => Ok(RegistryResult {
                manifest,
                source: RegistrySource::Cache,
            }),
            Err(_) => Ok(RegistryResult {
                manifest: cache::bundled_snapshot()?,
                source: RegistrySource::Bundled,
            }),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::AppError;

    fn sample_manifest() -> RegistryManifest {
        RegistryManifest {
            schema_version: 1,
            generated_at: "2026-05-29T12:00:00Z".to_string(),
            entries: vec![RegistryEntry {
                name: "from-network".to_string(),
                description: "fetched live".to_string(),
                repo: "agentskills/examples".to_string(),
                subdir: None,
                git_ref: None,
                featured: true,
            }],
        }
    }

    struct OkFetcher(RegistryManifest);
    impl RegistryFetcher for OkFetcher {
        fn fetch_manifest(&self) -> AppResult<RegistryManifest> {
            Ok(self.0.clone())
        }
    }

    struct OfflineFetcher;
    impl RegistryFetcher for OfflineFetcher {
        fn fetch_manifest(&self) -> AppResult<RegistryManifest> {
            Err(AppError::Network("simulated offline".to_string()))
        }
    }

    /// Outcome 3: when the network (GitHub) is unreachable, the registry falls
    /// back to cache so the Featured shop stays usable; and to the bundled
    /// snapshot when there is no cache yet.
    #[test]
    fn registry_falls_back_to_cache_when_offline() {
        let dir = tempfile::tempdir().unwrap();

        // 1. Online priming writes the cache and reports Network.
        let online = get_registry(&OkFetcher(sample_manifest()), dir.path()).unwrap();
        assert_eq!(online.source, RegistrySource::Network);
        assert_eq!(online.manifest.entries[0].name, "from-network");
        assert!(
            dir.path().join("registry-cache.json").exists(),
            "online fetch should have written the cache"
        );

        // 2. Offline with a warm cache reports Cache and returns the cached data.
        let cached = get_registry(&OfflineFetcher, dir.path()).unwrap();
        assert_eq!(cached.source, RegistrySource::Cache);
        assert_eq!(cached.manifest, online.manifest);

        // 3. Offline with a cold cache falls back to the bundled snapshot.
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
