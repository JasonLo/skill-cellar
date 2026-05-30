//! skill-cellar-core
//!
//! Pure-Rust core for the skill-cellar librarian. Holds the logic behind
//! Intent I-1 (Shop, install & conformance):
//!
//! - [`conformance`] — validate a `SKILL.md` against the agentskills.io spec.
//! - [`fs_skills`] — discover installed skills and install new ones atomically.
//! - [`registry`] — fetch the curated registry with an offline fallback chain.
//! - [`projects`] — resolve the active install target.
//!
//! This crate has **no Tauri and no network dependency** on purpose: the rules
//! and file operations that the EARS outcomes pin down must build and test in
//! any environment. The Tauri shell (`src-tauri`) depends on this crate and
//! supplies the live HTTP fetcher + IPC commands.

pub mod conformance;
pub mod error;
pub mod fs_skills;
pub mod projects;
pub mod registry;

pub use conformance::{Conformance, Finding, Severity, Verdict};
pub use error::{AppError, AppResult};
pub use fs_skills::{install, SkillDescriptor, SkillSource};
pub use projects::TargetKind;
pub use registry::{
    get_registry, RegistryEntry, RegistryFetcher, RegistryManifest, RegistryResult, RegistrySource,
};
