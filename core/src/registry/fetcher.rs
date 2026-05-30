//! The network seam. The core defines only the trait; the live HTTP
//! implementation lives in the Tauri shell (`src-tauri`) so this crate stays
//! network-free and hermetically testable. Tests inject fakes.

use crate::error::AppResult;
use crate::registry::RegistryManifest;

/// Fetches the curated registry manifest from its remote source.
///
/// Synchronous on purpose: it keeps the core free of an async runtime, and the
/// Tauri command layer already runs install/registry work off the UI thread.
/// An offline / unreachable remote must surface as [`crate::error::AppError::Network`].
pub trait RegistryFetcher: Send + Sync {
    fn fetch_manifest(&self) -> AppResult<RegistryManifest>;
}
