use std::sync::Arc;
use tracing::info;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub mod commands;
pub mod error;
pub mod events;
pub mod models;
pub mod services;
pub mod state;

use commands::frameworks::SessionStore;
use commands::voice::VoiceServiceState;
use events::bus::create_bus;
use services::ai_service::{AiService, OllamaBackend, ClaudeBackend, GeminiBackend, ProviderPreference};
use services::credential_store::CredentialStore;
use services::voice_service::VoiceProvider;
use services::scheduler::Scheduler;
use state::{AppSettings, AppState};

// ---------------------------------------------------------------------------
// Logging initialisation
// ---------------------------------------------------------------------------

/// Initialise tracing.  Returns the non-blocking file writer guard — the
/// caller must keep it alive for the entire process lifetime or the async
/// log buffer will be dropped and final lines will be lost.
fn init_logging() -> tracing_appender::non_blocking::WorkerGuard {
    // ── Log directory ────────────────────────────────────────────────────────
    // Prefer XDG_DATA_HOME, fall back to $HOME/.local/share, then /tmp.
    let log_dir = std::env::var("XDG_DATA_HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::var("HOME")
                .map(|h| std::path::PathBuf::from(h).join(".local/share"))
                .unwrap_or_else(|_| std::env::temp_dir())
        })
        .join("productivity-engine/logs");

    std::fs::create_dir_all(&log_dir).ok();

    // Daily rolling file: app.YYYY-MM-DD.log
    let file_appender = tracing_appender::rolling::daily(&log_dir, "app.log");
    let (non_blocking_file, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,productivity_engine_lib=debug"));

    // Always write human-readable logs to the file.
    // In debug builds also print to stdout; in release skip stdout to avoid
    // cluttering the journal when the app runs from a .deb launcher.
    #[cfg(debug_assertions)]
    {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt::layer().with_writer(non_blocking_file).with_ansi(false))
            .with(fmt::layer().pretty().with_target(true))
            .init();
    }

    #[cfg(not(debug_assertions))]
    {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt::layer().with_writer(non_blocking_file).with_ansi(false))
            .init();
    }

    guard
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Keep the guard alive for the entire process — dropping it flushes and
    // closes the async file writer.
    let _log_guard = init_logging();
    info!("Productivity Engine (ILYTAT Suite) starting up");

    // ---- Credentials -------------------------------------------------------
    let credentials = Arc::new(CredentialStore::new());

    // ---- Settings ----------------------------------------------------------
    let settings = AppSettings::default();

    // ---- Firebase service account ------------------------------------------
    // Path to the service account JSON, e.g. ".secrets/service-account.json".
    // Used by Firebase Admin REST API calls that require server-side auth.
    let firebase_service_account_path = std::env::var("FIREBASE_SERVICE_ACCOUNT").ok();
    if let Some(ref path) = firebase_service_account_path {
        info!(path = %path, "Firebase service account configured");
    } else {
        info!("FIREBASE_SERVICE_ACCOUNT not set — Firebase Admin features disabled");
    }

    // ---- AI Service --------------------------------------------------------
    // Cloud backend: prefer Gemini when GEMINI_API_KEY is set in the environment;
    // otherwise fall back to the stored Claude key.
    let gemini_key = std::env::var("GEMINI_API_KEY").ok().unwrap_or_default();
    let claude_key = credentials
        .get_api_key(services::credential_store::SERVICE_ANTHROPIC)
        .ok()
        .flatten()
        .unwrap_or_default();

    let local_backend: Box<dyn services::ai_service::AiBackend> = Box::new(OllamaBackend::new(
        settings.ollama_base_url.clone(),
        "llama3",
    ));
    let cloud_backend: Box<dyn services::ai_service::AiBackend> = if !gemini_key.is_empty() {
        info!("Using Gemini as cloud AI backend");
        Box::new(GeminiBackend::new(gemini_key, "gemini-2.0-flash"))
    } else {
        info!("Using Claude as cloud AI backend");
        Box::new(ClaudeBackend::new(claude_key, "claude-sonnet-4-6"))
    };

    let ai_service = Arc::new(AiService::new(
        Some(local_backend),
        cloud_backend,
        ProviderPreference::LocalFirst,
    ));

    // ---- Event bus ---------------------------------------------------------
    let (event_tx, _event_rx) = create_bus();

    // ---- App state ---------------------------------------------------------
    // Build the AppState and also keep an Arc for the scheduler.
    let ai_svc_arc = ai_service.clone();
    let settings_arc = Arc::new(tokio::sync::RwLock::new(settings.clone()));
    let creds_arc = credentials.clone();
    let event_tx_clone = event_tx.clone();

    let app_state = AppState::new(
        ai_service,
        settings,
        event_tx,
        credentials,
        firebase_service_account_path,
    );

    // Arc used exclusively by the background scheduler
    let scheduler_state = Arc::new(state::SchedulerHandle {
        ai_service: ai_svc_arc,
        settings: settings_arc,
        event_tx: event_tx_clone,
        credentials: creds_arc,
    });

    // ---- Voice service -----------------------------------------------------
    let voice_state = VoiceServiceState::new(VoiceProvider::None);

    // ---- Session store (framework sessions) --------------------------------
    let session_store = SessionStore::new();

    // ---- Build Tauri app ---------------------------------------------------
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        // Plugins
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            // Derive a stronghold key from the system-level credential.
            // In production use the OS credential store to persist the key.
            use sha2::{Digest, Sha256};
            let mut hasher = Sha256::new();
            hasher.update(password);
            hasher.finalize().to_vec()
        }).build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        // Managed state
        .manage(app_state)
        .manage(voice_state)
        .manage(session_store)
        // Setup hook: start background scheduler
        .setup(move |_app| {
            Scheduler::start(scheduler_state);
            info!("Background scheduler started");
            Ok(())
        })
        // Command handlers
        .invoke_handler(tauri::generate_handler![
            // AI
            commands::ai::parse_nlp_intent,
            commands::ai::confirm_and_execute_intent,
            commands::ai::generate_suggestion,
            commands::ai::get_daily_brief,
            commands::ai::get_ai_provider_status,
            // Calendar
            commands::calendar::init_google_oauth,
            commands::calendar::start_oauth_listener,
            commands::calendar::complete_google_oauth,
            commands::calendar::get_google_calendars,
            commands::calendar::sync_google_calendar,
            commands::calendar::get_sync_status,
            commands::calendar::revoke_google_auth,
            // Frameworks
            commands::frameworks::get_frameworks,
            commands::frameworks::get_active_framework,
            commands::frameworks::activate_framework,
            commands::frameworks::deactivate_framework,
            commands::frameworks::tick_framework,
            commands::frameworks::create_custom_framework,
            commands::frameworks::update_custom_framework,
            commands::frameworks::delete_custom_framework,
            // Analytics
            commands::analytics::get_user_insights,
            commands::analytics::run_shortcoming_analysis,
            commands::analytics::get_productivity_score,
            commands::analytics::get_completion_stats,
            commands::analytics::get_weekly_summary,
            commands::analytics::log_activity_event,
            // Voice
            commands::voice::start_voice_capture,
            commands::voice::stop_voice_capture,
            commands::voice::get_voice_status,
            commands::voice::get_voice_transcription,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::set_api_key,
            commands::settings::get_api_key_status,
            commands::settings::get_ai_providers,
            commands::settings::set_active_ai_provider,
            commands::settings::export_data,
            commands::settings::import_data,
            commands::settings::show_main_window,
            // Secrets
            commands::secrets::read_secret_env,
            // Logging
            commands::logging::log_frontend_error,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Productivity Engine (ILYTAT Suite)");
}
