<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useFrameworkStore } from '@/stores/frameworks'
import { useTaskStore } from '@/stores/tasks'
import BaseButton from '@/components/shared/BaseButton.vue'

const fw = useFrameworkStore()
const tasks = useTaskStore()

const session = computed(() => fw.activeSession)
const framework = computed(() => fw.activeFramework)

const workMinutes = computed(() => framework.value?.pomodoroWorkMinutes ?? 25)
const shortBreakMinutes = computed(() => framework.value?.pomodoroShortBreakMinutes ?? 5)
const longBreakMinutes = computed(() => framework.value?.pomodoroLongBreakMinutes ?? 15)
const totalIntervals = computed(() => framework.value?.pomodoroIntervalsBeforeLongBreak ?? 4)

let timer: ReturnType<typeof setInterval> | null = null

function tick() {
  if (!session.value?.pomodoroRunning) return
  const newTime = (session.value.pomodoroSecondsLeft ?? 0) - 1
  if (newTime <= 0) {
    handlePhaseComplete()
  } else {
    fw.updateSession({ pomodoroSecondsLeft: newTime })
  }
}

function handlePhaseComplete() {
  const s = session.value!
  let nextPhase = s.pomodoroPhase
  let nextInterval = s.pomodoroInterval
  let nextSeconds = 0

  if (s.pomodoroPhase === 'focus') {
    nextInterval = s.pomodoroInterval + 1
    if (nextInterval > totalIntervals.value) {
      nextPhase = 'long_break'
      nextInterval = 1
      nextSeconds = longBreakMinutes.value * 60
    } else {
      nextPhase = 'short_break'
      nextSeconds = shortBreakMinutes.value * 60
    }
  } else {
    nextPhase = 'focus'
    nextSeconds = workMinutes.value * 60
  }

  fw.updateSession({
    pomodoroPhase: nextPhase,
    pomodoroInterval: nextInterval,
    pomodoroSecondsLeft: nextSeconds,
    pomodoroRunning: false,
  })
}

watch(() => session.value?.pomodoroRunning, (running) => {
  if (running) {
    timer = setInterval(tick, 1000)
  } else {
    if (timer) clearInterval(timer)
  }
})

onUnmounted(() => { if (timer) clearInterval(timer) })

function toggleTimer() {
  fw.updateSession({ pomodoroRunning: !session.value?.pomodoroRunning })
}

function skipPhase() {
  handlePhaseComplete()
}

function stopSession() {
  fw.stopSession()
}

// SVG timer circle
const RADIUS = 88
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const totalSeconds = computed(() => {
  const p = session.value?.pomodoroPhase
  if (p === 'focus') return workMinutes.value * 60
  if (p === 'short_break') return shortBreakMinutes.value * 60
  return longBreakMinutes.value * 60
})

const dashOffset = computed(() => {
  if (!session.value) return CIRCUMFERENCE
  const ratio = session.value.pomodoroSecondsLeft / totalSeconds.value
  return CIRCUMFERENCE * (1 - ratio)
})

const displayTime = computed(() => {
  const s = session.value?.pomodoroSecondsLeft ?? 0
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
})

const phaseLabel = computed(() => {
  const p = session.value?.pomodoroPhase
  if (p === 'focus') return 'FOCUS'
  if (p === 'short_break') return 'SHORT BREAK'
  return 'LONG BREAK'
})

const phaseColor = computed(() => {
  const p = session.value?.pomodoroPhase
  if (p === 'focus') return '#6366f1'
  if (p === 'short_break') return '#10b981'
  return '#8b5cf6'
})

const currentTask = computed(() =>
  tasks.tasks.find(t => t.id === session.value?.selectedTaskId) ?? null
)

const availableTasks = computed(() =>
  tasks.tasks.filter(t => t.status !== 'done' && !t.isArchived).slice(0, 10)
)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center min-h-full p-8 transition-all duration-1000"
    :class="session?.pomodoroRunning && session.pomodoroPhase === 'focus' ? 'breathing' : ''"
  >
    <!-- Phase label -->
    <p class="text-xs font-bold tracking-[0.2em] mb-6" :style="{ color: phaseColor }">
      {{ phaseLabel }}
    </p>

    <!-- SVG Timer -->
    <div class="relative w-56 h-56 mb-8">
      <svg class="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
        <!-- Background ring -->
        <circle
          cx="100" cy="100" :r="RADIUS"
          fill="none"
          stroke="rgba(63,63,70,0.4)"
          stroke-width="8"
        />
        <!-- Progress ring -->
        <circle
          cx="100" cy="100" :r="RADIUS"
          fill="none"
          :stroke="phaseColor"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="dashOffset"
          style="transition: stroke-dashoffset 0.9s linear;"
        />
      </svg>

      <!-- Center content -->
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span
          class="text-5xl font-mono font-bold tabular tracking-tight"
          :style="{ color: phaseColor }"
          role="timer"
          :aria-label="`${displayTime} remaining`"
        >
          {{ displayTime }}
        </span>
      </div>
    </div>

    <!-- Interval indicators -->
    <div class="flex items-center gap-2 mb-8">
      <div
        v-for="i in totalIntervals"
        :key="i"
        class="w-2.5 h-2.5 rounded-full transition-colors duration-300"
        :class="i <= (session?.pomodoroInterval ?? 1)
          ? 'bg-indigo-400'
          : 'bg-zinc-700/60'"
        :aria-label="`Interval ${i}`"
      />
    </div>

    <!-- Current task -->
    <div class="w-full max-w-sm mb-6">
      <p class="text-xs text-zinc-600 mb-2 text-center">Current task</p>
      <div class="bg-zinc-900 border border-zinc-800/50 rounded-xl p-3">
        <p v-if="currentTask" class="text-sm text-zinc-200 text-center">{{ currentTask.title }}</p>
        <select
          v-else
          class="w-full bg-transparent text-sm text-zinc-500 text-center focus:outline-none"
          @change="fw.updateSession({ selectedTaskId: ($event.target as HTMLSelectElement).value || undefined })"
          aria-label="Select a task to work on"
        >
          <option value="">— Select a task —</option>
          <option v-for="t in availableTasks" :key="t.id" :value="t.id">{{ t.title }}</option>
        </select>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-3">
      <BaseButton
        :variant="session?.pomodoroRunning ? 'secondary' : 'primary'"
        size="lg"
        @click="toggleTimer"
        :aria-label="session?.pomodoroRunning ? 'Pause timer' : 'Start timer'"
      >
        <template #icon>
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path v-if="session?.pomodoroRunning"
              d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            <path v-else
              d="M8 5v14l11-7z" />
          </svg>
        </template>
        {{ session?.pomodoroRunning ? 'Pause' : 'Start' }}
      </BaseButton>

      <BaseButton variant="ghost" size="md" @click="skipPhase" aria-label="Skip to next phase">
        <template #icon>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </template>
        Skip
      </BaseButton>

      <BaseButton variant="danger" size="sm" @click="stopSession" aria-label="Stop session">
        Stop
      </BaseButton>
    </div>
  </div>
</template>
