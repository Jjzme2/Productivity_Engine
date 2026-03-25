<script setup lang="ts">
import { computed } from 'vue'
import { formatDistanceToNow, parseISO } from 'date-fns'
import type { Note } from '@/types/note'
import BaseBadge from '@/components/shared/BaseBadge.vue'

const props = defineProps<{
  note: Note
  selected?: boolean
}>()

const emit = defineEmits<{
  click: [id: string]
}>()

const formattedDate = computed(() =>
  formatDistanceToNow(parseISO(props.note.updatedAt), { addSuffix: true })
)

const preview = computed(() => props.note.excerpt.slice(0, 100))
</script>

<template>
  <div
    class="group relative bg-zinc-900 border rounded-2xl px-4 py-3 cursor-pointer transition-all duration-200"
    :class="selected
      ? 'border-indigo-500/40 bg-indigo-500/5 shadow-glow-primary-sm'
      : 'border-zinc-800/50 hover:border-zinc-700/60 hover:shadow-card'"
    @click="emit('click', note.id)"
    role="button"
    :aria-selected="selected"
    :aria-label="`Note: ${note.title}`"
    tabindex="0"
    @keydown.enter="emit('click', note.id)"
  >
    <!-- Pin + title row -->
    <div class="flex items-start gap-2 mb-1.5">
      <svg
        v-if="note.isPinned"
        class="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5"
        fill="currentColor" viewBox="0 0 24 24" aria-label="Pinned"
      >
        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
      </svg>
      <h3 class="text-sm font-medium text-zinc-100 truncate flex-1">
        {{ note.title || 'Untitled' }}
      </h3>
    </div>

    <!-- Excerpt -->
    <p class="text-xs text-zinc-500 leading-relaxed line-clamp-2 mb-2">
      {{ preview || 'Empty note' }}
    </p>

    <!-- Footer row -->
    <div class="flex items-center gap-2 flex-wrap">
      <!-- Linked entity -->
      <BaseBadge
        v-if="note.links[0]"
        variant="primary"
        size="sm"
      >
        {{ note.links[0].entityType }}: {{ note.links[0].entityTitle }}
      </BaseBadge>

      <!-- Tags -->
      <span
        v-for="tag in note.tags.slice(0, 2)"
        :key="tag"
        class="text-[10px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded-md"
      >
        {{ tag }}
      </span>

      <!-- Date -->
      <span class="ml-auto text-[10px] text-zinc-600">{{ formattedDate }}</span>
    </div>

    <!-- Color indicator -->
    <div
      v-if="note.color"
      class="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
      :style="{ backgroundColor: note.color }"
      aria-hidden="true"
    />
  </div>
</template>
