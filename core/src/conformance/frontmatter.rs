//! Splitting and parsing the YAML frontmatter out of a `SKILL.md`.
//!
//! The YAML dependency is deliberately confined to this file so swapping the
//! parser later is a one-file change.

use serde::Deserialize;
use serde_yaml_ng::{Mapping, Value};

/// The typed view of a `SKILL.md` frontmatter block. Every field is optional so
/// a *missing* required field becomes a conformance finding rather than a parse
/// error. `metadata` and `allowed_tools` stay as raw YAML so we can warn about
/// their shape without rejecting the whole document.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Frontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    pub license: Option<String>,
    pub compatibility: Option<String>,
    #[serde(default)]
    pub metadata: Option<Mapping>,
    #[serde(rename = "allowed-tools", default)]
    pub allowed_tools: Option<Value>,
}

#[derive(Debug)]
pub enum FrontmatterError {
    /// No `--- ... ---` block at the top of the document.
    Missing,
    /// A block was found but the YAML inside did not parse / map to our shape.
    Parse(String),
}

/// Extract the raw YAML text between the opening and closing `---` fences.
///
/// Accepts an optional leading UTF-8 BOM and blank lines, but the first
/// non-empty line must be exactly `---`.
pub fn split_frontmatter(skill_md: &str) -> Result<&str, FrontmatterError> {
    let text = skill_md.strip_prefix('\u{feff}').unwrap_or(skill_md);
    let trimmed_start = text.trim_start_matches(['\n', '\r']);

    let rest = trimmed_start
        .strip_prefix("---")
        .ok_or(FrontmatterError::Missing)?;
    // The opening fence must be its own line.
    let rest = rest
        .strip_prefix('\n')
        .or_else(|| rest.strip_prefix("\r\n"))
        .ok_or(FrontmatterError::Missing)?;

    // Find the closing fence: a line that is exactly `---`.
    for (idx, line) in LineOffsets::new(rest) {
        if line.trim_end() == "---" {
            return Ok(&rest[..idx]);
        }
    }
    Err(FrontmatterError::Missing)
}

/// Parse the frontmatter of a `SKILL.md` into a typed [`Frontmatter`].
pub fn parse_frontmatter(skill_md: &str) -> Result<Frontmatter, FrontmatterError> {
    let yaml = split_frontmatter(skill_md)?;
    // An empty frontmatter block is valid YAML (null) but our struct needs a
    // mapping; treat null/empty as an all-None frontmatter.
    if yaml.trim().is_empty() {
        return Ok(Frontmatter::default());
    }
    serde_yaml_ng::from_str::<Frontmatter>(yaml)
        .map_err(|e| FrontmatterError::Parse(e.to_string()))
}

/// Iterator yielding `(byte_offset_of_line_start, line_str)` for each line.
struct LineOffsets<'a> {
    rest: &'a str,
    pos: usize,
}

impl<'a> LineOffsets<'a> {
    fn new(s: &'a str) -> Self {
        LineOffsets { rest: s, pos: 0 }
    }
}

impl<'a> Iterator for LineOffsets<'a> {
    type Item = (usize, &'a str);

    fn next(&mut self) -> Option<Self::Item> {
        if self.pos >= self.rest.len() {
            return None;
        }
        let start = self.pos;
        let slice = &self.rest[start..];
        match slice.find('\n') {
            Some(nl) => {
                let line = &slice[..nl];
                self.pos = start + nl + 1;
                Some((start, line))
            }
            None => {
                self.pos = self.rest.len();
                Some((start, slice))
            }
        }
    }
}
