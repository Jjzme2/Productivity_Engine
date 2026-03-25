<script setup lang="ts">
import { watch, nextTick } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNlpStore } from '@/stores/useNlpStore'
import { useNlpInput } from '@/composables/useNlpInput'
import NlpInput from '@/components/nlp/NlpInput.vue'
import IntentConfirm from '@/components/nlp/IntentConfirm.vue'
import SuggestionChips from '@/components/nlp/SuggestionChips.vue'
import { ref } from 'vue'

const app      = useAppStore()
const nlpStore = useNlpStore()
const { submitInput, confirmIntent } = useNlpInput()

const inputRef = ref<InstanceType<typeof NlpInput> | null>(null)

watch(() => app.commandBarOpen, async (open) => {
  if (open) {
    nlpStore.dismissIntent()
    nlpStore.clearResult()
    nlpStore.setInput('')
    await nextTick()
    inputRef.value?.focus()
  }
})

async function handleSubmit(text: string) {
  if (!text.trim()) return
  nlpStore.setInput(text)
  await submitInput()
}

async function handleConfirm() {
  await confirmIntent()
}

function handleEdit() {
  nlpStore.dismissIntent()
}

function handleDismiss() {
  app.closeCommandBar()
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) app.closeCommandBar()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cmd-bar">
      <div
        v-if="app.commandBarOpen"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
        style="background: rgba(9, 9, 11, 0.85);"
        role="dialog"
        aria-modal="true"
        aria-label="Command bar"
        @click="handleBackdropClick"
        @keydown.esc="app.closeCommandBar"
      >
        <Transition name="cmd-bar-card">
          <div
            v-if="app.commandBarOpen"
            class="w-full max-w-2xl bg-zinc-900 border border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden"
            @click.stop
          >
            <!-- Input -->
            <div class="p-4">
              <NlpInput
                ref="inputRef"
                @submit="handleSubmit"
              />
            </div>

            <!-- Processing indicator -->
            <Transition name="intent">
              <div v-if="nlpStore.isProcessing" class="px-4 pb-3">
                <div class="flex items-center gap-2 text-sm text-zinc-400">
                  <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing…
                </div>
              </div>
            </Transition>

            <!-- Intent confirm -->
            <Transition name="intent">
              <div v-if="nlpStore.pendingIntent && !nlpStore.isProcessing" class="px-4 pb-3">
                <IntentConfirm
                  :summary="nlpStore.pendingIntent.interpretation"
                  :confidence="nlpStore.pendingIntent.confidence"
                  :action-type="nlpStore.pendingIntent.action"
                  @confirm="handleConfirm"
                  @edit="handleEdit"
                  @dismiss="handleDismiss"
                />
              </div>
            </Transition>

            <!-- Input error -->
            <Transition name="intent">
              <div v-if="nlpStore.inputError" class="px-4 pb-3">
                <div class="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ nlpStore.inputError }}
                </div>
              </div>
            </Transition>

            <!-- Result -->
            <Transition name="intent">
              <div v-if="nlpStore.lastResult" class="px-4 pb-3">
                <div
                  class="flex items-center gap-2 text-sm rounded-xl px-3 py-2 border"
                  :class="nlpStore.lastResult.success
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-red-400 bg-red-500/10 border-red-500/20'"
                >
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path v-if="nlpStore.lastResult.success" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {{ nlpStore.lastResult.message ?? (nlpStore.lastResult.success ? 'Done' : 'Failed') }}
                </div>
              </div>
            </Transition>

            <!-- Suggestion chips -->
            <div class="px-4 pb-4 border-t border-zinc-800/50 pt-3">
              <SuggestionChips @select="handleSubmit" />
            </div>

            <!-- Keyboard hint -->
            <div class="px-4 pb-3 flex items-center justify-between">
              <div class="flex items-center gap-3 text-xs text-zinc-600">
                <span class="flex items-center gap-1">
                  <kbd class="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">↑↓</kbd>
                  navigate
                </span>
                <span class="flex items-center gap-1">
                  <kbd class="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">↵</kbd>
                  confirm
                </span>
                <span class="flex items-center gap-1">
                  <kbd class="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Esc</kbd>
                  close
                </span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
