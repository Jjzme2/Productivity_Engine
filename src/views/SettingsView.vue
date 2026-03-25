<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import BaseCard from '@/components/shared/BaseCard.vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'

const app = useAppStore()

// Local copies of settings
const theme = ref(app.theme)
const aiProvider = ref(app.aiProvider)
const ollamaModel = ref(app.ollamaModel)
const aiProviderMode = ref(app.aiProviderMode)
const apiKeyInput = ref('')
const showApiKey = ref(false)

const olLamaLoading = ref(false)
const availableOllamaModels = ref<string[]>([])


onMounted(() => {
  if (aiProvider.value === 'ollama') {
    fetchOllamaModels()
  }
})

watch(aiProvider, (newVal) => {
  if (newVal === 'ollama' && availableOllamaModels.value.length === 0) {
    fetchOllamaModels()
  }
})

async function fetchOllamaModels() {
  olLamaLoading.value = true
  try {
    const res = await fetch('http://localhost:11434/api/tags')
    if (res.ok) {
      const data = await res.json()
      availableOllamaModels.value = data.models?.map((m: any) => m.name) || []
      if (availableOllamaModels.value.length > 0 && (!ollamaModel.value || !availableOllamaModels.value.includes(ollamaModel.value))) {
        ollamaModel.value = availableOllamaModels.value[0] || ''
      }
    }
  } catch (e) {
    console.error('Failed to fetch Ollama models', e)
  } finally {
    olLamaLoading.value = false
  }
}

function saveAppearance() {
  app.theme = theme.value
  app.addToast({ message: 'Appearance saved', variant: 'success' })
}

function saveAiSettings() {
  app.aiProvider = aiProvider.value
  app.ollamaModel = ollamaModel.value
  app.aiProviderMode = aiProviderMode.value
  app.addToast({ message: 'AI settings saved', variant: 'success' })
}


async function wipeLocalMockData() {
  if (!db) {
    app.addToast({ message: 'Firebase not connected', variant: 'error' })
    return
  }
  
  app.addToast({ message: 'Wiping local mock data...', variant: 'info' })
  const collections = ['accounts', 'transactions', 'budgets', 'financial_goals', 'net_worth', 'dates']
  const userId = 'local'
  
  let totalDeleted = 0
  for (const c of collections) {
    try {
      const q = query(collection(db, c), where('userId', '==', userId))
      const snap = await getDocs(q)
      for (const d of snap.docs) {
        await deleteDoc(d.ref)
        totalDeleted++
      }
    } catch (e: any) {
      console.error(`Failed to wipe ${c}:`, e)
      app.addToast({ message: `Failed to wipe ${c}: ${e.message}`, variant: 'error' })
      return
    }
  }
  app.addToast({ message: `Wiped ${totalDeleted} mock documents.`, variant: 'success' })
}

const themes = [
  { id: 'obsidian', label: 'Obsidian', color: '#09090b' },
  { id: 'midnight', label: 'Midnight', color: '#0d1117' },
  { id: 'forest',   label: 'Forest',   color: '#0a1a0a' },
  { id: 'paper',    label: 'Paper',    color: '#fafaf9' },
] as const

