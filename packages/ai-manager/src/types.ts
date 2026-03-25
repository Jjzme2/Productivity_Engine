// ================================================================
//  AI Manager — Type Definitions
//  Framework-agnostic. No runtime dependencies.
// ================================================================

export type ProviderId =
  | 'anthropic'
  | 'gemini'
  | 'openai'
  | 'ollama'
  | 'mistral'
  | 'groq'
  | 'cohere'

export interface ProviderConfig {
  id: ProviderId
  enabled: boolean
  /** API key (not required for Ollama) */
  apiKey: string
  /** Model name/ID to use for this provider */
  model: string
  /** Base URL override — used for Ollama and custom OpenAI-compatible endpoints */
  baseUrl: string
  /** Waterfall priority: lower number = tried first */
  order: number
}

export interface AiManagerConfig {
  providers: ProviderConfig[]
  /** When true, automatically tries the next enabled provider on failure */
  waterfallEnabled: boolean
}

export interface TestResult {
  ok: boolean
  /** Round-trip time in milliseconds */
  ms: number
  error?: string
}

export interface ProviderMeta {
  name: string
  defaultModel: string
  suggestedModels: string[]
  /** Whether this provider requires an API key */
  needsKey: boolean
  defaultBaseUrl: string
  docsUrl: string
  /** Recommended environment variable name for this provider's API key */
  envKey: string
  /** Official pricing page URL */
  pricingUrl: string
}
