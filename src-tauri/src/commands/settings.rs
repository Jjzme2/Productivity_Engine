use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::services::ai_service::ProviderPreference;
use crate::services::credential_store::{
    CredentialStore, SERVICE_ANTHROPIC, SERVICE_GEMINI, SERVICE_OPENAI,
};
use crate::state::{AppSettings, AppState};

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetApiKeyPayload {
    pub service: String,
    pub api_key: String,
}

/// Returned by `get_api_key_status` — never includes the actual key value.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyStatus {
    pub service: String,
    pub is_set: bool,
    /// Last 4 characters of the key (for visual confirmation only)
    pub suffix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProviderInfo {
    pub id: String,
    pub display_name: String,
    pub is_local: bool,
    pub requires_api_key: bool,
    pub is_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDataResult {
    pub path: String,
    pub size_bytes: u64,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Return the current application settings.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    Ok(state.settings.read().await.clone())
}

/// Merge partial settings updates into the current settings.
/// Any field set to `null` in the JSON is left unchanged.
#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    updates: serde_json::Value,
) -> Result<AppSettings, AppError> {
    let mut settings = state.settings.write().await;

    // Deserialize over the existing settings using merge semantics:
    // convert current to Value, merge, then deserialize back.
    let mut current_json = serde_json::to_value(&*settings)
        .map_err(|e| AppError::Internal(format!("Settings serialisation failed: {e}")))?;

    if let (Some(current_obj), Some(updates_obj)) =
        (current_json.as_object_mut(), updates.as_object())
    {
        for (k, v) in updates_obj {
            if !v.is_null() {
                current_obj.insert(k.clone(), v.clone());
            }
        }
    }

    *settings = serde_json::from_value(current_json)
        .map_err(|e| AppError::Internal(format!("Settings deserialisation failed: {e}")))?;

    let _ = state
        .event_tx
        .send(crate::events::AppEvent::SettingsUpdated);

    Ok(settings.clone())
}

/// Store an API key securely in the OS keyring.
#[tauri::command]
pub async fn set_api_key(
    state: State<'_, AppState>,
    payload: SetApiKeyPayload,
) -> Result<(), AppError> {
    state.credentials.set_api_key(&payload.service, &payload.api_key)?;

    let _ = state.event_tx.send(crate::events::AppEvent::ApiKeyUpdated {
        service: payload.service.clone(),
    });

    tracing::info!(service = payload.service, "API key updated");
    Ok(())
}

/// Check whether an API key is set for each known service.
/// Never returns the actual key — only a boolean + last-4 suffix.
#[tauri::command]
pub async fn get_api_key_status(
    state: State<'_, AppState>,
) -> Result<Vec<ApiKeyStatus>, AppError> {
    let services = [SERVICE_ANTHROPIC, SERVICE_OPENAI, SERVICE_GEMINI];
    let mut statuses = Vec::new();

    for service in services {
        let stored = state.credentials.get_api_key(service)?;
        let (is_set, suffix) = match stored {
            Some(key) if !key.is_empty() => {
                let s = if key.len() >= 4 {
                    Some(format!("…{}", &key[key.len() - 4..]))
                } else {
                    Some("…".into())
                };
                (true, s)
            }
            _ => (false, None),
        };

        statuses.push(ApiKeyStatus {
            service: service.to_string(),
            is_set,
            suffix,
        });
    }

    Ok(statuses)
}

/// List all available AI provider options with metadata.
#[tauri::command]
pub async fn get_ai_providers(
    state: State<'_, AppState>,
) -> Result<Vec<AiProviderInfo>, AppError> {
    let ollama_available = state.ai_service.get_provider_status().await.local_available;

    Ok(vec![
        AiProviderInfo {
            id: "ollama".into(),
            display_name: "Ollama (Local)".into(),
            is_local: true,
            requires_api_key: false,
            is_available: ollama_available,
        },
        AiProviderInfo {
            id: "claude".into(),
            display_name: "Claude (Anthropic)".into(),
            is_local: false,
            requires_api_key: true,
            is_available: state
                .credentials
                .has_api_key(SERVICE_ANTHROPIC),
        },
        AiProviderInfo {
            id: "openai".into(),
            display_name: "GPT-4o (OpenAI)".into(),
            is_local: false,
            requires_api_key: true,
            is_available: state.credentials.has_api_key(SERVICE_OPENAI),
        },
        AiProviderInfo {
            id: "gemini".into(),
            display_name: "Gemini (Google)".into(),
            is_local: false,
            requires_api_key: true,
            is_available: state.credentials.has_api_key(SERVICE_GEMINI),
        },
    ])
}

/// Change the active AI provider.
#[tauri::command]
pub async fn set_active_ai_provider(
    state: State<'_, AppState>,
    provider_id: String,
    preference: Option<ProviderPreference>,
) -> Result<(), AppError> {
    let mut settings = state.settings.write().await;
    settings.ai_provider = provider_id.clone();
    if let Some(pref) = preference {
        settings.provider_preference = pref;
    }

    let _ = state
        .event_tx
        .send(crate::events::AppEvent::SettingsUpdated);

    tracing::info!(provider = provider_id, "Active AI provider changed");
    Ok(())
}

/// Export all app data to a JSON file in the specified directory.
#[tauri::command]
pub async fn export_data(
    _state: State<'_, AppState>,
    destination_path: String,
) -> Result<ExportDataResult, AppError> {
    // TODO: serialise all tasks, habits, notes, events, frameworks, and activity log
    // to a single JSON envelope and write to `destination_path`.
    let placeholder = serde_json::json!({
        "version": "1",
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "tasks": [],
        "habits": [],
        "notes": [],
        "events": [],
        "activity_log": []
    });

    let json = serde_json::to_string_pretty(&placeholder)
        .map_err(|e| AppError::Internal(format!("Export serialisation failed: {e}")))?;

    std::fs::write(&destination_path, &json)
        .map_err(|e| AppError::Internal(format!("Export write failed: {e}")))?;

    let size_bytes = json.len() as u64;
    tracing::info!(path = destination_path, size_bytes, "Data exported");

    Ok(ExportDataResult {
        path: destination_path,
        size_bytes,
    })
}

/// Import data from a previously exported JSON file.
#[tauri::command]
pub async fn import_data(
    _state: State<'_, AppState>,
    source_path: String,
) -> Result<(), AppError> {
    let raw = std::fs::read_to_string(&source_path)
        .map_err(|e| AppError::Internal(format!("Import read failed: {e}")))?;

    let _data: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| AppError::Internal(format!("Import parse failed: {e}")))?;

    // TODO: validate schema version, then upsert tasks, habits, notes, events
    // into the persistence layer (deduplicating by ID).

    tracing::info!(path = source_path, "Data imported");
    Ok(())
}


/// Show the main application window.
///
/// The window starts with `visible: false` in tauri.conf.json so the webview
/// can render fully before appearing — eliminating the black-screen flash on
/// startup.  The frontend calls this command once Vue has mounted.
#[tauri::command]
pub fn show_main_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        win.show().ok();
        win.set_focus().ok();
    }
}
