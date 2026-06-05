# Eventos Premium — módulo isolado

Esta versão foi refeita para proteger a base antiga do app.

## O que mudou no app antigo
Somente o card da tela inicial foi alterado para abrir `eventos.html`.

## Arquivos novos do módulo
- `eventos.html` — tela principal do sistema de eventos.
- `eventos.css` — visual premium e responsivo desktop/celular.
- `eventos.js` — lógica do dashboard, funil, calendário, vendas, clientes e recuperação.
- `eventos-seed.js` — mantém apenas pacotes reais; eventos importados da planilha foram removidos.
- `eventos-firebase.js` — integração isolada no caminho `/eventos_premium`.
- `AppsScript_Eventos_Isolado.gs` — script para criar/atualizar abas no Google Sheets.

## Dados já incluídos
A base antiga da planilha foi removida; eventos agora entram pelo app ou Google Forms.
Foram importados eventos/contatos identificados de 2026 e 2027 para gerar visão inicial de dashboard, funil e recuperação.

## Segurança
O módulo não altera os arquivos principais de lógica da escala, frequência, freelance, mapa ou WhatsApp.
O caminho Firebase usado é isolado: `/eventos_premium`.

## Como testar
1. Abra `index.html`.
2. Clique no card `Eventos`.
3. Teste dashboard, funil, calendário, vendas, recuperação e pacotes.
4. Para exportar para planilha, use o botão `Exportar CSV`.


## Atualização v53
- Dashboard mobile refinado.
- Botões de exportar/recarregar movidos para engrenagem.
- Filtros ocultos em botão.
- Bloco explicativo substituído por rolagem de eventos fechados da semana.
- Pacote Evento Buffet adicionado: R$ 119,90 com buffet, sobremesa e bebidas inclusas.
- Manifest atualizado para nome do app: Gestão Coco Bambu.
