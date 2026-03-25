// ================================================================
//  AI Manager — Live Model Fetching
//  Each provider adapter calls its own models/tags endpoint.
//  Returns a normalised ModelInfo[] regardless of provider.
// ================================================================

import type { ProviderId, ProviderConfig } from './types.js'

export interface ModelInfo {
  id: string          // the exact string to put in model field
  name: string        // human-readable display name
  description?: string
  contextWindow?: number     // max input tokens
  outputLimit?: number       // max output tokens
  inputCostPer1M?: number    // USD per 1M input tokens  (static reference)
  outputCostPer1M?: number   // USD per 1M output tokens (static reference)
  size?: string              // Ollama disk size (e.g. "4.7 GB")
  tags?: string[]            // e.g. ['vision', 'function-calling']
}

// ── Static pricing reference ──────────────────────────────────────
// Approximate as of 2026-Q1. Verify at provider's pricing page.
const KNOWN_PRICING: Record<string, { in: number; out: number }> = {
  // Anthropic — https://www.anthropic.com/pricing
  'claude-haiku-4-5-20251001':       { in: 0.80,  out: 4.00  },
  'claude-sonnet-4-6':               { in: 3.00,  out: 15.00 },
  'claude-opus-4-6':                 { in: 15.00, out: 75.00 },

  // Google Gemini — https://ai.google.dev/pricing
  'gemini-2.5-pro-preview-03-25':    { in: 1.25,  out: 10.00 },
  'gemini-2.0-flash':                { in: 0.10,  out: 0.40  },
  'gemini-2.0-flash-lite':           { in: 0.075, out: 0.30  },
  'gemini-1.5-pro':                  { in: 1.25,  out: 5.00  },
  'gemini-1.5-flash':                { in: 0.075, out: 0.30  },

  // OpenAI — https://openai.com/pricing
  'gpt-4o':                          { in: 2.50,  out: 10.00 },
  'gpt-4o-mini':                     { in: 0.15,  out: 0.60  },
  'gpt-4-turbo':                     { in: 10.00, out: 30.00 },
  'gpt-3.5-turbo':                   { in: 0.50,  out: 1.50  },
  'o1':                              { in: 15.00, out: 60.00 },
  'o1-mini':                         { in: 3.00,  out: 12.00 },
  'o3-mini':                         { in: 1.10,  out: 4.40  },

  // Mistral — https://mistral.ai/technology/#pricing
  'mistral-small-latest':            { in: 0.10,  out: 0.30  },
  'mistral-large-latest':            { in: 2.00,  out: 6.00  },
  'codestral-latest':                { in: 0.30,  out: 0.90  },
  'mistral-saba-latest':             { in: 0.20,  out: 0.60  },
  'open-mistral-nemo':               { in: 0.15,  out: 0.15  },

  // Groq — https://groq.com/pricing (per 1M tokens)
  'llama-3.3-70b-versatile':         { in: 0.59,  out: 0.79  },
  'llama-3.1-8b-instant':            { in: 0.05,  out: 0.08  },
  'deepseek-r1-distill-llama-70b':   { in: 0.75,  out: 0.99  },
  'qwen-qwq-32b':                    { in: 0.29,  out: 0.39  },
  'gemma2-9b-it':                    { in: 0.20,  out: 0.20  },
  'mixtral-8x7b-32768':              { in: 0.24,  out: 0.24  },

  // Cohere — https://cohere.com/pricing
  'command-a-03-2025':               { in: 2.50,  out: 10.00 },
  'command-r-plus':                  { in: 2.50,  out: 10.00 },
  'command-r':                       { in: 0.15,  out: 0.60  },
  'command-r7b-12-2024':             { in: 0.0375, out: 0.15 },
}

function withPricing(id: string, info: Omit<ModelInfo, 'inputCostPer1M' | 'outputCostPer1M'>): ModelInfo {
  const p = KNOWN_PRICING[id]
  return { ...info, ...(p ? { inputCostPer1M: p.in, outputCostPer1M: p.out } : {}) }
}

// ── Helper ────────────────────────────────────────────────────────

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`.slice(0, 200))
  return res.json() as Promise<T>
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${bytes} B`
}

// ── Provider model fetchers ───────────────────────────────────────

