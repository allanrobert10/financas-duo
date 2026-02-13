import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockCategories, mockProfile, mockUser } from '../mocks/supabase'
import { Dado, Quando, Entao, TirarScreenshot } from '../bdd-utils'
import CategoriesPage from '@/app/(dashboard)/categories/page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/categories',
}))

// Mock Supabase Chain
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

describe('Funcionalidade: Gestão de Categorias', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    })

    test('Cenário: Deve exibir skeleton loading enquanto carrega', async () => {
        await Dado('que a requisição de categorias está pendente', async () => {
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

        await Quando('o usuário acessa a página de categorias', async () => {
            render(<CategoriesPage />)
        })

        await Entao('o skeleton loading deve ser exibido', async () => {
            expect(document.querySelector('.skeleton')).toBeTruthy()
            await TirarScreenshot('Skeleton Loading')
        })
    })

    test('Cenário: Deve renderizar lista de categorias após carregar', async () => {
        await Dado('que existem categorias cadastradas', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'categories') return createChain(mockCategories)
                if (table === 'profiles') return createChain(mockProfile)
                return createChain([])
            })
        })

        await Quando('a página carrega os dados', async () => {
            render(<CategoriesPage />)
        })

        await Entao('as categorias devem estar visíveis na tela', async () => {
            await waitFor(() => {
                expect(screen.getAllByText(/Alimentação/)[0]).toBeTruthy()
                expect(screen.getAllByText(/Transporte/)[0]).toBeTruthy()
            })
            await TirarScreenshot('Lista de Categorias')
        })
    })

    test('Cenário: Deve separar categorias de Despesas e Receitas', async () => {
        await Dado('que existem categorias de tipos diferentes', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'categories') return createChain(mockCategories)
                if (table === 'profiles') return createChain(mockProfile)
                return createChain([])
            })
        })

        await Quando('a página renderiza as seções', async () => {
            render(<CategoriesPage />)
        })

        await Entao('os títulos de seção Despesas e Receitas devem aparecer', async () => {
            await waitFor(() => {
                expect(screen.getAllByText(/Despesas/)[0]).toBeTruthy()
                expect(screen.getAllByText(/Receitas/)[0]).toBeTruthy()
            })
            await TirarScreenshot('Seções Separadas')
        })
    })

    test('Cenário: Deve abrir modal ao clicar em Nova Categoria', async () => {
        const user = userEvent.setup()

        await Dado('que a página está carregada', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'categories') return createChain(mockCategories)
                if (table === 'profiles') return createChain(mockProfile)
                return createChain([])
            })
            render(<CategoriesPage />)
            await waitFor(() => expect(screen.getAllByText(/Alimentação/)[0]).toBeTruthy())
        })

        await Quando('o usuário clica no botão "Nova Categoria"', async () => {
            const addBtn = screen.getByText(/Nova Categoria/)
            await user.click(addBtn)
        })

        await Entao('o modal de cadastro deve ser exibido', async () => {
            expect(screen.getByText('Cancelar')).toBeTruthy() // Verifica presença do botão cancelar do modal
            await TirarScreenshot('Modal Aberto')
        })
    })
})
