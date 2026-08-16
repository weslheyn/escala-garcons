# Módulo Delivery — Coco Bambu Recreio — v2

Módulo isolado do aplicativo principal.

## Fluxo diário oficial
1. Baixar os dois relatórios sempre do dia 1º do mês até o dia atual.
2. Importar manualmente os dois arquivos no módulo Delivery.
3. Clicar em ATUALIZAR DASHBOARD.
4. O mês corrente é atualizado/substituído no Firebase sem duplicar pedidos.

## Filtros
- Diário: mostra apenas a data selecionada.
- Semanal: segunda a domingo da semana da data selecionada.
- Mensal: mês inteiro da data selecionada, limitado naturalmente aos dados já importados.
- Comparação: período anterior equivalente.

## Histórico
Cada nova importação acumulada (dia 1º → hoje) regrava os dias e o snapshot mensal em `delivery/`, mantendo os meses anteriores disponíveis.

## Arquivos isolados
- delivery.html
- delivery.css
- delivery.js
- delivery-import.js
- delivery-dashboard.js
- delivery-firebase.js

## Regras dos turnos
- MANHÃ: antes das 17:00.
- NOITE: a partir das 17:00.
