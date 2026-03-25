import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type {
  Account,
  Transaction,
  Budget,
  FinancialGoal,
  NetWorthEntry,
  TransactionCategory,
  LoanCalcInput,
  LoanCalcResult,
  AmortizationEntry,
  CompoundingFrequency,
  CompoundInterestInput,
  CompoundInterestResult,
  YearlyBreakdownEntry,
} from '@/types/finance'
import {
  subscribeToCollection,
  createDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  COLLECTIONS,
} from '@/services/firestoreClient'
import type { Unsubscribe } from 'firebase/firestore'

// ─── Pure financial calculation functions ────────────────────────────────────

export function calculateLoan(input: LoanCalcInput): LoanCalcResult {
  const { principal, annualRate, termMonths } = input
  const monthlyRate = annualRate / 100 / 12

  let monthlyPayment: number
  if (monthlyRate === 0) {
    monthlyPayment = principal / termMonths
  } else {
    monthlyPayment =
      (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
      (Math.pow(1 + monthlyRate, termMonths) - 1)
  }

  const amortizationSchedule: AmortizationEntry[] = []
  let balance = principal

  for (let month = 1; month <= termMonths; month++) {
    const interest = balance * monthlyRate
    const principalPaid = monthlyPayment - interest
    balance = Math.max(0, balance - principalPaid)

    amortizationSchedule.push({
      month,
      payment: parseFloat(monthlyPayment.toFixed(2)),
      principal: parseFloat(principalPaid.toFixed(2)),
      interest: parseFloat(interest.toFixed(2)),
      balance: parseFloat(balance.toFixed(2)),
    })
  }

  const totalPayment = monthlyPayment * termMonths
  const totalInterest = totalPayment - principal

  return {
    monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
    totalPayment: parseFloat(totalPayment.toFixed(2)),
    totalInterest: parseFloat(totalInterest.toFixed(2)),
    amortizationSchedule,
  }
}

export function calculateCompoundInterest(input: CompoundInterestInput): CompoundInterestResult {
  const { principal, annualRate, years, compoundingFrequency, monthlyContribution } = input

  const frequencyMap: Record<CompoundingFrequency, number> = {
    daily: 365,
    monthly: 12,
    quarterly: 4,
    annually: 1,
  }
  const n = frequencyMap[compoundingFrequency] || 12
  const r = annualRate / 100

  const yearByYearBreakdown: YearlyBreakdownEntry[] = []
  let balance = principal
  let totalContributions = principal

  for (let year = 1; year <= years; year++) {
    const startBalance = balance
    // Apply compounding n times per year for each sub-period
    const periodsPerYear = n
    for (let p = 0; p < periodsPerYear; p++) {
      balance = balance * (1 + r / n)
      // Add monthly contributions proportionally to the compounding period
      const contributionsPerPeriod = monthlyContribution * (12 / n)
      balance += contributionsPerPeriod
      totalContributions += contributionsPerPeriod
    }

    const interestEarned = balance - startBalance - monthlyContribution * 12

    yearByYearBreakdown.push({
      year,
      balance: parseFloat(balance.toFixed(2)),
      contributions: parseFloat((totalContributions - principal).toFixed(2)),
      interest: parseFloat(interestEarned.toFixed(2)),
    })
  }

  const finalAmount = parseFloat(balance.toFixed(2))
  const totalContributionsFinal = parseFloat((totalContributions - principal).toFixed(2))
  const totalInterest = parseFloat((finalAmount - principal - totalContributionsFinal).toFixed(2))

  return {
    finalAmount,
    totalContributions: totalContributionsFinal,
    totalInterest,
    yearByYearBreakdown,
  }
}

// ─── No Seed data (Using Firestore) ────────────────────────────────────────────────────────────────

// ─── Store ────────────────────────────────────────────────────────────────────

export const useFinanceStore = defineStore('finance', () => {
  const accounts = ref<Account[]>([])
  const transactions = ref<Transaction[]>([])
  const budgets = ref<Budget[]>([])
  const goals = ref<FinancialGoal[]>([])
  const netWorthHistory = ref<NetWorthEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  const _d = new Date()
  const CURRENT_MONTH = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}`

  const selectedMonth = ref<string>(CURRENT_MONTH)

  let _unsubAccounts: Unsubscribe | null = null
  let _unsubTransactions: Unsubscribe | null = null
  let _unsubBudgets: Unsubscribe | null = null
  let _unsubGoals: Unsubscribe | null = null
  let _unsubNetWorth: Unsubscribe | null = null

  // ─── Computed ──────────────────────────────────────────────────────────────

  const currentMonthTransactions = computed(() =>
    transactions.value.filter(t => t.date.startsWith(selectedMonth.value))
  )

  const totalIncome = computed(() =>
    currentMonthTransactions.value
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  )

  const totalExpenses = computed(() =>
    currentMonthTransactions.value
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  )

  const netCashFlow = computed(() => totalIncome.value - totalExpenses.value)

  const expensesByCategory = computed(() => {
    const map = {} as Record<TransactionCategory, number>
    currentMonthTransactions.value
      .filter(t => t.type === 'expense')
      .forEach(t => {
        map[t.category] = (map[t.category] ?? 0) + t.amount
      })
    return map
  })

  const budgetStatus = computed(() =>
    budgets.value
      .filter(b => b.period === selectedMonth.value)
      .map(budget => {
        const spent = expensesByCategory.value[budget.category] ?? 0
        const remaining = budget.monthlyLimit - spent
        const percentage = budget.monthlyLimit > 0
          ? Math.min(100, (spent / budget.monthlyLimit) * 100)
          : 0
        return { budget, spent, remaining, percentage }
      })
  )

  const latestNetWorth = computed(() =>
    netWorthHistory.value.length > 0
      ? netWorthHistory.value[netWorthHistory.value.length - 1]
      : null
  )

  const assetTypes = new Set<Account['type']>(['checking', 'savings', 'investment', 'cash'])
  const liabilityTypes = new Set<Account['type']>(['credit', 'loan'])

  const totalAssets = computed(() =>
    accounts.value
      .filter(a => !a.isHidden && assetTypes.has(a.type))
      .reduce((sum, a) => sum + a.balance, 0)
  )

  const totalLiabilities = computed(() =>
    accounts.value
      .filter(a => !a.isHidden && liabilityTypes.has(a.type))
      .reduce((sum, a) => sum + a.balance, 0)
  )

  const currentNetWorth = computed(() => totalAssets.value - totalLiabilities.value)

  // ─── Actions ───────────────────────────────────────────────────────────────

  function loadData(userId: string) {
    loading.value = true
    _unsubAccounts = subscribeToCollection<Account>(
      COLLECTIONS.ACCOUNTS,
      { where: [{ field: 'userId', op: '==', value: userId }] },
      (docs) => { accounts.value = docs; loading.value = false },
      (err) => { error.value = err.message; loading.value = false }
    )
    _unsubTransactions = subscribeToCollection<Transaction>(
      COLLECTIONS.TRANSACTIONS,
      { where: [{ field: 'userId', op: '==', value: userId }], orderBy: [{ field: 'date', direction: 'desc' }] },
      (docs) => { transactions.value = docs }
    )
    _unsubBudgets = subscribeToCollection<Budget>(
      COLLECTIONS.BUDGETS,
      { where: [{ field: 'userId', op: '==', value: userId }] },
      (docs) => { budgets.value = docs }
    )
    _unsubGoals = subscribeToCollection<FinancialGoal>(
      COLLECTIONS.FINANCIAL_GOALS,
      { where: [{ field: 'userId', op: '==', value: userId }] },
      (docs) => { goals.value = docs }
    )
    _unsubNetWorth = subscribeToCollection<NetWorthEntry>(
      COLLECTIONS.NET_WORTH,
      { where: [{ field: 'userId', op: '==', value: userId }], orderBy: [{ field: 'date', direction: 'asc' }] },
      (docs) => { netWorthHistory.value = docs }
    )
  }

  function unloadData() {
    _unsubAccounts?.(); _unsubAccounts = null
    _unsubTransactions?.(); _unsubTransactions = null
    _unsubBudgets?.(); _unsubBudgets = null
    _unsubGoals?.(); _unsubGoals = null
    _unsubNetWorth?.(); _unsubNetWorth = null
    accounts.value = []
    transactions.value = []
    budgets.value = []
    goals.value = []
    netWorthHistory.value = []
  }

  async function createTransaction(payload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const now = new Date().toISOString()
    const draft: Transaction = { ...payload, id: nanoid(), createdAt: now, updatedAt: now }
    transactions.value.unshift(draft)
    try {
      const created = await createDoc<Transaction>(COLLECTIONS.TRANSACTIONS, draft as Omit<Transaction, 'id'>)
      const idx = transactions.value.findIndex(t => t.id === draft.id)
      if (idx !== -1) transactions.value[idx] = created
      return created
    } catch (err) {
      transactions.value = transactions.value.filter(t => t.id !== draft.id)
      throw err
    }
  }

  async function updateTransaction(payload: Partial<Transaction> & { id: string }): Promise<void> {
    const idx = transactions.value.findIndex(t => t.id === payload.id)
    if (idx === -1) return
    const previous = { ...transactions.value[idx]! }
    transactions.value[idx] = { ...previous, ...payload, updatedAt: new Date().toISOString() } as Transaction
    try {
      await fsUpdateDoc<Transaction>(COLLECTIONS.TRANSACTIONS, payload.id, payload)
    } catch (err) {
      transactions.value[idx] = previous
      throw err
    }
  }

  async function deleteTransaction(id: string): Promise<void> {
    const idx = transactions.value.findIndex(t => t.id === id)
    const removed = idx !== -1 ? transactions.value[idx]! : null
    if (idx !== -1) transactions.value.splice(idx, 1)
    try {
      await fsDeleteDoc(COLLECTIONS.TRANSACTIONS, id)
    } catch (err) {
      if (removed !== null && idx !== -1) transactions.value.splice(idx, 0, removed)
      throw err
    }
  }

  async function createAccount(payload: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const now = new Date().toISOString()
    const draft: Account = { ...payload, id: nanoid(), createdAt: now, updatedAt: now }
    accounts.value.push(draft)
    try {
      const created = await createDoc<Account>(COLLECTIONS.ACCOUNTS, draft as Omit<Account, 'id'>)
      const idx = accounts.value.findIndex(a => a.id === draft.id)
      if (idx !== -1) accounts.value[idx] = created
      return created
    } catch (err) {
      accounts.value = accounts.value.filter(a => a.id !== draft.id)
      throw err
    }
  }

  async function updateAccount(payload: Partial<Account> & { id: string }): Promise<void> {
    const idx = accounts.value.findIndex(a => a.id === payload.id)
    if (idx === -1) return
    const previous = { ...accounts.value[idx]! }
    accounts.value[idx] = { ...previous, ...payload, updatedAt: new Date().toISOString() } as Account
    try {
      await fsUpdateDoc<Account>(COLLECTIONS.ACCOUNTS, payload.id, payload)
    } catch (err) {
      accounts.value[idx] = previous
      throw err
    }
  }

  async function createBudget(payload: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
    const now = new Date().toISOString()
    const draft: Budget = { ...payload, id: nanoid(), createdAt: now, updatedAt: now }
    budgets.value.push(draft)
    try {
      const created = await createDoc<Budget>(COLLECTIONS.BUDGETS, draft as Omit<Budget, 'id'>)
      const idx = budgets.value.findIndex(b => b.id === draft.id)
      if (idx !== -1) budgets.value[idx] = created
      return created
    } catch (err) {
      budgets.value = budgets.value.filter(b => b.id !== draft.id)
      throw err
    }
  }

  async function updateBudget(payload: Partial<Budget> & { id: string }): Promise<void> {
    const idx = budgets.value.findIndex(b => b.id === payload.id)
    if (idx === -1) return
    const previous = { ...budgets.value[idx]! }
    budgets.value[idx] = { ...previous, ...payload, updatedAt: new Date().toISOString() } as Budget
    try {
      await fsUpdateDoc<Budget>(COLLECTIONS.BUDGETS, payload.id, payload)
    } catch (err) {
      budgets.value[idx] = previous
      throw err
    }
  }

  async function createGoal(payload: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<FinancialGoal> {
    const now = new Date().toISOString()
    const draft: FinancialGoal = { ...payload, id: nanoid(), createdAt: now, updatedAt: now }
    goals.value.push(draft)
    try {
      const created = await createDoc<FinancialGoal>(COLLECTIONS.FINANCIAL_GOALS, draft as Omit<FinancialGoal, 'id'>)
      const idx = goals.value.findIndex(g => g.id === draft.id)
      if (idx !== -1) goals.value[idx] = created
      return created
    } catch (err) {
      goals.value = goals.value.filter(g => g.id !== draft.id)
      throw err
    }
  }

  async function updateGoal(payload: Partial<FinancialGoal> & { id: string }): Promise<void> {
    const idx = goals.value.findIndex(g => g.id === payload.id)
    if (idx === -1) return
    const previous = { ...goals.value[idx]! }
    goals.value[idx] = { ...previous, ...payload, updatedAt: new Date().toISOString() } as FinancialGoal
    try {
      await fsUpdateDoc<FinancialGoal>(COLLECTIONS.FINANCIAL_GOALS, payload.id, payload)
    } catch (err) {
      goals.value[idx] = previous
      throw err
    }
  }

  async function recordNetWorth(userId: string): Promise<NetWorthEntry> {
    const now = new Date().toISOString()
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const breakdown: Record<string, number> = {}
    accounts.value
      .filter(a => !a.isHidden)
      .forEach(a => { breakdown[a.name] = a.balance })

    const draft: NetWorthEntry = {
      id: nanoid(),
      userId,
      date: today,
      totalAssets: totalAssets.value,
      totalLiabilities: totalLiabilities.value,
      netWorth: currentNetWorth.value,
      breakdown,
      createdAt: now,
    }
    netWorthHistory.value.push(draft)
    try {
      const created = await createDoc<NetWorthEntry>(COLLECTIONS.NET_WORTH, draft as Omit<NetWorthEntry, 'id'>)
      const idx = netWorthHistory.value.findIndex(e => e.id === draft.id)
      if (idx !== -1) netWorthHistory.value[idx] = created
      return created
    } catch (err) {
      netWorthHistory.value = netWorthHistory.value.filter(e => e.id !== draft.id)
      throw err
    }
  }

  return {
    // State
    accounts,
    transactions,
    budgets,
    goals,
    netWorthHistory,
    loading,
    selectedMonth,
    // Computed
    currentMonthTransactions,
    totalIncome,
    totalExpenses,
    netCashFlow,
    expensesByCategory,
    budgetStatus,
    latestNetWorth,
    totalAssets,
    totalLiabilities,
    currentNetWorth,
    error,
    // Actions
    loadData,
    unloadData,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    createAccount,
    updateAccount,
    createBudget,
    updateBudget,
    createGoal,
    updateGoal,
    recordNetWorth,
  }
})
