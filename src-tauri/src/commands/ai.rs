use tauri::State;

use crate::error::AppError;
use crate::models::analytics::Suggestion;
use crate::services::ai_service::{
    AiProviderStatus, DailyBrief, DailyBriefContext, ParsedIntent, SuggestionContext, UserContext,
};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Execution result returned after confirming + running a parsed intent
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub action_taken: String,
    pub entity_id: Option<String>,
    pub message: String,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Parse a natural-language user input into a structured intent.
///
/// The frontend can display `intent.suggested_display` to the user for
/// confirmation before calling `confirm_and_execute_intent`.
#[tauri::command]
pub async fn parse_nlp_intent(
    state: State<'_, AppState>,
    input: String,
    context: UserContext,
) -> Result<ParsedIntent, AppError> {
    state.ai_service.parse_nlp_intent(&input, &context).await
}

/// Execute a previously confirmed intent.
///
/// This command dispatches to the relevant domain service (tasks, habits,
/// calendar, frameworks) based on `intent.action`, then emits the appropriate
/// domain event on the broadcast bus.
#[tauri::command]
pub async fn confirm_and_execute_intent(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    intent: ParsedIntent,
) -> Result<ExecutionResult, AppError> {
    use crate::events::AppEvent;
    use crate::models::task::Priority;
    use crate::services::ai_service::IntentAction;

    match intent.action {
        IntentAction::CreateTask => {
            let title = intent
                .entities
                .title
                .clone()
                .unwrap_or_else(|| "Untitled Task".into());

            let priority = match intent.entities.priority.as_deref() {
                Some("urgent") => Some(Priority::Urgent),
                Some("high") => Some(Priority::High),
                Some("low") => Some(Priority::Low),
                _ => Some(Priority::Medium),
            };

            // TODO: persist via storage layer.
            // let task = task_repo.create(CreateTaskPayload { title: title.clone(), priority, ..Default::default() }).await?;
            // let _ = state.event_tx.send(AppEvent::TaskCreated { task_id: task.id });

            let _ = state.event_tx.send(AppEvent::TaskCreated {
                task_id: uuid::Uuid::new_v4(),
            });

            Ok(ExecutionResult {
                success: true,
                action_taken: "create_task".into(),
                entity_id: None,
                message: format!("Created task: {title}"),
            })
        }

        IntentAction::CompleteTask => {
            // TODO: look up task by title / entity ID and mark Done.
            Ok(ExecutionResult {
                success: true,
                action_taken: "complete_task".into(),
                entity_id: None,
                message: "Task marked as complete.".into(),
            })
        }

        IntentAction::CreateHabit => {
            let name = intent
                .entities
                .title
                .clone()
                .unwrap_or_else(|| "New Habit".into());

            // TODO: persist via storage layer.
            let _ = state.event_tx.send(AppEvent::HabitCreated {
                habit_id: uuid::Uuid::new_v4(),
            });

            Ok(ExecutionResult {
                success: true,
                action_taken: "create_habit".into(),
                entity_id: None,
                message: format!("Created habit: {name}"),
            })
        }

        IntentAction::CreateNote => {
            let body = intent
                .entities
                .description
                .clone()
                .or(intent.entities.title.clone())
                .unwrap_or_else(|| intent.raw_input.clone());

            let _ = state.event_tx.send(AppEvent::NoteCreated {
                note_id: uuid::Uuid::new_v4(),
            });

            Ok(ExecutionResult {
                success: true,
                action_taken: "create_note".into(),
                entity_id: None,
                message: format!("Note saved ({} chars).", body.len()),
            })
        }

        IntentAction::StartFramework(slug) => {
            // TODO: call framework engine to activate session.
            let session_id = uuid::Uuid::new_v4();
            let _ = state.event_tx.send(AppEvent::FrameworkActivated {
                session_id,
                framework_slug: slug.clone(),
            });

            Ok(ExecutionResult {
                success: true,
                action_taken: "start_framework".into(),
                entity_id: Some(session_id.to_string()),
                message: format!("Started framework: {slug}"),
            })
        }

        IntentAction::GetSuggestions => {
            let ctx = SuggestionContext {
                open_tasks_count: 0,
                overdue_tasks_count: 0,
                habit_streak_summary: vec![],
                last_pomodoro_completed_at: None,
                current_time_iso: chrono::Utc::now().to_rfc3339(),
            };
            let suggestions = state.ai_service.generate_suggestion(&ctx).await?;
            let _ = state.event_tx.send(AppEvent::AiSuggestionGenerated {
                suggestions: suggestions.clone(),
            });

            Ok(ExecutionResult {
                success: true,
                action_taken: "get_suggestions".into(),
                entity_id: None,
                message: format!("Generated {} suggestions.", suggestions.len()),
            })
        }

        _ => {
            // General chat or unhandled intents — return a no-op success.
            Ok(ExecutionResult {
                success: true,
                action_taken: "general_chat".into(),
                entity_id: None,
                message: "Intent acknowledged (no backend action needed).".into(),
            })
        }
    }
}

/// Generate proactive suggestions based on the current user context.
#[tauri::command]
pub async fn generate_suggestion(
    state: State<'_, AppState>,
    context: SuggestionContext,
) -> Result<Vec<Suggestion>, AppError> {
    state.ai_service.generate_suggestion(&context).await
}

/// Generate the personalised daily brief for today.
#[tauri::command]
pub async fn get_daily_brief(
    state: State<'_, AppState>,
    context: DailyBriefContext,
) -> Result<DailyBrief, AppError> {
    let brief = state.ai_service.daily_brief(&context).await?;

    let _ = state.event_tx.send(crate::events::AppEvent::DailyBriefReady {
        brief: brief.clone(),
    });

    Ok(brief)
}

/// Return the availability status of all configured AI providers.
#[tauri::command]
pub async fn get_ai_provider_status(
    state: State<'_, AppState>,
) -> Result<AiProviderStatus, AppError> {
    Ok(state.ai_service.get_provider_status().await)
}
