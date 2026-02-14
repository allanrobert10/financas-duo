'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    formatCurrency,
    formatDate,
    getMonthName,
    getTodayDateInputValue,
    parseDateInputValue,
    toDateInputValue,
} from '@/lib/utils'
import type { Transaction, Category, Account, Card, Tag } from '@/types/database'
import { Plus, Pencil, Trash2, ArrowLeftRight, X, TrendingUp, TrendingDown, CreditCard, Wallet, ChevronDown, Check, ChevronLeft, ChevronRight, Calendar, Search } from 'lucide-react'
import { SkeletonTable } from '@/components/Skeleton'

export default function TransactionsPage() {
    const supabase = createClient()
    const searchParams = useSearchParams()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [cards, setCards] = useState<Card[]>([])
    const [tags, setTags] = useState<Tag[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Transaction | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showTagsDropdown, setShowTagsDropdown] = useState(false)
    const tagsRef = useRef<HTMLDivElement>(null)
    const [viewMode, setViewMode] = useState<'list' | 'invoices' | 'third-party'>(() => {
        const fromUrl = searchParams.get('view')
        if (fromUrl === 'list' || fromUrl === 'invoices' || fromUrl === 'third-party') return fromUrl
        return searchParams.get('focus') === 'third-party' ? 'third-party' : 'list'
    })
    const isThirdPartyOnly = viewMode === 'third-party'
    const [selectedCardId, setSelectedCardId] = useState<string>('')
    const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1)
    const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear())
    const [householdId, setHouseholdId] = useState('')
    const [userId, setUserId] = useState('')
    const [filterType, setFilterType] = useState<string>('all')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isBulkDeleting, setIsBulkDeleting] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [thirdPartySearchTerm, setThirdPartySearchTerm] = useState('')
    const [thirdPartyMonth, setThirdPartyMonth] = useState(() => {
        const fromUrl = Number(searchParams.get('month'))
        if (Number.isInteger(fromUrl) && fromUrl >= 1 && fromUrl <= 12) return fromUrl
        return new Date().getMonth() + 1
    })
    const [thirdPartyYear, setThirdPartyYear] = useState(() => {
        const fromUrl = Number(searchParams.get('year'))
        if (Number.isInteger(fromUrl) && fromUrl >= 2000 && fromUrl <= 3000) return fromUrl
        return new Date().getFullYear()
    })
    const [markingThirdPartyId, setMarkingThirdPartyId] = useState<string | null>(null)
    const [thirdPartyFilter, setThirdPartyFilter] = useState<'all' | 'pending' | 'paid'>(() => {
        const fromUrl = searchParams.get('thirdParty')
        if (fromUrl === 'pending' || fromUrl === 'paid' || fromUrl === 'all') return fromUrl
        return 'all'
    })

    const [form, setForm] = useState({
        description: '', amount: '', type: 'expense' as string,
        category_id: '', account_id: '', card_id: '', date: getTodayDateInputValue(),
        notes: '', is_recurring: false, recurrence_type: '' as string,
        installments_count: 2,
        is_third_party: false,
        third_party_name: '',
        tag_ids: [] as string[],
    })

    useEffect(() => { loadAll() }, [])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (tagsRef.current && !tagsRef.current.contains(event.target as Node)) {
                setShowTagsDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    async function loadAll() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
        if (profile?.household_id) setHouseholdId(profile.household_id)

        const [txR, catR, accR, cardR, tagR] = await Promise.all([
            supabase
                .from('transactions')
                .select('*, transaction_tags(tag_id)')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false, nullsFirst: false }),
            supabase.from('categories').select('*'),
            supabase.from('accounts').select('*').eq('is_active', true),
            supabase.from('cards').select('*').eq('is_active', true),
            supabase.from('tags').select('*'),
        ])

        if (txR.data) setTransactions(txR.data)
        if (catR.data) setCategories(catR.data)
        if (accR.data) setAccounts(accR.data)
        if (cardR.data) {
            setCards(cardR.data)
            if (cardR.data.length > 0 && !selectedCardId) {
                const primary = cardR.data.find(c => c.is_primary) || cardR.data[0]
                setSelectedCardId(primary.id)
            }
        }
        if (tagR.data) setTags(tagR.data)
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        setForm({
            description: '', amount: '', type: 'expense', category_id: '',
            account_id: '', card_id: '', date: getTodayDateInputValue(),
            notes: '', is_recurring: false, recurrence_type: '', installments_count: 2,
            is_third_party: false,
            third_party_name: '',
            tag_ids: [],
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
            installments_count: 2,
            is_third_party: !!tx.is_third_party,
            third_party_name: tx.third_party_name || '',
            tag_ids: (tx as any).transaction_tags?.map((tt: any) => tt.tag_id) || [],
        })
        setShowModal(true)
    }

    function getSaveErrorMessage(error: unknown): string {
        const rawMessage = (error as any)?.message || ''
        if (/is_third_party|third_party_name|third_party_status|third_party_paid_at|schema cache|column .* does not exist/i.test(rawMessage)) {
            return 'Seu banco ainda nao tem os campos de terceiros. Rode a migration no Supabase e tente novamente.'
        }
        return rawMessage || 'Erro ao salvar transacao'
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
            is_third_party: form.is_third_party,
            third_party_name: form.is_third_party ? (form.third_party_name.trim() || null) : null,
            household_id: householdId,
            user_id: userId,
        }

        try {
            if (editing) {
                const { error: updateError } = await supabase.from('transactions').update(basePayload).eq('id', editing.id)
                if (updateError) throw updateError
            } else {
                if (form.is_recurring && form.recurrence_type === 'installment' && form.installments_count > 1) {
                    // Generate installments
                    const { generateInstallments } = await import('@/lib/transactions')
                    const installments = generateInstallments(
                        {
                            ...basePayload,
                        } as any,
                        form.installments_count,
                        parseDateInputValue(form.date)
                    )

                    const transactionsToInsert = installments.map(t => ({
                        description: t.description,
                        amount: t.amount / (form.installments_count || 1), // Divide o valor total entre as parcelas
                        type: t.type,
                        date: toDateInputValue(t.date),
                        category_id: t.category_id,
                        account_id: t.account_id || null,
                        card_id: form.card_id || null,
                        notes: form.notes || null,
                        is_recurring: true,
                        recurrence_type: 'monthly', // Using 'monthly' as standard recurrence type
                        is_third_party: form.is_third_party,
                        third_party_name: form.is_third_party ? (form.third_party_name.trim() || null) : null,
                        household_id: householdId,
                        user_id: userId
                    }))

                    const { data: createdTxs, error: instError } = await supabase.from('transactions').insert(transactionsToInsert).select()
                    if (instError) throw instError

                    if (createdTxs && form.tag_ids.length > 0) {
                        const tagLinks = createdTxs.flatMap(tx => form.tag_ids.map(tagId => ({
                            transaction_id: tx.id,
                            tag_id: tagId
                        })))
                        const { error: tagError } = await supabase.from('transaction_tags').insert(tagLinks)
                        if (tagError) throw tagError
                    }
                } else {
                    // Standard single insert
                    const { data, error } = await supabase.from('transactions').insert(basePayload).select().single()
                    if (error) throw error

                    if (data && form.tag_ids.length > 0) {
                        const tagLinks = form.tag_ids.map(tagId => ({
                            transaction_id: data.id,
                            tag_id: tagId
                        }))
                        const { error: tagError } = await supabase.from('transaction_tags').insert(tagLinks)
                        if (tagError) throw tagError
                    }
                }
            }

            // Edit mode tag adjustment
            if (editing) {
                // Remove old, add new
                const { error: deleteTagsError } = await supabase.from('transaction_tags').delete().eq('transaction_id', editing.id)
                if (deleteTagsError) throw deleteTagsError
                if (form.tag_ids.length > 0) {
                    const tagLinks = form.tag_ids.map(tagId => ({
                        transaction_id: editing.id,
                        tag_id: tagId
                    }))
                    const { error: insertTagsError } = await supabase.from('transaction_tags').insert(tagLinks)
                    if (insertTagsError) throw insertTagsError
                }
            }

            setSaving(false)
            setShowModal(false)
            loadAll()
        } catch (error) {
            console.error(error)
            alert(getSaveErrorMessage(error))
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir esta transação?')) return
        await supabase.from('transaction_tags').delete().eq('transaction_id', id)
        await supabase.from('transactions').delete().eq('id', id)
        setSelectedIds(prev => prev.filter(i => i !== id))
        loadAll()
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return
        if (!confirm(`Tem certeza que deseja excluir as ${selectedIds.length} transações selecionadas?`)) return

        setIsBulkDeleting(true)
        try {
            // Remove tags first
            await supabase
                .from('transaction_tags')
                .delete()
                .in('transaction_id', selectedIds)

            const { error } = await supabase
                .from('transactions')
                .delete()
                .in('id', selectedIds)

            if (error) throw error

            setSelectedIds([])
            loadAll()
        } catch (error) {
            console.error('Erro ao excluir em massa:', error)
            alert('Erro ao excluir algumas transações')
        } finally {
            setIsBulkDeleting(false)
        }
    }

    async function handleMarkThirdPartyPaid(id: string) {
        try {
            setMarkingThirdPartyId(id)
            const { error } = await supabase
                .from('transactions')
                .update({
                    third_party_status: 'paid',
                    third_party_paid_at: new Date().toISOString(),
                } as any)
                .eq('id', id)

            if (error) throw error
            await loadAll()
        } catch (error) {
            console.error('Erro ao marcar terceiro como pago:', error)
            alert(getSaveErrorMessage(error))
        } finally {
            setMarkingThirdPartyId(null)
        }
    }

    function toggleSelect(id: string) {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    function toggleSelectAll() {
        if (selectedIds.length === filteredTx.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(filteredTx.map(t => t.id))
        }
    }

    const filteredTx = (viewMode === 'list'
        ? (filterType === 'all' ? transactions : transactions.filter(t => t.type === filterType))
        : transactions.filter(t => {
            if (!selectedCardId || t.card_id !== selectedCardId) return false
            const card = cards.find(c => c.id === selectedCardId)
            if (!card) return false
            const closingDay = card.closing_day || 31
            const periodEnd = new Date(invoiceYear, invoiceMonth - 1, closingDay)
            const periodStart = new Date(invoiceYear, invoiceMonth - 2, closingDay + 1)
            const transactionDate = new Date(t.date + 'T00:00:00')
            return transactionDate >= periodStart && transactionDate <= periodEnd
        })).filter(t => {
            const query = searchTerm.toLowerCase()
            return t.description.toLowerCase().includes(query)
                || (t.third_party_name || '').toLowerCase().includes(query)
        })

    const invoiceTotal = viewMode === 'invoices' ? filteredTx.reduce((acc, t) => acc + t.amount, 0) : 0
    const thirdPartyMonthRows = transactions
        .filter(t => t.type === 'expense' && t.is_third_party)
        .filter(t => {
            const [tYear, tMonth] = t.date.split('-').map(Number)
            return tMonth === thirdPartyMonth && tYear === thirdPartyYear
        })
    const thirdPartyBaseRows = thirdPartyMonthRows
        .filter(t => {
            const query = thirdPartySearchTerm.toLowerCase().trim()
            if (!query) return true
            const paymentName = t.account_id
                ? (accounts.find(a => a.id === t.account_id)?.name || '')
                : (cards.find(c => c.id === t.card_id)?.name || '')
            return t.description.toLowerCase().includes(query)
                || (t.third_party_name || '').toLowerCase().includes(query)
                || paymentName.toLowerCase().includes(query)
        })
    const thirdPartyMonthTotalCount = thirdPartyMonthRows.length
    const thirdPartyMonthTotalValue = thirdPartyMonthRows.reduce((acc, t) => acc + Number(t.amount), 0)
    const thirdPartyPendingCount = thirdPartyMonthRows.filter(t => (t.third_party_status || 'pending') !== 'paid').length
    const thirdPartyPaidCount = thirdPartyMonthRows.length - thirdPartyPendingCount
    const thirdPartyRows = thirdPartyBaseRows
        .filter(t => {
            if (thirdPartyFilter === 'all') return true
            const status = (t.third_party_status || 'pending') === 'paid' ? 'paid' : 'pending'
            return status === thirdPartyFilter
        })
        .sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date)
            return (b.created_at || '').localeCompare(a.created_at || '')
        })
    const thirdPartyVisibleTotalValue = thirdPartyRows.reduce((acc, t) => acc + Number(t.amount), 0)

    const prevInvoice = () => {
        if (invoiceMonth === 1) { setInvoiceMonth(12); setInvoiceYear(y => y - 1) }
        else setInvoiceMonth(m => m - 1)
    }
    const nextInvoice = () => {
        if (invoiceMonth === 12) { setInvoiceMonth(1); setInvoiceYear(y => y + 1) }
        else setInvoiceMonth(m => m + 1)
    }
    const prevThirdPartyMonth = () => {
        if (thirdPartyMonth === 1) { setThirdPartyMonth(12); setThirdPartyYear(y => y - 1) }
        else setThirdPartyMonth(m => m - 1)
    }
    const nextThirdPartyMonth = () => {
        if (thirdPartyMonth === 12) { setThirdPartyMonth(1); setThirdPartyYear(y => y + 1) }
        else setThirdPartyMonth(m => m + 1)
    }

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
                <div style={{ display: 'flex', gap: 12 }}>
                    {selectedIds.length > 0 && !isThirdPartyOnly && (
                        <button
                            className="btn btn-secondary"
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            style={{
                                color: 'var(--color-danger)',
                                borderColor: 'var(--color-danger)',
                                background: 'rgba(239, 68, 68, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                borderRadius: 10
                            }}
                        >
                            <Trash2 size={18} />
                            Excluir ({selectedIds.length})
                        </button>
                    )}
                    <button className="btn-nova-tx" onClick={openCreate}>
                        <Plus size={20} /> Nova Transação
                    </button>
                </div>
            </header>

            {/* View Switching & Main Filters */}
            <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', background: 'var(--color-bg-tertiary)', padding: 4, borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                        <button
                            className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => { setViewMode('list'); setSearchTerm('') }}
                            style={{ borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '6px 16px', transition: 'all 0.2s' }}
                        >
                            Lançamentos
                        </button>
                        <button
                            className={`btn btn-sm ${viewMode === 'invoices' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => { setViewMode('invoices'); setSearchTerm('') }}
                            style={{ borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '6px 16px', transition: 'all 0.2s' }}
                        >
                            Faturas
                        </button>
                        <button
                            className={`btn btn-sm ${viewMode === 'third-party' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('third-party')}
                            style={{ borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '6px 16px', transition: 'all 0.2s' }}
                        >
                            Terceiros
                        </button>
                    </div>

                    {!isThirdPartyOnly && <div className="search-input-wrapper" style={{ position: 'relative', width: 280 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                        <input
                            type="text"
                            placeholder={viewMode === 'list' ? "Buscar nos lancamentos..." : "Buscar na fatura..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 36px',
                                borderRadius: 12,
                                background: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                fontSize: 13,
                                color: 'var(--color-text-primary)'
                            }}
                        />
                    </div>}
                </div>

                        {viewMode === 'list' ? (
                    <div className="filter-bar" style={{ margin: 0, padding: 4, background: 'var(--color-bg-tertiary)', borderRadius: 12 }}>
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
                ) : viewMode === 'invoices' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg-tertiary)', padding: '4px 6px', borderRadius: 14, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={prevInvoice} style={{ borderRadius: 10 }}><ChevronLeft size={18} /></button>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, minWidth: 140, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Fatura de {getMonthName(invoiceMonth)} {invoiceYear}
                        </span>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={nextInvoice} style={{ borderRadius: 10 }}><ChevronRight size={18} /></button>
                    </div>
                ) : (
                    <div />
                        )}
                    </div>

                    {viewMode === 'invoices' && (
                <div style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-secondary)', padding: 12, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                        {cards.map(card => (
                            <button
                                key={card.id}
                                onClick={() => setSelectedCardId(card.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 16px',
                                    borderRadius: 12,
                                    border: '1px solid',
                                    borderColor: selectedCardId === card.id ? card.color || 'var(--color-accent)' : 'var(--color-border)',
                                    background: selectedCardId === card.id ? (card.color || '#10B981') + '10' : 'transparent',
                                    color: selectedCardId === card.id ? card.color || 'var(--color-accent)' : 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <CreditCard size={16} />
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{card.name}</span>
                                {selectedCardId === card.id && <Check size={14} />}
                            </button>
                        ))}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Total da Fatura</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)' }}>{formatCurrency(invoiceTotal)}</div>
                    </div>
                </div>
                    )}

                    {/* Table */}
                    {!isThirdPartyOnly && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead className="pro-table-header">
                            <tr>
                                <th style={{ width: 40, paddingRight: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={filteredTx.length > 0 && selectedIds.length === filteredTx.length}
                                        onChange={toggleSelectAll}
                                        style={{ width: 16, height: 16, cursor: 'pointer', borderRadius: 4 }}
                                    />
                                </th>
                                <th>Data</th>
                                <th>Descrição</th>
                                <th>Categoria</th>
                                <th>Tags</th>
                                <th>Pagamento</th>
                                <th style={{ textAlign: 'right' }}>Valor</th>
                                <th style={{ width: 100, textAlign: 'center' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTx.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--color-text-tertiary)' }}>
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
                                        backgroundColor: selectedIds.includes(t.id)
                                            ? 'var(--color-accent-glow)'
                                            : index % 2 === 0 ? 'transparent' : 'var(--color-bg-tertiary)'
                                    }}
                                        onMouseEnter={(e) => {
                                            if (!selectedIds.includes(t.id)) {
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-card-hover)'
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!selectedIds.includes(t.id)) {
                                                e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : 'var(--color-bg-tertiary)'
                                            }
                                        }}
                                    >
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', paddingRight: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(t.id)}
                                                onChange={() => toggleSelect(t.id)}
                                                style={{ width: 16, height: 16, cursor: 'pointer', borderRadius: 4 }}
                                            />
                                        </td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                                            {formatDate(t.date)}
                                        </td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{t.description}</div>
                                            {(t.is_recurring && (t.recurrence_type === 'installment' || /\(\d+\/\d+\)/.test(t.description))) && (
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
                                            {t.is_third_party && (
                                                <span style={{
                                                    fontSize: 10,
                                                    padding: '2px 8px',
                                                    marginTop: 4,
                                                    marginLeft: 6,
                                                    borderRadius: 'var(--radius-full)',
                                                    background: 'rgba(245, 158, 11, 0.12)',
                                                    border: '1px solid rgba(245, 158, 11, 0.35)',
                                                    color: '#92400E',
                                                    display: 'inline-block',
                                                    fontWeight: 700
                                                }}>
                                                    Terceiros{t.third_party_name ? `: ${t.third_party_name}` : ''}
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
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {(t as any).transaction_tags?.length > 0 ? (
                                                    (t as any).transaction_tags.map((tt: any) => {
                                                        const tag = tags.find(tg => tg.id === tt.tag_id)
                                                        if (!tag) return null
                                                        return (
                                                            <span key={tag.id} style={{
                                                                fontSize: 10,
                                                                padding: '2px 6px',
                                                                borderRadius: 4,
                                                                background: (tag.color || '#8B5CF6') + '20',
                                                                color: tag.color || '#8B5CF6',
                                                                border: `1px solid ${(tag.color || '#8B5CF6')}40`,
                                                                fontWeight: 600
                                                            }}>
                                                                {tag.name}
                                                            </span>
                                                        )
                                                    })
                                                ) : (
                                                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>-</span>
                                                )}
                                            </div>
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
                    )}
            </>

            {isThirdPartyOnly && (
            <div id="third-party-expenses" className="card" style={{ marginTop: 0, padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Despesas de Terceiros</h3>
                            <p style={{ margin: 0, marginTop: 4, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                                Apenas transacoes de terceiros do mes selecionado.
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-bg-tertiary)', padding: '4px 6px', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                                <button className="btn btn-icon btn-ghost btn-sm" onClick={prevThirdPartyMonth} style={{ borderRadius: 8 }}>
                                    <ChevronLeft size={16} />
                                </button>
                                <span style={{ minWidth: 140, textAlign: 'center', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {getMonthName(thirdPartyMonth)} {thirdPartyYear}
                                </span>
                                <button className="btn btn-icon btn-ghost btn-sm" onClick={nextThirdPartyMonth} style={{ borderRadius: 8 }}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total de terceiros no mes
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                    {thirdPartyMonthTotalCount} transacao(oes)
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#B45309' }}>
                                    {formatCurrency(thirdPartyMonthTotalValue)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div className="search-input-wrapper" style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                            <input
                                type="text"
                                placeholder="Buscar em terceiros..."
                                value={thirdPartySearchTerm}
                                onChange={(e) => setThirdPartySearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px 8px 36px',
                                    borderRadius: 12,
                                    background: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    fontSize: 13,
                                    color: 'var(--color-text-primary)'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => setThirdPartyFilter('all')}
                                style={{
                                    border: '1px solid var(--color-border)',
                                    background: thirdPartyFilter === 'all' ? 'var(--color-bg-secondary)' : 'var(--color-bg-tertiary)',
                                    color: thirdPartyFilter === 'all' ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                                    borderRadius: 8,
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Todos
                            </button>
                            <button
                                type="button"
                                onClick={() => setThirdPartyFilter('pending')}
                                style={{
                                    border: '1px solid var(--color-border)',
                                    background: thirdPartyFilter === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-bg-tertiary)',
                                    color: thirdPartyFilter === 'pending' ? '#B45309' : 'var(--color-text-tertiary)',
                                    borderRadius: 8,
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Pendentes ({thirdPartyPendingCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setThirdPartyFilter('paid')}
                                style={{
                                    border: '1px solid var(--color-border)',
                                    background: thirdPartyFilter === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-bg-tertiary)',
                                    color: thirdPartyFilter === 'paid' ? 'var(--color-income)' : 'var(--color-text-tertiary)',
                                    borderRadius: 8,
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Pagos ({thirdPartyPaidCount})
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                        Mostrando {thirdPartyRows.length} registro(s) | Total filtrado: {formatCurrency(thirdPartyVisibleTotalValue)}
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead className="pro-table-header">
                            <tr>
                                <th>Data</th>
                                <th>Descricao</th>
                                <th>Terceiro</th>
                                <th>Pagamento</th>
                                <th style={{ textAlign: 'right' }}>Valor</th>
                                <th>Status</th>
                                <th style={{ width: 160, textAlign: 'center' }}>Acao</th>
                            </tr>
                        </thead>
                        <tbody>
                            {thirdPartyRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-tertiary)' }}>
                                        Nenhuma despesa de terceiro encontrada para {getMonthName(thirdPartyMonth)} {thirdPartyYear}.
                                    </td>
                                </tr>
                            ) : (
                                thirdPartyRows.map((t, index) => {
                                    const status = (t.third_party_status || 'pending') === 'paid' ? 'paid' : 'pending'
                                    return (
                                        <tr key={`third-party-${t.id}`} style={{ background: index % 2 === 0 ? 'transparent' : 'var(--color-bg-tertiary)' }}>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                                                {formatDate(t.date)}
                                            </td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
                                                {t.description}
                                            </td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                                {t.third_party_name || '-'}
                                            </td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                                {t.account_id ? accounts.find(a => a.id === t.account_id)?.name || '-' : (cards.find(c => c.id === t.card_id)?.name || '-')}
                                            </td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontWeight: 700 }}>
                                                - {formatCurrency(t.amount)}
                                            </td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '4px 10px',
                                                    borderRadius: 999,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    background: status === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                    color: status === 'paid' ? 'var(--color-income)' : '#D97706',
                                                }}>
                                                    {status === 'paid' ? 'Pago' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                                                {status === 'paid' ? (
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-income)' }}>Ja pago</span>
                                                ) : (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleMarkThirdPartyPaid(t.id)}
                                                        disabled={markingThirdPartyId === t.id}
                                                        style={{ borderRadius: 8, padding: '0 12px', height: 32 }}
                                                    >
                                                        {markingThirdPartyId === t.id ? 'Salvando...' : 'Marcar pago'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content-pro shadow-2xl" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
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
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, border: '1px solid var(--color-border)', marginBottom: 20 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: form.is_recurring ? 16 : 0 }}>
                                        <input type="checkbox" checked={form.is_recurring}
                                            onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked, recurrence_type: e.target.checked ? 'monthly' : '' }))}
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
                                                    <option value="monthly">Fixo (Mensal)</option>
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

                                <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: 16, borderRadius: 16, border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: 20 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={form.is_third_party}
                                            onChange={e => setForm(f => ({
                                                ...f,
                                                is_third_party: e.target.checked,
                                                third_party_name: e.target.checked ? f.third_party_name : '',
                                            }))}
                                            style={{ width: 18, height: 18, borderRadius: 4, cursor: 'pointer' }}
                                        />
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>Lancamento de terceiros?</span>
                                    </label>
                                    {form.is_third_party && (
                                        <div className="input-group" style={{ marginTop: 12, marginBottom: 0 }}>
                                            <label className="input-label">Quem vai te reembolsar?</label>
                                            <input
                                                className="input"
                                                value={form.third_party_name}
                                                onChange={e => setForm(f => ({ ...f, third_party_name: e.target.value }))}
                                                placeholder="Ex: Mae, Sogra, Thiago..."
                                                required={form.is_third_party}
                                            />
                                            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                                                Essa transacao continua na fatura/cartao, mas nao entra no saldo da familia.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Tags Selector (Multi-select) */}
                                <div className="input-group" ref={tagsRef}>
                                    <label className="input-label">Tags</label>
                                    <div style={{ position: 'relative' }}>
                                        <div
                                            className="input select"
                                            onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                                            style={{
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                minHeight: 42,
                                                backgroundImage: 'none' // Remove default arrow
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {form.tag_ids.length === 0 ? (
                                                    <span style={{ color: 'var(--color-text-muted)' }}>Selecionar tags</span>
                                                ) : (
                                                    form.tag_ids.map(id => {
                                                        const tag = tags.find(t => t.id === id)
                                                        return (
                                                            <span key={id} style={{
                                                                fontSize: 11,
                                                                background: (tag?.color || '#8B5CF6') + '20',
                                                                color: tag?.color || '#8B5CF6',
                                                                padding: '2px 8px',
                                                                borderRadius: 4,
                                                                border: `1px solid ${(tag?.color || '#8B5CF6')}40`,
                                                                fontWeight: 600
                                                            }}>
                                                                {tag?.name}
                                                            </span>
                                                        )
                                                    })
                                                )}
                                            </div>
                                            <ChevronDown size={16} style={{ color: 'var(--color-text-tertiary)', transition: 'transform 0.2s', transform: showTagsDropdown ? 'rotate(180deg)' : 'none' }} />
                                        </div>

                                        {showTagsDropdown && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 'calc(100% + 4px)',
                                                left: 0,
                                                right: 0,
                                                background: 'var(--color-bg-secondary)',
                                                border: '1px solid var(--color-border-hover)',
                                                borderRadius: 'var(--radius-md)',
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                                                zIndex: 50,
                                                maxHeight: 240,
                                                overflowY: 'auto',
                                                padding: 6,
                                                animation: 'modal-pop 0.2s ease'
                                            }}>
                                                {tags.length === 0 && (
                                                    <div style={{ padding: 12, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                                                        Nenhuma tag disponível
                                                    </div>
                                                )}
                                                {tags.map(tag => {
                                                    const isSelected = form.tag_ids.includes(tag.id)
                                                    return (
                                                        <div
                                                            key={tag.id}
                                                            onClick={() => setForm(f => ({
                                                                ...f,
                                                                tag_ids: isSelected ? f.tag_ids.filter(id => id !== tag.id) : [...f.tag_ids, tag.id]
                                                            }))}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 10,
                                                                padding: '10px 12px',
                                                                borderRadius: 8,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s',
                                                                background: isSelected ? 'var(--color-bg-tertiary)' : 'transparent'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'var(--color-bg-tertiary)' : 'transparent'}
                                                        >
                                                            <div style={{
                                                                width: 18,
                                                                height: 18,
                                                                borderRadius: 4,
                                                                border: `2px solid ${isSelected ? (tag.color || '#8B5CF6') : 'var(--color-border)'}`,
                                                                background: isSelected ? (tag.color || '#8B5CF6') : 'transparent',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'white',
                                                                transition: 'all 0.15s'
                                                            }}>
                                                                {isSelected && <Check size={12} strokeWidth={4} />}
                                                            </div>
                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color || '#8B5CF6', flexShrink: 0 }} />
                                                            <span style={{
                                                                fontSize: 13,
                                                                color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                                                fontWeight: isSelected ? 600 : 400,
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}>
                                                                {tag.name}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
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
