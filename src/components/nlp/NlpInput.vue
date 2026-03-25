<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{
  submit: [text: string]
}>()

const app = useAppStore()
const inputRef = ref<HTMLTextAreaElement | null>(null)
const text = ref('')
const recording = ref(false)
const ghostText = ref('Create a task "Call dentist" due Friday, high priority')

const providerColor = computed(() => ({
  claude: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  ollama: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  openai: 'bg-teal-500/15 text-teal-300 border-teal-500/20',
  gemini: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
}[app.aiProvider] ?? 'bg-zinc-700/40 text-zinc-300 border-zinc-600/30'))

const providerLabel = computed(() => ({
  claude: 'Claude',
  ollama: 'Ollama',
  openai: 'GPT-4o',
  gemini: 'Gemini',
}[app.aiProvider] ?? app.aiProvider))

const showGhost = computed(() => !text.value)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (text.value.trim()) {
      emit('submit', text.value.trim())
      text.value = ''
    }
  }
}

async function toggleRecording() {
  recording.value = !recording.value
  if (recording.value) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Real implementation would use Web Speech API or Tauri plugin
      setTimeout(() => {
        stream.getTracks().forEach(t => t.stop())
        recording.value = false
      }, 5000)
    } catch {
      recording.value = false
      app.addToast({ message: 'Microphone access denied', variant: 'error' })
    }
  }
}

function focus() {
  inputRef.value?.focus()
}

onMounted(() => {
  inputRef.value?.focus()
})

defineExpose({ focus })
</script>

<template>
  <div class="relative">
    <!-- Provider badge -->
    <div class="flex items-center justify-between mb-2">
      <p class="text-xs text-zinc-500">
        What would you like to do?
        <span class="text-zinc-600">· Shift+Enter for newline</span>
      </p>
      <div
        class="flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2 py-0.5"
        :class="providerColor"
        role="status"
        :aria-label="`AI provider: ${providerLabel}`"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
        {{ providerLabel }}
      </div>
    </div>

    <!-- Input wrapper -->
    <div class="relative">
      <!-- Ghost text -->
      <div
        v-if="showGhost"
        class="absolute inset-0 px-4 py-3 text-base text-zinc-600 pointer-events-none select-none font-sans leading-relaxed"
        aria-hidden="true"
      >
        {{ ghostText }}
      </div>

      <!-- Actual textarea -->
      <textarea
        ref="inputRef"
        v-model="text"
        rows="2"
        class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none transition-all duration-200 font-sans leading-relaxed pr-12"
        :aria-label="'Natural language input — describe what you want to do'"
        @keydown="handleKeydown"
      />

      <!-- Mic button -->
      <button
        @click="toggleRecording"
        class="absolute right-3 bottom-3 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 active:scale-90"
        :class="recording
          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse-ring'
          : 'bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-600/50'"
        :aria-label="recording ? 'Stop recording' : 'Start voice input'"
        :aria-pressed="recording"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>
    </div>
  </div>
</template>
