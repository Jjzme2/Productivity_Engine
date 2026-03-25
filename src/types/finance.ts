// ─── Finance domain types ─────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer'

export type TransactionCategory =
  | 'salary'
  | 'freelance'
  | 'investment'
  | 'housing'
  | 'food'
  | 'transport'
  | 'health'
  | 'entertainment'
  | 'education'
  | 'subscriptions'
  | 'savings'
  | 'debt'
  | 'insurance'
  | 'utilities'
  | 'shopping'
  | 'travel'
  | 'other_income'
  | 'other_expense'

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  /** Absolute positive value; sign is determined by `type` */
  amount: number
  /** ISO 4217 currency code, e.g. 'USD' */
  currency: string
  category: TransactionCategory
  description: string
  /** YYYY-MM-DD */
  date: string
  tags: string[]
  accountId: string
  isRecurring: boolean
  /** iCal-style RRULE string, e.g. 'FREQ=MONTHLY;BYMONTHDAY=1' */
  recurrenceRule?: string
  linkedTaskId?: string
  /** ISO-8601 datetime */
  createdAt: string
  /** ISO-8601 datetime */
  updatedAt: string
}

export type AccountType = 'checking' | 'savings' | 'investment' | 'credit' | 'loan' | 'cash'

export interface Account {
  id: string
  userId: string
  name: string
  type: AccountType
  balance: number
  /** ISO 4217 currency code */
  currency: string
  institution?: string
  isHidden: boolean
  /** ISO-8601 datetime */
  createdAt: string
  /** ISO-8601 datetime */
  updatedAt: string
}

export interface Budget {
  id: string
  userId: string
  category: TransactionCategory
  monthlyLimit: number
  spent: number
  /** YYYY-MM */
  period: string
  /** CSS color string, e.g. '#6366f1' */
  color?: string
  /** ISO-8601 datetime */
  createdAt: string
  /** ISO-8601 datetime */
  updatedAt: string
}

export interface NetWorthEntry {
  id: string
  userId: string
  /** YYYY-MM-DD */
  date: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  /** Map of account name → balance snapshot */
  breakdown: Record<string, number>
  /** ISO-8601 datetime */
  createdAt: string
}

export interface FinancialGoal {
  id: string
  userId: string
  name: string
  targetAmount: number
  currentAmount: number
  /** YYYY-MM-DD */
  deadline?: string
  category: TransactionCategory
  notes?: string
  isCompleted: boolean
  /** ISO-8601 datetime */
  createdAt: string
  /** ISO-8601 datetime */
  updatedAt: string
}

// ─── Payload types ────────────────────────────────────────────────────────────

export type CreateTransactionPayload = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateTransactionPayload = Partial<Transaction> & { id: string }

// ─── Loan calculation types ───────────────────────────────────────────────────

export interface LoanCalcInput {
  /** Principal loan amount */
  principal: number
  /** Annual interest rate as a percentage, e.g. 5 for 5% */
  annualRate: number
  /** Loan term in months */
  termMonths: number
}

export interface AmortizationEntry {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}

export interface LoanCalcResult {
  monthlyPayment: number
  totalPayment: number
  totalInterest: number
  amortizationSchedule: AmortizationEntry[]
}

// ─── Compound interest calculation types ─────────────────────────────────────

export type CompoundingFrequency = 'daily' | 'monthly' | 'quarterly' | 'annually'

export interface CompoundInterestInput {
  principal: number
  /** Annual interest rate as a percentage, e.g. 7 for 7% */
  annualRate: number
  years: number
  compoundingFrequency: CompoundingFrequency
  /** Additional contribution made each month */
  monthlyContribution: number
}

export interface YearlyBreakdownEntry {
  year: number
  balance: number
  contributions: number
  interest: number
}

export interface CompoundInterestResult {
  finalAmount: number
  totalContributions: number
  totalInterest: number
  yearByYearBreakdown: YearlyBreakdownEntry[]
}
