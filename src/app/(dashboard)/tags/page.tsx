'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tag } from '@/types/database'
import { Plus, Pencil, Trash2, Tags, X } from 'lucide-react'

const TAG_COLORS = ['#8B5CF6', '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4', '#14B8A6', '#6366F1', '#F97316']

export default function TagsPage() {
    const supabase = createClient()
    const [tags, setTags] = useState<Tag[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Tag | null>(null)
    const [householdId, setHouseholdId] = useState('')
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ name: '', color: '#8B5CF6' })

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

            {tags.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {tags.map(tag => (
                        <div key={tag.id} className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
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
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {TAG_COLORS.map(c => (
                                            <button key={c} type="button"
                                                style={{
                                                    width: 32, height: 32, borderRadius: '50%', background: c,
                                                    border: form.color === c ? '3px solid #fff' : '2px solid transparent',
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
