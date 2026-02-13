import { useState } from 'react'
import { AlertTriangle, X, Trash2, Loader2 } from 'lucide-react'

interface DeleteAccountModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => Promise<void>
    isLoading: boolean
}

export function DeleteAccountModal({ isOpen, onClose, onConfirm, isLoading }: DeleteAccountModalProps) {
    const [confirmText, setConfirmText] = useState('')
    const isConfirmed = confirmText === 'DELETAR'

    if (!isOpen) return null

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-content" style={{ maxWidth: 480, borderColor: 'var(--color-danger)' }}>
                <div className="modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--color-danger)'
                        }}>
                            <AlertTriangle size={18} />
                        </div>
                        <h2 style={{ color: 'var(--color-danger)' }}>Zona de Perigo</h2>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isLoading}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: 16
                    }}>
                        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8 }}>
                            Essa ação é IRREVERSÍVEL
                        </h3>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                            Isso apagará permanentemente <strong>TODAS</strong> as transações, contas, categorias e orçamentos do seu Lar.
                            Você não poderá desfazer essa ação.
                        </p>
                    </div>

                    <div className="input-group">
                        <label className="input-label" style={{ color: 'var(--color-text-primary)' }}>
                            Para confirmar, digite <strong style={{ color: 'var(--color-danger)' }}>DELETAR</strong> abaixo:
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Digite DELETAR para confirmar"
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            disabled={isLoading}
                            style={{
                                borderColor: confirmText && !isConfirmed ? 'var(--color-danger)' : undefined,
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                <div className="modal-footer" style={{ borderTopColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <button className="btn btn-ghost" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={onConfirm}
                        disabled={!isConfirmed || isLoading}
                        style={{ minWidth: 140 }}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> Processando...
                            </>
                        ) : (
                            <>
                                <Trash2 size={16} /> ZERAR CONTA
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
