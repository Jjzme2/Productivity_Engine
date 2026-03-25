use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::services::calendar_service::{CalendarService, GoogleCalendar, GoogleEvent, OAuthConfig};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthInitResult {
    pub auth_url: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCompletePayload {
    pub code: String,
    pub state: String,
}

/// Returned by `get_sync_status` — matches the frontend's expected shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleSyncStatus {
    /// "idle" when connected and synced, "unauthorized" otherwise.
    pub state: String,
    pub is_authorized: bool,
}

/// A Google Calendar event tagged with its source calendar.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedEvent {
    pub calendar_id: String,
    pub event: GoogleEvent,
}

/// Returned by `sync_google_calendar` — matches the frontend's CalendarSyncResult.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarSyncResult {
    pub synced: u32,
    pub conflicts: u32,
    pub errors: Vec<String>,
    pub sync_state: String, // "idle" | "error"
    pub events: Vec<SyncedEvent>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn build_calendar_service(state: &AppState) -> CalendarService {
    let settings = state.settings.blocking_read();
    let config = OAuthConfig {
        client_id: settings.google_client_id.clone(),
        client_secret: settings.google_client_secret.clone(),
        redirect_uri: settings.google_redirect_uri.clone(),
    };
    drop(settings);
    CalendarService::new(config, state.credentials.clone())
}

fn url_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut bytes = s.bytes();
    while let Some(b) = bytes.next() {
        match b {
            b'+' => result.push(' '),
            b'%' => {
                let h1 = bytes.next().map(|c| c as char).unwrap_or('0');
                let h2 = bytes.next().map(|c| c as char).unwrap_or('0');
                if let Ok(n) = u8::from_str_radix(&format!("{h1}{h2}"), 16) {
                    result.push(n as char);
                }
            }
            _ => result.push(b as char),
        }
    }
    result
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Start the Google OAuth2 flow.
/// Returns the URL the user should open in a browser and a CSRF state token.
#[tauri::command]
pub async fn init_google_oauth(
    state: State<'_, AppState>,
) -> Result<OAuthInitResult, AppError> {
    let oauth_state = uuid::Uuid::new_v4().to_string();
    let cal = build_calendar_service(&state);
    let auth_url = cal.get_auth_url(&oauth_state);
    Ok(OAuthInitResult { auth_url, state: oauth_state })
}

/// Start a one-shot local HTTP listener on port 8765 and wait for the OAuth2
/// redirect callback.  Returns the authorisation `code` and CSRF `state` when
/// the browser is redirected back from Google.  Fails after 5 minutes.
#[tauri::command]
pub async fn start_oauth_listener() -> Result<OAuthCompletePayload, AppError> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:8765")
        .await
        .map_err(|e| AppError::Internal(
            format!("Failed to bind OAuth listener on port 8765: {e}")
        ))?;

    let (stream, _) = tokio::time::timeout(
        std::time::Duration::from_secs(300),
        listener.accept(),
    )
    .await
    .map_err(|_| AppError::Auth(
        "OAuth timed out — no callback received within 5 minutes".into()
    ))?
    .map_err(|e| AppError::Internal(format!("OAuth listener accept error: {e}")))?;

    let (reader, mut writer) = stream.into_split();
    let mut lines = BufReader::new(reader).lines();

    // Read first line: "GET /oauth/callback?code=...&state=... HTTP/1.1"
    let request_line = lines.next_line().await.ok().flatten().unwrap_or_default();
    let path = request_line.split_whitespace().nth(1).unwrap_or("");
    let query_str = path.split('?').nth(1).unwrap_or("");

    let mut code = String::new();
    let mut state = String::new();
    let mut error_param = String::new();

    for kv in query_str.split('&') {
        let mut parts = kv.splitn(2, '=');
        match (parts.next(), parts.next()) {
            (Some("code"), Some(v)) => code = url_decode(v),
            (Some("state"), Some(v)) => state = url_decode(v),
            (Some("error"), Some(v)) => error_param = url_decode(v),
            _ => {}
        }
    }

    let (status_line, body) = if !error_param.is_empty() {
        let escaped = html_escape(&error_param);
        (
            "400 Bad Request",
            format!(
                "<html><body style=\"font-family:sans-serif;padding:2rem\">\
                 <h2>Authorization Failed</h2>\
                 <p>Google returned: <code>{escaped}</code></p>\
                 <p>You can close this tab and try again.</p>\
                 </body></html>"
            ),
        )
    } else if code.is_empty() {
        (
            "400 Bad Request",
            "<html><body style=\"font-family:sans-serif;padding:2rem\">\
             <h2>Authorization Failed</h2>\
             <p>No authorization code was received.</p>\
             <p>You can close this tab and try again.</p>\
             </body></html>"
            .to_string(),
        )
    } else {
        (
            "200 OK",
            "<html><body style=\"font-family:sans-serif;padding:2rem\">\
             <h2 style=\"color:#6366f1\">Google Calendar Connected!</h2>\
             <p>Authorization was successful. You can close this tab and return to Productivity Engine.</p>\
             </body></html>"
            .to_string(),
        )
    };

    let response = format!(
        "HTTP/1.1 {status_line}\r\n\
         Content-Type: text/html; charset=utf-8\r\n\
         Connection: close\r\n\
         Content-Length: {len}\r\n\r\n{body}",
        len = body.len()
    );
    let _ = writer.write_all(response.as_bytes()).await;

    if !error_param.is_empty() {
        return Err(AppError::Auth(format!("Google OAuth denied: {error_param}")));
    }
    if code.is_empty() {
        return Err(AppError::Auth(
            "OAuth callback did not include an authorization code".into(),
        ));
    }

    Ok(OAuthCompletePayload { code, state })
}

