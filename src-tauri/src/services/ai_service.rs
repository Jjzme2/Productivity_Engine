use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::error::AppError;
use crate::models::analytics::Suggestion;

// ---------------------------------------------------------------------------
// Chat primitives
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

impl ChatMessage {
    pub fn user(content: impl Into<String>) -> Self {
        ChatMessage { role: ChatRole::User, content: content.into() }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        ChatMessage { role: ChatRole::Assistant, content: content.into() }
    }
    pub fn system(content: impl Into<String>) -> Self {
        ChatMessage { role: ChatRole::System, content: content.into() }
    }
}

// ---------------------------------------------------------------------------
// Intent model
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntentAction {
    CreateTask,
    UpdateTask,
    DeleteTask,
    CompleteTask,
    CreateHabit,
    LogHabit,
    CreateNote,
    CreateEvent,
    UpdateEvent,
    StartFramework(String),
    StopFramework,
    QueryTasks,
    QueryHabits,
    QueryCalendar,
    GetInsights,
    GetSuggestions,
    GeneralChat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentEntities {
    /// Extracted task/habit/event title
    pub title: Option<String>,
    /// Extracted due date/time in ISO-8601
    pub datetime: Option<String>,
    /// Extracted priority string ("urgent", "high", etc.)
    pub priority: Option<String>,
    /// Extracted tags
    pub tags: Vec<String>,
    /// Extracted description / body text
    pub description: Option<String>,
    /// Framework slug if action is StartFramework
    pub framework_slug: Option<String>,
    /// Free-form extra entities for future use
    pub extra: serde_json::Value,
}

impl Default for IntentEntities {
    fn default() -> Self {
        IntentEntities {
            title: None,
            datetime: None,
            priority: None,
            tags: vec![],
            description: None,
            framework_slug: None,
            extra: serde_json::Value::Null,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedIntent {
    pub action: IntentAction,
    pub confidence: f32,
    pub entities: IntentEntities,
    pub raw_input: String,
    pub suggested_display: String,
    pub provider_used: String,
}

// ---------------------------------------------------------------------------
// Contexts used by higher-level AI calls
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserContext {
    pub open_tasks_count: u32,
    pub due_today_count: u32,
    pub active_framework: Option<String>,
    pub current_time_iso: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestionContext {
    pub open_tasks_count: u32,
    pub overdue_tasks_count: u32,
    pub habit_streak_summary: Vec<(String, u32)>,
    pub last_pomodoro_completed_at: Option<String>,
    pub current_time_iso: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyBriefContext {
    pub tasks_due_today: Vec<String>,
    pub habits_due_today: Vec<String>,
    pub events_today: Vec<String>,
    pub yesterday_completion_rate: f32,
    pub current_date: String,
    pub user_timezone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyBrief {
    pub greeting: String,
    pub summary: String,
    pub focus_suggestion: String,
    pub motivational_note: String,
    pub generated_at: String,
    pub provider_used: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisReport {
    pub shortcomings: Vec<crate::models::analytics::ShortcomingItem>,
    pub strengths: Vec<crate::models::analytics::StrengthItem>,
    pub summary: String,
    pub provider_used: String,
}

// ---------------------------------------------------------------------------
// Backend trait
// ---------------------------------------------------------------------------

#[async_trait]
pub trait AiBackend: Send + Sync {
    /// Send a completion request; returns the assistant reply text.
    async fn complete(&self, system: &str, messages: &[ChatMessage]) -> Result<String, AppError>;
    /// Health-check: returns true when the backend is reachable.
    async fn is_available(&self) -> bool;
    /// Human-readable provider name.
    fn name(&self) -> &str;
}

// ---------------------------------------------------------------------------
// Provider preference
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderPreference {
    /// Try local first; fall back to cloud
    LocalFirst,
    /// Try cloud first; fall back to local
    CloudFirst,
    /// Never use cloud; fail if local unavailable
    LocalOnly,
    /// Never use local; always cloud
    CloudOnly,
}

impl Default for ProviderPreference {
    fn default() -> Self {
        ProviderPreference::LocalFirst
    }
}

// ---------------------------------------------------------------------------
// Provider enum (configuration)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AiProvider {
    Ollama { base_url: String, model: String },
    Claude { api_key: String, model: String },
    OpenAI { api_key: String, model: String },
    Gemini { api_key: String, model: String },
}

// ---------------------------------------------------------------------------
// Status DTO returned to frontend
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProviderStatus {
    pub local_available: bool,
    pub cloud_available: bool,
    pub active_provider: String,
    pub preference: ProviderPreference,
}

// ---------------------------------------------------------------------------
// Ollama backend
// ---------------------------------------------------------------------------

pub struct OllamaBackend {
    pub base_url: String,
    pub model: String,
    client: Client,
}

impl OllamaBackend {
    pub fn new(base_url: impl Into<String>, model: impl Into<String>) -> Self {
        OllamaBackend {
            base_url: base_url.into(),
            model: model.into(),
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AiBackend for OllamaBackend {
    fn name(&self) -> &str {
        "ollama"
    }

    async fn is_available(&self) -> bool {
        let url = format!("{}/api/tags", self.base_url);
        match self.client.get(&url).send().await {
            Ok(r) => r.status().is_success(),
            Err(_) => false,
        }
    }

    async fn complete(&self, system: &str, messages: &[ChatMessage]) -> Result<String, AppError> {
        let url = format!("{}/api/chat", self.base_url);

        // Build the messages array including a leading system message if provided
        let mut ollama_messages: Vec<serde_json::Value> = Vec::new();
        if !system.is_empty() {
            ollama_messages.push(serde_json::json!({
                "role": "system",
                "content": system
            }));
        }
        for m in messages {
            ollama_messages.push(serde_json::json!({
                "role": match m.role {
                    ChatRole::User => "user",
                    ChatRole::Assistant => "assistant",
                    ChatRole::System => "system",
                },
                "content": m.content
            }));
        }

        let body = serde_json::json!({
            "model": self.model,
            "messages": ollama_messages,
            "stream": false
        });

        debug!(model = %self.model, "Sending request to Ollama");

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("Ollama request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!("Ollama returned {status}: {text}")));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Ai(format!("Ollama response parse error: {e}")))?;

        let content = json["message"]["content"]
            .as_str()
            .ok_or_else(|| AppError::Ai("Ollama: missing message.content in response".into()))?
            .to_string();

        Ok(content)
    }
}

// ---------------------------------------------------------------------------
// Claude backend
// ---------------------------------------------------------------------------

pub struct ClaudeBackend {
    pub api_key: String,
    pub model: String,
    client: Client,
}

impl ClaudeBackend {
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        ClaudeBackend {
            api_key: api_key.into(),
            model: model.into(),
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AiBackend for ClaudeBackend {
    fn name(&self) -> &str {
        "claude"
    }

    async fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    async fn complete(&self, system: &str, messages: &[ChatMessage]) -> Result<String, AppError> {
        let url = "https://api.anthropic.com/v1/messages";

        let api_messages: Vec<serde_json::Value> = messages
            .iter()
            .filter(|m| !matches!(m.role, ChatRole::System))
            .map(|m| {
                serde_json::json!({
                    "role": match m.role {
                        ChatRole::User => "user",
                        ChatRole::Assistant => "assistant",
                        ChatRole::System => "user",
                    },
                    "content": m.content
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "model": self.model,
            "max_tokens": 4096,
            "messages": api_messages
        });

        if !system.is_empty() {
            body["system"] = serde_json::Value::String(system.to_string());
        }

        debug!(model = %self.model, "Sending request to Claude API");

        let resp = self
            .client
            .post(url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("Claude request failed: {e}")))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            return Err(AppError::RateLimit("Claude API rate limit exceeded".into()));
        }
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!("Claude returned {status}: {text}")));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Ai(format!("Claude response parse error: {e}")))?;

        let content = json["content"][0]["text"]
            .as_str()
            .ok_or_else(|| AppError::Ai("Claude: missing content[0].text in response".into()))?
            .to_string();

        Ok(content)
    }
}

// ---------------------------------------------------------------------------
// OpenAI backend
// ---------------------------------------------------------------------------

pub struct OpenAIBackend {
    pub api_key: String,
    pub model: String,
    client: Client,
}

impl OpenAIBackend {
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        OpenAIBackend {
            api_key: api_key.into(),
            model: model.into(),
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AiBackend for OpenAIBackend {
    fn name(&self) -> &str {
        "openai"
    }

    async fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    async fn complete(&self, system: &str, messages: &[ChatMessage]) -> Result<String, AppError> {
        let url = "https://api.openai.com/v1/chat/completions";

        let mut oai_messages: Vec<serde_json::Value> = Vec::new();
        if !system.is_empty() {
            oai_messages.push(serde_json::json!({ "role": "system", "content": system }));
        }
        for m in messages {
            oai_messages.push(serde_json::json!({
                "role": match m.role {
                    ChatRole::User => "user",
                    ChatRole::Assistant => "assistant",
                    ChatRole::System => "system",
                },
                "content": m.content
            }));
        }

        let body = serde_json::json!({
            "model": self.model,
            "messages": oai_messages,
            "temperature": 0.7
        });

        debug!(model = %self.model, "Sending request to OpenAI API");

        let resp = self
            .client
            .post(url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("OpenAI request failed: {e}")))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            return Err(AppError::RateLimit("OpenAI API rate limit exceeded".into()));
        }
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!("OpenAI returned {status}: {text}")));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Ai(format!("OpenAI response parse error: {e}")))?;

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| {
                AppError::Ai("OpenAI: missing choices[0].message.content in response".into())
            })?
            .to_string();

        Ok(content)
    }
}

// ---------------------------------------------------------------------------
// Gemini backend
// ---------------------------------------------------------------------------

pub struct GeminiBackend {
    pub api_key: String,
    pub model: String,
    client: Client,
}

impl GeminiBackend {
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        GeminiBackend {
            api_key: api_key.into(),
            model: model.into(),
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AiBackend for GeminiBackend {
    fn name(&self) -> &str {
        "gemini"
    }

    async fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    async fn complete(&self, system: &str, messages: &[ChatMessage]) -> Result<String, AppError> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );

        // Gemini uses "contents" array with "parts"
        let mut contents: Vec<serde_json::Value> = Vec::new();

        // Prepend system instructions as a user turn (Gemini doesn't have a system role in basic API)
        if !system.is_empty() {
            contents.push(serde_json::json!({
                "role": "user",
                "parts": [{ "text": format!("[SYSTEM INSTRUCTIONS]\n{system}") }]
            }));
            contents.push(serde_json::json!({
                "role": "model",
                "parts": [{ "text": "Understood. I will follow these instructions." }]
            }));
        }

        for m in messages {
            let role = match m.role {
                ChatRole::User | ChatRole::System => "user",
                ChatRole::Assistant => "model",
            };
            contents.push(serde_json::json!({
                "role": role,
                "parts": [{ "text": m.content }]
            }));
        }

        let body = serde_json::json!({
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 4096
            }
        });

        debug!(model = %self.model, "Sending request to Gemini API");

        let resp = self
            .client
            .post(&url)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("Gemini request failed: {e}")))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            return Err(AppError::RateLimit("Gemini API rate limit exceeded".into()));
        }
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!("Gemini returned {status}: {text}")));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Ai(format!("Gemini response parse error: {e}")))?;

        let content = json["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .ok_or_else(|| {
                AppError::Ai(
                    "Gemini: missing candidates[0].content.parts[0].text in response".into(),
                )
            })?
            .to_string();

        Ok(content)
    }
}

