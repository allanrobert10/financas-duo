'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, getMonthName } from '@/lib/utils'
import type { Budget, Category } from '@/types/database'
import { Plus, Pencil, Trash2, PieChart, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { SkeletonList } from '@/components/Skeleton'

export default function BudgetsPage() {
    const supabase = createClient()
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Budget | null>(null)
    const [householdId, setHouseholdId] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())

    const [form, setForm] = useState({ category_id: '', amount: '' })

    // Spending map for current month
    const [spending, setSpending] = useState<Record<string, number>>({})

    useEffect(() => { loadAll() }, [month, year])

    async function loadAll() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
        if (profile?.household_id) setHouseholdId(profile.household_id)

        const [budgetR, catR, txR] = await Promise.all([
            supabase.from('budgets').select('*').eq('month', month).eq('year', year),
            supabase.from('categories').select('*').eq('type', 'expense'),
            supabase.from('transactions').select('amount, category_id, date, type').eq('type', 'expense'),
        ])

        if (budgetR.data) setBudgets(budgetR.data)
        if (catR.data) setCategories(catR.data)

        // Calculate spending per category for current month/year
        const sp: Record<string, number> = {}
        txR.data?.forEach(tx => {
            const d = new Date(tx.date)
            if (d.getMonth() + 1 === month && d.getFullYear() === year && tx.category_id) {
                sp[tx.category_id] = (sp[tx.category_id] || 0) + tx.amount
            }
        })
        setSpending(sp)
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        setForm({ category_id: '', amount: '' })
        setShowModal(true)
    }

    function openEdit(b: Budget) {
        setEditing(b)
        setForm({ category_id: b.category_id, amount: String(b.amount) })
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const payload = {
            category_id: form.category_id, amount: parseFloat(form.amount),
            month, year, household_id: householdId,
        }
        if (editing) {
            await supabase.from('budgets').update(payload).eq('id', editing.id)
        } else {
            await supabase.from('budgets').insert(payload)
        }
        setSaving(false)
        setShowModal(false)
        loadAll()
    }

    async function handleDelete(id: string) {
        if (!confirm('Excluir este orçamento?')) return
        await supabase.from('budgets').delete().eq('id', id)
        loadAll()
    }

    function prevMonth() {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    function nextMonth() {
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }

    const usedCategoryIds = budgets.map(b => b.category_id)
    const availableCategories = editing
        ? categories
        : categories.filter(c => !usedCategoryIds.includes(c.id))

    if (loading) {
        return (
            <div className="fade-in">
                <div style={{ marginBottom: 'var(--space-8)' }}>
                    <div className="skeleton skeleton-heading" style={{ width: '25%' }} />
                    <div className="skeleton skeleton-text sm" style={{ width: '35%' }} />
                </div>
                <SkeletonList count={4} />
            </div>
        )
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Orçamentos</h1>
                    <p className="page-subtitle">Defina limites de gastos por categoria</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Novo Orçamento</button>
            </div>

            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
                <button className="btn btn-icon btn-ghost" onClick={prevMonth}><ChevronLeft size={18} /></button>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-lg)' }}>
                    {getMonthName(month)} {year}
                </span>
                <button className="btn btn-icon btn-ghost" onClick={nextMonth}><ChevronRight size={18} /></button>
            </div>

            {budgets.length > 0 ? (
                <div className="stagger-container" style={{ display: 'grid', gap: 16 }}>
                    {budgets.map(budget => {
                        const cat = categories.find(c => c.id === budget.category_id)
                        const spent = spending[budget.category_id] || 0
                        const pct = Math.min((spent / budget.amount) * 100, 100)
                        const overBudget = spent > budget.amount
                        return (
                            <div key={budget.id} className="glass-card stagger-item">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span className="color-dot" style={{ background: cat?.color || '#64748B', width: 14, height: 14 }} />
                                        <span style={{ fontWeight: 600 }}>{cat?.name || 'Categoria'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {overBudget && (
                                            <span className="badge badge-danger">Acima do limite!</span>
                                        )}
                                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => openEdit(budget)}><Pencil size={14} /></button>
                                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDelete(budget.id)}
                                            style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress-bar-fill progress-fill-animated"
                                        style={{
                                            width: `${pct}%`,
                                            background: overBudget ? 'var(--color-danger)' : pct > 80 ? 'var(--color-gold)' : 'var(--color-accent)',
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 'var(--text-sm)' }}>
                                    <span style={{ color: overBudget ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                        Gasto: {formatCurrency(spent)}
                                    </span>
                                    <span style={{ color: 'var(--color-text-muted)' }}>
                                        Limite: {formatCurrency(budget.amount)}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="glass-card empty-state">
                    <PieChart />
                    <h3>Nenhum orçamento definido</h3>
                    <p>Defina limites mensais — ex: Restaurantes R$500/mês</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h2>{editing ? 'Editar' : 'Novo'} Orçamento</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Categoria</label>
                                    <select className="input select" value={form.category_id}
                                        onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} required>
                                        <option value="">Selecione...</option>
                                        {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Limite mensal (R$)</label>
                                    <input className="input" type="number" step="0.01" min="1" value={form.amount}
                                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="500.00" />
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
