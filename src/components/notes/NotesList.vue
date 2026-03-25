<script setup lang="ts">
import { ref } from 'vue'
import type { Note, NoteFilter } from '@/types/note'
import { useNoteStore } from '@/stores/notes'
import NoteCard from './NoteCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import BaseInput from '@/components/shared/BaseInput.vue'

const props = defineProps<{
  notes: Note[]
  selectedNoteId?: string | null
  filter?: NoteFilter
}>()

const emit = defineEmits<{
  noteClick: [id: string]
  createNote: []
}>()

const noteStore = useNoteStore()
const searchQuery = ref('')

function handleSearch(q: string) {
  searchQuery.value = q
  noteStore.setFilter({ ...noteStore.activeFilter, searchQuery: q || undefined })
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Search + Create -->
    <div class="flex items-center gap-2 p-3 border-b border-zinc-800/50">
      <div class="flex-1">
        <BaseInput
          :model-value="searchQuery"
          placeholder="Search notes..."
          @update:model-value="handleSearch"
        >
          <template #prefix>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </template>
        </BaseInput>
      </div>
      <button
        @click="emit('createNote')"
        class="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-all duration-150 active:scale-90 flex-shrink-0"
        aria-label="Create new note"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Notes list -->
    <div class="flex-1 overflow-y-auto p-3 space-y-2">
      <EmptyState
        v-if="notes.length === 0"
        title="No notes yet"
        description="Create a note to capture your thoughts."
        action-label="New note"
        action-icon="M12 4v16m8-8H4"
        @action="emit('createNote')"
      />

      <NoteCard
        v-for="note in notes"
        :key="note.id"
        :note="note"
        :selected="selectedNoteId === note.id"
        @click="emit('noteClick', $event)"
      />
    </div>
  </div>
</template>
