// ─── Frontend error forwarding ───────────────────────────────────────────────
// Lets the Vue frontend forward JavaScript errors into the Rust tracing log so
// they end up in the rolling log file alongside Rust-side events.

use tauri::command;

/// Log a message from the frontend into the Rust tracing subscriber.
///
/// `level`   – "error" | "warn" | "info" (anything else → info)
/// `message` – human-readable error string or console.error argument
/// `context` – optional serialised JSON with extra fields (stack trace, etc.)
#[command]
pub fn log_frontend_error(level: String, message: String, context: Option<String>) {
    match level.as_str() {
        "error" => tracing::error!(source = "frontend", context = ?context, "{}", message),
        "warn"  => tracing::warn! (source = "frontend", context = ?context, "{}", message),
        _       => tracing::info! (source = "frontend", context = ?context, "{}", message),
    }
}
