use chrono::Utc;
use serde_json::Value as JsonValue;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::framework::{
    Framework, FrameworkDefinition, FrameworkSession, FrameworkSlug, FrameworkState, FrameworkStep,
    FrameworkType, PomodoroInterval, PomodoroState,
};

// ---------------------------------------------------------------------------
// Built-in framework definitions (seeded as const JSON strings)
// ---------------------------------------------------------------------------

const POMODORO_DEF: &str = r#"{
  "slug": "pomodoro",
  "name": "Pomodoro Technique",
  "description": "25-minute focused work intervals separated by short breaks.",
  "version": "1.0.0",
  "initial_step": "work",
  "steps": [
    {
      "id": "work",
      "label": "Work Interval",
      "description": "Focus on your task for 25 minutes.",
      "duration_secs": 1500,
      "next_steps": ["short_break", "long_break"],
      "meta": { "pomodoro_type": "work" }
    },
    {
      "id": "short_break",
      "label": "Short Break",
      "description": "Rest for 5 minutes.",
      "duration_secs": 300,
      "next_steps": ["work"],
      "meta": { "pomodoro_type": "short_break" }
    },
    {
      "id": "long_break",
      "label": "Long Break",
      "description": "Rest for 15 minutes after 4 pomodoros.",
      "duration_secs": 900,
      "next_steps": ["work"],
      "meta": { "pomodoro_type": "long_break" }
    }
  ],
  "config_schema": {
    "work_mins": { "type": "integer", "default": 25, "min": 5, "max": 90 },
    "short_break_mins": { "type": "integer", "default": 5, "min": 1, "max": 30 },
    "long_break_mins": { "type": "integer", "default": 15, "min": 5, "max": 60 },
    "long_break_after": { "type": "integer", "default": 4, "min": 2, "max": 8 }
  }
}"#;

const DAILY6_DEF: &str = r#"{
  "slug": "daily6",
  "name": "Daily 6 (Eat the Frog)",
  "description": "Choose 6 tasks in priority order each morning; work through them in sequence.",
  "version": "1.0.0",
  "initial_step": "select_tasks",
  "steps": [
    {
      "id": "select_tasks",
      "label": "Select 6 Tasks",
      "description": "Pick up to 6 tasks for today, ordered by priority.",
      "duration_secs": null,
      "next_steps": ["work_task"],
      "meta": {}
    },
    {
      "id": "work_task",
      "label": "Work on Task",
      "description": "Focus on the next task in your list.",
      "duration_secs": null,
      "next_steps": ["complete_task", "skip_task"],
      "meta": {}
    },
    {
      "id": "complete_task",
      "label": "Task Complete",
      "description": "Mark the task as done and move to the next.",
      "duration_secs": null,
      "next_steps": ["work_task", "session_complete"],
      "meta": {}
    },
    {
      "id": "skip_task",
      "label": "Skip Task",
      "description": "Move this task to tomorrow and continue.",
      "duration_secs": null,
      "next_steps": ["work_task", "session_complete"],
      "meta": {}
    },
    {
      "id": "session_complete",
      "label": "Session Complete",
      "description": "All tasks addressed. Great work!",
      "duration_secs": null,
      "next_steps": [],
      "meta": {}
    }
  ],
  "config_schema": {}
}"#;

