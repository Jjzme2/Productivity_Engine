<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { Toast } from '@/stores/app'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  toast: Toast
}>()

const app = useAppStore()
const progress = ref(100)
const duration = computed(() => props.toast.durationMs ?? 4000)

const variantConfig: Record<string, { icon: string; classes: string }> = {
  success: {
    icon: 'M5 13l4 4L19 7',
    classes: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
  },
  error: {
    icon: 'M6 18L18 6M6 6l12 12',
    classes: 'bg-rose-500/15 border-rose-500/25 text-rose-300',
  },
  warning: {
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    classes: 'bg-amber-500/15 border-amber-500/25 text-amber-300',
  },
  info: {
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    classes: 'bg-sky-500/15 border-sky-500/25 text-sky-300',
  },
}

const config = computed(() => variantConfig[props.toast.variant] ?? variantConfig.info)

onMounted(() => {
  if (duration.value > 0) {
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      progress.value = Math.max(0, 100 - (elapsed / duration.value) * 100)
      if (progress.value > 0) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
})
</script>

<template>
  <div
    role="alert"
    aria-live="polite"
    class="flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-lg min-w-[280px] max-w-[360px] overflow-hidden relative"
    :class="config.classes"
  >
    <!-- Icon -->
    <div class="w-5 h-5 flex-shrink-0 mt-0.5">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" :d="config.icon" />
      </svg>
    </div>

    <!-- Message -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium leading-snug">{{ toast.title || toast.message }}</p>
      <button
        v-if="toast.action"
        @click="toast.action?.handler(); app.removeToast(toast.id)"
        class="mt-1 text-xs underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
      >
        {{ toast.action.label }}
      </button>
    </div>

    <!-- Dismiss -->
    <button
      @click="app.removeToast(toast.id)"
      class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md opacity-60 hover:opacity-100 transition-opacity"
      aria-label="Dismiss notification"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Progress bar -->
    <div
      v-if="duration > 0"
      class="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 transition-none"
      :style="{ width: `${progress}%` }"
      aria-hidden="true"
    />
  </div>
</template>
