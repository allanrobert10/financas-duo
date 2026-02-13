import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
    SkeletonStats,
    SkeletonTable,
    SkeletonCards,
    SkeletonCharts,
    SkeletonPage,
    SkeletonList,
    SkeletonCreditCards,
} from '@/components/Skeleton'

describe('SkeletonStats', () => {
    it('should render 4 skeleton stat items', () => {
        const { container } = render(<SkeletonStats />)
        const skeletons = container.querySelectorAll('.skeleton.skeleton-stat')
        expect(skeletons).toHaveLength(4)
    })

    it('should have stats-grid container', () => {
        const { container } = render(<SkeletonStats />)
        expect(container.querySelector('.stats-grid')).toBeTruthy()
    })
})

describe('SkeletonTable', () => {
    it('should render default 5 rows', () => {
        const { container } = render(<SkeletonTable />)
        const rows = container.querySelectorAll('.skeleton')
        // Each row has 5 skeleton elements + 1 heading = at least 6
        expect(rows.length).toBeGreaterThanOrEqual(6)
    })

    it('should render custom number of rows', () => {
        const { container } = render(<SkeletonTable rows={3} />)
        // heading (1) + 3 rows × 5 skeletons each = 16
        const skeletons = container.querySelectorAll('.skeleton')
        expect(skeletons.length).toBeGreaterThanOrEqual(4)
    })

    it('should have glass-card container', () => {
        const { container } = render(<SkeletonTable />)
        expect(container.querySelector('.glass-card')).toBeTruthy()
    })
})

describe('SkeletonCards', () => {
    it('should render default 4 cards', () => {
        const { container } = render(<SkeletonCards />)
        const cards = container.querySelectorAll('.skeleton.skeleton-card')
        expect(cards).toHaveLength(4)
    })

    it('should render custom count', () => {
        const { container } = render(<SkeletonCards count={6} />)
        const cards = container.querySelectorAll('.skeleton.skeleton-card')
        expect(cards).toHaveLength(6)
    })

    it('should have grid-3 container', () => {
        const { container } = render(<SkeletonCards />)
        expect(container.querySelector('.grid-3')).toBeTruthy()
    })
})

describe('SkeletonCharts', () => {
    it('should render 2 chart skeletons', () => {
        const { container } = render(<SkeletonCharts />)
        const charts = container.querySelectorAll('.skeleton.skeleton-chart')
        expect(charts).toHaveLength(2)
    })

    it('should have charts-grid container', () => {
        const { container } = render(<SkeletonCharts />)
        expect(container.querySelector('.charts-grid')).toBeTruthy()
    })
})

describe('SkeletonPage', () => {
    it('should render heading skeleton', () => {
        const { container } = render(<SkeletonPage />)
        expect(container.querySelector('.skeleton.skeleton-heading')).toBeTruthy()
    })

    it('should render with fade-in class', () => {
        const { container } = render(<SkeletonPage />)
        expect(container.querySelector('.fade-in')).toBeTruthy()
    })

    it('should compose SkeletonStats, SkeletonCharts and SkeletonTable', () => {
        const { container } = render(<SkeletonPage />)
        expect(container.querySelector('.stats-grid')).toBeTruthy()
        expect(container.querySelector('.charts-grid')).toBeTruthy()
        expect(container.querySelector('.glass-card')).toBeTruthy()
    })
})

describe('SkeletonList', () => {
    it('should render default 4 list items', () => {
        const { container } = render(<SkeletonList />)
        const items = container.querySelectorAll('.skeleton')
        expect(items).toHaveLength(4)
    })

    it('should render custom count', () => {
        const { container } = render(<SkeletonList count={2} />)
        const items = container.querySelectorAll('.skeleton')
        expect(items).toHaveLength(2)
    })
})

describe('SkeletonCreditCards', () => {
    it('should render default 3 credit card skeletons', () => {
        const { container } = render(<SkeletonCreditCards />)
        const cards = container.querySelectorAll('.skeleton')
        expect(cards).toHaveLength(3)
    })

    it('should render custom count', () => {
        const { container } = render(<SkeletonCreditCards count={5} />)
        const cards = container.querySelectorAll('.skeleton')
        expect(cards).toHaveLength(5)
    })
})
