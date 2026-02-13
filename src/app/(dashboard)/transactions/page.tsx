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
            description: tx.description, amount: tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), type: tx.type,
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
            amount: parseFloat(form.amount.replace(/\./g, '').replace(',', '.')),
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
            <header className="page-header-pro">
                <div className="title-group">
                    <h1>Transações</h1>
                    <p>Gerencie suas receitas e despesas com precisão</p>
                </div>
                <button className="btn-nova-tx" onClick={openCreate}>
                    <Plus size={20} /> Nova Transação
                </button>
            </header>

            {/* Filters */}
            <div className="filter-bar">
                <button
                    className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterType('all')}>
                    Todas
                </button>
                <button
                    className={`filter-btn ${filterType === 'income' ? 'active income' : ''}`}
                    onClick={() => setFilterType('income')}>
                    <TrendingUp size={16} /> Receitas
                </button>
                <button
                    className={`filter-btn ${filterType === 'expense' ? 'active expense' : ''}`}
                    onClick={() => setFilterType('expense')}>
                    <TrendingDown size={16} /> Despesas
                </button>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead className="pro-table-header">
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
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--color-text-tertiary)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
                                            <div style={{ padding: 'var(--space-4)', background: 'var(--color-bg-tertiary)', borderRadius: '50%' }}>
                                                <TrendingUp size={24} style={{ opacity: 0.5 }} />
                                            </div>
                                            <p>Nenhuma transação encontrada.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTx.map((t, index) => (
                                    <tr key={t.id} style={{
                                        transition: 'background-color 0.2s',
                                        backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--color-bg-tertiary)' // subtle striping
                                    }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-card-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : 'var(--color-bg-tertiary)'}
                                    >
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                                            {formatDate(t.date)}
                                        </td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{t.description}</div>
                                            {(t.installment_id || (t.is_recurring && t.recurrence_type === 'installment')) && (
                                                <span style={{
                                                    fontSize: 10,
                                                    padding: '2px 8px',
                                                    marginTop: 4,
                                                    borderRadius: 'var(--radius-full)',
                                                    background: 'var(--color-bg-tertiary)',
                                                    border: '1px solid var(--color-border)',
                                                    color: 'var(--color-text-secondary)',
                                                    display: 'inline-block'
                                                }}>
                                                    Parcelado
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '4px 10px',
                                                borderRadius: 'var(--radius-md)',
                                                background: 'var(--color-bg-tertiary)',
                                                fontSize: 'var(--text-xs)',
                                                fontWeight: 500,
                                                color: 'var(--color-text-secondary)'
                                            }}>
                                                {categories.find(c => c.id === t.category_id)?.name || 'Sem categoria'}
                                            </span>
                                        </td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                            {t.account_id ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                                    <div style={{ padding: 6, background: 'var(--color-bg-tertiary)', borderRadius: '50%' }}>
                                                        <Wallet size={14} />
                                                    </div>
                                                    {accounts.find(a => a.id === t.account_id)?.name}
                                                </div>
                                            ) : t.card_id ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                                    <div style={{ padding: 6, background: 'var(--color-bg-tertiary)', borderRadius: '50%' }}>
                                                        <CreditCard size={14} />
                                                    </div>
                                                    {cards.find(c => c.id === t.card_id)?.name}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>
                                            <div style={{
                                                fontWeight: 600,
                                                color: t.type === 'income' ? 'var(--color-success)' : 'var(--color-text-primary)',
                                                fontFamily: 'var(--font-mono)' // Use monospaced font if available or fallback
                                            }}>
                                                {t.type === 'expense' ? '- ' : '+ '}{formatCurrency(t.amount)}
                                            </div>
                                        </td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => openEdit(t)}
                                                    title="Editar"
                                                    style={{ color: 'var(--color-text-secondary)', cursor: 'pointer', background: 'transparent', border: 'none' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleDelete(t.id)}
                                                    title="Excluir"
                                                    style={{ color: 'var(--color-text-secondary)', cursor: 'pointer', background: 'transparent', border: 'none' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                                                >
                                                    <Trash2 size={16} />
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
                    <div className="modal-content-pro" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500 }}>
                        <div className="modal-header-pro">
                            <h2>{editing ? 'Editar' : 'Nova'} Transação</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body-pro">
                                {/* Type Toggle */}
                                <div className="input-group">
                                    <label className="input-label">Tipo de Transação</label>
                                    <div className="type-toggle-pro">
                                        <button type="button"
                                            className={`type-btn-pro ${form.type === 'expense' ? 'active expense' : ''}`}
                                            onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}>
                                            <TrendingDown size={18} /> Despesa
                                        </button>
                                        <button type="button"
                                            className={`type-btn-pro ${form.type === 'income' ? 'active income' : ''}`}
                                            onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}>
                                            <TrendingUp size={18} /> Receita
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
                                        <input
                                            className="input"
                                            value={form.amount}
                                            onChange={(e) => {
                                                let value = e.target.value.replace(/\D/g, "")
                                                const amount = (Number(value) / 100).toLocaleString("pt-BR", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
                                                setForm((f) => ({ ...f, amount }))
                                            }}
                                            placeholder="0,00"
                                            required
                                        />
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

                                {/* Payment Method (Visual Cards) */}
                                <div className="input-group">
                                    <label className="input-label" style={{ marginBottom: 12 }}>Forma de Pagamento</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div
                                            className={`payment-method-card ${form.account_id ? 'active' : ''}`}
                                            onClick={() => setForm(f => ({ ...f, account_id: accounts[0]?.id || '', card_id: '' }))}
                                        >
                                            <div style={{ background: form.account_id ? 'var(--color-accent)' : 'var(--color-bg-secondary)', padding: 8, borderRadius: 8, color: form.account_id ? 'white' : 'inherit' }}>
                                                <Wallet size={18} />
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>Conta</span>
                                        </div>
                                        <div
                                            className={`payment-method-card ${form.card_id ? 'active' : ''}`}
                                            onClick={() => setForm(f => ({ ...f, card_id: cards[0]?.id || '', account_id: '' }))}
                                        >
                                            <div style={{ background: form.card_id ? 'var(--color-accent)' : 'var(--color-bg-secondary)', padding: 8, borderRadius: 8, color: form.card_id ? 'white' : 'inherit' }}>
                                                <CreditCard size={18} />
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>Cartão</span>
                                        </div>
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
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, border: '1px solid var(--color-border)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: form.is_recurring ? 16 : 0 }}>
                                        <input type="checkbox" checked={form.is_recurring}
                                            onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked, recurrence_type: e.target.checked ? 'fixed' : '' }))}
                                            style={{ width: 18, height: 18, borderRadius: 4, cursor: 'pointer' }}
                                        />
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>Transação recorrente ou parcelada?</span>
                                    </label>

                                    {form.is_recurring && (
                                        <div className="grid-2" style={{ animation: 'fade-in 0.3s' }}>
                                            <div>
                                                <label className="input-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Frequência</label>
                                                <select className="input select" value={form.recurrence_type}
                                                    onChange={e => setForm(f => ({ ...f, recurrence_type: e.target.value }))}>
                                                    <option value="fixed">Fixo (Mensal)</option>
                                                    <option value="installment">Parcelado</option>
                                                </select>
                                            </div>
                                            {form.recurrence_type === 'installment' && (
                                                <div>
                                                    <label className="input-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Número de Parcelas</label>
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
                            <div className="modal-footer-pro">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ borderRadius: 10 }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: 'var(--color-accent)', border: 'none', borderRadius: 10, padding: '0 24px' }}>
                                    {saving ? <><span className="spinner" /> Salvando...</> : editing ? 'Salvar Alterações' : 'Confirmar Transação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
