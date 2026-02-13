'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction, Category, Account, Card, Tag } from '@/types/database'
import { Plus, Pencil, Trash2, ArrowLeftRight, X, TrendingUp, TrendingDown, CreditCard, Wallet } from 'lucide-react'
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
        installments_count: 2,
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
            notes: '', is_recurring: false, recurrence_type: '', installments_count: 2,
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
            installments_count: 2, // Edit mode logic for installments is complex, defaulting for now
        })
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)

        const basePayload = {
            description: form.description,
            amount: parseFloat(form.amount),
            type: form.type,
            category_id: form.category_id || null,
            account_id: form.account_id || null,
            card_id: form.card_id || null,
            date: form.date,
            notes: form.notes || null,
            is_recurring: form.is_recurring,
            recurrence_type: form.is_recurring ? form.recurrence_type : null,
            household_id: householdId,
            user_id: userId,
        }

        try {
            if (editing) {
                await supabase.from('transactions').update(basePayload).eq('id', editing.id)
            } else {
                if (form.is_recurring && form.recurrence_type === 'installment' && form.installments_count > 1) {
                    // Generate installments
                    const { generateInstallments } = await import('@/lib/transactions')
                    const installments = generateInstallments(
                        {
                            ...basePayload,
                            count: form.installments_count, // Passing count explicitly if needed by updated logic, or inferred? 
                            // Wait, existing generateInstallments signature: (base, count, date)
                            // We need to map basePayload to TransactionBase correctly
                        } as any,
                        form.installments_count,
                        new Date(form.date)
                    )

                    // Fix: generateInstallments expects specific fields. 
                    // We should just use the function directly cleanly.
                    const transactionsToInsert = installments.map(t => ({
                        ...t,
                        date: t.date.toISOString().split('T')[0], // Convert back to string YYYY-MM-DD
                        household_id: householdId,
                        user_id: userId,
                        // Ensure optional fields are handled
                        account_id: form.account_id || null,
                        card_id: form.card_id || null,
                        category_id: form.category_id || null,
                        notes: form.notes || null,
                        type: form.type as any
                    }))

                    await supabase.from('transactions').insert(transactionsToInsert)
                } else {
                    // Standard single insert
                    await supabase.from('transactions').insert(basePayload)
                }
            }

            setSaving(false)
            setShowModal(false)
            loadAll()
        } catch (error) {
            console.error(error)
            alert('Erro ao salvar transação')
            setSaving(false)
        }
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
            <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1 className="title">Transações</h1>
                    <p className="text-muted">Gerencie suas receitas e despesas</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Nova Transação
                </button>
            </header>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)' }}>
                <button
                    className={`btn btn-sm ${filterType === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setFilterType('all')}>
                    Todas
                </button>
                <button
                    className={`btn btn-sm ${filterType === 'income' ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setFilterType('income')}
                    style={{ color: filterType === 'income' ? 'var(--color-success)' : undefined }}>
                    Receitas
                </button>
                <button
                    className={`btn btn-sm ${filterType === 'expense' ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setFilterType('expense')}
                    style={{ color: filterType === 'expense' ? 'var(--color-danger)' : undefined }}>
                    Despesas
                </button>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Descrição</th>
                                <th>Categoria</th>
                                <th>Conta / Cartão</th>
                                <th style={{ textAlign: 'right' }}>Valor</th>
                                <th style={{ width: 100, textAlign: 'center' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTx.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
                                        Nenhuma transação encontrada.
                                    </td>
                                </tr>
                            ) : (
                                filteredTx.map(t => (
                                    <tr key={t.id}>
                                        <td>{formatDate(t.date)}</td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{t.description}</div>
                                            {(t.installments_id || (t.is_recurring && t.recurrence_type === 'installment')) && (
                                                <span className="badge badge-outline" style={{ fontSize: 10, padding: '2px 6px', marginTop: 4 }}>
                                                    Parcelado
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {/* Icon placeholder or check category icon if available */}
                                                <span className="badge badge-secondary">{categories.find(c => c.id === t.category_id)?.name || 'Sem categoria'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            {t.account_id ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                                    <Wallet size={14} className="text-muted" />
                                                    {accounts.find(a => a.id === t.account_id)?.name}
                                                </div>
                                            ) : t.card_id ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                                    <CreditCard size={14} className="text-muted" />
                                                    {cards.find(c => c.id === t.card_id)?.name}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 600, color: t.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                            {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                                                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => openEdit(t)} title="Editar">
                                                    <Pencil size={14} />
                                                </button>
                                                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDelete(t.id)} title="Excluir" style={{ color: 'var(--color-danger)' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>{editing ? 'Editar' : 'Nova'} Transação</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {/* Type Toggle */}
                                <div className="input-group">
                                    <label className="input-label">Tipo de Transação</label>
                                    <div style={{ display: 'flex', gap: 8, background: 'var(--color-bg-secondary)', padding: 4, borderRadius: 'var(--radius-md)' }}>
                                        <button type="button"
                                            className={`btn ${form.type === 'expense' ? 'active' : ''}`}
                                            style={{
                                                flex: 1,
                                                background: form.type === 'expense' ? 'var(--color-danger)' : 'transparent',
                                                color: form.type === 'expense' ? '#fff' : 'var(--color-text-secondary)',
                                                border: 'none',
                                                justifyContent: 'center'
                                            }}
                                            onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}>
                                            <TrendingDown size={16} /> Despesa
                                        </button>
                                        <button type="button"
                                            className={`btn ${form.type === 'income' ? 'active' : ''}`}
                                            style={{
                                                flex: 1,
                                                background: form.type === 'income' ? 'var(--color-success)' : 'transparent',
                                                color: form.type === 'income' ? '#fff' : 'var(--color-text-secondary)',
                                                border: 'none',
                                                justifyContent: 'center'
                                            }}
                                            onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}>
                                            <TrendingUp size={16} /> Receita
                                        </button>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="input-group">
                                    <label className="input-label">Descrição</label>
                                    <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="Ex: Mercado, Salário..." />
                                </div>

                                {/* Amount and Date */}
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

                                {/* Category */}
                                <div className="input-group">
                                    <label className="input-label">Categoria</label>
                                    <select className="input select" value={form.category_id}
                                        onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} required>
                                        <option value="">Selecione uma categoria</option>
                                        {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                {/* Payment Method (Exclusive Selection) */}
                                <div className="input-group">
                                    <label className="input-label">Forma de Pagamento</label>
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                            <input type="radio" name="payment_method"
                                                checked={!!form.account_id}
                                                onChange={() => setForm(f => ({ ...f, account_id: accounts[0]?.id || '', card_id: '' }))}
                                            />
                                            <Wallet size={16} /> Conta
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                            <input type="radio" name="payment_method"
                                                checked={!!form.card_id}
                                                onChange={() => setForm(f => ({ ...f, card_id: cards[0]?.id || '', account_id: '' }))}
                                            />
                                            <CreditCard size={16} /> Cartão de Crédito
                                        </label>
                                    </div>

                                    {!!form.account_id && (
                                        <select className="input select" value={form.account_id}
                                            onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                                            <option value="">Selecione a conta</option>
                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    )}

                                    {!!form.card_id && (
                                        <select className="input select" value={form.card_id}
                                            onChange={e => setForm(f => ({ ...f, card_id: e.target.value }))}>
                                            <option value="">Selecione o cartão</option>
                                            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    )}
                                </div>

                                {/* Recurrence / Installments */}
                                <div className="input-group" style={{ background: 'var(--color-bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: form.is_recurring ? 12 : 0 }}>
                                        <input type="checkbox" checked={form.is_recurring}
                                            onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked, recurrence_type: e.target.checked ? 'fixed' : '' }))} />
                                        <span style={{ fontWeight: 500 }}>Repetir essa transação?</span>
                                    </label>

                                    {form.is_recurring && (
                                        <div className="grid-2">
                                            <div>
                                                <label className="input-label" style={{ fontSize: 12 }}>Frequência</label>
                                                <select className="input select" value={form.recurrence_type}
                                                    onChange={e => setForm(f => ({ ...f, recurrence_type: e.target.value }))}>
                                                    <option value="fixed">Fixo (Mensal)</option>
                                                    <option value="installment">Parcelado</option>
                                                </select>
                                            </div>
                                            {form.recurrence_type === 'installment' && (
                                                <div>
                                                    <label className="input-label" style={{ fontSize: 12 }}>Número de Parcelas</label>
                                                    <input className="input" type="number" min="2" max="120" value={form.installments_count}
                                                        onChange={e => setForm(f => ({ ...f, installments_count: parseInt(e.target.value) || 2 }))} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Notes */}
                                <div className="input-group">
                                    <label className="input-label">Observações</label>
                                    <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner" /> Salvando...</> : editing ? 'Salvar Alterações' : 'Adicionar Transação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
