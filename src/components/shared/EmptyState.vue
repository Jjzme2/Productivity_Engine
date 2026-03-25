<script setup lang="ts">
import BaseButton from './BaseButton.vue'

defineProps<{
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: string
}>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center py-16 px-6">
    <!-- Icon area / illustration slot -->
    <div class="w-20 h-20 rounded-2xl bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center mb-5">
      <slot name="icon">
        <svg class="w-9 h-9 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </slot>
    </div>

    <!-- Optional illustration slot -->
    <slot name="illustration" />

    <h3 class="text-base font-semibold text-zinc-200 mb-2">{{ title }}</h3>
    <p v-if="description" class="text-sm text-zinc-500 max-w-sm leading-relaxed mb-6">{{ description }}</p>

    <BaseButton
      v-if="actionLabel"
      variant="primary"
      size="md"
      @click="emit('action')"
    >
      <template #icon>
        <svg v-if="actionIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="actionIcon" />
        </svg>
      </template>
      {{ actionLabel }}
    </BaseButton>
  </div>
</template>
