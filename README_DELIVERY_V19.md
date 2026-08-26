# DELIVERY v19 — mapa por endereço exato

Base: v18.

Correções:
- mapa usa base clara OpenStreetMap, mais próxima da leitura de mapa convencional;
- geocodificação v2 prioriza rua + número + bairro + CEP;
- resultados antigos/imprecisos do cache são considerados aproximados e reprocessados;
- só coordenadas com correspondência forte de rua/número são marcadas como exatas;
- botão RELocalizar Endereços dentro dos filtros do mapa;
- o mapa fica mais largo para facilitar a leitura;
- pontos ficam em suas coordenadas reais; não há heatmap;
- áreas continuam editáveis apenas na aba REGIÕES.

Observação: a precisão depende da disponibilidade do endereço no OpenStreetMap/Nominatim. Quando o número exato não existir na base, o sistema mantém o pedido como aproximado/pendente em vez de inventar uma posição.

Nenhum arquivo fora do módulo Delivery e nenhum sw.js foram alterados.
