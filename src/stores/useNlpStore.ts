// ─── NLP two-phase state machine ──────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ParsedIntent, ExecutionResult, Suggestion, AiProviderStatus } from '@/types/nlp'

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNlpStore = defineStore('nlp', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  /** Current text in the command bar input */
  const input           = ref('')
  /** Whether the Tauri NLP invoke is in-flight */
  const isProcessing    = ref(false)
  /**
   * Phase 1: The AI has parsed the intent but it awaits user confirmation
   * (unless shouldAutoExecute returns true).
   */
  const pendingIntent   = ref<ParsedIntent | null>(null)
  /** Phase 2: Result of the last confirmed execution */
  const lastResult      = ref<ExecutionResult | null>(null)
  /** Inline suggestions (ghost text / dropdown) */
  const suggestions     = ref<Suggestion[]>([])
  /** Whether the command bar overlay is visible */
  const isCommandBarOpen = ref(false)
  /** Whether the voice capture pipeline is active */
  const voiceActive      = ref(false)
  /** Status of the active AI provider */
  const providerStatus   = ref<AiProviderStatus | null>(null)
  /** Transient error shown below the command bar input */
  const inputError       = ref<string | null>(null)

  // ── Computed ───────────────────────────────────────────────────────────────

  const hasPendingIntent = computed(() => pendingIntent.value !== null)
  const hasLastResult    = computed(() => lastResult.value !== null)
  const isIdle           = computed(
    () => !isProcessing.value && pendingIntent.value === null,
  )

  // ── Actions ────────────────────────────────────────────────────────────────

  function openCommandBar() {
    isCommandBarOpen.value = true
    inputError.value = null
  }

  function closeCommandBar() {
    isCommandBarOpen.value = false
    input.value = ''
    pendingIntent.value = null
    inputError.value = null
    voiceActive.value = false
  }

  function setInput(value: string) {
    input.value = value
    // Clear error on new input
    inputError.value = null
  }

  function setProcessing(value: boolean) {
    isProcessing.value = value
  }

  function setPendingIntent(intent: ParsedIntent | null) {
    pendingIntent.value = intent
  }

  function setLastResult(result: ExecutionResult | null) {
    lastResult.value = result
  }

  function dismissIntent() {
    pendingIntent.value = null
    inputError.value = null
  }

  function clearResult() {
    lastResult.value = null
  }

  function setSuggestions(items: Suggestion[]) {
    suggestions.value = items
  }

  function clearSuggestions() {
    suggestions.value = []
  }

  function setProviderStatus(status: AiProviderStatus | null) {
    providerStatus.value = status
  }

  function setInputError(msg: string | null) {
    inputError.value = msg
  }

  function toggleVoice() {
    voiceActive.value = !voiceActive.value
  }

  function setVoiceActive(value: boolean) {
    voiceActive.value = value
  }

  /** Append voice transcript to current input */
  function appendTranscript(transcript: string) {
    const separator = input.value.length > 0 ? ' ' : ''
    input.value = (input.value + separator + transcript).trim()
    voiceActive.value = false
  }

  return {
    // State
    input,
    isProcessing,
    pendingIntent,
    lastResult,
    suggestions,
    isCommandBarOpen,
    voiceActive,
    providerStatus,
    inputError,
    // Computed
    hasPendingIntent,
    hasLastResult,
    isIdle,
    // Actions
    openCommandBar,
    closeCommandBar,
    setInput,
    setProcessing,
    setPendingIntent,
    setLastResult,
    dismissIntent,
    clearResult,
    setSuggestions,
    clearSuggestions,
    setProviderStatus,
    setInputError,
    toggleVoice,
    setVoiceActive,
    appendTranscript,
  }
})
