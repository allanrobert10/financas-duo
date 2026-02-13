'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { getAppUrl } from '@/lib/url'

const PASSWORD_RULES = [
    { key: 'length', label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
    { key: 'upper', label: 'Letra maiúscula (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
    { key: 'lower', label: 'Letra minúscula (a-z)', test: (p: string) => /[a-z]/.test(p) },
    { key: 'number', label: 'Número (0-9)', test: (p: string) => /[0-9]/.test(p) },
    { key: 'special', label: 'Caractere especial (!@#$%...)', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p) },
]

function getStrength(score: number): { label: string; color: string; percent: number } {
    if (score <= 1) return { label: 'Muito fraca', color: '#EF4444', percent: 20 }
    if (score === 2) return { label: 'Fraca', color: '#F97316', percent: 40 }
    if (score === 3) return { label: 'Média', color: '#F59E0B', percent: 60 }
    if (score === 4) return { label: 'Forte', color: '#10B981', percent: 80 }
    return { label: 'Muito forte', color: '#059669', percent: 100 }
}

function RegisterContent() {
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // Captura o redirecionamento (convite)
    const redirectUrl = searchParams.get('redirect')

    const passedRules = useMemo(() =>
        PASSWORD_RULES.map(r => ({ ...r, passed: r.test(password) })),
        [password]
    )
    const score = passedRules.filter(r => r.passed).length
    const strength = getStrength(score)
    const isStrong = score >= 4

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (!isStrong) {
            setError('A senha precisa atender pelo menos 4 dos 5 critérios.')
            return
        }

        setLoading(true)

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
                emailRedirectTo: `${getAppUrl()}/auth/callback`,
            },
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        // Se houver um redirecionamento (ex: convite), vai para ele.
        router.push(redirectUrl || '/')
        router.refresh()
    }

    const loginLink = redirectUrl
        ? `/login?redirect=${encodeURIComponent(redirectUrl)}`
        : '/login'

    return (
        <div className="auth-page">
            <div className="auth-container">
                <h1 className="auth-logo">FinançasDuo</h1>
                <p className="auth-subtitle">Crie sua conta e comece a organizar</p>

                <div className="auth-card">
                    <form className="auth-form" onSubmit={handleRegister}>
                        {error && <div className="auth-error">{error}</div>}

                        <div className="input-group">
                            <label className="input-label" htmlFor="fullName">Nome completo</label>
                            <input
                                id="fullName"
                                className="input"
                                type="text"
                                placeholder="Seu nome"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>

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
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="password"
                                    className="input"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Crie uma senha forte"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ paddingRight: 44 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', color: 'var(--color-text-muted)',
                                        cursor: 'pointer', padding: 4, display: 'flex',
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {/* Strength bar */}
                            {password.length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Força da senha</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: strength.color }}>{strength.label}</span>
                                    </div>
                                    <div className="progress-bar" style={{ height: 6 }}>
                                        <div
                                            className="progress-bar-fill"
                                            style={{
                                                width: `${strength.percent}%`,
                                                background: strength.color,
                                            }}
                                        />
                                    </div>

                                    {/* Criteria checklist */}
                                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {passedRules.map(r => (
                                            <div key={r.key} style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                fontSize: 12, color: r.passed ? 'var(--color-success)' : 'var(--color-text-muted)',
                                            }}>
                                                {r.passed
                                                    ? <Check size={14} style={{ color: 'var(--color-success)' }} />
                                                    : <X size={14} style={{ opacity: 0.4 }} />}
                                                {r.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            className="btn btn-primary btn-lg"
                            type="submit"
                            disabled={loading || !isStrong}
                            style={{ width: '100%', marginTop: '8px' }}
                        >
                            {loading ? 'Criando conta...' : 'Criar conta'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        Já tem conta? <Link href={loginLink}>Fazer login</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="auth-page"><div className="auth-container"><h1 className="auth-logo">FinançasDuo</h1><div className="auth-card">Carregando...</div></div></div>}>
            <RegisterContent />
        </Suspense>
    )
}