const GTD_DEF: &str = r#"{
  "slug": "gtd",
  "name": "Getting Things Done (GTD)",
  "description": "Capture, clarify, organise, reflect, and engage.",
  "version": "1.0.0",
  "initial_step": "capture",
  "steps": [
    {
      "id": "capture",
      "label": "Capture",
      "description": "Get everything out of your head into the inbox.",
      "duration_secs": null,
      "next_steps": ["clarify"],
      "meta": {}
    },
    {
      "id": "clarify",
      "label": "Clarify",
      "description": "Process each inbox item: is it actionable?",
      "duration_secs": null,
      "next_steps": ["organise"],
      "meta": {}
    },
    {
      "id": "organise",
      "label": "Organise",
      "description": "File items into projects, next-actions, someday lists.",
      "duration_secs": null,
      "next_steps": ["reflect"],
      "meta": {}
    },
    {
      "id": "reflect",
      "label": "Reflect",
      "description": "Weekly review: ensure lists are current.",
      "duration_secs": null,
      "next_steps": ["engage"],
      "meta": {}
    },
    {
      "id": "engage",
      "label": "Engage",
      "description": "Do the work.",
      "duration_secs": null,
      "next_steps": ["capture"],
      "meta": {}
    }
  ],
  "config_schema": {}
}"#;

const TIME_BLOCKING_DEF: &str = r#"{
  "slug": "time_blocking",
  "name": "Time Blocking",
  "description": "Assign every hour of the day a dedicated task or theme.",
  "version": "1.0.0",
  "initial_step": "plan",
  "steps": [
    {
      "id": "plan",
      "label": "Plan Blocks",
      "description": "Fill your calendar with time blocks for each task.",
      "duration_secs": null,
      "next_steps": ["execute_block"],
      "meta": {}
    },
    {
      "id": "execute_block",
      "label": "Execute Block",
      "description": "Work exclusively on the scheduled task.",
      "duration_secs": null,
      "next_steps": ["block_review", "execute_block"],
      "meta": {}
    },
    {
      "id": "block_review",
      "label": "Block Review",
      "description": "How did the block go? Adjust tomorrow if needed.",
      "duration_secs": null,
      "next_steps": ["execute_block", "plan"],
      "meta": {}
    }
  ],
  "config_schema": {
    "block_duration_mins": { "type": "integer", "default": 90, "min": 15, "max": 240 }
  }
}"#;

// ---------------------------------------------------------------------------
// Session action (user-driven event passed to `tick`)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FrameworkAction {
    /// Advance to the next logical step
    Advance,
    /// Explicitly transition to a named step
    GoTo { step_id: String },
    /// Tick elapsed time (seconds since last tick)
    Elapsed { seconds: u64 },
    /// Complete the current task in context (Daily6, GTD)
    CompleteTask { task_id: Uuid },
    /// Skip the current task
    SkipTask { task_id: Uuid },
    /// User paused the session
    Pause,
    /// User resumed after a pause
    Resume,
}

// ---------------------------------------------------------------------------
// Session summary (returned when a session ends)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionSummary {
    pub session_id: Uuid,
    pub framework_slug: FrameworkSlug,
    pub duration_secs: u64,
    pub completed_task_ids: Vec<Uuid>,
    pub skipped_task_ids: Vec<Uuid>,
    pub pomodoros_completed: u32,
    pub ended_at: chrono::DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// FrameworkEngine
// ---------------------------------------------------------------------------

pub struct FrameworkEngine;

impl FrameworkEngine {
    /// Parse the built-in framework JSON seeds and return Framework records.
    pub fn load_builtin_frameworks() -> Vec<Framework> {
        let defs = [POMODORO_DEF, DAILY6_DEF, GTD_DEF, TIME_BLOCKING_DEF];
        defs.iter()
            .filter_map(|src| {
                match serde_json::from_str::<FrameworkDefinition>(src) {
                    Ok(def) => {
                        info!(slug = def.slug.as_str(), "Loaded built-in framework");
                        Some(Framework::new(def, FrameworkType::Builtin))
                    }
                    Err(e) => {
                        warn!("Failed to parse built-in framework: {e}");
                        None
                    }
                }
            })
            .collect()
    }

