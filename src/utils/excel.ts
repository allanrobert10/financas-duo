import * as XLSX from 'xlsx';

export interface TransactionImportData {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    account: string;
    notes?: string;
}

const HEADERS = [
    'Data (DD/MM/AAAA)',
    'Descrição',
    'Valor',
    'Tipo (Receita/Despesa)',
    'Categoria',
    'Conta',
    'Observações'
];

export const generateTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        HEADERS,
        ['01/01/2024', 'Exemplo de Receita', 5000, 'Receita', 'Salário', 'Banco X', 'Salário mensal'],
        ['05/01/2024', 'Exemplo de Despesa', 150.50, 'Despesa', 'Alimentação', 'Cartão Y', 'Compras da semana']
    ]);

    // Adjust column widths
    ws['!cols'] = [
        { wch: 15 }, // Data
        { wch: 30 }, // Descrição
        { wch: 15 }, // Valor
        { wch: 20 }, // Tipo
        { wch: 20 }, // Categoria
        { wch: 20 }, // Conta
        { wch: 30 }  // Observações
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_importacao_financas.xlsx');
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
                        const description = row[1];
                        const amount = parseFloat(row[2]);
                        const typeRaw = row[3]?.toString().toLowerCase().trim();
                        const category = row[4];
                        const account = row[5];
                        const notes = row[6];

                        // Validate required fields
                        if (!dateRaw || !description || isNaN(amount) || !typeRaw || !category || !account) {
                           return null;
                        }

                        // Normalize Type
                        let type: 'income' | 'expense' = 'expense';
                        if (typeRaw.includes('receita') || typeRaw === 'income') type = 'income';

                         // Handle Excel Date Serial Number or String
                         let date = dateRaw;
                         if (typeof dateRaw === 'number') {
                             const dateObj = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                             // Adjust for timezone offset if necessary or format as YYYY-MM-DD
                             date = dateObj.toISOString().split('T')[0];
                         } else if (typeof dateRaw === 'string') {
                             // Expecting DD/MM/AAAA
                             const parts = dateRaw.split('/');
                             if (parts.length === 3) {
                                 date = `${parts[2]}-${parts[1]}-${parts[0]}`;
                             }
                         }

                        return {
                            date,
                            description,
                            amount,
                            type,
                            category,
                            account,
                            notes
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

export const exportTransactions = (transactions: any[]) => {
    const data = transactions.map(t => [
        new Date(t.date).toLocaleDateString('pt-BR'),
        t.description,
        t.amount,
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.category?.name || 'Sem Categoria',
        t.account?.name || 'Sem Conta',
        t.notes || ''
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
        { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Transações');
    XLSX.writeFile(wb, 'transacoes_exportadas.xlsx');
};
