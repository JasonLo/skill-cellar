//! Atomic directory install: stage into a temp dir on the *same filesystem* as
//! the destination, then commit with a single `rename`. Either the final skill
//! directory appears complete, or it does not appear at all — never partial.

use crate::error::{AppError, AppResult};
use std::io::Write;
use std::path::Path;

/// Copy `src_dir` into place at `final_dir` atomically.
///
/// Contract:
/// - `final_dir` must not already exist (install is create-only; updates are a
///   separate, later operation). Returns [`AppError::AlreadyInstalled`] if it does.
/// - All bytes are written into a staging directory created inside
///   `final_dir`'s parent, so the final `rename` is same-filesystem and atomic.
/// - On any failure during copy or rename, the staging dir is removed (it is a
///   `TempDir` that cleans up on drop), leaving no partial `final_dir`.
pub fn atomic_install_dir(src_dir: &Path, final_dir: &Path) -> AppResult<()> {
    if final_dir.exists() {
        let name = final_dir
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        return Err(AppError::AlreadyInstalled(name));
    }

    let parent = final_dir.parent().ok_or_else(|| {
        AppError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "install destination has no parent directory",
        ))
    })?;
    std::fs::create_dir_all(parent)?;

    // Staging dir lives inside the destination's parent → same filesystem →
    // the rename below is atomic. The TempDir is removed on drop, so an early
    // return anywhere after this point leaves nothing behind.
    let staging = tempfile::Builder::new()
        .prefix(".sc-staging-")
        .tempdir_in(parent)?;

    // Recursively copy the source tree into the staging dir. fs_extra copies
    // the *contents* of src into staging when content_only is set.
    let mut opts = fs_extra::dir::CopyOptions::new();
    opts.copy_inside = true;
    opts.content_only = true;
    fs_extra::dir::copy(src_dir, staging.path(), &opts)
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;

    // Commit. `into_path` defuses the TempDir's auto-delete so the rename can
    // claim the directory; if the rename fails we delete it ourselves.
    let staged_path = staging.into_path();
    match std::fs::rename(&staged_path, final_dir) {
        Ok(()) => Ok(()),
        Err(e) => {
            let _ = std::fs::remove_dir_all(&staged_path);
            Err(AppError::Io(e))
        }
    }
}

/// Write a single file into `dir` atomically, creating `dir` if needed.
///
/// Used by Craft's publish path: a temp file is written *inside* `dir` (so the
/// final rename is same-filesystem and atomic) and renamed onto `file_name`.
/// Any sibling files in `dir` are left untouched, so re-publishing a skill
/// overwrites only the named file. The reader of `dir/file_name` ever sees
/// either the old bytes or the new bytes, never a partial write.
pub fn atomic_write_file(dir: &Path, file_name: &str, contents: &str) -> AppResult<()> {
    std::fs::create_dir_all(dir)?;

    let mut tmp = tempfile::Builder::new()
        .prefix(".sc-tmp-")
        .tempfile_in(dir)?;
    tmp.write_all(contents.as_bytes())?;
    tmp.flush()?;

    // `persist` renames the temp file onto its destination atomically.
    tmp.persist(dir.join(file_name))
        .map_err(|e| AppError::Io(e.error))?;
    Ok(())
}
