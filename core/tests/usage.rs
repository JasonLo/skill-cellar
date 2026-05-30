//! Integration test for I-2's outcome: report per-skill invocation counts
//! parsed from local Claude Code JSONL transcripts, grouped by project.

use skill_cellar_core::usage::{join_installed, usage_report};
use std::fs;
use std::path::Path;

/// A JSONL assistant line carrying a single Skill tool_use, as Claude Code
/// records it. `cwd` is the project key.
fn skill_line(cwd: &str, skill: &str) -> String {
    format!(
        r#"{{"type":"assistant","cwd":"{cwd}","message":{{"role":"assistant","content":[{{"type":"tool_use","name":"Skill","input":{{"skill":"{skill}"}}}}]}}}}"#
    )
}

/// Write a transcript file `<projects_root>/<folder>/<session>.jsonl` from the
/// given lines.
fn write_transcript(projects_root: &Path, folder: &str, session: &str, lines: &[String]) {
    let dir = projects_root.join(folder);
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join(format!("{session}.jsonl")), lines.join("\n")).unwrap();
}

#[test]
fn usage_counts_skill_invocations_by_project() {
    let root = tempfile::tempdir().unwrap();
    let projects_root = root.path();

    // Project A: graphify x2, ls-check x1 — split across two sessions, with a
    // pile of noise lines that MUST NOT be counted.
    let project_a = "/home/dev/repo/alpha";
    write_transcript(
        projects_root,
        "-home-dev-repo-alpha",
        "session-1",
        &[
            skill_line(project_a, "graphify"),
            skill_line(project_a, "ls-check"),
            // Noise: a non-Skill tool_use must be ignored.
            format!(
                r#"{{"type":"assistant","cwd":"{project_a}","message":{{"role":"assistant","content":[{{"type":"tool_use","name":"Bash","input":{{"command":"ls"}}}}]}}}}"#
            ),
            // Noise: a plain text assistant turn.
            format!(
                r#"{{"type":"assistant","cwd":"{project_a}","message":{{"role":"assistant","content":[{{"type":"text","text":"hello"}}]}}}}"#
            ),
            // Noise: a user line that happens to mention a Skill block shape.
            format!(r#"{{"type":"user","cwd":"{project_a}","message":{{"role":"user","content":"run graphify"}}}}"#),
            // Noise: malformed JSON.
            "{ this is not valid json".to_string(),
        ],
    );
    write_transcript(
        projects_root,
        "-home-dev-repo-alpha",
        "session-2",
        &[skill_line(project_a, "graphify")],
    );

    // Project B: graphify x1, in a nested session subdirectory (recursive walk).
    let project_b = "/home/dev/repo/beta";
    write_transcript(
        projects_root,
        "-home-dev-repo-beta/nested-uuid",
        "session-3",
        &[skill_line(project_b, "graphify")],
    );

    let report = usage_report(projects_root).expect("usage report should succeed");

    assert_eq!(report.projects.len(), 2, "two distinct projects expected");

    // Busiest project first: alpha has 3 invocations, beta has 1.
    let alpha = &report.projects[0];
    assert_eq!(alpha.project, project_a);
    assert_eq!(alpha.total, 3);
    // Within a project: most-used first, ties by name.
    assert_eq!(alpha.skills[0].skill, "graphify");
    assert_eq!(alpha.skills[0].count, 2);
    assert_eq!(alpha.skills[1].skill, "ls-check");
    assert_eq!(alpha.skills[1].count, 1);

    let beta = &report.projects[1];
    assert_eq!(beta.project, project_b);
    assert_eq!(beta.total, 1);
    assert_eq!(beta.skills, vec![skill_cellar_core::SkillCount { skill: "graphify".into(), count: 1 }]);
}

#[test]
fn usage_report_empty_when_no_transcripts() {
    let root = tempfile::tempdir().unwrap();
    // A projects root that does not exist -> empty report, not an error.
    let missing = root.path().join("does-not-exist");
    let report = usage_report(&missing).expect("missing root is not an error");
    assert!(report.projects.is_empty());
}

#[test]
fn join_installed_surfaces_unused() {
    let root = tempfile::tempdir().unwrap();
    let projects_root = root.path();
    write_transcript(
        projects_root,
        "-home-dev-repo-alpha",
        "s",
        &[skill_line("/home/dev/repo/alpha", "graphify")],
    );
    let report = usage_report(projects_root).unwrap();

    // `graphify` was used once; `dormant` is installed but never invoked.
    let installed = vec!["graphify".to_string(), "dormant".to_string()];
    let joined = join_installed(&report, &installed);

    // Unused first.
    assert_eq!(joined[0].skill, "dormant");
    assert_eq!(joined[0].total, 0);
    assert_eq!(joined[1].skill, "graphify");
    assert_eq!(joined[1].total, 1);
}
