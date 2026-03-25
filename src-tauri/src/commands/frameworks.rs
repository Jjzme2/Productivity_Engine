use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::framework::{Framework, FrameworkDefinition, FrameworkSession, FrameworkState, FrameworkType};
use crate::services::framework_engine::{FrameworkAction, FrameworkEngine, SessionSummary};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// In-memory session store (keyed by session ID)
// ---------------------------------------------------------------------------

/// Shared mutable store of active framework sessions.
/// Managed separately from AppState because sessions are transient.
pub struct SessionStore(pub Mutex<std::collections::HashMap<Uuid, (FrameworkSession, Framework)>>);

impl SessionStore {
    pub fn new() -> Self {
        SessionStore(Mutex::new(std::collections::HashMap::new()))
    }
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateFrameworkPayload {
    pub framework_id: Uuid,
    pub task_ids: Vec<Uuid>,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickPayload {
    pub session_id: Uuid,
    pub action: FrameworkAction,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Return all available frameworks (built-ins + any user-defined ones).
#[tauri::command]
pub async fn get_frameworks() -> Result<Vec<Framework>, AppError> {
    Ok(FrameworkEngine::load_builtin_frameworks())
}

/// Return the currently active framework session, if any.
#[tauri::command]
pub fn get_active_framework(
    sessions: State<'_, SessionStore>,
) -> Result<Option<FrameworkSession>, AppError> {
    let store = sessions
        .0
        .lock()
        .map_err(|_| AppError::Framework("Failed to lock session store".into()))?;

    // Return the first active session (there should only ever be one at a time)
    Ok(store.values().next().map(|(s, _)| s.clone()))
}

/// Activate a framework and start a new session.
#[tauri::command]
pub async fn activate_framework(
    state: State<'_, AppState>,
    sessions: State<'_, SessionStore>,
    payload: ActivateFrameworkPayload,
) -> Result<FrameworkSession, AppError> {
    // Deactivate any existing session first
    {
        let mut store = sessions
            .0
            .lock()
            .map_err(|_| AppError::Framework("Failed to lock session store".into()))?;
        store.clear();
    }

    // Load the framework definition
    let frameworks = FrameworkEngine::load_builtin_frameworks();
    let framework = frameworks
        .into_iter()
        .find(|f| f.id == payload.framework_id)
        .ok_or_else(|| AppError::NotFound(format!("Framework {} not found", payload.framework_id)))?;

    let session = FrameworkEngine::activate(&framework, payload.task_ids, payload.config)?;

    let _ = state.event_tx.send(crate::events::AppEvent::FrameworkActivated {
        session_id: session.id,
        framework_slug: framework.definition.slug.as_str().to_string(),
    });

    tracing::info!(session_id = %session.id, slug = framework.definition.slug.as_str(), "Framework activated");

    let result = session.clone();

    {
        let mut store = sessions
            .0
            .lock()
            .map_err(|_| AppError::Framework("Failed to lock session store".into()))?;
        store.insert(session.id, (session, framework));
    }

    Ok(result)
}

/// Deactivate the current session and return a summary.
#[tauri::command]
pub async fn deactivate_framework(
    state: State<'_, AppState>,
    sessions: State<'_, SessionStore>,
    session_id: Uuid,
) -> Result<SessionSummary, AppError> {
    let mut store = sessions
        .0
        .lock()
        .map_err(|_| AppError::Framework("Failed to lock session store".into()))?;

    let (mut session, _framework) = store
        .remove(&session_id)
        .ok_or_else(|| AppError::NotFound(format!("Session {session_id} not found")))?;

    let summary = FrameworkEngine::deactivate(&mut session);

    let _ = state.event_tx.send(crate::events::AppEvent::FrameworkDeactivated {
        summary: summary.clone(),
    });

    Ok(summary)
}

/// Advance the framework session state machine.
#[tauri::command]
pub async fn tick_framework(
    state: State<'_, AppState>,
    sessions: State<'_, SessionStore>,
    payload: TickPayload,
) -> Result<FrameworkState, AppError> {
    let mut store = sessions
        .0
        .lock()
        .map_err(|_| AppError::Framework("Failed to lock session store".into()))?;

    let (session, framework) = store
        .get_mut(&payload.session_id)
        .ok_or_else(|| AppError::NotFound(format!("Session {} not found", payload.session_id)))?;

    let new_state = FrameworkEngine::tick(session, framework, payload.action)?;

    let _ = state
        .event_tx
        .send(crate::events::AppEvent::FrameworkStepTransitioned {
            session_id: payload.session_id,
            step: new_state.current_step.clone(),
        });

    Ok(new_state)
}

/// Create a new custom framework from a user-supplied definition.
#[tauri::command]
pub async fn create_custom_framework(
    definition: FrameworkDefinition,
) -> Result<Framework, AppError> {
    // TODO: persist to storage.
    Ok(Framework::new(definition, FrameworkType::Custom))
}

/// Update an existing custom framework definition.
#[tauri::command]
pub async fn update_custom_framework(
    id: Uuid,
    definition: FrameworkDefinition,
) -> Result<Framework, AppError> {
    // TODO: update in storage.
    let mut f = Framework::new(definition, FrameworkType::Custom);
    f.id = id;
    f.updated_at = chrono::Utc::now();
    Ok(f)
}

/// Delete a custom framework.
#[tauri::command]
pub async fn delete_custom_framework(id: Uuid) -> Result<(), AppError> {
    // TODO: delete from storage and verify it is not a built-in.
    tracing::info!(framework_id = %id, "Custom framework deleted");
    Ok(())
}
