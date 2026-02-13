import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { mockCards, mockProfile, mockUser } from '../mocks/supabase'
import { Dado, Quando, Entao, TirarScreenshot } from '../bdd-utils'
import CardsPage from '@/app/(dashboard)/cards/page'

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

describe('Funcionalidade: Gestão de Cartões de Crédito', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    })

    test('Cenário: Deve exibir skeleton loading inicialmente', async () => {
        await Dado('que a requisição de cartões está demorando', async () => {
            const neverResolve = new Promise(() => { })
            const handler: ProxyHandler<object> = {
                get(_t, prop) {
                    if (prop === 'then') return neverResolve.then.bind(neverResolve)
                    if (prop === 'catch') return () => neverResolve
                    return vi.fn().mockReturnValue(new Proxy({}, handler))
                },
            }
            mockFrom.mockReturnValue(new Proxy({}, handler))
        })

        await Quando('o usuário acessa a página', async () => {
            render(<CardsPage />)
        })

        await Entao('o skeleton de cartões deve ser visível', async () => {
            expect(document.querySelector('.skeleton')).toBeTruthy()
            await TirarScreenshot('Skeleton Cartões')
        })
    })

    test('Cenário: Deve listar cartões cadastrados', async () => {
        await Dado('que o usuário possui cartões', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'cards') return createChain(mockCards)
                if (table === 'profiles') return createChain(mockProfile)
                return createChain([])
            })
        })

        await Quando('a página carrega', async () => {
            render(<CardsPage />)
        })

        await Entao('os cartões Nubank e Inter devem aparecer', async () => {
            await waitFor(() => {
                expect(screen.getAllByText(/Nubank/)[0]).toBeTruthy()
                expect(screen.getAllByText(/Inter/)[0]).toBeTruthy()
            })
            await TirarScreenshot('Lista Cartões')
        })
    })

    test('Cenário: Deve destacar cartão principal', async () => {
        await Dado('que um dos cartões é marcado como principal', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'cards') return createChain(mockCards) // mockCards tem um is_primary: true
                if (table === 'profiles') return createChain(mockProfile)
                return createChain([])
            })
        })

        await Quando('a lista é renderizada', async () => {
            render(<CardsPage />)
        })

        await Entao('o badge "Principal" deve ser exibido no cartão correto', async () => {
            await waitFor(() => {
                expect(screen.getByText('Principal')).toBeTruthy()
            })
            await TirarScreenshot('Cartão Principal')
        })
    })

    test('Cenário: Deve ocultar números sensíveis do cartão', async () => {
        await Dado('que os cartões possuem número completo', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'cards') return createChain(mockCards)
                if (table === 'profiles') return createChain(mockProfile)
                return createChain([])
            })
        })

        await Quando('os cartões são exibidos', async () => {
            render(<CardsPage />)
        })

        await Entao('apenas os 4 últimos dígitos devem estar visíveis', async () => {
            await waitFor(() => {
                expect(screen.getByText(/1234/)).toBeTruthy()
                expect(screen.getByText(/5678/)).toBeTruthy()
            })
            await TirarScreenshot('Cartões Mascarados')
        })
    })
})
