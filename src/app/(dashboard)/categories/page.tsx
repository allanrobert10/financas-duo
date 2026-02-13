'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types/database'
import { Plus, Pencil, Trash2, FolderOpen, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { SkeletonCards } from '@/components/Skeleton'

const ICON_OPTIONS = [
    'utensils', 'car', 'home', 'heart', 'book', 'gamepad', 'coffee',
    'shirt', 'repeat', 'briefcase', 'laptop', 'trending-up', 'gift',
    'shopping-cart', 'music', 'film', 'tool', 'phone', 'plane', 'more-horizontal',
]

const COLOR_OPTIONS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4',
    '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#64748B',
    '#F97316', '#84CC16', '#A855F7', '#0EA5E9', '#E11D48',
]

export default function CategoriesPage() {
    const supabase = createClient()
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Category | null>(null)
    const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all')
    const [saving, setSaving] = useState(false)

    // Form state
    const [name, setName] = useState('')
    const [icon, setIcon] = useState('tag')
    const [color, setColor] = useState('#10B981')
    const [type, setType] = useState<'expense' | 'income'>('expense')

    useEffect(() => { loadCategories() }, [])

    async function loadCategories() {
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('type', { ascending: true })
            .order('name', { ascending: true })
        if (data) setCategories(data)
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        setName('')
        setIcon('tag')
        setColor('#10B981')
        setType('expense')
        setShowModal(true)
    }

    function openEdit(cat: Category) {
        setEditing(cat)
        setName(cat.name)
        setIcon(cat.icon || 'tag')
        setColor(cat.color || '#10B981')
        setType(cat.type as 'expense' | 'income')
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaving(false); return }
        const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
        if (!profile?.household_id) { setSaving(false); return }

        if (editing) {
            await supabase.from('categories').update({ name, icon, color, type }).eq('id', editing.id)
        } else {
            await supabase.from('categories').insert({ name, icon, color, type, household_id: profile.household_id })
        }

        setSaving(false)
        setShowModal(false)
        loadCategories()
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza? Transações vinculadas perderão essa categoria.')) return
        await supabase.from('categories').delete().eq('id', id)
        loadCategories()
    }

    const filtered = filterType === 'all'
        ? categories
        : categories.filter(c => c.type === filterType)

    const expenseCategories = filtered.filter(c => c.type === 'expense')
    const incomeCategories = filtered.filter(c => c.type === 'income')

    if (loading) {
        return (
            <div className="fade-in">
                <div style={{ marginBottom: 'var(--space-8)' }}>
                    <div className="skeleton skeleton-heading" style={{ width: '25%' }} />
                    <div className="skeleton skeleton-text sm" style={{ width: '35%' }} />
                </div>
                <SkeletonCards count={6} />
            </div>
        )
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Categorias</h1>
                    <p className="page-subtitle">Organize receitas e despesas por categorias</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                        className="input"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as 'all' | 'expense' | 'income')}
                        style={{ width: 'auto' }}
                    >
                        <option value="all">Todas</option>
                        <option value="expense">Despesas</option>
                        <option value="income">Receitas</option>
                    </select>
                    <button className="btn btn-primary" onClick={openCreate}>
                        <Plus size={16} /> Nova Categoria
                    </button>
                </div>
            </div>

            {/* Expense Categories */}
            {(filterType === 'all' || filterType === 'expense') && (
                <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <ArrowDownRight size={18} style={{ color: 'var(--color-expense)' }} />
                        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
                            Despesas
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 8 }}>
                                {expenseCategories.length} categorias
                            </span>
                        </h2>
                    </div>
                    {expenseCategories.length > 0 ? (
                        <div className="grid-3 stagger-container">
                            {expenseCategories.map(cat => (
                                <CategoryCard key={cat.id} cat={cat} onEdit={openEdit} onDelete={handleDelete} />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: 24 }}>
                            <p>Nenhuma categoria de despesa</p>
                        </div>
                    )}
                </div>
            )}

            {/* Income Categories */}
            {(filterType === 'all' || filterType === 'income') && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <ArrowUpRight size={18} style={{ color: 'var(--color-income)' }} />
                        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
                            Receitas
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 8 }}>
                                {incomeCategories.length} categorias
                            </span>
                        </h2>
                    </div>
                    {incomeCategories.length > 0 ? (
                        <div className="grid-3 stagger-container">
                            {incomeCategories.map(cat => (
                                <CategoryCard key={cat.id} cat={cat} onEdit={openEdit} onDelete={handleDelete} />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: 24 }}>
                            <p>Nenhuma categoria de receita</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">{editing ? 'Editar Categoria' : 'Nova Categoria'}</h2>
                        <form onSubmit={handleSave}>
                            <div className="input-group">
                                <label className="input-label">Nome</label>
                                <input className="input" value={name} onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Alimentação" required />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Tipo</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button"
                                        className={`btn ${type === 'expense' ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => setType('expense')}
                                        style={{ flex: 1 }}>
                                        Despesa
                                    </button>
                                    <button type="button"
                                        className={`btn ${type === 'income' ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => setType('income')}
                                        style={{ flex: 1 }}>
                                        Receita
                                    </button>
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Ícone</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {ICON_OPTIONS.map(ic => (
                                        <button key={ic} type="button"
                                            onClick={() => setIcon(ic)}
                                            style={{
                                                padding: '6px 10px', fontSize: 11, borderRadius: 'var(--radius-md)',
                                                border: icon === ic ? `2px solid ${color}` : '1px solid var(--color-border)',
                                                background: icon === ic ? `${color}20` : 'transparent',
                                                color: 'var(--color-text-primary)', cursor: 'pointer',
                                            }}>
                                            {ic}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Cor</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {COLOR_OPTIONS.map(c => (
                                        <button key={c} type="button" onClick={() => setColor(c)}
                                            style={{
                                                width: 28, height: 28, borderRadius: '50%', background: c,
                                                border: color === c ? '3px solid white' : '2px solid transparent',
                                                cursor: 'pointer', boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            <div style={{
                                marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)',
                                background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                                display: 'flex', alignItems: 'center', gap: 10,
                            }}>
                                <span className="color-dot" style={{ background: color, width: 10, height: 10 }} />
                                <span style={{ fontWeight: 500 }}>{name || 'Preview'}</span>
                                <span className="badge" style={{
                                    marginLeft: 'auto',
                                    background: type === 'income' ? 'var(--color-income-bg)' : 'var(--color-expense-bg)',
                                    color: type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                                }}>
                                    {type === 'income' ? 'Receita' : 'Despesa'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}
                                    style={{ flex: 1 }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
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

function CategoryCard({ cat, onEdit, onDelete }: {
    cat: Category
    onEdit: (c: Category) => void
    onDelete: (id: string) => void
}) {
    return (
        <div className="glass-card card-hover-lift stagger-item" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md)',
                    background: `${cat.color}20`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${cat.color}40`,
                }}>
                    <FolderOpen size={18} style={{ color: cat.color || '#64748B' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{cat.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{cat.icon}</div>
                </div>
                <span className="badge" style={{
                    background: cat.type === 'income' ? 'var(--color-income-bg)' : 'var(--color-expense-bg)',
                    color: cat.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                    fontSize: 10,
                }}>
                    {cat.type === 'income' ? 'Receita' : 'Despesa'}
                </span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(cat)}>
                    <Pencil size={14} /> Editar
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(cat.id)}
                    style={{ color: 'var(--color-danger)' }}>
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    )
}
