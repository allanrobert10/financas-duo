'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, getMonthName } from '@/lib/utils'
import type { Profile, Transaction, Category } from '@/types/database'
import {
    TrendingUp, Wallet, CreditCard, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts'
import { SkeletonPage } from '@/components/Skeleton'

const CHART_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6']

export default function DashboardPage() {
    const supabase = createClient()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [profileRes, txRes, catRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('transactions').select('*').order('date', { ascending: false }),
            supabase.from('categories').select('*'),
        ])

        if (profileRes.data) setProfile(profileRes.data)
        if (txRes.data) setTransactions(txRes.data)
        if (catRes.data) setCategories(catRes.data)
        setLoading(false)
    }

    // Current month transactions
    const monthTx = transactions.filter(t => {
        const d = new Date(t.date)
        return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear
    })

    const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const balance = totalIncome - totalExpense

    // Expenses by category for pie chart
    const expensesByCat = monthTx
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

    // Last 6 months bar chart
    const barData = Array.from({ length: 6 }, (_, i) => {
        const m = new Date(currentYear, currentMonth - 1 - (5 - i), 1)
        const month = m.getMonth() + 1
        const year = m.getFullYear()
        const mTx = transactions.filter(t => {
            const d = new Date(t.date)
            return d.getMonth() + 1 === month && d.getFullYear() === year
        })
        return {
            name: getMonthName(month).substring(0, 3),
            receitas: mTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
            despesas: mTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        }
    })

    // Recent transactions
    const recentTx = transactions.slice(0, 8)

    if (loading) {
        return <SkeletonPage />
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'} 👋
                    </h1>
                    <p className="page-subtitle">
                        {getMonthName(currentMonth)} de {currentYear} — Resumo financeiro do casal
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-grid stagger-container">
                <div className="stat-card stagger-item" style={{ '--card-accent': 'var(--color-accent)' } as React.CSSProperties}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="stat-card-label">Saldo do Mês</div>
                        <Wallet size={20} style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
                    </div>
                    <div className="stat-card-value" style={{ color: balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatCurrency(balance)}
                    </div>
                </div>

                <div className="stat-card stagger-item" style={{ '--card-accent': 'var(--color-income)' } as React.CSSProperties}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="stat-card-label">Receitas</div>
                        <ArrowUpRight size={20} style={{ color: 'var(--color-income)', opacity: 0.6 }} />
                    </div>
                    <div className="stat-card-value" style={{ color: 'var(--color-income)' }}>
                        {formatCurrency(totalIncome)}
                    </div>
                </div>

                <div className="stat-card stagger-item" style={{ '--card-accent': 'var(--color-expense)' } as React.CSSProperties}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="stat-card-label">Despesas</div>
                        <ArrowDownRight size={20} style={{ color: 'var(--color-expense)', opacity: 0.6 }} />
                    </div>
                    <div className="stat-card-value" style={{ color: 'var(--color-expense)' }}>
                        {formatCurrency(totalExpense)}
                    </div>
                </div>

                <div className="stat-card stagger-item" style={{ '--card-accent': 'var(--color-gold)' } as React.CSSProperties}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="stat-card-label">Transações</div>
                        <CreditCard size={20} style={{ color: 'var(--color-gold)', opacity: 0.6 }} />
                    </div>
                    <div className="stat-card-value">{monthTx.length}</div>
                </div>
            </div>

            {/* Charts */}
            <div className="charts-grid stagger-container">
                <div className="chart-card stagger-item">
                    <div className="chart-card-title">Receitas vs Despesas — Últimos 6 meses</div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={barData}>
                            <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} />
                            <YAxis stroke="var(--color-text-muted)" fontSize={12} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--color-bg-secondary)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 10,
                                    color: 'var(--color-text-primary)',
                                    fontSize: 13,
                                }}
                                formatter={(v) => formatCurrency(Number(v))}
                            />
                            <Bar dataKey="receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card stagger-item">
                    <div className="chart-card-title">Despesas por Categoria</div>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%" cy="50%"
                                    innerRadius={60} outerRadius={100}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--color-bg-secondary)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 10,
                                        color: 'var(--color-text-primary)',
                                        fontSize: 13,
                                    }}
                                    formatter={(v) => formatCurrency(Number(v))}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state">
                            <p>Sem despesas este mês</p>
                        </div>
                    )}
                    {/* Legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {pieData.map((d, i) => (
                            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                <span className="color-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                {d.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="chart-card fade-in">
                <div className="chart-card-title">Últimas Transações</div>
                {recentTx.length > 0 ? (
                    <table className="data-table">
                        <thead>
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
                                    <tr key={tx.id}>
                                        <td>{new Date(tx.date).toLocaleDateString('pt-BR')}</td>
                                        <td style={{ color: 'var(--color-text-primary)' }}>{tx.description}</td>
                                        <td>
                                            {cat && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className="color-dot" style={{ background: cat.color || '#64748B' }} />
                                                    {cat.name}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge badge-${tx.type}`}>
                                                {tx.type === 'income' ? 'Receita' : tx.type === 'expense' ? 'Despesa' : 'Transfer.'}
                                            </span>
                                        </td>
                                        <td style={{
                                            textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-display)',
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
                    <div className="empty-state">
                        <TrendingUp />
                        <h3>Sem transações ainda</h3>
                        <p>Adicione sua primeira transação para ver o dashboard ganhar vida!</p>
                    </div>
                )}
            </div>
        </div>
    )
}
