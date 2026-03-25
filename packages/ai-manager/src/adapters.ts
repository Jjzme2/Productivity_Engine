// ================================================================
//  AI Manager — Provider Adapters
//  All providers use native fetch. Zero runtime dependencies.
//  Anthropic, OpenAI, Mistral, and Groq share one OpenAI-compat
//  adapter. Adding a new compatible endpoint is one line.
// ================================================================

import type { ProviderId, ProviderConfig } from './types.js'

type Adapter = (cfg: ProviderConfig, prompt: string) => Promise<string>

// ── Helpers ───────────────────────────────────────────────────────

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.json() as Promise<T>
}

// ── Anthropic ────────────────────────────────────────────────────

async function callAnthropic(cfg: ProviderConfig, prompt: string): Promise<string> {
  if (!cfg.apiKey) throw new Error('API key not configured')
  const data = await postJson<{ content?: Array<{ type: string; text?: string }> }>(
    'https://api.anthropic.com/v1/messages',
    { model: cfg.model, max_tokens: 600, messages: [{ role: 'user', content: prompt }] },
    { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
  )
  const text = data.content?.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Empty response from Anthropic')
  return text.trim()
}

// ── Google Gemini ─────────────────────────────────────────────────

async function callGemini(cfg: ProviderConfig, prompt: string): Promise<string> {
  if (!cfg.apiKey) throw new Error('API key not configured')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`
  const data = await postJson<{
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }>(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 600 },
  })
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini')
  return text.trim()
}

// ── OpenAI-compatible (OpenAI, Mistral, Groq, custom) ────────────

function makeOpenAICompat(defaultUrl: string): Adapter {
  return async (cfg, prompt) => {
    if (!cfg.apiKey) throw new Error('API key not configured')
    const url = cfg.baseUrl ? cfg.baseUrl.replace(/\/$/, '') + '/chat/completions' : defaultUrl
    const data = await postJson<{ choices?: Array<{ message?: { content?: string } }> }>(
      url,
      { model: cfg.model, max_tokens: 600, messages: [{ role: 'user', content: prompt }] },
      { Authorization: `Bearer ${cfg.apiKey}` },
    )
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('Empty response')
    return text.trim()
  }
}

// ── Ollama (local) ───────────────────────────────────────────────

async function resolveOllamaModel(base: string, preferred: string): Promise<string> {
  // Try the configured model name first (Ollama accepts names with or without tag).
  // If it's not found, fall back to the first installed model automatically.
  try {
    const res = await fetch(`${base}/api/tags`)
    if (!res.ok) return preferred
    const data = await res.json() as { models?: Array<{ name: string }> }
    const installed = data.models ?? []
    if (installed.length === 0) return preferred

    // Exact match (incl. tag)
    if (installed.some((m) => m.name === preferred)) return preferred

    // Match ignoring tag — e.g. "llama3.2" matches "llama3.2:latest"
    const nameOnly = preferred.split(':')[0]
    const loose = installed.find((m) => m.name.split(':')[0] === nameOnly)
    if (loose) return loose.name

    // No match — use the first installed model
    return installed[0].name
  } catch {
    return preferred
  }
}

async function callOllama(cfg: ProviderConfig, prompt: string): Promise<string> {
  const base = (cfg.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
  const model = await resolveOllamaModel(base, cfg.model || 'llama3.2')
  const data = await postJson<{ message?: { content?: string } }>(
    `${base}/api/chat`,
    { model, messages: [{ role: 'user', content: prompt }], stream: false },
  )
  const text = data.message?.content
  if (!text) throw new Error('Empty response from Ollama')
  return text.trim()
}

// ── Cohere ───────────────────────────────────────────────────────

async function callCohere(cfg: ProviderConfig, prompt: string): Promise<string> {
  if (!cfg.apiKey) throw new Error('API key not configured')
  const data = await postJson<{ message?: { content?: Array<{ text?: string }> } }>(
    'https://api.cohere.ai/v2/chat',
    { model: cfg.model, max_tokens: 600, messages: [{ role: 'user', content: prompt }] },
    { Authorization: `Bearer ${cfg.apiKey}` },
  )
  const text = data.message?.content?.[0]?.text
  if (!text) throw new Error('Empty response from Cohere')
  return text.trim()
}

// ── Adapter registry ─────────────────────────────────────────────

export const ADAPTERS: Record<ProviderId, Adapter> = {
  anthropic: callAnthropic,
  gemini:    callGemini,
  openai:    makeOpenAICompat('https://api.openai.com/v1/chat/completions'),
  mistral:   makeOpenAICompat('https://api.mistral.ai/v1/chat/completions'),
  groq:      makeOpenAICompat('https://api.groq.com/openai/v1/chat/completions'),
  ollama:    callOllama,
  cohere:    callCohere,
}
