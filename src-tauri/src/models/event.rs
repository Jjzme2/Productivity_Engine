use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    /// Created locally, never pushed to Google Calendar
    Local,
    /// In sync with Google Calendar
    Synced,
    /// Local changes not yet pushed
    PendingPush,
    /// Local and remote versions differ — user resolution required
    Conflict,
}

impl Default for SyncStatus {
    fn default() -> Self {
        SyncStatus::Local
    }
}

// ---------------------------------------------------------------------------
// Core model
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: Uuid,
    /// Corresponding Google Calendar event ID (e.g. "abc123xyz")
    pub google_event_id: Option<String>,
    /// Google Calendar ID this event belongs to
    pub calendar_id: Option<String>,

    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,

    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub all_day: bool,

    /// RFC 5545 RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"
    pub recurrence_rule: Option<String>,
    /// For recurring event instances, the ID of the master event
    pub recurring_event_id: Option<String>,

    pub attendees: Vec<Attendee>,
    pub conference_url: Option<String>,
    pub color_id: Option<String>,

    pub sync_status: SyncStatus,
    pub sync_etag: Option<String>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl CalendarEvent {
    pub fn new(title: impl Into<String>, start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        let now = Utc::now();
        CalendarEvent {
            id: Uuid::new_v4(),
            google_event_id: None,
            calendar_id: None,
            title: title.into(),
            description: None,
            location: None,
            start_time: start,
            end_time: end,
            all_day: false,
            recurrence_rule: None,
            recurring_event_id: None,
            attendees: vec![],
            conference_url: None,
            color_id: None,
            sync_status: SyncStatus::default(),
            sync_etag: None,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attendee {
    pub email: String,
    pub display_name: Option<String>,
    /// "accepted" | "declined" | "tentative" | "needsAction"
    pub response_status: String,
    pub organizer: bool,
    pub self_: bool,
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEventPayload {
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub all_day: Option<bool>,
    pub recurrence_rule: Option<String>,
    pub calendar_id: Option<String>,
    pub conference_url: Option<String>,
    pub color_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateEventPayload {
    pub id: Uuid,
    pub title: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub all_day: Option<bool>,
    pub recurrence_rule: Option<String>,
    pub conference_url: Option<String>,
    pub color_id: Option<String>,
}
