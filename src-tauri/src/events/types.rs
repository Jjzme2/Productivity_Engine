use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::analytics::Suggestion;
use crate::services::ai_service::DailyBrief;
use crate::services::framework_engine::SessionSummary;

/// All domain events broadcast on the in-process event bus.
/// The `#[non_exhaustive]` attribute allows adding variants without breaking compiled
/// subscribers in the same crate.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[non_exhaustive]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AppEvent {
    // --- Task events ---
    TaskCreated { task_id: Uuid },
    TaskUpdated { task_id: Uuid },
    TaskCompleted { task_id: Uuid },
    TaskDeleted { task_id: Uuid },

    // --- Habit events ---
    HabitCreated { habit_id: Uuid },
    HabitUpdated { habit_id: Uuid },
    HabitLogged { habit_id: Uuid, date: String },

    // --- Note events ---
    NoteCreated { note_id: Uuid },
    NoteUpdated { note_id: Uuid },
    NoteDeleted { note_id: Uuid },

    // --- Calendar events ---
    CalendarEventCreated { event_id: Uuid },
    CalendarEventUpdated { event_id: Uuid },
    CalendarSyncStarted,
    CalendarSyncCompleted { events_updated: u32 },
    CalendarSyncFailed { reason: String },
    GoogleAuthCompleted,
    GoogleAuthRevoked,

    // --- Framework events ---
    FrameworkActivated { session_id: Uuid, framework_slug: String },
    FrameworkStepTransitioned { session_id: Uuid, step: String },
    FrameworkDeactivated { summary: SessionSummary },
    PomodoroIntervalCompleted { session_id: Uuid, interval: String },

    // --- AI events ---
    AiSuggestionGenerated { suggestions: Vec<Suggestion> },
    DailyBriefReady { brief: DailyBrief },
    DailyBriefRequested,

    // --- Analytics events ---
    AnalyticsUpdated,

    // --- Voice events ---
    VoiceCaptureStarted,
    VoiceCaptureStopped,
    VoiceTranscriptionReady { text: String },

    // --- Settings events ---
    SettingsUpdated,
    ApiKeyUpdated { service: String },

    // --- App lifecycle events ---
    AppReady,
    AppClosing,
}
