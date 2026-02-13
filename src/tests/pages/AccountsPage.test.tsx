import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockAccounts, mockProfile, mockUser } from '../mocks/supabase'
import { Dado, Quando, Entao, TirarScreenshot } from '../bdd-utils'
import AccountsPage from '@/app/(dashboard)/accounts/page'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/accounts',
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

describe('Funcionalidade: Gestão de Contas', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    })

    test('Cenário: Deve exibir skeleton loading enquanto carrega', async () => {
        await Dado('que a requisição de contas está pendente', async () => {
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

        await Quando('o usuário acessa a página de contas', async () => {
            render(<AccountsPage />)
        })

        await Entao('o skeleton loading deve ser exibido', async () => {
            expect(document.querySelector('.skeleton')).toBeTruthy()
            await TirarScreenshot('Skeleton Contas')
        })
    })

    test('Cenário: Deve renderizar lista de contas após carregar', async () => {
        await Dado('que existem contas cadastradas', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'accounts') return createChain(mockAccounts)
                if (table === 'profiles') return createChain(mockProfile)
                return createChain([])
            })
        })

        await Quando('a página termina de carregar', async () => {
            render(<AccountsPage />)
        })

        await Entao('as contas Nubank e Poupança devem estar visíveis', async () => {
            await waitFor(() => {
                expect(screen.getAllByText(/Nubank/)[0]).toBeTruthy()
                expect(screen.getAllByText(/Poupança/)[0]).toBeTruthy()
            })
            await TirarScreenshot('Lista de Contas')
        })
    })

    test('Cenário: Deve calcular saldo total corretamente', async () => {
        await Dado('que as contas têm saldos definidos', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'accounts') return createChain(mockAccounts)
                if (table === 'profiles') return createChain(mockProfile)
                return createChain([])
            })
        })

        await Quando('o saldo total é calculado', async () => {
            render(<AccountsPage />)
        })

        await Entao('o valor total deve ser exibido formatado', async () => {
            await waitFor(() => {
                // mockAccounts tem saldos que somam 15000 (exemplo)
                expect(screen.getByText(/15\.000/)).toBeTruthy()
            })
            await TirarScreenshot('Saldo Total')
        })
    })

    test('Cenário: Deve abrir modal ao clicar em Nova Conta', async () => {
        const user = userEvent.setup()

        await Dado('que a página de contas está carregada', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'accounts') return createChain(mockAccounts)
                if (table === 'profiles') return createChain(mockProfile)
                return createChain([])
            })
            render(<AccountsPage />)
            await waitFor(() => expect(screen.getAllByText(/Nubank/)[0]).toBeTruthy())
        })

        await Quando('o usuário clica em "Nova Conta"', async () => {
            const addBtn = screen.getByText(/Nova Conta/)
            await user.click(addBtn)
        })

        await Entao('o formulário de nova conta deve aparecer', async () => {
            expect(screen.getByText('Cancelar')).toBeTruthy()
            await TirarScreenshot('Modal Nova Conta')
        })
    })
})
