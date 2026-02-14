export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

export function formatDate(date: string | Date): string {
    const d = new Date(date)
    // Fix timezone offset issue: manually adjust for display if needed, 
    // or simply use UTC methods if the input is YYYY-MM-DD string treated as UTC midnight.
    // However, simplest fix for "YYYY-MM-DD" string displayed as previous day is to append T12:00:00
    // But let's be more robust:
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'UTC' // Treat the date string as UTC literal, display as UTC literal
        }).format(new Date(date + 'T00:00:00Z'))
    }

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(d)
}

export function getMonthName(month: number): string {
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return months[month - 1] || ''
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ')
}
