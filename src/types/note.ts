// ─── Note domain types ────────────────────────────────────────────────────────

export type NoteEntityType = 'task' | 'habit' | 'event' | 'framework_session'

export interface NoteLink {
  entityType: NoteEntityType
  entityId: string
  entityTitle: string
}

export interface Note {
  id: string
  userId: string
  title: string
  /** TipTap JSON content (serialized as string for Firestore) */
  content: string
  /** Plain text excerpt for search / preview (max 200 chars) */
  excerpt: string
  tags: string[]
  links: NoteLink[]
  isPinned: boolean
  isArchived: boolean
  /** ISO-8601 datetime */
  createdAt: string
  /** ISO-8601 datetime */
  updatedAt: string
  wordCount: number
  color?: string
  /** URL to the secondary R2 backup */
  r2Url?: string
}

export interface CreateNotePayload {
  title: string
  content?: string
  tags?: string[]
  links?: NoteLink[]
  isPinned?: boolean
  color?: string
}

export interface UpdateNotePayload {
  id: string
  title?: string
  content?: string
  tags?: string[]
  links?: NoteLink[]
  isPinned?: boolean
  isArchived?: boolean
  color?: string
}

export interface NoteFilter {
  tags?: string[]
  searchQuery?: string
  entityType?: NoteEntityType
  entityId?: string
  includeArchived?: boolean
  isPinnedFirst?: boolean
}
