'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, X, Loader2 } from 'lucide-react'

function AcceptInviteContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const supabase = createClient()
    const token = searchParams.get('token')

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (!token) {
            setStatus('error')
            setMessage('Token de convite não encontrado.')
            return
        }
        acceptInvite(token)
    }, [token])

    async function acceptInvite(inviteToken: string) {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            // Redireciona para login com callback
            router.push(`/login?redirect=/accept-invite?token=${inviteToken}`)
            return
        }

        const { data, error } = await supabase.rpc('accept_invite', { invite_token: inviteToken })

        if (error) {
            setStatus('error')
            setMessage(error.message)
            return
        }

        const result = data as { success: boolean; error?: string }
        if (result.success) {
            setStatus('success')
            setMessage('Convite aceito! Agora vocês compartilham a mesma conta.')
        } else {
            setStatus('error')
            setMessage(result.error || 'Erro ao aceitar convite.')
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                <h1 className="auth-logo">FinançasDuo</h1>

                <div className="auth-card" style={{ textAlign: 'center', padding: 40 }}>
                    {status === 'loading' && (
                        <>
                            <Loader2 size={48} style={{ color: 'var(--color-accent)', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Processando convite...</p>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Aguarde enquanto vinculamos sua conta</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div style={{
                                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                                background: 'rgba(16, 185, 129, 0.15)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Check size={32} style={{ color: 'var(--color-success)' }} />
                            </div>
                            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 8 }}>Bem-vindo(a) ao Lar! 🏠</p>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 24 }}>{message}</p>
                            <button className="btn btn-primary btn-lg" onClick={() => router.push('/')} style={{ width: '100%' }}>
                                Ir para o Dashboard
                            </button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div style={{
                                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                                background: 'rgba(239, 68, 68, 0.15)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <X size={32} style={{ color: 'var(--color-danger)' }} />
                            </div>
                            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 8 }}>Ops!</p>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 24 }}>{message}</p>
                            <button className="btn btn-primary btn-lg" onClick={() => router.push('/login')} style={{ width: '100%' }}>
                                Ir para Login
                            </button>
                        </>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

export default function AcceptInvitePage() {
    return (
        <Suspense fallback={
            <div className="auth-page">
                <div className="auth-container">
                    <h1 className="auth-logo">FinançasDuo</h1>
                    <div className="auth-card" style={{ textAlign: 'center', padding: 40 }}>
                        <p>Carregando...</p>
                    </div>
                </div>
            </div>
        }>
            <AcceptInviteContent />
        </Suspense>
    )
}
