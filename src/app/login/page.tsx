'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

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

        router.push('/')
        router.refresh()
    }

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
                        Não tem conta? <Link href="/register">Criar conta</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
