// ─── Framework / Pomodoro composable ─────────────────────────────────────────

import { ref, computed, onUnmounted } from 'vue'
import { useFrameworkStore } from '@/stores/useFrameworkStore'
import { useAppStore } from '@/stores/useAppStore'
import type { FrameworkSlug, PomodoroState } from '@/types/framework'

// ─── Composable ───────────────────────────────────────────────────────────────

export function useFramework(userId: string) {
  const frameworkStore = useFrameworkStore()
  const appStore       = useAppStore()

  // JS-side interval timer — keeps the Pomodoro clock ticking
  const _intervalId = ref<ReturnType<typeof setInterval> | null>(null)
  const _lastTickAt = ref<number>(0)
  const isPaused = ref(false)

  // ── Activate ──────────────────────────────────────────────────────────────

  async function activateFramework(
    slug: FrameworkSlug,
    linkedTaskIds?: string[],
  ): Promise<void> {
    try {
      await frameworkStore.activateFramework(userId, slug, linkedTaskIds)
      if (slug === 'pomodoro') {
        _startTimer()
      }
      appStore.showToast({
        title:   'Framework started',
        message: `${slug.replace(/_/g, ' ')} is now active`,
        variant: 'success',
        durationMs: 2000,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start framework'
      appStore.showToast({ title: 'Error', message: msg, variant: 'error' })
    }
  }

  // ── Deactivate ────────────────────────────────────────────────────────────

  async function deactivateFramework(completed = false): Promise<void> {
    _stopTimer()
    try {
      await frameworkStore.deactivateFramework(completed)
      isPaused.value = false
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to stop framework'
      appStore.showToast({ title: 'Error', message: msg, variant: 'error' })
    }
  }

  // ── Pause / Resume ────────────────────────────────────────────────────────

  function pausePomodoro(): void {
    if (!isPaused.value) {
      _stopTimer()
      isPaused.value = true
    }
  }

  function resumePomodoro(): void {
    if (isPaused.value) {
      isPaused.value = false
      _startTimer()
    }
  }

  function togglePause(): void {
    if (isPaused.value) resumePomodoro()
    else pausePomodoro()
  }

  // ── Skip interval ─────────────────────────────────────────────────────────

  /**
   * Skip the current Pomodoro phase and jump to the next.
   * Useful for manually ending a break early.
   */
  function skipInterval(): void {
    const p = frameworkStore.pomodoroState
    if (!p) return
    // Advance by the remaining duration so tickFramework triggers phase change
    frameworkStore.tickFramework(p.duration - p.elapsed + 1)
  }

  // ── Computed progress ─────────────────────────────────────────────────────

  /**
   * Returns progress as a 0–100 number.
   */
  const progressPercent = computed<number>(() => frameworkStore.progressPercent)

  /**
   * Formats remaining time for the current Pomodoro phase.
   * Returns a "MM:SS" string.
   */
  const remainingTime = computed<string>(() => {
    const p = frameworkStore.pomodoroState
    if (!p) return '00:00'
    const remainingMs = Math.max(0, p.duration - p.elapsed)
    return formatTime(remainingMs)
  })

  const currentPhaseLabel = computed<string>(() => {
    const p = frameworkStore.pomodoroState
    if (!p) return ''
    const labels: Record<PomodoroState['phase'], string> = {
      work:        'Focus',
      short_break: 'Short Break',
      long_break:  'Long Break',
    }
    return labels[p.phase]
  })

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Formats a millisecond duration into "MM:SS".
   */
  function formatTime(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  /**
   * Formats a millisecond duration into a long form like "25 min" or "1h 30m".
   */
  function formatDuration(ms: number): string {
    const totalMin = Math.round(ms / 60_000)
    if (totalMin < 60) return `${totalMin} min`
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  // ── Private timer management ──────────────────────────────────────────────

  function _startTimer(): void {
    if (_intervalId.value !== null) return
    _lastTickAt.value = Date.now()
    _intervalId.value = setInterval(() => {
      const now    = Date.now()
      const deltaMs = now - _lastTickAt.value
      _lastTickAt.value = now
      frameworkStore.tickFramework(deltaMs)
    }, 250) // tick every 250ms for smooth progress display
  }

  function _stopTimer(): void {
    if (_intervalId.value !== null) {
      clearInterval(_intervalId.value)
      _intervalId.value = null
    }
  }

  // Clean up the interval when the component using this composable unmounts
  onUnmounted(() => _stopTimer())

  return {
    activateFramework,
    deactivateFramework,
    pausePomodoro,
    resumePomodoro,
    togglePause,
    skipInterval,
    formatTime,
    formatDuration,
    progressPercent,
    remainingTime,
    currentPhaseLabel,
    isPaused,
    // Expose store refs
    isSessionActive:  frameworkStore.isSessionActive,
    isPomodoro:       frameworkStore.isPomodoro,
    activeSession:    frameworkStore.activeSession,
    pomodoroState:    frameworkStore.pomodoroState,
    frameworks:       frameworkStore.frameworks,
    isLoading:        frameworkStore.isLoading,
  }
}
