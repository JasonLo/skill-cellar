//! Filesystem-backed skill operations: discover installed skills and install
//! new ones. The filesystem is the single source of truth (P-5) — `discover`
//! always re-scans disk; nothing about installed state is cached.

mod atomic;
mod source;

pub use atomic::{atomic_install_dir, atomic_write_file};
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

/// Reject any directory name that is not a single, normal path component, so a
/// caller-supplied name can never escape the target skills root (P-12). Rules
/// out empty, `.`, `..`, absolute paths, and anything containing a separator.
fn ensure_skill_dir_name(name: &str) -> AppResult<()> {
    let mut components = Path::new(name).components();
    match (components.next(), components.next()) {
        (Some(std::path::Component::Normal(c)), None) if c == name => Ok(()),
        _ => Err(AppError::UnsafePath(name.to_string())),
    }
}

/// Read the `SKILL.md` of an installed skill so Craft can load it for editing.
/// A missing file is [`AppError::SkillMdMissing`] (the caller asked to edit a
/// skill that has no `SKILL.md`), distinct from the tolerant [`read_skill_md`].
pub fn read_skill_md_at(target_skills_root: &Path, dir_name: &str) -> AppResult<String> {
    ensure_skill_dir_name(dir_name)?;
    let path = target_skills_root.join(dir_name).join("SKILL.md");
    std::fs::read_to_string(&path).map_err(|_| AppError::SkillMdMissing(path))
}

/// Publish a Craft-authored `SKILL.md` into `<target_skills_root>/<name>/`.
///
/// Mirrors [`install`]'s order exactly — **validate before any write** through
/// the one conformance source of truth (P-6) — so the publish gate and the
/// install gate can never diverge. Because the structured editor uses `name`
/// as both the frontmatter `name` and the directory name, the
/// `name == parent_dir` rule holds by construction (and a malformed `name`
/// fails validation *before* it is ever joined into a path).
///
/// Creates the directory for a new skill; for an existing one, overwrites only
/// `SKILL.md` and leaves any sibling resource files intact.
pub fn publish_skill(
    target_skills_root: &Path,
    name: &str,
    skill_md: &str,
) -> AppResult<SkillDescriptor> {
    let conformance = conformance::evaluate(skill_md, name);
    if !conformance.is_installable() {
        return Err(AppError::ValidationFailed(conformance));
    }
    // Defense in depth: a valid `name` is already separator-free, but assert the
    // path-confinement invariant (P-12) independently of the validator.
    ensure_skill_dir_name(name)?;

    let final_dir = target_skills_root.join(name);
    atomic_write_file(&final_dir, "SKILL.md", skill_md)?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conformance::Verdict;
    use crate::error::AppError;

    const VALID: &str = "---\nname: web-fetch\ndescription: Fetch a URL.\n---\n# Web Fetch\n";

    /// Outcome I-3: an invalid skill is rejected by the same gate as install,
    /// and **nothing is written** — the publish path validates before any FS op.
    #[test]
    fn publish_rejects_invalid_and_writes_nothing() {
        let root = tempfile::tempdir().unwrap();
        // Frontmatter `name` mismatching the (intended) directory → Invalid.
        let bad = "---\nname: not-web-fetch\ndescription: ok\n---\n";
        let err = publish_skill(root.path(), "web-fetch", bad).unwrap_err();
        assert!(matches!(err, AppError::ValidationFailed(_)));
        assert!(
            !root.path().join("web-fetch").exists(),
            "no directory should be created when validation fails"
        );
    }

    /// A valid skill is written, and a re-read round-trips the exact bytes.
    #[test]
    fn publish_writes_valid_skill() {
        let root = tempfile::tempdir().unwrap();
        let desc = publish_skill(root.path(), "web-fetch", VALID).unwrap();
        assert_eq!(desc.name, "web-fetch");
        assert_eq!(desc.conformance.verdict, Verdict::Valid);
        let written = read_skill_md_at(root.path(), "web-fetch").unwrap();
        assert_eq!(written, VALID);
    }

    /// Editing an existing skill overwrites only `SKILL.md`; sibling resource
    /// files are left intact.
    #[test]
    fn publish_preserves_sibling_files() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("web-fetch");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("reference.md"), "keep me").unwrap();

        let updated = "---\nname: web-fetch\ndescription: Updated.\n---\n# v2\n";
        publish_skill(root.path(), "web-fetch", updated).unwrap();

        assert_eq!(read_skill_md_at(root.path(), "web-fetch").unwrap(), updated);
        assert_eq!(
            std::fs::read_to_string(dir.join("reference.md")).unwrap(),
            "keep me",
            "sibling files must survive a re-publish"
        );
    }

    #[test]
    fn read_skill_md_at_missing_is_error() {
        let root = tempfile::tempdir().unwrap();
        let err = read_skill_md_at(root.path(), "nope").unwrap_err();
        assert!(matches!(err, AppError::SkillMdMissing(_)));
    }

    /// P-12: a directory name that tries to escape the skill root is rejected
    /// before any filesystem access, not silently resolved against the parent.
    #[test]
    fn read_rejects_path_traversal() {
        let root = tempfile::tempdir().unwrap();
        for bad in ["..", "../escape", "a/b", "/etc", ".", ""] {
            let err = read_skill_md_at(root.path(), bad).unwrap_err();
            assert!(
                matches!(err, AppError::UnsafePath(_)),
                "name {bad:?} should be rejected as unsafe, got {err:?}"
            );
        }
    }
}
