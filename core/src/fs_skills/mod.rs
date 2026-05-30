//! Filesystem-backed skill operations: discover installed skills and install
//! new ones. The filesystem is the single source of truth (P-5) — `discover`
//! always re-scans disk; nothing about installed state is cached.

mod atomic;
mod source;

pub use atomic::atomic_install_dir;
pub use source::{read_skill_md, LocalDir, Materialized, SkillSource};

use crate::conformance::{self, Conformance};
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// A skill as seen on disk (or about to be installed), with its conformance
/// verdict attached so the shop/library can render a badge (Outcome 2).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct SkillDescriptor {
    /// Frontmatter `name`, falling back to the directory name if absent.
    pub name: String,
    /// The actual on-disk directory name.
    pub dir_name: String,
    pub path: PathBuf,
    pub description: Option<String>,
    pub conformance: Conformance,
}

impl SkillDescriptor {
    /// Build a descriptor for a skill directory by reading and evaluating its
    /// `SKILL.md`. A missing `SKILL.md` yields an Invalid verdict rather than
    /// an error, so the library can still list (and flag) the directory.
    pub fn read(skill_dir: &Path) -> SkillDescriptor {
        let dir_name = skill_dir
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let skill_md = source::read_skill_md(skill_dir);
        let conformance = match &skill_md {
            Some(text) => conformance::evaluate(text, &dir_name),
            None => Conformance::from_findings(vec![conformance::Finding::error(
                "frontmatter",
                "skill_md.missing",
                "directory has no SKILL.md",
            )]),
        };
        let fm_name = skill_md
            .as_deref()
            .and_then(extract_field("name"))
            .unwrap_or_else(|| dir_name.clone());
        let description = skill_md.as_deref().and_then(extract_field("description"));
        SkillDescriptor {
            name: fm_name,
            dir_name,
            path: skill_dir.to_path_buf(),
            description,
            conformance,
        }
    }
}

/// Discover every skill directory directly under `skills_root`. A missing
/// `skills_root` is an empty result, not an error.
pub fn discover(skills_root: &Path) -> AppResult<Vec<SkillDescriptor>> {
    let mut out = Vec::new();
    let entries = match std::fs::read_dir(skills_root) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(out),
        Err(e) => return Err(AppError::Io(e)),
    };
    for entry in entries {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            out.push(SkillDescriptor::read(&entry.path()));
        }
    }
    out.sort_by(|a, b| a.dir_name.cmp(&b.dir_name));
    Ok(out)
}

/// Install a skill from `source` into `target_skills_root`.
///
/// Order matters for Outcome 1: we materialize, then **validate before any
/// write**, then atomically copy. A validation failure returns
/// [`AppError::ValidationFailed`] having touched nothing in the target.
pub fn install(source: &dyn SkillSource, target_skills_root: &Path) -> AppResult<SkillDescriptor> {
    let materialized = source.materialize()?;
    let skill_md_path = materialized.dir.join("SKILL.md");
    let skill_md = std::fs::read_to_string(&skill_md_path)
        .map_err(|_| AppError::SkillMdMissing(skill_md_path.clone()))?;

    // Validate against the *intended install name* — the directory we are about
    // to create — so the `name == parent_dir` rule is meaningful (see DECISIONS).
    let conformance = conformance::evaluate(&skill_md, &materialized.intended_name);
    if !conformance.is_installable() {
        return Err(AppError::ValidationFailed(conformance));
    }

    let final_dir = target_skills_root.join(&materialized.intended_name);
    atomic_install_dir(&materialized.dir, &final_dir)?;

    Ok(SkillDescriptor::read(&final_dir))
}

/// Pull a single scalar string field out of YAML frontmatter without a full
/// parse — used only for display fallbacks in [`SkillDescriptor::read`].
fn extract_field(field: &'static str) -> impl Fn(&str) -> Option<String> {
    move |text: &str| {
        let inner = text
            .strip_prefix('\u{feff}')
            .unwrap_or(text)
            .trim_start_matches(['\n', '\r'])
            .strip_prefix("---")?;
        let end = inner.find("\n---")?;
        let block = &inner[..end];
        for line in block.lines() {
            if let Some(rest) = line.trim_start().strip_prefix(field) {
                if let Some(val) = rest.trim_start().strip_prefix(':') {
                    let v = val.trim().trim_matches(['"', '\'']).to_string();
                    if !v.is_empty() {
                        return Some(v);
                    }
                }
            }
        }
        None
    }
}
