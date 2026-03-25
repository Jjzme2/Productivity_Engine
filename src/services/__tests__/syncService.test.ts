// ─── SyncService unit tests ───────────────────────────────────────────────────
// Tests outbox management, local cache operations, and merge algorithm.
// Firebase/Firestore is mocked — these are pure logic tests.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock Firestore client before imports ─────────────────────────────────────

vi.mock('./firestoreClient', () => ({
  createDoc: vi.fn(),
  setDocById: vi.fn().mockResolvedValue({}),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  queryCollection: vi.fn().mockResolvedValue([]),
}))

vi.mock('./firebase', () => ({
  firebaseEnabled: true,
}))

import {
  syncWrite,
  syncDelete,
  syncLoad,
  flushOutbox,
  outboxSize,
  isOnline,
} from './syncService'
import * as firestoreClient from './firestoreClient'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clear localStorage between tests so outbox/cache state doesn't leak. */
function clearStorage() {
  localStorage.clear()
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('syncService', () => {
  beforeEach(() => {
    clearStorage()
    vi.clearAllMocks()
  })

  describe('outbox management', () => {
    it('starts with an empty outbox', () => {
      expect(outboxSize()).toBe(0)
    })

    it('queues an entry when offline', async () => {
      // Simulate offline
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      await syncWrite('tasks', 'create', { id: 'task-1', userId: 'u1', title: 'Test' } as any)

      expect(outboxSize()).toBe(1)
    })

    it('does not queue when online write succeeds', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

      await syncWrite('tasks', 'create', { id: 'task-2', userId: 'u1', title: 'Test' } as any)

      expect(outboxSize()).toBe(0)
    })

    it('deduplicates outbox entries for the same docId', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      const doc = { id: 'task-3', userId: 'u1', title: 'v1' } as any
      await syncWrite('tasks', 'update', doc)
      await syncWrite('tasks', 'update', { ...doc, title: 'v2' })

      // Should have exactly 1 entry (deduplicated), not 2
      expect(outboxSize()).toBe(1)
    })

    it('replaces entry with delete operation', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      await syncWrite('tasks', 'create', { id: 'task-4', userId: 'u1', title: 'Test' } as any)
      expect(outboxSize()).toBe(1)

      await syncDelete('tasks', 'task-4')
      // Delete replaces the create entry
      expect(outboxSize()).toBe(1)
    })
  })

  describe('syncWrite', () => {
    it('updates local cache immediately', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      const doc = { id: 'note-1', userId: 'u1', title: 'Cached' } as any

      await syncWrite('notes', 'create', doc)

      const cached = JSON.parse(localStorage.getItem('pe_cache_notes') ?? '[]')
      expect(cached).toHaveLength(1)
      expect(cached[0].id).toBe('note-1')
    })

    it('returns the document immediately for UI use', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      const doc = { id: 'note-2', userId: 'u1', title: 'Quick' } as any

      const result = await syncWrite('notes', 'create', doc)
      expect(result.id).toBe('note-2')
      expect(result.title).toBe('Quick')
    })
  })

  describe('syncDelete', () => {
    it('removes document from local cache', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      // First create
      await syncWrite('tasks', 'create', { id: 'del-1', userId: 'u1', title: 'To Delete' } as any)
      let cached = JSON.parse(localStorage.getItem('pe_cache_tasks') ?? '[]')
      expect(cached).toHaveLength(1)

      // Then delete
      await syncDelete('tasks', 'del-1')
      cached = JSON.parse(localStorage.getItem('pe_cache_tasks') ?? '[]')
      expect(cached).toHaveLength(0)
    })
  })

  describe('flushOutbox', () => {
    it('flushes all entries when online', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      await syncWrite('tasks', 'create', { id: 'flush-1', userId: 'u1', title: 'Flush Me' } as any)
      expect(outboxSize()).toBe(1)

      // Come back online
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

      const result = await flushOutbox()

      expect(result.flushed).toBe(1)
      expect(result.failed).toBe(0)
      expect(outboxSize()).toBe(0)
    })

    it('reports failed entries without removing them', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      await syncWrite('tasks', 'create', { id: 'fail-1', userId: 'u1', title: 'Fail' } as any)

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
      vi.mocked(firestoreClient.setDocById).mockRejectedValueOnce(new Error('Network error'))

      const result = await flushOutbox()

      expect(result.flushed).toBe(0)
      expect(result.failed).toBe(1)
      expect(outboxSize()).toBe(1) // Entry remains for retry
    })

    it('returns zeros when offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      const result = await flushOutbox()
      expect(result).toEqual({ flushed: 0, failed: 0 })
    })
  })

  describe('syncLoad (merge algorithm)', () => {
    it('returns local cache when offline', async () => {
      localStorage.setItem('pe_cache_tasks', JSON.stringify([
        { id: 'local-1', title: 'Local Only' },
      ]))

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      const result = await syncLoad('tasks', 'u1')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('local-1')
    })

    it('prefers local version for pending outbox entries', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

      // Remote has v1
      vi.mocked(firestoreClient.queryCollection).mockResolvedValueOnce([
        { id: 'merge-1', title: 'Remote v1' } as any,
      ])

      // Local cache has v2 (edited offline)
      localStorage.setItem('pe_cache_tasks', JSON.stringify([
        { id: 'merge-1', title: 'Local v2' },
      ]))

      // Outbox has a pending write for merge-1
      localStorage.setItem('pe_sync_outbox', JSON.stringify([{
        outboxId: 'ox-1',
        collection: 'tasks',
        op: 'update',
        docId: 'merge-1',
        data: { id: 'merge-1', title: 'Local v2' },
        createdAt: new Date().toISOString(),
      }]))

      const result = await syncLoad('tasks', 'u1')

      const item = result.find((d: any) => d.id === 'merge-1') as any
      expect(item.title).toBe('Local v2') // Local wins because it's pending
    })
  })

  describe('isOnline', () => {
    it('returns navigator.onLine value', () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
      expect(isOnline()).toBe(true)

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      expect(isOnline()).toBe(false)
    })
  })
})
