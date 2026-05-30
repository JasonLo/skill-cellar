//! Registry persistence: the on-disk network cache and the bundled snapshot.
//!
//! Note this is a *network cache*, not installed-skill state — P-5 forbids the
//! latter, but caching what the remote returned is explicitly allowed so the
//! Featured shop survives offline.

use crate::error::{AppError, AppResult};
use crate::registry::RegistryManifest;
use std::path::{Path, PathBuf};

const CACHE_FILE: &str = "registry-cache.json";

/// The bundled snapshot, compiled into the binary so a first-run-offline user
/// still sees a Featured shelf.
const BUNDLED: &str = include_str!("default_registry.json");

fn cache_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(CACHE_FILE)
}

pub fn read_cache(app_data_dir: &Path) -> AppResult<RegistryManifest> {
    let path = cache_path(app_data_dir);
    let text = std::fs::read_to_string(&path)?;
    serde_json::from_str(&text)
        .map_err(|e| AppError::Io(std::io::Error::other(format!("corrupt registry cache: {e}"))))
}

pub fn write_cache(app_data_dir: &Path, manifest: &RegistryManifest) -> AppResult<()> {
    std::fs::create_dir_all(app_data_dir)?;
    let text = serde_json::to_string_pretty(manifest)
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
    std::fs::write(cache_path(app_data_dir), text)?;
    Ok(())
}

/// Parse the compiled-in default registry. Only fails if the bundled JSON is
/// malformed, which a test guards against.
pub fn bundled_snapshot() -> AppResult<RegistryManifest> {
    serde_json::from_str(BUNDLED).map_err(|_| AppError::RegistryUnavailable)
}
