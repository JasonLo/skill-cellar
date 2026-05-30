//! Conformance: derive a [`Conformance`] verdict for a `SKILL.md`.
//!
//! [`evaluate`] is infallible by design — a malformed or absent frontmatter
//! becomes an `Invalid` verdict with a `frontmatter.*` finding, never a panic
//! or an `Err`. That keeps the shop/library able to render a verdict for every
//! skill it encounters (Outcome 2).

mod frontmatter;
mod rules;
mod verdict;

pub use frontmatter::Frontmatter;
pub use verdict::{Conformance, Finding, Severity, Verdict};

use frontmatter::FrontmatterError;

/// Evaluate a `SKILL.md` against the agentskills.io rules. `parent_dir_name` is
/// the directory the skill lives in (or, at install time, the directory we are
/// about to create) — the `name == parent_dir` rule is checked against it.
pub fn evaluate(skill_md: &str, parent_dir_name: &str) -> Conformance {
    let fm = match frontmatter::parse_frontmatter(skill_md) {
        Ok(fm) => fm,
        Err(FrontmatterError::Missing) => {
            return Conformance::from_findings(vec![Finding::error(
                "frontmatter",
                "frontmatter.missing",
                "SKILL.md has no YAML frontmatter block",
            )]);
        }
        Err(FrontmatterError::Parse(msg)) => {
            return Conformance::from_findings(vec![Finding::error(
                "frontmatter",
                "frontmatter.parse",
                format!("could not parse SKILL.md frontmatter: {msg}"),
            )]);
        }
    };

    let mut findings = Vec::new();
    findings.extend(rules::check_name(&fm, parent_dir_name));
    findings.extend(rules::check_description(&fm));
    findings.extend(rules::check_optional(&fm));
    Conformance::from_findings(findings)
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = "---\nname: web-fetch\ndescription: Fetch a URL and return its body.\nlicense: MIT\n---\n# Web Fetch\n";

    /// Outcome 2: a verdict of valid / warnings / invalid is derived purely
    /// from the SKILL.md frontmatter rules. Table-driven across every tier and
    /// the rules that move a skill between tiers.
    #[test]
    fn conformance_verdict_from_frontmatter() {
        struct Case {
            name: &'static str,
            skill_md: String,
            parent_dir: &'static str,
            expect: Verdict,
            expect_code: Option<&'static str>,
        }

        let long_desc = "x".repeat(1025);
        let long_compat = "c".repeat(600);

        let cases = vec![
            Case {
                name: "valid skill",
                skill_md: VALID.to_string(),
                parent_dir: "web-fetch",
                expect: Verdict::Valid,
                expect_code: None,
            },
            Case {
                name: "name does not match parent dir",
                skill_md: "---\nname: webfetch\ndescription: ok\n---\n".to_string(),
                parent_dir: "web-fetch",
                expect: Verdict::Invalid,
                expect_code: Some("name.dir_mismatch"),
            },
            Case {
                name: "missing description",
                skill_md: "---\nname: web-fetch\n---\n".to_string(),
                parent_dir: "web-fetch",
                expect: Verdict::Invalid,
                expect_code: Some("description.missing"),
            },
            Case {
                name: "description too long",
                skill_md: format!("---\nname: web-fetch\ndescription: {long_desc}\n---\n"),
                parent_dir: "web-fetch",
                expect: Verdict::Invalid,
                expect_code: Some("description.too_long"),
            },
            Case {
                name: "consecutive hyphen in name",
                skill_md: "---\nname: web--fetch\ndescription: ok\n---\n".to_string(),
                parent_dir: "web--fetch",
                expect: Verdict::Invalid,
                expect_code: Some("name.format"),
            },
            Case {
                name: "uppercase in name",
                skill_md: "---\nname: WebFetch\ndescription: ok\n---\n".to_string(),
                parent_dir: "WebFetch",
                expect: Verdict::Invalid,
                expect_code: Some("name.format"),
            },
            Case {
                name: "over-length compatibility is a warning, still installable",
                skill_md: format!(
                    "---\nname: web-fetch\ndescription: ok\ncompatibility: {long_compat}\n---\n"
                ),
                parent_dir: "web-fetch",
                expect: Verdict::Warnings,
                expect_code: Some("compatibility.too_long"),
            },
            Case {
                name: "non-string metadata value is a warning",
                skill_md: "---\nname: web-fetch\ndescription: ok\nmetadata:\n  count: 3\n---\n"
                    .to_string(),
                parent_dir: "web-fetch",
                expect: Verdict::Warnings,
                expect_code: Some("metadata.non_string"),
            },
            Case {
                name: "missing frontmatter block",
                skill_md: "# Just a heading, no frontmatter\n".to_string(),
                parent_dir: "web-fetch",
                expect: Verdict::Invalid,
                expect_code: Some("frontmatter.missing"),
            },
            Case {
                name: "malformed yaml",
                skill_md: "---\nname: [unterminated\n---\n".to_string(),
                parent_dir: "web-fetch",
                expect: Verdict::Invalid,
                expect_code: Some("frontmatter.parse"),
            },
        ];

        for c in cases {
            let result = evaluate(&c.skill_md, c.parent_dir);
            assert_eq!(
                result.verdict, c.expect,
                "case '{}': expected {:?}, got {:?} (findings: {:?})",
                c.name, c.expect, result.verdict, result.findings
            );
            if let Some(code) = c.expect_code {
                assert!(
                    result.has_code(code),
                    "case '{}': expected a finding with code '{}', got {:?}",
                    c.name,
                    code,
                    result.findings
                );
            } else {
                assert!(
                    result.findings.is_empty(),
                    "case '{}': expected no findings, got {:?}",
                    c.name,
                    result.findings
                );
            }
        }
    }
}
