import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '@/components/ThemeProvider'

// Test consumer component
function ThemeConsumer() {
    const { theme, toggleTheme } = useTheme()
    return (
        <div>
            <span data-testid="theme-value">{theme}</span>
            <button data-testid="toggle-btn" onClick={toggleTheme}>Toggle</button>
        </div>
    )
}

describe('ThemeProvider', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
    })

    it('should provide default light theme', async () => {
        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        )

        // After useEffect, theme should be light
        await vi.waitFor(() => {
            expect(screen.getByTestId('theme-value').textContent).toBe('light')
        })
    })

    it('should toggle theme from light to dark', async () => {
        const user = userEvent.setup()

        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        )

        await vi.waitFor(() => {
            expect(screen.getByTestId('theme-value').textContent).toBe('light')
        })

        await user.click(screen.getByTestId('toggle-btn'))

        expect(screen.getByTestId('theme-value').textContent).toBe('dark')
    })

    it('should persist theme to localStorage', async () => {
        const user = userEvent.setup()

        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        )

        await vi.waitFor(() => {
            expect(screen.getByTestId('theme-value').textContent).toBe('light')
        })

        await user.click(screen.getByTestId('toggle-btn'))

        expect(localStorage.setItem).toHaveBeenCalledWith('financas-duo-theme', 'dark')
    })

    it('should set data-theme attribute on html element', async () => {
        const user = userEvent.setup()

        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        )

        await vi.waitFor(() => {
            expect(document.documentElement.getAttribute('data-theme')).toBe('light')
        })

        await user.click(screen.getByTestId('toggle-btn'))

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('should load saved theme from localStorage', async () => {
        localStorage.setItem('financas-duo-theme', 'dark')

        render(
            <ThemeProvider>
                <ThemeConsumer />
            </ThemeProvider>
        )

        await vi.waitFor(() => {
            expect(screen.getByTestId('theme-value').textContent).toBe('dark')
        })
    })

    it('should render children before mount', () => {
        const { container } = render(
            <ThemeProvider>
                <div data-testid="child">Content</div>
            </ThemeProvider>
        )
        expect(screen.getByTestId('child')).toBeTruthy()
    })
})

describe('useTheme', () => {
    it('should return default values outside provider', () => {
        render(<ThemeConsumer />)
        expect(screen.getByTestId('theme-value').textContent).toBe('light')
    })
})
