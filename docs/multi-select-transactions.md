# Plano: Seleção Múltipla e Deleção em Lote de Transações

## Objetivo
Adicionar a capacidade de selecionar várias transações simultaneamente através de checkboxes e permitir a exclusão em massa das mesmas.

## Arquitetura e Fluxo
1. **Estado de Seleção**: Criar um novo estado `selectedIds` (Set ou Array) para rastrear os IDs das transações selecionadas.
2. **Checkbox Header**: Adicionar um checkbox no cabeçalho da tabela para "Selecionar Tudo".
3. **Checkbox Row**: Adicionar um checkbox em cada linha da tabela.
4. **Barra de Ações em Lote**: Mostrar um botão "Excluir Selecionados" apenas quando houver itens selecionados.
5. **Lógica de Deleção**: 
   - Confirmar a ação com o usuário.
   - Executar a deleção no Supabase usando `.in('id', selectedIds)`.
   - Atualizar a lista local e limpar a seleção.

## Tarefas

### 1. Preparação (Frontend Specialist)
- [ ] Adicionar estado `selectedIds` (`useState<string[]>([])`).
- [ ] Implementar função `toggleSelect(id)` para alternar seleção individual.
- [ ] Implementar função `toggleSelectAll()` para selecionar/deselecionar todos os itens filtrados.

### 2. Interface (UI) (Frontend Specialist)
- [ ] Atualizar o `<thead>` para incluir a coluna de checkbox.
- [ ] Atualizar o `<tbody>` para incluir o checkbox em cada linha.
- [ ] Estilizar os checkboxes para combinar com o design system (minimalista).
- [ ] Adicionar botão de "Excluir Selecionados" (estilo `btn-danger` ou similar) que aparece dinamicamente no cabeçalho ou acima da tabela.

### 3. Integração com Backend (Frontend Specialist)
- [ ] Implementar `handleBulkDelete`.
- [ ] Adicionar feedback visual (loading) durante a deleção em massa.

### 4. Verificação (Test Engineer)
- [ ] Rodar `lint_runner.py` para garantir que não há erros de tipagem.
- [ ] Validar o fluxo de seleção com filtros ativos (ex: selecionar tudo enquanto filtra por "Despesas").

## Riscos e Considerações
- **Performance**: Garantir que a renderização de muitos checkboxes não cause lentidão (uso de memo se necessário, embora para tabelas padrão o React lide bem).
- **UX**: O botão de deletar em lote deve ser bem visível e exigir confirmação.
