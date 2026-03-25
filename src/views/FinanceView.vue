<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFinanceStore, calculateLoan, calculateCompoundInterest } from '@/stores/finance'
import type { TransactionCategory, CompoundingFrequency } from '@/types/finance'
import BaseCard from '@/components/shared/BaseCard.vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import BaseModal from '@/components/shared/BaseModal.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const store = useFinanceStore()

// ─── Tab state ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'transactions' | 'budgets' | 'calculators' | 'goals'
const activeTab = ref<Tab>('overview')

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'calculators', label: 'Calculators' },
  { id: 'goals', label: 'Goals' },
]

// ─── Currency formatter ───────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

// ─── Month navigation ─────────────────────────────────────────────────────────

function parseSelectedMonth(): [number, number] {
  const parts = store.selectedMonth.split('-')
  return [parseInt(parts[0]!), parseInt(parts[1]!)]
}

function prevMonth() {
  const [year, month] = parseSelectedMonth()
  const d = new Date(year, month - 2, 1)
  store.selectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth() {
  const [year, month] = parseSelectedMonth()
  const d = new Date(year, month, 1)
  store.selectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const selectedMonthLabel = computed(() => {
  const [year, month] = parseSelectedMonth()
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// ─── Overview: bar chart ──────────────────────────────────────────────────────

const expenseCategoryEntries = computed(() => {
  const entries = Object.entries(store.expensesByCategory) as [TransactionCategory, number][]
  return entries.sort((a, b) => b[1] - a[1])
})

const maxExpenseAmount = computed(() =>
  Math.max(...expenseCategoryEntries.value.map(([, v]) => v), 1)
)

const topThreeCategories = computed(() => expenseCategoryEntries.value.slice(0, 3))

// ─── Category emoji map ───────────────────────────────────────────────────────

const categoryEmoji: Record<TransactionCategory, string> = {
  salary: '💼',
  freelance: '💻',
  investment: '📈',
  housing: '🏠',
  food: '🍔',
  transport: '🚗',
  health: '🏥',
  entertainment: '🎬',
  education: '📚',
  subscriptions: '📱',
  savings: '🏦',
  debt: '💳',
  insurance: '🛡️',
  utilities: '⚡',
  shopping: '🛍️',
  travel: '✈️',
  other_income: '💰',
  other_expense: '📦',
}

// ─── Transactions ─────────────────────────────────────────────────────────────

const sortedTransactions = computed(() =>
  [...store.currentMonthTransactions].sort((a, b) => b.date.localeCompare(a.date))
)

// New transaction modal
const showAddTransaction = ref(false)
const txForm = ref({
  type: 'expense' as 'income' | 'expense',
  amount: 0,
  category: 'food' as TransactionCategory,
  description: '',
  date: new Date().toISOString().slice(0, 10),
})

function submitTransaction() {
  if (!txForm.value.amount || !txForm.value.description) return
  store.createTransaction({
    ...txForm.value,
    userId: 'local',
    currency: 'USD',
    tags: [],
    accountId: store.accounts[0]?.id ?? '',
    isRecurring: false,
  })
  showAddTransaction.value = false
  txForm.value = {
    type: 'expense',
    amount: 0,
    category: 'food',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  }
}

const allCategories: TransactionCategory[] = [
  'salary', 'freelance', 'investment', 'housing', 'food', 'transport', 'health',
  'entertainment', 'education', 'subscriptions', 'savings', 'debt', 'insurance',
  'utilities', 'shopping', 'travel', 'other_income', 'other_expense',
]

// ─── Budgets ──────────────────────────────────────────────────────────────────

const showAddBudget = ref(false)
const budgetForm = ref({
  category: 'food' as TransactionCategory,
  monthlyLimit: 0,
})

function submitBudget() {
  if (!budgetForm.value.monthlyLimit) return
  store.createBudget({
    category: budgetForm.value.category,
    monthlyLimit: budgetForm.value.monthlyLimit,
    spent: 0,
    period: store.selectedMonth,
    userId: 'local',
  })
  showAddBudget.value = false
  budgetForm.value = { category: 'food', monthlyLimit: 0 }
}

// ─── Loan calculator ──────────────────────────────────────────────────────────

const loanInput = ref({ principal: 200000, annualRate: 6.5, termMonths: 360 })
const loanResult = ref<ReturnType<typeof calculateLoan> | null>(null)

function runLoanCalc() {
  loanResult.value = calculateLoan(loanInput.value)
}

// ─── Compound interest calculator ─────────────────────────────────────────────

const ciInput = ref({
  principal: 10000,
  annualRate: 7,
  years: 10,
  compoundingFrequency: 'monthly' as CompoundingFrequency,
  monthlyContribution: 200,
})
const ciResult = ref<ReturnType<typeof calculateCompoundInterest> | null>(null)

function runCICalc() {
  ciResult.value = calculateCompoundInterest(ciInput.value)
}

// ─── Goals ────────────────────────────────────────────────────────────────────

const showAddGoal = ref(false)
const goalForm = ref({
  name: '',
  targetAmount: 0,
  currentAmount: 0,
  category: 'savings' as TransactionCategory,
  deadline: '',
  notes: '',
  isCompleted: false,
})

function submitGoal() {
  if (!goalForm.value.name || !goalForm.value.targetAmount) return
  const payload: Parameters<typeof store.createGoal>[0] = {
    name: goalForm.value.name,
    targetAmount: goalForm.value.targetAmount,
    currentAmount: goalForm.value.currentAmount,
    category: goalForm.value.category,
    isCompleted: goalForm.value.isCompleted,
    ...(goalForm.value.deadline ? { deadline: goalForm.value.deadline } : {}),
    ...(goalForm.value.notes ? { notes: goalForm.value.notes } : {}),
    userId: 'local',
  }
  store.createGoal(payload)
  showAddGoal.value = false
  goalForm.value = {
    name: '',
    targetAmount: 0,
    currentAmount: 0,
    category: 'savings',
    deadline: '',
    notes: '',
    isCompleted: false,
  }
}

function markGoalComplete(id: string) {
  store.updateGoal({ id, isCompleted: true })
}

function goalProgress(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, (current / target) * 100)
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputClass =
  'w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/40'

const labelClass = 'block text-xs font-medium text-zinc-400 mb-1.5'
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="max-w-5xl mx-auto px-6 py-8 space-y-6">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-zinc-100">Finance</h1>
          <p class="text-sm text-zinc-500 mt-0.5">Track income, expenses, budgets and goals</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800/50 w-fit">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="px-4 py-1.5 text-sm rounded-lg font-medium transition-all duration-150"
          :class="activeTab === tab.id
            ? 'bg-indigo-500 text-white shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- ══════════════════ OVERVIEW TAB ══════════════════ -->
      <div v-if="activeTab === 'overview'" class="space-y-6">

        <!-- Month selector -->
        <div class="flex items-center gap-3">
          <BaseButton variant="ghost" size="sm" @click="prevMonth">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </BaseButton>
          <span class="text-sm font-medium text-zinc-200 min-w-[140px] text-center">{{ selectedMonthLabel }}</span>
          <BaseButton variant="ghost" size="sm" @click="nextMonth">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </BaseButton>
        </div>

        <!-- Summary cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Net Cash Flow -->
          <BaseCard class="p-5">
            <p class="text-xs text-zinc-500 uppercase tracking-wide mb-2">Net Cash Flow</p>
            <p
              class="text-2xl font-bold"
              :class="store.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'"
            >
              {{ formatCurrency(store.netCashFlow) }}
            </p>
            <span
              class="mt-2 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
              :class="store.netCashFlow >= 0
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'"
            >
              {{ store.netCashFlow >= 0 ? 'Positive' : 'Negative' }}
            </span>
          </BaseCard>

          <!-- Total Income -->
          <BaseCard class="p-5">
            <p class="text-xs text-zinc-500 uppercase tracking-wide mb-2">Total Income</p>
            <p class="text-2xl font-bold text-zinc-100">{{ formatCurrency(store.totalIncome) }}</p>
            <p class="text-xs text-zinc-600 mt-2">This month</p>
          </BaseCard>

          <!-- Total Expenses -->
          <BaseCard class="p-5">
            <p class="text-xs text-zinc-500 uppercase tracking-wide mb-2">Total Expenses</p>
            <p class="text-2xl font-bold text-zinc-100">{{ formatCurrency(store.totalExpenses) }}</p>
            <p class="text-xs text-zinc-600 mt-2">This month</p>
          </BaseCard>

          <!-- Net Worth -->
          <BaseCard class="p-5">
            <p class="text-xs text-zinc-500 uppercase tracking-wide mb-2">Net Worth</p>
            <p
              class="text-2xl font-bold"
              :class="store.currentNetWorth >= 0 ? 'text-zinc-100' : 'text-rose-400'"
            >
              {{ formatCurrency(store.currentNetWorth) }}
            </p>
            <p class="text-xs text-zinc-600 mt-2">Assets − Liabilities</p>
          </BaseCard>
        </div>

        <!-- Expenses by category bar chart -->
        <BaseCard class="p-5">
          <h2 class="text-sm font-semibold text-zinc-300 mb-4">Expenses by Category</h2>
          <div v-if="expenseCategoryEntries.length > 0" class="space-y-3">
            <div
              v-for="([cat, amount]) in expenseCategoryEntries"
              :key="cat"
              class="flex items-center gap-3"
            >
              <span class="text-base w-6 text-center flex-shrink-0">{{ categoryEmoji[cat] }}</span>
              <span class="text-xs text-zinc-400 w-28 flex-shrink-0 capitalize">{{ cat.replace('_', ' ') }}</span>
              <div class="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  class="h-full bg-indigo-500/70 rounded-full transition-all duration-500"
                  :style="{ width: `${(amount / maxExpenseAmount) * 100}%` }"
                />
              </div>
              <span class="text-xs text-zinc-300 w-24 text-right flex-shrink-0">{{ formatCurrency(amount) }}</span>
            </div>
          </div>
          <div v-else class="h-24 flex items-center justify-center text-zinc-600 text-sm">
            No expenses recorded this month
          </div>
        </BaseCard>

        <!-- Top 3 + Net Worth detail -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BaseCard class="p-5">
            <h2 class="text-sm font-semibold text-zinc-300 mb-4">Top Expense Categories</h2>
            <div v-if="topThreeCategories.length > 0" class="space-y-3">
              <div
                v-for="([cat, amount], i) in topThreeCategories"
                :key="cat"
                class="flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {{ i + 1 }}
                  </span>
                  <span class="text-base">{{ categoryEmoji[cat] }}</span>
                  <span class="text-sm text-zinc-300 capitalize">{{ cat.replace('_', ' ') }}</span>
                </div>
                <span class="text-sm font-medium text-zinc-200">{{ formatCurrency(amount) }}</span>
              </div>
            </div>
            <p v-else class="text-sm text-zinc-600">No expenses yet</p>
          </BaseCard>

          <BaseCard class="p-5">
            <h2 class="text-sm font-semibold text-zinc-300 mb-4">Net Worth Breakdown</h2>
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-zinc-400">Total Assets</span>
                <span class="text-sm font-medium text-emerald-400">{{ formatCurrency(store.totalAssets) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-zinc-400">Total Liabilities</span>
                <span class="text-sm font-medium text-rose-400">{{ formatCurrency(store.totalLiabilities) }}</span>
              </div>
              <div class="border-t border-zinc-800/50 pt-3 flex items-center justify-between">
                <span class="text-sm font-semibold text-zinc-200">Net Worth</span>
                <span
                  class="text-sm font-bold"
                  :class="store.currentNetWorth >= 0 ? 'text-zinc-100' : 'text-rose-400'"
                >
                  {{ formatCurrency(store.currentNetWorth) }}
                </span>
              </div>
            </div>
          </BaseCard>
        </div>
      </div>

      <!-- ══════════════════ TRANSACTIONS TAB ══════════════════ -->
      <div v-if="activeTab === 'transactions'" class="space-y-4">

        <!-- Header row -->
        <div class="flex items-center justify-between">
          <p class="text-sm text-zinc-500">{{ sortedTransactions.length }} transactions in {{ selectedMonthLabel }}</p>
          <BaseButton variant="primary" size="sm" @click="showAddTransaction = true">
            <template #icon>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </template>
            Add Transaction
          </BaseButton>
        </div>

        <!-- Month nav -->
        <div class="flex items-center gap-3">
          <BaseButton variant="ghost" size="sm" @click="prevMonth">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </BaseButton>
          <span class="text-sm font-medium text-zinc-200 min-w-[140px] text-center">{{ selectedMonthLabel }}</span>
          <BaseButton variant="ghost" size="sm" @click="nextMonth">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </BaseButton>
        </div>

        <!-- List -->
        <div v-if="sortedTransactions.length > 0" class="space-y-2">
          <BaseCard
            v-for="tx in sortedTransactions"
            :key="tx.id"
            class="px-4 py-3 flex items-center gap-3"
          >
            <!-- Category icon -->
            <div class="w-9 h-9 rounded-xl bg-zinc-800/60 flex items-center justify-center flex-shrink-0 text-lg">
              {{ categoryEmoji[tx.category] }}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-zinc-200 truncate">{{ tx.description }}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] text-zinc-500">{{ tx.date }}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 capitalize">
                  {{ tx.category.replace('_', ' ') }}
                </span>
              </div>
            </div>

            <!-- Amount -->
            <span
              class="text-sm font-semibold flex-shrink-0"
              :class="tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'"
            >
              {{ tx.type === 'income' ? '+' : '-' }}{{ formatCurrency(tx.amount) }}
            </span>

            <!-- Delete -->
            <BaseButton variant="danger" size="sm" @click="store.deleteTransaction(tx.id)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </BaseButton>
          </BaseCard>
        </div>

        <EmptyState
          v-else
          title="No transactions yet"
          description="Add your first transaction to start tracking your finances."
          action-label="Add Transaction"
          @action="showAddTransaction = true"
        />
      </div>

      <!-- ══════════════════ BUDGETS TAB ══════════════════ -->
      <div v-if="activeTab === 'budgets'" class="space-y-4">

        <div class="flex items-center justify-between">
          <p class="text-sm text-zinc-500">{{ store.budgetStatus.length }} budgets for {{ selectedMonthLabel }}</p>
          <BaseButton variant="primary" size="sm" @click="showAddBudget = true">
            <template #icon>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </template>
            Add Budget
          </BaseButton>
        </div>

        <div v-if="store.budgetStatus.length > 0" class="space-y-3">
          <BaseCard
            v-for="item in store.budgetStatus"
            :key="item.budget.id"
            class="p-5"
            :class="item.percentage >= 100 ? 'border border-rose-500/30' : ''"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ categoryEmoji[item.budget.category] }}</span>
                <span class="text-sm font-semibold text-zinc-200 capitalize">
                  {{ item.budget.category.replace('_', ' ') }}
                </span>
                <span
                  v-if="item.percentage >= 100"
                  class="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-medium"
                >
                  Over budget
                </span>
              </div>
              <div class="text-right">
                <p class="text-sm font-medium text-zinc-200">
                  {{ formatCurrency(item.spent) }} / {{ formatCurrency(item.budget.monthlyLimit) }}
                </p>
                <p
                  class="text-xs mt-0.5"
                  :class="item.remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                >
                  {{ item.remaining >= 0 ? formatCurrency(item.remaining) + ' remaining' : formatCurrency(Math.abs(item.remaining)) + ' over' }}
                </p>
              </div>
            </div>

            <!-- Progress bar -->
            <div class="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="item.percentage >= 100 ? 'bg-rose-500' : item.percentage >= 80 ? 'bg-amber-500' : 'bg-indigo-500'"
                :style="{ width: `${item.percentage}%` }"
              />
            </div>
            <p class="text-[10px] text-zinc-600 mt-1.5 text-right">{{ Math.round(item.percentage) }}% used</p>
          </BaseCard>
        </div>

        <EmptyState
          v-else
          title="No budgets set"
          description="Create a budget to track spending limits by category."
          action-label="Add Budget"
          @action="showAddBudget = true"
        />
      </div>

      <!-- ══════════════════ CALCULATORS TAB ══════════════════ -->
      <div v-if="activeTab === 'calculators'" class="space-y-6">

        <!-- Loan Calculator -->
        <BaseCard class="p-6">
          <h2 class="text-base font-semibold text-zinc-200 mb-5">Loan Calculator</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label :class="labelClass">Principal ($)</label>
              <input v-model.number="loanInput.principal" type="number" min="0" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Annual Rate (%)</label>
              <input v-model.number="loanInput.annualRate" type="number" min="0" step="0.1" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Term (months)</label>
              <input v-model.number="loanInput.termMonths" type="number" min="1" :class="inputClass" />
            </div>
          </div>
          <BaseButton variant="primary" size="md" @click="runLoanCalc">Calculate</BaseButton>

          <div v-if="loanResult" class="mt-6 space-y-4">
            <!-- Results summary -->
            <div class="grid grid-cols-3 gap-4">
              <div class="bg-zinc-800/50 rounded-xl p-4 text-center">
                <p class="text-xs text-zinc-500 mb-1">Monthly Payment</p>
                <p class="text-lg font-bold text-zinc-100">{{ formatCurrency(loanResult.monthlyPayment) }}</p>
              </div>
              <div class="bg-zinc-800/50 rounded-xl p-4 text-center">
                <p class="text-xs text-zinc-500 mb-1">Total Payment</p>
                <p class="text-lg font-bold text-zinc-100">{{ formatCurrency(loanResult.totalPayment) }}</p>
              </div>
              <div class="bg-zinc-800/50 rounded-xl p-4 text-center">
                <p class="text-xs text-zinc-500 mb-1">Total Interest</p>
                <p class="text-lg font-bold text-rose-400">{{ formatCurrency(loanResult.totalInterest) }}</p>
              </div>
            </div>

            <!-- Amortization table (first 12 rows) -->
            <div>
              <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Amortization Schedule (first 12 months)</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-zinc-500 border-b border-zinc-800/50">
                      <th class="text-left pb-2 pr-3 font-medium">Month</th>
                      <th class="text-right pb-2 pr-3 font-medium">Payment</th>
                      <th class="text-right pb-2 pr-3 font-medium">Principal</th>
                      <th class="text-right pb-2 pr-3 font-medium">Interest</th>
                      <th class="text-right pb-2 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in loanResult.amortizationSchedule.slice(0, 12)"
                      :key="row.month"
                      class="border-b border-zinc-800/30 hover:bg-zinc-800/20"
                    >
                      <td class="py-1.5 pr-3 text-zinc-400">{{ row.month }}</td>
                      <td class="py-1.5 pr-3 text-right text-zinc-300">{{ formatCurrency(row.payment) }}</td>
                      <td class="py-1.5 pr-3 text-right text-emerald-400">{{ formatCurrency(row.principal) }}</td>
                      <td class="py-1.5 pr-3 text-right text-rose-400">{{ formatCurrency(row.interest) }}</td>
                      <td class="py-1.5 text-right text-zinc-300">{{ formatCurrency(row.balance) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Compound Interest Calculator -->
        <BaseCard class="p-6">
          <h2 class="text-base font-semibold text-zinc-200 mb-5">Compound Interest Calculator</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label :class="labelClass">Principal ($)</label>
              <input v-model.number="ciInput.principal" type="number" min="0" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Annual Rate (%)</label>
              <input v-model.number="ciInput.annualRate" type="number" min="0" step="0.1" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Years</label>
              <input v-model.number="ciInput.years" type="number" min="1" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Compounding Frequency</label>
              <select v-model="ciInput.compoundingFrequency" :class="inputClass">
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
            <div>
              <label :class="labelClass">Monthly Contribution ($)</label>
              <input v-model.number="ciInput.monthlyContribution" type="number" min="0" :class="inputClass" />
            </div>
          </div>
          <BaseButton variant="primary" size="md" @click="runCICalc">Calculate</BaseButton>

          <div v-if="ciResult" class="mt-6 space-y-4">
            <!-- Results summary -->
            <div class="grid grid-cols-3 gap-4">
              <div class="bg-zinc-800/50 rounded-xl p-4 text-center">
                <p class="text-xs text-zinc-500 mb-1">Final Amount</p>
                <p class="text-lg font-bold text-emerald-400">{{ formatCurrency(ciResult.finalAmount) }}</p>
              </div>
              <div class="bg-zinc-800/50 rounded-xl p-4 text-center">
                <p class="text-xs text-zinc-500 mb-1">Total Contributions</p>
                <p class="text-lg font-bold text-zinc-100">{{ formatCurrency(ciResult.totalContributions) }}</p>
              </div>
              <div class="bg-zinc-800/50 rounded-xl p-4 text-center">
                <p class="text-xs text-zinc-500 mb-1">Interest Earned</p>
                <p class="text-lg font-bold text-indigo-400">{{ formatCurrency(ciResult.totalInterest) }}</p>
              </div>
            </div>

            <!-- Year-by-year table -->
            <div>
              <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Year-by-Year Breakdown</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-zinc-500 border-b border-zinc-800/50">
                      <th class="text-left pb-2 pr-3 font-medium">Year</th>
                      <th class="text-right pb-2 pr-3 font-medium">Balance</th>
                      <th class="text-right pb-2 pr-3 font-medium">Contributions</th>
                      <th class="text-right pb-2 font-medium">Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in ciResult.yearByYearBreakdown"
                      :key="row.year"
                      class="border-b border-zinc-800/30 hover:bg-zinc-800/20"
                    >
                      <td class="py-1.5 pr-3 text-zinc-400">Year {{ row.year }}</td>
                      <td class="py-1.5 pr-3 text-right text-emerald-400">{{ formatCurrency(row.balance) }}</td>
                      <td class="py-1.5 pr-3 text-right text-zinc-300">{{ formatCurrency(row.contributions) }}</td>
                      <td class="py-1.5 text-right text-indigo-400">{{ formatCurrency(row.interest) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- ══════════════════ GOALS TAB ══════════════════ -->
      <div v-if="activeTab === 'goals'" class="space-y-4">

        <div class="flex items-center justify-between">
          <p class="text-sm text-zinc-500">{{ store.goals.length }} financial goals</p>
          <BaseButton variant="primary" size="sm" @click="showAddGoal = true">
            <template #icon>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </template>
            Add Goal
          </BaseButton>
        </div>

        <div v-if="store.goals.length > 0" class="space-y-3">
          <BaseCard
            v-for="goal in store.goals"
            :key="goal.id"
            class="p-5"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ categoryEmoji[goal.category] }}</span>
                <div>
                  <p class="text-sm font-semibold text-zinc-200">{{ goal.name }}</p>
                  <p v-if="goal.deadline" class="text-xs text-zinc-500">Due {{ goal.deadline }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span
                  v-if="goal.isCompleted"
                  class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium"
                >
                  Completed
                </span>
                <BaseButton
                  v-else
                  variant="ghost"
                  size="sm"
                  @click="markGoalComplete(goal.id)"
                >
                  Mark complete
                </BaseButton>
              </div>
            </div>

            <!-- Progress bar -->
            <div class="flex items-center gap-3">
              <div class="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="goal.isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'"
                  :style="{ width: `${goalProgress(goal.currentAmount, goal.targetAmount)}%` }"
                />
              </div>
              <span class="text-xs text-zinc-400 flex-shrink-0 w-24 text-right">
                {{ formatCurrency(goal.currentAmount) }} / {{ formatCurrency(goal.targetAmount) }}
              </span>
            </div>
            <p class="text-[10px] text-zinc-600 mt-1.5">
              {{ Math.round(goalProgress(goal.currentAmount, goal.targetAmount)) }}% reached
            </p>
            <p v-if="goal.notes" class="text-xs text-zinc-500 mt-2">{{ goal.notes }}</p>
          </BaseCard>
        </div>

        <EmptyState
          v-else
          title="No goals yet"
          description="Set a financial goal to stay motivated and track your progress."
          action-label="Add Goal"
          @action="showAddGoal = true"
        />
      </div>

    </div>
  </div>

  <!-- ══════════════════ ADD TRANSACTION MODAL ══════════════════ -->
  <BaseModal v-model="showAddTransaction" title="Add Transaction" size="md">
    <div class="space-y-4">
      <div>
        <label :class="labelClass">Type</label>
        <select v-model="txForm.type" :class="inputClass">
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>
      <div>
        <label :class="labelClass">Amount ($)</label>
        <input v-model.number="txForm.amount" type="number" min="0" step="0.01" :class="inputClass" placeholder="0.00" />
      </div>
      <div>
        <label :class="labelClass">Category</label>
        <select v-model="txForm.category" :class="inputClass">
          <option v-for="cat in allCategories" :key="cat" :value="cat">
            {{ categoryEmoji[cat] }} {{ cat.replace('_', ' ') }}
          </option>
        </select>
      </div>
      <div>
        <label :class="labelClass">Description</label>
        <input v-model="txForm.description" type="text" :class="inputClass" placeholder="e.g. Coffee shop" />
      </div>
      <div>
        <label :class="labelClass">Date</label>
        <input v-model="txForm.date" type="date" :class="inputClass" />
      </div>
    </div>
    <template #footer>
      <BaseButton variant="ghost" size="md" @click="showAddTransaction = false">Cancel</BaseButton>
      <BaseButton variant="primary" size="md" @click="submitTransaction">Save Transaction</BaseButton>
    </template>
  </BaseModal>

  <!-- ══════════════════ ADD BUDGET MODAL ══════════════════ -->
  <BaseModal v-model="showAddBudget" title="Add Budget" size="sm">
    <div class="space-y-4">
      <div>
        <label :class="labelClass">Category</label>
        <select v-model="budgetForm.category" :class="inputClass">
          <option v-for="cat in allCategories" :key="cat" :value="cat">
            {{ categoryEmoji[cat] }} {{ cat.replace('_', ' ') }}
          </option>
        </select>
      </div>
      <div>
        <label :class="labelClass">Monthly Limit ($)</label>
        <input v-model.number="budgetForm.monthlyLimit" type="number" min="0" step="0.01" :class="inputClass" placeholder="0.00" />
      </div>
    </div>
    <template #footer>
      <BaseButton variant="ghost" size="md" @click="showAddBudget = false">Cancel</BaseButton>
      <BaseButton variant="primary" size="md" @click="submitBudget">Save Budget</BaseButton>
    </template>
  </BaseModal>

  <!-- ══════════════════ ADD GOAL MODAL ══════════════════ -->
  <BaseModal v-model="showAddGoal" title="Add Financial Goal" size="md">
    <div class="space-y-4">
      <div>
        <label :class="labelClass">Goal Name</label>
        <input v-model="goalForm.name" type="text" :class="inputClass" placeholder="e.g. Emergency Fund" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label :class="labelClass">Target Amount ($)</label>
          <input v-model.number="goalForm.targetAmount" type="number" min="0" step="0.01" :class="inputClass" placeholder="0.00" />
        </div>
        <div>
          <label :class="labelClass">Current Amount ($)</label>
          <input v-model.number="goalForm.currentAmount" type="number" min="0" step="0.01" :class="inputClass" placeholder="0.00" />
        </div>
      </div>
      <div>
        <label :class="labelClass">Category</label>
        <select v-model="goalForm.category" :class="inputClass">
          <option v-for="cat in allCategories" :key="cat" :value="cat">
            {{ categoryEmoji[cat] }} {{ cat.replace('_', ' ') }}
          </option>
        </select>
      </div>
      <div>
        <label :class="labelClass">Deadline (optional)</label>
        <input v-model="goalForm.deadline" type="date" :class="inputClass" />
      </div>
      <div>
        <label :class="labelClass">Notes (optional)</label>
        <textarea v-model="goalForm.notes" :class="inputClass" rows="2" placeholder="Any notes..." />
      </div>
    </div>
    <template #footer>
      <BaseButton variant="ghost" size="md" @click="showAddGoal = false">Cancel</BaseButton>
      <BaseButton variant="primary" size="md" @click="submitGoal">Save Goal</BaseButton>
    </template>
  </BaseModal>
</template>
