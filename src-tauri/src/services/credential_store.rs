use keyring::Entry;
use tracing::{debug, error, warn};

use crate::error::AppError;

/// Well-known service identifiers used throughout the app.
pub const SERVICE_ANTHROPIC: &str = "anthropic";
pub const SERVICE_OPENAI: &str = "openai";
pub const SERVICE_GEMINI: &str = "google_gemini";
pub const SERVICE_GOOGLE_OAUTH_ACCESS: &str = "google_oauth_access";
pub const SERVICE_GOOGLE_OAUTH_REFRESH: &str = "google_oauth_refresh";

/// Thin wrapper around the OS keyring via the `keyring` crate.
/// All methods use `"productivity_engine"` as the keyring application name.
#[derive(Debug, Default)]
pub struct CredentialStore;

impl CredentialStore {
    const APP: &'static str = "productivity_engine";

    pub fn new() -> Self {
        CredentialStore
    }

    /// Store (or overwrite) a credential.
    ///
    /// # Arguments
    /// * `service` – logical service name (use the `SERVICE_*` constants)
    /// * `key`     – credential identifier / username
    /// * `value`   – secret value to store
    pub fn store(
        &self,
        service: &str,
        key: &str,
        value: &str,
    ) -> Result<(), AppError> {
        let entry_name = format!("{}:{}", Self::APP, service);
        debug!(service = service, key = key, "Storing credential");

        let entry = Entry::new(&entry_name, key)
            .map_err(|e| AppError::Auth(format!("Keyring entry creation failed: {e}")))?;

        entry
            .set_password(value)
            .map_err(|e| AppError::Auth(format!("Keyring store failed for {service}/{key}: {e}")))
    }

    /// Retrieve a stored credential.
    ///
    /// Returns `None` if the entry does not exist.
    pub fn retrieve(&self, service: &str, key: &str) -> Result<Option<String>, AppError> {
        let entry_name = format!("{}:{}", Self::APP, service);
        debug!(service = service, key = key, "Retrieving credential");

        let entry = Entry::new(&entry_name, key)
            .map_err(|e| AppError::Auth(format!("Keyring entry creation failed: {e}")))?;

        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => {
                warn!(service = service, key = key, "Credential not found");
                Ok(None)
            }
            Err(e) => Err(AppError::Auth(format!(
                "Keyring retrieve failed for {service}/{key}: {e}"
            ))),
        }
    }

    /// Delete a stored credential.
    ///
    /// Returns `Ok(())` even if the entry did not exist.
    pub fn delete(&self, service: &str, key: &str) -> Result<(), AppError> {
        let entry_name = format!("{}:{}", Self::APP, service);
        debug!(service = service, key = key, "Deleting credential");

        let entry = Entry::new(&entry_name, key)
            .map_err(|e| AppError::Auth(format!("Keyring entry creation failed: {e}")))?;

        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => {
                warn!(service = service, key = key, "Credential not found during delete; ignoring");
                Ok(())
            }
            Err(e) => Err(AppError::Auth(format!(
                "Keyring delete failed for {service}/{key}: {e}"
            ))),
        }
    }

    // -----------------------------------------------------------------------
    // Convenience helpers
    // -----------------------------------------------------------------------

    /// Returns true if a non-empty API key exists for the given service.
    pub fn has_api_key(&self, service: &str) -> bool {
        self.retrieve(service, "api_key")
            .ok()
            .flatten()
            .map(|k| !k.is_empty())
            .unwrap_or(false)
    }

    /// Store an API key under the canonical `"api_key"` username.
    pub fn set_api_key(&self, service: &str, key: &str) -> Result<(), AppError> {
        self.store(service, "api_key", key)
    }

    /// Retrieve an API key (returns `None` if not set).
    pub fn get_api_key(&self, service: &str) -> Result<Option<String>, AppError> {
        self.retrieve(service, "api_key")
    }

    /// Delete an API key.
    pub fn delete_api_key(&self, service: &str) -> Result<(), AppError> {
        self.delete(service, "api_key")
    }

    // -----------------------------------------------------------------------
    // OAuth token helpers
    // -----------------------------------------------------------------------

    /// Store Google OAuth access token.
    pub fn set_google_access_token(&self, token: &str) -> Result<(), AppError> {
        self.store(SERVICE_GOOGLE_OAUTH_ACCESS, "access_token", token)
    }

    /// Retrieve Google OAuth access token.
    pub fn get_google_access_token(&self) -> Result<Option<String>, AppError> {
        self.retrieve(SERVICE_GOOGLE_OAUTH_ACCESS, "access_token")
    }

    /// Store Google OAuth refresh token.
    pub fn set_google_refresh_token(&self, token: &str) -> Result<(), AppError> {
        self.store(SERVICE_GOOGLE_OAUTH_REFRESH, "refresh_token", token)
    }

    /// Retrieve Google OAuth refresh token.
    pub fn get_google_refresh_token(&self) -> Result<Option<String>, AppError> {
        self.retrieve(SERVICE_GOOGLE_OAUTH_REFRESH, "refresh_token")
    }

    /// Clear all Google OAuth tokens (used on sign-out).
    pub fn revoke_google_tokens(&self) -> Result<(), AppError> {
        self.delete(SERVICE_GOOGLE_OAUTH_ACCESS, "access_token")?;
        self.delete(SERVICE_GOOGLE_OAUTH_REFRESH, "refresh_token")?;
        Ok(())
    }
}
