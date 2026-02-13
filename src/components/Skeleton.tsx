'use client'

export function SkeletonStats() {
    return (
        <div className="stats-grid">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-stat" />
            ))}
        </div>
    )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-6)' }}>
                <div className="skeleton skeleton-heading" />
            </div>
            <div style={{ padding: '0 var(--space-6) var(--space-6)' }}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} style={{
                        display: 'flex', gap: 16, alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: i < rows - 1 ? '1px solid var(--color-border)' : 'none',
                    }}>
                        <div className="skeleton" style={{ width: 60, height: 14 }} />
                        <div className="skeleton" style={{ flex: 2, height: 14 }} />
                        <div className="skeleton" style={{ width: 80, height: 14 }} />
                        <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 'var(--radius-full)' }} />
                        <div className="skeleton" style={{ width: 80, height: 14 }} />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
    return (
        <div className="grid-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton skeleton-card" />
            ))}
        </div>
    )
}

export function SkeletonCharts() {
    return (
        <div className="charts-grid">
            <div className="skeleton skeleton-chart" />
            <div className="skeleton skeleton-chart" />
        </div>
    )
}

export function SkeletonPage() {
    return (
        <div className="fade-in">
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <div className="skeleton skeleton-heading" style={{ width: '30%' }} />
                <div className="skeleton skeleton-text sm" style={{ width: '20%' }} />
            </div>
            <SkeletonStats />
            <SkeletonCharts />
            <SkeletonTable />
        </div>
    )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
    return (
        <div style={{ display: 'grid', gap: 16 }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)' }} />
            ))}
        </div>
    )
}

export function SkeletonCreditCards({ count = 3 }: { count?: number }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
            ))}
        </div>
    )
}
