<script setup lang="ts">
import { ref } from 'vue'
import { useNoteStore } from '@/stores/notes'
import NotesList from '@/components/notes/NotesList.vue'
import NoteEditor from '@/components/notes/NoteEditor.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const noteStore = useNoteStore()

const selectedNoteId = ref<string | null>(null)

async function handleNoteClick(id: string) {
  selectedNoteId.value = id
  const note = noteStore.notes.find(n => n.id === id) ?? null
  await noteStore.setActiveNote(note)
}

async function handleCreateNote() {
  const note = await noteStore.createNote({ title: 'Untitled note', content: '', tags: [], links: [] })
  selectedNoteId.value = note.id
  noteStore.setActiveNote(note)
}
</script>

<template>
  <div class="h-full flex overflow-hidden">
    <!-- Notes list sidebar -->
    <div
      class="flex-shrink-0 border-r border-zinc-800/50 bg-zinc-950"
      :class="noteStore.activeNote ? 'hidden sm:flex sm:flex-col sm:w-72' : 'flex flex-col w-full sm:w-72'"
    >
      <NotesList
        :notes="noteStore.filteredNotes"
        :selected-note-id="selectedNoteId"
        @note-click="handleNoteClick"
        @create-note="handleCreateNote"
      />
    </div>

    <!-- Note editor -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Back button on mobile -->
      <div v-if="noteStore.activeNote" class="sm:hidden flex items-center px-4 py-2 border-b border-zinc-800/50">
        <button
          @click="selectedNoteId = null; noteStore.setActiveNote(null)"
          class="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to notes
        </button>
      </div>

      <NoteEditor :note="noteStore.activeNote" />

      <!-- Empty state when no note selected and no notes -->
      <div v-if="!noteStore.activeNote && noteStore.filteredNotes.length === 0" class="flex-1 flex items-center justify-center">
        <EmptyState
          title="No notes yet"
          description="Create your first note to get started."
          action-label="New note"
          action-icon="M12 4v16m8-8H4"
          @action="handleCreateNote"
        />
      </div>
    </div>
  </div>
</template>
