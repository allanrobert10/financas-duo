'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, getMonthName, getTodayDateInputValue } from '@/lib/utils'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart as RePieChart, Pie, Cell
} from 'recharts'
import { SkeletonPage, SkeletonList } from '@/components/Skeleton'
import { Plus, Pencil, Trash2, PieChart, X, TrendingUp, Wallet, CreditCard, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { Profile, Transaction, Category, Budget, Card } from '@/types/database'

const CHART_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6']

export default function DashboardPage() {
    const supabase = createClient()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'overview' | 'budgets'>('overview')
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [cards, setCards] = useState<Card[]>([])
    const [barPeriod, setBarPeriod] = useState<number | 'today'>(6)
    const [searchTermRecent, setSearchTermRecent] = useState('')

    // Budget specific states
    const [showBudgetModal, setShowBudgetModal] = useState(false)
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
    const [budgetForm, setBudgetForm] = useState({ category_id: '', amount: '' })
    const [savingBudget, setSavingBudget] = useState(false)

    const now = new Date()
    const todayDate = getTodayDateInputValue()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [showPeriodPicker, setShowPeriodPicker] = useState(false)
    const [pickerMonth, setPickerMonth] = useState(now.getMonth() + 1)
    const [pickerYear, setPickerYear] = useState(now.getFullYear())

    const currentYear = now.getFullYear()
    const minYear = Math.min(currentYear - 10, year - 5)
    const maxYear = Math.max(currentYear + 10, year + 5)
    const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)
    const isCurrentPeriod = month === now.getMonth() + 1 && year === now.getFullYear()

    useEffect(() => {
        loadData()
    }, [month, year])

    async function loadData() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [profileRes, catRes, budgetRes, cardRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('categories').select('*'),
            supabase.from('budgets').select('*').eq('month', month).eq('year', year),
            supabase.from('cards').select('*')
        ])

        if (profileRes.data) {
            setProfile(profileRes.data)

            // Fetch transactions ONLY for this household
            const { data: txData } = await supabase
                .from('transactions')
                .select('*')
                .eq('household_id', profileRes.data.household_id)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false, nullsFirst: false })

            if (txData) setTransactions(txData)
        }
        if (catRes.data) setCategories(catRes.data)
        if (budgetRes.data) setBudgets(budgetRes.data)
        if (cardRes.data) setCards(cardRes.data)
        setLoading(false)
    }

    // Bugdets Logic
    async function loadBudgets() {
        const { data } = await supabase.from('budgets').select('*').eq('month', month).eq('year', year)
        if (data) setBudgets(data)
    }

    function openCreateBudget() {
        setEditingBudget(null)
        setBudgetForm({ category_id: '', amount: '' })
        setShowBudgetModal(true)
    }

    function openEditBudget(b: Budget) {
        setEditingBudget(b)
        setBudgetForm({
            category_id: b.category_id,
            amount: b.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        })
        setShowBudgetModal(true)
    }

    async function handleSaveBudget(e: React.FormEvent) {
        e.preventDefault()
        setSavingBudget(true)

        const amountValue = typeof budgetForm.amount === 'string'
            ? parseFloat(budgetForm.amount.replace(/\./g, '').replace(',', '.'))
            : budgetForm.amount

        if (!profile?.household_id) {
            console.error('Perfil ou Household ID não encontrado')
            setSavingBudget(false)
            return
        }

        try {
            if (editingBudget) {
                // 1. Update existing and all future related budgets
                const { error } = await supabase
                    .from('budgets')
                    .update({ amount: amountValue || 0 })
                    .eq('household_id', profile.household_id)
                    .eq('category_id', budgetForm.category_id)
                    .or(`year.gt.${year},and(year.eq.${year},month.gte.${month})`)

                if (error) throw error
            } else {
                // 2. Creation logic: Create for current + 23 months (Total 24)
                // First, check what already exists to avoid 409 errors
                const { data: existing } = await supabase
                    .from('budgets')
                    .select('month, year')
                    .eq('household_id', profile.household_id)
                    .eq('category_id', budgetForm.category_id)

                const existingMap = new Set(existing?.map(e => `${e.year}-${e.month}`))

                const toInsert = []
                const toUpdate = []

                for (let i = 0; i < 24; i++) {
                    let m = month + i
                    let y = year
                    while (m > 12) {
                        m -= 12
                        y += 1
                    }

                    const key = `${y}-${m}`
                    const budgetData = {
                        category_id: budgetForm.category_id,
                        amount: amountValue || 0,
                        month: m,
                        year: y,
                        household_id: profile.household_id
                    }

                    if (existingMap.has(key)) {
                        toUpdate.push(budgetData)
                    } else {
                        toInsert.push(budgetData)
                    }
                }

                // Execute inserts
                if (toInsert.length > 0) {
                    const { error: insErr } = await supabase.from('budgets').insert(toInsert)
                    if (insErr) throw insErr
                }

                // Execute updates (unfortunately we must update individually or by month/year groups if we don't have IDs)
                if (toUpdate.length > 0) {
                    // Update all future ones for this category with the same amount
                    const { error: updErr } = await supabase
                        .from('budgets')
                        .update({ amount: amountValue || 0 })
                        .eq('household_id', profile.household_id)
                        .eq('category_id', budgetForm.category_id)
                        .or(`year.gt.${year},and(year.eq.${year},month.gte.${month})`)
                    if (updErr) throw updErr
                }
            }

            setShowBudgetModal(false)
            loadBudgets()
        } catch (error: any) {
            console.error('Erro ao salvar orçamento:', error)
            alert('Não foi possível salvar o orçamento. Verifique o console para mais detalhes.')
        } finally {
            setSavingBudget(false)
        }
    }

    async function handleDeleteBudget(id: string) {
        if (!confirm('Excluir este orçamento?')) return
        await supabase.from('budgets').delete().eq('id', id)
        loadBudgets()
    }

    function prevMonth() {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    function nextMonth() {
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }
    function togglePeriodPicker() {
        if (!showPeriodPicker) {
            setPickerMonth(month)
            setPickerYear(year)
        }
        setShowPeriodPicker(v => !v)
    }
    function applySelectedPeriod() {
        setMonth(pickerMonth)
        setYear(pickerYear)
        setShowPeriodPicker(false)
    }
    function goToCurrentMonth() {
        const today = new Date()
        setMonth(today.getMonth() + 1)
        setYear(today.getFullYear())
        setShowPeriodPicker(false)
    }

    // Current month transactions:
    // - Income always follows calendar month.
    // - Card expenses follow invoice cycle.
    // - Non-card expenses follow calendar month.
    const monthTx = transactions.filter(t => {
        const [tYear, tMonth] = t.date.split('-').map(Number)
        const isCalendarMonth = tMonth === month && tYear === year

        if (t.type === 'income') {
            return isCalendarMonth
        }

        if (t.type !== 'expense') {
            return isCalendarMonth
        }

        if (!t.card_id) {
            return isCalendarMonth
        }

        const card = cards.find(c => c.id === t.card_id)
        if (!card) {
            return isCalendarMonth
        }

        const closingDay = card.closing_day || 31
        const periodEnd = new Date(year, month - 1, closingDay)
        const periodStart = new Date(year, month - 2, closingDay + 1)
        const transactionDate = new Date(t.date + 'T00:00:00')
        return transactionDate >= periodStart && transactionDate <= periodEnd
    })
    const householdMonthTx = monthTx.filter(t => !t.is_third_party)
    const thirdPartyMonthTx = monthTx.filter(t => t.type === 'expense' && t.is_third_party)
    const thirdPartyPendingTx = thirdPartyMonthTx.filter(t => (t.third_party_status || 'pending') !== 'paid')
    const thirdPartyPaidTx = thirdPartyMonthTx.filter(t => (t.third_party_status || 'pending') === 'paid')

    const totalIncome = householdMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = householdMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const balance = totalIncome - totalExpense
    const thirdPartyPendingTotal = thirdPartyPendingTx.reduce((s, t) => s + Number(t.amount), 0)
    const thirdPartyPaidTotal = thirdPartyPaidTx.reduce((s, t) => s + Number(t.amount), 0)

    // Expenses by category for pie chart
    const expensesByCat = householdMonthTx
        .filter(t => t.type === 'expense' && t.category_id)
        .reduce((acc, t) => {
            const cat = categories.find(c => c.id === t.category_id)
            const name = cat?.name || 'Outros'
            acc[name] = (acc[name] || 0) + t.amount
            return acc
        }, {} as Record<string, number>)

    const pieData = Object.entries(expensesByCat)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value)

    // Dynamic periods bar chart
    const barData = barPeriod === 'today' ? [
        {
            name: 'Hoje',
            receitas: transactions.filter(t => t.type === 'income' && t.date === todayDate && !t.is_third_party).reduce((s, t) => s + t.amount, 0),
            despesas: transactions.filter(t => t.type === 'expense' && t.date === todayDate && !t.is_third_party).reduce((s, t) => s + t.amount, 0),
        }
    ] : Array.from({ length: barPeriod as number }, (_, i) => {
        let m = month - ((barPeriod as number) - 1 - i)
        let y = year

        while (m <= 0) {
            m += 12
            y -= 1
        }
        while (m > 12) {
            m -= 12
            y += 1
        }

        const mTx = transactions.filter(t => {
            const [tYear, tMonth] = t.date.split('-').map(Number)
            return tMonth === m && tYear === y && !t.is_third_party
        })

        return {
            name: getMonthName(m).substring(0, 3),
            receitas: mTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
            despesas: mTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
        }
    })

    const recentTx = transactions
        .filter(t => !t.is_third_party)
        .filter(t => t.description.toLowerCase().includes(searchTermRecent.toLowerCase()))
        .slice(0, 8)

    if (loading) {
        return <SkeletonPage />
    }

    return (
        <div className="fade-in">
            <div className="page-header-pro">
                <div className="title-group">
                    <h1>Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'} 👋</h1>
                    <p>Aqui está o resumo financeiro da sua família hoje.</p>
                </div>

                {/* Tabs & Date Navigation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ display: 'flex', background: 'var(--color-bg-tertiary)', padding: 4, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                        <button
                            className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setActiveTab('overview')}
                            style={{ borderRadius: 8, fontSize: 13, fontWeight: 700 }}
                        >
                            Visão Geral
                        </button>
                        <button
                            className={`btn btn-sm ${activeTab === 'budgets' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setActiveTab('budgets')}
                            style={{ borderRadius: 8, fontSize: 13, fontWeight: 700 }}
                        >
                            Orçamentos
                        </button>
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg-tertiary)', padding: '6px 6px', borderRadius: 14, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={prevMonth} style={{ borderRadius: 10 }}><ChevronLeft size={18} /></button>
                        <button
                            type="button"
                            onClick={togglePeriodPicker}
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontWeight: 700,
                                fontSize: 13,
                                minWidth: 140,
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
                            title="Selecionar mÃªs e ano"
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
                                        <label className="input-label" style={{ fontSize: 11, marginBottom: 6 }}>Mês</label>
                                        <select
                                            className="input select"
                                            value={pickerMonth}
                                            onChange={(e) => setPickerMonth(Number(e.target.value))}
                                        >
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                <option key={m} value={m}>{getMonthName(m)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="input-label" style={{ fontSize: 11, marginBottom: 6 }}>Ano</label>
                                        <select
                                            className="input select"
                                            value={pickerYear}
                                            onChange={(e) => setPickerYear(Number(e.target.value))}
                                        >
                                            {yearOptions.map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => setShowPeriodPicker(false)}
                                        style={{ borderRadius: 8 }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={applySelectedPeriod}
                                        style={{ borderRadius: 8 }}
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {activeTab === 'budgets' && (
                        <button className="btn-nova-tx" onClick={openCreateBudget}><Plus size={20} /> Novo Orçamento</button>
                    )}
                </div>
            </div>

            {activeTab === 'overview' ? (
                <>

                    {/* Stats */}
                    <div className="stats-grid stagger-container">
                        <div className="stat-card stagger-item">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 10 }}>
                                    <Wallet size={20} style={{ color: 'var(--color-accent)' }} />
                                </div>
                                <div className="stat-card-label" style={{ margin: 0 }}>Saldo do Mês</div>
                            </div>
                            <div className="stat-card-value" style={{ color: balance >= 0 ? 'var(--color-text-primary)' : 'var(--color-danger)', fontSize: 24, fontWeight: 800 }}>
                                {formatCurrency(balance)}
                            </div>
                        </div>

                        <div className="stat-card stagger-item">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 10 }}>
                                    <ArrowUpRight size={20} style={{ color: 'var(--color-income)' }} />
                                </div>
                                <div className="stat-card-label" style={{ margin: 0 }}>Receitas</div>
                            </div>
                            <div className="stat-card-value" style={{ color: 'var(--color-income)', fontSize: 24, fontWeight: 800 }}>
                                {formatCurrency(totalIncome)}
                            </div>
                        </div>

                        <div className="stat-card stagger-item">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 10 }}>
                                    <ArrowDownRight size={20} style={{ color: 'var(--color-expense)' }} />
                                </div>
                                <div className="stat-card-label" style={{ margin: 0 }}>Despesas</div>
                            </div>
                            <div className="stat-card-value" style={{ color: 'var(--color-expense)', fontSize: 24, fontWeight: 800 }}>
                                {formatCurrency(totalExpense)}
                            </div>
                        </div>

                        <div className="stat-card stagger-item">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 8, borderRadius: 10 }}>
                                    <CreditCard size={20} style={{ color: 'var(--color-gold)' }} />
                                </div>
                                <div className="stat-card-label" style={{ margin: 0 }}>Transações</div>
                            </div>
                            <div className="stat-card-value" style={{ fontSize: 24, fontWeight: 800 }}>{householdMonthTx.length}</div>
                        </div>

                        <Link
                            href={`/transactions?view=third-party&thirdParty=all&month=${month}&year=${year}`}
                            className="stat-card stagger-item"
                            style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ background: 'rgba(245, 158, 11, 0.12)', padding: 8, borderRadius: 10 }}>
                                    <ArrowUpRight size={20} style={{ color: '#D97706' }} />
                                </div>
                                <div className="stat-card-label" style={{ margin: 0 }}>Terceiros pendentes</div>
                            </div>
                            <div className="stat-card-value" style={{ color: thirdPartyPendingTotal > 0 ? '#B45309' : 'var(--color-text-primary)', fontSize: 24, fontWeight: 800 }}>
                                {formatCurrency(thirdPartyPendingTotal)}
                            </div>
                            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                                {thirdPartyPendingTx.length} pendente(s) | {thirdPartyPaidTx.length} pago(s)
                            </div>
                            <div style={{ marginTop: 2, fontSize: 11, color: 'var(--color-text-muted)' }}>
                                Recebido no periodo: {formatCurrency(thirdPartyPaidTotal)}
                            </div>
                        </Link>
                    </div>

                    {/* Charts */}
                    <div className="charts-grid stagger-container">
                        <div className="chart-card stagger-item">
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div>
                                    <div className="chart-card-title">Receitas vs Despesas</div>
                                    <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Visão consolidada comparando os meses</p>
                                </div>
                                <div style={{ display: 'flex', background: 'var(--color-bg-tertiary)', padding: 4, borderRadius: 10, gap: 4 }}>
                                    {['today', 1, 3, 6, 12].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setBarPeriod(p as any)}
                                            style={{
                                                border: 'none',
                                                background: barPeriod === p ? 'var(--color-bg-secondary)' : 'transparent',
                                                color: barPeriod === p ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                                                padding: '4px 10px',
                                                borderRadius: 7,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                boxShadow: barPeriod === p ? 'var(--shadow-sm)' : 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {p === 'today' ? 'Hoje' : `${p}M`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tick={{ fill: 'var(--color-text-tertiary)', fontWeight: 500 }} axisLine={{ stroke: 'var(--color-text-muted)', opacity: 0.9 }} tickLine={{ stroke: 'var(--color-text-muted)', opacity: 0.9 }} dy={10} />
                                    <YAxis stroke="var(--color-text-muted)" fontSize={11} tick={{ fill: 'var(--color-text-tertiary)', fontWeight: 500 }} axisLine={{ stroke: 'var(--color-text-muted)', opacity: 0.9 }} tickLine={{ stroke: 'var(--color-text-muted)', opacity: 0.9 }} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(16, 185, 129, 0.04)' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="modal-content-pro" style={{ padding: '12px 16px', boxShadow: 'var(--shadow-lg)' }}>
                                                        <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{payload[0].payload.name}</p>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                                                                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Receitas:</span>
                                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-income)' }}>{formatCurrency(Number(payload[0].value))}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                                                                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Despesas:</span>
                                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-expense)' }}>{formatCurrency(Number(payload[1].value))}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            return null
                                        }}
                                    />
                                    <Bar dataKey="receitas" fill="var(--color-income)" radius={[6, 6, 0, 0]} barSize={24} />
                                    <Bar dataKey="despesas" fill="var(--color-expense)" radius={[6, 6, 0, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="chart-card stagger-item">
                            <div className="chart-card-title">Onde você gasta mais</div>
                            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 24 }}>Categorias com maiores despesas este mês</p>
                            {pieData.length > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                    <div style={{ flex: 1, minWidth: 0, height: 200 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%" cy="50%"
                                                    innerRadius={60} outerRadius={85}
                                                    paddingAngle={4}
                                                    dataKey="value"
                                                    animationBegin={0}
                                                    animationDuration={1200}
                                                >
                                                    {pieData.map((_, i) => (
                                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="modal-content-pro" style={{ padding: '8px 12px', boxShadow: 'var(--shadow-md)', border: `1px solid ${payload[0].payload.fill}` }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: payload[0].payload.fill }} />
                                                                        <span style={{ fontWeight: 700, fontSize: 12 }}>{payload[0].name}</span>
                                                                        <span style={{ fontSize: 12, fontWeight: 800 }}>{formatCurrency(Number(payload[0].value))}</span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    }}
                                                />
                                            </RePieChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Legend Pro - Vertical Side List */}
                                    <div style={{ flex: '0 1 200px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {pieData.slice(0, 5).map((d, i) => (
                                            <div key={d.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 130, flexShrink: 0 }}>
                                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-accent)', flexShrink: 0 }}>{Math.round((d.value / totalExpense) * 100)}%</span>
                                                </div>
                                                <div style={{ marginLeft: 18, fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>
                                                    {formatCurrency(d.value)}
                                                </div>
                                                {i < Math.min(pieData.length, 5) - 1 && (
                                                    <div style={{ height: 1, background: 'var(--color-border)', opacity: 0.3, marginTop: 4 }} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state" style={{ height: 200 }}>
                                    <div style={{ background: 'var(--color-bg-tertiary)', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                        <TrendingUp style={{ color: 'var(--color-text-tertiary)', opacity: 0.5 }} />
                                    </div>
                                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nenhum gasto registrado</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Transactions */}
                    <div className="chart-card stagger-item" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '24px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div className="chart-card-title">Transações Recentes</div>
                                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Últimas movimentações da sua conta</p>
                            </div>
                            <div style={{ position: 'relative', width: 280 }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchTermRecent}
                                    onChange={(e) => setSearchTermRecent(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px 8px 32px',
                                        borderRadius: 10,
                                        background: 'var(--color-bg-tertiary)',
                                        border: '1px solid var(--color-border)',
                                        fontSize: 13,
                                        color: 'var(--color-text-primary)'
                                    }}
                                />
                            </div>
                        </div>
                        {recentTx.length > 0 ? (
                            <table className="data-table" style={{ marginTop: 12 }}>
                                <thead className="pro-table-header">
                                    <tr>
                                        <th>Data</th>
                                        <th>Descrição</th>
                                        <th>Categoria</th>
                                        <th>Tipo</th>
                                        <th style={{ textAlign: 'right' }}>Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTx.map(tx => {
                                        const cat = categories.find(c => c.id === tx.category_id)
                                        return (
                                            <tr key={tx.id} className="table-row-hover">
                                                <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{formatDate(tx.date)}</td>
                                                <td>
                                                    <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: 14 }}>{tx.description}</div>
                                                </td>
                                                <td>
                                                    {cat && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ background: (cat.color || '#64748B') + '15', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <span className="color-dot" style={{ background: cat.color || '#64748B', width: 8, height: 8 }} />
                                                                <span style={{ fontSize: 11, fontWeight: 700, color: (cat.color || '#64748B') }}>{cat.name}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${tx.type}`} style={{ borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                                                        {tx.type === 'income' ? 'Receita' : 'Despesa'}
                                                    </span>
                                                </td>
                                                <td style={{
                                                    textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: 15,
                                                    color: tx.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)'
                                                }}>
                                                    {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state" style={{ padding: '60px 0' }}>
                                <div style={{ background: 'var(--color-bg-tertiary)', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <TrendingUp size={24} style={{ color: 'var(--color-text-tertiary)', opacity: 0.5 }} />
                                </div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Tudo pronto para começar!</h3>
                                <p style={{ color: 'var(--color-text-tertiary)', maxWidth: 300, margin: '0 auto' }}>Suas transações recentes aparecerão aqui assim que você começar a registrar sua vida financeira.</p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="fade-in">
                    {/* Budgets View Content */}
                    {(() => {
                        // Calculate specific spending for budgets tab
                        const budgetSpending: Record<string, number> = {}
                        householdMonthTx.filter(t => t.type === 'expense' && t.category_id).forEach(tx => {
                            budgetSpending[tx.category_id!] = (budgetSpending[tx.category_id!] || 0) + tx.amount
                        })

                        const totalBudgeted = budgets.reduce((acc, b) => acc + b.amount, 0)
                        const totalSpent = Object.values(budgetSpending).reduce((acc, s) => acc + s, 0)
                        const remaining = Math.max(totalBudgeted - totalSpent, 0)
                        const overBudgetCount = budgets.filter(b => (budgetSpending[b.category_id] || 0) > b.amount).length
                        const globalPct = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0

                        return (
                            <>
                                {/* Stats Dashboard */}
                                <div className="stats-grid stagger-container" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 32 }}>
                                    <div className="stat-card stagger-item">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <div style={{ background: 'var(--color-accent-glow)', padding: 8, borderRadius: 10 }}>
                                                <PieChart size={20} style={{ color: 'var(--color-accent)' }} />
                                            </div>
                                            <div className="stat-card-label" style={{ margin: 0 }}>Total Orçado</div>
                                        </div>
                                        <div className="stat-card-value" style={{ fontSize: 24, fontWeight: 800 }}>{formatCurrency(totalBudgeted)}</div>
                                    </div>

                                    <div className="stat-card stagger-item">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 10 }}>
                                                <ArrowDownRight size={20} style={{ color: 'var(--color-expense)' }} />
                                            </div>
                                            <div className="stat-card-label" style={{ margin: 0 }}>Gasto Real</div>
                                        </div>
                                        <div className="stat-card-value" style={{ color: totalSpent > totalBudgeted ? 'var(--color-danger)' : 'var(--color-text-primary)', fontSize: 24, fontWeight: 800 }}>
                                            {formatCurrency(totalSpent)}
                                        </div>
                                    </div>

                                    <div className="stat-card stagger-item">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <div style={{ background: 'var(--color-accent-glow)', padding: 8, borderRadius: 10 }}>
                                                <TrendingUp size={20} style={{ color: 'var(--color-accent)' }} />
                                            </div>
                                            <div className="stat-card-label" style={{ margin: 0 }}>Restante</div>
                                        </div>
                                        <div className="stat-card-value" style={{ color: 'var(--color-accent)', fontSize: 24, fontWeight: 800 }}>{formatCurrency(remaining)}</div>
                                    </div>

                                    <div className="stat-card stagger-item">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <div style={{ background: overBudgetCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-accent-glow)', padding: 8, borderRadius: 10 }}>
                                                <ArrowUpRight size={20} style={{ color: overBudgetCount > 0 ? 'var(--color-danger)' : 'var(--color-accent)' }} />
                                            </div>
                                            <div className="stat-card-label" style={{ margin: 0 }}>Alertas</div>
                                        </div>
                                        <div className="stat-card-value" style={{ color: overBudgetCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)', fontSize: 24, fontWeight: 800 }}>
                                            {overBudgetCount} {overBudgetCount === 1 ? 'Excedido' : 'Excedidos'}
                                        </div>
                                    </div>
                                </div>

                                {/* Global Progress Bar */}
                                {totalBudgeted > 0 && (
                                    <div className="chart-card stagger-item" style={{ marginBottom: 32, padding: '20px 24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Progresso Geral do Orçamento</span>
                                            <span style={{ fontSize: 13, fontWeight: 800, color: globalPct > 90 ? 'var(--color-danger)' : 'var(--color-accent)' }}>{Math.round(globalPct)}%</span>
                                        </div>
                                        <div className="progress-bar" style={{ height: 10 }}>
                                            <div className="progress-fill" style={{
                                                width: `${globalPct}%`,
                                                background: globalPct > 90 ? 'var(--color-danger)' : 'var(--color-accent)',
                                                boxShadow: `0 0 10px ${globalPct > 90 ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-accent-glow)'}`
                                            }} />
                                        </div>
                                    </div>
                                )}

                                {budgets.length > 0 ? (
                                    <div className="stagger-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                                        {budgets.map(budget => {
                                            const cat = categories.find(c => c.id === budget.category_id)
                                            const spent = budgetSpending[budget.category_id] || 0
                                            const pct = Math.min((spent / budget.amount) * 100, 100)
                                            const overBudget = spent > budget.amount
                                            return (
                                                <div key={budget.id} className="budget-card stagger-item">
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <div style={{ background: (cat?.color || '#64748B') + '20', padding: 8, borderRadius: 10 }}>
                                                                <span className="color-dot" style={{ background: cat?.color || '#64748B', width: 12, height: 12, border: '2px solid white' }} />
                                                            </div>
                                                            <span style={{ fontWeight: 700, fontSize: 16 }}>{cat?.name || 'Categoria'}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <button className="btn btn-icon btn-ghost btn-sm" onClick={() => openEditBudget(budget)} style={{ borderRadius: 8 }}><Pencil size={15} /></button>
                                                            <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDeleteBudget(budget.id)}
                                                                style={{ color: 'var(--color-danger)', borderRadius: 8 }}><Trash2 size={15} /></button>
                                                        </div>
                                                    </div>

                                                    <div className="budget-progress-container">
                                                        <div className="budget-progress-fill"
                                                            style={{
                                                                width: `${pct}%`,
                                                                background: overBudget ? 'var(--color-danger)' : pct > 80 ? 'var(--color-gold)' : 'var(--color-accent)',
                                                                boxShadow: `0 0 10px ${overBudget ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                                                            }}
                                                        />
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                                        <div>
                                                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 2 }}>Gasto</div>
                                                            <div style={{ fontSize: 18, fontWeight: 800, color: overBudget ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                                                                {formatCurrency(spent)}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 2 }}>Limite</div>
                                                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                                                                {formatCurrency(budget.amount)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {overBudget && (
                                                        <div style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            ⚠️ Atenção: Limite excedido em {formatCurrency(spent - budget.amount)}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="glass-card empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
                                        <div style={{ background: 'var(--color-bg-tertiary)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                            <PieChart size={32} style={{ color: 'var(--color-accent)' }} />
                                        </div>
                                        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Nenhum orçamento definido</h3>
                                        <p style={{ color: 'var(--color-text-tertiary)', maxWidth: 300, margin: '0 auto' }}>
                                            Defina limites mensais para cada categoria e mantenha suas finanças sob controle.
                                        </p>
                                        <button className="btn btn-primary" onClick={openCreateBudget} style={{ marginTop: 24, padding: '10px 24px', borderRadius: 10 }}>Clique aqui para começar</button>
                                    </div>
                                )}
                            </>
                        )
                    })()}
                </div>
            )}

            {/* Budget Modal */}
            {showBudgetModal && (
                <div className="modal-overlay" onClick={() => setShowBudgetModal(false)}>
                    <div className="modal-content-pro" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
                        <div className="modal-header-pro">
                            <h2>{editingBudget ? 'Editar' : 'Novo'} Orçamento</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowBudgetModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveBudget}>
                            <div className="modal-body-pro">
                                <div className="input-group">
                                    <label className="input-label">Categoria</label>
                                    <select className="input select" value={budgetForm.category_id}
                                        onChange={e => setBudgetForm(f => ({ ...f, category_id: e.target.value }))} required>
                                        <option value="">Selecione...</option>
                                        {categories
                                            .filter(c => c.type === 'expense' && (editingBudget || !budgets.some(b => b.category_id === c.id)))
                                            .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                                        Apenas categorias de despesa sem orçamento ainda.
                                    </p>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Limite mensal (R$)</label>
                                    <input
                                        className="input"
                                        value={budgetForm.amount}
                                        onChange={(e) => {
                                            let value = e.target.value.replace(/\D/g, "")
                                            const amount = (Number(value) / 100).toLocaleString("pt-BR", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })
                                            setBudgetForm((f) => ({ ...f, amount }))
                                        }}
                                        placeholder="0,00"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer-pro">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowBudgetModal(false)} style={{ borderRadius: 10 }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={savingBudget} style={{ background: 'var(--color-accent)', border: 'none', borderRadius: 10, padding: '0 24px' }}>
                                    {savingBudget ? 'Salvando...' : editingBudget ? 'Salvar' : 'Criar Orçamento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
