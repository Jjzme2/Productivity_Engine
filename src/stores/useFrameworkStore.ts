// ─── Framework store ──────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Framework,
  FrameworkSession,
  PomodoroState,
  CustomFrameworkConfig,
  FrameworkSlug,
} from '@/types/framework'
import {
  subscribeToCollection,
  COLLECTIONS,
} from '@/services/firestoreClient'
import * as tauri from '@/services/tauriClient'
import type { Unsubscribe } from 'firebase/firestore'
import eventBus from '@/services/eventBus'

// ─── Store ────────────────────────────────────────────────────────────────────

export const useFrameworkStore = defineStore('frameworks', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const frameworks     = ref<Framework[]>([])
  const activeSession  = ref<FrameworkSession | null>(null)
  const pomodoroState  = ref<PomodoroState | null>(null)
  const isLoading      = ref(false)
  const error          = ref<string | null>(null)

  let _frameworksUnsub: Unsubscribe | null = null
  let _sessionUnsub:    Unsubscribe | null = null

  // ── Computed ───────────────────────────────────────────────────────────────

  const isSessionActive = computed(
    () => activeSession.value !== null && activeSession.value.state === 'active',
  )

  const isPomodoro = computed(
    () => activeSession.value?.frameworkSlug === 'pomodoro' && pomodoroState.value !== null,
  )

  const progressPercent = computed(() => {
    const p = pomodoroState.value
    if (!p || p.duration === 0) return 0
    return Math.min(100, Math.round((p.elapsed / p.duration) * 100))
  })

  const customFrameworks = computed(() =>
    frameworks.value.filter((f) => f.isCustom),
  )

  // ── Actions ────────────────────────────────────────────────────────────────

  function loadFrameworks(userId: string) {
    isLoading.value = true
    _frameworksUnsub = subscribeToCollection<Framework>(
      COLLECTIONS.FRAMEWORKS,
      {
        where:   [{ field: 'userId', op: '==', value: userId }],
        orderBy: [{ field: 'createdAt', direction: 'asc' }],
      },
      (docs) => {
        frameworks.value = docs
        isLoading.value = false
      },
      (err) => {
        error.value = err.message
        isLoading.value = false
      },
    )

    // Also subscribe to any active session
    _sessionUnsub = subscribeToCollection<FrameworkSession>(
      COLLECTIONS.FRAMEWORK_SESSIONS,
      {
        where: [
          { field: 'userId', op: '==', value: userId },
          { field: 'state',  op: 'in',  value: ['active', 'paused'] },
        ],
        limit: 1,
      },
      (docs) => {
        activeSession.value = docs[0] ?? null
        if (activeSession.value?.pomodoroState) {
          pomodoroState.value = activeSession.value.pomodoroState
        }
      },
    )
  }

  function unloadFrameworks() {
    _frameworksUnsub?.()
    _sessionUnsub?.()
    _frameworksUnsub = null
    _sessionUnsub    = null
    frameworks.value = []
    activeSession.value = null
    pomodoroState.value = null
  }

  async function activateFramework(
    userId: string,
    slug: FrameworkSlug,
    linkedTaskIds?: string[],
  ): Promise<FrameworkSession> {
    const session = await tauri.activateFramework(userId, slug, linkedTaskIds)
    activeSession.value = session
    if (session.pomodoroState) pomodoroState.value = session.pomodoroState
    eventBus.emit('framework:started', session)
    return session
  }

  async function deactivateFramework(completed: boolean): Promise<void> {
    if (!activeSession.value) return
    const session = await tauri.deactivateFramework(
      activeSession.value.id,
      activeSession.value.userId,
      completed,
    )
    eventBus.emit('framework:stopped', session)
    activeSession.value = null
    pomodoroState.value = null
  }

  /**
   * Called by the JS interval timer every second.
   * Updates the local pomodoroState and emits tick events.
   */
  function tickFramework(deltaMs: number) {
    if (!pomodoroState.value) return

    const p = pomodoroState.value
    const newElapsed = p.elapsed + deltaMs

    if (newElapsed >= p.duration) {
      // Phase completed
      const completedIntervals = p.phase === 'work' ? p.interval : p.interval - 1
      eventBus.emit('pomodoro:completed', {
        sessionId: activeSession.value?.id ?? '',
        completedIntervals,
      })
      // Advance to next phase
      pomodoroState.value = _nextPhase(p)
    } else {
      pomodoroState.value = { ...p, elapsed: newElapsed }
      eventBus.emit('pomodoro:tick', pomodoroState.value)
    }
  }

  async function createCustomFramework(
    userId: string,
    name: string,
    config: CustomFrameworkConfig,
  ): Promise<Framework> {
    return tauri.createCustomFramework(userId, name, config)
  }

  async function updateCustomFramework(
    frameworkId: string,
    userId: string,
    name?: string,
    config?: Partial<CustomFrameworkConfig>,
  ): Promise<Framework> {
    return tauri.updateCustomFramework(frameworkId, userId, name, config)
  }

  async function deleteCustomFramework(_id: string): Promise<void> {
    // The backend handles deletion; the listener will remove it from `frameworks`
    frameworks.value = frameworks.value.filter((f) => f.id !== _id)
  }

  function setPomodoroState(state: PomodoroState) {
    pomodoroState.value = state
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  function _nextPhase(p: PomodoroState): PomodoroState {
    if (p.phase === 'work') {
      const isLongBreak = p.interval % p.totalIntervals === 0
      return {
        phase:          isLongBreak ? 'long_break' : 'short_break',
        elapsed:        0,
        duration:       isLongBreak ? 15 * 60 * 1000 : 5 * 60 * 1000,
        interval:       p.interval,
        totalIntervals: p.totalIntervals,
      }
    } else {
      return {
        phase:          'work',
        elapsed:        0,
        duration:       25 * 60 * 1000,
        interval:       p.interval + 1,
        totalIntervals: p.totalIntervals,
      }
    }
  }

  // ── Compatibility aliases for older views ──────────────────────────────────

  const allFrameworks = frameworks

  const _slugNames: Record<string, string> = {
    pomodoro: 'Pomodoro', daily6: 'Daily 6', gtd: 'GTD',
    time_blocking: 'Time Blocking', custom: 'Custom',
  }
  const activeFramework = computed(() => {
    const s = activeSession.value
    if (!s) return null
    return { ...s, name: _slugNames[s.frameworkSlug] ?? s.frameworkSlug, frameworkType: s.frameworkSlug }
  })

  async function startSession(frameworkSlug: string) {
    await activateFramework('local', frameworkSlug as import('@/types/framework').FrameworkSlug)
  }

  async function stopSession() {
    await deactivateFramework(false)
  }

  function updateSession(patch: Partial<import('@/types/framework').FrameworkSession>) {
    if (activeSession.value) {
      activeSession.value = { ...activeSession.value, ...patch }
    }
  }

  async function saveCustomFramework(config: import('@/types/framework').CustomFrameworkConfig & { name: string }) {
    return createCustomFramework('local', config.name, config)
  }

  return {
    // State
    frameworks,
    activeSession,
    pomodoroState,
    isLoading,
    error,
    // Computed
    isSessionActive,
    isPomodoro,
    progressPercent,
    customFrameworks,
    // Compatibility aliases
    allFrameworks,
    activeFramework,
    // Actions
    loadFrameworks,
    unloadFrameworks,
    activateFramework,
    deactivateFramework,
    tickFramework,
    createCustomFramework,
    updateCustomFramework,
    deleteCustomFramework,
    setPomodoroState,
    startSession,
    stopSession,
    updateSession,
    saveCustomFramework,
  }
})
