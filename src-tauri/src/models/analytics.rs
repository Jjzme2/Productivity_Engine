use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Activity events (append-only log)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActivityEventType {
    TaskCreated,
    TaskCompleted,
    TaskUpdated,
    TaskDeleted,
    HabitLogged,
    HabitSkipped,
    NoteCreated,
    EventCreated,
    EventUpdated,
    PomodoroCompleted,
    PomodoroAborted,
    FrameworkStarted,
    FrameworkCompleted,
    VoiceCommandUsed,
    AiSuggestionAccepted,
    AiSuggestionDismissed,
    AppOpened,
    AppClosed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEvent {
    pub id: Uuid,
    pub event_type: ActivityEventType,
    /// ID of the primary entity involved (task, habit, etc.)
    pub entity_id: Option<Uuid>,
    /// Free-form metadata (e.g. duration for pomodoro)
    pub meta: Option<serde_json::Value>,
    pub occurred_at: DateTime<Utc>,
}

impl ActivityEvent {
    pub fn new(event_type: ActivityEventType) -> Self {
        ActivityEvent {
            id: Uuid::new_v4(),
            event_type,
            entity_id: None,
            meta: None,
            occurred_at: Utc::now(),
        }
    }

    pub fn with_entity(mut self, entity_id: Uuid) -> Self {
        self.entity_id = Some(entity_id);
        self
    }

    pub fn with_meta(mut self, meta: serde_json::Value) -> Self {
        self.meta = Some(meta);
        self
    }
}

// ---------------------------------------------------------------------------
// Computed statistics (output of the analytics engine)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionStats {
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub tasks_created: u32,
    pub tasks_completed: u32,
    pub tasks_cancelled: u32,
    pub completion_rate: f32,
    pub habits_due: u32,
    pub habits_completed: u32,
    pub habit_adherence_rate: f32,
    pub pomodoro_sessions_completed: u32,
    pub total_focus_minutes: u32,
}

/// 24-slot heat map: value[h] = relative activity intensity for hour h (0.0 – 1.0)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeOfDayHeatmap {
    pub hours: [f32; 24],
    pub peak_hour: u8,
    pub trough_hour: u8,
}

impl Default for TimeOfDayHeatmap {
    fn default() -> Self {
        TimeOfDayHeatmap {
            hours: [0.0; 24],
            peak_hour: 0,
            trough_hour: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductivityScore {
    /// 0 – 100 overall score
    pub overall: f32,
    pub focus_score: f32,
    pub consistency_score: f32,
    pub completion_score: f32,
    pub habit_adherence_score: f32,
    pub trend: ScoreTrend,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScoreTrend {
    Improving,
    Stable,
    Declining,
}

// ---------------------------------------------------------------------------
// AI-generated insights
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcomingItem {
    pub category: String,
    pub description: String,
    pub severity: f32,
    pub evidence: Vec<String>,
    pub suggestion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrengthItem {
    pub category: String,
    pub description: String,
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suggestion {
    pub id: Uuid,
    pub title: String,
    pub body: String,
    pub priority: f32,
    pub category: String,
    pub action_type: SuggestionActionType,
    pub action_payload: Option<serde_json::Value>,
}

impl Suggestion {
    pub fn new(title: impl Into<String>, body: impl Into<String>) -> Self {
        Suggestion {
            id: Uuid::new_v4(),
            title: title.into(),
            body: body.into(),
            priority: 0.5,
            category: "general".into(),
            action_type: SuggestionActionType::Informational,
            action_payload: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SuggestionActionType {
    CreateTask,
    CreateHabit,
    ScheduleBlock,
    StartFramework,
    Informational,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInsights {
    pub generated_at: DateTime<Utc>,
    pub productivity_score: ProductivityScore,
    pub shortcomings: Vec<ShortcomingItem>,
    pub strengths: Vec<StrengthItem>,
    pub suggestions: Vec<Suggestion>,
    pub heatmap: TimeOfDayHeatmap,
    pub completion_stats: CompletionStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklySummary {
    pub week_start: NaiveDate,
    pub week_end: NaiveDate,
    pub completion_stats: CompletionStats,
    pub productivity_score: ProductivityScore,
    pub top_strengths: Vec<StrengthItem>,
    pub top_shortcomings: Vec<ShortcomingItem>,
    pub highlight: String,
    pub generated_at: DateTime<Utc>,
}
