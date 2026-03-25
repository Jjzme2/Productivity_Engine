<script setup lang="ts">
import { computed, ref } from 'vue'
import { errors, dismiss, dismissAll, type AppError } from '@/services/errorReporter'

const expanded = ref(true)

const count = computed(() => errors.value.length)
const hasErrors = computed(() => count.value > 0)

function levelClass(level: AppError['level']) {
  return level === 'error'
    ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : level === 'warn'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20'
}

function levelIcon(level: AppError['level']) {
  return level === 'error' ? '✕' : level === 'warn' ? '⚠' : 'ℹ'
}

function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const expandedStacks = ref<Set<number>>(new Set())
function toggleStack(id: number) {
  if (expandedStacks.value.has(id)) expandedStacks.value.delete(id)
  else expandedStacks.value.add(id)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="hasErrors"
      class="fixed bottom-4 left-4 z-[9999] flex flex-col items-start gap-2"
      style="max-width: min(480px, calc(100vw - 2rem))"
    >
      <!-- Header pill / toggle -->
      <button
        class="flex items-center gap-2 rounded-full bg-red-600/90 border border-red-500/50 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm hover:bg-red-600 transition-colors"
        @click="expanded = !expanded"
        :title="expanded ? 'Collapse error log' : 'Expand error log'"
      >
        <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 font-mono text-[10px]">{{ count }}</span>
        {{ count === 1 ? 'error' : 'errors' }}
        <svg class="w-3 h-3 transition-transform" :class="expanded ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <!-- Error list panel -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="expanded"
          class="w-full rounded-xl bg-zinc-900/95 border border-zinc-700/50 shadow-2xl backdrop-blur-sm overflow-hidden"
        >
          <!-- Panel header -->
          <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
            <span class="text-xs font-semibold text-zinc-300">Error Log</span>
            <button
              class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              @click="dismissAll"
            >Clear all</button>
          </div>

          <!-- Error entries -->
          <div class="overflow-y-auto max-h-72 divide-y divide-zinc-800/60">
            <div
              v-for="err in errors"
              :key="err.id"
              class="px-3 py-2.5 group"
            >
              <div class="flex items-start gap-2">
                <!-- Level badge -->
                <span
                  class="mt-0.5 flex-shrink-0 text-[10px] font-mono font-bold rounded px-1 py-0.5 border"
                  :class="levelClass(err.level)"
                >{{ levelIcon(err.level) }}</span>

                <!-- Message + meta -->
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-zinc-200 break-words leading-relaxed">{{ err.message }}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] text-zinc-600 font-mono">{{ shortTime(err.timestamp) }}</span>
                    <span v-if="err.source" class="text-[10px] text-zinc-600 truncate max-w-[160px]">{{ err.source }}</span>
                    <button
                      v-if="err.stack"
                      class="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                      @click="toggleStack(err.id)"
                    >{{ expandedStacks.has(err.id) ? 'hide trace' : 'trace' }}</button>
                  </div>
                  <!-- Stack trace -->
                  <pre
                    v-if="err.stack && expandedStacks.has(err.id)"
                    class="mt-1.5 text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-all leading-relaxed"
                  >{{ err.stack }}</pre>
                </div>

                <!-- Dismiss -->
                <button
                  class="flex-shrink-0 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 transition-all"
                  @click="dismiss(err.id)"
                  title="Dismiss"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Log file hint -->
          <div class="px-3 py-2 border-t border-zinc-800/60 text-[10px] text-zinc-600">
            Full log: <span class="font-mono">~/.local/share/productivity-engine/logs/</span>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
