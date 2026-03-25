<script setup lang="ts">
const props = defineProps<{
  hoverable?: boolean
  clickable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  glass?: boolean
}>()

const emit = defineEmits<{
  click: [e: MouseEvent]
}>()

const paddingClass: Record<string, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

function handleClick(e: MouseEvent) {
  if (props.clickable) emit('click', e)
}

function handleSpaceKey(e: KeyboardEvent) {
  if (props.clickable) {
    e.preventDefault()
    emit('click', e as unknown as MouseEvent)
  }
}
</script>

<template>
  <div
    class="rounded-2xl border border-zinc-800/50 shadow-card transition-all duration-200"
    :class="[
      glass
        ? 'bg-zinc-800/90'
        : 'bg-zinc-900',
      paddingClass[padding ?? 'md'],
      hoverable || clickable
        ? 'hover:shadow-card-hover hover:shadow-indigo-500/10 hover:border-zinc-700/60'
        : '',
      clickable
        ? 'cursor-pointer active:scale-[0.99] select-none'
        : '',
    ]"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="handleClick"
    @keydown.enter="clickable && handleClick($event as any)"
    @keydown.space="handleSpaceKey"
  >
    <slot />
  </div>
</template>
