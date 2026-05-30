//! Where a skill's files come from before install.
//!
//! [`SkillSource::materialize`] yields a local directory containing the skill's
//! files plus the *intended* install name (the name the skill should occupy
//! under `.claude/skills/`). For I-1 the only implementation is [`LocalDir`]
//! (a skill already on disk — a fixture, a Craft draft, or a path the user
//! points at) and [`RemoteSkill`], which fetches a registry entry's files
//! through an injected [`SkillFetcher`] (the live GitHub download lives in the
//! Tauri shell) into a temp dir and installs them through the same engine.

use crate::error::AppResult;
use crate::registry::RegistryEntry;
use std::path::{Path, PathBuf};

/// A materialized skill: a readable directory and the name it intends to occupy.
pub struct Materialized {
    /// Directory whose contents are the skill (must contain `SKILL.md`).
    pub dir: PathBuf,
    /// The intended install name. This becomes `.claude/skills/<name>/` and is
    /// what conformance validates the frontmatter `name` against.
    pub intended_name: String,
    /// Optional guard that keeps a temp dir alive for the duration of install.
    pub _guard: Option<tempfile::TempDir>,
}

pub trait SkillSource {
    /// Produce a local directory holding the skill's files.
    fn materialize(&self) -> AppResult<Materialized>;
}

/// A skill that already exists as a local directory.
pub struct LocalDir {
    dir: PathBuf,
    intended_name: String,
}

impl LocalDir {
    /// Use the directory's own file name as the intended install name.
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        let dir = dir.into();
        let intended_name = dir
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        LocalDir { dir, intended_name }
    }

    /// Use the directory but install under an explicit name.
    pub fn with_name(dir: impl Into<PathBuf>, intended_name: impl Into<String>) -> Self {
        LocalDir {
            dir: dir.into(),
            intended_name: intended_name.into(),
        }
    }
}

impl SkillSource for LocalDir {
    fn materialize(&self) -> AppResult<Materialized> {
        Ok(Materialized {
            dir: self.dir.clone(),
            intended_name: self.intended_name.clone(),
            _guard: None,
        })
    }
}

/// Fetches a registry entry's skill files for install. This is the network seam
/// for the shop's GitHub-fetch install: like [`crate::RegistryFetcher`], the core
/// defines only the trait and the live HTTP/GitHub implementation lives in the
/// Tauri shell (`src-tauri`), keeping this crate network-free and hermetically
/// testable (D-3). An implementation downloads the entry's files into a temp dir
/// and returns it as a [`Materialized`] whose `_guard` keeps the temp dir alive
/// until install commits.
pub trait SkillFetcher: Send + Sync {
    /// Materialize the skill advertised by `entry` into a local directory. The
    /// returned [`Materialized::intended_name`] is the entry's `name`, so the
    /// `name == parent_dir` conformance rule is checked against the directory
    /// install will actually create.
    fn fetch_skill(&self, entry: &RegistryEntry) -> AppResult<Materialized>;
}

/// A skill sourced from a registry entry, materialized by delegating to an
/// injected [`SkillFetcher`]. Installing it runs the exact same
/// validate-then-atomic-copy engine as a local folder ([`super::install`]).
pub struct RemoteSkill<'a> {
    fetcher: &'a dyn SkillFetcher,
    entry: RegistryEntry,
}

impl<'a> RemoteSkill<'a> {
    pub fn new(fetcher: &'a dyn SkillFetcher, entry: RegistryEntry) -> Self {
        RemoteSkill { fetcher, entry }
    }
}

impl SkillSource for RemoteSkill<'_> {
    fn materialize(&self) -> AppResult<Materialized> {
        self.fetcher.fetch_skill(&self.entry)
    }
}

/// Read the `SKILL.md` text from a skill directory, if present.
pub fn read_skill_md(dir: &Path) -> Option<String> {
    std::fs::read_to_string(dir.join("SKILL.md")).ok()
}
