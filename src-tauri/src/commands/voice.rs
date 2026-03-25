use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::error::AppError;
use crate::services::voice_service::{VoiceProvider, VoiceService, VoiceStatus};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Managed voice service state
// ---------------------------------------------------------------------------

/// Tauri-managed wrapper around the VoiceService.
/// We use an `Arc<Mutex<VoiceService>>` so the inner service can be replaced
/// (e.g. when the user changes provider settings) without rebuilding AppState.
pub struct VoiceServiceState(pub Arc<Mutex<VoiceService>>);

impl VoiceServiceState {
    pub fn new(provider: VoiceProvider) -> Self {
        VoiceServiceState(Arc::new(Mutex::new(VoiceService::new(provider))))
    }
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub provider_used: String,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Start recording audio from the default microphone.
#[tauri::command]
pub async fn start_voice_capture(
    state: State<'_, AppState>,
    voice: State<'_, VoiceServiceState>,
) -> Result<VoiceStatus, AppError> {
    let svc = voice.inner().0.lock().await;
    svc.start_capture()?;

    let _ = state
        .event_tx
        .send(crate::events::AppEvent::VoiceCaptureStarted);

    Ok(svc.status())
}

/// Stop recording and discard the audio buffer.
/// Use `get_voice_transcription` to stop recording AND receive the transcription.
#[tauri::command]
pub async fn stop_voice_capture(
    state: State<'_, AppState>,
    voice: State<'_, VoiceServiceState>,
) -> Result<VoiceStatus, AppError> {
    let svc = voice.inner().0.lock().await;
    // Stop and drop the samples (use get_voice_transcription to keep them)
    let _ = svc.stop_capture()?;

    let _ = state
        .event_tx
        .send(crate::events::AppEvent::VoiceCaptureStopped);

    Ok(svc.status())
}

/// Return the current voice capture status without modifying it.
#[tauri::command]
pub async fn get_voice_status(
    voice: State<'_, VoiceServiceState>,
) -> Result<VoiceStatus, AppError> {
    Ok(voice.inner().0.lock().await.status())
}

/// Stop recording, transcribe the captured audio, and return the text.
/// Emits `VoiceTranscriptionReady` on success.
#[tauri::command]
pub async fn get_voice_transcription(
    state: State<'_, AppState>,
    voice: State<'_, VoiceServiceState>,
) -> Result<TranscriptionResult, AppError> {
    let svc = voice.inner().0.lock().await;
    let samples = svc.stop_capture()?;

    let _ = state
        .event_tx
        .send(crate::events::AppEvent::VoiceCaptureStopped);

    if samples.is_empty() {
        return Err(AppError::Voice(
            "No audio captured — microphone may not be recording".into(),
        ));
    }

    // Resolve the API key if using WhisperApi provider
    let provider_override: Option<VoiceProvider> = {
        let settings = state.settings.read().await;
        if settings.voice_provider == "whisper_api" {
            let key = state
                .credentials
                .get_api_key(crate::services::credential_store::SERVICE_OPENAI)?;
            key.map(|k| VoiceProvider::WhisperApi { api_key: k })
        } else {
            None
        }
    };

    let text = svc.transcribe(samples, provider_override).await?;

    let _ = state
        .event_tx
        .send(crate::events::AppEvent::VoiceTranscriptionReady {
            text: text.clone(),
        });

    let provider_used = svc.status().provider;

    Ok(TranscriptionResult { text, provider_used })
}
