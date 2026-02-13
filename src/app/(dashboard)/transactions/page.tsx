'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction, Category, Account, Card, Tag } from '@/types/database'
import { Plus, Pencil, Trash2, ArrowLeftRight, X, TrendingUp, TrendingDown, CreditCard } from 'lucide-react'
import { SkeletonTable } from '@/components/Skeleton'

export default function TransactionsPage() {
    const supabase = createClient()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [cards, setCards] = useState<Card[]>([])
    const [tags, setTags] = useState<Tag[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Transaction | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [householdId, setHouseholdId] = useState('')
    const [userId, setUserId] = useState('')
    const [filterType, setFilterType] = useState<string>('all')

    const [form, setForm] = useState({
        description: '', amount: '', type: 'expense' as string,
        category_id: '', account_id: '', card_id: '', date: new Date().toISOString().split('T')[0],
        notes: '', is_recurring: false, recurrence_type: '' as string,
    })

    useEffect(() => { loadAll() }, [])

    async function loadAll() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
        if (profile?.household_id) setHouseholdId(profile.household_id)

        const [txR, catR, accR, cardR, tagR] = await Promise.all([
            supabase.from('transactions').select('*').order('date', { ascending: false }),
            supabase.from('categories').select('*'),
            supabase.from('accounts').select('*').eq('is_active', true),
            supabase.from('cards').select('*').eq('is_active', true),
            supabase.from('tags').select('*'),
        ])

        if (txR.data) setTransactions(txR.data)
        if (catR.data) setCategories(catR.data)
        if (accR.data) setAccounts(accR.data)
        if (cardR.data) setCards(cardR.data)
        if (tagR.data) setTags(tagR.data)
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        setForm({
            description: '', amount: '', type: 'expense', category_id: '',
            account_id: '', card_id: '', date: new Date().toISOString().split('T')[0],
            notes: '', is_recurring: false, recurrence_type: '',
        })
        setShowModal(true)
    }

    function openEdit(tx: Transaction) {
        setEditing(tx)
        setForm({
            description: tx.description, amount: String(tx.amount), type: tx.type,
            category_id: tx.category_id || '', account_id: tx.account_id || '',
            card_id: tx.card_id || '', date: tx.date, notes: tx.notes || '',
            is_recurring: tx.is_recurring || false, recurrence_type: tx.recurrence_type || '',
        })
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const payload = {
            description: form.description, amount: parseFloat(form.amount),
            type: form.type, category_id: form.category_id || null,
            account_id: form.account_id || null, card_id: form.card_id || null,
            date: form.date, notes: form.notes || null,
            is_recurring: form.is_recurring, recurrence_type: form.is_recurring ? form.recurrence_type : null,
            household_id: householdId, user_id: userId,
        }

        if (editing) {
            await supabase.from('transactions').update(payload).eq('id', editing.id)
        } else {
            await supabase.from('transactions').insert(payload)
        }

        setSaving(false)
        setShowModal(false)
        loadAll()
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir esta transação?')) return
        await supabase.from('transactions').delete().eq('id', id)
        loadAll()
    }

    const filteredTx = filterType === 'all' ? transactions : transactions.filter(t => t.type === filterType)
    const filteredCategories = categories.filter(c =>
        form.type === 'income' ? c.type === 'income' : c.type === 'expense'
    )

    if (loading) {
        return (
            <div className="fade-in">
                <div style={{ marginBottom: 'var(--space-8)' }}>
                    <div className="skeleton skeleton-heading" style={{ width: '25%' }} />
                    <div className="skeleton skeleton-text sm" style={{ width: '18%' }} />
                </div>
                <SkeletonTable rows={8} />
            </div>
        )
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Transações</h1>
                    <p className="page-subtitle">{transactions.length} transações registradas</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <select className="input select" style={{ width: 'auto' }} value={filterType}
                        onChange={e => setFilterType(e.target.value)}>
                        <option value="all">Todos</option>
                        <option value="income">Receitas</option>
                        <option value="expense">Despesas</option>
                    </select>
                    <button className="btn btn-primary" onClick={openCreate}>
                        <Plus size={16} /> Nova Transação
                    </button>
                </div>
            </div>

            {filteredTx.length > 0 ? (
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Descrição</th>
                                <th>Categoria</th>
                                <th>Conta/Cartão</th>
                                <th>Tipo</th>
                                <th style={{ textAlign: 'right' }}>Valor</th>
                                <th style={{ width: 80 }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTx.map(tx => {
                                const cat = categories.find(c => c.id === tx.category_id)
                                const acc = accounts.find(a => a.id === tx.account_id)
                                const card = cards.find(c => c.id === tx.card_id)
                                return (
                                    <tr key={tx.id}>
                                        <td>{formatDate(tx.date)}</td>
                                        <td style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{tx.description}</td>
                                        <td>
                                            {cat && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className="color-dot" style={{ background: cat.color || '#64748B' }} />
                                                    {cat.name}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {card ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <CreditCard size={14} style={{ opacity: 0.6 }} />
                                                    {card.name}
                                                </span>
                                            ) : acc ? acc.name : '—'}
                                        </td>
                                        <td><span className={`badge badge-${tx.type}`}>
                                            {tx.type === 'income' ? 'Receita' : tx.type === 'expense' ? 'Despesa' : 'Transf.'}
                                        </span></td>
                                        <td style={{
                                            textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-display)',
                                            color: tx.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                                        }}>
                                            {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-icon btn-ghost" onClick={() => openEdit(tx)}><Pencil size={14} /></button>
                                                <button className="btn btn-icon btn-ghost" onClick={() => handleDelete(tx.id)}
                                                    style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="glass-card empty-state">
                    <ArrowLeftRight />
                    <h3>Nenhuma transação encontrada</h3>
                    <p>Clique em &quot;Nova Transação&quot; para começar</p>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Editar' : 'Nova'} Transação</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Tipo</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {['expense', 'income'].map(t => (
                                            <button key={t} type="button"
                                                className={`btn ${form.type === t ? 'btn-primary' : 'btn-secondary'}`}
                                                style={{ flex: 1 }}
                                                onClick={() => setForm(f => ({ ...f, type: t, category_id: '' }))}>
                                                {t === 'income' ? <><TrendingUp size={14} /> Receita</> : <><TrendingDown size={14} /> Despesa</>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Descrição</label>
                                    <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
                                </div>
                                <div className="grid-2">
                                    <div className="input-group">
                                        <label className="input-label">Valor (R$)</label>
                                        <input className="input" type="number" step="0.01" min="0.01" value={form.amount}
                                            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Data</label>
                                        <input className="input" type="date" value={form.date}
                                            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Categoria</label>
                                    <select className="input select" value={form.category_id}
                                        onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                                        <option value="">Sem categoria</option>
                                        {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid-2">
                                    <div className="input-group">
                                        <label className="input-label">Conta</label>
                                        <select className="input select" value={form.account_id}
                                            onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                                            <option value="">Nenhuma</option>
                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Cartão</label>
                                        <select className="input select" value={form.card_id}
                                            onChange={e => setForm(f => ({ ...f, card_id: e.target.value }))}>
                                            <option value="">Nenhum</option>
                                            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Observações</label>
                                    <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner" /> Salvando...</> : editing ? 'Salvar' : 'Adicionar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
