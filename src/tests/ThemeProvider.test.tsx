import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/components/ThemeProvider'

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString() },
        clear: () => { store = {} }
    }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

function ThemeConsumer() {
    const { theme, toggleTheme } = useTheme()
    return (
        <div>
            <span data-testid="theme-value">{theme}</span>
            <button onClick={toggleTheme}>Toggle</button>
        </div>
    )
}

describe('ThemeProvider', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
    })

    test('should provide default dark theme', () => {
        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        )
        expect(screen.getByTestId('theme-value').textContent).toBe('dark')
    })

    test('should toggle theme', () => {
        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        )
        const btn = screen.getByText('Toggle')
        fireEvent.click(btn)
        expect(screen.getByTestId('theme-value').textContent).toBe('light')
        fireEvent.click(btn)
        expect(screen.getByTestId('theme-value').textContent).toBe('dark')
    })

    test('should persist to localStorage', () => {
        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        )
        const btn = screen.getByText('Toggle')
        fireEvent.click(btn)
        expect(localStorage.getItem('theme')).toBe('light')
    })
})
