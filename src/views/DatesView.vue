<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImportantDatesStore } from '@/stores/dates'
import type { DateCategory, RecurrenceType } from '@/types/dates'
import BaseCard from '@/components/shared/BaseCard.vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import BaseModal from '@/components/shared/BaseModal.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const store = useImportantDatesStore()

// ─── Category config ──────────────────────────────────────────────────────────

const categoryEmoji: Record<DateCategory, string> = {
  birthday: '🎂',
  anniversary: '💍',
  deadline: '⏰',
  holiday: '🎉',
  appointment: '📅',
  reminder: '🔔',
  custom: '📌',
}

const categoryColor: Record<DateCategory, string> = {
  birthday: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  anniversary: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  deadline: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  holiday: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  appointment: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  reminder: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  custom: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
}

const categoryIconBg: Record<DateCategory, string> = {
  birthday: 'bg-pink-500/15',
  anniversary: 'bg-violet-500/15',
  deadline: 'bg-rose-500/15',
  holiday: 'bg-emerald-500/15',
  appointment: 'bg-blue-500/15',
  reminder: 'bg-amber-500/15',
  custom: 'bg-zinc-700/40',
}

// ─── Grouped upcoming dates ───────────────────────────────────────────────────

const todayGroup = computed(() =>
  store.upcomingDates.filter(d => d.daysUntil === 0)
)

const thisWeekGroup = computed(() =>
  store.upcomingDates.filter(d => d.daysUntil >= 1 && d.daysUntil <= 7)
)

const thisMonthGroup = computed(() =>
  store.upcomingDates.filter(d => d.daysUntil >= 8 && d.daysUntil <= 30)
)

const laterGroup = computed(() =>
  store.upcomingDates.filter(d => d.daysUntil >= 31 && d.daysUntil <= 365)
)

// ─── Days badge label ─────────────────────────────────────────────────────────

function daysBadge(daysUntil: number): string {
  if (daysUntil === 0) return 'Today'
  if (daysUntil === 1) return 'Tomorrow'
  return `${daysUntil} days`
}

function daysBadgeClass(daysUntil: number): string {
  if (daysUntil === 0) return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
  if (daysUntil <= 3) return 'bg-rose-500/15 text-rose-400 border-rose-500/30'
  if (daysUntil <= 7) return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40'
}

// ─── Format date ──────────────────────────────────────────────────────────────

function parseYMD(dateStr: string): [number, number, number] {
  const parts = dateStr.split('-')
  return [parseInt(parts[0]!), parseInt(parts[1]!), parseInt(parts[2]!)]
}

function formatDate(dateStr: string): string {
  const [year, month, day] = parseYMD(dateStr)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Year at a glance ─────────────────────────────────────────────────────────

const yearAtAGlance = computed(() => {
  const monthMap = new Map<string, { label: string; dates: typeof store.upcomingDates }>()
  for (const d of store.upcomingDates) {
    const key = d.occurrenceDate.slice(0, 7)
    if (!monthMap.has(key)) {
      const parts = key.split('-')
      const [year, month] = [parseInt(parts[0]!), parseInt(parts[1]!)]
      const label = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      monthMap.set(key, { label, dates: [] })
    }
    monthMap.get(key)!.dates.push(d)
  }
  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
})

// ─── Add date modal ───────────────────────────────────────────────────────────

const showAddDate = ref(false)

const dateForm = ref({
  title: '',
  category: 'reminder' as DateCategory,
  date: new Date().toISOString().slice(0, 10),
  recurrence: 'none' as RecurrenceType,
  linkedContactName: '',
  notifyDaysBefore: 1,
  notes: '',
})

const categories: DateCategory[] = ['birthday', 'anniversary', 'deadline', 'holiday', 'appointment', 'reminder', 'custom']
const recurrenceOptions: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: 'No recurrence' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
]

