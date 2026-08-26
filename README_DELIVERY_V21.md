# DELIVERY v21 — todos os pedidos demarcados

Base: v20.

- O mapa agora exibe também pedidos cuja localização só pode ser aproximada.
- Ponto sólido = endereço exato confirmado.
- Ponto translúcido com contorno branco = posição aproximada.
- Quando rua/número não são encontrados, o sistema tenta rua + bairro e, em último caso, a região.
- O contador separa exatos, aproximados e sem ponto.
- O popup informa quando a posição é aproximada.
- Nenhum sw.js e nenhum módulo fora do Delivery foi alterado.

A localização aproximada não é apresentada como número exato do imóvel. Ela existe para que nenhum pedido desapareça do mapa enquanto a base cartográfica não contém o número.
