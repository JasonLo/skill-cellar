//! Verdict, findings, and the fold from findings → a single verdict tier.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "lowercase")]
pub enum Verdict {
    Valid,
    Warnings,
    Invalid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
}

/// A single conformance issue. `code` is a stable machine identifier
/// (e.g. `name.dir_mismatch`); `message` is human-facing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct Finding {
    pub field: String,
    pub severity: Severity,
    pub code: String,
    pub message: String,
}

impl Finding {
    pub fn error(field: &str, code: &str, message: impl Into<String>) -> Self {
        Finding {
            field: field.to_string(),
            severity: Severity::Error,
            code: code.to_string(),
            message: message.into(),
        }
    }

    pub fn warning(field: &str, code: &str, message: impl Into<String>) -> Self {
        Finding {
            field: field.to_string(),
            severity: Severity::Warning,
            code: code.to_string(),
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct Conformance {
    pub verdict: Verdict,
    pub findings: Vec<Finding>,
}

impl Conformance {
    /// Fold a set of findings into a verdict: any error ⇒ Invalid; no findings
    /// ⇒ Valid; otherwise (warnings only) ⇒ Warnings.
    pub fn from_findings(findings: Vec<Finding>) -> Self {
        let verdict = if findings.iter().any(|f| f.severity == Severity::Error) {
            Verdict::Invalid
        } else if findings.is_empty() {
            Verdict::Valid
        } else {
            Verdict::Warnings
        };
        Conformance { verdict, findings }
    }

    /// A skill may be installed unless it is outright Invalid (P-6).
    pub fn is_installable(&self) -> bool {
        self.verdict != Verdict::Invalid
    }

    /// True if any finding carries the given stable code. Handy in tests.
    pub fn has_code(&self, code: &str) -> bool {
        self.findings.iter().any(|f| f.code == code)
    }
}
