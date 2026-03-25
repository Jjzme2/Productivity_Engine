# @ilytat/ai-manager

Multi-provider AI text generation with waterfall fallback. Drop into any Node.js, Deno, or Bun app.

**Providers:** Anthropic · Google Gemini · OpenAI · Ollama · Mistral · Groq · Cohere
**Dependencies:** none (native `fetch` only)
**Engines:** Node 18+

---

## Install

```bash
npm install @ilytat/ai-manager
```

---

## Quick start

```typescript
import { aiGenerate, createDefaultConfig } from '@ilytat/ai-manager'

const config = createDefaultConfig()

// Enable Gemini and set an API key
const gemini = config.providers.find(p => p.id === 'gemini')!
gemini.enabled = true
gemini.apiKey = process.env.GEMINI_API_KEY!

const text = await aiGenerate('Write a one-sentence bio for a web developer.', config)
console.log(text)
```

---

## Waterfall

When `waterfallEnabled: true`, providers are tried in `order` order. If one fails, the next is tried automatically.

```typescript
config.waterfallEnabled = true

// Set priority: Gemini first, OpenAI as backup
config.providers.find(p => p.id === 'gemini')!.order = 0
config.providers.find(p => p.id === 'openai')!.order = 1
```

---

## Test a provider

```typescript
import { testProvider } from '@ilytat/ai-manager'

const result = await testProvider('gemini', config)
// { ok: true, ms: 312 }
// { ok: false, ms: 80, error: 'HTTP 401: API key invalid' }
```

---

## Ollama (local)

```typescript
const ollama = config.providers.find(p => p.id === 'ollama')!
ollama.enabled = true
ollama.model = 'llama3.2'
ollama.baseUrl = 'http://localhost:11434'  // default
```

---

## Persistence

The package is stateless — config is passed in, not stored. Wire in any storage:

```typescript
// Example: store config in a JSON file
import { readFile, writeFile } from 'fs/promises'
import { createDefaultConfig } from '@ilytat/ai-manager'
import type { AiManagerConfig } from '@ilytat/ai-manager'

async function loadConfig(): Promise<AiManagerConfig> {
  try {
    const raw = await readFile('ai-config.json', 'utf8')
    return JSON.parse(raw)
  } catch {
    return createDefaultConfig()
  }
}

async function saveConfig(config: AiManagerConfig) {
  await writeFile('ai-config.json', JSON.stringify(config, null, 2))
}
```

---

## Custom OpenAI-compatible endpoint

Any OpenAI-compatible API (LM Studio, vLLM, Together AI, etc.) works via the `openai` provider with a custom `baseUrl`:

```typescript
const openai = config.providers.find(p => p.id === 'openai')!
openai.enabled = true
openai.apiKey = 'your-key'
openai.model = 'meta-llama/Llama-3-8b-chat-hf'
openai.baseUrl = 'https://api.together.xyz/v1'
```

---

## All exports

```typescript
// Core functions
aiGenerate(prompt: string, config: AiManagerConfig): Promise<string>
testProvider(id: ProviderId, config: AiManagerConfig): Promise<TestResult>

// Config helpers
createDefaultConfig(): AiManagerConfig
PROVIDER_META: Record<ProviderId, ProviderMeta>
PROVIDER_IDS: ProviderId[]
ADAPTERS: Record<ProviderId, Adapter>  // call a single provider directly

// Types
ProviderId, ProviderConfig, AiManagerConfig, TestResult, ProviderMeta
```

---

## Build (for publishing)

```bash
npm run build   # compiles src/ → dist/
```

Update `package.json` exports to point to `dist/` before publishing to npm.