function submitDate() {
  if (!dateForm.value.title || !dateForm.value.date) return
  const payload: Parameters<typeof store.createDate>[0] = {
    title: dateForm.value.title,
    category: dateForm.value.category,
    date: dateForm.value.date,
    recurrence: dateForm.value.recurrence,
    notifyDaysBefore: dateForm.value.notifyDaysBefore,
    isCompleted: false,
    ...(dateForm.value.linkedContactName ? { linkedContactName: dateForm.value.linkedContactName } : {}),
    ...(dateForm.value.notes ? { notes: dateForm.value.notes } : {}),
    userId: 'local',
  }
  store.createDate(payload)
  showAddDate.value = false
  dateForm.value = {
    title: '',
    category: 'reminder',
    date: new Date().toISOString().slice(0, 10),
    recurrence: 'none',
    linkedContactName: '',
    notifyDaysBefore: 1,
    notes: '',
  }
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputClass =
  'w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/40'

const labelClass = 'block text-xs font-medium text-zinc-400 mb-1.5'
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="max-w-6xl mx-auto px-6 py-8">

      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-zinc-100">Important Dates</h1>
          <p class="text-sm text-zinc-500 mt-0.5">Track birthdays, anniversaries, deadlines and more</p>
        </div>
        <BaseButton variant="primary" size="md" @click="showAddDate = true">
          <template #icon>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </template>
          Add date
        </BaseButton>
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- ── Left: Upcoming dates grouped ── -->
        <div class="lg:col-span-2 space-y-6">

          <div
            v-if="store.upcomingDates.length === 0"
          >
            <EmptyState
              title="No upcoming dates"
              description="Add important dates to stay on top of birthdays, anniversaries, and more."
              action-label="Add date"
              @action="showAddDate = true"
            />
          </div>

          <!-- Today -->
          <div v-if="todayGroup.length > 0">
            <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
              Today
            </h2>
            <div class="space-y-2">
              <BaseCard
                v-for="d in todayGroup"
                :key="d.id"
                class="px-4 py-3 flex items-center gap-3"
              >
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                  :class="categoryIconBg[d.category]"
                >
                  {{ categoryEmoji[d.category] }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-zinc-100">{{ d.title }}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span
                      v-if="d.linkedContactName"
                      class="text-xs text-zinc-500"
                    >{{ d.linkedContactName }}</span>
                    <span class="text-xs text-zinc-600">{{ formatDate(d.occurrenceDate) }}</span>
                  </div>
                </div>
                <span
                  class="text-[10px] font-semibold px-2 py-1 rounded-full border flex-shrink-0"
                  :class="daysBadgeClass(d.daysUntil)"
                >
                  {{ daysBadge(d.daysUntil) }}
                </span>
                <BaseButton variant="danger" size="sm" @click="store.deleteDate(d.id)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </BaseButton>
              </BaseCard>
            </div>
          </div>

          <!-- This Week -->
          <div v-if="thisWeekGroup.length > 0">
            <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              This Week
            </h2>
            <div class="space-y-2">
              <BaseCard
                v-for="d in thisWeekGroup"
                :key="d.id"
                class="px-4 py-3 flex items-center gap-3"
              >
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                  :class="categoryIconBg[d.category]"
                >
                  {{ categoryEmoji[d.category] }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-zinc-100">{{ d.title }}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span
                      v-if="d.linkedContactName"
                      class="text-xs text-zinc-500"
                    >{{ d.linkedContactName }}</span>
                    <span class="text-xs text-zinc-600">{{ formatDate(d.occurrenceDate) }}</span>
                  </div>
                </div>
                <span
                  class="text-[10px] font-semibold px-2 py-1 rounded-full border flex-shrink-0"
                  :class="daysBadgeClass(d.daysUntil)"
                >
                  {{ daysBadge(d.daysUntil) }}
                </span>
                <BaseButton variant="danger" size="sm" @click="store.deleteDate(d.id)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </BaseButton>
              </BaseCard>
            </div>
          </div>

          <!-- This Month -->
          <div v-if="thisMonthGroup.length > 0">
            <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              This Month
            </h2>
            <div class="space-y-2">
              <BaseCard
                v-for="d in thisMonthGroup"
                :key="d.id"
                class="px-4 py-3 flex items-center gap-3"
              >
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                  :class="categoryIconBg[d.category]"
                >
                  {{ categoryEmoji[d.category] }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-zinc-100">{{ d.title }}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span
                      v-if="d.linkedContactName"
                      class="text-xs text-zinc-500"
                    >{{ d.linkedContactName }}</span>
                    <span class="text-xs text-zinc-600">{{ formatDate(d.occurrenceDate) }}</span>
                  </div>
                </div>
                <span
                  class="text-[10px] font-semibold px-2 py-1 rounded-full border flex-shrink-0"
                  :class="daysBadgeClass(d.daysUntil)"
                >
                  {{ daysBadge(d.daysUntil) }}
                </span>
                <BaseButton variant="danger" size="sm" @click="store.deleteDate(d.id)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </BaseButton>
              </BaseCard>
            </div>
          </div>

          <!-- Later -->
          <div v-if="laterGroup.length > 0">
            <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-zinc-500 inline-block"></span>
              Later
            </h2>
            <div class="space-y-2">
              <BaseCard
                v-for="d in laterGroup"
                :key="d.id"
                class="px-4 py-3 flex items-center gap-3"
              >
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                  :class="categoryIconBg[d.category]"
                >
                  {{ categoryEmoji[d.category] }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-zinc-100">{{ d.title }}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span
                      v-if="d.linkedContactName"
                      class="text-xs text-zinc-500"
                    >{{ d.linkedContactName }}</span>
                    <span class="text-xs text-zinc-600">{{ formatDate(d.occurrenceDate) }}</span>
                  </div>
                </div>
                <span
                  class="text-[10px] font-semibold px-2 py-1 rounded-full border flex-shrink-0"
                  :class="daysBadgeClass(d.daysUntil)"
                >
                  {{ daysBadge(d.daysUntil) }}
                </span>
                <BaseButton variant="danger" size="sm" @click="store.deleteDate(d.id)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </BaseButton>
              </BaseCard>
            </div>
          </div>

        </div>

        <!-- ── Right panel ── -->
        <div class="space-y-6">

          <!-- Overdue -->
          <div v-if="store.overdueDates.length > 0">
            <h2 class="text-xs font-semibold text-rose-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              Overdue
            </h2>
            <div class="space-y-2">
              <BaseCard
                v-for="d in store.overdueDates"
                :key="d.id"
                class="p-4 border border-rose-500/20"
              >
                <div class="flex items-start gap-2 mb-3">
                  <span class="text-lg flex-shrink-0">{{ categoryEmoji[d.category] }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-zinc-200">{{ d.title }}</p>
                    <p class="text-xs text-rose-400/80 mt-0.5">{{ formatDate(d.date) }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <BaseButton
                    variant="ghost"
                    size="sm"
                    class="flex-1 justify-center"
                    @click="store.markCompleted(d.id)"
                  >
                    Mark complete
                  </BaseButton>
                  <BaseButton variant="danger" size="sm" @click="store.deleteDate(d.id)">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </BaseButton>
                </div>
              </BaseCard>
            </div>
          </div>

          <!-- Year at a Glance -->
          <div>
            <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
              Year at a Glance
            </h2>

            <div v-if="yearAtAGlance.length > 0" class="space-y-3">
              <BaseCard
                v-for="month in yearAtAGlance"
                :key="month.label"
                padding="sm"
                class="p-3"
              >
                <p class="text-xs font-semibold text-zinc-300 mb-2">{{ month.label }}</p>
                <div class="space-y-1.5">
                  <div
                    v-for="d in month.dates"
                    :key="d.id"
                    class="flex items-center gap-2"
                  >
                    <span class="text-sm flex-shrink-0">{{ categoryEmoji[d.category] }}</span>
                    <span class="text-xs text-zinc-400 truncate flex-1">{{ d.title }}</span>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0"
                      :class="categoryColor[d.category]"
                    >
                      {{ d.occurrenceDate.slice(5) }}
                    </span>
                  </div>
                </div>
              </BaseCard>
            </div>

            <div v-else class="text-sm text-zinc-600 text-center py-6">
              No upcoming dates in the next year
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════════ ADD DATE MODAL ══════════════════ -->
  <BaseModal v-model="showAddDate" title="Add Important Date" size="md">
    <div class="space-y-4">
      <div>
        <label :class="labelClass">Title</label>
        <input
          v-model="dateForm.title"
          type="text"
          :class="inputClass"
          placeholder="e.g. Mom's Birthday"
        />
      </div>

      <div>
        <label :class="labelClass">Category</label>
        <select v-model="dateForm.category" :class="inputClass">
          <option v-for="cat in categories" :key="cat" :value="cat">
            {{ categoryEmoji[cat] }} {{ cat.charAt(0).toUpperCase() + cat.slice(1) }}
          </option>
        </select>
      </div>

      <div>
        <label :class="labelClass">Date</label>
        <input v-model="dateForm.date" type="date" :class="inputClass" />
      </div>

      <div>
        <label :class="labelClass">Recurrence</label>
        <select v-model="dateForm.recurrence" :class="inputClass">
          <option
            v-for="opt in recurrenceOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div>
        <label :class="labelClass">Person's Name (optional)</label>
        <input
          v-model="dateForm.linkedContactName"
          type="text"
          :class="inputClass"
          placeholder="e.g. Mom, John..."
        />
      </div>

      <div>
        <label :class="labelClass">Notify days before</label>
        <input
          v-model.number="dateForm.notifyDaysBefore"
          type="number"
          min="0"
          :class="inputClass"
        />
      </div>

      <div>
        <label :class="labelClass">Notes (optional)</label>
        <textarea
          v-model="dateForm.notes"
          :class="inputClass"
          rows="2"
          placeholder="Any extra notes..."
        />
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" size="md" @click="showAddDate = false">Cancel</BaseButton>
      <BaseButton variant="primary" size="md" @click="submitDate">Save Date</BaseButton>
    </template>
  </BaseModal>
</template>
