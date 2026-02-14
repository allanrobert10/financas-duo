'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils'
import {
    generateFixedExpensesTemplate,
    parseFixedExpensesImport,
    type FixedExpenseImportData,
} from '@/utils/excel'
import type {
    Account,
    Card,
    Category,
    FixedExpense,
    FixedExpenseOccurrence,
} from '@/types/database'
import {
    Plus,
    Pencil,
    Trash2,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    X,
    Wallet,
    CreditCard,
    Upload,
    Download,
} from 'lucide-react'

type FixedExpenseWithRelations = FixedExpense & {
    categories?: { name: string } | null
    accounts?: { name: string } | null
    cards?: { name: string } | null
}

type FixedOccurrenceWithRelations = FixedExpenseOccurrence & {
    fixed_expenses?: FixedExpenseWithRelations | null
}

type PaymentMethod = 'account' | 'card'

function formatMoneyInput(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    return (Number(digits) / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

function parseMoneyInput(value: string): number {
    return parseFloat(value.replace(/\./g, '').replace(',', '.'))
}

function getDueDateValue(year: number, month: number, dueDay: number): string {
    const lastDay = new Date(year, month, 0).getDate()
    const day = Math.min(Math.max(dueDay, 1), lastDay)
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${year}-${mm}-${dd}`
}

function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function buildFixedExpenseKey(
    description: string,
    dueDay: number,
    accountId: string | null,
    cardId: string | null
): string {
    return `${normalizeKey(description)}|${dueDay}|${accountId || ''}|${cardId || ''}`
}

export default function FixedExpensesPage() {
    const supabase = createClient()
    const now = new Date()

    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [showPeriodPicker, setShowPeriodPicker] = useState(false)
    const [pickerMonth, setPickerMonth] = useState(now.getMonth() + 1)
    const [pickerYear, setPickerYear] = useState(now.getFullYear())

    const [householdId, setHouseholdId] = useState('')
    const [userId, setUserId] = useState('')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [importing, setImporting] = useState(false)
    const [processingOccurrenceId, setProcessingOccurrenceId] = useState('')
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const importInputRef = useRef<HTMLInputElement | null>(null)

    const [categories, setCategories] = useState<Category[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [cards, setCards] = useState<Card[]>([])

    const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseWithRelations[]>([])
    const [occurrences, setOccurrences] = useState<FixedOccurrenceWithRelations[]>([])

    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<FixedExpenseWithRelations | null>(null)
    const [form, setForm] = useState({
        description: '',
        amount: '',
        due_day: '1',
        category_id: '',
        payment_method: 'account' as PaymentMethod,
        account_id: '',
        card_id: '',
        notes: '',
        is_active: true,
    })

    const currentYear = now.getFullYear()
    const minYear = Math.min(currentYear - 10, year - 5)
    const maxYear = Math.max(currentYear + 10, year + 5)
    const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)

    useEffect(() => {
        void loadData()
    }, [month, year])

    const totals = useMemo(() => {
        return occurrences.reduce(
            (acc, item) => {
                acc.total += Number(item.amount)
                if (item.status === 'paid') acc.paid += Number(item.amount)
                return acc
            },
            { total: 0, paid: 0 }
        )
    }, [occurrences])

    const pendingTotal = totals.total - totals.paid

    async function ensureMonthOccurrences(targetHouseholdId: string, targetMonth: number, targetYear: number) {
        const { data: templates, error: templatesError } = await supabase
            .from('fixed_expenses')
            .select('*')
            .eq('household_id', targetHouseholdId)
            .eq('is_active', true)

        if (templatesError) throw templatesError
        if (!templates || templates.length === 0) return

        const payload = templates.map(template => ({
            fixed_expense_id: template.id,
            household_id: targetHouseholdId,
            month: targetMonth,
            year: targetYear,
            due_date: getDueDateValue(targetYear, targetMonth, template.due_day),
            amount: template.amount,
            status: 'pending',
        }))

        const { error: upsertError } = await supabase
            .from('fixed_expense_occurrences')
            .upsert(payload, {
                onConflict: 'fixed_expense_id,month,year',
                ignoreDuplicates: true,
            })

        if (upsertError) throw upsertError
    }

    async function loadData() {
        setLoading(true)
        setMessage(null)
        try {
            const { data: authData } = await supabase.auth.getUser()
            const user = authData.user
            if (!user) return

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('household_id')
                .eq('id', user.id)
                .single()

            if (profileError) throw profileError
            if (!profile?.household_id) return

            setHouseholdId(profile.household_id)
            setUserId(user.id)

            const [categoriesRes, accountsRes, cardsRes] = await Promise.all([
                supabase
                    .from('categories')
                    .select('*')
                    .eq('household_id', profile.household_id)
                    .eq('type', 'expense')
                    .order('name'),
                supabase
                    .from('accounts')
                    .select('*')
                    .eq('household_id', profile.household_id)
                    .eq('is_active', true)
                    .order('name'),
                supabase
                    .from('cards')
                    .select('*')
                    .eq('household_id', profile.household_id)
                    .eq('is_active', true)
                    .order('name'),
            ])

            if (categoriesRes.error) throw categoriesRes.error
            if (accountsRes.error) throw accountsRes.error
            if (cardsRes.error) throw cardsRes.error

            setCategories(categoriesRes.data || [])
            setAccounts(accountsRes.data || [])
            setCards(cardsRes.data || [])

            await ensureMonthOccurrences(profile.household_id, month, year)

            const [templatesRes, occurrencesRes] = await Promise.all([
                supabase
                    .from('fixed_expenses')
                    .select('*, categories(name), accounts(name), cards(name)')
                    .eq('household_id', profile.household_id)
                    .order('is_active', { ascending: false })
                    .order('description'),
                supabase
                    .from('fixed_expense_occurrences')
                    .select('*, fixed_expenses(*, categories(name), accounts(name), cards(name))')
                    .eq('household_id', profile.household_id)
                    .eq('month', month)
                    .eq('year', year)
                    .order('due_date', { ascending: true })
                    .order('created_at', { ascending: true }),
            ])

            if (templatesRes.error) throw templatesRes.error
            if (occurrencesRes.error) throw occurrencesRes.error

            setFixedExpenses((templatesRes.data || []) as unknown as FixedExpenseWithRelations[])
            setOccurrences((occurrencesRes.data || []) as unknown as FixedOccurrenceWithRelations[])
        } catch (error: any) {
            console.error(error)
            setMessage({ type: 'error', text: error?.message || 'Erro ao carregar despesas fixas.' })
        } finally {
            setLoading(false)
        }
    }

    function handleDownloadTemplate() {
        generateFixedExpensesTemplate()
    }

    async function handleImportData(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !householdId || !userId) return

        setImporting(true)
        setMessage(null)

        try {
            const rows = await parseFixedExpensesImport(file)
            if (rows.length === 0) {
                setMessage({ type: 'error', text: 'Nenhuma despesa fixa valida foi encontrada na planilha.' })
                return
            }

            const categoryMap = new Map(categories.map(c => [normalizeKey(c.name), c.id]))
            const accountMap = new Map(accounts.map(a => [normalizeKey(a.name), a.id]))
            const cardMap = new Map(cards.map(c => [normalizeKey(c.name), c.id]))

            const { data: existingTemplates, error: existingError } = await supabase
                .from('fixed_expenses')
                .select('id, description, due_day, account_id, card_id')
                .eq('household_id', householdId)

            if (existingError) throw existingError

            const existingMap = new Map<string, string>()
            ;(existingTemplates || []).forEach(item => {
                existingMap.set(
                    buildFixedExpenseKey(item.description, item.due_day, item.account_id, item.card_id),
                    item.id
                )
            })

            let created = 0
            let updated = 0
            let errors = 0

            for (const row of rows) {
                const result = await upsertImportedFixedExpense({
                    row,
                    householdId,
                    userId,
                    categoryMap,
                    accountMap,
                    cardMap,
                    existingMap,
                })

                if (result === 'created') created++
                else if (result === 'updated') updated++
                else errors++
            }

            await ensureMonthOccurrences(householdId, month, year)
            await loadData()
            setMessage({
                type: created + updated > 0 ? 'success' : 'error',
                text:
                    created + updated > 0
                        ? `${created} criadas, ${updated} atualizadas${errors > 0 ? ` (${errors} com erro)` : ''}.`
                        : `Nao foi possivel importar as despesas fixas${errors > 0 ? ` (${errors} erros)` : '.'}`,
            })
        } catch (error: any) {
            console.error(error)
            setMessage({ type: 'error', text: error?.message || 'Erro ao importar despesas fixas.' })
        } finally {
            setImporting(false)
            e.target.value = ''
        }
    }

    async function upsertImportedFixedExpense(params: {
        row: FixedExpenseImportData
        householdId: string
        userId: string
        categoryMap: Map<string, string>
        accountMap: Map<string, string>
        cardMap: Map<string, string>
        existingMap: Map<string, string>
    }): Promise<'created' | 'updated' | 'error'> {
        const {
            row,
            householdId: currentHouseholdId,
            userId: currentUserId,
            categoryMap,
            accountMap,
            cardMap,
            existingMap,
        } = params

        let categoryId = categoryMap.get(normalizeKey(row.category))
        if (!categoryId) {
            const { data: createdCategory, error: categoryError } = await supabase
                .from('categories')
                .insert({
                    household_id: currentHouseholdId,
                    name: row.category.trim(),
                    type: 'expense',
                    icon: 'Circle',
                })
                .select('id, name')
                .single()

            if (categoryError || !createdCategory) return 'error'
            categoryId = createdCategory.id
            categoryMap.set(normalizeKey(createdCategory.name), createdCategory.id)
        }

        let accountId: string | null = null
        let cardId: string | null = null

        if (row.paymentMethod === 'conta') {
            accountId = accountMap.get(normalizeKey(row.paymentName)) || null
            if (!accountId) return 'error'
        } else {
            cardId = cardMap.get(normalizeKey(row.paymentName)) || null
            if (!cardId) return 'error'
        }

        const payload = {
            household_id: currentHouseholdId,
            user_id: currentUserId,
            category_id: categoryId,
            description: row.description.trim(),
            amount: row.amount,
            due_day: row.dueDay,
            account_id: accountId,
            card_id: cardId,
            notes: row.notes?.trim() || null,
            is_active: row.isActive ?? true,
            updated_at: new Date().toISOString(),
        }

        const key = buildFixedExpenseKey(payload.description, payload.due_day, payload.account_id, payload.card_id)
        const existingId = existingMap.get(key)

        if (existingId) {
            const { error } = await supabase.from('fixed_expenses').update(payload).eq('id', existingId)
            return error ? 'error' : 'updated'
        }

        const { data: inserted, error } = await supabase
            .from('fixed_expenses')
            .insert(payload)
            .select('id')
            .single()

        if (error || !inserted) return 'error'
        existingMap.set(key, inserted.id)
        return 'created'
    }

    function openCreate() {
        const firstCategory = categories[0]?.id || ''
        const firstAccount = accounts[0]?.id || ''
        const firstCard = cards[0]?.id || ''
        const paymentMethod: PaymentMethod = firstAccount ? 'account' : 'card'
        setEditing(null)
        setForm({
            description: '',
            amount: '',
            due_day: '1',
            category_id: firstCategory,
            payment_method: paymentMethod,
            account_id: firstAccount,
            card_id: firstCard,
            notes: '',
            is_active: true,
        })
        setShowModal(true)
    }

    function openEdit(item: FixedExpenseWithRelations) {
        const paymentMethod: PaymentMethod = item.account_id ? 'account' : 'card'
        setEditing(item)
        setForm({
            description: item.description,
            amount: Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            due_day: String(item.due_day),
            category_id: item.category_id,
            payment_method: paymentMethod,
            account_id: item.account_id || '',
            card_id: item.card_id || '',
            notes: item.notes || '',
            is_active: item.is_active,
        })
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (!householdId || !userId) return

        const parsedAmount = parseMoneyInput(form.amount || '0')
        const dueDay = parseInt(form.due_day, 10)

        if (!form.description.trim()) {
            setMessage({ type: 'error', text: 'Informe a descricao.' })
            return
        }
        if (!form.category_id) {
            setMessage({ type: 'error', text: 'Selecione a categoria.' })
            return
        }
        if (!parsedAmount || Number.isNaN(parsedAmount)) {
            setMessage({ type: 'error', text: 'Informe um valor valido.' })
            return
        }
        if (Number.isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
            setMessage({ type: 'error', text: 'Vencimento deve estar entre 1 e 31.' })
            return
        }
        if (form.payment_method === 'account' && !form.account_id) {
            setMessage({ type: 'error', text: 'Selecione a conta.' })
            return
        }
        if (form.payment_method === 'card' && !form.card_id) {
            setMessage({ type: 'error', text: 'Selecione o cartao.' })
            return
        }

        setSaving(true)
        setMessage(null)

        const payload = {
            household_id: householdId,
            user_id: userId,
            category_id: form.category_id,
            description: form.description.trim(),
            amount: parsedAmount,
            due_day: dueDay,
            account_id: form.payment_method === 'account' ? form.account_id : null,
            card_id: form.payment_method === 'card' ? form.card_id : null,
            notes: form.notes.trim() || null,
            is_active: form.is_active,
            updated_at: new Date().toISOString(),
        }

        try {
            if (editing) {
                const { error } = await supabase.from('fixed_expenses').update(payload).eq('id', editing.id)
                if (error) throw error

                await supabase
                    .from('fixed_expense_occurrences')
                    .update({
                        amount: parsedAmount,
                        due_date: getDueDateValue(year, month, dueDay),
                    })
                    .eq('fixed_expense_id', editing.id)
                    .eq('month', month)
                    .eq('year', year)
                    .eq('status', 'pending')
            } else {
                const { error } = await supabase.from('fixed_expenses').insert(payload)
                if (error) throw error
            }

            await ensureMonthOccurrences(householdId, month, year)
            setShowModal(false)
            setEditing(null)
            await loadData()
            setMessage({ type: 'success', text: 'Despesa fixa salva com sucesso.' })
        } catch (error: any) {
            console.error(error)
            setMessage({ type: 'error', text: error?.message || 'Erro ao salvar despesa fixa.' })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Excluir esta despesa fixa?')) return
        setMessage(null)
        const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
        if (error) {
            setMessage({ type: 'error', text: error.message })
            return
        }
        await loadData()
    }

    async function handleMarkAsPaid(item: FixedOccurrenceWithRelations) {
        if (!householdId || !userId || item.status === 'paid') return

        const template = item.fixed_expenses
        if (!template) {
            setMessage({ type: 'error', text: 'Modelo da despesa fixa nao encontrado.' })
            return
        }

        setProcessingOccurrenceId(item.id)
        setMessage(null)

        try {
            const transactionPayload = {
                household_id: householdId,
                user_id: userId,
                type: 'expense',
                amount: item.amount,
                description: template.description,
                date: item.due_date,
                category_id: template.category_id,
                account_id: template.account_id,
                card_id: template.card_id,
                notes: template.notes || null,
                is_recurring: true,
                recurrence_type: 'monthly',
            }

            const { data: createdTransaction, error: txError } = await supabase
                .from('transactions')
                .insert(transactionPayload)
                .select('id')
                .single()

            if (txError) throw txError

            const { error: updateError } = await supabase
                .from('fixed_expense_occurrences')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    transaction_id: createdTransaction.id,
                })
                .eq('id', item.id)

            if (updateError) throw updateError

            await loadData()
            setMessage({ type: 'success', text: 'Despesa marcada como paga.' })
        } catch (error: any) {
            console.error(error)
            setMessage({ type: 'error', text: error?.message || 'Nao foi possivel marcar como pago.' })
        } finally {
            setProcessingOccurrenceId('')
        }
    }

    function prevMonth() {
        setShowPeriodPicker(false)
        if (month === 1) {
            setMonth(12)
            setYear(prev => prev - 1)
            return
        }
        setMonth(prev => prev - 1)
    }

    function nextMonth() {
        setShowPeriodPicker(false)
        if (month === 12) {
            setMonth(1)
            setYear(prev => prev + 1)
            return
        }
        setMonth(prev => prev + 1)
    }

    function goToCurrentMonth() {
        const today = new Date()
        setMonth(today.getMonth() + 1)
        setYear(today.getFullYear())
        setShowPeriodPicker(false)
    }

    function togglePeriodPicker() {
        if (!showPeriodPicker) {
            setPickerMonth(month)
            setPickerYear(year)
        }
        setShowPeriodPicker(prev => !prev)
    }

    function applyPeriod() {
        setMonth(pickerMonth)
        setYear(pickerYear)
        setShowPeriodPicker(false)
    }

    const isCurrentPeriod = month === now.getMonth() + 1 && year === now.getFullYear()

    return (
        <div className="fade-in">
            <div className="page-header-pro">
                <div className="title-group">
                    <h1>Despesas Fixas</h1>
                    <p>Controle contas mensais e acompanhe o que ja foi pago.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={handleDownloadTemplate} disabled={importing}>
                        <Download size={16} /> Baixar Modelo
                    </button>
                    <button className="btn btn-secondary" onClick={() => importInputRef.current?.click()} disabled={importing}>
                        <Upload size={16} /> {importing ? 'Importando...' : 'Importar Planilha'}
                    </button>
                    <button className="btn-nova-tx" onClick={openCreate} disabled={importing}>
                        <Plus size={20} /> Nova Despesa Fixa
                    </button>
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImportData}
                        style={{ display: 'none' }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg-tertiary)', padding: '4px 6px', borderRadius: 14, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', position: 'relative' }}>
                    <button className="btn btn-icon btn-ghost btn-sm" onClick={prevMonth} style={{ borderRadius: 10 }}><ChevronLeft size={18} /></button>
                    <button
                        type="button"
                        onClick={togglePeriodPicker}
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 13,
                            minWidth: 160,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--color-text-primary)',
                            cursor: 'pointer',
                            padding: '6px 10px',
                            borderRadius: 10,
                        }}
                    >
                        {getMonthName(month)} {year}
                    </button>
                    <button className="btn btn-icon btn-ghost btn-sm" onClick={nextMonth} style={{ borderRadius: 10 }}><ChevronRight size={18} /></button>
                    <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={goToCurrentMonth}
                        disabled={isCurrentPeriod}
                        style={{ borderRadius: 10, padding: '0 12px', fontWeight: 700 }}
                    >
                        Hoje
                    </button>

                    {showPeriodPicker && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            width: 280,
                            zIndex: 30,
                            background: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 12,
                            boxShadow: 'var(--shadow-lg)',
                            padding: 12,
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <label className="input-label" style={{ fontSize: 11, marginBottom: 6 }}>{'M\u00EAs'}</label>
                                    <select className="input select" value={pickerMonth} onChange={e => setPickerMonth(Number(e.target.value))}>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{getMonthName(m)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label" style={{ fontSize: 11, marginBottom: 6 }}>Ano</label>
                                    <select className="input select" value={pickerYear} onChange={e => setPickerYear(Number(e.target.value))}>
                                        {yearOptions.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowPeriodPicker(false)} style={{ borderRadius: 8 }}>
                                    Cancelar
                                </button>
                                <button type="button" className="btn btn-sm btn-primary" onClick={applyPeriod} style={{ borderRadius: 8 }}>
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {message && (
                <div
                    style={{
                        marginBottom: 16,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: message.type === 'success' ? 'var(--color-income)' : 'var(--color-danger)',
                        fontWeight: 600,
                    }}
                >
                    {message.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div className="stat-card" style={{ padding: 16 }}>
                    <div className="stat-card-label">Total do mes</div>
                    <div className="stat-card-value" style={{ fontSize: 28 }}>{formatCurrency(totals.total)}</div>
                </div>
                <div className="stat-card" style={{ padding: 16 }}>
                    <div className="stat-card-label">Pago</div>
                    <div className="stat-card-value" style={{ fontSize: 28, color: 'var(--color-income)' }}>{formatCurrency(totals.paid)}</div>
                </div>
                <div className="stat-card" style={{ padding: 16 }}>
                    <div className="stat-card-label">Pendente</div>
                    <div className="stat-card-value" style={{ fontSize: 28, color: 'var(--color-expense)' }}>{formatCurrency(pendingTotal)}</div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', marginBottom: 24 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead className="pro-table-header">
                            <tr>
                                <th>Venc.</th>
                                <th>Lancamento</th>
                                <th>Categoria</th>
                                <th>Pagamento</th>
                                <th style={{ textAlign: 'right' }}>Valor</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Carregando...</td>
                                </tr>
                            ) : occurrences.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Nenhuma despesa fixa para este periodo.</td>
                                </tr>
                            ) : (
                                occurrences.map(item => {
                                    const template = item.fixed_expenses
                                    return (
                                        <tr key={item.id}>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>{formatDate(item.due_date)}</td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>{template?.description || '-'}</td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>{template?.categories?.name || '-'}</td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                                {template?.account_id ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <Wallet size={14} /> {template.accounts?.name || 'Conta'}
                                                    </span>
                                                ) : template?.card_id ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <CreditCard size={14} /> {template.cards?.name || 'Cartao'}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontWeight: 700 }}>
                                                {formatCurrency(Number(item.amount))}
                                            </td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '4px 10px',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: item.status === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                    color: item.status === 'paid' ? 'var(--color-income)' : '#D97706',
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                }}>
                                                    {item.status === 'paid' ? 'Pago' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                                                {item.status === 'paid' ? (
                                                    <span style={{ color: 'var(--color-income)', fontSize: 12, fontWeight: 700 }}>Concluido</span>
                                                ) : (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleMarkAsPaid(item)}
                                                        disabled={processingOccurrenceId === item.id}
                                                        style={{ borderRadius: 8 }}
                                                    >
                                                        <CheckCircle2 size={14} /> {processingOccurrenceId === item.id ? 'Salvando...' : 'Marcar pago'}
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

            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>Modelos cadastrados</div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead className="pro-table-header">
                            <tr>
                                <th>Descricao</th>
                                <th>Dia venc.</th>
                                <th>Categoria</th>
                                <th>Pagamento</th>
                                <th style={{ textAlign: 'right' }}>Valor</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fixedExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Nenhum modelo cadastrado.</td>
                                </tr>
                            ) : (
                                fixedExpenses.map(item => (
                                    <tr key={item.id}>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>{item.description}</td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>{item.due_day}</td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>{item.categories?.name || '-'}</td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                            {item.account_id ? item.accounts?.name : item.cards?.name}
                                        </td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(Number(item.amount))}</td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                            {item.is_active ? (
                                                <span style={{ color: 'var(--color-income)', fontWeight: 700 }}>Ativo</span>
                                            ) : (
                                                <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>Pausado</span>
                                            )}
                                        </td>
                                        <td style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                                                <button className="btn btn-icon btn-ghost" onClick={() => openEdit(item)}><Pencil size={15} /></button>
                                                <button className="btn btn-icon btn-ghost" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(item.id)}><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content-pro" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520 }}>
                        <div className="modal-header-pro">
                            <h2>{editing ? 'Editar' : 'Nova'} Despesa Fixa</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body-pro">
                                <div className="input-group">
                                    <label className="input-label">Descricao</label>
                                    <input className="input" value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} required />
                                </div>
                                <div className="grid-2">
                                    <div className="input-group">
                                        <label className="input-label">Valor</label>
                                        <input className="input" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: formatMoneyInput(e.target.value) }))} required />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Dia de vencimento</label>
                                        <input className="input" type="number" min={1} max={31} value={form.due_day} onChange={e => setForm(prev => ({ ...prev, due_day: e.target.value }))} required />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Categoria</label>
                                    <select className="input select" value={form.category_id} onChange={e => setForm(prev => ({ ...prev, category_id: e.target.value }))} required>
                                        <option value="">Selecione</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="input-label" style={{ marginBottom: 10 }}>Forma de pagamento</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                        <button
                                            type="button"
                                            className={`payment-method-card ${form.payment_method === 'account' ? 'active' : ''}`}
                                            onClick={() => setForm(prev => ({ ...prev, payment_method: 'account', account_id: prev.account_id || accounts[0]?.id || '', card_id: '' }))}
                                        >
                                            <div style={{ background: form.payment_method === 'account' ? 'var(--color-accent)' : 'var(--color-bg-secondary)', padding: 8, borderRadius: 8, color: form.payment_method === 'account' ? 'white' : 'inherit' }}>
                                                <Wallet size={18} />
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>Conta</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`payment-method-card ${form.payment_method === 'card' ? 'active' : ''}`}
                                            onClick={() => setForm(prev => ({ ...prev, payment_method: 'card', card_id: prev.card_id || cards[0]?.id || '', account_id: '' }))}
                                        >
                                            <div style={{ background: form.payment_method === 'card' ? 'var(--color-accent)' : 'var(--color-bg-secondary)', padding: 8, borderRadius: 8, color: form.payment_method === 'card' ? 'white' : 'inherit' }}>
                                                <CreditCard size={18} />
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>Cartao</span>
                                        </button>
                                    </div>

                                    {form.payment_method === 'account' ? (
                                        <select className="input select" value={form.account_id} onChange={e => setForm(prev => ({ ...prev, account_id: e.target.value }))} required>
                                            <option value="">Selecione a conta</option>
                                            {accounts.map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <select className="input select" value={form.card_id} onChange={e => setForm(prev => ({ ...prev, card_id: e.target.value }))} required>
                                            <option value="">Selecione o cartao</option>
                                            {cards.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Observacoes</label>
                                    <textarea className="input" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={3} />
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))} />
                                    <span style={{ fontSize: 14, fontWeight: 600 }}>Manter ativa</span>
                                </label>
                            </div>
                            <div className="modal-footer-pro">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ borderRadius: 10 }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ borderRadius: 10, padding: '0 24px' }}>
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
