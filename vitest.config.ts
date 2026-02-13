import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts', 'allure-vitest/setup'],
        include: ['tests/**/*.test.{ts,tsx}'],
        css: false,
        reporters: ['default', ['allure-vitest/reporter', { resultsDir: './allure-results' }]],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