// ---------------------------------------------------------------------------
// AiService
// ---------------------------------------------------------------------------

pub struct AiService {
    pub preference: RwLock<ProviderPreference>,
    local_backend: Option<Box<dyn AiBackend>>,
    cloud_backend: Box<dyn AiBackend>,
}

impl AiService {
    /// Build with Ollama as local and a cloud provider.
    pub fn new(
        local: Option<Box<dyn AiBackend>>,
        cloud: Box<dyn AiBackend>,
        preference: ProviderPreference,
    ) -> Self {
        AiService {
            preference: RwLock::new(preference),
            local_backend: local,
            cloud_backend: cloud,
        }
    }

    /// Build a default service: Ollama local + Claude cloud (keys read later).
    pub fn default_with_keys(claude_key: String) -> Self {
        let local: Box<dyn AiBackend> =
            Box::new(OllamaBackend::new("http://localhost:11434", "llama3"));
        let cloud: Box<dyn AiBackend> =
            Box::new(ClaudeBackend::new(claude_key, "claude-3-5-sonnet-20241022"));
        AiService::new(Some(local), cloud, ProviderPreference::LocalFirst)
    }

    /// Select which backend to use based on preference + availability.
    pub async fn resolve_backend(&self) -> &dyn AiBackend {
        let pref = self.preference.read().await.clone();
        match pref {
            ProviderPreference::LocalOnly => {
                if let Some(local) = &self.local_backend {
                    return local.as_ref();
                }
                warn!("LocalOnly preference but no local backend configured; falling back to cloud");
                self.cloud_backend.as_ref()
            }
            ProviderPreference::CloudOnly => self.cloud_backend.as_ref(),
            ProviderPreference::LocalFirst => {
                if let Some(local) = &self.local_backend {
                    if local.is_available().await {
                        return local.as_ref();
                    }
                    info!("Local backend unavailable; falling back to cloud");
                }
                self.cloud_backend.as_ref()
            }
            ProviderPreference::CloudFirst => {
                if self.cloud_backend.is_available().await {
                    return self.cloud_backend.as_ref();
                }
                info!("Cloud backend unavailable; falling back to local");
                if let Some(local) = &self.local_backend {
                    return local.as_ref();
                }
                self.cloud_backend.as_ref()
            }
        }
    }

