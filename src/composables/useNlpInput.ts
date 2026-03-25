// ─── NLP input orchestration composable ──────────────────────────────────────
// Manages the full lifecycle: debounced suggestions → parse → confirm → execute.

import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useNlpStore } from '@/stores/useNlpStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { useHabitStore } from '@/stores/useHabitStore'
import { useAppStore } from '@/stores/useAppStore'
import {
  sanitizeInput,
  buildUserContext,
  shouldAutoExecute,
  formatIntentDisplay,
} from '@/services/nlpPipeline'
import * as tauri from '@/services/tauriClient'
import eventBus from '@/services/eventBus'
import { useVoiceInput } from './useVoiceInput'

// ─── Composable ───────────────────────────────────────────────────────────────

export function useNlpInput() {
  const nlpStore  = useNlpStore()
  const taskStore = useTaskStore()
  const habitStore = useHabitStore()
  const appStore  = useAppStore()
  const { isRecording, startRecording, stopRecording } = useVoiceInput()

  // Ghost-text / suggestion ghost string (shown in input placeholder)
  const ghostSuggestion = ref('')

  // ── Debounced ghost suggestions ───────────────────────────────────────────

  const _loadSuggestions = useDebounceFn(async (input: string) => {
    if (input.trim().length < 3) {
      ghostSuggestion.value = ''
      nlpStore.clearSuggestions()
      return
    }
    try {
      const context = buildUserContext({ taskStore, habitStore, nlpStore, appStore })
      const suggestions = await tauri.generateSuggestion({
        context,
        maxSuggestions: 5,
      })
      nlpStore.setSuggestions(suggestions)
      ghostSuggestion.value = suggestions[0]?.title ?? ''
    } catch {
      // Non-critical — don't surface errors for ghost text
      ghostSuggestion.value = ''
    }
  }, 400)

  // Watch input changes to trigger ghost suggestions
  watch(
    () => nlpStore.input,
    (val) => _loadSuggestions(val),
  )

  // ── submitInput ───────────────────────────────────────────────────────────

  /**
   * Phase 1: Sanitise → build context → call Tauri parseNlpIntent.
   * If shouldAutoExecute → immediately execute without confirmation.
   * Otherwise → set pendingIntent for the user to confirm.
   */
  async function submitInput(): Promise<void> {
    const raw = nlpStore.input
    if (!raw.trim()) return

    const sanitised = sanitizeInput(raw)
    nlpStore.setProcessing(true)
    nlpStore.setInputError(null)

    try {
      const context = buildUserContext({ taskStore, habitStore, nlpStore, appStore })
      // Inject the real userId if auth is available
      context.userId = 'local' // replaced by auth integration

      const intent = await tauri.parseNlpIntent({
        rawInput: sanitised,
        userContext: context,
      })

      eventBus.emit('ai:intent-parsed', intent)
      nlpStore.setSuggestions([])
      ghostSuggestion.value = ''

      if (shouldAutoExecute(intent)) {
        // Skip confirmation step
        await _executeIntent(intent)
      } else {
        nlpStore.setPendingIntent(intent)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse command'
      nlpStore.setInputError(msg)
      appStore.showToast({ title: 'Parse Error', message: msg, variant: 'error' })
    } finally {
      nlpStore.setProcessing(false)
    }
  }

  // ── confirmIntent ─────────────────────────────────────────────────────────

  /**
   * Phase 2: User confirmed the pending intent — execute it.
   */
  async function confirmIntent(): Promise<void> {
    const intent = nlpStore.pendingIntent
    if (!intent) return
    await _executeIntent(intent)
    nlpStore.dismissIntent()
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  async function _executeIntent(intent: typeof nlpStore.pendingIntent & object): Promise<void> {
    if (!intent) return
    nlpStore.setProcessing(true)

    try {
      const context = buildUserContext({ taskStore, habitStore, nlpStore, appStore })
      const result = await tauri.confirmAndExecuteIntent({
        intent,
        userContext: context,
      })

      nlpStore.setLastResult(result)
      eventBus.emit('ai:intent-executed', result)
      eventBus.emit('analytics:updated', { triggeredBy: 'ai_command' })

      const label = formatIntentDisplay(intent)
      appStore.showToast({
        title:   result.success ? 'Done' : 'Failed',
        message: result.message || label,
        variant: result.success ? 'success' : 'error',
      })

      if (result.success) {
        nlpStore.setInput('')
        nlpStore.dismissIntent()
        // Give a brief moment before closing so user sees the toast
        setTimeout(() => appStore.closeCommandBar(), 800)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed'
      nlpStore.setInputError(msg)
      appStore.showToast({ title: 'Execution Error', message: msg, variant: 'error' })
    } finally {
      nlpStore.setProcessing(false)
    }
  }

  // ── Voice toggle ──────────────────────────────────────────────────────────

  async function toggleVoice(): Promise<void> {
    if (isRecording.value) {
      const transcript = await stopRecording()
      if (transcript) {
        nlpStore.appendTranscript(transcript)
      }
    } else {
      nlpStore.setVoiceActive(true)
      await startRecording()
    }
  }

  return {
    ghostSuggestion,
    isRecording,
    submitInput,
    confirmIntent,
    toggleVoice,
  }
}
