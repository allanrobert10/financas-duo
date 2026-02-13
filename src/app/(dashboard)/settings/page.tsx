'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { User, Save, Check, Mail, UserPlus, Crown, X, Copy, Users, Lock, Eye, EyeOff, Trash2 } from 'lucide-react'

const PASSWORD_RULES = [
    { key: 'length', label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
    { key: 'upper', label: 'Letra maiúscula (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
    { key: 'lower', label: 'Letra minúscula (a-z)', test: (p: string) => /[a-z]/.test(p) },
    { key: 'number', label: 'Número (0-9)', test: (p: string) => /[0-9]/.test(p) },
    { key: 'special', label: 'Caractere especial (!@#$%...)', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p) },
]

function getStrength(score: number) {
    if (score <= 1) return { label: 'Muito fraca', color: '#EF4444', percent: 20 }
    if (score === 2) return { label: 'Fraca', color: '#F97316', percent: 40 }
    if (score === 3) return { label: 'Média', color: '#F59E0B', percent: 60 }
    if (score === 4) return { label: 'Forte', color: '#10B981', percent: 80 }
    return { label: 'Muito forte', color: '#059669', percent: 100 }
}

interface HouseholdMember {
    id: string
    full_name: string | null
    email: string
    role: string
}

interface Invite {
    id: string
    email: string
    status: string
    created_at: string
}

export default function SettingsPage() {
    const supabase = createClient()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [householdName, setHouseholdName] = useState('')
    const [fullName, setFullName] = useState('')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [members, setMembers] = useState<HouseholdMember[]>([])
    const [invites, setInvites] = useState<Invite[]>([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviting, setInviting] = useState(false)
    const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [copiedToken, setCopiedToken] = useState('')

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPw, setShowCurrentPw] = useState(false)
    const [showNewPw, setShowNewPw] = useState(false)
    const [changingPw, setChangingPw] = useState(false)
    const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const passedRules = useMemo(() =>
        PASSWORD_RULES.map(r => ({ ...r, passed: r.test(newPassword) })),
        [newPassword]
    )
    const pwScore = passedRules.filter(r => r.passed).length
    const pwStrength = getStrength(pwScore)
    const isPwStrong = pwScore >= 4

    useEffect(() => { loadProfile() }, [])

    async function loadProfile() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (p) {
            setProfile(p)
            setFullName(p.full_name || '')
        }
        if (p?.household_id) {
            const { data: h } = await supabase.from('households').select('name').eq('id', p.household_id).single()
            if (h) setHouseholdName(h.name)

            // Load members
            const { data: mems } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .eq('household_id', p.household_id)
            if (mems) setMembers(mems)

            // Load pending invites
            const { data: invs } = await supabase
                .from('household_invites')
                .select('id, email, status, created_at')
                .eq('household_id', p.household_id)
                .eq('status', 'pending')
            if (invs) setInvites(invs)
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (!profile) return
        setSaving(true)

        await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id)

        if (profile.household_id) {
            await supabase.from('households').update({ name: householdName }).eq('id', profile.household_id)
        }

        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    async function handleInvite(e: React.FormEvent) {
        e.preventDefault()
        if (!profile?.household_id || !inviteEmail) return
        setInviting(true)
        setInviteMsg(null)

        // Check if already a member
        const existing = members.find(m => m.email === inviteEmail)
        if (existing) {
            setInviteMsg({ type: 'error', text: 'Este email já faz parte do seu Lar.' })
            setInviting(false)
            return
        }

        const { data, error } = await supabase
            .from('household_invites')
            .insert({
                household_id: profile.household_id,
                email: inviteEmail,
                invited_by: profile.id,
            })
            .select('id, email, status, created_at, token')
            .single()

        setInviting(false)

        if (error) {
            if (error.code === '23505') {
                setInviteMsg({ type: 'error', text: 'Já existe um convite pendente para este email.' })
            } else {
                setInviteMsg({ type: 'error', text: error.message })
            }
            return
        }

        if (data) {
            const inviteUrl = `${window.location.origin}/accept-invite?token=${data.token}`
            setInviteMsg({
                type: 'success',
                text: `Convite criado! Compartilhe este link com ${inviteEmail}:`,
            })
            setCopiedToken(inviteUrl)
            setInviteEmail('')
            loadProfile()
        }
    }

    async function cancelInvite(id: string) {
        await supabase.from('household_invites').delete().eq('id', id)
        loadProfile()
    }

    function copyLink() {
        navigator.clipboard.writeText(copiedToken)
    }

    async function removeMember(memberId: string, memberName: string) {
        if (!confirm(`Tem certeza que deseja remover ${memberName || 'este membro'} do seu Lar? Essa pessoa perderá acesso aos dados compartilhados.`)) return

        const { data, error } = await supabase.rpc('remove_household_member', { member_id: memberId })

        if (error) {
            alert(error.message)
            return
        }

        const result = data as { success: boolean; error?: string }
        if (!result.success) {
            alert(result.error || 'Erro ao remover membro')
            return
        }

        loadProfile()
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault()
        setPwMsg(null)

        if (!isPwStrong) {
            setPwMsg({ type: 'error', text: 'A nova senha precisa atender pelo menos 4 dos 5 critérios.' })
            return
        }
        if (newPassword !== confirmPassword) {
            setPwMsg({ type: 'error', text: 'As senhas não coincidem.' })
            return
        }

        setChangingPw(true)

        // Re-authenticate with current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: profile?.email || '',
            password: currentPassword,
        })
        if (signInError) {
            setPwMsg({ type: 'error', text: 'Senha atual incorreta.' })
            setChangingPw(false)
            return
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword })
        setChangingPw(false)

        if (error) {
            setPwMsg({ type: 'error', text: error.message })
            return
        }

        setPwMsg({ type: 'success', text: 'Senha alterada com sucesso!' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
    }

    const isOwner = profile?.role === 'owner'

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Configurações</h1>
                    <p className="page-subtitle">Gerencie seu perfil e preferências</p>
                </div>
            </div>

            {/* Two-column grid: Profile + Password side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24, alignItems: 'start' }}>

                {/* Profile Section */}
                <div className="glass-card" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700,
                            background: 'linear-gradient(135deg, var(--color-accent), var(--color-gold))',
                            color: '#000',
                        }}>
                            {fullName?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || <User size={24} />}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{fullName || 'Usuário'}</div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{profile?.email}</div>
                        </div>
                    </div>

                    <form onSubmit={handleSave}>
                        <div className="input-group">
                            <label className="input-label">Nome completo</label>
                            <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Nome do Lar</label>
                            <input className="input" value={householdName} onChange={e => setHouseholdName(e.target.value)}
                                placeholder="Ex: Nosso Lar" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">E-mail</label>
                            <input className="input" value={profile?.email || ''} disabled style={{ opacity: 0.6 }} />
                        </div>

                        <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>
                            {saved ? <><Check size={16} /> Salvo!</> : saving ? 'Salvando...' : <><Save size={16} /> Salvar Alterações</>}
                        </button>
                    </form>
                </div>

                {/* Change Password Section */}
                <div className="glass-card" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Lock size={20} style={{ color: 'var(--color-accent)' }} />
                        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Alterar Senha</h2>
                    </div>

                    <form onSubmit={handleChangePassword}>
                        <div className="input-group">
                            <label className="input-label">Senha atual</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="input"
                                    type={showCurrentPw ? 'text' : 'password'}
                                    placeholder="Digite sua senha atual"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    required
                                    style={{ paddingRight: 44 }}
                                />
                                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                                    style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', color: 'var(--color-text-muted)',
                                        cursor: 'pointer', padding: 4, display: 'flex',
                                    }}>
                                    {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Nova senha</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="input"
                                    type={showNewPw ? 'text' : 'password'}
                                    placeholder="Crie uma senha forte"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    style={{ paddingRight: 44 }}
                                />
                                <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                                    style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', color: 'var(--color-text-muted)',
                                        cursor: 'pointer', padding: 4, display: 'flex',
                                    }}>
                                    {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {newPassword.length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Força da senha</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: pwStrength.color }}>{pwStrength.label}</span>
                                    </div>
                                    <div className="progress-bar" style={{ height: 6 }}>
                                        <div className="progress-bar-fill" style={{ width: `${pwStrength.percent}%`, background: pwStrength.color }} />
                                    </div>
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

                        <div className="input-group">
                            <label className="input-label">Confirmar nova senha</label>
                            <input
                                className="input"
                                type="password"
                                placeholder="Repita a nova senha"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                            />
                            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                                <span style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>As senhas não coincidem</span>
                            )}
                        </div>

                        {pwMsg && (
                            <div style={{
                                marginBottom: 12, padding: 10, borderRadius: 'var(--radius-md)', fontSize: 13,
                                background: pwMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: pwMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                                border: `1px solid ${pwMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            }}>
                                {pwMsg.text}
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={changingPw || !isPwStrong || newPassword !== confirmPassword}
                            style={{ marginTop: 8 }}
                        >
                            {changingPw ? 'Alterando...' : <><Lock size={16} /> Alterar Senha</>}
                        </button>
                    </form>
                </div>

            </div>{/* end grid */}

            {/* Household Members Section */}
            <div className="glass-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Users size={20} style={{ color: 'var(--color-accent)' }} />
                    <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Membros do Lar</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    {members.map(m => (
                        <div key={m.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                            borderRadius: 'var(--radius-md)', background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600,
                                background: m.role === 'owner'
                                    ? 'linear-gradient(135deg, var(--color-gold), #D97706)'
                                    : 'linear-gradient(135deg, var(--color-accent), #0891B2)',
                                color: '#000',
                            }}>
                                {m.full_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '?'}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                                    {m.full_name || 'Sem nome'}
                                    {m.id === profile?.id && (
                                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 6 }}>(você)</span>
                                    )}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{m.email}</div>
                            </div>
                            <span className="badge" style={{
                                background: m.role === 'owner' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                                color: m.role === 'owner' ? 'var(--color-gold)' : 'var(--color-accent)',
                            }}>
                                {m.role === 'owner' ? <><Crown size={12} /> Dono</> : 'Membro'}
                            </span>
                            {isOwner && m.id !== profile?.id && (
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => removeMember(m.id, m.full_name || '')}
                                    style={{ color: 'var(--color-danger)', padding: 4, marginLeft: 4 }}
                                    title="Remover membro"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Pending Invites */}
                {invites.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 10, color: 'var(--color-text-muted)' }}>
                            Convites pendentes
                        </h3>
                        {invites.map(inv => (
                            <div key={inv.id} style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                                borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.05)',
                                border: '1px dashed rgba(245, 158, 11, 0.3)', marginBottom: 6,
                            }}>
                                <Mail size={14} style={{ color: 'var(--color-gold)' }} />
                                <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{inv.email}</span>
                                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-gold)', fontSize: 10 }}>
                                    Pendente
                                </span>
                                {isOwner && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => cancelInvite(inv.id)}
                                        style={{ color: 'var(--color-danger)', padding: 2 }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Invite Form */}
                {isOwner && (
                    <form onSubmit={handleInvite} style={{
                        padding: 16, borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <UserPlus size={16} style={{ color: 'var(--color-accent)' }} />
                            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Convidar Parceiro(a)</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                className="input"
                                type="email"
                                placeholder="email@do-parceiro.com"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                required
                                style={{ flex: 1 }}
                            />
                            <button className="btn btn-primary" type="submit" disabled={inviting}>
                                {inviting ? '...' : 'Convidar'}
                            </button>
                        </div>

                        {inviteMsg && (
                            <div style={{
                                marginTop: 10, padding: 10, borderRadius: 'var(--radius-md)', fontSize: 13,
                                background: inviteMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: inviteMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                                border: `1px solid ${inviteMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            }}>
                                {inviteMsg.text}
                                {copiedToken && inviteMsg.type === 'success' && (
                                    <div style={{
                                        marginTop: 8, padding: 8, borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8,
                                        wordBreak: 'break-all', fontSize: 11,
                                    }}>
                                        <span style={{ flex: 1, fontFamily: 'monospace' }}>{copiedToken}</span>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div>
    )
}
