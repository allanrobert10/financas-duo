import { addMonths, startOfDay } from 'date-fns'

export interface TransactionBase {
    description: string
    amount: number
    date: Date
    category_id: string
    type: 'income' | 'expense'
    account_id?: string
    credit_card_id?: string
    is_recurring?: boolean
    installment_id?: string // UUID shared among installments to link them
    installment_number?: number
    total_installments?: number
}

/**
 * Generates an array of transactions for installments.
 * @param baseTransaction The initial transaction data
 * @param installments Total number of installments
 * @param startDate The date of the first installment
 */
export function generateInstallments(
    baseTransaction: Omit<TransactionBase, 'installment_number' | 'total_installments'>,
    installments: number,
    startDate: Date
): TransactionBase[] {
    const transactions: TransactionBase[] = []
    const installmentId = crypto.randomUUID() // Valid in modern browsers/Node

    for (let i = 0; i < installments; i++) {
        const date = addMonths(startDate, i)

        transactions.push({
            ...baseTransaction,
            date: date,
            installment_id: installmentId,
            installment_number: i + 1,
            total_installments: installments,
            description: `${baseTransaction.description} (${i + 1}/${installments})` // Appends (1/10) to description
        })
    }

    return transactions
}
