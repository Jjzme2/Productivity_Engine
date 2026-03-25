use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

use crate::error::AppError;
use crate::services::credential_store::CredentialStore;

// ---------------------------------------------------------------------------
// OAuth constants
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE: &str = "https://www.googleapis.com/calendar/v3";

const SCOPES: &[&str] = &[
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
];

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessToken {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Google Calendar API response types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleEvent {
    pub id: Option<String>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start: EventDateTime,
    pub end: EventDateTime,
    pub status: Option<String>,
    #[serde(rename = "recurrence")]
    pub recurrence: Option<Vec<String>>,
    #[serde(rename = "recurringEventId")]
    pub recurring_event_id: Option<String>,
    pub attendees: Option<Vec<GoogleAttendee>>,
    #[serde(rename = "conferenceData")]
    pub conference_data: Option<serde_json::Value>,
    #[serde(rename = "colorId")]
    pub color_id: Option<String>,
    pub etag: Option<String>,
    pub updated: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventDateTime {
    #[serde(rename = "dateTime")]
    pub date_time: Option<String>,
    pub date: Option<String>,
    #[serde(rename = "timeZone")]
    pub time_zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAttendee {
    pub email: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "responseStatus")]
    pub response_status: Option<String>,
    pub organizer: Option<bool>,
    #[serde(rename = "self")]
    pub self_: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventsPage {
    pub items: Vec<GoogleEvent>,
    #[serde(rename = "nextPageToken")]
    pub next_page_token: Option<String>,
    #[serde(rename = "nextSyncToken")]
    pub next_sync_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleCalendar {
    pub id: String,
    pub summary: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "primary")]
    pub is_primary: Option<bool>,
    #[serde(rename = "accessRole")]
    pub access_role: Option<String>,
    #[serde(rename = "backgroundColor")]
    pub background_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarListResponse {
    pub items: Vec<GoogleCalendar>,
}

// ---------------------------------------------------------------------------
// Auth URL parameters
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

// ---------------------------------------------------------------------------
// Calendar service
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct CalendarService {
    config: OAuthConfig,
    http: Client,
    credentials: std::sync::Arc<CredentialStore>,
}

impl CalendarService {
    pub fn new(config: OAuthConfig, credentials: std::sync::Arc<CredentialStore>) -> Self {
        CalendarService {
            config,
            http: Client::new(),
            credentials,
        }
    }

    // -----------------------------------------------------------------------
    // OAuth2 flow
    // -----------------------------------------------------------------------

    /// Build the Google OAuth2 authorisation URL.
    /// Returns the URL the user must open in their browser.
    pub fn get_auth_url(&self, state: &str) -> String {
        let scope = SCOPES.join(" ");
        format!(
            "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&state={}",
            GOOGLE_AUTH_URL,
            urlencoding::encode(&self.config.client_id),
            urlencoding::encode(&self.config.redirect_uri),
            urlencoding::encode(&scope),
            urlencoding::encode(state)
        )
    }

    /// Exchange an authorisation code for access + refresh tokens.
    pub async fn exchange_code(&self, code: &str) -> Result<TokenPair, AppError> {
        info!("Exchanging OAuth2 authorisation code for tokens");

        let params = [
            ("code", code),
            ("client_id", self.config.client_id.as_str()),
            ("client_secret", self.config.client_secret.as_str()),
            ("redirect_uri", self.config.redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ];

        let resp = self
            .http
            .post(GOOGLE_TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Token exchange request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!("Token exchange failed ({status}): {text}")));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Auth(format!("Token exchange parse error: {e}")))?;

        let access_token = json["access_token"]
            .as_str()
            .ok_or_else(|| AppError::Auth("Missing access_token in response".into()))?
            .to_string();

        let refresh_token = json["refresh_token"]
            .as_str()
            .ok_or_else(|| AppError::Auth("Missing refresh_token in response".into()))?
            .to_string();

        let expires_in = json["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = Utc::now() + chrono::Duration::seconds(expires_in as i64);

        // Persist tokens
        self.credentials.set_google_access_token(&access_token)?;
        self.credentials.set_google_refresh_token(&refresh_token)?;

        Ok(TokenPair {
            access_token,
            refresh_token,
            expires_at,
        })
    }

    /// Use the stored refresh token to obtain a fresh access token.
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<AccessToken, AppError> {
        debug!("Refreshing Google OAuth2 access token");

        let params = [
            ("refresh_token", refresh_token),
            ("client_id", self.config.client_id.as_str()),
            ("client_secret", self.config.client_secret.as_str()),
            ("grant_type", "refresh_token"),
        ];

        let resp = self
            .http
            .post(GOOGLE_TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Token refresh request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!("Token refresh failed ({status}): {text}")));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Auth(format!("Token refresh parse error: {e}")))?;

        let token = json["access_token"]
            .as_str()
            .ok_or_else(|| AppError::Auth("Missing access_token in refresh response".into()))?
            .to_string();

        let expires_in = json["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = Utc::now() + chrono::Duration::seconds(expires_in as i64);

        // Update stored access token
        self.credentials.set_google_access_token(&token)?;

        Ok(AccessToken { token, expires_at })
    }

    // -----------------------------------------------------------------------
    // Retrieve a valid access token (refreshing if needed)
    // -----------------------------------------------------------------------

    async fn get_valid_access_token(&self) -> Result<String, AppError> {
        let access_token = self
            .credentials
            .get_google_access_token()?
            .ok_or_else(|| AppError::Auth("Google Calendar not connected".into()))?;

        // TODO: persist expiry time and check it here to avoid unnecessary refreshes.
        // For now, attempt use; if we get a 401, refresh and retry in callers.
        Ok(access_token)
    }

    // -----------------------------------------------------------------------
    // Calendar list
    // -----------------------------------------------------------------------

    pub async fn list_calendars(&self) -> Result<Vec<GoogleCalendar>, AppError> {
        let token = self.get_valid_access_token().await?;
        let url = format!("{}/users/me/calendarList", GOOGLE_CALENDAR_BASE);

        let resp = self
            .http
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("List calendars request failed: {e}")))?;

        Self::handle_auth_errors(&resp)?;

        let body: CalendarListResponse = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("List calendars parse error: {e}")))?;

        Ok(body.items)
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /// List events in the given time range.
    /// Pass `sync_token` to perform an incremental sync.
    pub async fn list_events(
        &self,
        calendar_id: &str,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        sync_token: Option<&str>,
        page_token: Option<&str>,
    ) -> Result<EventsPage, AppError> {
        let token = self.get_valid_access_token().await?;
        let url = format!(
            "{}/calendars/{}/events",
            GOOGLE_CALENDAR_BASE,
            urlencoding::encode(calendar_id)
        );

        let mut req = self
            .http
            .get(&url)
            .bearer_auth(&token)
            .query(&[("maxResults", "250"), ("singleEvents", "true")]);

        if let Some(st) = sync_token {
            req = req.query(&[("syncToken", st)]);
        } else {
            if let Some(f) = from {
                req = req.query(&[("timeMin", f.to_rfc3339().as_str())]);
            }
            if let Some(t) = to {
                req = req.query(&[("timeMax", t.to_rfc3339().as_str())]);
            }
        }

        if let Some(pt) = page_token {
            req = req.query(&[("pageToken", pt)]);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("List events request failed: {e}")))?;

        Self::handle_auth_errors(&resp)?;

        let page: EventsPage = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("List events parse error: {e}")))?;

        Ok(page)
    }

    /// Create a new event on Google Calendar.
    pub async fn create_event(
        &self,
        calendar_id: &str,
        event: &GoogleEvent,
    ) -> Result<GoogleEvent, AppError> {
        let token = self.get_valid_access_token().await?;
        let url = format!(
            "{}/calendars/{}/events",
            GOOGLE_CALENDAR_BASE,
            urlencoding::encode(calendar_id)
        );

        let resp = self
            .http
            .post(&url)
            .bearer_auth(&token)
            .json(event)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Create event request failed: {e}")))?;

        Self::handle_auth_errors(&resp)?;

        let created: GoogleEvent = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Create event parse error: {e}")))?;

        info!(event_id = ?created.id, "Google Calendar event created");
        Ok(created)
    }

    /// Update an existing event.
    pub async fn update_event(
        &self,
        calendar_id: &str,
        event_id: &str,
        event: &GoogleEvent,
    ) -> Result<GoogleEvent, AppError> {
        let token = self.get_valid_access_token().await?;
        let url = format!(
            "{}/calendars/{}/events/{}",
            GOOGLE_CALENDAR_BASE,
            urlencoding::encode(calendar_id),
            urlencoding::encode(event_id)
        );

        let resp = self
            .http
            .put(&url)
            .bearer_auth(&token)
            .json(event)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Update event request failed: {e}")))?;

        Self::handle_auth_errors(&resp)?;

        let updated: GoogleEvent = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Update event parse error: {e}")))?;

        Ok(updated)
    }

    /// Delete an event from Google Calendar.
    pub async fn delete_event(
        &self,
        calendar_id: &str,
        event_id: &str,
    ) -> Result<(), AppError> {
        let token = self.get_valid_access_token().await?;
        let url = format!(
            "{}/calendars/{}/events/{}",
            GOOGLE_CALENDAR_BASE,
            urlencoding::encode(calendar_id),
            urlencoding::encode(event_id)
        );

        let resp = self
            .http
            .delete(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Delete event request failed: {e}")))?;

        Self::handle_auth_errors(&resp)?;

        info!(event_id, "Google Calendar event deleted");
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Sync status DTO
    // -----------------------------------------------------------------------

    pub fn is_connected(&self) -> bool {
        self.credentials.has_api_key("google_oauth_access")
            || self
                .credentials
                .get_google_access_token()
                .ok()
                .flatten()
                .is_some()
    }

    // -----------------------------------------------------------------------
    // Error handling helper
    // -----------------------------------------------------------------------

    fn handle_auth_errors(resp: &reqwest::Response) -> Result<(), AppError> {
        match resp.status().as_u16() {
            200..=299 => Ok(()),
            401 => Err(AppError::Auth(
                "Google Calendar auth token invalid or expired".into(),
            )),
            403 => Err(AppError::Unauthorized(
                "Insufficient Google Calendar permissions".into(),
            )),
            429 => Err(AppError::RateLimit("Google Calendar rate limit exceeded".into())),
            status => Err(AppError::Internal(format!(
                "Google Calendar API error: HTTP {status}"
            ))),
        }
    }
}

// ---------------------------------------------------------------------------
// URL encoding helper (avoids external urlencoding crate dependency by using
// percent_encoding via reqwest's own transitive dependency if available;
// we include a minimal fallback here)
// ---------------------------------------------------------------------------

mod urlencoding {
    pub fn encode(s: &str) -> String {
        // Simple percent-encoding for common OAuth parameters
        let mut out = String::with_capacity(s.len() * 2);
        for byte in s.bytes() {
            match byte {
                b'A'..=b'Z'
                | b'a'..=b'z'
                | b'0'..=b'9'
                | b'-'
                | b'_'
                | b'.'
                | b'~' => out.push(byte as char),
                b => {
                    use std::fmt::Write;
                    let _ = write!(out, "%{b:02X}");
                }
            }
        }
        out
    }
}
