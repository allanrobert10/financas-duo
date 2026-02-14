import * as XLSX from 'xlsx';
import { formatDate, toDateInputValue } from '@/lib/utils';

export interface TransactionImportData {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    paymentMethod: 'conta' | 'cartão';
    paymentName: string;
    notes?: string;
    isInstallment?: boolean;
    installmentCurrent?: number;
    installmentTotal?: number;
    installmentBaseDescription?: string;
    tags?: string; // Comma separated tags
}

export interface CategoryImportData {
    name: string;
    type: 'income' | 'expense';
    icon?: string;
    color?: string;
}

export interface TagImportData {
    name: string;
    color?: string;
}

export interface FixedExpenseImportData {
    description: string;
    dueDay: number;
    category: string;
    amount: number;
    paymentMethod: 'conta' | 'cartÃ£o';
    paymentName: string;
    notes?: string;
    isActive?: boolean;
}

const HEADERS = [
    'Data (DD/MM/AAAA)',
    'Descrição',
    'Valor',
    'Tipo (Receita/Despesa)',
    'Categoria',
    'Meio (Conta/Cartão)',
    'Nome (Conta/Cartão)',
    'Observações',
    'Tags (Separe por vírgula)'
];

const CATEGORY_HEADERS = [
    'Nome',
    'Tipo (Receita/Despesa)',
    'Ícone (opcional)',
    'Cor (Hexadecimal, opcional)'
];

const TAG_HEADERS = [
    'Nome',
    'Cor (Hexadecimal, opcional)'
];

const FIXED_EXPENSE_HEADERS = [
    'Lancamento',
    'Vencimento (Dia 1-31)',
    'Categoria',
    'Valor',
    'Meio (Conta/Cartao)',
    'Nome (Conta/Cartao)',
    'Observacoes',
    'Status (Ativo/Inativo)'
];

export const generateTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        HEADERS,
        ['01/01/2026', 'Exemplo de Receita', 5000, 'Receita', 'Salário', 'Conta', 'Banco Principal', 'Salário mensal', 'Trabalho, Mensal'],
        ['05/01/2026', 'Exemplo de Despesa 01/10', 150.50, 'Despesa', 'Alimentação', 'Cartão', 'Nubank Platinum', 'Compras da semana', 'Mercado, Casa']
    ]);

    // Adjust column widths
    ws['!cols'] = [
        { wch: 15 }, // Data
        { wch: 30 }, // Descrição
        { wch: 15 }, // Valor
        { wch: 20 }, // Tipo
        { wch: 20 }, // Categoria
        { wch: 20 }, // Meio
        { wch: 20 }, // Nome
        { wch: 30 }, // Observações
        { wch: 30 }  // Tags
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_importacao_financas.xlsx');
};

export const generateCategoryTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        CATEGORY_HEADERS,
        ['Alimentação', 'Despesa', 'utensils', '#EF4444'],
        ['Salário', 'Receita', 'trending-up', '#10B981'],
        ['Transporte', 'Despesa', 'car', '#3B82F6']
    ]);

    ws['!cols'] = [
        { wch: 25 }, // Nome
        { wch: 25 }, // Tipo
        { wch: 20 }, // Ícone
        { wch: 30 }  // Cor
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Categorias');
    XLSX.writeFile(wb, 'modelo_importacao_categorias.xlsx');
};

export const generateTagTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        TAG_HEADERS,
        ['Viagem', '#8B5CF6'],
        ['Saúde', '#EF4444'],
        ['Educação', '#3B82F6']
    ]);

    ws['!cols'] = [
        { wch: 25 }, // Nome
        { wch: 30 }  // Cor
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Tags');
    XLSX.writeFile(wb, 'modelo_importacao_tags.xlsx');
};

