# Plano: Ajuste na Importação de Excel (Forma de Pagamento)

## Objetivo
Permitir que o usuário especifique se uma transação foi feita via **Conta** ou **Cartão** durante a importação de arquivos Excel, garantindo o mapeamento correto dos IDs no banco de dados.

## Alterações Propostas

### 1. Utilidades de Excel (`src/utils/excel.ts`)
- **Headers**: Adicionar a coluna "Meio (Conta/Cartão)" antes do nome da conta/cartão.
  - Novos Headers sugeridos: `['Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Meio (Conta/Cartão)', 'Nome (Conta/Cartão)', 'Observações']`
- **Template**: Atualizar a função `generateTemplate` para incluir exemplos de ambos os meios.
- **Parsing**: Atualizar `parseImport` para extrair essas duas colunas e retornar no objeto de dados.

### 2. Lógica de Importação (`src/app/(dashboard)/settings/page.tsx`)
- **Busca de Dados**: Buscar tanto `accounts` quanto `cards` do Supabase.
- **Mapeamento**:
  - Se "Meio" for "Conta", buscar o nome no `accountMap`.
  - Se "Meio" for "Cartão", buscar o nome no `cardMap`.
- **Inserção**: Preencher `account_id` ou `card_id` na transação conforme o mapeamento.
- **Feedback**: Informar se algum cartão ou conta não foi encontrado.

### 3. Exportação (`src/utils/excel.ts`)
- Atualizar `exportTransactions` para também exportar se a transação foi via conta ou cartão, mantendo a consistência com o novo modelo.

## Tarefas

### 1. Atualização do Utils (Frontend Specialist)
- [x] Modificar `HEADERS` em `excel.ts`.
- [x] Atualizar `generateTemplate`.
- [x] Atualizar `TransactionImportData` para incluir `paymentMethod` (conta/cartão), `paymentName` e `isInstallment`.
- [x] Atualizar `parseImport` para ler as novas colunas e detectar o padrão `NN/MM` no final da descrição.
- [x] Atualizar `exportTransactions`.

### 2. Atualização da Lógica de Configurações (Backend/Frontend Specialist)
- [x] Atualizar `handleImportData` em `settings/page.tsx`.
- [x] Carregar lista de cartões junto com as contas.
- [x] Implementar a lógica de decisão `account_id` vs `card_id`.
- [x] Implementar marcação de `is_recurring` e `recurrence_type` para parcelas detectadas.

### 3. Verificação (Test Engineer)
- [ ] Testar a geração do novo modelo.
- [ ] Validar importação de um arquivo com transações de conta e cartão.

## Riscos
- Quebra de compatibilidade com arquivos no modelo antigo (necessário avisar o usuário que o modelo mudou).
