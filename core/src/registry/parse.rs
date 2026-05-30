//! Tolerant catalog parsing (I-5 outcome 2).
//!
//! The catalog is a hand-curated GitHub gist edited out-of-band, so a single
//! fat-fingered entry must never take down the whole Shop. We parse the
//! envelope strictly (it is small and structural) but each `entries[*]` element
//! independently: an element that fails catalog-schema validation is skipped
//! and the remaining valid entries are surfaced. This mirrors D-8's tolerant
//! transcript parsing — never crash a read-only view on one malformed record.

use crate::error::{AppError, AppResult};
use crate::registry::{RegistryEntry, RegistryManifest};
use serde::Deserialize;
use serde_json::Value;

/// The catalog envelope. `entries` is intentionally `Vec<Value>` so we can
/// validate each element one at a time rather than failing the whole document.
#[derive(Deserialize)]
struct CatalogEnvelope {
    schema_version: u32,
    generated_at: String,
    entries: Vec<Value>,
}

/// Parse a raw catalog document, keeping only the entries that pass
/// catalog-schema validation.
///
/// Returns `Err(AppError::Network)` only when the *envelope* is unusable
/// (malformed JSON, or missing `schema_version` / `generated_at` / `entries`).
/// In `get_registry` that is treated exactly like an unreachable source, so the
/// Shop falls back to the cache or the bundled snapshot rather than breaking.
pub fn parse_catalog(json: &str) -> AppResult<RegistryManifest> {
    let envelope: CatalogEnvelope = serde_json::from_str(json)
        .map_err(|e| AppError::Network(format!("malformed catalog document: {e}")))?;

    let entries = envelope
        .entries
        .into_iter()
        .filter_map(valid_entry)
        .collect();

    Ok(RegistryManifest {
        schema_version: envelope.schema_version,
        generated_at: envelope.generated_at,
        entries,
    })
}

/// Validate one catalog entry: it must deserialize into a `RegistryEntry` (all
/// required fields present and well-typed) and carry non-empty, sane values.
/// Returns `None` for anything that fails, so the caller drops it silently.
fn valid_entry(value: Value) -> Option<RegistryEntry> {
    let entry: RegistryEntry = serde_json::from_value(value).ok()?;

    let name_ok = !entry.name.trim().is_empty();
    let desc_ok = !entry.description.trim().is_empty();
    // `repo` must look like `owner/name` so the install fetch (D-14) has a
    // resolvable target; reject empties and anything without a single segment.
    let repo_ok = {
        let mut parts = entry.repo.split('/');
        matches!(
            (parts.next(), parts.next(), parts.next()),
            (Some(owner), Some(name), None) if !owner.is_empty() && !name.is_empty()
        )
    };

    (name_ok && desc_ok && repo_ok).then_some(entry)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_valid_skips_invalid() {
        // One good entry, then three that each break a different rule
        // (missing field, empty name, malformed repo), then another good one.
        let json = r#"{
            "schema_version": 1,
            "generated_at": "2026-05-29T00:00:00Z",
            "entries": [
                { "name": "good-a", "description": "fine", "repo": "acme/a", "featured": true },
                { "name": "no-repo-field", "description": "missing repo", "featured": false },
                { "name": "  ", "description": "blank name", "repo": "acme/b", "featured": false },
                { "name": "bad-repo", "description": "no slash", "repo": "justname", "featured": false },
                { "name": "good-b", "description": "fine too", "repo": "acme/b", "featured": false }
            ]
        }"#;

        let manifest = parse_catalog(json).expect("envelope is well-formed");
        let names: Vec<_> = manifest.entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["good-a", "good-b"]);
    }

    #[test]
    fn malformed_envelope_is_an_error() {
        assert!(parse_catalog("not json at all").is_err());
        assert!(parse_catalog(r#"{ "schema_version": 1 }"#).is_err());
    }
}
