'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Card as CardType } from '@/types/database'
import { Plus, Pencil, Trash2, CreditCard, Star, X } from 'lucide-react'
import { SkeletonCreditCards } from '@/components/Skeleton'

const BRANDS = [
    { value: 'visa', label: 'Visa' },
    { value: 'mastercard', label: 'Mastercard' },
    { value: 'elo', label: 'Elo' },
    { value: 'amex', label: 'Amex' },
    { value: 'hipercard', label: 'Hipercard' },
    { value: 'other', label: 'Outra' },
]

const CARD_COLORS = [
    '#6366F1', '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6',
    '#000000', // Black Card
    '#1A1A1A', // Graphite
    '#D4AF37', // Gold
    '#A1A1AA', // Silver
    '#581C87', // Deep Purple
    '#064E3B', // Deep Green
    '#1E3A8A', // Deep Blue
    '#7F1D1D'  // Dark Red
]

export default function CardsPage() {
    const supabase = createClient()
    const [cards, setCards] = useState<CardType[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<CardType | null>(null)
    const [householdId, setHouseholdId] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        name: '', last_four: '', brand: 'visa', credit_limit: '',
        closing_day: '1', due_day: '10', best_purchase_day: '',
        is_primary: false, color: '#6366F1',
    })

    useEffect(() => { loadCards() }, [])

    async function loadCards() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
        if (profile?.household_id) setHouseholdId(profile.household_id)
        const { data } = await supabase.from('cards').select('*').order('is_primary', { ascending: false })
        if (data) setCards(data)
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        setForm({
            name: '', last_four: '', brand: 'visa', credit_limit: '',
            closing_day: '1', due_day: '10', best_purchase_day: '', is_primary: false, color: '#6366F1'
        })
        setShowModal(true)
    }

    function openEdit(card: CardType) {
        setEditing(card)
        setForm({
            name: card.name, last_four: card.last_four || '', brand: card.brand || 'visa',
            credit_limit: card.credit_limit ? card.credit_limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
            closing_day: String(card.closing_day), due_day: String(card.due_day),
            best_purchase_day: card.best_purchase_day ? String(card.best_purchase_day) : '',
            is_primary: card.is_primary || false, color: card.color || '#6366F1',
        })
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const limitValue = typeof form.credit_limit === 'string'
            ? parseFloat(form.credit_limit.replace(/\./g, '').replace(',', '.'))
            : form.credit_limit
        const payload = {
            name: form.name, last_four: form.last_four || null, brand: form.brand,
            credit_limit: limitValue || null,
            closing_day: parseInt(form.closing_day), due_day: parseInt(form.due_day),
            best_purchase_day: form.best_purchase_day ? parseInt(form.best_purchase_day) : null,
            is_primary: form.is_primary, color: form.color, household_id: householdId,
        }

        // If setting as primary, unset others
        if (form.is_primary) {
            await supabase.from('cards').update({ is_primary: false }).eq('household_id', householdId)
        }

        if (editing) {
            await supabase.from('cards').update(payload).eq('id', editing.id)
        } else {
            await supabase.from('cards').insert(payload)
        }

        setSaving(false)
        setShowModal(false)
        loadCards()
    }

    async function handleDelete(id: string) {
        if (!confirm('Excluir este cartão?')) return
        await supabase.from('cards').delete().eq('id', id)
        loadCards()
    }

    async function togglePrimary(card: CardType) {
        await supabase.from('cards').update({ is_primary: false }).eq('household_id', householdId)
        await supabase.from('cards').update({ is_primary: true }).eq('id', card.id)
        loadCards()
    }

    if (loading) {
        return (
            <div className="fade-in">
                <div style={{ marginBottom: 'var(--space-8)' }}>
                    <div className="skeleton skeleton-heading" style={{ width: '30%' }} />
                    <div className="skeleton skeleton-text sm" style={{ width: '20%' }} />
                </div>
                <SkeletonCreditCards count={3} />
            </div>
        )
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cartões de Crédito</h1>
                    <p className="page-subtitle">{cards.length} cartões cadastrados — sem limites!</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Novo Cartão
                </button>
            </div>

            {cards.length > 0 ? (
                <div className="stagger-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {cards.map(card => (
                        <div key={card.id} className="stagger-item" style={{ position: 'relative' }}>
                            <div className="credit-card-visual" style={{
                                background: card.color === '#000000' || card.color === '#1A1A1A'
                                    ? 'linear-gradient(135deg, #1f1f1f 0%, #000000 100%)'
                                    : `linear-gradient(135deg, ${card.color || '#6366F1'} 0%, ${card.color || '#6366F1'}dd 100%)`,
                                border: card.color === '#000000' || card.color === '#1A1A1A' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                boxShadow: card.color === '#000000' || card.color === '#1A1A1A' ? '0 10px 30px rgba(0,0,0,0.5), inset 0 0 10px rgba(255,255,255,0.05)' : 'none'
                            }}>
                                {card.color === '#000000' && (
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent)',
                                        animation: 'shine 3s infinite',
                                        pointerEvents: 'none',
                                        zIndex: 1
                                    }} />
                                )}
                                {card.is_primary && <div className="credit-card-primary-badge"><Star size={10} /> Principal</div>}
                                <div>
                                    <div className="credit-card-brand">{card.brand?.toUpperCase() || 'CARTÃO'}</div>
                                    <div className="credit-card-number">•••• •••• •••• {card.last_four || '****'}</div>
                                </div>
                                <div className="credit-card-info">
                                    <div className="credit-card-name">{card.name}</div>
                                    <div style={{ display: 'flex', gap: 16 }}>
                                        <div className="credit-card-detail">
                                            <span>Fechamento</span>Dia {card.closing_day}
                                        </div>
                                        <div className="credit-card-detail">
                                            <span>Vencimento</span>Dia {card.due_day}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '0 4px' }}>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                    {card.credit_limit ? `Limite: ${formatCurrency(card.credit_limit)}` : 'Sem limite definido'}
                                    {card.best_purchase_day && ` · Melhor dia: ${card.best_purchase_day}`}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {!card.is_primary && (
                                        <button className="btn btn-sm btn-ghost" onClick={() => togglePrimary(card)} title="Definir como principal">
                                            <Star size={14} />
                                        </button>
                                    )}
                                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(card)}><Pencil size={14} /></button>
                                    <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(card.id)}
                                        style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-card empty-state">
                    <CreditCard />
                    <h3>Nenhum cartão cadastrado</h3>
                    <p>Adicione cartões ilimitados — defina fechamento, vencimento e melhor dia de compra</p>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Editar' : 'Novo'} Cartão</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Nome do Cartão</label>
                                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Nubank Gold" />
                                </div>
                                <div className="grid-2">
                                    <div className="input-group">
                                        <label className="input-label">Últimos 4 dígitos</label>
                                        <input className="input" maxLength={4} value={form.last_four}
                                            onChange={e => setForm(f => ({ ...f, last_four: e.target.value.replace(/\D/g, '') }))} placeholder="1234" />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Bandeira</label>
                                        <select className="input select" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}>
                                            {BRANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Limite de Crédito (R$)</label>
                                    <input
                                        className="input"
                                        value={form.credit_limit}
                                        onChange={(e) => {
                                            let value = e.target.value.replace(/\D/g, "")
                                            const limit = (Number(value) / 100).toLocaleString("pt-BR", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })
                                            setForm((f) => ({ ...f, credit_limit: limit }))
                                        }}
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <div className="input-group">
                                        <label className="input-label">Dia Fechamento</label>
                                        <input className="input" type="number" min={1} max={31} value={form.closing_day}
                                            onChange={e => setForm(f => ({ ...f, closing_day: e.target.value }))} required />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Dia Vencimento</label>
                                        <input className="input" type="number" min={1} max={31} value={form.due_day}
                                            onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} required />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Melhor Dia</label>
                                        <input className="input" type="number" min={1} max={31} value={form.best_purchase_day}
                                            onChange={e => setForm(f => ({ ...f, best_purchase_day: e.target.value }))} placeholder="Opt." />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Cor do Cartão</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
                                        {CARD_COLORS.map(c => (
                                            <button key={c} type="button"
                                                style={{
                                                    width: '100%', aspectRatio: '1/1', borderRadius: '50%', background: c,
                                                    border: form.color === c ? (c === '#000000' ? '2px solid var(--color-accent)' : '3px solid #fff') : '2px solid transparent',
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                    boxShadow: form.color === c ? '0 0 10px rgba(0,0,0,0.2)' : 'none'
                                                }}
                                                onClick={() => setForm(f => ({ ...f, color: c }))}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                    <input type="checkbox" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} />
                                    <Star size={14} style={{ color: 'var(--color-gold)' }} /> Definir como cartão principal
                                </label>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <><span className="spinner" /> Salvando...</> : editing ? 'Salvar' : 'Adicionar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
