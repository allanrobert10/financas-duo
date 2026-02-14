'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types/database'
import { Plus, Pencil, Trash2, FolderOpen, ArrowUpRight, ArrowDownRight, FileUp, Download, CheckSquare, Square } from 'lucide-react'
import { SkeletonCards } from '@/components/Skeleton'
import { generateCategoryTemplate, parseCategoryImport } from '@/utils/excel'

const ICON_OPTIONS = [
    'utensils', 'car', 'home', 'heart', 'book', 'gamepad', 'coffee',
    'shirt', 'repeat', 'briefcase', 'laptop', 'trending-up', 'gift',
    'shopping-cart', 'music', 'film', 'tool', 'phone', 'plane', 'more-horizontal',
]

const COLOR_OPTIONS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4',
    '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#64748B',
    '#F97316', '#84CC16', '#A855F7', '#0EA5E9', '#E11D48',
    '#000000', '#1A1A1A', '#D4AF37', '#A1A1AA', '#581C87',
    '#064E3B', '#1E3A8A', '#7F1D1D', '#431407'
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

    // Selection & Import state
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isBulkDeleting, setIsBulkDeleting] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

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

    function toggleSelect(id: string) {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    function toggleSelectAll(filteredItems: Category[]) {
        if (selectedIds.length === filteredItems.length && filteredItems.every(c => selectedIds.includes(c.id))) {
            const currentFilteredIds = filteredItems.map(c => c.id)
            setSelectedIds(prev => prev.filter(id => !currentFilteredIds.includes(id)))
        } else {
            const currentFilteredIds = filteredItems.map(c => c.id)
            setSelectedIds(prev => Array.from(new Set([...prev, ...currentFilteredIds])))
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return
        if (!confirm(`Tem certeza que deseja excluir as ${selectedIds.length} categorias selecionadas? Transações vinculadas perderão essas categorias.`)) return

        setIsBulkDeleting(true)
        try {
            const { error } = await supabase
                .from('categories')
                .delete()
                .in('id', selectedIds)

            if (error) throw error

            setSelectedIds([])
            loadCategories()
        } catch (error) {
            console.error('Erro ao excluir categorias:', error)
            alert('Erro ao excluir algumas categorias')
        } finally {
            setIsBulkDeleting(false)
        }
    }

    async function handleImportCategories(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setIsImporting(true)
        try {
            const imported = await parseCategoryImport(file)
            if (imported.length === 0) {
                alert('Nenhuma categoria válida encontrada no arquivo.')
                return
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Não autenticado')

            const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
            if (!profile?.household_id) throw new Error('Perfil não encontrado')

            // Filter out existing categories (case insensitive)
            const existingNames = new Set(categories.map(c => c.name.toLowerCase()))
            const newCategories = imported
                .filter(c => !existingNames.has(c.name.toLowerCase()))
                .map(c => ({
                    ...c,
                    household_id: profile.household_id
                }))

            if (newCategories.length === 0) {
                alert('Todas as categorias do arquivo já existem no sistema.')
                return
            }

            const { error } = await supabase.from('categories').insert(newCategories)
            if (error) throw error

            alert(`${newCategories.length} novas categorias importadas com sucesso!`)
            loadCategories()
        } catch (error) {
            console.error('Erro ao importar categorias:', error)
            alert('Falha ao importar categorias. Verifique o formato do arquivo.')
        } finally {
            setIsImporting(false)
            e.target.value = ''
        }
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

            {/* Bulk Actions & Import */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
                padding: '12px 16px',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)'
            }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleSelectAll(filtered)}
                        title={selectedIds.length === filtered.length ? "Deselecionar todos" : "Selecionar todos"}
                    >
                        {filtered.length > 0 && selectedIds.length === filtered.length ? <CheckSquare size={18} /> : <Square size={18} />}
                        <span style={{ marginLeft: 8 }}>{selectedIds.length === filtered.length ? 'Deselecionar' : 'Selecionar Todos'}</span>
                    </button>

                    {selectedIds.length > 0 && (
                        <button
                            className="btn btn-sm"
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: 'var(--color-danger)',
                                border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}
                        >
                            <Trash2 size={16} />
                            Excluir {selectedIds.length} {selectedIds.length === 1 ? 'Categoria' : 'Categorias'}
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-ghost btn-sm" onClick={generateCategoryTemplate}>
                        <Download size={16} /> Modelo
                    </button>
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                        <FileUp size={16} /> {isImporting ? 'Importando...' : 'Importar Planilha'}
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleImportCategories}
                            disabled={isImporting}
                            style={{ display: 'none' }}
                        />
                    </label>
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
                                <CategoryCard
                                    key={cat.id}
                                    cat={cat}
                                    onEdit={openEdit}
                                    onDelete={handleDelete}
                                    isSelected={selectedIds.includes(cat.id)}
                                    onSelect={() => toggleSelect(cat.id)}
                                />
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
                                <CategoryCard
                                    key={cat.id}
                                    cat={cat}
                                    onEdit={openEdit}
                                    onDelete={handleDelete}
                                    isSelected={selectedIds.includes(cat.id)}
                                    onSelect={() => toggleSelect(cat.id)}
                                />
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
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
                                    {COLOR_OPTIONS.map(c => (
                                        <button key={c} type="button" onClick={() => setColor(c)}
                                            style={{
                                                width: '100%', aspectRatio: '1/1', borderRadius: '50%', background: c,
                                                border: color === c ? (c === '#000000' ? '2px solid var(--color-accent)' : '3px solid white') : '1px solid rgba(255,255,255,0.1)',
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

function CategoryCard({ cat, onEdit, onDelete, isSelected, onSelect }: {
    cat: Category
    onEdit: (c: Category) => void
    onDelete: (id: string) => void
    isSelected: boolean
    onSelect: () => void
}) {
    return (
        <div
            className="glass-card card-hover-lift stagger-item"
            style={{
                padding: 16,
                position: 'relative',
                border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: isSelected ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                transition: 'all 0.2s ease-in-out'
            }}
            onClick={(e) => {
                // Prevent selection if clicking buttons
                if ((e.target as HTMLElement).closest('button')) return
                onSelect()
            }}
        >
            <div style={{ position: 'absolute', top: 12, right: 12 }}>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onSelect}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
            </div>
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
