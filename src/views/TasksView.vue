<script setup lang="ts">
import { ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useAppStore } from '@/stores/app'
import TaskFilters from '@/components/tasks/TaskFilters.vue'
import TaskBoard from '@/components/tasks/TaskBoard.vue'
import TaskDetail from '@/components/tasks/TaskDetail.vue'
import TaskPriorityMatrix from '@/components/tasks/TaskPriorityMatrix.vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import BaseModal from '@/components/shared/BaseModal.vue'

const taskStore = useTaskStore()
const app = useAppStore()

const selectedTaskId = ref<string | null>(null)
const showMatrix = ref(false)
const showCreateModal = ref(false)
const newTaskTitle = ref('')

function handleTaskClick(id: string) {
  selectedTaskId.value = id
}

function handleTaskComplete(id: string) {
  taskStore.completeTask(id)
  app.addToast({ message: 'Task completed', variant: 'success' })
  if (selectedTaskId.value === id) selectedTaskId.value = null
}

function handleTaskDelete(id: string) {
  taskStore.deleteTask(id)
  app.addToast({ message: 'Task archived', variant: 'info' })
  if (selectedTaskId.value === id) selectedTaskId.value = null
}

function handleCreateTask() {
  if (!newTaskTitle.value.trim()) return
  taskStore.createTask({ title: newTaskTitle.value.trim(), tags: [] })
  app.addToast({ message: 'Task created', variant: 'success' })
  newTaskTitle.value = ''
  showCreateModal.value = false
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 flex-shrink-0">
      <h1 class="text-lg font-semibold text-zinc-100">Tasks</h1>
      <div class="flex items-center gap-2">
        <BaseButton
          variant="ghost"
          size="sm"
          @click="showMatrix = !showMatrix"
          :class="showMatrix ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' : ''"
        >
          Matrix
        </BaseButton>
        <BaseButton variant="primary" size="sm" @click="showCreateModal = true">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New task
        </BaseButton>
      </div>
    </div>

    <!-- Filters bar -->
    <TaskFilters class="flex-shrink-0" />

    <!-- Content area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Board or Matrix -->
      <div class="flex-1 overflow-hidden">
        <TaskPriorityMatrix
          v-if="showMatrix"
          @filter-quadrant="(q) => { if (q) taskStore.setFilter({ eisenhowerQuadrant: [q] }); else taskStore.clearFilter() }"
        />
        <TaskBoard
          v-else
          :tasks="taskStore.filteredTasks"
          @task-click="handleTaskClick"
          @task-edit="handleTaskClick"
          @task-complete="handleTaskComplete"
          @task-delete="handleTaskDelete"
        />
      </div>

      <!-- Detail panel -->
      <Transition name="slide-in">
        <div
          v-if="selectedTaskId"
          class="w-full lg:w-96 border-l border-zinc-800/50 flex-shrink-0 overflow-y-auto bg-zinc-950"
        >
          <TaskDetail
            :task-id="selectedTaskId"
            @close="selectedTaskId = null"
          />
        </div>
      </Transition>
    </div>

    <!-- Create task modal -->
    <BaseModal v-model="showCreateModal" title="New Task">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Title</label>
          <input
            v-model="newTaskTitle"
            type="text"
            placeholder="Task title..."
            class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            @keydown.enter="handleCreateTask"
            autofocus
          />
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <BaseButton variant="ghost" @click="showCreateModal = false">Cancel</BaseButton>
          <BaseButton variant="primary" @click="handleCreateTask" :disabled="!newTaskTitle.trim()">
            Create
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.slide-in-enter-active,
.slide-in-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-in-enter-from,
.slide-in-leave-to {
  transform: translateX(24px);
  opacity: 0;
}
</style>
