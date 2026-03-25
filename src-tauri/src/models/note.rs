use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Core model
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: Uuid,
    pub title: Option<String>,
    /// Markdown-formatted body
    pub body: String,

    /// Optional link to a task
    pub task_id: Option<Uuid>,
    /// Optional link to a habit
    pub habit_id: Option<Uuid>,
    /// Optional link to a calendar event
    pub event_id: Option<Uuid>,
    /// Optional link to a framework session
    pub framework_session_id: Option<Uuid>,

    pub tags: Vec<String>,
    pub pinned: bool,
    pub archived: bool,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Note {
    pub fn new(body: impl Into<String>) -> Self {
        let now = Utc::now();
        Note {
            id: Uuid::new_v4(),
            title: None,
            body: body.into(),
            task_id: None,
            habit_id: None,
            event_id: None,
            framework_session_id: None,
            tags: vec![],
            pinned: false,
            archived: false,
            created_at: now,
            updated_at: now,
        }
    }
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNotePayload {
    pub title: Option<String>,
    pub body: String,
    pub task_id: Option<Uuid>,
    pub habit_id: Option<Uuid>,
    pub event_id: Option<Uuid>,
    pub framework_session_id: Option<Uuid>,
    pub tags: Option<Vec<String>>,
    pub pinned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNotePayload {
    pub id: Uuid,
    pub title: Option<String>,
    pub body: Option<String>,
    pub task_id: Option<Uuid>,
    pub habit_id: Option<Uuid>,
    pub event_id: Option<Uuid>,
    pub framework_session_id: Option<Uuid>,
    pub tags: Option<Vec<String>>,
    pub pinned: Option<bool>,
    pub archived: Option<bool>,
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NoteFilter {
    pub task_id: Option<Uuid>,
    pub habit_id: Option<Uuid>,
    pub event_id: Option<Uuid>,
    pub framework_session_id: Option<Uuid>,
    pub tags: Option<Vec<String>>,
    pub pinned: Option<bool>,
    pub archived: Option<bool>,
    pub search_query: Option<String>,
}
