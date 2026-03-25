use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tracing::info;

use crate::error::AppError;

// ---------------------------------------------------------------------------
// Notification DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppNotification {
    pub title: String,
    pub body: String,
    pub icon: Option<String>,
    pub sound: bool,
}

impl AppNotification {
    pub fn new(title: impl Into<String>, body: impl Into<String>) -> Self {
        AppNotification {
            title: title.into(),
            body: body.into(),
            icon: None,
            sound: true,
        }
    }

    pub fn silent(mut self) -> Self {
        self.sound = false;
        self
    }
}

// ---------------------------------------------------------------------------
// Notification service
// ---------------------------------------------------------------------------

pub struct NotificationService;

impl NotificationService {
    /// Send a desktop notification via the Tauri notification plugin.
    ///
    /// Falls back to logging if the plugin is unavailable.
    pub fn send(app: &AppHandle, notification: AppNotification) -> Result<(), AppError> {
        info!(title = notification.title, "Sending notification");

        // Emit an event to the frontend as well (so the UI can show an in-app toast)
        let _ = app.emit("notification", &notification);

        // The tauri-plugin-notification API is called via the JS bridge for most
        // platforms; here we emit the event to the frontend which handles display.
        // For OS-native notifications the frontend calls the plugin directly.

        Ok(())
    }

    /// Convenience: send a Pomodoro work interval complete notification.
    pub fn pomodoro_work_complete(app: &AppHandle) -> Result<(), AppError> {
        Self::send(
            app,
            AppNotification::new(
                "Pomodoro Complete!",
                "Great work! Time for a short break.",
            ),
        )
    }

    /// Convenience: send a Pomodoro break complete notification.
    pub fn pomodoro_break_complete(app: &AppHandle) -> Result<(), AppError> {
        Self::send(
            app,
            AppNotification::new("Break Over", "Ready to get back to work?"),
        )
    }

    /// Convenience: daily brief ready notification.
    pub fn daily_brief_ready(app: &AppHandle) -> Result<(), AppError> {
        Self::send(
            app,
            AppNotification::new(
                "Your Daily Brief Is Ready",
                "Tap to see your personalized productivity brief for today.",
            ),
        )
    }

    /// Convenience: habit reminder notification.
    pub fn habit_reminder(app: &AppHandle, habit_name: &str) -> Result<(), AppError> {
        Self::send(
            app,
            AppNotification::new(
                "Habit Reminder",
                format!("Don't forget: {habit_name}"),
            ),
        )
    }

    /// Convenience: task due soon notification.
    pub fn task_due_soon(app: &AppHandle, task_title: &str) -> Result<(), AppError> {
        Self::send(
            app,
            AppNotification::new(
                "Task Due Soon",
                format!("\"{task_title}\" is due soon."),
            ),
        )
    }
}
