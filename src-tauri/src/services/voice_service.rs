use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleRate, StreamConfig};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tracing::{debug, error, info, warn};

use crate::error::AppError;

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VoiceProvider {
    /// Local OpenAI-compatible Whisper (e.g. whisper.cpp server)
    LocalWhisper { model_path: String },
    /// OpenAI Whisper API
    WhisperApi { api_key: String },
    /// Voice input disabled
    None,
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceStatus {
    pub is_capturing: bool,
    pub provider: String,
    pub sample_rate: u32,
    pub buffer_size: usize,
}

// ---------------------------------------------------------------------------
// Shared capture state (audio samples accumulated during recording)
// ---------------------------------------------------------------------------

struct CaptureState {
    is_active: bool,
    samples: Vec<f32>,
    stream: Option<cpal::Stream>,
}

// SAFETY: cpal's Stream contains a non-Send PhantomData marker as a lint hint,
// but the actual stream handle is safe to transfer across threads when it is
// only ever accessed while holding the Mutex<CaptureState> lock.
unsafe impl Send for CaptureState {}

impl CaptureState {
    fn new() -> Self {
        CaptureState {
            is_active: false,
            samples: Vec::new(),
            stream: None,
        }
    }
}

// ---------------------------------------------------------------------------
// VoiceService
// ---------------------------------------------------------------------------

pub struct VoiceService {
    provider: VoiceProvider,
    capture: Arc<Mutex<CaptureState>>,
    http: Client,
    sample_rate: u32,
}

impl VoiceService {
    pub fn new(provider: VoiceProvider) -> Self {
        VoiceService {
            provider,
            capture: Arc::new(Mutex::new(CaptureState::new())),
            http: Client::new(),
            sample_rate: 16_000,
        }
    }

    // -----------------------------------------------------------------------
    // Capture control
    // -----------------------------------------------------------------------

    /// Start audio capture from the default input device.
    /// Samples are accumulated in memory until `stop_capture` is called.
    pub fn start_capture(&self) -> Result<(), AppError> {
        let mut state = self
            .capture
            .lock()
            .map_err(|_| AppError::Voice("Failed to acquire capture lock".into()))?;

        if state.is_active {
            return Err(AppError::Voice("Capture already in progress".into()));
        }

        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| AppError::Voice("No default input device available".into()))?;

        info!(device = device.name().unwrap_or_default(), "Starting voice capture");

        let config = StreamConfig {
            channels: 1,
            sample_rate: SampleRate(self.sample_rate),
            buffer_size: cpal::BufferSize::Default,
        };

        let samples_arc = self.capture.clone();

        let stream = device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut s) = samples_arc.lock() {
                        if s.is_active {
                            s.samples.extend_from_slice(data);
                        }
                    }
                },
                move |err| {
                    error!("Voice capture stream error: {err}");
                },
                None,
            )
            .map_err(|e| AppError::Voice(format!("Failed to build input stream: {e}")))?;

        stream
            .play()
            .map_err(|e| AppError::Voice(format!("Failed to start audio stream: {e}")))?;

        state.is_active = true;
        state.samples.clear();
        state.stream = Some(stream);

        Ok(())
    }

    /// Stop capture and return all accumulated samples.
    pub fn stop_capture(&self) -> Result<Vec<f32>, AppError> {
        let mut state = self
            .capture
            .lock()
            .map_err(|_| AppError::Voice("Failed to acquire capture lock".into()))?;

        if !state.is_active {
            return Err(AppError::Voice("No active capture to stop".into()));
        }

        // Dropping the stream stops it
        let _ = state.stream.take();
        state.is_active = false;

        let samples = std::mem::take(&mut state.samples);
        info!(samples = samples.len(), "Voice capture stopped");

        Ok(samples)
    }

    /// Current capture status.
    pub fn status(&self) -> VoiceStatus {
        let state = self.capture.lock().ok();
        let is_capturing = state.as_ref().map(|s| s.is_active).unwrap_or(false);
        let buffer_size = state.as_ref().map(|s| s.samples.len()).unwrap_or(0);

        let provider = match &self.provider {
            VoiceProvider::LocalWhisper { .. } => "local_whisper",
            VoiceProvider::WhisperApi { .. } => "whisper_api",
            VoiceProvider::None => "none",
        };

        VoiceStatus {
            is_capturing,
            provider: provider.to_string(),
            sample_rate: self.sample_rate,
            buffer_size,
        }
    }

    // -----------------------------------------------------------------------
    // Transcription
    // -----------------------------------------------------------------------

    /// Transcribe PCM f32 audio samples using the configured provider.
    pub async fn transcribe(
        &self,
        audio: Vec<f32>,
        provider_override: Option<VoiceProvider>,
    ) -> Result<String, AppError> {
        let provider = provider_override.as_ref().unwrap_or(&self.provider);

        match provider {
            VoiceProvider::None => {
                Err(AppError::Voice("Voice provider is set to None; transcription disabled".into()))
            }
            VoiceProvider::LocalWhisper { model_path } => {
                self.transcribe_local(audio, model_path).await
            }
            VoiceProvider::WhisperApi { api_key } => {
                self.transcribe_openai(audio, api_key).await
            }
        }
    }

    // -----------------------------------------------------------------------
    // Local Whisper (whisper.cpp HTTP server)
    // -----------------------------------------------------------------------

    async fn transcribe_local(
        &self,
        audio: Vec<f32>,
        _model_path: &str,
    ) -> Result<String, AppError> {
        // Attempt to call a local whisper.cpp server on its default port.
        // whisper.cpp server accepts WAV files via multipart POST to /inference.
        let wav_bytes = Self::encode_wav(&audio, self.sample_rate)?;

        let part = reqwest::multipart::Part::bytes(wav_bytes)
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| AppError::Voice(format!("MIME type error: {e}")))?;

        let form = reqwest::multipart::Form::new().part("file", part);

        debug!("Sending audio to local Whisper server");

        let resp = self
            .http
            .post("http://127.0.0.1:8080/inference")
            .multipart(form)
            .send()
            .await
            .map_err(|e| AppError::Voice(format!("Local Whisper request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Voice(format!(
                "Local Whisper returned {status}: {text}"
            )));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Voice(format!("Local Whisper response parse error: {e}")))?;

        let text = json["text"]
            .as_str()
            .ok_or_else(|| AppError::Voice("Local Whisper: missing 'text' field".into()))?
            .trim()
            .to_string();

        Ok(text)
    }

    // -----------------------------------------------------------------------
    // OpenAI Whisper API
    // -----------------------------------------------------------------------

    async fn transcribe_openai(
        &self,
        audio: Vec<f32>,
        api_key: &str,
    ) -> Result<String, AppError> {
        let wav_bytes = Self::encode_wav(&audio, self.sample_rate)?;

        let part = reqwest::multipart::Part::bytes(wav_bytes)
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| AppError::Voice(format!("MIME type error: {e}")))?;

        let form = reqwest::multipart::Form::new()
            .part("file", part)
            .text("model", "whisper-1");

        debug!("Sending audio to OpenAI Whisper API");

        let resp = self
            .http
            .post("https://api.openai.com/v1/audio/transcriptions")
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await
            .map_err(|e| AppError::Voice(format!("OpenAI Whisper request failed: {e}")))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            return Err(AppError::RateLimit("OpenAI Whisper rate limit exceeded".into()));
        }
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Voice(format!(
                "OpenAI Whisper returned {status}: {text}"
            )));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Voice(format!("OpenAI Whisper response parse error: {e}")))?;

        let text = json["text"]
            .as_str()
            .ok_or_else(|| AppError::Voice("OpenAI Whisper: missing 'text' field".into()))?
            .trim()
            .to_string();

        Ok(text)
    }

    // -----------------------------------------------------------------------
    // WAV encoder (PCM f32 → 16-bit WAV bytes)
    // -----------------------------------------------------------------------

    fn encode_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, AppError> {
        use std::io::Cursor;

        let spec = hound::WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut buf = Cursor::new(Vec::new());
        let mut writer = hound::WavWriter::new(&mut buf, spec)
            .map_err(|e| AppError::Voice(format!("WAV writer init failed: {e}")))?;

        for &sample in samples {
            let s = (sample * i16::MAX as f32).clamp(i16::MIN as f32, i16::MAX as f32) as i16;
            writer
                .write_sample(s)
                .map_err(|e| AppError::Voice(format!("WAV write sample failed: {e}")))?;
        }

        writer
            .finalize()
            .map_err(|e| AppError::Voice(format!("WAV finalize failed: {e}")))?;

        Ok(buf.into_inner())
    }
}
