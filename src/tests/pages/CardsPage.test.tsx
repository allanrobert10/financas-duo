import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { mockCards, mockProfile, mockUser } from '../mocks/supabase'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/cards',
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

import CardsPage from '@/app/(dashboard)/cards/page'

describe('CardsPage', () => {
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

        const { container } = render(<CardsPage />)
        expect(container.querySelector('.skeleton')).toBeTruthy()
    })

    it('should render cards after loading', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'cards') return createChain(mockCards)
            if (table === 'profiles') return createChain(mockProfile)
            return createChain([])
        })

        render(<CardsPage />)

        await waitFor(() => {
            expect(screen.getAllByText(/Nubank/)[0]).toBeTruthy()
            expect(screen.getAllByText(/Inter/)[0]).toBeTruthy()
        })
    })

    it('should show primary badge on primary card', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'cards') return createChain(mockCards)
            if (table === 'profiles') return createChain(mockProfile)
            return createChain([])
        })

        render(<CardsPage />)

        await waitFor(() => {
            expect(screen.getByText('Principal')).toBeTruthy()
        })
    })

    it('should display card last four digits', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'cards') return createChain(mockCards)
            if (table === 'profiles') return createChain(mockProfile)
            return createChain([])
        })

        render(<CardsPage />)

        await waitFor(() => {
            expect(screen.getByText(/1234/)).toBeTruthy()
            expect(screen.getByText(/5678/)).toBeTruthy()
        })
    })
})
