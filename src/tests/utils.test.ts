import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, getMonthName, cn } from '@/lib/utils'

describe('formatCurrency', () => {
    it('should format positive values as BRL', () => {
        const result = formatCurrency(1500.50)
        expect(result).toContain('1.500,50')
        expect(result).toContain('R$')
    })

    it('should format zero', () => {
        const result = formatCurrency(0)
        expect(result).toContain('0,00')
    })

    it('should format negative values', () => {
        const result = formatCurrency(-250.99)
        expect(result).toContain('250,99')
    })

    it('should format large numbers with thousand separators', () => {
        const result = formatCurrency(1000000)
        expect(result).toContain('1.000.000')
    })

    it('should handle small decimal values', () => {
        const result = formatCurrency(0.01)
        expect(result).toContain('0,01')
    })

    it('should round to 2 decimal places', () => {
        const result = formatCurrency(10.999)
        expect(result).toContain('11,00')
    })
})

describe('formatDate', () => {
    it('should format ISO string date to pt-BR', () => {
        const result = formatDate('2025-06-15T12:00:00')
        expect(result).toBe('15/06/2025')
    })

    it('should format Date object to pt-BR', () => {
        const result = formatDate(new Date(2025, 0, 1)) // January 1, 2025
        expect(result).toBe('01/01/2025')
    })

    it('should format date with time component', () => {
        const result = formatDate('2025-12-25T10:30:00Z')
        expect(result).toMatch(/25\/12\/2025/)
    })
})

describe('getMonthName', () => {
    it('should return correct month name for each month', () => {
        expect(getMonthName(1)).toBe('Janeiro')
        expect(getMonthName(6)).toBe('Junho')
        expect(getMonthName(12)).toBe('Dezembro')
    })

    it('should return empty string for month 0 (out of range)', () => {
        expect(getMonthName(0)).toBe('')
    })

    it('should return empty string for month 13 (out of range)', () => {
        expect(getMonthName(13)).toBe('')
    })

    it('should return all 12 months correctly', () => {
        const expectedMonths = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ]
        for (let i = 1; i <= 12; i++) {
            expect(getMonthName(i)).toBe(expectedMonths[i - 1])
        }
    })
})

describe('cn', () => {
    it('should join multiple class names', () => {
        expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz')
    })

    it('should filter out falsy values', () => {
        expect(cn('foo', false, 'bar', undefined, null, 'baz')).toBe('foo bar baz')
    })

    it('should return empty string when all falsy', () => {
        expect(cn(false, undefined, null)).toBe('')
    })

    it('should handle single class', () => {
        expect(cn('solo')).toBe('solo')
    })

    it('should handle empty string as falsy', () => {
        expect(cn('foo', '', 'bar')).toBe('foo bar')
    })
})
