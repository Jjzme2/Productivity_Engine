<script setup lang="ts">
import { computed } from 'vue'
import { useFrameworkStore } from '@/stores/frameworks'
import { useAppStore } from '@/stores/app'
import FrameworkSelector from '@/components/frameworks/FrameworkSelector.vue'
import PomodoroView from '@/components/frameworks/builtin/PomodoroView.vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import BaseModal from '@/components/shared/BaseModal.vue'
import { ref } from 'vue'

const fw = useFrameworkStore()
const app = useAppStore()
const showCreateModal = ref(false)
const newFrameworkName = ref('')
const newFrameworkDesc = ref('')
const newFrameworkMinutes = ref(60)

const activeSession = computed(() => fw.activeSession)
const activeFramework = computed(() => fw.activeFramework)

function handleSelect(_id: string) {
  // startSession already called in FrameworkSelector
}

function handleEndSession() {
  fw.stopSession()
  app.addToast({ message: 'Session ended', variant: 'info' })
}

function handleCreateCustom() {
  showCreateModal.value = true
}

function submitCustomFramework() {
  if (!newFrameworkName.value.trim()) return
  fw.saveCustomFramework({
    type: 'custom' as const, name: newFrameworkName.value.trim(), icon: '⚡',
    description: newFrameworkDesc.value.trim(),
    estimatedMinutes: newFrameworkMinutes.value,
    steps: [],
  })
  app.addToast({ message: 'Framework created', variant: 'success' })
  showCreateModal.value = false
  newFrameworkName.value = ''
  newFrameworkDesc.value = ''
  newFrameworkMinutes.value = 60
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Top bar when session is active -->
    <div
      v-if="activeSession"
      class="flex items-center justify-between px-6 py-3 border-b border-zinc-800/50 flex-shrink-0 bg-indigo-500/5"
    >
      <div class="flex items-center gap-3">
        <div class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span class="text-sm font-medium text-zinc-200">{{ activeFramework?.name }}</span>
        <span class="text-xs text-zinc-500">session active</span>
      </div>
      <BaseButton variant="ghost" size="sm" @click="handleEndSession">End session</BaseButton>
    </div>

    <!-- Framework selector or active session view -->
    <div class="flex-1 overflow-y-auto">
      <!-- Active Pomodoro session -->
      <PomodoroView
        v-if="activeSession && activeFramework?.type === 'pomodoro'"
      />

      <!-- Active non-Pomodoro session (basic display) -->
      <div
        v-else-if="activeSession && activeFramework"
        class="max-w-2xl mx-auto px-6 py-8 space-y-6"
      >
        <div class="text-center space-y-2">
          <span class="text-5xl">{{ activeFramework.icon }}</span>
          <h2 class="text-xl font-bold text-zinc-100">{{ activeFramework.name }}</h2>
          <p class="text-sm text-zinc-400">{{ activeFramework.description }}</p>
        </div>

        <div v-if="activeFramework.steps?.length" class="space-y-3">
          <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Steps</h3>
          <div
            v-for="(step, idx) in activeFramework.steps"
            :key="step.id"
            class="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800/50"
          >
            <div
              class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              :class="idx < (activeSession.currentStep ?? 0)
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : idx === (activeSession.currentStep ?? 0)
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'bg-zinc-800/60 text-zinc-600 border border-zinc-700/30'"
            >
              {{ idx + 1 }}
            </div>
            <span class="text-sm text-zinc-300">{{ step.label }}</span>
            <span v-if="step.durationMinutes" class="ml-auto text-xs text-zinc-600">
              {{ step.durationMinutes }}m
            </span>
          </div>
        </div>
      </div>

      <!-- Framework selector (no active session) -->
      <FrameworkSelector
        v-else
        @select="handleSelect"
        @create="handleCreateCustom"
      />
    </div>

    <!-- Create custom framework modal -->
    <BaseModal v-model="showCreateModal" title="Create Custom Framework">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Name</label>
          <input
            v-model="newFrameworkName"
            type="text"
            placeholder="My workflow..."
            class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            autofocus
          />
        </div>
        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Description</label>
          <textarea
            v-model="newFrameworkDesc"
            rows="2"
            placeholder="What does this framework help you achieve?"
            class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
          />
        </div>
        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Estimated duration (min)</label>
          <input
            v-model.number="newFrameworkMinutes"
            type="number"
            min="5"
            max="480"
            class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <BaseButton variant="ghost" @click="showCreateModal = false">Cancel</BaseButton>
          <BaseButton variant="primary" @click="submitCustomFramework" :disabled="!newFrameworkName.trim()">
            Create
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
