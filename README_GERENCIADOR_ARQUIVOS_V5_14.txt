V5.14 - Gerenciador de Tarefas / Arquivos

Alterações aplicadas somente no módulo Gerenciador de Tarefas:
- Mantida a geração de miniatura/thumbnail para arquivos.
- PDF tenta gerar thumbnail real da primeira página usando PDF.js.
- Word/Excel/PowerPoint continuam com thumbnail visual leve e ficam apenas para download.
- Removida a visualização interna/abrir arquivo pelo modal.
- Clicar no arquivo agora faz download/abre o download do navegador.
- Arquivos novos não são salvos como base64 no Realtime Database.
- O arquivo original vai para Firebase Storage.
- A thumbnail é enviada ao Firebase Storage quando possível.
- No Realtime Database ficam apenas dados leves: nome, tipo, tamanho, URL do arquivo e URL da thumbnail.

Observação:
Para PDF, se o navegador não conseguir carregar o PDF.js ou o PDF tiver proteção/erro de leitura, o sistema usa uma thumbnail genérica como fallback, sem travar o upload.
