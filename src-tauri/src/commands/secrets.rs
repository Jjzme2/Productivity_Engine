// ─── Secure environment variable access ──────────────────────────────────────
// Reads environment variables from the Rust process, keeping secrets out of
// the Vite-bundled frontend JavaScript.
//
// Why this exists:
// Variables prefixed with VITE_ are inlined into the client bundle by Vite,
// making them visible in browser DevTools. For secrets (R2 keys, OAuth tokens)
// we read them from the Rust process env at runtime instead.

use tauri::command;
use tracing::debug;

/// Allowed env var names that may be read from the frontend.
/// Adding a restrictive allowlist avoids arbitrary env exfiltration.
const ALLOWED_VARS: &[&str] = &[
    "R2_SECRET_ACCESS_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_BUCKET_NAME",
    "GOOGLE_CLIENT_SECRET",
    "GEMINI_API_KEY",
];

/// Read an environment variable by name. Only variables in the allowlist
/// are accessible — all others return `None` without an error.
#[command]
pub fn read_secret_env(name: String) -> Option<String> {
    if !ALLOWED_VARS.contains(&name.as_str()) {
        debug!(var = %name, "read_secret_env: blocked (not in allowlist)");
        return None;
    }
    std::env::var(&name).ok()
}
