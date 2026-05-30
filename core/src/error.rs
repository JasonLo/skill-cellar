//! Error type shared across the core. Implements `Serialize` so the Tauri
//! shell can return `AppResult<T>` straight across the IPC boundary; the
//! serialized shape is `{ "kind": "...", "message": "...", "conformance"?: {...} }`
//! which the frontend can switch on.

use crate::conformance::Conformance;
use std::path::PathBuf;
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("SKILL.md not found at {0}")]
    SkillMdMissing(PathBuf),

    #[error("skill failed validation")]
    ValidationFailed(Conformance),

    #[error("a skill named '{0}' is already installed at the target")]
    AlreadyInstalled(String),

    #[error("network unreachable: {0}")]
    Network(String),

    #[error("registry unavailable (network, cache, and bundled snapshot all failed)")]
    RegistryUnavailable,

    #[error("no active install target selected")]
    NoActiveTarget,
}

impl AppError {
    /// Stable machine-readable discriminant, mirrored on the TS side.
    pub fn kind(&self) -> &'static str {
        match self {
            AppError::Io(_) => "io",
            AppError::SkillMdMissing(_) => "skill_md_missing",
            AppError::ValidationFailed(_) => "validation_failed",
            AppError::AlreadyInstalled(_) => "already_installed",
            AppError::Network(_) => "network",
            AppError::RegistryUnavailable => "registry_unavailable",
            AppError::NoActiveTarget => "no_active_target",
        }
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        // `conformance` is only present on ValidationFailed, so the field count
        // varies; struct serializers want a fixed count, so use 3 and skip when
        // absent via serialize_field with an Option.
        let mut st = serializer.serialize_struct("AppError", 3)?;
        st.serialize_field("kind", self.kind())?;
        st.serialize_field("message", &self.to_string())?;
        match self {
            AppError::ValidationFailed(c) => st.serialize_field("conformance", &Some(c))?,
            _ => st.serialize_field("conformance", &None::<&Conformance>)?,
        }
        st.end()
    }
}
