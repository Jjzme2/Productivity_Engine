<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import type { Note, UpdateNotePayload } from '@/types/note'
import { useNoteStore } from '@/stores/notes'

const props = defineProps<{
  note: Note | null
}>()

const noteStore = useNoteStore()

type SaveStatus = 'idle' | 'saving' | 'saved'
const saveStatus = ref<SaveStatus>('idle')
let saveTimer: ReturnType<typeof setTimeout> | null = null

const wordCount = ref(0)

/**
 * Tracks whether the editor has received meaningful content for the current note.
 * Prevents reactive content changes (e.g. from store syncs) from overwriting
 * the user's in-progress edits.
 */
let hasLoadedContent = false

const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: 'Start writing...' }),
    Link.configure({ openOnClick: false }),
  ],
  content: props.note?.content ? JSON.parse(props.note.content) : '',
  editorProps: {
    attributes: {
      class: 'tiptap-editor-content outline-none h-full',
    },
  },
  onUpdate({ editor: e }) {
    hasLoadedContent = true
    wordCount.value = e.storage.characterCount?.words() ?? e.getText().split(/\s+/).filter(Boolean).length
    scheduleSave(e.getJSON())
  },
})

function scheduleSave(content: object) {
  if (!props.note) return
  saveStatus.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const payload: UpdateNotePayload = {
      id: props.note!.id,
      content: JSON.stringify(content),
    }
    noteStore.updateNote(payload)
    saveStatus.value = 'saved'
    setTimeout(() => { saveStatus.value = 'idle' }, 2000)
  }, 500)
}

// Reset editor content when switching to a different note
watch(() => props.note?.id, (newId, oldId) => {
  if (!editor.value || !props.note) return
  hasLoadedContent = false
  if (newId !== oldId) {
    const content = props.note.content ? JSON.parse(props.note.content) : ''
    editor.value.commands.setContent(content, false)
    if (props.note.content && props.note.content !== '{}') {
      hasLoadedContent = true
    }
  }
})

// Handle async content arriving from local vault (via setActiveNote)
watch(() => props.note?.content, (newContent) => {
  if (hasLoadedContent || !editor.value || !newContent || newContent === '{}') return
  try {
    editor.value.commands.setContent(JSON.parse(newContent), false)
    hasLoadedContent = true
  } catch { /* malformed content, ignore */ }
})

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
  editor.value?.destroy()
})

type ToolbarAction = {
  label: string
  icon: string
  action: () => void
  isActive?: () => boolean
}

const toolbarActions = computed((): ToolbarAction[] => {
  if (!editor.value) return []
  return [
    {
      label: 'Bold',
      icon: 'B',
      action: () => editor.value!.chain().focus().toggleBold().run(),
      isActive: () => editor.value!.isActive('bold'),
    },
    {
      label: 'Italic',
      icon: 'I',
      action: () => editor.value!.chain().focus().toggleItalic().run(),
      isActive: () => editor.value!.isActive('italic'),
    },
    {
      label: 'Strikethrough',
      icon: 'S̶',
      action: () => editor.value!.chain().focus().toggleStrike().run(),
      isActive: () => editor.value!.isActive('strike'),
    },
    {
      label: 'Code',
      icon: '<>',
      action: () => editor.value!.chain().focus().toggleCode().run(),
      isActive: () => editor.value!.isActive('code'),
    },
    {
      label: 'Bullet list',
      icon: '•—',
      action: () => editor.value!.chain().focus().toggleBulletList().run(),
      isActive: () => editor.value!.isActive('bulletList'),
    },
    {
      label: 'Ordered list',
      icon: '1.',
      action: () => editor.value!.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.value!.isActive('orderedList'),
    },
    {
      label: 'Blockquote',
      icon: '"',
      action: () => editor.value!.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.value!.isActive('blockquote'),
    },
  ]
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Empty state -->
    <div v-if="!note" class="flex-1 flex items-center justify-center text-zinc-600">
      <div class="text-center">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm">Select a note to edit</p>
      </div>
    </div>

    <template v-else>
      <!-- Toolbar -->
      <div class="flex items-center gap-1 px-4 py-2 border-b border-zinc-800/50 flex-wrap">
        <button
          v-for="action in toolbarActions"
          :key="action.label"
          @click="action.action()"
          class="w-7 h-7 rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center"
          :class="action.isActive?.()
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'"
          :aria-label="action.label"
          :aria-pressed="action.isActive?.()"
        >
          {{ action.icon }}
        </button>

        <!-- Save status -->
        <div class="ml-auto flex items-center gap-1.5 text-xs" aria-live="polite" role="status">
          <template v-if="saveStatus === 'saving'">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
            <span class="text-zinc-500">Saving...</span>
          </template>
          <template v-else-if="saveStatus === 'saved'">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <span class="text-zinc-500">Saved</span>
          </template>
          <span class="text-zinc-700 ml-2">{{ wordCount }} words</span>
        </div>
      </div>

      <!-- Title input -->
      <div class="px-6 pt-5 pb-2 border-b border-zinc-800/30">
        <input
          :value="note.title"
          @input="noteStore.updateNote({ id: note.id, title: ($event.target as HTMLInputElement).value })"
          class="w-full text-2xl font-bold text-zinc-100 bg-transparent focus:outline-none placeholder-zinc-700"
          placeholder="Untitled"
          aria-label="Note title"
        />
      </div>

      <!-- Editor content -->
      <div class="flex-1 overflow-y-auto px-6 py-4 tiptap-editor">
        <EditorContent :editor="editor" class="h-full" />
      </div>
    </template>
  </div>
</template>