async function fetchAnthropic(cfg: ProviderConfig): Promise<ModelInfo[]> {
  const data = await getJson<{ data?: Array<{ id: string; display_name: string }> }>(
    'https://api.anthropic.com/v1/models',
    { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
  )
  return (data.data ?? []).map((m) => withPricing(m.id, { id: m.id, name: m.display_name || m.id }))
}

async function fetchGemini(cfg: ProviderConfig): Promise<ModelInfo[]> {
  const data = await getJson<{
    models?: Array<{
      name: string
      displayName: string
      description?: string
      inputTokenLimit?: number
      outputTokenLimit?: number
      supportedGenerationMethods?: string[]
    }>
  }>(`https://generativelanguage.googleapis.com/v1beta/models?key=${cfg.apiKey}`)

  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => {
      const id = m.name.replace('models/', '')
      return withPricing(id, {
        id,
        name: m.displayName || id,
        description: m.description,
        contextWindow: m.inputTokenLimit,
        outputLimit: m.outputTokenLimit,
      })
    })
}

async function fetchOpenAICompat(
  baseUrl: string,
  cfg: ProviderConfig,
  filterFn: (id: string) => boolean = () => true,
): Promise<ModelInfo[]> {
  const data = await getJson<{ data?: Array<{ id: string; owned_by?: string; context_window?: number }> }>(
    `${baseUrl}/models`,
    { Authorization: `Bearer ${cfg.apiKey}` },
  )
  return (data.data ?? [])
    .filter((m) => filterFn(m.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => withPricing(m.id, {
      id: m.id,
      name: m.id,
      contextWindow: m.context_window,
      tags: m.owned_by ? [m.owned_by] : [],
    }))
}

async function fetchOllama(cfg: ProviderConfig): Promise<ModelInfo[]> {
  const base = (cfg.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
  const data = await getJson<{
    models?: Array<{ name: string; size?: number; details?: { parameter_size?: string; family?: string } }>
  }>(`${base}/api/tags`)

  return (data.models ?? []).map((m) => ({
    id: m.name,   // full name incl. tag, e.g. "llama3.2:latest" — use exactly this in config
    name: m.name,
    size: m.size ? fmtBytes(m.size) : undefined,
    tags: [m.details?.family, m.details?.parameter_size].filter(Boolean) as string[],
  }))
}

async function fetchMistral(cfg: ProviderConfig): Promise<ModelInfo[]> {
  const data = await getJson<{
    data?: Array<{ id: string; name?: string; description?: string; max_context_length?: number }>
  }>(
    'https://api.mistral.ai/v1/models',
    { Authorization: `Bearer ${cfg.apiKey}` },
  )
  return (data.data ?? [])
    .filter((m) => !m.id.includes('embed'))
    .map((m) => withPricing(m.id, {
      id: m.id,
      name: m.name || m.id,
      description: m.description,
      contextWindow: m.max_context_length,
    }))
}

async function fetchCohere(cfg: ProviderConfig): Promise<ModelInfo[]> {
  const data = await getJson<{
    models?: Array<{ name: string; context_length?: number; endpoints?: string[] }>
  }>(
    'https://api.cohere.ai/v2/models',
    { Authorization: `Bearer ${cfg.apiKey}` },
  )
  return (data.models ?? [])
    .filter((m) => m.endpoints?.includes('chat'))
    .map((m) => withPricing(m.name, {
      id: m.name,
      name: m.name,
      contextWindow: m.context_length,
    }))
}

// ── Public API ────────────────────────────────────────────────────

const FETCHERS: Partial<Record<ProviderId, (cfg: ProviderConfig) => Promise<ModelInfo[]>>> = {
  anthropic: fetchAnthropic,
  gemini:    fetchGemini,
  openai:    (cfg) => fetchOpenAICompat(
    'https://api.openai.com/v1',
    cfg,
    (id) => id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3'),
  ),
  ollama:    fetchOllama,
  mistral:   fetchMistral,
  groq:      (cfg) => fetchOpenAICompat('https://api.groq.com/openai/v1', cfg),
  cohere:    fetchCohere,
}

export async function fetchModels(id: ProviderId, cfg: ProviderConfig): Promise<ModelInfo[]> {
  const fetcher = FETCHERS[id]
  if (!fetcher) throw new Error(`Model listing not supported for provider: ${id}`)
  return fetcher(cfg)
}
