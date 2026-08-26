# DELIVERY v20 — mapa ampliado

Base: v19.

Alterações somente no módulo Delivery:
- removido o card "Últimos Pedidos" da Visão Geral;
- mapa ampliado para ocupar 9/12 colunas;
- Pedidos por Raio permanece com 3/12 colunas;
- renderização de Últimos Pedidos ficou opcional para não quebrar o JavaScript;
- sw.js e demais módulos permanecem inalterados.

Sobre os 17 pedidos pendentes:
A v19 passou a aceitar como "localizado" somente endereços com correspondência forte de rua/número na base OpenStreetMap/Nominatim. Os demais ficam pendentes em vez de serem colocados em um ponto inventado ou aproximado. Isso costuma ocorrer quando o número do imóvel não existe na base, o endereço possui condomínio/bloco/complemento, há grafia divergente ou o cadastro cartográfico da rua está incompleto.
