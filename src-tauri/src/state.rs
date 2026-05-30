//! Shared application state managed by Tauri. Holds the injected registry
//! fetcher (so it can be swapped in tests), resolved paths, and the active
//! install target. Per P-5 it holds NO installed-skill state — that always
//! comes from re-scanning the filesystem.

use skill_cellar_core::{RegistryFetcher, TargetKind};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub fetcher: Box<dyn RegistryFetcher>,
    pub app_data_dir: PathBuf,
    pub home_dir: PathBuf,
    pub active: Mutex<Option<TargetKind>>,
}

impl AppState {
    pub fn new(fetcher: Box<dyn RegistryFetcher>, app_data_dir: PathBuf, home_dir: PathBuf) -> Self {
        AppState {
            fetcher,
            app_data_dir,
            home_dir,
            active: Mutex::new(None),
        }
    }
}
