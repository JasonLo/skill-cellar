//! The live skill fetcher: downloads a registry entry's skill directory from
//! GitHub into a temp dir via the public Contents API, recursing through any
//! sub-directories. Like `http_fetcher::HttpFetcher`, this is shell-only network
//! code (the core stays network-free behind the `SkillFetcher` trait, D-3).
//!
//! The returned `Materialized` is then run through the core's standard
//! validate-then-atomic-copy install engine — this module only *fetches files*.
//! Every path written is built by joining a single, validated path component at
//! a time (never a server-supplied full path), so a crafted entry can't write
//! outside the temp dir (defense in depth ahead of P-12's install-root check).

use serde::Deserialize;
use skill_cellar_core::{AppError, AppResult, Materialized, RegistryEntry, SkillFetcher};
use std::path::Path;

/// Cap recursion so a pathological (or hostile) repo layout can't fan out
/// without bound. Real skills are shallow; this is purely a safety rail.
const MAX_DEPTH: usize = 8;

pub struct HttpSkillFetcher {
    client: reqwest::blocking::Client,
    /// GitHub API base, e.g. `https://api.github.com`. Injectable for testing.
    api_base: String,
}

impl HttpSkillFetcher {
    pub fn new(api_base: impl Into<String>) -> Self {
        let client = reqwest::blocking::Client::builder()
            .user_agent(concat!("skill-cellar/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("failed to build HTTP client");
        HttpSkillFetcher {
            client,
            api_base: api_base.into(),
        }
    }

    /// Recursively download the directory at `remote_path` within `repo` into
    /// `local_dir`, preserving structure.
    fn fetch_dir(
        &self,
        repo: &str,
        remote_path: &str,
        git_ref: Option<&str>,
        local_dir: &Path,
        depth: usize,
    ) -> AppResult<()> {
        if depth > MAX_DEPTH {
            return Err(AppError::Network(format!(
                "skill tree deeper than {MAX_DEPTH} levels at '{remote_path}'"
            )));
        }

        let url = format!("{}/repos/{}/contents/{}", self.api_base, repo, remote_path);
        let mut req = self.client.get(&url);
        if let Some(r) = git_ref {
            req = req.query(&[("ref", r)]);
        }
        let resp = req
            .send()
            .map_err(|e| AppError::Network(e.to_string()))?
            .error_for_status()
            .map_err(|e| AppError::Network(e.to_string()))?;

        // A directory listing is a JSON array; a single file is an object. We
        // always point at a directory (the skill dir), so expect an array.
        let items: Vec<ContentItem> = resp
            .json()
            .map_err(|e| AppError::Network(format!("unexpected contents response: {e}")))?;

        std::fs::create_dir_all(local_dir)?;

        for item in items {
            // Never trust the server's `path`; only join one validated name.
            ensure_safe_component(&item.name)?;
            let child = local_dir.join(&item.name);
            let child_remote = join_remote(remote_path, &item.name);

            match item.kind.as_str() {
                "file" => {
                    let download_url = item.download_url.ok_or_else(|| {
                        AppError::Network(format!("file '{}' has no download_url", item.name))
                    })?;
                    let bytes = self
                        .client
                        .get(&download_url)
                        .send()
                        .map_err(|e| AppError::Network(e.to_string()))?
                        .error_for_status()
                        .map_err(|e| AppError::Network(e.to_string()))?
                        .bytes()
                        .map_err(|e| AppError::Network(e.to_string()))?;
                    std::fs::write(&child, &bytes)?;
                }
                "dir" => {
                    self.fetch_dir(repo, &child_remote, git_ref, &child, depth + 1)?;
                }
                // Skip symlinks/submodules: a librarian installs plain files.
                _ => continue,
            }
        }
        Ok(())
    }
}

impl SkillFetcher for HttpSkillFetcher {
    fn fetch_skill(&self, entry: &RegistryEntry) -> AppResult<Materialized> {
        let tmp = tempfile::tempdir().map_err(AppError::Io)?;
        let start = entry.subdir.clone().unwrap_or_default();
        self.fetch_dir(
            &entry.repo,
            &start,
            entry.git_ref.as_deref(),
            tmp.path(),
            0,
        )?;
        Ok(Materialized {
            dir: tmp.path().to_path_buf(),
            intended_name: entry.name.clone(),
            _guard: Some(tmp),
        })
    }
}

/// One entry from the GitHub Contents API.
#[derive(Deserialize)]
struct ContentItem {
    name: String,
    #[serde(rename = "type")]
    kind: String,
    download_url: Option<String>,
}

/// Reject any name that is not a single, normal path component, so a fetched
/// file can never escape the temp dir (mirrors the core's install-time check).
fn ensure_safe_component(name: &str) -> AppResult<()> {
    let mut comps = Path::new(name).components();
    match (comps.next(), comps.next()) {
        (Some(std::path::Component::Normal(c)), None) if c == name => Ok(()),
        _ => Err(AppError::UnsafePath(name.to_string())),
    }
}

/// Join a child name onto a remote path, with no leading slash when the base is
/// empty (repo root).
fn join_remote(base: &str, name: &str) -> String {
    if base.is_empty() {
        name.to_string()
    } else {
        format!("{}/{}", base.trim_end_matches('/'), name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_path_traversal_components() {
        for bad in ["..", "../escape", "a/b", "/etc", ".", ""] {
            assert!(ensure_safe_component(bad).is_err(), "{bad:?} must be unsafe");
        }
        for ok in ["SKILL.md", "references", "notes.md"] {
            assert!(ensure_safe_component(ok).is_ok(), "{ok:?} must be allowed");
        }
    }

    #[test]
    fn join_remote_handles_root_and_nesting() {
        assert_eq!(join_remote("", "SKILL.md"), "SKILL.md");
        assert_eq!(join_remote("skills/web-fetch", "SKILL.md"), "skills/web-fetch/SKILL.md");
        assert_eq!(join_remote("skills/web-fetch/", "refs"), "skills/web-fetch/refs");
    }
}
