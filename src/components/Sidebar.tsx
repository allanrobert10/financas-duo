'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    LayoutDashboard, ArrowLeftRight, CreditCard, Tags, Wallet,
    Settings, LogOut, Moon, Sun, ChevronLeft, ChevronRight,
    FolderOpen
} from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import type { Profile } from '@/types/database'

const navItems = [
    { label: 'Visão Geral', section: 'principal' },
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
    { label: 'Gerenciar', section: 'gerenciar' },
    { href: '/cards', icon: CreditCard, label: 'Cartões' },
    { href: '/accounts', icon: Wallet, label: 'Contas' },
    { href: '/categories', icon: FolderOpen, label: 'Categorias' },
    { href: '/tags', icon: Tags, label: 'Tags' },
    { label: 'Sistema', section: 'sistema' },
    { href: '/settings', icon: Settings, label: 'Configurações' },
]

interface SidebarProps {
    mobileOpen: boolean
    setMobileOpen: (open: boolean) => void
}

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const { theme, toggleTheme } = useTheme()

    // State for local collapse (desktop only)
    const [collapsed, setCollapsed] = useState(false)
    const [profile, setProfile] = useState<Profile | null>(null)

    useEffect(() => {
        // Load collapsed state from local storage
        const saved = localStorage.getItem('sidebar-collapsed')
        if (saved) setCollapsed(saved === 'true')

        // Load profile
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            if (data) setProfile(data)
        }
        loadProfile()
    }, [])

    const toggleCollapse = () => {
        const newState = !collapsed
        setCollapsed(newState)
        localStorage.setItem('sidebar-collapsed', String(newState))
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        : '?'

    return (
        <>
            {/* Mobile Backdrop */}
            <div
                className={`sidebar-backdrop${mobileOpen ? ' visible' : ''}`}
                onClick={() => setMobileOpen(false)}
            />

            <aside
                className={`sidebar${mobileOpen ? ' open' : ''} ${collapsed ? 'collapsed' : ''}`}
                style={{
                    width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
                    paddingBottom: 20
                }}
            >
                {/* Logo Header */}
                <div className="sidebar-logo" style={{
                    display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
                    padding: collapsed ? '24px 0' : '24px'
                }}>
                    {!collapsed && (
                        <div>
                            <h1>FinançasDuo</h1>
                            <span>Finanças inteligentes</span>
                        </div>
                    )}
                    {collapsed && (
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-accent)' }}>FD</h1>
                    )}
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav" style={{ padding: collapsed ? '16px 8px' : '16px' }}>
                    {navItems.map((item, i) => {
                        // Section Headers
                        if ('section' in item) {
                            if (collapsed) return <div key={i} style={{ height: 16 }} /> // Spacer
                            return <div key={i} className="sidebar-section-label">{item.label}</div>
                        }

                        // Links
                        const Icon = item.icon!
                        const isActive = pathname === item.href || (item.href === '/transactions' && pathname === '/fixed-expenses')

                        return (
                            <Link
                                key={item.href}
                                href={item.href!}
                                className={`nav-item${isActive ? ' active' : ''}`}
                                onClick={() => setMobileOpen(false)}
                                title={collapsed ? item.label : ''}
                                style={{
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    padding: collapsed ? '12px' : '12px 16px'
                                }}
                            >
                                <Icon size={20} />
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer Actions */}
                <div style={{ padding: collapsed ? '8px' : '16px', borderTop: '1px solid var(--color-border)' }}>
                    {/* Theme Toggle */}
                    <button
                        className="nav-item"
                        onClick={toggleTheme}
                        style={{
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            marginBottom: 8
                        }}
                        title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                    >
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                        {!collapsed && <span>{theme === 'light' ? 'Escuro' : 'Claro'}</span>}
                    </button>

                    {/* Collapse Toggle (Desktop Only) */}
                    <button
                        className="nav-item desktop-only"
                        onClick={toggleCollapse}
                        style={{
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            display: 'none' // We'll enable via CSS media query
                        }}
                    >
                        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        {!collapsed && <span>Recolher</span>}
                    </button>
                    <style jsx>{`
                        @media (min-width: 769px) {
                            .desktop-only { display: flex !important; }
                        }
                    `}</style>
                </div>

                {/* User Profile */}
                <div className="sidebar-user" style={{
                    flexDirection: collapsed ? 'column' : 'row',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '16px 8px' : '16px',
                    gap: collapsed ? 12 : 12
                }}>
                    <div className="sidebar-user-avatar" style={{
                        width: 32, height: 32,
                        minWidth: 32, // Prevent shrink
                        background: 'var(--color-accent)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: '#000'
                    }}>
                        {initials}
                    </div>

                    {!collapsed && (
                        <div className="sidebar-user-info" style={{ overflow: 'hidden' }}>
                            <div className="sidebar-user-name" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {profile?.full_name || 'Carregando...'}
                            </div>
                            <div className="sidebar-user-email" style={{ fontSize: 10, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {profile?.email}
                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-icon btn-ghost"
                        onClick={handleLogout}
                        title="Sair"
                        style={{ marginLeft: collapsed ? 0 : 'auto' }}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </aside>
        </>
    )
}
