use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Framework type / slug
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FrameworkType {
    Builtin,
    Custom,
}

/// Well-known framework slugs. `Custom(String)` handles user-defined ones.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FrameworkSlug {
    /// "Eat the Frog" daily 6-task prioritization
    Daily6,
    /// Pomodoro technique
    Pomodoro,
    /// Getting Things Done
    Gtd,
    /// Time-blocking day planner
    TimeBlocking,
    /// User-defined; inner string is the slug
    #[serde(untagged)]
    Custom(String),
}

impl FrameworkSlug {
    pub fn as_str(&self) -> &str {
        match self {
            FrameworkSlug::Daily6 => "daily6",
            FrameworkSlug::Pomodoro => "pomodoro",
            FrameworkSlug::Gtd => "gtd",
            FrameworkSlug::TimeBlocking => "time_blocking",
            FrameworkSlug::Custom(s) => s.as_str(),
        }
    }
}

// ---------------------------------------------------------------------------
// Framework definition (serialisable step graph)
// ---------------------------------------------------------------------------

/// A single step within a framework (state-machine node).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkStep {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    /// Duration in seconds (None = unbounded / user-driven)
    pub duration_secs: Option<u64>,
    /// IDs of steps this step can transition to
    pub next_steps: Vec<String>,
    /// Arbitrary metadata consumed by the engine (e.g. {"pomodoro_type": "work"})
    pub meta: Option<JsonValue>,
}

/// The full declarative definition of a framework.
/// Stored as JSON in the app database so custom frameworks can be loaded without code changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkDefinition {
    pub slug: FrameworkSlug,
    pub name: String,
    pub description: String,
    pub version: String,
    pub initial_step: String,
    pub steps: Vec<FrameworkStep>,
    /// Configurable parameters exposed to the user
    pub config_schema: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// Runtime session
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkSession {
    pub id: Uuid,
    pub framework_id: Uuid,
    pub framework_slug: FrameworkSlug,
    /// Task IDs the user chose to work on during this session
    pub task_ids: Vec<Uuid>,
    pub state: FrameworkState,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    /// User-provided config overrides (e.g. {"work_mins": 50})
    pub config: Option<JsonValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkState {
    pub current_step: String,
    pub step_started_at: DateTime<Utc>,
    /// Seconds elapsed in the current step
    pub elapsed_secs: u64,
    /// Pomodoro-specific state (None for non-Pomodoro frameworks)
    pub pomodoro: Option<PomodoroState>,
    /// Arbitrary key-value store for framework engine extensions
    pub context: JsonValue,
}

// ---------------------------------------------------------------------------
// Pomodoro specifics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PomodoroInterval {
    Work,
    ShortBreak,
    LongBreak,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroState {
    pub interval: PomodoroInterval,
    /// Number of completed work intervals so far in this session
    pub completed_intervals: u32,
    /// After how many work intervals a long break is triggered (default 4)
    pub long_break_after: u32,
    /// Duration overrides in seconds
    pub work_secs: u64,
    pub short_break_secs: u64,
    pub long_break_secs: u64,
}

impl Default for PomodoroState {
    fn default() -> Self {
        PomodoroState {
            interval: PomodoroInterval::Work,
            completed_intervals: 0,
            long_break_after: 4,
            work_secs: 25 * 60,
            short_break_secs: 5 * 60,
            long_break_secs: 15 * 60,
        }
    }
}

// ---------------------------------------------------------------------------
// Framework (the metadata record stored in the DB / config)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Framework {
    pub id: Uuid,
    pub framework_type: FrameworkType,
    pub definition: FrameworkDefinition,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Framework {
    pub fn new(definition: FrameworkDefinition, framework_type: FrameworkType) -> Self {
        let now = Utc::now();
        Framework {
            id: Uuid::new_v4(),
            framework_type,
            definition,
            is_active: false,
            created_at: now,
            updated_at: now,
        }
    }
}
