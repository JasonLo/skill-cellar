//! Tauri IPC command surface. Each command is a thin wrapper over the core;
//! all real logic lives in `skill-cellar-core`. Commands return
//! `Result<T, CommandError>` — a serializable, specta-typed projection of the
//! core's `AppError` so the frontend gets a stable, switchable error shape.

use crate::state::AppState;
use serde::Serialize;
use skill_cellar_core::{
    self as core, AppError, Conformance, InstalledUsage, LocalDir, ProjectUsage, RegistryEntry,
    RegistryResult, SkillDescriptor, TargetKind,
};
use std::path::PathBuf;
use tauri::State;

/// IPC-facing error. Mirrors `AppError` but is `Serialize + specta::Type`.
#[derive(Debug, Serialize, specta::Type)]
pub struct CommandError {
    pub kind: String,
    pub message: String,
    /// Present only for validation failures, so the UI can show why a skill
    /// was rejected.
    pub conformance: Option<Conformance>,
}

impl From<AppError> for CommandError {
    fn from(e: AppError) -> Self {
        let conformance = match &e {
            AppError::ValidationFailed(c) => Some(c.clone()),
            _ => None,
        };
        CommandError {
            kind: e.kind().to_string(),
            message: e.to_string(),
            conformance,
        }
    }
}

type CmdResult<T> = Result<T, CommandError>;

/// Resolve the `.claude/skills` root for a target using the app's home dir.
fn skills_root(state: &AppState, target: &TargetKind) -> PathBuf {
    target.skills_root(&state.home_dir)
}

/// Fetch the curated registry, with offline fallback to cache/bundled snapshot.
#[tauri::command]
#[specta::specta]
pub fn get_registry(state: State<'_, AppState>) -> CmdResult<RegistryResult> {
    Ok(core::get_registry(state.fetcher.as_ref(), &state.app_data_dir)?)
}

/// List the skills installed under a target, each with its conformance verdict.
#[tauri::command]
#[specta::specta]
pub fn list_skills(state: State<'_, AppState>, target: TargetKind) -> CmdResult<Vec<SkillDescriptor>> {
    Ok(core::fs_skills::discover(&skills_root(&state, &target))?)
}

/// Evaluate raw SKILL.md text against the spec (used for previews/Craft).
#[tauri::command]
#[specta::specta]
pub fn check_conformance(skill_md: String, parent_dir_name: String) -> Conformance {
    core::conformance::evaluate(&skill_md, &parent_dir_name)
}

/// Install a skill from a local directory into a target (the `SkillSource`
/// abstraction). Installing directly from a shop registry entry is the sibling
/// `install_registry_skill`, which shares this same validate-then-copy engine.
#[tauri::command]
#[specta::specta]
pub fn install_local_skill(
    state: State<'_, AppState>,
    source_dir: PathBuf,
    target: TargetKind,
) -> CmdResult<SkillDescriptor> {
    let root = skills_root(&state, &target);
    Ok(core::install(&LocalDir::new(source_dir), &root)?)
}

/// Install a skill from a shop registry entry: fetch its files from GitHub,
/// then run the **same** validate-then-atomic-copy engine as the local-folder
/// path (`install_local_skill`). A validation failure returns
/// `CommandError { kind: "validation_failed", conformance, .. }` and touches
/// nothing on disk; an unreachable repo surfaces as `kind: "network"`.
#[tauri::command]
#[specta::specta]
pub fn install_registry_skill(
    state: State<'_, AppState>,
    entry: RegistryEntry,
    target: TargetKind,
) -> CmdResult<SkillDescriptor> {
    let root = skills_root(&state, &target);
    Ok(core::install_from_registry(
        state.skill_fetcher.as_ref(),
        &entry,
        &root,
    )?)
}

/// Read an installed skill's `SKILL.md` so Craft can load it for editing.
#[tauri::command]
#[specta::specta]
pub fn read_skill(state: State<'_, AppState>, target: TargetKind, dir_name: String) -> CmdResult<String> {
    Ok(core::fs_skills::read_skill_md_at(&skills_root(&state, &target), &dir_name)?)
}

/// Validate and write a Craft-authored `SKILL.md` into the target. Re-validates
/// through the same conformance gate as install (P-6); a validation failure
/// returns `CommandError { kind: "validation_failed", conformance, .. }` and
/// touches nothing on disk.
#[tauri::command]
#[specta::specta]
pub fn publish_skill(
    state: State<'_, AppState>,
    target: TargetKind,
    name: String,
    skill_md: String,
) -> CmdResult<SkillDescriptor> {
    Ok(core::fs_skills::publish_skill(&skills_root(&state, &target), &name, &skill_md)?)
}

#[tauri::command]
#[specta::specta]
pub fn set_active_target(state: State<'_, AppState>, target: TargetKind) -> CmdResult<()> {
    *state.active.lock().unwrap() = Some(target);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_active_target(state: State<'_, AppState>) -> CmdResult<Option<TargetKind>> {
    Ok(state.active.lock().unwrap().clone())
}

/// The Usage screen's view: per-project invocation counts (the I-2 outcome),
/// plus installed skills annotated with their total invocations so unused ones
/// (total 0) surface for pruning.
#[derive(Debug, Serialize, specta::Type)]
pub struct UsageView {
    pub projects: Vec<ProjectUsage>,
    pub installed: Vec<InstalledUsage>,
}

/// Report skill usage parsed from the local Claude Code transcripts under
/// `~/.claude/projects/`, grouped by project, and joined against the skills
/// installed in the global target (plus the active project target, if one is
/// set) so never-used installed skills are visible. Read-only (I-2 / P-5).
#[tauri::command]
#[specta::specta]
pub fn get_usage(state: State<'_, AppState>) -> CmdResult<UsageView> {
    let projects_root = state.home_dir.join(".claude").join("projects");
    let report = core::usage::usage_report(&projects_root)?;

    // Installed skill names: always the global target, plus the active project
    // target when one is selected. Discovery tolerates a missing root (-> []).
    let mut targets = vec![TargetKind::Global];
    if let Some(active @ TargetKind::Project(_)) = state.active.lock().unwrap().clone() {
        targets.push(active);
    }
    let mut names: Vec<String> = Vec::new();
    for target in &targets {
        for desc in core::fs_skills::discover(&skills_root(&state, target))? {
            names.push(desc.name);
        }
    }
    names.sort();
    names.dedup();

    let installed = core::usage::join_installed(&report, &names);
    Ok(UsageView {
        projects: report.projects,
        installed,
    })
}
