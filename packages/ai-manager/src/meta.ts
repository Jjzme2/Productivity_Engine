import type { ProviderId, ProviderMeta, AiManagerConfig } from './types.js'

export const PROVIDER_IDS: ProviderId[] = [
  'anthropic',
  'gemini',
  'openai',
  'ollama',
  'mistral',
  'groq',
  'cohere',
]

export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    name: 'Anthropic (Claude)',
    defaultModel: 'claude-haiku-4-5-20251001',
    suggestedModels: [
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
    ],
    needsKey: true,
    defaultBaseUrl: '',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    envKey: 'ANTHROPIC_API_KEY',
    pricingUrl: 'https://www.anthropic.com/pricing',
  },
  gemini: {
    name: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    suggestedModels: [
      'gemini-2.5-pro-preview-03-25',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
    needsKey: true,
    defaultBaseUrl: '',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    envKey: 'GEMINI_API_KEY',
    pricingUrl: 'https://ai.google.dev/pricing',
  },
  openai: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: [
      'gpt-4o-mini',
      'gpt-4o',
      'o3-mini',
      'o1-mini',
      'o1',
      'gpt-4-turbo',
    ],
    needsKey: true,
    defaultBaseUrl: '',
    docsUrl: 'https://platform.openai.com/api-keys',
    envKey: 'OPENAI_API_KEY',
    pricingUrl: 'https://openai.com/pricing',
  },
  ollama: {
    name: 'Ollama (Local)',
    defaultModel: 'llama3.2:latest',
    suggestedModels: [
      'llama3.2:latest',
      'llama3.3:latest',
      'phi4:latest',
      'gemma3:latest',
      'qwen2.5:latest',
      'mistral:latest',
      'codellama:latest',
      'deepseek-r1:latest',
    ],
    needsKey: false,
    defaultBaseUrl: 'http://localhost:11434',
    docsUrl: 'https://ollama.com',
    envKey: 'OLLAMA_BASE_URL',
    pricingUrl: 'https://ollama.com',
  },
  mistral: {
    name: 'Mistral AI',
    defaultModel: 'mistral-small-latest',
    suggestedModels: [
      'mistral-small-latest',
      'mistral-large-latest',
      'codestral-latest',
      'mistral-saba-latest',
      'open-mistral-nemo',
    ],
    needsKey: true,
    defaultBaseUrl: '',
    docsUrl: 'https://console.mistral.ai/api-keys',
    envKey: 'MISTRAL_API_KEY',
    pricingUrl: 'https://mistral.ai/technology/#pricing',
  },
  groq: {
    name: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    suggestedModels: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'deepseek-r1-distill-llama-70b',
      'qwen-qwq-32b',
      'gemma2-9b-it',
      'mixtral-8x7b-32768',
    ],
    needsKey: true,
    defaultBaseUrl: '',
    docsUrl: 'https://console.groq.com/keys',
    envKey: 'GROQ_API_KEY',
    pricingUrl: 'https://groq.com/pricing',
  },
  cohere: {
    name: 'Cohere',
    defaultModel: 'command-r-plus',
    suggestedModels: [
      'command-a-03-2025',
      'command-r-plus',
      'command-r',
      'command-r7b-12-2024',
    ],
    needsKey: true,
    defaultBaseUrl: '',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    envKey: 'COHERE_API_KEY',
    pricingUrl: 'https://cohere.com/pricing',
  },
}

/** Returns a fresh default config with all providers disabled except Anthropic. */
export function createDefaultConfig(): AiManagerConfig {
  return {
    waterfallEnabled: true,
    providers: PROVIDER_IDS.map((id, order) => ({
      id,
      enabled: id === 'anthropic',
      apiKey: '',
      model: PROVIDER_META[id].defaultModel,
      baseUrl: PROVIDER_META[id].defaultBaseUrl,
      order,
    })),
  }
}
