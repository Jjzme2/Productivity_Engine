// ─── Note store ───────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type { Note, CreateNotePayload, UpdateNotePayload, NoteEntityType } from '@/types/note'
import {
  subscribeToCollection,
  createDoc,
  updateDoc,
  deleteDoc,
  queryCollection,
  COLLECTIONS,
} from '@/services/firestoreClient'
import type { Unsubscribe } from 'firebase/firestore'
import eventBus from '@/services/eventBus'
import { writeTextFile, readTextFile, readDir, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createLogger } from '@/services/useLogger'

const log = createLogger('NoteStore')

// ─── R2 Setup ─────────────────────────────────────────────────────────────────
// R2 secret is read from the Rust process via Tauri command (not from VITE_).
// This keeps the secret out of the browser-inspectable JS bundle.
let s3Client: S3Client | null = null
async function getS3Client(): Promise<S3Client | null> {
  if (s3Client) return s3Client
  const { invoke } = await import('@tauri-apps/api/core')
  const accountId     = await invoke<string | null>('read_secret_env', { name: 'R2_ACCOUNT_ID' })
  const accessKeyId   = await invoke<string | null>('read_secret_env', { name: 'R2_ACCESS_KEY_ID' })
  const secretAccessKey = await invoke<string | null>('read_secret_env', { name: 'R2_SECRET_ACCESS_KEY' })
  if (!accountId || !accessKeyId || !secretAccessKey) return null
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
  return s3Client
}

