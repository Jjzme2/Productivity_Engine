<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import BaseToast from './BaseToast.vue'

const app = useAppStore()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <TransitionGroup name="toast" tag="div" class="flex flex-col gap-2 items-end">
        <BaseToast
          v-for="toast in app.activeToasts"
          :key="toast.id"
          :toast="toast"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>
