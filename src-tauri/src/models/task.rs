use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Blocked,
    Done,
    Cancelled,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Todo
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Urgent,
    High,
    Medium,
    Low,
}

impl Default for Priority {
    fn default() -> Self {
        Priority::Medium
    }
}

/// Eisenhower matrix quadrant
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EisenhowerQuadrant {
    /// Urgent + Important  → Do it now
    DoNow,
    /// Not-urgent + Important → Schedule it
    Schedule,
    /// Urgent + Not-important → Delegate
    Delegate,
    /// Not-urgent + Not-important → Eliminate
    Eliminate,
}

// ---------------------------------------------------------------------------
// Core model
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: Priority,
    pub quadrant: Option<EisenhowerQuadrant>,

    /// IDs of sub-tasks
    pub subtask_ids: Vec<Uuid>,
    /// Parent task ID, if this is a sub-task
    pub parent_id: Option<Uuid>,

    /// Linked habit IDs
    pub habit_ids: Vec<Uuid>,
    /// Linked note IDs
    pub note_ids: Vec<Uuid>,
    /// Linked calendar event IDs
    pub event_ids: Vec<Uuid>,

    /// Framework context (e.g. "pomodoro", "daily6")
    pub framework_context: Option<String>,

    pub due_date: Option<DateTime<Utc>>,
    pub scheduled_for: Option<DateTime<Utc>>,
    /// Estimated duration in minutes
    pub estimated_minutes: Option<u32>,
    /// Actual time spent in minutes (accumulated from pomodoro/timer sessions)
    pub actual_minutes: Option<u32>,

    pub tags: Vec<String>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl Task {
    pub fn new(title: impl Into<String>) -> Self {
        let now = Utc::now();
        Task {
            id: Uuid::new_v4(),
            title: title.into(),
            description: None,
            status: TaskStatus::default(),
            priority: Priority::default(),
            quadrant: None,
            subtask_ids: vec![],
            parent_id: None,
            habit_ids: vec![],
            note_ids: vec![],
            event_ids: vec![],
            framework_context: None,
            due_date: None,
            scheduled_for: None,
            estimated_minutes: None,
            actual_minutes: None,
            tags: vec![],
            created_at: now,
            updated_at: now,
            completed_at: None,
        }
    }

    /// Derive Eisenhower quadrant from urgency + importance flags.
    pub fn derive_quadrant(urgent: bool, important: bool) -> EisenhowerQuadrant {
        match (urgent, important) {
            (true, true) => EisenhowerQuadrant::DoNow,
            (false, true) => EisenhowerQuadrant::Schedule,
            (true, false) => EisenhowerQuadrant::Delegate,
            (false, false) => EisenhowerQuadrant::Eliminate,
        }
    }
}

// ---------------------------------------------------------------------------
// Payloads (frontend → backend)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskPayload {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<Priority>,
    pub quadrant: Option<EisenhowerQuadrant>,
    pub due_date: Option<DateTime<Utc>>,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub estimated_minutes: Option<u32>,
    pub tags: Option<Vec<String>>,
    pub parent_id: Option<Uuid>,
    pub framework_context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTaskPayload {
    pub id: Uuid,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<Priority>,
    pub quadrant: Option<EisenhowerQuadrant>,
    pub due_date: Option<DateTime<Utc>>,
    pub scheduled_for: Option<DateTime<Utc>>,
    pub estimated_minutes: Option<u32>,
    pub actual_minutes: Option<u32>,
    pub tags: Option<Vec<String>>,
    pub framework_context: Option<String>,
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaskFilter {
    pub status: Option<Vec<TaskStatus>>,
    pub priority: Option<Vec<Priority>>,
    pub quadrant: Option<EisenhowerQuadrant>,
    pub tags: Option<Vec<String>>,
    pub due_before: Option<DateTime<Utc>>,
    pub due_after: Option<DateTime<Utc>>,
    pub parent_id: Option<Uuid>,
    pub framework_context: Option<String>,
    pub search_query: Option<String>,
}
