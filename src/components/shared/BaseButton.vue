<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue'

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>()

const emit = defineEmits<{
  click: [e: MouseEvent]
}>()

const variantClasses: Record<string, string> = {
  primary:   'bg-indigo-500 hover:bg-indigo-600 text-white border border-indigo-500/50 shadow-sm hover:shadow-glow-primary-sm',
  secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700/60',
  ghost:     'bg-transparent hover:bg-zinc-800/60 text-zinc-300 hover:text-zinc-100 border border-transparent hover:border-zinc-700/40',
  danger:    'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 hover:border-rose-500/50',
}

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-xl gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2',
}

const spinnerSize = { sm: 'sm', md: 'sm', lg: 'md' } as const
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled || loading"
    class="relative inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 select-none"
    :class="[
      variantClasses[variant ?? 'secondary'],
      sizeClasses[size ?? 'md'],
      (disabled || loading) ? 'opacity-50 cursor-not-allowed active:scale-100' : 'cursor-pointer',
    ]"
    :aria-busy="loading"
    :aria-disabled="disabled || loading"
    @click="!disabled && !loading && emit('click', $event)"
  >
    <!-- Loading overlay -->
    <span
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-inherit"
      aria-hidden="true"
    >
      <LoadingSpinner :size="spinnerSize[size ?? 'md']" />
    </span>

    <!-- Content -->
    <span :class="loading ? 'invisible' : ''" class="inline-flex items-center" :style="`gap: inherit`">
      <slot name="icon" />
      <slot />
    </span>
  </button>
</template>
