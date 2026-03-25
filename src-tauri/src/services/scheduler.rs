use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::info;

use crate::state::SchedulerHandle;

// ---------------------------------------------------------------------------
// Scheduler
//
// Spawns three long-running Tokio background tasks:
//
// 1. calendar_sync_loop   – every 5 minutes
// 2. analytics_loop       – daily at midnight (UTC)
// 3. daily_brief_loop     – daily at 7 AM user time (stored in settings)
//
// Each loop holds an Arc<AppState> so it can reach services and emit events.
// ---------------------------------------------------------------------------

pub struct Scheduler;

impl Scheduler {
    /// Launch all background loops. Call once on app startup.
    pub fn start(state: Arc<SchedulerHandle>) {
        info!("Starting background scheduler");

        let s1 = state.clone();
        tauri::async_runtime::spawn(async move {
            Self::calendar_sync_loop(s1).await;
        });

        let s2 = state.clone();
        tauri::async_runtime::spawn(async move {
            Self::analytics_loop(s2).await;
        });

        let s3 = state.clone();
        tauri::async_runtime::spawn(async move {
            Self::daily_brief_loop(s3).await;
        });
    }

    // -----------------------------------------------------------------------
    // Calendar sync – every 5 minutes
    // -----------------------------------------------------------------------

    async fn calendar_sync_loop(state: Arc<SchedulerHandle>) {
        let mut ticker = interval(Duration::from_secs(5 * 60));
        // First tick fires immediately; skip it so we don't sync on startup.
        ticker.tick().await;

        loop {
            ticker.tick().await;
            info!("Scheduler: running calendar sync");

            // TODO: iterate over all configured calendars and call
            // state.calendar_service.sync_incremental(...).
            // For now, emit an event so the frontend knows sync ran.
            let _ = state.event_tx.send(crate::events::types::AppEvent::CalendarSyncStarted);

            // Simulated sync (replace with real calendar service call):
            // match state.calendar_service.full_sync().await {
            //     Ok(count) => {
            //         info!(count, "Calendar sync complete");
            //         let _ = state.event_tx.send(AppEvent::CalendarSyncCompleted { count });
            //     }
            //     Err(e) => {
            //         error!("Calendar sync failed: {e}");
            //         let _ = state.event_tx.send(AppEvent::CalendarSyncFailed {
            //             reason: e.to_string(),
            //         });
            //     }
            // }
        }
    }

    // -----------------------------------------------------------------------
    // Analytics – daily at midnight UTC
    // -----------------------------------------------------------------------

    async fn analytics_loop(state: Arc<SchedulerHandle>) {
        loop {
            let seconds_until_midnight = seconds_until_next_midnight_utc();
            info!(
                seconds = seconds_until_midnight,
                "Analytics loop: sleeping until midnight UTC"
            );
            tokio::time::sleep(Duration::from_secs(seconds_until_midnight)).await;

            info!("Scheduler: computing daily analytics");

            // TODO: load activity events + tasks + habits from storage, run engine.
            // let result = AnalyticsEngine::compute(&events, &habit_entries, &tasks, 7);
            // let _ = state.event_tx.send(AppEvent::AnalyticsUpdated(result));
            let _ = state.event_tx.send(crate::events::types::AppEvent::AnalyticsUpdated);
        }
    }

    // -----------------------------------------------------------------------
    // Daily brief – daily at 7 AM user local time (approximate via UTC offset)
    // -----------------------------------------------------------------------

    async fn daily_brief_loop(state: Arc<SchedulerHandle>) {
        loop {
            let settings = state.settings.read().await;
            let utc_offset_hours = settings.timezone_offset_hours;
            drop(settings);

            let seconds_until_7am = seconds_until_next_7am(utc_offset_hours);
            info!(
                seconds = seconds_until_7am,
                offset = utc_offset_hours,
                "Daily brief loop: sleeping until 7 AM user time"
            );
            tokio::time::sleep(Duration::from_secs(seconds_until_7am)).await;

            info!("Scheduler: generating daily brief");

            // TODO: build DailyBriefContext from today's tasks/events/habits, then:
            // match state.ai_service.daily_brief(&ctx).await {
            //     Ok(brief) => {
            //         let _ = state.event_tx.send(AppEvent::DailyBriefReady(brief));
            //     }
            //     Err(e) => error!("Daily brief generation failed: {e}"),
            // }
            let _ = state.event_tx.send(crate::events::types::AppEvent::DailyBriefRequested);
        }
    }
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/// Returns the number of seconds until the next 00:00 UTC.
fn seconds_until_next_midnight_utc() -> u64 {
    let now = chrono::Utc::now();
    let tomorrow_midnight = (now.date_naive() + chrono::Duration::days(1))
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc();
    (tomorrow_midnight - now).num_seconds().max(0) as u64
}

/// Returns seconds until the next occurrence of 07:00 in the user's timezone
/// (approximated as UTC + offset_hours).
fn seconds_until_next_7am(utc_offset_hours: i32) -> u64 {
    let now_utc = chrono::Utc::now();
    let offset_secs = utc_offset_hours as i64 * 3600;
    let local_now_secs = now_utc.timestamp() + offset_secs;

    let secs_since_local_midnight = local_now_secs % 86400;
    let target_secs = 7 * 3600i64; // 07:00:00

    let delta = if secs_since_local_midnight < target_secs {
        target_secs - secs_since_local_midnight
    } else {
        86400 - secs_since_local_midnight + target_secs
    };

    delta.max(0) as u64
}