export const generateFixedExpensesTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        FIXED_EXPENSE_HEADERS,
        ['Conta de Luz', 10, 'Moradia', 185.90, 'Conta', 'Banco Principal', 'Conta mensal', 'Ativo'],
        ['Internet', 15, 'Assinaturas', 119.90, 'Cartao', 'Nubank Platinum', 'Plano fibra', 'Ativo']
    ]);

    ws['!cols'] = [
        { wch: 30 }, // Lancamento
        { wch: 20 }, // Vencimento
        { wch: 22 }, // Categoria
        { wch: 14 }, // Valor
        { wch: 22 }, // Meio
        { wch: 24 }, // Nome
        { wch: 30 }, // Observacoes
        { wch: 20 }, // Status
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'DespesasFixas');
    XLSX.writeFile(wb, 'modelo_importacao_despesas_fixas.xlsx');
};

export const parseImport = async (file: File): Promise<TransactionImportData[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Remove header row
                if (jsonData.length > 0) jsonData.shift();

                const transactions: TransactionImportData[] = jsonData
                    .filter((row: any) => row.length > 0 && row[0]) // Filter empty rows
                    .map((row: any) => {
                        const dateRaw = row[0];
                        const descriptionRaw = row[1];
                        const description = descriptionRaw?.toString().trim();
                        const amount = parseFloat(row[2]);
                        const typeRaw = row[3]?.toString().toLowerCase().trim();
                        const category = row[4]?.toString().trim();
                        const payMethodRaw = row[5]?.toString().toLowerCase().trim();
                        const payName = row[6]?.toString().trim();
                        const notes = row[7]?.toString().trim();
                        const tags = row[8]?.toString() || '';

                        // Validate required fields
                        if (!dateRaw || !description || isNaN(amount) || !typeRaw || !category || !payMethodRaw || !payName) {
                            return null;
                        }

                        // Normalize Type
                        let type: 'income' | 'expense' = 'expense';
                        if (typeRaw.includes('receita') || typeRaw === 'income') type = 'income';

                        // Normalize Payment Method
                        let paymentMethod: 'conta' | 'cartão' = 'conta';
                        if (payMethodRaw.includes('cartão') || payMethodRaw === 'card' || payMethodRaw === 'cartao') paymentMethod = 'cartão';

                        // Detect installments from suffix "NN/MM" in description
                        // Example: "Magalu 07/10"
                        const installmentMatch = description.match(/^(.*?)(?:\s+)?(\d{1,2})\/(\d{1,2})$/);
                        let isInstallment = false;
                        let installmentCurrent: number | undefined;
                        let installmentTotal: number | undefined;
                        let installmentBaseDescription: string | undefined;
                        if (installmentMatch) {
                            const current = parseInt(installmentMatch[2], 10);
                            const total = parseInt(installmentMatch[3], 10);
                            if (!Number.isNaN(current) && !Number.isNaN(total) && total > 1 && current >= 1 && current <= total) {
                                isInstallment = true;
                                installmentCurrent = current;
                                installmentTotal = total;
                                installmentBaseDescription = installmentMatch[1].trim() || description;
                            }
                        }

                        // Handle Excel Date Serial Number or String
                        let date = dateRaw;
                        if (typeof dateRaw === 'number') {
                            const parsedExcelDate = XLSX.SSF.parse_date_code(dateRaw);
                            if (!parsedExcelDate) {
                                return null;
                            }
                            const dateObj = new Date(parsedExcelDate.y, parsedExcelDate.m - 1, parsedExcelDate.d);
                            date = toDateInputValue(dateObj);
                        } else if (typeof dateRaw === 'string') {
                            // Expecting DD/MM/AAAA
                            const parts = dateRaw.split('/');
                            if (parts.length === 3) {
                                const [day, month, year] = parts;
                                date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                            }
                        }

                        return {
                            date,
                            description,
                            amount,
                            type,
                            category,
                            paymentMethod,
                            paymentName: payName,
                            notes,
                            isInstallment,
                            installmentCurrent,
                            installmentTotal,
                            installmentBaseDescription,
                            tags
                        };
                    })
                    .filter(item => item !== null) as TransactionImportData[];

                resolve(transactions);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const parseCategoryImport = async (file: File): Promise<CategoryImportData[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Remove header row
                if (jsonData.length > 0) jsonData.shift();

                const categories: CategoryImportData[] = jsonData
                    .filter((row: any) => row.length > 0 && row[0])
                    .map((row: any) => {
                        const name = row[0]?.toString().trim();
                        const typeRaw = row[1]?.toString().toLowerCase().trim();
                        const icon = row[2]?.toString().trim() || 'tag';
                        const color = row[3]?.toString().trim() || '#10B981';

                        if (!name || !typeRaw) return null;

                        let type: 'income' | 'expense' = 'expense';
                        if (typeRaw.includes('receita') || typeRaw === 'income') type = 'income';

                        return { name, type, icon, color };
                    })
                    .filter(item => item !== null) as CategoryImportData[];

                resolve(categories);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const parseTagImport = async (file: File): Promise<TagImportData[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Remove header row
                if (jsonData.length > 0) jsonData.shift();

                const tags: TagImportData[] = jsonData
                    .filter((row: any) => row.length > 0 && row[0])
                    .map((row: any) => {
                        const name = row[0]?.toString().trim();
                        const color = row[1]?.toString().trim() || '#8B5CF6';

                        if (!name) return null;

                        return { name, color };
                    })
                    .filter(item => item !== null) as TagImportData[];

                resolve(tags);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const parseFixedExpensesImport = async (file: File): Promise<FixedExpenseImportData[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                if (jsonData.length > 0) jsonData.shift(); // header

                const items: FixedExpenseImportData[] = jsonData
                    .filter((row: any) => row.length > 0 && row[0])
                    .map((row: any) => {
                        const description = row[0]?.toString().trim();
                        const dueRaw = row[1];
                        const category = row[2]?.toString().trim();
                        const amountRaw = row[3];
                        const paymentMethodRaw = row[4]?.toString().toLowerCase().trim();
                        const paymentName = row[5]?.toString().trim();
                        const notes = row[6]?.toString().trim();
                        const statusRaw = row[7]?.toString().toLowerCase().trim();

                        const dueDay = Number(dueRaw);

                        let amount = Number(amountRaw);
                        if (typeof amountRaw === 'string') {
                            const normalized = amountRaw
                                .replace(/\s+/g, '')
                                .replace(/[R$r$]/g, '')
                                .replace(/\./g, '')
                                .replace(',', '.');
                            amount = Number(normalized);
                        }

                        if (!description || !category || Number.isNaN(amount) || !paymentMethodRaw || !paymentName || Number.isNaN(dueDay)) {
                            return null;
                        }

                        if (dueDay < 1 || dueDay > 31) {
                            return null;
                        }

                        let paymentMethod: 'conta' | 'cartÃ£o' = 'conta';
                        if (paymentMethodRaw.includes('cartÃ£o') || paymentMethodRaw === 'card' || paymentMethodRaw === 'cartao') {
                            paymentMethod = 'cartÃ£o';
                        }

                        const isActive = statusRaw ? !statusRaw.includes('inativo') : true;

                        return {
                            description,
                            dueDay,
                            category,
                            amount,
                            paymentMethod,
                            paymentName,
                            notes,
                            isActive,
                        };
                    })
                    .filter(item => item !== null) as FixedExpenseImportData[];

                resolve(items);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const exportTransactions = (transactions: any[]) => {
    const data = transactions.map(t => [
        formatDate(t.date),
        t.description,
        t.amount,
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.category?.name || 'Sem Categoria',
        t.accounts ? 'Conta' : 'Cartão',
        t.accounts?.name || t.cards?.name || 'Não definido',
        t.notes || '',
        t.transaction_tags?.map((tt: any) => tt.tags?.name).join(', ') || ''
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...data]);

    ws['!cols'] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Transações');
    XLSX.writeFile(wb, 'transacoes_exportadas.xlsx');
};
