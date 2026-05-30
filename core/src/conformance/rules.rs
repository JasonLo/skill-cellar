//! The agentskills.io / `skills-ref` frontmatter rules, each producing zero or
//! more [`Finding`]s. Required-field and `name`/`description` violations are
//! errors (→ Invalid, install blocked per P-6); optional-field shape problems
//! are warnings (→ Warnings, still installable).

use super::frontmatter::Frontmatter;
use super::verdict::Finding;
use serde_yaml_ng::Value;

const NAME_MAX: usize = 64;
const DESC_MAX: usize = 1024;
const COMPAT_MAX: usize = 500;

/// `name`: required, ≤64 chars, lowercase `[a-z0-9-]`, no leading/trailing or
/// consecutive hyphen, and must equal the parent directory name.
pub fn check_name(fm: &Frontmatter, parent_dir: &str) -> Vec<Finding> {
    let mut out = Vec::new();
    let name = match fm.name.as_deref() {
        None => {
            out.push(Finding::error(
                "name",
                "name.missing",
                "frontmatter is missing the required `name` field",
            ));
            return out;
        }
        Some(n) => n,
    };

    if name.is_empty() {
        out.push(Finding::error("name", "name.empty", "`name` must not be empty"));
        return out;
    }

    if name.chars().count() > NAME_MAX {
        out.push(Finding::error(
            "name",
            "name.too_long",
            format!("`name` must be at most {NAME_MAX} characters"),
        ));
    }

    let valid_chars = name
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    let bad_edges = name.starts_with('-') || name.ends_with('-');
    let consecutive = name.contains("--");
    if !valid_chars || bad_edges || consecutive {
        out.push(Finding::error(
            "name",
            "name.format",
            "`name` must be lowercase letters, digits, and single hyphens \
             (no leading, trailing, or consecutive hyphens)",
        ));
    }

    if name != parent_dir {
        out.push(Finding::error(
            "name",
            "name.dir_mismatch",
            format!("`name` ('{name}') must match the parent directory name ('{parent_dir}')"),
        ));
    }

    out
}

/// `description`: required, non-empty, ≤1024 chars.
pub fn check_description(fm: &Frontmatter) -> Vec<Finding> {
    let mut out = Vec::new();
    match fm.description.as_deref() {
        None => out.push(Finding::error(
            "description",
            "description.missing",
            "frontmatter is missing the required `description` field",
        )),
        Some(d) if d.trim().is_empty() => out.push(Finding::error(
            "description",
            "description.empty",
            "`description` must not be empty",
        )),
        Some(d) if d.chars().count() > DESC_MAX => out.push(Finding::error(
            "description",
            "description.too_long",
            format!("`description` must be at most {DESC_MAX} characters"),
        )),
        Some(_) => {}
    }
    out
}

/// Optional fields: `compatibility` length and `metadata` value types. These
/// are warnings, never blocking.
pub fn check_optional(fm: &Frontmatter) -> Vec<Finding> {
    let mut out = Vec::new();

    if let Some(compat) = fm.compatibility.as_deref() {
        if compat.chars().count() > COMPAT_MAX {
            out.push(Finding::warning(
                "compatibility",
                "compatibility.too_long",
                format!("`compatibility` should be at most {COMPAT_MAX} characters"),
            ));
        }
    }

    if let Some(map) = &fm.metadata {
        let all_strings = map.values().all(|v| matches!(v, Value::String(_)));
        if !all_strings {
            out.push(Finding::warning(
                "metadata",
                "metadata.non_string",
                "`metadata` values should all be strings",
            ));
        }
    }

    out
}
