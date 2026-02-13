'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Account } from '@/types/database'
import { Plus, Pencil, Trash2, Wallet, X, Building2, PiggyBank, TrendingUp } from 'lucide-react'
import { SkeletonCards } from '@/components/Skeleton'

const ACCOUNT_TYPES = [
    { value: 'checking', label: 'Conta Corrente', icon: Building2 },
    { value: 'savings', label: 'Poupança', icon: PiggyBank },
    { value: 'wallet', label: 'Carteira', icon: Wallet },
    { value: 'investment', label: 'Investimento', icon: TrendingUp },
]

const ACC_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#6366F1', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6']

export default function AccountsPage() {
    const supabase = createClient()
    const [accounts, setAccounts] = useState<Account[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Account | null>(null)
    const [householdId, setHouseholdId] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ name: '', type: 'checking', balance: '', color: '#10B981' })

    useEffect(() => { loadAccounts() }, [])

    async function loadAccounts() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
        if (profile?.household_id) setHouseholdId(profile.household_id)
        const { data } = await supabase.from('accounts').select('*').order('name')
        if (data) setAccounts(data)
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        setForm({ name: '', type: 'checking', balance: '', color: '#10B981' })
        setShowModal(true)
    }

    function openEdit(acc: Account) {
        setEditing(acc)
        setForm({ name: acc.name, type: acc.type, balance: String(acc.balance || 0), color: acc.color || '#10B981' })
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const payload = { name: form.name, type: form.type, balance: parseFloat(form.balance || '0'), color: form.color, household_id: householdId }

        if (editing) {
            await supabase.from('accounts').update(payload).eq('id', editing.id)
        } else {
            await supabase.from('accounts').insert(payload)
        }
        setSaving(false)
        setShowModal(false)
        loadAccounts()
    }

    async function handleDelete(id: string) {
        if (!confirm('Excluir esta conta?')) return
        await supabase.from('accounts').delete().eq('id', id)
        loadAccounts()
    }

    const totalBalance = accounts.filter(a => a.is_active).reduce((s, a) => s + (a.balance || 0), 0)

    if (loading) {
        return (
            <div className="fade-in">
                <div style={{ marginBottom: 'var(--space-8)' }}>
                    <div className="skeleton skeleton-heading" style={{ width: '20%' }} />
                    <div className="skeleton skeleton-text sm" style={{ width: '25%' }} />
                </div>
                <SkeletonCards count={4} />
            </div>
        )
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Contas</h1>
                    <p className="page-subtitle">Saldo total: {formatCurrency(totalBalance)}</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Nova Conta</button>
            </div>

            {accounts.length > 0 ? (
                <div className="stagger-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {accounts.map(acc => {
                        const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type)
                        const Icon = typeInfo?.icon || Wallet
                        return (
                            <div key={acc.id} className="glass-card card-hover-lift stagger-item" style={{ borderLeft: `3px solid ${acc.color || '#10B981'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', background: (acc.color || '#10B981') + '20',
                                        }}>
                                            <Icon size={20} style={{ color: acc.color || '#10B981' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{acc.name}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{typeInfo?.label}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => openEdit(acc)}><Pencil size={14} /></button>
                                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDelete(acc.id)}
                                            style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div style={{
                                    fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700,
                                    color: (acc.balance || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                                }}>
                                    {formatCurrency(acc.balance || 0)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="glass-card empty-state">
                    <Wallet />
                    <h3>Nenhuma conta cadastrada</h3>
                    <p>Adicione contas bancárias, carteiras e investimentos</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h2>{editing ? 'Editar' : 'Nova'} Conta</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Nome</label>
                                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Nubank" />
                                </div>
                                <div className="grid-2">
                                    <div className="input-group">
                                        <label className="input-label">Tipo</label>
                                        <select className="input select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                            {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Saldo Inicial (R$)</label>
                                        <input className="input" type="number" step="0.01" value={form.balance}
                                            onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0,00" />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Cor</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {ACC_COLORS.map(c => (
                                            <button key={c} type="button"
                                                style={{
                                                    width: 32, height: 32, borderRadius: '50%', background: c,
                                                    border: form.color === c ? '3px solid #fff' : '2px solid transparent',
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                }}
                                                onClick={() => setForm(f => ({ ...f, color: c }))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner" /> Salvando...</> : editing ? 'Salvar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
