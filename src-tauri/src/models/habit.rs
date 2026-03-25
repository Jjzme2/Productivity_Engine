use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HabitStatus {
    Done,
    Skipped,
    Missed,
    Partial,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HabitFrequency {
    Daily,
    /// Monday – Friday only
    Weekdays,
    /// Once per week (on a chosen day)
    Weekly,
    /// User-defined days-of-week bitmask (bit 0 = Monday … bit 6 = Sunday)
    Custom { days_mask: u8 },
}

impl Default for HabitFrequency {
    fn default() -> Self {
        HabitFrequency::Daily
    }
}

// ---------------------------------------------------------------------------
// Core model
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Habit {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub frequency: HabitFrequency,
    pub color: Option<String>,
    pub icon: Option<String>,

    /// Target completions per period (e.g. 1 for "do once per day", 8 for "drink 8 glasses")
    pub target_count: u32,
    /// Unit label shown in the UI (e.g. "glasses", "km", "reps")
    pub unit: Option<String>,

    pub archived: bool,
    pub tags: Vec<String>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Habit {
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Habit {
            id: Uuid::new_v4(),
            name: name.into(),
            description: None,
            frequency: HabitFrequency::default(),
            color: None,
            icon: None,
            target_count: 1,
            unit: None,
            archived: false,
            tags: vec![],
            created_at: now,
            updated_at: now,
        }
    }
}

// ---------------------------------------------------------------------------
// Journal entry (one check-in for a habit on a specific date)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitEntry {
    pub id: Uuid,
    pub habit_id: Uuid,
    /// Calendar date the entry belongs to (no time component needed)
    pub date: NaiveDate,
    pub status: HabitStatus,
    /// Actual count completed (meaningful when target_count > 1)
    pub count: u32,
    pub note: Option<String>,
    pub logged_at: DateTime<Utc>,
}

impl HabitEntry {
    pub fn new(habit_id: Uuid, date: NaiveDate, status: HabitStatus) -> Self {
        HabitEntry {
            id: Uuid::new_v4(),
            habit_id,
            date,
            status,
            count: 0,
            note: None,
            logged_at: Utc::now(),
        }
    }
}

// ---------------------------------------------------------------------------
// Streak helpers
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreakData {
    pub habit_id: Uuid,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub total_completions: u32,
    pub completion_rate_30d: f32,
    pub last_completed: Option<NaiveDate>,
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHabitPayload {
    pub name: String,
    pub description: Option<String>,
    pub frequency: Option<HabitFrequency>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub target_count: Option<u32>,
    pub unit: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateHabitPayload {
    pub id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    pub frequency: Option<HabitFrequency>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub target_count: Option<u32>,
    pub unit: Option<String>,
    pub archived: Option<bool>,
    pub tags: Option<Vec<String>>,
}
