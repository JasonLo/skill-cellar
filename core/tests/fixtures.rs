//! Keep the golden fixtures honest: each fixture skill must evaluate to the
//! verdict its directory name advertises.

use skill_cellar_core::conformance::evaluate;
use skill_cellar_core::Verdict;
use std::path::Path;

fn verdict_of(dir_name: &str) -> skill_cellar_core::Conformance {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures")
        .join("skills")
        .join(dir_name)
        .join("SKILL.md");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|_| panic!("missing fixture: {}", path.display()));
    evaluate(&text, dir_name)
}

#[test]
fn fixtures_match_their_advertised_verdicts() {
    assert_eq!(verdict_of("web-fetch").verdict, Verdict::Valid);
    assert!(verdict_of("warn-compat").verdict == Verdict::Warnings);

    for invalid in ["web-fetch-mismatch", "no-desc", "long-desc", "bad-yaml"] {
        assert_eq!(
            verdict_of(invalid).verdict,
            Verdict::Invalid,
            "fixture '{invalid}' should be Invalid"
        );
    }
}
