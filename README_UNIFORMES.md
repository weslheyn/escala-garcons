# Módulo Estoque de Uniformes — Coco Bambu

Arquivos criados de forma isolada, sem alterar `index.html`, `script.js`, eventos, escala, frequência, freelances ou trocas.

## Arquivos novos

- `uniformes.html` — tela principal do módulo.
- `uniformes.css` — layout premium responsivo desktop/mobile.
- `uniformes.js` — lógica do módulo: dashboard, movimentações, estoque, funcionário, compras e histórico.
- `uniformes-firebase.js` — conexão isolada com Firebase no caminho `/uniformes_estoque`.
- `uniformes-seed.js` — base inicial extraída da planilha `UNIFORMES ANAPOLIS 202666.xlsx`.

## O que o módulo faz

1. Dashboard com:
   - total em estoque;
   - itens zerados;
   - itens abaixo do ideal;
   - quantidade total a comprar;
   - visão por setor;
   - alertas críticos;
   - últimas movimentações.

2. Controle de estoque:
   - cadastro/edição de uniforme;
   - quantidade atual;
   - quantidade ideal;
   - quantidade mínima;
   - status automático: OK, COMPRAR ou ZERADO.

3. Movimentações:
   - ENTREGA ao funcionário: baixa o estoque;
   - DEVOLUÇÃO: retorna ao estoque;
   - ENTRADA: adiciona compra/recebimento ao estoque;
   - AJUSTE: corrige inventário.

4. Controle por funcionário:
   - mostra o que cada funcionário está com ele;
   - histórico de entregas e devoluções.

5. Lista de compra automática:
   - cálculo: `quantidade ideal - estoque atual`;
   - prioridade por zerado/reposição;
   - botão para copiar lista.

6. Integração Firebase:
   - lê funcionários de `/equipe_oficial/atual/funcionarios`;
   - salva somente em `/uniformes_estoque`.

## Base inicial extraída da planilha

Foram cadastrados automaticamente 86 itens de uniformes, separados por setores como:
ADMINISTRATIVO / CAIXA / DELIVERY, ALMOXARIFADO, ASG, BAR, BRINQUEDOTECA, CONTROLE DE ACESSO, COZINHA / PIA, CUMIM, GARÇOM, MANUTENÇÃO, RECEPÇÃO.

## Como testar

Abra `uniformes.html` no navegador.  
Se o Firebase carregar, o módulo sincroniza online.  
Se não carregar, ele funciona em modo local usando `localStorage`.

## Como integrar no menu do app depois

Para não quebrar nada, este pacote não mexe no menu principal.  
Quando quiser colocar o card na tela inicial, adicione apenas um link para:

```html
<a href="uniformes.html">Estoque de Uniformes</a>
```

