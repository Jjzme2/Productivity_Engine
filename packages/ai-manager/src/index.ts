// ================================================================
//  AI Manager — Public API
//  Config is passed in — persistence is the caller's responsibility.
// ================================================================

export type { ProviderId, ProviderConfig, AiManagerConfig, TestResult, ProviderMeta } from './types.js'
export { PROVIDER_IDS, PROVIDER_META, createDefaultConfig } from './meta.js'
export { ADAPTERS } from './adapters.js'
export { fetchModels } from './models.js'
export type { ModelInfo } from './models.js'

import type { ProviderId, AiManagerConfig, TestResult } from './types.js'
import { ADAPTERS } from './adapters.js'

/**
 * Generate text using the configured providers.
 * Tries providers in `order` order. Falls back to the next one on
 * failure when `config.waterfallEnabled` is true.
 *
 * @example
 * const text = await aiGenerate("Write a tagline for a web developer.", config)
 */
export async function aiGenerate(prompt: string, config: AiManagerConfig): Promise<string> {
  const active = config.providers
    .filter((p) => p.enabled && (p.apiKey || p.id === 'ollama'))
    .sort((a, b) => a.order - b.order)

  if (active.length === 0) {
    throw new Error(
      'No AI providers are enabled with a valid API key. ' +
      'Configure one in your AI Manager settings.',
    )
  }

  const errors: string[] = []

  for (const provider of active) {
    try {
      const result = await ADAPTERS[provider.id](provider, prompt)
      if (result) return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${provider.id}: ${msg}`)
      console.warn(`[ai-manager] ${provider.id} failed:`, msg)
      if (!config.waterfallEnabled) break
    }
  }

  throw new Error(`All AI providers failed — ${errors.join(' | ')}`)
}

/**
 * Test a single provider with a trivial prompt.
 * Saves running `aiGenerate` for UI provider-test buttons.
 *
 * @example
 * const { ok, ms, error } = await testProvider('gemini', config)
 */
export async function testProvider(id: ProviderId, config: AiManagerConfig): Promise<TestResult> {
  const provider = config.providers.find((p) => p.id === id)
  if (!provider) return { ok: false, ms: 0, error: 'Provider not in config' }

  const start = Date.now()
  try {
    const result = await ADAPTERS[id](provider, "Respond with exactly the word 'OK' and nothing else.")
    return { ok: result.toLowerCase().includes('ok'), ms: Date.now() - start }
  } catch (err: unknown) {
    return {
      ok: false,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
