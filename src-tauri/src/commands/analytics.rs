use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::analytics::{
    ActivityEvent, ActivityEventType, CompletionStats, ProductivityScore, Suggestion, UserInsights,
    WeeklySummary,
};
use crate::services::analytics_engine::AnalyticsEngine;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsightsRequest {
    pub window_days: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEventPayload {
    pub event_type: ActivityEventType,
    pub entity_id: Option<Uuid>,
    pub meta: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Compute and return full user insights for the requested time window.
#[tauri::command]
pub async fn get_user_insights(
    state: State<'_, AppState>,
    request: InsightsRequest,
) -> Result<UserInsights, AppError> {
    let window = request.window_days.unwrap_or(7);

    // TODO: load real events/habits/tasks from persistence layer.
    let events: Vec<ActivityEvent> = vec![];
    let habit_entries: Vec<crate::models::habit::HabitEntry> = vec![];
    let tasks: Vec<crate::models::task::Task> = vec![];

    let result = AnalyticsEngine::compute(&events, &habit_entries, &tasks, window);

    // Run AI shortcoming analysis on the computed stats
    let analysis = state
        .ai_service
        .analyze_shortcomings(&result.stats)
        .await
        .unwrap_or_else(|e| {
            tracing::warn!("AI analysis failed: {e}; returning empty analysis");
            crate::services::ai_service::AnalysisReport {
                shortcomings: vec![],
                strengths: vec![],
                summary: String::new(),
                provider_used: "none".into(),
            }
        });

    Ok(UserInsights {
        generated_at: chrono::Utc::now(),
        productivity_score: result.productivity_score,
        shortcomings: analysis.shortcomings,
        strengths: analysis.strengths,
        suggestions: vec![],
        heatmap: result.heatmap,
        completion_stats: result.completion_stats,
    })
}

/// Trigger an explicit AI shortcoming analysis on the latest analytics data.
#[tauri::command]
pub async fn run_shortcoming_analysis(
    state: State<'_, AppState>,
    window_days: Option<u32>,
) -> Result<crate::services::ai_service::AnalysisReport, AppError> {
    let window = window_days.unwrap_or(7);

    // TODO: load real data.
    let events: Vec<ActivityEvent> = vec![];
    let habit_entries: Vec<crate::models::habit::HabitEntry> = vec![];
    let tasks: Vec<crate::models::task::Task> = vec![];

    let result = AnalyticsEngine::compute(&events, &habit_entries, &tasks, window);
    state.ai_service.analyze_shortcomings(&result.stats).await
}

/// Return the current productivity score.
#[tauri::command]
pub async fn get_productivity_score(
    state: State<'_, AppState>,
    window_days: Option<u32>,
) -> Result<ProductivityScore, AppError> {
    let window = window_days.unwrap_or(7);

    let events: Vec<ActivityEvent> = vec![];
    let habit_entries: Vec<crate::models::habit::HabitEntry> = vec![];
    let tasks: Vec<crate::models::task::Task> = vec![];

    let result = AnalyticsEngine::compute(&events, &habit_entries, &tasks, window);
    Ok(result.productivity_score)
}

/// Return completion statistics for the requested time window.
#[tauri::command]
pub async fn get_completion_stats(
    _state: State<'_, AppState>,
    window_days: Option<u32>,
) -> Result<CompletionStats, AppError> {
    let window = window_days.unwrap_or(7);

    let events: Vec<ActivityEvent> = vec![];
    let habit_entries: Vec<crate::models::habit::HabitEntry> = vec![];
    let tasks: Vec<crate::models::task::Task> = vec![];

    let result = AnalyticsEngine::compute(&events, &habit_entries, &tasks, window);
    Ok(result.completion_stats)
}

/// Return a weekly summary for the most recently completed week.
#[tauri::command]
pub async fn get_weekly_summary(
    state: State<'_, AppState>,
) -> Result<WeeklySummary, AppError> {
    let events: Vec<ActivityEvent> = vec![];
    let habit_entries: Vec<crate::models::habit::HabitEntry> = vec![];
    let tasks: Vec<crate::models::task::Task> = vec![];

    let result = AnalyticsEngine::compute(&events, &habit_entries, &tasks, 7);

    let analysis = state
        .ai_service
        .analyze_shortcomings(&result.stats)
        .await
        .unwrap_or_else(|_| crate::services::ai_service::AnalysisReport {
            shortcomings: vec![],
            strengths: vec![],
            summary: String::new(),
            provider_used: "none".into(),
        });

    let today = chrono::Utc::now().date_naive();
    let week_end = today;
    let week_start = today - chrono::Duration::days(6);

    Ok(WeeklySummary {
        week_start,
        week_end,
        completion_stats: result.completion_stats,
        productivity_score: result.productivity_score,
        top_strengths: analysis.strengths.into_iter().take(3).collect(),
        top_shortcomings: analysis.shortcomings.into_iter().take(3).collect(),
        highlight: analysis.summary,
        generated_at: chrono::Utc::now(),
    })
}

/// Append a single activity event to the log.
#[tauri::command]
pub async fn log_activity_event(
    _state: State<'_, AppState>,
    payload: LogEventPayload,
) -> Result<ActivityEvent, AppError> {
    let mut event = ActivityEvent::new(payload.event_type);
    if let Some(id) = payload.entity_id {
        event = event.with_entity(id);
    }
    if let Some(meta) = payload.meta {
        event = event.with_meta(meta);
    }

    // TODO: persist to storage.
    tracing::debug!(event_type = ?event.event_type, "Activity event logged");

    Ok(event)
}
