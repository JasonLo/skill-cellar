//! The active install target: either a specific project directory or the user's
//! global `~/.claude`. Minimal for I-1 — just enough to resolve a `.claude/skills`
//! root to install into and list from.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "snake_case", tag = "kind", content = "path")]
pub enum TargetKind {
    /// A project directory; skills live under `<project>/.claude/skills`.
    Project(PathBuf),
    /// The user's global skills under `<home>/.claude/skills`.
    Global,
}

impl TargetKind {
    /// Resolve the `.claude/skills` root for this target. For `Global`, the
    /// caller supplies the home directory (the core never reads the
    /// environment, so the Tauri shell passes it in).
    pub fn skills_root(&self, home: &Path) -> PathBuf {
        match self {
            TargetKind::Project(dir) => dir.join(".claude").join("skills"),
            TargetKind::Global => home.join(".claude").join("skills"),
        }
    }
}
