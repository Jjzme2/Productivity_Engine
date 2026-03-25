// ─── AI Manager composable ────────────────────────────────────────────────────
// Bridges the @ilytat/ai-manager package with Tauri's secure env reading.
// The GEMINI_API_KEY is never bundled in the Vite output — it is fetched at
// runtime from the Rust process via read_secret_env.

import { ref, readonly } from 'vue'
import { aiGenerate, createDefaultConfig } from '@ilytat/ai-manager'
import type { AiManagerConfig } from '@ilytat/ai-manager'
import { readSecretEnv } from '@/services/tauriClient'

// ─── Shared singleton state ───────────────────────────────────────────────────

const config = ref<AiManagerConfig | null>(null)
const isReady = ref(false)
const initError = ref<string | null>(null)

let initPromise: Promise<void> | null = null

async function _init(): Promise<void> {
  const geminiKey = await readSecretEnv('GEMINI_API_KEY')

  if (!geminiKey) {
    initError.value = 'GEMINI_API_KEY is not set'
    return
  }

  const cfg = createDefaultConfig()

  const gemini = cfg.providers.find((p) => p.id === 'gemini')
  if (gemini) {
    gemini.apiKey  = geminiKey
    gemini.enabled = true
    gemini.order   = 0
  }

  // Disable all other providers so Gemini is the sole backend
  cfg.providers.forEach((p) => {
    if (p.id !== 'gemini') p.enabled = false
  })

  config.value = cfg
  isReady.value = true
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useAiManager() {
  if (!initPromise) {
    initPromise = _init()
  }

  /**
   * Generate text using the configured AI provider (Gemini).
   * Waits for initialization if not yet ready.
   */
  async function generate(prompt: string): Promise<string> {
    await initPromise
    if (!config.value) {
      throw new Error(initError.value ?? 'AI Manager not initialized')
    }
    return aiGenerate(prompt, config.value)
  }

  return {
    isReady: readonly(isReady),
    initError: readonly(initError),
    generate,
  }
}