    // -----------------------------------------------------------------------
    // NLP intent parsing
    // -----------------------------------------------------------------------

    pub async fn parse_nlp_intent(
        &self,
        input: &str,
        context: &UserContext,
    ) -> Result<ParsedIntent, AppError> {
        let backend = self.resolve_backend().await;

        let system = r#"You are a productivity assistant NLP parser.
Your job is to classify the user's intent and extract entities.
Respond ONLY with valid JSON in this exact schema:
{
  "action": "<one of: create_task|update_task|delete_task|complete_task|create_habit|log_habit|create_note|create_event|update_event|start_framework|stop_framework|query_tasks|query_habits|query_calendar|get_insights|get_suggestions|general_chat>",
  "confidence": <0.0 to 1.0>,
  "entities": {
    "title": "<string or null>",
    "datetime": "<ISO-8601 string or null>",
    "priority": "<urgent|high|medium|low or null>",
    "tags": ["<tag>"],
    "description": "<string or null>",
    "framework_slug": "<string or null>"
  },
  "suggested_display": "<human-readable sentence describing what you will do>"
}
Do not wrap the JSON in markdown code fences."#;

        let context_json = serde_json::json!({
            "open_tasks": context.open_tasks_count,
            "due_today": context.due_today_count,
            "active_framework": context.active_framework,
            "current_time": context.current_time_iso,
        });

        let user_msg = format!(
            "Context: {}\n\nUser input: {}",
            context_json, input
        );

        let raw = backend
            .complete(system, &[ChatMessage::user(user_msg)])
            .await?;

        // Parse the JSON response
        let parsed: serde_json::Value = serde_json::from_str(raw.trim()).map_err(|e| {
            AppError::Ai(format!(
                "Intent parse: could not decode JSON response: {e}. Raw: {raw}"
            ))
        })?;

        let action_str = parsed["action"]
            .as_str()
            .unwrap_or("general_chat");

        let action = match action_str {
            "create_task" => IntentAction::CreateTask,
            "update_task" => IntentAction::UpdateTask,
            "delete_task" => IntentAction::DeleteTask,
            "complete_task" => IntentAction::CompleteTask,
            "create_habit" => IntentAction::CreateHabit,
            "log_habit" => IntentAction::LogHabit,
            "create_note" => IntentAction::CreateNote,
            "create_event" => IntentAction::CreateEvent,
            "update_event" => IntentAction::UpdateEvent,
            "start_framework" => {
                let slug = parsed["entities"]["framework_slug"]
                    .as_str()
                    .unwrap_or("pomodoro")
                    .to_string();
                IntentAction::StartFramework(slug)
            }
            "stop_framework" => IntentAction::StopFramework,
            "query_tasks" => IntentAction::QueryTasks,
            "query_habits" => IntentAction::QueryHabits,
            "query_calendar" => IntentAction::QueryCalendar,
            "get_insights" => IntentAction::GetInsights,
            "get_suggestions" => IntentAction::GetSuggestions,
            _ => IntentAction::GeneralChat,
        };

        let entities_json = &parsed["entities"];
        let entities = IntentEntities {
            title: entities_json["title"].as_str().map(String::from),
            datetime: entities_json["datetime"].as_str().map(String::from),
            priority: entities_json["priority"].as_str().map(String::from),
            tags: entities_json["tags"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            description: entities_json["description"].as_str().map(String::from),
            framework_slug: entities_json["framework_slug"].as_str().map(String::from),
            extra: serde_json::Value::Null,
        };

        let confidence = parsed["confidence"].as_f64().unwrap_or(0.7) as f32;
        let suggested_display = parsed["suggested_display"]
            .as_str()
            .unwrap_or("Processing your request…")
            .to_string();

        Ok(ParsedIntent {
            action,
            confidence,
            entities,
            raw_input: input.to_string(),
            suggested_display,
            provider_used: backend.name().to_string(),
        })
    }

    // -----------------------------------------------------------------------
    // Suggestion generation
    // -----------------------------------------------------------------------

    pub async fn generate_suggestion(
        &self,
        context: &SuggestionContext,
    ) -> Result<Vec<Suggestion>, AppError> {
        let backend = self.resolve_backend().await;

        let system = r#"You are a productivity coach AI.
Given the user's current context, generate 3-5 actionable suggestions.
Respond ONLY with a valid JSON array where each item has:
{
  "title": "<short imperative title>",
  "body": "<1-2 sentence explanation>",
  "priority": <0.0 to 1.0>,
  "category": "<focus|habits|tasks|wellbeing|scheduling>",
  "action_type": "<create_task|create_habit|schedule_block|start_framework|informational>"
}
Do not wrap the JSON in markdown code fences."#;

        let ctx_json = serde_json::to_string_pretty(context)
            .unwrap_or_else(|_| "{}".into());

        let raw = backend
            .complete(system, &[ChatMessage::user(ctx_json)])
            .await?;

        let arr: serde_json::Value = serde_json::from_str(raw.trim()).map_err(|e| {
            AppError::Ai(format!("Suggestion parse error: {e}. Raw: {raw}"))
        })?;

        let suggestions = arr
            .as_array()
            .ok_or_else(|| AppError::Ai("Suggestion response is not a JSON array".into()))?
            .iter()
            .map(|item| {
                let mut s = Suggestion::new(
                    item["title"].as_str().unwrap_or("Suggestion"),
                    item["body"].as_str().unwrap_or(""),
                );
                s.priority = item["priority"].as_f64().unwrap_or(0.5) as f32;
                s.category = item["category"]
                    .as_str()
                    .unwrap_or("general")
                    .to_string();
                s
            })
            .collect();

        Ok(suggestions)
    }

    // -----------------------------------------------------------------------
    // Shortcoming analysis
    // -----------------------------------------------------------------------

    pub async fn analyze_shortcomings(
        &self,
        stats: &AnalyticsStats,
    ) -> Result<AnalysisReport, AppError> {
        let backend = self.resolve_backend().await;

        let system = r#"You are a productivity analyst AI.
Given the user's activity statistics, identify their top shortcomings and strengths.
Respond ONLY with valid JSON:
{
  "shortcomings": [
    {
      "category": "<string>",
      "description": "<string>",
      "severity": <0.0-1.0>,
      "evidence": ["<string>"],
      "suggestion": "<string>"
    }
  ],
  "strengths": [
    {
      "category": "<string>",
      "description": "<string>",
      "evidence": ["<string>"]
    }
  ],
  "summary": "<2-3 sentence overall summary>"
}
Do not wrap the JSON in markdown code fences."#;

        let stats_json = serde_json::to_string_pretty(stats)
            .unwrap_or_else(|_| "{}".into());

        let raw = backend
            .complete(system, &[ChatMessage::user(stats_json)])
            .await?;

        let parsed: serde_json::Value = serde_json::from_str(raw.trim()).map_err(|e| {
            AppError::Ai(format!("Analysis parse error: {e}. Raw: {raw}"))
        })?;

        let shortcomings = parsed["shortcomings"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|item| crate::models::analytics::ShortcomingItem {
                category: item["category"].as_str().unwrap_or("").to_string(),
                description: item["description"].as_str().unwrap_or("").to_string(),
                severity: item["severity"].as_f64().unwrap_or(0.5) as f32,
                evidence: item["evidence"]
                    .as_array()
                    .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
                suggestion: item["suggestion"].as_str().unwrap_or("").to_string(),
            })
            .collect();

        let strengths = parsed["strengths"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|item| crate::models::analytics::StrengthItem {
                category: item["category"].as_str().unwrap_or("").to_string(),
                description: item["description"].as_str().unwrap_or("").to_string(),
                evidence: item["evidence"]
                    .as_array()
                    .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
            })
            .collect();

        let summary = parsed["summary"]
            .as_str()
            .unwrap_or("Analysis complete.")
            .to_string();

        Ok(AnalysisReport {
            shortcomings,
            strengths,
            summary,
            provider_used: backend.name().to_string(),
        })
    }

    // -----------------------------------------------------------------------
    // Daily brief
    // -----------------------------------------------------------------------

    pub async fn daily_brief(
        &self,
        context: &DailyBriefContext,
    ) -> Result<DailyBrief, AppError> {
        let backend = self.resolve_backend().await;

        let system = r#"You are a personal productivity assistant generating a morning brief.
Keep it concise, upbeat, and actionable.
Respond ONLY with valid JSON:
{
  "greeting": "<personalised greeting with date>",
  "summary": "<2-3 sentence overview of today>",
  "focus_suggestion": "<single most important task or focus area>",
  "motivational_note": "<1-2 sentence motivational message>"
}
Do not wrap the JSON in markdown code fences."#;

        let ctx_json = serde_json::to_string_pretty(context)
            .unwrap_or_else(|_| "{}".into());

        let raw = backend
            .complete(system, &[ChatMessage::user(ctx_json)])
            .await?;

        let parsed: serde_json::Value = serde_json::from_str(raw.trim()).map_err(|e| {
            AppError::Ai(format!("Daily brief parse error: {e}. Raw: {raw}"))
        })?;

        Ok(DailyBrief {
            greeting: parsed["greeting"].as_str().unwrap_or("Good morning!").to_string(),
            summary: parsed["summary"].as_str().unwrap_or("").to_string(),
            focus_suggestion: parsed["focus_suggestion"].as_str().unwrap_or("").to_string(),
            motivational_note: parsed["motivational_note"].as_str().unwrap_or("").to_string(),
            generated_at: chrono::Utc::now().to_rfc3339(),
            provider_used: backend.name().to_string(),
        })
    }

    // -----------------------------------------------------------------------
    // Provider status check
    // -----------------------------------------------------------------------

    pub async fn get_provider_status(&self) -> AiProviderStatus {
        let local_available = if let Some(local) = &self.local_backend {
            local.is_available().await
        } else {
            false
        };
        let cloud_available = self.cloud_backend.is_available().await;
        let preference = self.preference.read().await.clone();

        let active = self.resolve_backend().await.name().to_string();

        AiProviderStatus {
            local_available,
            cloud_available,
            active_provider: active,
            preference,
        }
    }
}

// ---------------------------------------------------------------------------
// AnalyticsStats placeholder (consumed by analyze_shortcomings)
// Mirrors what the analytics engine computes.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsStats {
    pub tasks_completed_7d: u32,
    pub tasks_overdue: u32,
    pub habit_adherence_rate: f32,
    pub focus_minutes_7d: u32,
    pub pomodoros_completed_7d: u32,
    pub consistency_score: f32,
    pub completion_rate_7d: f32,
    pub peak_hour: u8,
}
