# Delivery v6 — mapa, regiões e pedidos por turno

Alterações isoladas no módulo Delivery:
- Relatório 1 renomeado para Relatório Maestro.
- Relatório 2 renomeado para Relatório Agilizone.
- O endereço do Agilizone passa a ter prioridade no cruzamento, pois é mais completo para geolocalização.
- Geocodificação com limpeza de complemento/referência e tentativas de fallback.
- Endereços anteriormente marcados como não encontrados podem ser tentados novamente.
- Dashboard mostra pontos reais dos pedidos sobre o mapa, além do heatmap.
- Classificação por áreas desenhadas continua baseada nos polígonos configurados.
- Resumo e detalhamento por turno usam quantidade de PEDIDOS, não entregas realizadas.
- KM e KM médio por motoboy/turno passam a considerar os pedidos atribuídos.

Turnos:
- MANHÃ: até 16:59
- NOITE: 17:00 em diante
