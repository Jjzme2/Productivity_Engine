<script setup lang="ts">
import { watch, nextTick, ref } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const dialogRef = ref<HTMLElement | null>(null)

const sizeClass: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    await nextTick()
    dialogRef.value?.focus()
  }
})

function close() {
  emit('update:modelValue', false)
}

function handleBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) close()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-backdrop">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-40 flex items-center justify-center px-4"
        style="background: rgba(9, 9, 11, 0.7); backdrop-filter: blur(4px);"
        @click="handleBackdrop"
        @keydown="handleKeydown"
        aria-modal="true"
        role="dialog"
        :aria-labelledby="title ? 'modal-title' : undefined"
      >
        <Transition name="modal-card">
          <div
            v-if="modelValue"
            ref="dialogRef"
            tabindex="-1"
            class="w-full bg-zinc-900 border border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden focus:outline-none"
            :class="sizeClass[size ?? 'md']"
            @click.stop
          >
            <!-- Header -->
            <div v-if="title || $slots.header" class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
              <slot name="header">
                <h2 id="modal-title" class="text-base font-semibold text-zinc-100">{{ title }}</h2>
              </slot>
              <button
                @click="close"
                class="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-150"
                aria-label="Close modal"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="px-5 py-4">
              <slot />
            </div>

            <!-- Footer -->
            <div v-if="$slots.footer" class="px-5 py-4 border-t border-zinc-800/50 flex items-center justify-end gap-2">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
