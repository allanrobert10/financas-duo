'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tag } from '@/types/database'
import { Plus, Pencil, Trash2, Tags, X, FileUp, Download, CheckSquare, Square } from 'lucide-react'
import { generateTagTemplate, parseTagImport } from '@/utils/excel'

const TAG_COLORS = [
    '#8B5CF6', '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4', '#14B8A6', '#6366F1', '#F97316',
    '#000000', '#1A1A1A', '#D4AF37', '#A1A1AA', '#581C87', '#064E3B', '#1E3A8A', '#7F1D1D'
]

export default function TagsPage() {
    const supabase = createClient()
    const [tags, setTags] = useState<Tag[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Tag | null>(null)
    const [householdId, setHouseholdId] = useState('')
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ name: '', color: '#8B5CF6' })

    // Selection & Import state
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isBulkDeleting, setIsBulkDeleting] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

    useEffect(() => { loadTags() }, [])

    async function loadTags() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
        if (profile?.household_id) setHouseholdId(profile.household_id)
        const { data } = await supabase.from('tags').select('*').order('name')
        if (data) setTags(data)
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        setForm({ name: '', color: '#8B5CF6' })
        setShowModal(true)
    }

    function openEdit(tag: Tag) {
        setEditing(tag)
        setForm({ name: tag.name, color: tag.color || '#8B5CF6' })
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (editing) {
            await supabase.from('tags').update({ name: form.name, color: form.color }).eq('id', editing.id)
        } else {
            await supabase.from('tags').insert({ name: form.name, color: form.color, household_id: householdId })
        }
        setShowModal(false)
        loadTags()
    }

    async function handleDelete(id: string) {
        if (!confirm('Excluir esta tag?')) return
        await supabase.from('tags').delete().eq('id', id)
        loadTags()
    }

    function toggleSelect(id: string) {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    function toggleSelectAll() {
        if (selectedIds.length === tags.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(tags.map(t => t.id))
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return
        if (!confirm(`Tem certeza que deseja excluir as ${selectedIds.length} tags selecionadas?`)) return

        setIsBulkDeleting(true)
        try {
            const { error } = await supabase
                .from('tags')
                .delete()
                .in('id', selectedIds)

            if (error) throw error

            setSelectedIds([])
            loadTags()
        } catch (error) {
            console.error('Erro ao excluir tags:', error)
            alert('Erro ao excluir algumas tags')
        } finally {
            setIsBulkDeleting(false)
        }
    }

    async function handleImportTags(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setIsImporting(true)
        try {
            const imported = await parseTagImport(file)
            if (imported.length === 0) {
                alert('Nenhuma tag válida encontrada no arquivo.')
                return
            }

            // Get current household_id if not already set
            let hId = householdId
            if (!hId) {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
                    if (profile?.household_id) hId = profile.household_id
                }
            }

            if (!hId) throw new Error('Dados do domicílio não encontrados')

            // Filter out existing tags (case insensitive)
            const existingNames = new Set(tags.map(t => t.name.toLowerCase()))
            const newTags = imported
                .filter(t => !existingNames.has(t.name.toLowerCase()))
                .map(t => ({
                    ...t,
                    household_id: hId
                }))

            if (newTags.length === 0) {
                alert('Todas as tags do arquivo já existem no sistema.')
                return
            }

            const { error } = await supabase.from('tags').insert(newTags)
            if (error) throw error

            alert(`${newTags.length} novas tags importadas com sucesso!`)
            loadTags()
        } catch (error) {
            console.error('Erro ao importar tags:', error)
            alert('Falha ao importar tags. Verifique o formato do arquivo.')
        } finally {
            setIsImporting(false)
            e.target.value = ''
        }
    }

    if (loading) return <p style={{ color: 'var(--color-text-tertiary)', padding: 40 }}>Carregando...</p>

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Tags</h1>
                    <p className="page-subtitle">Organize transações com tags personalizadas</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Nova Tag
                </button>
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
                        onClick={toggleSelectAll}
                        title={selectedIds.length === tags.length ? "Deselecionar todos" : "Selecionar todos"}
                    >
                        {tags.length > 0 && selectedIds.length === tags.length ? <CheckSquare size={18} /> : <Square size={18} />}
                        <span style={{ marginLeft: 8 }}>{selectedIds.length === tags.length ? 'Deselecionar' : 'Selecionar Todas'}</span>
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
                            Excluir {selectedIds.length} {selectedIds.length === 1 ? 'Tag' : 'Tags'}
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-ghost btn-sm" onClick={generateTagTemplate}>
                        <Download size={16} /> Modelo
                    </button>
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                        <FileUp size={16} /> {isImporting ? 'Importando...' : 'Importar Planilha'}
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleImportTags}
                            disabled={isImporting}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
            </div>

            {tags.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {tags.map(tag => (
                        <div
                            key={tag.id}
                            className="glass-card card-hover-lift"
                            style={{
                                padding: '12px 20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                border: selectedIds.includes(tag.id) ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                                background: selectedIds.includes(tag.id) ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                                cursor: 'pointer'
                            }}
                            onClick={(e) => {
                                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return
                                toggleSelect(tag.id)
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(tag.id)}
                                onChange={() => toggleSelect(tag.id)}
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                            <span className="color-dot" style={{ background: tag.color || '#8B5CF6', width: 14, height: 14 }} />
                            <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{tag.name}</span>
                            <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
                                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => openEdit(tag)}><Pencil size={12} /></button>
                                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDelete(tag.id)}
                                    style={{ color: 'var(--color-danger)' }}><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-card empty-state">
                    <Tags />
                    <h3>Nenhuma tag criada</h3>
                    <p>Tags ajudam a classificar e filtrar suas transações</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h2>{editing ? 'Editar' : 'Nova'} Tag</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Nome</label>
                                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Supérfluo" />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Cor</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 8 }}>
                                        {TAG_COLORS.map(c => (
                                            <button key={c} type="button"
                                                style={{
                                                    width: '100%', aspectRatio: '1/1', borderRadius: '50%', background: c,
                                                    border: form.color === c ? (c === '#000000' ? '2px solid var(--color-accent)' : '3px solid #fff') : '2px solid transparent',
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                }}
                                                onClick={() => setForm(f => ({ ...f, color: c }))}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>Preview:</span>
                                    <span className="tag-pill" style={{ borderColor: form.color + '60', background: form.color + '20', color: form.color }}>
                                        <span className="color-dot" style={{ background: form.color }} />
                                        {form.name || 'Tag'}
                                    </span>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">{editing ? 'Salvar' : 'Criar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
