// ─── Analytics composable ────────────────────────────────────────────────────

import { onMounted, computed } from 'vue'
import { useAnalyticsStore } from '@/stores/useAnalyticsStore'
import { useAppStore } from '@/stores/useAppStore'
import type { ShortcomingSeverity } from '@/types/analytics'

// ─── Composable ───────────────────────────────────────────────────────────────

export function useAnalytics(userId: string) {
  const analyticsStore = useAnalyticsStore()
  const appStore       = useAppStore()

  // ── Auto-load on mount ────────────────────────────────────────────────────

  onMounted(async () => {
    if (!analyticsStore.hasInsights) {
      await analyticsStore.loadInsights(userId)
    }
    if (analyticsStore.weeklyScores.length === 0) {
      await analyticsStore.loadWeeklyScores(userId)
    }
  })

  // ── Run full analysis ─────────────────────────────────────────────────────

  /**
   * Trigger a full AI shortcoming/strength analysis.
   * Displays a loading toast while in progress.
   */
  async function runFullAnalysis(): Promise<void> {
    if (analyticsStore.isAnalyzing) return

    appStore.showToast({
      title:   'Analysing your productivity…',
      message: 'This may take a few seconds.',
      variant: 'info',
      durationMs: 0, // persist until complete
    })

    await analyticsStore.runAnalysis(userId)

    // Clear the persistent info toast
    appStore.clearAllToasts()

    if (analyticsStore.error) {
      appStore.showToast({
        title:   'Analysis failed',
        message: analyticsStore.error,
        variant: 'error',
      })
    } else {
      appStore.showToast({
        title:   'Analysis complete',
        message: `Found ${analyticsStore.topShortcomings.length} areas to improve.`,
        variant: 'success',
      })
    }
  }

  // ── Colour helpers ────────────────────────────────────────────────────────

  /**
   * Returns a Tailwind text-color class based on a 0–100 score.
   */
  function computeScoreColor(score: number): string {
    if (score >= 80) return 'text-success-400'
    if (score >= 60) return 'text-warning-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-danger-400'
  }

  /**
   * Returns a human-readable severity label with a colour class pair.
   */
  function formatShortcomingSeverity(severity: ShortcomingSeverity): {
    label: string
    colorClass: string
    badgeClass: string
  } {
    switch (severity) {
      case 'high':
        return {
          label:      'High',
          colorClass: 'text-danger-400',
          badgeClass: 'bg-danger-950 text-danger-300 border border-danger-800',
        }
      case 'medium':
        return {
          label:      'Medium',
          colorClass: 'text-warning-400',
          badgeClass: 'bg-warning-950 text-warning-300 border border-warning-800',
        }
      case 'low':
        return {
          label:      'Low',
          colorClass: 'text-success-400',
          badgeClass: 'bg-success-950 text-success-300 border border-success-800',
        }
    }
  }

  // ── Trend helper ──────────────────────────────────────────────────────────

  /**
   * Returns a label and CSS class for week-over-week score change.
   */
  const scoretrend = computed(() => {
    const scores = analyticsStore.weeklyScores
    if (scores.length < 2) return { label: 'No data', colorClass: 'text-surface-muted' }

    const prev = scores[scores.length - 2]!.score
    const curr = scores[scores.length - 1]!.score
    const diff = curr - prev

    if (diff > 5)  return { label: `+${diff} vs last week`, colorClass: 'text-success-400' }
    if (diff < -5) return { label: `${diff} vs last week`,  colorClass: 'text-danger-400' }
    return { label: 'Stable vs last week', colorClass: 'text-surface-muted' }
  })

  return {
    runFullAnalysis,
    computeScoreColor,
    formatShortcomingSeverity,
    scoretrend,
    // Store refs
    insights:         analyticsStore.insights,
    weeklyScores:     analyticsStore.weeklyScores,
    topShortcomings:  analyticsStore.topShortcomings,
    topSuggestions:   analyticsStore.topSuggestions,
    currentScore:     analyticsStore.currentScore,
    isAnalyzing:      analyticsStore.isAnalyzing,
    lastAnalyzed:     analyticsStore.lastAnalyzed,
    hasInsights:      analyticsStore.hasInsights,
  }
}
