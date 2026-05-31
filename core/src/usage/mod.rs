//! Usage analytics (Intent I-2).
//!
//! Read-only over the Claude Code JSONL transcripts that already live under
//! `~/.claude/projects/`. We count how often each skill was invoked, grouped by
//! the project (working directory) it was invoked in.
//!
//! A skill invocation is an `assistant` line whose `message.content[]` holds a
//! block with `type == "tool_use"`, `name == "Skill"`, and `input.skill ==
//! "<name>"`. The project key is the top-level `cwd` recorded on the line — the
//! authoritative working directory — rather than the lossy slash→hyphen folder
//! encoding under `projects/`.
//!
//! Transcripts are an external, evolving format, so parsing is tolerant: every
//! line is read as a generic `serde_json::Value` and any line that fails to
//! parse, or that isn't a Skill-bearing assistant line, is simply skipped — the
//! report never errors on a bad line. Counts are derived on read and never
//! persisted (P-5).

use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use walkdir::WalkDir;

/// How many times one skill was invoked.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct SkillCount {
    pub skill: String,
    pub count: u64,
}

/// Per-skill invocation counts for a single project (working directory).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct ProjectUsage {
    /// The project working directory (the transcript `cwd`).
    pub project: String,
    /// Total invocations across every skill in this project.
    pub total: u64,
    /// Per-skill counts, sorted by count desc then skill name asc.
    pub skills: Vec<SkillCount>,
}

/// Per-skill invocation counts grouped by project.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct UsageReport {
    /// Projects, sorted by total invocations desc then project path asc.
    pub projects: Vec<ProjectUsage>,
}

/// An installed skill alongside its total invocations across all projects.
/// `total == 0` means the skill is installed but never recorded as used.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct InstalledUsage {
    pub skill: String,
    pub total: u64,
}

/// Walk every `*.jsonl` transcript under `projects_root` and count Skill
/// invocations grouped by the `cwd` recorded on each line.
///
/// A missing `projects_root` yields an empty report rather than an error
/// (mirrors [`crate::fs_skills::discover`]; the filesystem is the source of
/// truth and "no transcripts" is a valid, empty result, P-5).
pub fn usage_report(projects_root: &Path) -> AppResult<UsageReport> {
    // project cwd -> (skill name -> count)
    let mut by_project: HashMap<String, HashMap<String, u64>> = HashMap::new();

    if projects_root.exists() {
        for entry in WalkDir::new(projects_root)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|e| e.file_type().is_file())
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "jsonl"))
        {
            // A transcript that can't be read is skipped, not fatal.
            let Ok(contents) = std::fs::read_to_string(entry.path()) else {
                continue;
            };
            for line in contents.lines() {
                if let Some((cwd, skills)) = skill_invocations(line) {
                    let project = by_project.entry(cwd).or_default();
                    for skill in skills {
                        *project.entry(skill).or_insert(0) += 1;
                    }
                }
            }
        }
    }

    let mut projects: Vec<ProjectUsage> = by_project
        .into_iter()
        .map(|(project, counts)| {
            let total = counts.values().sum();
            let mut skills: Vec<SkillCount> = counts
                .into_iter()
                .map(|(skill, count)| SkillCount { skill, count })
                .collect();
            // Most-used first; ties broken by name for determinism.
            skills.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.skill.cmp(&b.skill)));
            ProjectUsage {
                project,
                total,
                skills,
            }
        })
        .collect();
    // Busiest project first; ties broken by path for determinism.
    projects.sort_by(|a, b| {
        b.total
            .cmp(&a.total)
            .then_with(|| a.project.cmp(&b.project))
    });

    Ok(UsageReport { projects })
}

/// Sum each skill's invocations across every project, then ensure every
/// installed skill appears — including those with zero invocations, so unused
/// installed skills surface explicitly. Sorted unused-first (total asc), ties
/// broken by name.
pub fn join_installed(report: &UsageReport, installed_names: &[String]) -> Vec<InstalledUsage> {
    let mut totals: HashMap<&str, u64> = HashMap::new();
    for project in &report.projects {
        for sc in &project.skills {
            *totals.entry(sc.skill.as_str()).or_insert(0) += sc.count;
        }
    }

    let mut out: Vec<InstalledUsage> = installed_names
        .iter()
        .map(|name| InstalledUsage {
            skill: name.clone(),
            total: totals.get(name.as_str()).copied().unwrap_or(0),
        })
        .collect();
    // Unused first (so they're easy to prune), then by name.
    out.sort_by(|a, b| a.total.cmp(&b.total).then_with(|| a.skill.cmp(&b.skill)));
    out
}

/// If `line` is an assistant line carrying one or more Skill-tool invocations,
/// return `(cwd, skill_names)`.
///
/// Returns `None` for anything else: malformed JSON, non-assistant lines, a
/// missing `cwd`, or an assistant line with no Skill tool_use. A single message
/// may contain several Skill blocks, so all of them are collected. Tolerant by
/// design (D-8).
fn skill_invocations(line: &str) -> Option<(String, Vec<String>)> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    if v.get("type")?.as_str()? != "assistant" {
        return None;
    }
    let cwd = v.get("cwd")?.as_str()?.to_string();
    let content = v.get("message")?.get("content")?.as_array()?;
    let skills: Vec<String> = content
        .iter()
        .filter(|block| {
            block.get("type").and_then(|t| t.as_str()) == Some("tool_use")
                && block.get("name").and_then(|n| n.as_str()) == Some("Skill")
        })
        .filter_map(|block| {
            block
                .get("input")
                .and_then(|i| i.get("skill"))
                .and_then(|s| s.as_str())
                .map(str::to_string)
        })
        .collect();
    if skills.is_empty() {
        None
    } else {
        Some((cwd, skills))
    }
}
