<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
}>()

const variantClasses: Record<string, string> = {
  default: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50',
  primary: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  danger:  'bg-rose-500/15 text-rose-300 border-rose-500/25',
  info:    'bg-sky-500/15 text-sky-300 border-sky-500/25',
}

const sizeClasses: Record<string, string> = {
  sm: 'px-1.5 py-0.5 text-[11px] rounded-md',
  md: 'px-2.5 py-1 text-xs rounded-lg',
}
</script>

<template>
  <span
    class="inline-flex items-center font-medium border"
    :class="[variantClasses[variant ?? 'default'], sizeClasses[size ?? 'md']]"
  >
    <slot />
  </span>
</template>
