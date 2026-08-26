# DELIVERY v22 — mapa por endereço real do pedido

Base: v21.

Análise dos relatórios de 25/08/2026:
- Maestro: 27 pedidos e 27 endereços preenchidos.
- Agilizone: os mesmos 27 pedidos e 27 endereços correspondentes.
- Não existem endereços duplicados entre esses 27 pedidos.

Correções:
- endereço do MAESTRO passa a ser fonte principal do mapa;
- Agilizone é preservado como endereço de apoio;
- geocodificação tenta ArcGIS World + OpenStreetMap/Nominatim;
- cache de geolocalização atualizado para versão 3;
- pontos não são mais agrupados por coordenada arredondada;
- somente pedidos realmente destinados ao mesmo endereço podem compartilhar um marcador;
- quando vários pedidos forem para o mesmo endereço, o marcador mostra a quantidade;
- popup informa endereço e fonte do endereço;
- posições aproximadas continuam identificadas como aproximadas.

Após instalar, use RELocalIZAR ENDEREÇOS uma vez para substituir o cache antigo.

Nenhum sw.js e nenhum módulo fora do Delivery foram alterados.
