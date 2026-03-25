use serde::Serialize;
use thiserror::Error;

/// Central error type for the Productivity Engine backend.
/// All variants are serializable so Tauri can forward them to the frontend as JSON.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    /// AI provider or inference error
    #[error("AI error: {0}")]
    Ai(String),

    /// Authentication / credential error
    #[error("Auth error: {0}")]
    Auth(String),

    /// Voice capture / transcription error
    #[error("Voice error: {0}")]
    Voice(String),

    /// Framework engine error
    #[error("Framework error: {0}")]
    Framework(String),

    /// Requested resource not found
    #[error("Not found: {0}")]
    NotFound(String),

    /// Caller lacks permission
    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    /// Upstream API rate limit exceeded
    #[error("Rate limit: {0}")]
    RateLimit(String),

    /// Catch-all internal error
    #[error("Internal error: {0}")]
    Internal(String),
}

impl AppError {
    /// Convenience constructor: wrap any `Display`-able error as `Internal`.
    pub fn internal(e: impl std::fmt::Display) -> Self {
        AppError::Internal(e.to_string())
    }
}

/// Allow `?` from `reqwest::Error`
impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Internal(format!("HTTP error: {e}"))
    }
}

/// Allow `?` from `serde_json::Error`
impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Internal(format!("JSON error: {e}"))
    }
}
