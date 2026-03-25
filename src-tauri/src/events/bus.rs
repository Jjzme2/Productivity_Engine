use tokio::sync::broadcast;
use tracing::{debug, warn};

use super::types::AppEvent;

// ---------------------------------------------------------------------------
// Channel capacity: how many events can be buffered before slow receivers
// start lagging. 256 is generous for a desktop app.
// ---------------------------------------------------------------------------
pub const BUS_CAPACITY: usize = 256;

/// Create a new broadcast channel for `AppEvent`s.
/// Returns `(Sender, Receiver)`.
pub fn create_bus() -> (broadcast::Sender<AppEvent>, broadcast::Receiver<AppEvent>) {
    broadcast::channel(BUS_CAPACITY)
}

/// Emit an event on the bus, logging a warning if all receivers have dropped.
pub fn emit(tx: &broadcast::Sender<AppEvent>, event: AppEvent) {
    debug!(event_type = ?std::mem::discriminant(&event), "Emitting AppEvent");
    match tx.send(event) {
        Ok(n) => debug!(receivers = n, "AppEvent delivered"),
        Err(e) => warn!("AppEvent dropped (no receivers): {e}"),
    }
}

/// Subscribe to the event bus. Returns a new `Receiver`.
pub fn subscribe(tx: &broadcast::Sender<AppEvent>) -> broadcast::Receiver<AppEvent> {
    tx.subscribe()
}