    /// Start a new session for the given framework, optionally pre-loading task IDs.
    pub fn activate(
        framework: &Framework,
        task_ids: Vec<Uuid>,
        config: Option<JsonValue>,
    ) -> Result<FrameworkSession, AppError> {
        let def = &framework.definition;
        let initial_step = def
            .steps
            .iter()
            .find(|s| s.id == def.initial_step)
            .ok_or_else(|| {
                AppError::Framework(format!(
                    "Initial step '{}' not found in framework '{}'",
                    def.initial_step,
                    def.slug.as_str()
                ))
            })?;

        // Build Pomodoro-specific state if applicable
        let pomodoro = if framework.definition.slug == FrameworkSlug::Pomodoro {
            let mut ps = PomodoroState::default();
            if let Some(cfg) = &config {
                if let Some(w) = cfg["work_mins"].as_u64() {
                    ps.work_secs = w * 60;
                }
                if let Some(s) = cfg["short_break_mins"].as_u64() {
                    ps.short_break_secs = s * 60;
                }
                if let Some(l) = cfg["long_break_mins"].as_u64() {
                    ps.long_break_secs = l * 60;
                }
                if let Some(n) = cfg["long_break_after"].as_u64() {
                    ps.long_break_after = n as u32;
                }
            }
            Some(ps)
        } else {
            None
        };

        let now = Utc::now();
        let state = FrameworkState {
            current_step: initial_step.id.clone(),
            step_started_at: now,
            elapsed_secs: 0,
            pomodoro,
            context: serde_json::json!({
                "task_index": 0,
                "completed_task_ids": [],
                "skipped_task_ids": []
            }),
        };

        Ok(FrameworkSession {
            id: Uuid::new_v4(),
            framework_id: framework.id,
            framework_slug: framework.definition.slug.clone(),
            task_ids,
            state,
            started_at: now,
            ended_at: None,
            config,
        })
    }

    /// Process a user action against the current session state, returning the updated state.
    pub fn tick(
        session: &mut FrameworkSession,
        framework: &Framework,
        action: FrameworkAction,
    ) -> Result<FrameworkState, AppError> {
        debug!(
            session_id = %session.id,
            step = session.state.current_step,
            action = ?action,
            "Framework tick"
        );

        match action {
            FrameworkAction::Elapsed { seconds } => {
                session.state.elapsed_secs += seconds;

                // Auto-advance Pomodoro when timer expires
                if let Some(pom) = &mut session.state.pomodoro {
                    let target = match pom.interval {
                        PomodoroInterval::Work => pom.work_secs,
                        PomodoroInterval::ShortBreak => pom.short_break_secs,
                        PomodoroInterval::LongBreak => pom.long_break_secs,
                    };

                    if session.state.elapsed_secs >= target {
                        // Transition Pomodoro interval
                        let next_interval = match pom.interval {
                            PomodoroInterval::Work => {
                                pom.completed_intervals += 1;
                                if pom.completed_intervals % pom.long_break_after == 0 {
                                    PomodoroInterval::LongBreak
                                } else {
                                    PomodoroInterval::ShortBreak
                                }
                            }
                            PomodoroInterval::ShortBreak | PomodoroInterval::LongBreak => {
                                PomodoroInterval::Work
                            }
                        };

                        pom.interval = next_interval.clone();
                        session.state.current_step = match next_interval {
                            PomodoroInterval::Work => "work".to_string(),
                            PomodoroInterval::ShortBreak => "short_break".to_string(),
                            PomodoroInterval::LongBreak => "long_break".to_string(),
                        };
                        session.state.step_started_at = Utc::now();
                        session.state.elapsed_secs = 0;
                    }
                }
            }

            FrameworkAction::Advance => {
                let current_step = Self::find_step(framework, &session.state.current_step)?;
                let next_id = current_step.next_steps.first().ok_or_else(|| {
                    AppError::Framework("Current step has no next steps (terminal state)".into())
                })?;
                Self::transition_to(session, next_id);
            }

            FrameworkAction::GoTo { step_id } => {
                // Validate the step exists before transitioning
                Self::find_step(framework, &step_id)?;
                Self::transition_to(session, &step_id);
            }

            FrameworkAction::CompleteTask { task_id } => {
                let completed = session
                    .state
                    .context["completed_task_ids"]
                    .as_array()
                    .map(|a| {
                        let mut v = a.clone();
                        v.push(serde_json::json!(task_id.to_string()));
                        v
                    })
                    .unwrap_or_else(|| vec![serde_json::json!(task_id.to_string())]);

                session.state.context["completed_task_ids"] = serde_json::Value::Array(completed);

                // Advance task index for Daily6
                let idx = session.state.context["task_index"]
                    .as_u64()
                    .unwrap_or(0) as usize;
                let next_idx = idx + 1;

                if next_idx >= session.task_ids.len() {
                    // All tasks done
                    Self::transition_to(session, "session_complete");
                } else {
                    session.state.context["task_index"] = serde_json::json!(next_idx);
                    Self::transition_to(session, "work_task");
                }
            }

            FrameworkAction::SkipTask { task_id } => {
                let skipped = session
                    .state
                    .context["skipped_task_ids"]
                    .as_array()
                    .map(|a| {
                        let mut v = a.clone();
                        v.push(serde_json::json!(task_id.to_string()));
                        v
                    })
                    .unwrap_or_else(|| vec![serde_json::json!(task_id.to_string())]);

                session.state.context["skipped_task_ids"] = serde_json::Value::Array(skipped);

                let idx = session.state.context["task_index"]
                    .as_u64()
                    .unwrap_or(0) as usize;
                let next_idx = idx + 1;

                if next_idx >= session.task_ids.len() {
                    Self::transition_to(session, "session_complete");
                } else {
                    session.state.context["task_index"] = serde_json::json!(next_idx);
                    Self::transition_to(session, "work_task");
                }
            }

            FrameworkAction::Pause => {
                session.state.context["paused"] = serde_json::json!(true);
                session.state.context["paused_at"] =
                    serde_json::json!(Utc::now().to_rfc3339());
            }

            FrameworkAction::Resume => {
                session.state.context["paused"] = serde_json::json!(false);
            }
        }

        Ok(session.state.clone())
    }

