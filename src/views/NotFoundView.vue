<script setup lang="ts">
import { useRouter } from 'vue-router'
import BaseButton from '@/components/shared/BaseButton.vue'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
    <div class="text-center space-y-4">
      <p class="text-7xl font-black text-zinc-800">404</p>
      <h1 class="text-xl font-bold text-zinc-100">Page not found</h1>
      <p class="text-sm text-zinc-500">The page you're looking for doesn't exist.</p>
      <BaseButton variant="primary" @click="router.push('/')">Go home</BaseButton>
    </div>
  </div>
</template>
