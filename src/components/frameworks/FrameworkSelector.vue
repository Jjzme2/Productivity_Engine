<script setup lang="ts">
import { useFrameworkStore } from '@/stores/frameworks'
import type { Framework } from '@/stores/frameworks'
import BaseCard from '@/components/shared/BaseCard.vue'

const emit = defineEmits<{
  select: [id: string]
  create: []
}>()

const fw = useFrameworkStore()

function handleSelect(framework: Framework) {
  fw.startSession(framework.id)
  emit('select', framework.id)
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-zinc-100">Productivity Frameworks</h1>
      <p class="text-sm text-zinc-500 mt-1">Choose a framework to guide your work session</p>
    </div>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
      <!-- Framework cards -->
      <button
        v-for="framework in fw.allFrameworks"
        :key="framework.id"
        @click="handleSelect(framework)"
        class="group flex flex-col text-left bg-zinc-900 border border-zinc-800/50 rounded-2xl p-5 transition-all duration-200 hover:border-zinc-700/60 hover:shadow-card-hover hover:shadow-indigo-500/10 active:scale-[0.98]"
        :aria-label="`Start ${framework.name} framework`"
      >
        <!-- Icon -->
        <div class="text-3xl mb-4 group-hover:scale-110 transition-transform duration-200" aria-hidden="true">
          {{ framework.icon }}
        </div>

        <!-- Name -->
        <h3 class="text-sm font-semibold text-zinc-100 mb-1">{{ framework.name }}</h3>

        <!-- Description -->
        <p class="text-xs text-zinc-500 leading-relaxed flex-1">{{ framework.description }}</p>

        <!-- Meta -->
        <div class="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/50">
          <svg class="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-xs text-zinc-600">~{{ framework.estimatedMinutes }}m</span>
          <span
            v-if="!framework.isBuiltin"
            class="ml-auto text-[10px] text-indigo-400/70 bg-indigo-500/10 px-1.5 py-0.5 rounded-md"
          >
            Custom
          </span>
        </div>
      </button>

      <!-- Create custom -->
      <button
        @click="emit('create')"
        class="flex flex-col items-center justify-center text-center bg-zinc-900/40 border border-zinc-800/30 border-dashed rounded-2xl p-5 transition-all duration-200 hover:border-indigo-500/30 hover:bg-indigo-500/5 active:scale-[0.98] text-zinc-600 hover:text-indigo-400"
        aria-label="Create custom framework"
      >
        <svg class="w-8 h-8 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
        </svg>
        <span class="text-sm font-medium">Create custom</span>
        <span class="text-xs mt-1 text-zinc-700">Build your own workflow</span>
      </button>
    </div>
  </div>
</template>
