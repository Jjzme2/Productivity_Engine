<script setup lang="ts">
const props = defineProps<{
  size?: 'sm' | 'md' | 'lg'
  color?: string
}>()

const sizeMap: Record<string, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
}

const strokeMap: Record<string, number> = {
  sm: 2.5,
  md: 2,
  lg: 2,
}
</script>

<template>
  <svg
    :class="sizeMap[size ?? 'md']"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    :stroke-width="strokeMap[size ?? 'md']"
    aria-hidden="true"
    role="status"
    style="animation: spin 0.75s linear infinite"
  >
    <circle
      cx="12" cy="12" r="10"
      stroke-opacity="0.2"
    />
    <path
      d="M12 2 A10 10 0 0 1 22 12"
      stroke-linecap="round"
    />
  </svg>
</template>

<style scoped>
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
