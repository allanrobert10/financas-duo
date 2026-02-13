'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import {
    LayoutDashboard, ArrowLeftRight, CreditCard, Tags, Wallet,
    PieChart, Settings, LogOut, Menu, X, FolderOpen, Sun, Moon
} from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

const navItems = [
    { label: 'Visão Geral', section: 'principal' },
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
    { label: 'Gerenciar', section: 'gerenciar' },
    { href: '/cards', icon: CreditCard, label: 'Cartões' },
    { href: '/accounts', icon: Wallet, label: 'Contas' },
    { href: '/categories', icon: FolderOpen, label: 'Categorias' },
    { href: '/tags', icon: Tags, label: 'Tags' },
    { href: '/budgets', icon: PieChart, label: 'Orçamentos' },
    { label: 'Sistema', section: 'sistema' },
    { href: '/settings', icon: Settings, label: 'Configurações' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { theme, toggleTheme } = useTheme()

    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
            if (data) setProfile(data)
        }
        loadProfile()
    }, [])

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        : '?'

    return (
        <div className="dashboard-layout">
            {/* Mobile menu button */}
            <button
                className="btn btn-icon btn-ghost"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                    position: 'fixed', top: 12, left: 12, zIndex: 60,
                    display: 'none',
                }}
                id="mobile-menu-btn"
            >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <style>{`
        @media (max-width: 768px) {
          #mobile-menu-btn { display: flex !important; }
        }
      `}</style>

            {/* Mobile backdrop */}
            <div
                className={`sidebar-backdrop${sidebarOpen ? ' visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
                <div className="sidebar-logo">
                    <h1>FinançasDuo</h1>
                    <span>Finanças inteligentes</span>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item, i) => {
                        if ('section' in item) {
                            return <div key={i} className="sidebar-section-label">{item.label}</div>
                        }
                        const Icon = item.icon!
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href!}
                                className={`nav-item${isActive ? ' active' : ''}`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <Icon size={18} />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                <div style={{
                    padding: '8px 16px', borderTop: '1px solid var(--color-border)',
                }}>
                    <button
                        className="nav-item"
                        onClick={toggleTheme}
                        style={{ width: '100%', border: 'none', cursor: 'pointer', background: 'none' }}
                    >
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                        {theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                    </button>
                </div>

                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">{initials}</div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{profile?.full_name || 'Carregando...'}</div>
                        <div className="sidebar-user-email">{profile?.email || ''}</div>
                    </div>
                    <button className="btn btn-icon btn-ghost" onClick={handleLogout} title="Sair">
                        <LogOut size={16} />
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    )
}
