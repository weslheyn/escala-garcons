IMPORTANTE - FIREBASE STORAGE

Esta versão usa Firebase Storage para salvar arquivos e miniaturas do Gerenciador de Tarefas.
O Realtime Database salva apenas dados leves: nome, tipo, tamanho, url, thumb, storagePath e thumbPath.

Se aparecer mensagem de falha no Storage, verifique se o Firebase Storage está ativado no projeto e se as regras permitem gravação/leitura na pasta:

gerenciador_tarefas/arquivos/

Regras simples para teste interno:

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /gerenciador_tarefas/arquivos/{allPaths=**} {
      allow read, write: if true;
    }
  }
}

Depois, o ideal é restringir por login/permissão.
