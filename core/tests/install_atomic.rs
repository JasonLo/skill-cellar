//! Integration test for Outcome 1: install validates against the spec, then
//! copies atomically — leaving no partial directory if validation or the copy
//! fails.

use skill_cellar_core::error::AppError;
use skill_cellar_core::fs_skills::{install, LocalDir};
use skill_cellar_core::Verdict;
use std::fs;
use std::path::{Path, PathBuf};

/// Write a skill directory `<root>/<dir_name>/SKILL.md` with the given body and
/// return the skill dir path.
fn make_skill(root: &Path, dir_name: &str, skill_md: &str) -> PathBuf {
    let dir = root.join(dir_name);
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("SKILL.md"), skill_md).unwrap();
    // A subfile to prove the whole tree is copied, not just SKILL.md.
    fs::create_dir_all(dir.join("references")).unwrap();
    fs::write(dir.join("references").join("notes.md"), "notes").unwrap();
    dir
}

fn valid_skill_md(name: &str) -> String {
    format!("---\nname: {name}\ndescription: A valid skill for testing.\n---\n# {name}\n")
}

#[test]
fn install_atomic_validates_then_copies() {
    // (a) Happy path: a valid skill installs and the whole tree lands.
    {
        let src_root = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        let skills_root = target.path().join(".claude").join("skills");

        let src = make_skill(src_root.path(), "web-fetch", &valid_skill_md("web-fetch"));
        let desc = install(&LocalDir::new(&src), &skills_root).expect("valid skill should install");

        assert_eq!(desc.conformance.verdict, Verdict::Valid);
        assert!(skills_root.join("web-fetch").join("SKILL.md").exists());
        assert!(
            skills_root
                .join("web-fetch")
                .join("references")
                .join("notes.md")
                .exists(),
            "the full skill tree should be copied, not just SKILL.md"
        );
    }

    // (b) Validation fails (name != dir) -> Err and NO partial directory.
    {
        let src_root = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        let skills_root = target.path().join(".claude").join("skills");

        // Frontmatter name is `web-fetch`, but we force the intended install
        // name to `wrong-name`, so the name==dir rule fails -> Invalid.
        let src = make_skill(src_root.path(), "src", &valid_skill_md("web-fetch"));
        let err = install(&LocalDir::with_name(&src, "wrong-name"), &skills_root)
            .expect_err("name mismatch must fail validation");

        match err {
            AppError::ValidationFailed(c) => assert_eq!(c.verdict, Verdict::Invalid),
            other => panic!("expected ValidationFailed, got {other:?}"),
        }
        assert!(
            !skills_root.join("wrong-name").exists(),
            "no skill directory may be created when validation fails"
        );
        // The skills root must contain nothing — not even a staging dir.
        if skills_root.exists() {
            assert!(
                fs::read_dir(&skills_root).unwrap().next().is_none(),
                "target skills root must be empty after a failed install"
            );
        }
    }

    // (c) Copy stage fails (unwritable destination) -> Err and no partial dir.
    {
        let src_root = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        let skills_root = target.path().join(".claude").join("skills");
        fs::create_dir_all(&skills_root).unwrap();

        let src = make_skill(src_root.path(), "web-fetch", &valid_skill_md("web-fetch"));

        // Make the skills root read-only so staging cannot be created there.
        let mut perms = fs::metadata(&skills_root).unwrap().permissions();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            perms.set_mode(0o555);
        }
        fs::set_permissions(&skills_root, perms).unwrap();

        let result = install(&LocalDir::new(&src), &skills_root);

        // Restore perms so the tempdir can be cleaned up regardless of outcome.
        let mut perms = fs::metadata(&skills_root).unwrap().permissions();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            perms.set_mode(0o755);
        }
        let _ = fs::set_permissions(&skills_root, perms);

        // On Unix as a non-root user this fails; assert atomicity on failure.
        if result.is_err() {
            assert!(
                !skills_root.join("web-fetch").exists(),
                "a failed copy must not leave a partial skill directory"
            );
        }
    }
}

#[test]
fn install_rejects_already_installed() {
    let src_root = tempfile::tempdir().unwrap();
    let target = tempfile::tempdir().unwrap();
    let skills_root = target.path().join(".claude").join("skills");

    let src = make_skill(src_root.path(), "web-fetch", &valid_skill_md("web-fetch"));
    install(&LocalDir::new(&src), &skills_root).unwrap();

    let err = install(&LocalDir::new(&src), &skills_root)
        .expect_err("installing over an existing skill must fail");
    assert!(matches!(err, AppError::AlreadyInstalled(_)));
}
