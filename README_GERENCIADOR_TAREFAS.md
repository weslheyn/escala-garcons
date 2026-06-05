# Gerenciador de Tarefas

Módulo novo e isolado, inspirado em quadros Kanban/Trello.

Arquivos adicionados:
- gerenciador-tarefas.html
- gerenciador-tarefas.css
- gerenciador-tarefas.js
- gerenciador-tarefas-firebase.js

Caminho Firebase usado:
- /gerenciador_tarefas

O módulo não altera os módulos já existentes. O index.html recebeu apenas um novo card de acesso para abrir `gerenciador-tarefas.html`.

Funções principais:
- Criar áreas de trabalho.
- Criar quadros dentro de cada área.
- Criar listas/colunas.
- Criar cards.
- Arrastar cards entre listas.
- Editar card com descrição, responsável, prioridade, prazo, etiquetas e checklist.
- Alterar fundo do quadro com cores/gradientes prontos ou imagem personalizada por URL.
- Salvar no Firebase com fallback em localStorage.