const cloudProviders = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'GPT-4o (OpenAI)' },
  { id: 'gemini', label: 'Gemini (Google)' },
] as const
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="max-w-2xl mx-auto px-6 py-8 space-y-8">

      <h1 class="text-2xl font-bold text-zinc-100">Settings</h1>

      <!-- Appearance -->
      <BaseCard class="p-5 space-y-4">
        <h2 class="text-sm font-semibold text-zinc-300">Appearance</h2>
        <div>
          <label class="text-xs font-medium text-zinc-400 mb-2 block">Theme</label>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="t in themes"
              :key="t.id"
              @click="theme = t.id"
              class="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all duration-150"
              :class="theme === t.id
                ? 'border-indigo-500/50 bg-indigo-500/10'
                : 'border-zinc-800/50 hover:border-zinc-700/50'"
            >
              <div class="w-8 h-8 rounded-lg border border-zinc-700/50" :style="{ background: t.color }" />
              <span class="text-[10px] text-zinc-400">{{ t.label }}</span>
            </button>
          </div>
        </div>
        <div class="flex justify-end">
          <BaseButton variant="primary" size="sm" @click="saveAppearance">Save</BaseButton>
        </div>
      </BaseCard>

      <!-- AI Provider -->
      <BaseCard class="p-5 space-y-4">
        <h2 class="text-sm font-semibold text-zinc-300">AI Provider</h2>

        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Mode</label>
          <div class="flex gap-2">
            <button
              v-for="mode in ['local_first', 'cloud_first'] as const"
              :key="mode"
              @click="aiProviderMode = mode"
              class="flex-1 py-2 text-xs font-medium rounded-xl border transition-all duration-150"
              :class="aiProviderMode === mode
                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                : 'border-zinc-800/50 text-zinc-500 hover:text-zinc-300'"
            >
              {{ mode === 'local_first' ? 'Local first (Ollama)' : 'Cloud first' }}
            </button>
          </div>
        </div>

        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Cloud provider</label>
          <div class="space-y-1.5">
            <!-- Add Ollama explicitly to the list for local first -->
            <label
              class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150"
              :class="aiProvider === 'ollama'
                ? 'border-indigo-500/40 bg-indigo-500/10'
                : 'border-zinc-800/50 hover:border-zinc-700/50'"
            >
              <input type="radio" value="ollama" v-model="aiProvider" class="sr-only" />
              <div
                class="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all"
                :class="aiProvider === 'ollama' ? 'border-indigo-400 bg-indigo-400' : 'border-zinc-600'"
              />
              <span class="text-sm text-zinc-200">Local (Ollama)</span>
            </label>
            <label
              v-for="p in cloudProviders"
              :key="p.id"
              class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150"
              :class="aiProvider === p.id
                ? 'border-indigo-500/40 bg-indigo-500/10'
                : 'border-zinc-800/50 hover:border-zinc-700/50'"
            >
              <input type="radio" :value="p.id" v-model="aiProvider" class="sr-only" />
              <div
                class="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all"
                :class="aiProvider === p.id ? 'border-indigo-400 bg-indigo-400' : 'border-zinc-600'"
              />
              <span class="text-sm text-zinc-200">{{ p.label }}</span>
            </label>
          </div>
        </div>

        <div v-if="aiProvider === 'ollama'">
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Ollama Model</label>
          <div v-if="olLamaLoading" class="text-xs text-zinc-500 py-2">Loading models...</div>
          <select
            v-else
            v-model="ollamaModel"
            class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option v-if="availableOllamaModels.length === 0" :value="ollamaModel" disabled>
              {{ ollamaModel || 'No models found locally' }}
            </option>
            <option v-for="model in availableOllamaModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
          <div class="flex items-center justify-between mt-1">
            <p class="text-xs text-zinc-600">Make sure the model is pulled locally via Ollama.</p>
            <button @click="fetchOllamaModels" class="text-xs text-indigo-400 hover:text-indigo-300">Refresh</button>
          </div>
        </div>

        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">API Key</label>
          <div class="relative">
            <input
              v-model="apiKeyInput"
              :type="showApiKey ? 'text' : 'password'"
              placeholder="sk-..."
              class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 pr-10"
            />
            <button
              @click="showApiKey = !showApiKey"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              :aria-label="showApiKey ? 'Hide API key' : 'Show API key'"
            >
              <svg v-if="showApiKey" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
          <p class="text-xs text-zinc-600 mt-1">Stored securely in system keychain via Tauri</p>
        </div>

        <div class="flex justify-end">
          <BaseButton variant="primary" size="sm" @click="saveAiSettings">Save</BaseButton>
        </div>
      </BaseCard>

      <!-- Danger zone -->
      <BaseCard class="p-5 border-rose-500/20 space-y-3">
        <h2 class="text-sm font-semibold text-rose-400">Danger Zone</h2>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-zinc-300">Clear all local data</p>
            <p class="text-xs text-zinc-500">Permanently removes tasks, habits, notes, and events from local storage.</p>
          </div>
          <BaseButton
            variant="ghost"
            size="sm"
            class="text-rose-400 hover:bg-rose-500/10 border-rose-500/30"
            @click="app.addToast({ message: 'Not implemented yet', variant: 'warning' })"
          >
            Clear data
          </BaseButton>
        </div>

        <div class="flex items-center justify-between border-t border-rose-500/10 pt-3 mt-3">
          <div>
            <p class="text-sm text-zinc-300">Wipe Backend Mock Data</p>
            <p class="text-xs text-zinc-500">Deletes 'local' userId records from Firebase for Finances & Dates.</p>
          </div>
          <BaseButton
            variant="ghost"
            size="sm"
            class="text-rose-400 hover:bg-rose-500/10 border-rose-500/30"
            @click="wipeLocalMockData"
          >
            Wipe Firebase
          </BaseButton>
        </div>
      </BaseCard>

    </div>
  </div>
</template>
