V5.13 - Arquivos otimizados no Gerenciador de Tarefas

Implementado:
- Upload de arquivos nas listas do quadro.
- PDF gera miniatura real da primeira página usando canvas/PDF.js.
- PDF abre em visualização interna dentro do app.
- Imagens geram miniatura compactada.
- Word, Excel, PowerPoint e CSV geram miniatura leve e ficam disponíveis para download/abrir no aparelho.
- Arquivo completo é salvo no Firebase Storage quando disponível.
- Banco Realtime Database salva apenas metadados leves: nome, tamanho, tipo, URL, caminho no Storage e miniatura.
- Fallback local mantido caso o Storage não esteja disponível.
- A capa do quadro continua usando a miniatura do primeiro arquivo encontrado nas listas.

Observação:
Para arquivos Word/Excel, o app não edita internamente nesta etapa. Eles ficam anexados e disponíveis para download.
