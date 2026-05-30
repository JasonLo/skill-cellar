//! Integration test for I-1's shop-install outcome: installing a skill from a
//! registry entry fetches the skill's files and runs them through the **same**
//! validate-then-atomic-copy engine as the local-folder path. The network is
//! the injected `SkillFetcher` seam (D-3), so this stays hermetic — no GitHub.

use skill_cellar_core::error::AppError;
use skill_cellar_core::{install_from_registry, Materialized, RegistryEntry, SkillFetcher, Verdict};
use std::fs;
use std::sync::atomic::{AtomicU32, Ordering};

/// A fake `SkillFetcher` standing in for the live GitHub download: it writes the
/// configured `SKILL.md` (plus an optional sub-file, to prove the whole tree is
/// installed) into a fresh temp dir and hands it back as a `Materialized`. It
/// records how many times it was asked to fetch so the test can prove the fetch
/// actually happened (and did *not* happen when validation should pre-empt it…
/// here the fetch always precedes validation, mirroring the real flow).
struct FakeFetcher {
    skill_md: String,
    with_subfile: bool,
    fetches: AtomicU32,
}

impl FakeFetcher {
    fn new(skill_md: impl Into<String>, with_subfile: bool) -> Self {
        FakeFetcher {
            skill_md: skill_md.into(),
            with_subfile,
            fetches: AtomicU32::new(0),
        }
    }
}

impl SkillFetcher for FakeFetcher {
    fn fetch_skill(&self, entry: &RegistryEntry) -> Result<Materialized, AppError> {
        self.fetches.fetch_add(1, Ordering::SeqCst);
        let tmp = tempfile::tempdir().map_err(AppError::Io)?;
        fs::write(tmp.path().join("SKILL.md"), &self.skill_md).unwrap();
        if self.with_subfile {
            fs::create_dir_all(tmp.path().join("references")).unwrap();
            fs::write(tmp.path().join("references").join("notes.md"), "notes").unwrap();
        }
        Ok(Materialized {
            dir: tmp.path().to_path_buf(),
            // The entry's name is the directory install will create and the name
            // conformance validates the frontmatter against.
            intended_name: entry.name.clone(),
            _guard: Some(tmp),
        })
    }
}

fn entry(name: &str) -> RegistryEntry {
    RegistryEntry {
        name: name.to_string(),
        description: "A registry-advertised skill.".to_string(),
        repo: "agentskills/examples".to_string(),
        subdir: Some(format!("skills/{name}")),
        git_ref: None,
        featured: true,
    }
}

fn valid_skill_md(name: &str) -> String {
    format!("---\nname: {name}\ndescription: A valid skill for testing.\n---\n# {name}\n")
}

#[test]
fn install_from_registry_fetches_validates_installs() {
    // (a) Happy path: the entry's files are fetched, validated, and atomically
    //     copied — the full tree lands, with a Valid verdict.
    {
        let target = tempfile::tempdir().unwrap();
        let skills_root = target.path().join(".claude").join("skills");

        let fetcher = FakeFetcher::new(valid_skill_md("web-fetch"), true);
        let desc = install_from_registry(&fetcher, &entry("web-fetch"), &skills_root)
            .expect("a valid registry skill should install");

        assert_eq!(fetcher.fetches.load(Ordering::SeqCst), 1, "must fetch once");
        assert_eq!(desc.conformance.verdict, Verdict::Valid);
        assert_eq!(desc.name, "web-fetch");
        assert!(skills_root.join("web-fetch").join("SKILL.md").exists());
        assert!(
            skills_root
                .join("web-fetch")
                .join("references")
                .join("notes.md")
                .exists(),
            "the whole fetched skill tree must be installed, not just SKILL.md"
        );
    }

    // (b) Same gate as install: a fetched skill whose frontmatter `name` does
    //     not match the entry's name fails validation, and nothing is written.
    {
        let target = tempfile::tempdir().unwrap();
        let skills_root = target.path().join(".claude").join("skills");

        // Entry advertises `web-fetch`, but the fetched frontmatter says
        // `not-web-fetch` → name != intended dir → Invalid, before any copy.
        let fetcher = FakeFetcher::new(valid_skill_md("not-web-fetch"), false);
        let err = install_from_registry(&fetcher, &entry("web-fetch"), &skills_root)
            .expect_err("a name mismatch must fail the same validation as install");

        match err {
            AppError::ValidationFailed(c) => assert_eq!(c.verdict, Verdict::Invalid),
            other => panic!("expected ValidationFailed, got {other:?}"),
        }
        assert!(
            !skills_root.join("web-fetch").exists(),
            "no skill directory may be created when validation fails"
        );
        if skills_root.exists() {
            assert!(
                fs::read_dir(&skills_root).unwrap().next().is_none(),
                "target skills root must be empty after a failed install"
            );
        }
    }
}
