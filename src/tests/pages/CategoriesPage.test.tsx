import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockCategories, mockProfile, mockUser } from '../mocks/supabase'

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/categories',
}))

// Recursive chainable builder that resolves as promise
function createChain(resolvedData: unknown, error: unknown = null) {
    const result = { data: resolvedData, error }
    const promise = Promise.resolve(result)

    const handler: ProxyHandler<object> = {
        get(_target, prop) {
            if (prop === 'then') return promise.then.bind(promise)
            if (prop === 'catch') return promise.catch.bind(promise)
            if (prop === 'finally') return promise.finally.bind(promise)
            if (prop === Symbol.toStringTag) return 'Promise'
            // single/maybeSingle returns a promise directly
            if (prop === 'single' || prop === 'maybeSingle') {
                return vi.fn().mockResolvedValue({
                    data: Array.isArray(resolvedData) ? resolvedData[0] : resolvedData,
                    error,
                })
            }
            // Any other method returns the proxy itself (chainable)
            return vi.fn().mockReturnValue(new Proxy({}, handler))
        },
    }

    return new Proxy({}, handler)
}

// Mock supabase client
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

import CategoriesPage from '@/app/(dashboard)/categories/page'

describe('CategoriesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    })

    it('should show skeleton while loading', () => {
        // Never-resolving promise to keep loading
        const neverResolve = new Promise(() => { })
        const handler: ProxyHandler<object> = {
            get(_t, prop) {
                if (prop === 'then') return neverResolve.then.bind(neverResolve)
                if (prop === 'catch') return () => neverResolve
                return vi.fn().mockReturnValue(new Proxy({}, handler))
            },
        }
        mockFrom.mockReturnValue(new Proxy({}, handler))

        const { container } = render(<CategoriesPage />)
        expect(container.querySelector('.skeleton')).toBeTruthy()
    })

    it('should render categories after loading', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'categories') return createChain(mockCategories)
            if (table === 'profiles') return createChain(mockProfile)
            return createChain([])
        })

        render(<CategoriesPage />)

        await waitFor(() => {
            expect(screen.getByText('Alimentação')).toBeTruthy()
            expect(screen.getByText('Transporte')).toBeTruthy()
        })
    })

    it('should separate expense and income categories', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'categories') return createChain(mockCategories)
            if (table === 'profiles') return createChain(mockProfile)
            return createChain([])
        })

        render(<CategoriesPage />)

        await waitFor(() => {
            expect(screen.getAllByText(/Despesas/)[0]).toBeTruthy()
            expect(screen.getAllByText(/Receitas/)[0]).toBeTruthy()
        })
    })

    it('should open modal when clicking add button', async () => {
        const user = userEvent.setup()
        mockFrom.mockImplementation((table: string) => {
            if (table === 'categories') return createChain(mockCategories)
            if (table === 'profiles') return createChain(mockProfile)
            return createChain([])
        })

        render(<CategoriesPage />)

        await waitFor(() => {
            expect(screen.getByText('Alimentação')).toBeTruthy()
        })

        const addBtn = screen.getByText('Nova Categoria')
        await user.click(addBtn)

        expect(screen.getByText('Cancelar')).toBeTruthy()
    })
})
