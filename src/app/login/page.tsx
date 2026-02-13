'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function LoginContent() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // Captura o parâmetro redirect da URL (ex: /accept-invite?token=...)
    const redirectUrl = searchParams.get('redirect')

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError(error.message === 'Invalid login credentials'
                ? 'E-mail ou senha incorretos.'
                : error.message)
            setLoading(false)
            return
        }

        // Se houver um redirecionamento (ex: convite), vai para ele. Senão, vai para dashboard.
        router.push(redirectUrl || '/')
        router.refresh()
    }

    const registerLink = redirectUrl
        ? `/register?redirect=${encodeURIComponent(redirectUrl)}`
        : '/register'

    return (
        <div className="auth-page">
            <div className="auth-container">
                <h1 className="auth-logo">FinançasDuo</h1>
                <p className="auth-subtitle">Finanças do casal sob controle</p>

                <div className="auth-card">
                    <form className="auth-form" onSubmit={handleLogin}>
                        {error && <div className="auth-error">{error}</div>}

                        <div className="input-group">
                            <label className="input-label" htmlFor="email">E-mail</label>
                            <input
                                id="email"
                                className="input"
                                type="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="password">Senha</label>
                            <input
                                id="password"
                                className="input"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
                            style={{ width: '100%', marginTop: '8px' }}>
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        Não tem conta? <Link href={registerLink}>Criar conta</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="auth-page"><div className="auth-container"><h1 className="auth-logo">FinançasDuo</h1><div className="auth-card">Carregando...</div></div></div>}>
            <LoginContent />
        </Suspense>
    )
}
