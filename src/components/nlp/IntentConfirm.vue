<script setup lang="ts">
import BaseButton from '@/components/shared/BaseButton.vue'

const props = defineProps<{
  summary: string
  confidence: number
  actionType: string
}>()

const emit = defineEmits<{
  confirm: []
  edit: []
  dismiss: []
}>()

const actionIconPath: Record<string, string> = {
  task: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  habit: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  note: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  event: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
}

const iconPath = actionIconPath[props.actionType] ?? actionIconPath.task
const confidencePercent = Math.round(props.confidence * 100)
const confidenceColor = props.confidence >= 0.85
  ? 'bg-emerald-500'
  : props.confidence >= 0.6
    ? 'bg-amber-500'
    : 'bg-rose-500'
</script>

<template>
  <div class="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3 space-y-3">
    <!-- Header row -->
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPath" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-0.5">Detected intent</p>
        <p class="text-sm text-zinc-100 leading-relaxed">{{ summary }}</p>
      </div>
    </div>

    <!-- Confidence bar -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-zinc-500">Confidence</span>
        <span class="text-xs font-mono text-zinc-400">{{ confidencePercent }}%</span>
      </div>
      <div class="h-1 w-full bg-zinc-700/50 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="confidenceColor"
          :style="{ width: `${confidencePercent}%` }"
          role="progressbar"
          :aria-valuenow="confidencePercent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Confidence: ${confidencePercent}%`"
        />
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <BaseButton variant="primary" size="sm" @click="emit('confirm')">
        Confirm
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('edit')">
        Edit
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('dismiss')" class="ml-auto text-zinc-500">
        Dismiss
      </BaseButton>
    </div>
  </div>
</template>
