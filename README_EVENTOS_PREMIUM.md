# Eventos & Vendas Premium — v50

Módulo integrado ao app com um único card **Eventos** na tela inicial.

## Incluído
- Dashboard de vendas com total do mês, almoço, jantar, lucro, gorjeta, ticket/conversão e meta mensal.
- Cadastro de evento completo: cliente, origem, tipo, turno, salão, pacote, valor, custo, gorjeta e observações.
- Funil de negociação: Lead, Proposta, Negociações, Reunião, Contrato, Assinaturas, Fechado, Recuperação e Perdido.
- Recuperação de clientes com botão direto para WhatsApp.
- Base de pacotes reais: Infantil, Coffee Break, Coquetel e À Inglesa.
- Calendário visual do mês.
- Exportação CSV e arquivo Apps Script para criar planilha Google Sheets estilo dashboard.
- PWA/tela cheia otimizado para celular e computador instalado.

## Firebase
O módulo usa o nó novo:

```text
eventos_premium/{id}
```

Também lê eventos antigos do nó:

```text
calendario_eventos/{ano}/eventos
```

Assim a agenda antiga não é perdida.

## Google Sheets
Use o arquivo `AppsScript_Eventos_Premium.gs` em uma planilha Google:

1. Abra a planilha.
2. Extensões > Apps Script.
3. Cole o conteúdo do arquivo.
4. Execute `criarEstruturaEventosPremium()`.
5. Use a exportação CSV do app para alimentar a aba Eventos/Vendas, ou evolua depois para sincronização automática via Firebase.