async function syncNoteVault(note: Note): Promise<string | undefined> {
  const dir = 'ProductivityEngine/Notes'
  const fileName = `${note.id}.json`
  const path = `${dir}/${fileName}`
  
  // 1. Local Vault
  try {
    if (!(await exists(dir, { baseDir: BaseDirectory.Document }))) {
      await mkdir(dir, { baseDir: BaseDirectory.Document, recursive: true })
    }
    await writeTextFile(path, JSON.stringify(note, null, 2), { baseDir: BaseDirectory.Document })
  } catch (err) {
    console.error('Failed to write to local vault', err)
  }

  // 2. R2 Vault
  const s3 = await getS3Client()
  if (s3) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const bucketName = await invoke<string | null>('read_secret_env', { name: 'R2_BUCKET_NAME' })
      if (!bucketName) return undefined
      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: `notes/${fileName}`,
        Body: JSON.stringify(note, null, 2),
        ContentType: 'application/json',
      }))
      return `r2://${bucketName}/notes/${fileName}`
    } catch (err) {
      console.error('Failed to sync to R2', err)
    }
  }
  return undefined
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNoteStore = defineStore('notes', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const notes       = ref<Note[]>([])
  const activeNote  = ref<Note | null>(null)
  const searchQuery = ref('')
  const isLoading   = ref(false)
  const error       = ref<string | null>(null)
  /** Notes filtered to a specific linked entity */
  const linkedNotes = ref<Note[]>([])

  let _unsubscribe: Unsubscribe | null = null

  // ── Computed ───────────────────────────────────────────────────────────────

  const filteredNotes = computed(() => {
    let result = notes.value.filter((n) => !n.isArchived)

    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.excerpt.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }

    // Pinned notes first
    return [...result].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  })

  const pinnedNotes = computed(() => filteredNotes.value.filter((n) => n.isPinned))
  const unpinnedNotes = computed(() => filteredNotes.value.filter((n) => !n.isPinned))

  const allTags = computed(() => {
    const tagSet = new Set<string>()
    for (const note of notes.value) {
      for (const tag of note.tags) tagSet.add(tag)
    }
    return [...tagSet].sort()
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  async function loadNotes(userId: string) {
    isLoading.value = true
    log.info('Loading notes', { userId })

    try {
      _unsubscribe = subscribeToCollection<Note>(
        COLLECTIONS.NOTES,
        {
          where:   [{ field: 'userId', op: '==', value: userId }],
          orderBy: [{ field: 'updatedAt', direction: 'desc' }],
        },
        (docs) => {
          log.info(`Firestore snapshot: ${docs.length} note(s)`)
          // Merge: preserve locally-loaded content that Firestore doesn't store
          notes.value = docs.map(doc => {
            const existing = notes.value.find(n => n.id === doc.id)
            if (existing?.content && existing.content !== '{}') {
              return { ...doc, content: existing.content }
            }
            return doc
          })
          isLoading.value = false
        },
        (err) => {
          log.error('Firestore subscription error — falling back to local vault', err)
          error.value = err.message
          loadFromLocalVault()
        },
      )
    } catch (err) {
      log.warn('Firestore unavailable — loading from local vault', err)
      await loadFromLocalVault()
    }
  }

  /** Load all notes from ~/Documents/ProductivityEngine/Notes/ as fallback. */
  async function loadFromLocalVault() {
    const dir = 'ProductivityEngine/Notes'
    try {
      if (!(await exists(dir, { baseDir: BaseDirectory.Document }))) {
        log.info('Local vault does not exist yet, starting fresh')
        notes.value = []
        isLoading.value = false
        return
      }
      const entries = await readDir(dir, { baseDir: BaseDirectory.Document })
      const loaded: Note[] = []
      for (const entry of entries) {
        if (!entry.name?.endsWith('.json')) continue
        try {
          const raw = await readTextFile(`${dir}/${entry.name}`, { baseDir: BaseDirectory.Document })
          loaded.push(JSON.parse(raw) as Note)
        } catch (readErr) {
          log.warn(`Skipping corrupt vault file: ${entry.name}`, readErr)
        }
      }
      loaded.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      notes.value = loaded
      log.info(`Loaded ${loaded.length} note(s) from local vault`)
    } catch (err) {
      log.error('Failed to load from local vault', err)
    } finally {
      isLoading.value = false
    }
  }

  function unloadNotes() {
    _unsubscribe?.()
    _unsubscribe = null
    notes.value = []
  }

  async function createNote(userIdOrPayload: string | CreateNotePayload, payloadArg?: CreateNotePayload): Promise<Note> {
    const userId  = typeof userIdOrPayload === 'string' ? userIdOrPayload : 'local'
    const payload = typeof userIdOrPayload === 'string' ? payloadArg! : userIdOrPayload
    const now = new Date().toISOString()
    const draft: Note = {
      id:        nanoid(),
      userId,
      title:     payload.title || 'Untitled Note',
      content:   payload.content ?? '{}',
      excerpt:   _extractExcerpt(payload.content ?? ''),
      tags:      payload.tags ?? [],
      links:     payload.links ?? [],
      isPinned:  payload.isPinned ?? false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      wordCount: _countWords(payload.content ?? ''),
    }
    if (payload.color !== undefined) {
      draft.color = payload.color
    }

    notes.value.unshift(draft)

    try {
      // Vault write first — guarantees local safety before cloud attempt
      const r2Url = await syncNoteVault(draft)
      if (r2Url) draft.r2Url = r2Url

      const firestorePayload = { ...draft } as Partial<Note>
      delete firestorePayload.content

      const created = await createDoc<Note>(COLLECTIONS.NOTES, firestorePayload as Omit<Note, 'id'>)
      created.content = draft.content  // Restore content (Firestore doesn't store it)
      const idx = notes.value.findIndex((n) => n.id === draft.id)
      if (idx !== -1) notes.value[idx] = created
      eventBus.emit('note:created', created)
      return created
    } catch (err) {
      log.error('Failed to persist new note', { id: draft.id, err })
      // Note remains in local notes array with local vault copy — not a data loss
      throw err
    }
  }

  async function updateNote(payload: UpdateNotePayload): Promise<void> {
    const idx = notes.value.findIndex((n) => n.id === payload.id)
    if (idx === -1) return

    const previous = { ...notes.value[idx]! }
    const updated: Note = {
      ...previous,
      ...payload,
      excerpt:   payload.content !== undefined ? _extractExcerpt(payload.content) : previous.excerpt,
      wordCount: payload.content !== undefined ? _countWords(payload.content) : previous.wordCount,
      updatedAt: new Date().toISOString(),
    }

    notes.value[idx] = updated

    // Keep activeNote in sync so the editor prop stays current
    if (activeNote.value?.id === payload.id) {
      Object.assign(activeNote.value, updated)
    }

    // Sync vault then save metadata to Firestore
    try {
      const r2Url = await syncNoteVault(updated)
      if (r2Url) updated.r2Url = r2Url

      const firestorePayload = { ...updated }
      delete (firestorePayload as any).content

      await updateDoc<Note>(COLLECTIONS.NOTES, payload.id, firestorePayload)
      log.debug('Note updated', { id: payload.id })
    } catch (err) {
      log.warn('Firestore update failed — note persisted locally only', { id: payload.id, err })
      // Don't revert: the note is saved to local vault even if Firestore fails
      await syncNoteVault(updated)
    }
  }

  async function deleteNote(id: string): Promise<void> {
    const idx = notes.value.findIndex((n) => n.id === id)
    const removed = idx !== -1 ? notes.value[idx]! : null
    if (idx !== -1) notes.value.splice(idx, 1)

    try {
      await deleteDoc(COLLECTIONS.NOTES, id)
    } catch (err) {
      if (removed && idx !== -1) notes.value.splice(idx, 0, removed)
      throw err
    }
  }

  function setSearchQuery(q: string) {
    searchQuery.value = q
  }

  /** Compatibility: views pass { searchQuery } filter object */
  const activeFilter = computed(() => ({ searchQuery: searchQuery.value }))
  function setFilter(filter: { searchQuery?: string }) {
    if (filter.searchQuery !== undefined) searchQuery.value = filter.searchQuery ?? ''
  }

  async function setActiveNote(note: Note | null) {
    if (note && (!note.content || note.content === '{}')) {
      let resolved: string | null = null

      // 1. Try local vault first (fastest, works offline)
      try {
        const raw = await readTextFile(`ProductivityEngine/Notes/${note.id}.json`, { baseDir: BaseDirectory.Document })
        const parsed = JSON.parse(raw)
        resolved = parsed.content || null
      } catch {
        // Local vault miss — fall through to R2
      }

      // 2. Fall back to R2 if note has a stored URL (cross-device scenario)
      if (!resolved && note.r2Url) {
        try {
          const s3 = await getS3Client()
          const { invoke } = await import('@tauri-apps/api/core')
          const bucketName = await invoke<string | null>('read_secret_env', { name: 'R2_BUCKET_NAME' })
          if (s3 && bucketName) {
            const { GetObjectCommand } = await import('@aws-sdk/client-s3')
            const response = await s3.send(new GetObjectCommand({
              Bucket: bucketName,
              Key: `notes/${note.id}.json`,
            }))
            if (response.Body) {
              const text = await response.Body.transformToString()
              const parsed = JSON.parse(text)
              resolved = parsed.content || null
              // Cache locally so next open is instant
              const dir = 'ProductivityEngine/Notes'
              const path = `${dir}/${note.id}.json`
              writeTextFile(path, text, { baseDir: BaseDirectory.Document }).catch(() => {})
            }
          }
        } catch (err) {
          log.warn('Could not fetch note content from R2', { id: note.id, err })
        }
      }

      if (resolved) {
        note.content = resolved
        const idx = notes.value.findIndex(n => n.id === note.id)
        if (idx !== -1) notes.value[idx] = { ...notes.value[idx]!, content: resolved }
      }
    }
    activeNote.value = note
  }

  async function loadLinkedNotes(entityType: NoteEntityType, entityId: string): Promise<void> {
    const results = await queryCollection<Note>(COLLECTIONS.NOTES, {
      where: [
        { field: 'links', op: 'array-contains', value: { entityType, entityId } },
      ],
    })
    linkedNotes.value = results
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  function _extractExcerpt(content: string): string {
    try {
      // TipTap stores JSON; extract plain text from the text nodes
      const doc = JSON.parse(content) as { content?: Array<{ content?: Array<{ text?: string }> }> }
      const texts: string[] = []
      for (const block of doc.content ?? []) {
        for (const inline of block.content ?? []) {
          if (inline.text) texts.push(inline.text)
        }
        if (texts.join(' ').length >= 200) break
      }
      return texts.join(' ').slice(0, 200)
    } catch {
      return content.slice(0, 200)
    }
  }

  function _countWords(content: string): number {
    try {
      const doc = JSON.parse(content) as { content?: Array<{ content?: Array<{ text?: string }> }> }
      let text = ''
      for (const block of doc.content ?? []) {
        for (const inline of block.content ?? []) {
          if (inline.text) text += ' ' + inline.text
        }
      }
      return text.trim().split(/\s+/).filter(Boolean).length
    } catch {
      return content.trim().split(/\s+/).filter(Boolean).length
    }
  }

  return {
    // State
    notes,
    activeNote,
    searchQuery,
    isLoading,
    error,
    linkedNotes,
    // Computed
    filteredNotes,
    pinnedNotes,
    unpinnedNotes,
    allTags,
    // Actions
    loadNotes,
    unloadNotes,
    createNote,
    updateNote,
    deleteNote,
    setSearchQuery,
    setActiveNote,
    loadLinkedNotes,
    activeFilter,
    setFilter,
  }
})
