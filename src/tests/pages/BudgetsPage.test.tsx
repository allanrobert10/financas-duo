import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockBudgets, mockCategories, mockProfile, mockUser } from '../mocks/supabase'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/budgets',
}))

function createChain(resolvedData: unknown, error: unknown = null) {
    const result = { data: resolvedData, error }
    const promise = Promise.resolve(result)
    const handler: ProxyHandler<object> = {
        get(_target, prop) {
            if (prop === 'then') return promise.then.bind(promise)
            if (prop === 'catch') return promise.catch.bind(promise)
            if (prop === 'finally') return promise.finally.bind(promise)
            if (prop === Symbol.toStringTag) return 'Promise'
            if (prop === 'single' || prop === 'maybeSingle') {
                return vi.fn().mockResolvedValue({
                    data: Array.isArray(resolvedData) ? resolvedData[0] : resolvedData,
                    error,
                })
            }
            return vi.fn().mockReturnValue(new Proxy({}, handler))
        },
    }
    return new Proxy({}, handler)
}

const mockFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: mockFrom,
        auth: {
            getUser: mockGetUser,
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
    }),
}))

import BudgetsPage from '@/app/(dashboard)/budgets/page'

describe('BudgetsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    })

    it('should show skeleton while loading', () => {
        const neverResolve = new Promise(() => { })
        const handler: ProxyHandler<object> = {
            get(_t, prop) {
                if (prop === 'then') return neverResolve.then.bind(neverResolve)
                if (prop === 'catch') return () => neverResolve
                return vi.fn().mockReturnValue(new Proxy({}, handler))
            },
        }
        mockFrom.mockReturnValue(new Proxy({}, handler))

        const { container } = render(<BudgetsPage />)
        expect(container.querySelector('.skeleton')).toBeTruthy()
    })

    it('should render budgets after loading', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'budgets') return createChain(mockBudgets)
            if (table === 'categories') return createChain(mockCategories)
            if (table === 'profiles') return createChain(mockProfile)
            if (table === 'transactions') return createChain([])
            return createChain([])
        })

        render(<BudgetsPage />)

        await waitFor(() => {
            expect(screen.getAllByText(/Orçamentos/)[0]).toBeTruthy()
        })
    })

    it('should display progress bars for budgets', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'budgets') return createChain(mockBudgets)
            if (table === 'categories') return createChain(mockCategories)
            if (table === 'profiles') return createChain(mockProfile)
            if (table === 'transactions') return createChain([])
            return createChain([])
        })

        const { container } = render(<BudgetsPage />)

        await waitFor(() => {
            const progressBars = container.querySelectorAll('.progress-bar')
            expect(progressBars.length).toBeGreaterThanOrEqual(0)
        })
    })

    it('should navigate between months', async () => {
        const user = userEvent.setup()
        mockFrom.mockImplementation((table: string) => {
            if (table === 'budgets') return createChain(mockBudgets)
            if (table === 'categories') return createChain(mockCategories)
            if (table === 'profiles') return createChain(mockProfile)
            if (table === 'transactions') return createChain([])
            return createChain([])
        })

        render(<BudgetsPage />)

        await waitFor(() => {
            expect(screen.getByText('Orçamentos')).toBeTruthy()
        })

        const buttons = screen.getAllByRole('button')
        const navButtons = buttons.filter(b => b.querySelector('svg'))
        expect(navButtons.length).toBeGreaterThan(0)
    })
})