/// Complete the Google OAuth2 flow by exchanging the authorisation code for tokens.
#[tauri::command]
pub async fn complete_google_oauth(
    state: State<'_, AppState>,
    payload: OAuthCompletePayload,
) -> Result<(), AppError> {
    let cal = build_calendar_service(&state);
    cal.exchange_code(&payload.code).await?;

    let _ = state.event_tx.send(crate::events::AppEvent::GoogleAuthCompleted);
    tracing::info!("Google OAuth2 completed successfully");
    Ok(())
}

/// List all Google Calendars accessible to the authenticated user.
#[tauri::command]
pub async fn get_google_calendars(
    state: State<'_, AppState>,
) -> Result<Vec<GoogleCalendar>, AppError> {
    let cal = build_calendar_service(&state);
    cal.list_calendars().await
}

/// Trigger an immediate sync of all selected Google Calendars.
/// Returns the fetched events so the frontend can persist them to Firestore.
/// If no calendars are selected in settings, falls back to the primary calendar.
#[tauri::command]
pub async fn sync_google_calendar(
    state: State<'_, AppState>,
) -> Result<CalendarSyncResult, AppError> {
    let cal = build_calendar_service(&state);

    if !cal.is_connected() {
        return Err(AppError::Auth("Google Calendar is not connected".into()));
    }

    let _ = state.event_tx.send(crate::events::AppEvent::CalendarSyncStarted);

    let settings = state.settings.read().await;
    let mut calendar_ids = settings.selected_calendar_ids.clone();
    drop(settings);

    // Auto-select primary calendar when none are explicitly chosen.
    if calendar_ids.is_empty() {
        match cal.list_calendars().await {
            Ok(cals) => {
                if let Some(primary) = cals.into_iter().find(|c| c.is_primary == Some(true)) {
                    calendar_ids.push(primary.id);
                }
            }
            Err(e) => {
                tracing::warn!("Could not list calendars to find primary: {e}");
            }
        }
    }

    let now = chrono::Utc::now();
    let from = now - chrono::Duration::days(30);
    let to = now + chrono::Duration::days(90);

    let mut all_events: Vec<SyncedEvent> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    for calendar_id in &calendar_ids {
        match cal
            .list_events(calendar_id, Some(from), Some(to), None, None)
            .await
        {
            Ok(page) => {
                for event in page.items {
                    all_events.push(SyncedEvent {
                        calendar_id: calendar_id.clone(),
                        event,
                    });
                }
            }
            Err(e) => {
                let msg = e.to_string();
                tracing::error!(calendar_id, "Calendar sync error: {msg}");
                errors.push(format!("{calendar_id}: {msg}"));
                let _ = state.event_tx.send(crate::events::AppEvent::CalendarSyncFailed {
                    reason: msg,
                });
            }
        }
    }

    let synced = all_events.len() as u32;
    let sync_state = if errors.is_empty() { "idle" } else { "error" };

    let _ = state.event_tx.send(crate::events::AppEvent::CalendarSyncCompleted {
        events_updated: synced,
    });

    Ok(CalendarSyncResult {
        synced,
        conflicts: 0,
        errors,
        sync_state: sync_state.to_string(),
        events: all_events,
    })
}

/// Return the current Google Calendar connection status without triggering a sync.
#[tauri::command]
pub async fn get_sync_status(
    state: State<'_, AppState>,
) -> Result<GoogleSyncStatus, AppError> {
    let cal = build_calendar_service(&state);
    let is_authorized = cal.is_connected();
    Ok(GoogleSyncStatus {
        state: if is_authorized { "idle".into() } else { "unauthorized".into() },
        is_authorized,
    })
}

/// Revoke all stored Google OAuth tokens and disconnect Calendar.
#[tauri::command]
pub async fn revoke_google_auth(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.credentials.revoke_google_tokens()?;
    let _ = state.event_tx.send(crate::events::AppEvent::GoogleAuthRevoked);
    tracing::info!("Google OAuth tokens revoked");
    Ok(())
}
