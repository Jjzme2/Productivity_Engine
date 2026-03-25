// ─── Voice input composable ───────────────────────────────────────────────────
// Manages the voice capture lifecycle via Tauri commands.

import { ref } from 'vue'
import * as tauri from '@/services/tauriClient'
import { useAppStore } from '@/stores/useAppStore'

// ─── Composable ───────────────────────────────────────────────────────────────

export function useVoiceInput() {
  const appStore = useAppStore()

  const isRecording  = ref(false)
  const transcript   = ref('')
  const isAvailable  = ref(false)
  const providerName = ref('')
  const error        = ref<string | null>(null)

  // ── Check availability ────────────────────────────────────────────────────

  async function checkAvailability(): Promise<void> {
    try {
      const status = await tauri.getVoiceProviderStatus()
      isAvailable.value  = status.available
      providerName.value = status.provider
    } catch {
      isAvailable.value = false
    }
  }

  // Check on composable creation
  checkAvailability()

  // ── Start recording ───────────────────────────────────────────────────────

  /**
   * Start the voice capture pipeline.
   * The Rust side opens the microphone stream and begins STT processing.
   * Recording stops when `stopRecording()` is called.
   */
  async function startRecording(): Promise<void> {
    if (isRecording.value) return
    if (!isAvailable.value) {
      appStore.showToast({
        title:   'Voice Not Available',
        message: 'No voice provider is configured. Check Settings → Voice.',
        variant: 'warning',
      })
      return
    }

    error.value = null
    transcript.value = ''

    try {
      await tauri.startVoiceCapture()
      isRecording.value = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start voice capture'
      error.value = msg
      appStore.showToast({ title: 'Voice Error', message: msg, variant: 'error' })
    }
  }

  // ── Stop recording ────────────────────────────────────────────────────────

  /**
   * Stop capture and return the final transcript string.
   * Returns an empty string on failure.
   */
  async function stopRecording(): Promise<string> {
    if (!isRecording.value) return ''

    try {
      const result = await tauri.stopVoiceCapture()
      transcript.value  = result
      isRecording.value = false
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to stop voice capture'
      error.value = msg
      isRecording.value = false
      appStore.showToast({ title: 'Voice Error', message: msg, variant: 'error' })
      return ''
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function clearTranscript() {
    transcript.value = ''
  }

  return {
    isRecording,
    transcript,
    isAvailable,
    providerName,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
    checkAvailability,
  }
}
