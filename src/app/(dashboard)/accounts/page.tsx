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
        setForm({
            name: acc.name,
            type: acc.type,
            balance: (acc.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            color: acc.color || '#10B981'
        })
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const balanceValue = typeof form.balance === 'string'
            ? parseFloat(form.balance.replace(/\./g, '').replace(',', '.'))
            : form.balance
        const payload = { name: form.name, type: form.type, balance: balanceValue || 0, color: form.color, household_id: householdId }

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
            <div className="page-header-pro">
                <div className="title-group">
                    <h1>Contas</h1>
                    <p>Saldo total consolidado: <strong style={{ color: 'var(--color-accent)' }}>{formatCurrency(totalBalance)}</strong></p>
                </div>
                <button className="btn-nova-tx" onClick={openCreate}><Plus size={20} /> Nova Conta</button>
            </div>

            {accounts.length > 0 ? (
                <div className="stagger-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                    {accounts.map(acc => {
                        const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type)
                        const Icon = typeInfo?.icon || Wallet
                        return (
                            <div key={acc.id} className="budget-card card-hover-lift stagger-item" style={{ borderLeft: `4px solid ${acc.color || '#10B981'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', background: (acc.color || '#10B981') + '15',
                                            border: `1px solid ${(acc.color || '#10B981') + '30'}`
                                        }}>
                                            <Icon size={22} style={{ color: acc.color || '#10B981' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 16 }}>{acc.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{typeInfo?.label}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => openEdit(acc)} style={{ borderRadius: 8 }}><Pencil size={15} /></button>
                                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDelete(acc.id)}
                                            style={{ color: 'var(--color-danger)', borderRadius: 8 }}><Trash2 size={15} /></button>
                                    </div>
                                </div>

                                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4 }}>Saldo Atual</div>
                                <div style={{
                                    fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800,
                                    color: (acc.balance || 0) >= 0 ? 'var(--color-text-primary)' : 'var(--color-danger)'
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
                    <div className="modal-content-pro" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440 }}>
                        <div className="modal-header-pro">
                            <h2>{editing ? 'Editar' : 'Nova'} Conta</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body-pro">
                                <div className="input-group">
                                    <label className="input-label">Nome da Conta</label>
                                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Nubank, Carteira..." />
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
                                        <input
                                            className="input"
                                            value={form.balance}
                                            onChange={(e) => {
                                                let value = e.target.value.replace(/\D/g, "")
                                                const balance = (Number(value) / 100).toLocaleString("pt-BR", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
                                                setForm((f) => ({ ...f, balance }))
                                            }}
                                            placeholder="0,00"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Cor de Identificação</label>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                        {ACC_COLORS.map(c => (
                                            <button key={c} type="button"
                                                style={{
                                                    width: 36, height: 36, borderRadius: 12, background: c,
                                                    border: form.color === c ? '3px solid #fff' : '2px solid transparent',
                                                    boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none',
                                                    cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                                    transform: form.color === c ? 'scale(1.1)' : 'scale(1)',
                                                }}
                                                onClick={() => setForm(f => ({ ...f, color: c }))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer-pro">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ borderRadius: 10 }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: 'var(--color-accent)', border: 'none', borderRadius: 10, padding: '0 24px' }}>
                                    {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar Conta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
