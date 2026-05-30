//! The network seam. The core defines only the trait; the live HTTP
//! implementation lives in the Tauri shell (`src-tauri`) so this crate stays
//! network-free and hermetically testable. Tests inject fakes.

use crate::error::AppResult;

/// Fetches the curated catalog document from its remote source (a public,
/// read-only GitHub gist — I-5).
///
/// Returns the **raw JSON text** rather than a parsed manifest on purpose: the
/// core owns parsing and per-entry catalog-schema validation, so a single
/// malformed entry can be skipped (I-5 outcome 2) while the crate stays
/// network-free (P-14). The shell's `HttpFetcher` only performs the HTTP GET.
///
/// Synchronous on purpose: it keeps the core free of an async runtime, and the
/// Tauri command layer already runs install/registry work off the UI thread.
/// An offline / unreachable source must surface as
/// [`crate::error::AppError::Network`].
pub trait RegistryFetcher: Send + Sync {
    fn fetch_catalog(&self) -> AppResult<String>;
}
