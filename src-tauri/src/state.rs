use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

use crate::events::types::AppEvent;
use crate::services::ai_service::AiService;
use crate::services::credential_store::CredentialStore;

// ---------------------------------------------------------------------------
// Application settings
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppSettings {
    // AI
    pub ai_provider: String,
    pub ai_model: String,
    pub provider_preference: crate::services::ai_service::ProviderPreference,
    pub ollama_base_url: String,

    // Calendar
    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_uri: String,
    pub calendar_sync_interval_mins: u32,
    pub selected_calendar_ids: Vec<String>,

    // Voice
    pub voice_provider: String,
    pub voice_model_path: Option<String>,

    // UI / UX
    pub theme: String,
    /// User-preferred timezone offset in hours from UTC (e.g. -5 for EST)
    pub timezone_offset_hours: i32,
    pub daily_brief_enabled: bool,
    pub show_tray_icon: bool,
    pub start_minimized: bool,
    pub notifications_enabled: bool,

    // Data
    pub data_directory: Option<String>,
    pub analytics_window_days: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            ai_provider: "claude".into(),
            ai_model: "claude-3-5-sonnet-20241022".into(),
            provider_preference: crate::services::ai_service::ProviderPreference::LocalFirst,
            ollama_base_url: "http://localhost:11434".into(),

            google_client_id: String::new(),
            google_client_secret: String::new(),
            google_redirect_uri: "http://localhost:8765/oauth/callback".into(),
            calendar_sync_interval_mins: 5,
            selected_calendar_ids: Vec::new(),

            voice_provider: "whisper_api".into(),
            voice_model_path: None,

            theme: "system".into(),
            timezone_offset_hours: 0,
            daily_brief_enabled: true,
            show_tray_icon: true,
            start_minimized: false,
            notifications_enabled: true,

            data_directory: None,
            analytics_window_days: 7,
        }
    }
}

// ---------------------------------------------------------------------------
// AppState
//
// Managed state injected into every Tauri command via `.manage(state)`.
// All mutable sub-systems are wrapped in Arc + async-aware locks.
// ---------------------------------------------------------------------------

pub struct AppState {
    /// AI inference service (Ollama / Claude / OpenAI / Gemini)
    pub ai_service: Arc<AiService>,

    /// User-configurable settings (read/write across threads)
    pub settings: Arc<RwLock<AppSettings>>,

    /// Broadcast channel for domain events (tasks, habits, framework, etc.)
    pub event_tx: broadcast::Sender<AppEvent>,

    /// OS keyring credential store
    pub credentials: Arc<CredentialStore>,

    /// Path to the Firebase service account JSON file (from FIREBASE_SERVICE_ACCOUNT env var).
    /// Used by Firebase Admin REST API calls that require server-side auth.
    pub firebase_service_account_path: Option<String>,
}

impl AppState {
    pub fn new(
        ai_service: Arc<AiService>,
        settings: AppSettings,
        event_tx: broadcast::Sender<AppEvent>,
        credentials: Arc<CredentialStore>,
        firebase_service_account_path: Option<String>,
    ) -> Self {
        AppState {
            ai_service,
            settings: Arc::new(RwLock::new(settings)),
            event_tx,
            credentials,
            firebase_service_account_path,
        }
    }

    /// Subscribe to the application event bus.
    pub fn subscribe(&self) -> broadcast::Receiver<AppEvent> {
        self.event_tx.subscribe()
    }
}

// ---------------------------------------------------------------------------
// SchedulerHandle
//
// A slimmer handle passed to the background scheduler so it doesn't need
// the full AppState (which is non-Clone and owned by Tauri's managed state).
// ---------------------------------------------------------------------------

pub struct SchedulerHandle {
    pub ai_service: Arc<AiService>,
    pub settings: Arc<RwLock<AppSettings>>,
    pub event_tx: broadcast::Sender<AppEvent>,
    pub credentials: Arc<CredentialStore>,
}

impl SchedulerHandle {
    pub fn subscribe(&self) -> broadcast::Receiver<AppEvent> {
        self.event_tx.subscribe()
    }
}
