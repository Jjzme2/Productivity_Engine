use chrono::{Datelike, NaiveDate, Timelike, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::debug;

use crate::models::analytics::{
    ActivityEvent, ActivityEventType, CompletionStats, ProductivityScore,
    ScoreTrend, TimeOfDayHeatmap,
};
use crate::models::habit::HabitEntry;
use crate::models::task::{Task, TaskStatus};
use crate::services::ai_service::AnalyticsStats;

// ---------------------------------------------------------------------------
// Output of the engine
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsResult {
    pub stats: AnalyticsStats,
    pub completion_stats: CompletionStats,
    pub productivity_score: ProductivityScore,
    pub heatmap: TimeOfDayHeatmap,
    pub computed_at: chrono::DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

pub struct AnalyticsEngine;

impl AnalyticsEngine {
    /// Primary entry point.
    ///
    /// # Arguments
    /// * `events`  – raw activity log for the analysis window
    /// * `habits`  – habit entries for the same window
    /// * `tasks`   – all tasks (completed + open) to assess
    /// * `window`  – number of days to analyse (default analysis window)
    pub fn compute(
        events: &[ActivityEvent],
        habit_entries: &[HabitEntry],
        tasks: &[Task],
        window_days: u32,
    ) -> AnalyticsResult {
        let now = Utc::now();
        let period_end = now.date_naive();
        let period_start = period_end - chrono::Duration::days(window_days as i64);

        debug!(
            window_days,
            events = events.len(),
            habits = habit_entries.len(),
            tasks = tasks.len(),
            "Computing analytics"
        );

        // ---- Task stats ----
        let window_tasks: Vec<&Task> = tasks
            .iter()
            .filter(|t| t.created_at.date_naive() >= period_start)
            .collect();

        let tasks_created = window_tasks.len() as u32;

        let tasks_completed = window_tasks
            .iter()
            .filter(|t| t.status == TaskStatus::Done)
            .count() as u32;

        let tasks_cancelled = window_tasks
            .iter()
            .filter(|t| t.status == TaskStatus::Cancelled)
            .count() as u32;

        let completion_rate = if tasks_created > 0 {
            tasks_completed as f32 / tasks_created as f32
        } else {
            0.0
        };

        let tasks_overdue = tasks
            .iter()
            .filter(|t| {
                t.status != TaskStatus::Done
                    && t.status != TaskStatus::Cancelled
                    && t.due_date
                        .map(|d| d < now)
                        .unwrap_or(false)
            })
            .count() as u32;

        // ---- Habit stats ----
        let window_habit_entries: Vec<&HabitEntry> = habit_entries
            .iter()
            .filter(|e| e.date >= period_start)
            .collect();

        let habits_due = window_habit_entries.len() as u32;
        let habits_completed = window_habit_entries
            .iter()
            .filter(|e| matches!(e.status, crate::models::habit::HabitStatus::Done))
            .count() as u32;

        let habit_adherence_rate = if habits_due > 0 {
            habits_completed as f32 / habits_due as f32
        } else {
            0.0
        };

        // ---- Pomodoro / focus stats ----
        let pomodoros_completed = events
            .iter()
            .filter(|e| {
                e.event_type == ActivityEventType::PomodoroCompleted
                    && e.occurred_at.date_naive() >= period_start
            })
            .count() as u32;

        let focus_minutes_7d = pomodoros_completed * 25; // default 25 min intervals

        // ---- Time-of-day heatmap ----
        let heatmap = Self::build_heatmap(events, period_start);

        // ---- Consistency score (normalised inverse std-dev of daily completions) ----
        let consistency_score = Self::compute_consistency(events, period_start, window_days);

        // ---- Completion score (normalised) ----
        let completion_score = (completion_rate * 100.0).min(100.0);

        // ---- Focus score (pomodoros per day, normalised, cap at 8/day as ideal) ----
        let ideal_pomodoros_per_window = 8.0 * window_days as f32;
        let focus_score =
            (pomodoros_completed as f32 / ideal_pomodoros_per_window * 100.0).min(100.0);

        let habit_adherence_score = habit_adherence_rate * 100.0;

        let overall = (completion_score * 0.35
            + focus_score * 0.25
            + consistency_score * 0.20
            + habit_adherence_score * 0.20)
            .min(100.0);

        // Determine trend: compare first-half vs second-half completion rates
        let mid = period_start + chrono::Duration::days(window_days as i64 / 2);
        let first_half_completions = tasks
            .iter()
            .filter(|t| {
                t.status == TaskStatus::Done
                    && t.completed_at
                        .map(|c| {
                            let d = c.date_naive();
                            d >= period_start && d < mid
                        })
                        .unwrap_or(false)
            })
            .count();
        let second_half_completions = tasks
            .iter()
            .filter(|t| {
                t.status == TaskStatus::Done
                    && t.completed_at
                        .map(|c| c.date_naive() >= mid)
                        .unwrap_or(false)
            })
            .count();

        let trend = if second_half_completions > first_half_completions {
            ScoreTrend::Improving
        } else if second_half_completions < first_half_completions {
            ScoreTrend::Declining
        } else {
            ScoreTrend::Stable
        };

        let productivity_score = ProductivityScore {
            overall,
            focus_score,
            consistency_score,
            completion_score,
            habit_adherence_score,
            trend,
        };

        let completion_stats = CompletionStats {
            period_start,
            period_end,
            tasks_created,
            tasks_completed,
            tasks_cancelled,
            completion_rate,
            habits_due,
            habits_completed,
            habit_adherence_rate,
            pomodoro_sessions_completed: pomodoros_completed,
            total_focus_minutes: focus_minutes_7d,
        };

        let analytics_stats = AnalyticsStats {
            tasks_completed_7d: tasks_completed,
            tasks_overdue,
            habit_adherence_rate,
            focus_minutes_7d,
            pomodoros_completed_7d: pomodoros_completed,
            consistency_score,
            completion_rate_7d: completion_rate,
            peak_hour: heatmap.peak_hour,
        };

        AnalyticsResult {
            stats: analytics_stats,
            completion_stats,
            productivity_score,
            heatmap,
            computed_at: now,
        }
    }

    // -----------------------------------------------------------------------
    // Heatmap builder
    // -----------------------------------------------------------------------

    fn build_heatmap(events: &[ActivityEvent], since: NaiveDate) -> TimeOfDayHeatmap {
        let mut counts = [0u32; 24];

        for event in events.iter().filter(|e| e.occurred_at.date_naive() >= since) {
            let hour = event.occurred_at.hour() as usize;
            counts[hour] = counts[hour].saturating_add(1);
        }

        let max = *counts.iter().max().unwrap_or(&1).max(&1) as f32;
        let mut hours = [0.0f32; 24];
        for (i, &c) in counts.iter().enumerate() {
            hours[i] = c as f32 / max;
        }

        let peak_hour = counts
            .iter()
            .enumerate()
            .max_by_key(|(_, &c)| c)
            .map(|(i, _)| i as u8)
            .unwrap_or(9);

        let trough_hour = counts
            .iter()
            .enumerate()
            .min_by_key(|(_, &c)| c)
            .map(|(i, _)| i as u8)
            .unwrap_or(3);

        TimeOfDayHeatmap {
            hours,
            peak_hour,
            trough_hour,
        }
    }

    // -----------------------------------------------------------------------
    // Consistency score: normalised inverse of std-dev across daily completion counts
    // -----------------------------------------------------------------------

    fn compute_consistency(
        events: &[ActivityEvent],
        since: NaiveDate,
        window_days: u32,
    ) -> f32 {
        if window_days == 0 {
            return 0.0;
        }

        // Count completions per day
        let mut daily_counts: HashMap<NaiveDate, u32> = HashMap::new();

        for e in events.iter().filter(|e| {
            e.occurred_at.date_naive() >= since
                && matches!(
                    e.event_type,
                    ActivityEventType::TaskCompleted
                        | ActivityEventType::PomodoroCompleted
                        | ActivityEventType::HabitLogged
                )
        }) {
            *daily_counts
                .entry(e.occurred_at.date_naive())
                .or_insert(0) += 1;
        }

        // Fill zero-activity days
        let mut all_counts: Vec<f32> = Vec::new();
        let today = Utc::now().date_naive();
        for offset in 0..window_days {
            let date = since + chrono::Duration::days(offset as i64);
            if date <= today {
                all_counts.push(*daily_counts.get(&date).unwrap_or(&0) as f32);
            }
        }

        if all_counts.is_empty() {
            return 0.0;
        }

        let mean = all_counts.iter().sum::<f32>() / all_counts.len() as f32;
        let variance = all_counts
            .iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f32>()
            / all_counts.len() as f32;
        let std_dev = variance.sqrt();

        // Consistency = 0 when std_dev is very high; 100 when std_dev = 0 and mean > 0
        if mean == 0.0 {
            return 0.0;
        }

        let cv = std_dev / mean; // coefficient of variation
        // CV=0 → score=100, CV=1 → score~50, CV≥2 → score~0
        let score = 100.0 / (1.0 + cv * cv);
        score.min(100.0).max(0.0)
    }
}