    /// End the session and produce a summary.
    pub fn deactivate(session: &mut FrameworkSession) -> SessionSummary {
        let now = Utc::now();
        session.ended_at = Some(now);

        let duration_secs = (now - session.started_at).num_seconds().max(0) as u64;

        let completed_task_ids: Vec<Uuid> = session
            .state
            .context["completed_task_ids"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().and_then(|s| Uuid::parse_str(s).ok()))
                    .collect()
            })
            .unwrap_or_default();

        let skipped_task_ids: Vec<Uuid> = session
            .state
            .context["skipped_task_ids"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().and_then(|s| Uuid::parse_str(s).ok()))
                    .collect()
            })
            .unwrap_or_default();

        let pomodoros_completed = session
            .state
            .pomodoro
            .as_ref()
            .map(|p| p.completed_intervals)
            .unwrap_or(0);

        info!(
            session_id = %session.id,
            duration_secs,
            pomodoros_completed,
            "Framework session deactivated"
        );

        SessionSummary {
            session_id: session.id,
            framework_slug: session.framework_slug.clone(),
            duration_secs,
            completed_task_ids,
            skipped_task_ids,
            pomodoros_completed,
            ended_at: now,
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn find_step<'a>(
        framework: &'a Framework,
        step_id: &str,
    ) -> Result<&'a FrameworkStep, AppError> {
        framework
            .definition
            .steps
            .iter()
            .find(|s| s.id == step_id)
            .ok_or_else(|| AppError::Framework(format!("Step '{step_id}' not found")))
    }

    fn transition_to(session: &mut FrameworkSession, step_id: &str) {
        debug!(
            from = session.state.current_step,
            to = step_id,
            "Transitioning framework step"
        );
        session.state.current_step = step_id.to_string();
        session.state.step_started_at = Utc::now();
        session.state.elapsed_secs = 0;
    }
}
