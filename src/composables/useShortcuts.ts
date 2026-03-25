// ─── Global keyboard shortcuts composable ────────────────────────────────────
// Uses @vueuse/core useEventListener for clean lifecycle management.

import { onMounted, onUnmounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useAppStore } from '@/stores/useAppStore'
import { useHabitStore } from '@/stores/useHabitStore'
import { useRouter } from 'vue-router'

// ─── Shortcut descriptor ──────────────────────────────────────────────────────

export interface ShortcutDescriptor {
  key: string
  modifiers: Array<'Meta' | 'Ctrl' | 'Shift' | 'Alt'>
  description: string
  group: string
  /** Display label e.g. "⌘K" */
  label: string
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useShortcuts(userId?: string) {
  const appStore   = useAppStore()
  const habitStore = useHabitStore()
  const router     = useRouter()

  // Detect Mac vs PC for display labels
  const isMac = typeof navigator !== 'undefined'
    ? /Mac|iPod|iPhone|iPad/.test(navigator.platform)
    : false
  const metaKey = isMac ? '⌘' : 'Ctrl'

  // ── Handler ───────────────────────────────────────────────────────────────

  function _handleKeydown(event: KeyboardEvent): void {
    const { key, metaKey: meta, ctrlKey: ctrl, shiftKey: shift, altKey: alt } = event
    const mod = isMac ? meta : ctrl

    // Ignore if focus is in a text input / textarea / contenteditable
    // (except the command bar itself)
    const target = event.target as HTMLElement
    const isInInput =
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
      !target.classList.contains('nlp-command-input')

    // ⌘K — Toggle command bar
    if (mod && !shift && key === 'k') {
      event.preventDefault()
      if (appStore.commandBarOpen) appStore.closeCommandBar()
      else appStore.openCommandBar()
      return
    }

    // Esc — Close command bar / exit focus mode
    if (key === 'Escape') {
      if (appStore.commandBarOpen) {
        event.preventDefault()
        appStore.closeCommandBar()
        return
      }
      if (appStore.isFocusMode) {
        event.preventDefault()
        appStore.exitFocusMode()
        return
      }
      return
    }

    if (isInInput) return // Don't fire other shortcuts while typing

    // ⌘N — New task (navigate to tasks and open creation dialog)
    if (mod && !shift && key === 'n') {
      event.preventDefault()
      void router.push('/tasks')
      // Small delay to allow view to mount before opening new-task form
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('shortcut:new-task'))
      }, 100)
      return
    }

    // ⌘⇧H — Check in today's first pending habit
    if (mod && shift && key === 'h') {
      event.preventDefault()
      const pending = habitStore.pendingTodayHabits
      if (pending.length > 0 && userId) {
        void habitStore.checkInHabit(pending[0]!.id, userId)
        appStore.showToast({
          title:   `Checked in: ${pending[0]!.title}`,
          variant: 'success',
          durationMs: 2500,
        })
      } else {
        appStore.showToast({
          title:   'All habits done for today!',
          variant: 'success',
          durationMs: 2500,
        })
      }
      return
    }

    // ⌘1…⌘7 — Quick navigate to views
    const viewMap: Record<string, string> = {
      '1': '/',
      '2': '/tasks',
      '3': '/habits',
      '4': '/notes',
      '5': '/calendar',
      '6': '/frameworks',
      '7': '/analytics',
    }
    if (mod && !shift && viewMap[key]) {
      event.preventDefault()
      void router.push(viewMap[key]!)
      return
    }

    // ⌘, — Settings
    if (mod && key === ',') {
      event.preventDefault()
      void router.push('/settings')
      return
    }

    // ⌘⇧F — Toggle focus mode
    if (mod && shift && key === 'f') {
      event.preventDefault()
      if (appStore.isFocusMode) appStore.exitFocusMode()
      else appStore.enterFocusMode()
      return
    }
  }

  // Register listener at the document level
  useEventListener(document, 'keydown', _handleKeydown)

  // ── Shortcut map for the Settings UI ─────────────────────────────────────

  const shortcutMap: ShortcutDescriptor[] = [
    {
      key:         'k',
      modifiers:   ['Meta'],
      description: 'Open / close command bar',
      group:       'General',
      label:       `${metaKey}K`,
    },
    {
      key:         'Escape',
      modifiers:   [],
      description: 'Close command bar / exit focus mode',
      group:       'General',
      label:       'Esc',
    },
    {
      key:         'n',
      modifiers:   ['Meta'],
      description: 'New task',
      group:       'Tasks',
      label:       `${metaKey}N`,
    },
    {
      key:         'h',
      modifiers:   ['Meta', 'Shift'],
      description: 'Check in first pending habit',
      group:       'Habits',
      label:       `${metaKey}⇧H`,
    },
    {
      key:         ',',
      modifiers:   ['Meta'],
      description: 'Open settings',
      group:       'General',
      label:       `${metaKey},`,
    },
    {
      key:         'f',
      modifiers:   ['Meta', 'Shift'],
      description: 'Toggle focus mode',
      group:       'General',
      label:       `${metaKey}⇧F`,
    },
    {
      key:         '1',
      modifiers:   ['Meta'],
      description: 'Go to Dashboard',
      group:       'Navigation',
      label:       `${metaKey}1`,
    },
    {
      key:         '2',
      modifiers:   ['Meta'],
      description: 'Go to Tasks',
      group:       'Navigation',
      label:       `${metaKey}2`,
    },
    {
      key:         '3',
      modifiers:   ['Meta'],
      description: 'Go to Habits',
      group:       'Navigation',
      label:       `${metaKey}3`,
    },
    {
      key:         '4',
      modifiers:   ['Meta'],
      description: 'Go to Notes',
      group:       'Navigation',
      label:       `${metaKey}4`,
    },
    {
      key:         '5',
      modifiers:   ['Meta'],
      description: 'Go to Calendar',
      group:       'Navigation',
      label:       `${metaKey}5`,
    },
    {
      key:         '6',
      modifiers:   ['Meta'],
      description: 'Go to Frameworks',
      group:       'Navigation',
      label:       `${metaKey}6`,
    },
    {
      key:         '7',
      modifiers:   ['Meta'],
      description: 'Go to Analytics',
      group:       'Navigation',
      label:       `${metaKey}7`,
    },
  ]

  return { shortcutMap, isMac, metaKey }
}
