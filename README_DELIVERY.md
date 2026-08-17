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


## v3 — Mapa e regiões personalizadas
- Mapa de calor real sobre OpenStreetMap.
- Novos arquivos isolados: `delivery-map.js` e `delivery-map.css`.
- Editor de regiões por polígonos no próprio mapa.
- Quatro áreas iniciais editáveis: Recreio, Barra da Tijuca, Barra Olímpica e Vargem Grande e Pequena.
- Classificação por ponto dentro do polígono, não apenas pelo texto do endereço.
- Geocodificação manual via botão LOCALIZAR ENDEREÇOS, com cache local e Firebase.
- Pedidos sem localização ficam fora do ranking de regiões até serem localizados.

## v4 — Visual Premium
- Novo arquivo isolado `delivery-premium.css` com refinamento completo da interface.
- Sidebar, KPIs, painéis, tabelas, filtros e cards com acabamento premium.
- Mapa usa base escura CARTO + OpenStreetMap, deixando ruas e bairros visíveis sob o heatmap.
- Heatmap com transparência e gradiente ajustados para preservar a leitura do mapa.
- Melhor responsividade e menos rolagem horizontal em desktop.
