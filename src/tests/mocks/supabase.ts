import { vi } from 'vitest'

// Chainable query builder mock
function createQueryBuilder(data: unknown[] | unknown = [], error: unknown = null) {
    const builder: Record<string, unknown> = {}

    const chainMethods = [
        'select', 'insert', 'update', 'delete', 'upsert',
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
        'like', 'ilike', 'is', 'in', 'contains',
        'order', 'limit', 'range', 'filter', 'match',
        'gte', 'lte',
    ]

    for (const method of chainMethods) {
        builder[method] = vi.fn().mockReturnValue(builder)
    }

    builder.single = vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error })
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error })
    builder.then = vi.fn((resolve: (value: unknown) => void) => resolve({ data, error }))

    // Make it thenable
    const promise = Promise.resolve({ data, error })
    builder[Symbol.toStringTag] = 'Promise'
    builder.then = promise.then.bind(promise)
    builder.catch = promise.catch.bind(promise)

    return builder
}

// Mock categories
export const mockCategories = [
    { id: '1', name: 'Alimentação', type: 'expense', icon: 'utensils', color: '#10B981', household_id: 'h1', created_at: '2025-01-01' },
    { id: '2', name: 'Transporte', type: 'expense', icon: 'car', color: '#3B82F6', household_id: 'h1', created_at: '2025-01-01' },
    { id: '3', name: 'Salário', type: 'income', icon: 'briefcase', color: '#F59E0B', household_id: 'h1', created_at: '2025-01-01' },
]

// Mock accounts
export const mockAccounts = [
    { id: 'a1', name: 'Nubank', type: 'checking', balance: 5000, color: '#8B5CF6', is_active: true, household_id: 'h1', created_at: '2025-01-01' },
    { id: 'a2', name: 'Poupança', type: 'savings', balance: 10000, color: '#10B981', is_active: true, household_id: 'h1', created_at: '2025-01-01' },
]

// Mock cards
export const mockCards = [
    { id: 'c1', name: 'Nubank', last_four: '1234', brand: 'mastercard', credit_limit: 5000, closing_day: 3, due_day: 10, color: '#8B5CF6', is_active: true, is_primary: true, household_id: 'h1', created_at: '2025-01-01' },
    { id: 'c2', name: 'Inter', last_four: '5678', brand: 'visa', credit_limit: 3000, closing_day: 5, due_day: 15, color: '#F59E0B', is_active: true, is_primary: false, household_id: 'h1', created_at: '2025-01-01' },
]

// Mock budgets
export const mockBudgets = [
    { id: 'b1', category_id: '1', amount: 800, month: 2, year: 2026, household_id: 'h1', created_at: '2025-01-01' },
    { id: 'b2', category_id: '2', amount: 400, month: 2, year: 2026, household_id: 'h1', created_at: '2025-01-01' },
]

// Mock profile
export const mockProfile = { id: 'u1', name: 'Test User', household_id: 'h1' }

// Mock user
export const mockUser = { id: 'u1', email: 'test@test.com' }

export function createMockSupabaseClient(overrides?: {
    categories?: unknown[]
    accounts?: unknown[]
    cards?: unknown[]
    budgets?: unknown[]
    transactions?: unknown[]
}) {
    const data = {
        categories: overrides?.categories ?? mockCategories,
        accounts: overrides?.accounts ?? mockAccounts,
        cards: overrides?.cards ?? mockCards,
        budgets: overrides?.budgets ?? mockBudgets,
        transactions: overrides?.transactions ?? [],
    }

    const fromMock = vi.fn((table: string) => {
        const tableData = data[table as keyof typeof data] ?? []
        return createQueryBuilder(tableData)
    })

    return {
        from: fromMock,
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
            getSession: vi.fn().mockResolvedValue({ data: { session: { user: mockUser } }, error: null }),
            onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
            signInWithPassword: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
            signUp: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
            signOut: vi.fn().mockResolvedValue({ error: null }),
        },
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
}

// Default mock for vi.mock('@/lib/supabase/client')
export const createClient = vi.fn(() => createMockSupabaseClient())
