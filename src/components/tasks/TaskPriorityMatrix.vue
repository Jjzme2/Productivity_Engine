<script setup lang="ts">
import { computed } from 'vue'
import type { Task, EisenhowerQuadrant } from '@/types/task'
import { useTaskStore } from '@/stores/tasks'

const emit = defineEmits<{
  filterQuadrant: [quadrant: EisenhowerQuadrant | null]
}>()

const taskStore = useTaskStore()

const quadrants: {
  id: EisenhowerQuadrant
  label: string
  sub: string
  colorBg: string
  colorBorder: string
  colorText: string
}[] = [
  {
    id: 'do_first',
    label: 'Do First',
    sub: 'Urgent + Important',
    colorBg: 'bg-rose-500/8',
    colorBorder: 'border-rose-500/20',
    colorText: 'text-rose-400',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    sub: 'Important, Not Urgent',
    colorBg: 'bg-indigo-500/8',
    colorBorder: 'border-indigo-500/20',
    colorText: 'text-indigo-400',
  },
  {
    id: 'delegate',
    label: 'Delegate',
    sub: 'Urgent, Not Important',
    colorBg: 'bg-amber-500/8',
    colorBorder: 'border-amber-500/20',
    colorText: 'text-amber-400',
  },
  {
    id: 'eliminate',
    label: 'Eliminate',
    sub: 'Not Urgent, Not Important',
    colorBg: 'bg-zinc-800/40',
    colorBorder: 'border-zinc-700/30',
    colorText: 'text-zinc-500',
  },
]

const matrix = computed(() => taskStore.priorityMatrix)

const tasksForQuadrant = (id: EisenhowerQuadrant) => {
  const map: Record<EisenhowerQuadrant, Task[]> = {
    do_first: matrix.value.doFirst,
    schedule: matrix.value.schedule,
    delegate: matrix.value.delegate,
    eliminate: matrix.value.eliminate,
  }
  return map[id] ?? []
}
</script>

<template>
  <div
    class="grid grid-cols-2 gap-3"
    role="region"
    aria-label="Eisenhower priority matrix"
  >
    <!-- Axis labels -->
    <div class="col-span-2 grid grid-cols-2 gap-3 -mb-1 pointer-events-none">
      <p class="text-center text-[11px] text-rose-400/60 font-medium tracking-wide">URGENT</p>
      <p class="text-center text-[11px] text-zinc-600 font-medium tracking-wide">NOT URGENT</p>
    </div>

    <div
      v-for="(q, i) in quadrants"
      :key="q.id"
      class="rounded-2xl border p-3 cursor-pointer transition-all duration-200 hover:scale-[1.01] min-h-[140px] flex flex-col"
      :class="[q.colorBg, q.colorBorder]"
      :aria-label="`${q.label}: ${tasksForQuadrant(q.id).length} tasks`"
      role="button"
      tabindex="0"
      @click="emit('filterQuadrant', q.id)"
      @keydown.enter="emit('filterQuadrant', q.id)"
    >
      <!-- Quadrant header -->
      <div class="flex items-center justify-between mb-2">
        <div>
          <p class="text-xs font-semibold" :class="q.colorText">{{ q.label }}</p>
          <p class="text-[11px] text-zinc-600">{{ q.sub }}</p>
        </div>
        <span
          class="text-xs font-mono font-bold px-1.5 py-0.5 rounded-md bg-zinc-900/60"
          :class="q.colorText"
        >
          {{ tasksForQuadrant(q.id).length }}
        </span>
      </div>

      <!-- Task chips -->
      <div class="flex flex-col gap-1 flex-1 overflow-hidden">
        <div
          v-for="task in tasksForQuadrant(q.id).slice(0, 4)"
          :key="task.id"
          class="text-[11px] text-zinc-300 bg-zinc-900/60 border border-zinc-800/40 rounded-lg px-2 py-1 truncate"
        >
          {{ task.title }}
        </div>
        <div
          v-if="tasksForQuadrant(q.id).length > 4"
          class="text-[11px] text-zinc-600 px-1"
        >
          and {{ tasksForQuadrant(q.id).length - 4 }} more...
        </div>
      </div>

      <!-- Important label (right side) -->
      <p
        v-if="i === 0 || i === 1"
        class="text-[10px] text-emerald-500/40 font-medium mt-1 text-right"
      >
        IMPORTANT
      </p>
    </div>
  </div>
</template>
