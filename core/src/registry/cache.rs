//! Registry persistence: the on-disk network cache and the bundled snapshot.
//!
//! Note this is a *network cache*, not installed-skill state — P-5 forbids the
//! latter, but caching what the remote returned is explicitly allowed so the
//! Featured shop survives offline.
//!
//! The cache wraps the manifest in an envelope carrying the wall-clock time it
//! was fetched, so `get_registry` can decide whether the cached copy is stale
//! enough to warrant a refresh from the gist (I-5 outcome 3).

use crate::error::{AppError, AppResult};
use crate::registry::RegistryManifest;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const CACHE_FILE: &str = "registry-cache.json";

/// The bundled snapshot, compiled into the binary so a first-run-offline user
/// still sees a Featured shelf.
const BUNDLED: &str = include_str!("default_registry.json");

/// On-disk cache envelope. `fetched_at_unix` is when *we* retrieved the
/// catalog (seconds since the Unix epoch), distinct from the manifest's own
/// `generated_at` (when the curator last edited the gist) — staleness is about
/// our copy's age, not the upstream edit time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedCatalog {
    pub fetched_at_unix: u64,
    pub manifest: RegistryManifest,
}

fn cache_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(CACHE_FILE)
}

pub fn read_cache(app_data_dir: &Path) -> AppResult<CachedCatalog> {
    let path = cache_path(app_data_dir);
    let text = std::fs::read_to_string(&path)?;
    serde_json::from_str(&text).map_err(|e| {
        AppError::Io(std::io::Error::other(format!(
            "corrupt registry cache: {e}"
        )))
    })
}

pub fn write_cache(
    app_data_dir: &Path,
    manifest: &RegistryManifest,
    fetched_at_unix: u64,
) -> AppResult<()> {
    std::fs::create_dir_all(app_data_dir)?;
    let cached = CachedCatalog {
        fetched_at_unix,
        manifest: manifest.clone(),
    };
    let text = serde_json::to_string_pretty(&cached)
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
    std::fs::write(cache_path(app_data_dir), text)?;
    Ok(())
}

/// Parse the compiled-in default registry. Only fails if the bundled JSON is
/// malformed, which a test guards against.
pub fn bundled_snapshot() -> AppResult<RegistryManifest> {
    serde_json::from_str(BUNDLED).map_err(|_| AppError::RegistryUnavailable)
}
