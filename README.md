# Studio Equilibra Pilates · agenda e gestão

App de **agenda e gestão para um estúdio de Pilates**: aulas da semana por profissional, aparelhos, alunos, lembretes por WhatsApp, previsão de receita, recibos e acesso da equipe. Roda de graça em cima de uma planilha Google, publicado com **Google Apps Script**, e abre no celular como se fosse um aplicativo.

> **Nome do estúdio, alunos, profissionais e valores são fictícios.** O repositório mostra como o app funciona, sem nenhum dado real.

## Ver funcionando

A pasta [`prototipo/`](prototipo/) tem a versão de demonstração: um único `index.html` que abre direto no navegador, com 60 alunos inventados e uma semana de aulas de exemplo. Nada é gravado.

A pasta [`apps-script/`](apps-script/) tem a versão final, que lê e grava na planilha do estúdio.

## O que o app faz

- **Agenda semanal** de segunda a sábado (sábado só de manhã), em blocos de 15 minutos com aulas de 45. Cada profissional tem a sua cor. Limite de 3 alunos por profissional no mesmo horário.
- **Aparelhos**: Chair, Reformer, Cadillac, Barrel, Suspenso e Solo, cada um com sua quantidade. O app só oferece o que está livre no horário e aceita revezamento curto.
- **Aulas recorrentes**: o aluno fica marcado toda semana, com renovação avisada quando o período acaba e pausa para férias com data de volta.
- **Histórico da aula**: aparelhos usados e observações de cada atendimento.
- **Lembretes por WhatsApp**: às 18h da véspera, o app monta a mensagem e abre o WhatsApp do celular da profissional com um toque. Não usa serviço pago.
- **Previsão de receita**: tabela de preços por número de sessões no mês (aula livre, 1x, 2x ou 3x por semana), sessões contadas pela própria agenda, descontos em % ou R$, valores ajustados num mês só, controle de pagos e pendentes, despesas e saldo.
- **Recibos**: emissão com número, valor por extenso e assinatura de quem atendeu, e aviso dos pagamentos sem recibo.
- **Equipe**: só a dona do estúdio cadastra, revoga ou remove profissionais. Cada profissional entra por um link pessoal, preso à primeira conta Google que o usar.
- **Privacidade entre profissionais**: cada uma tem uma planilha particular criada automaticamente, só com os próprios alunos e a própria receita. Entre elas circula apenas um índice anônimo de ocupação dos aparelhos.

## Estrutura

```
prototipo/index.html     demonstração com dados fictícios (abre direto no navegador)
apps-script/
  Codigo.gs              servidor: login, planilhas, gravação e gestão de acessos
  index.html             página publicada (gerada pelo build.py)
  src/app.js             código do app, legível
  src/pagina.html        HTML e CSS da página, com o marcador @@APP_CODE@@
  build.py               junta src/ em index.html
```

O código do app vai embutido em base64 dentro do `index.html`. O editor do Apps Script tem dificuldade com arquivos HTML enormes colados de uma vez, e assim o app chega inteiro. Para alterar, edite `src/app.js` e rode `python3 build.py`.

## Como instalar a versão final

1. Crie uma planilha Google para o estúdio e abra **Extensões → Apps Script**.
2. Cole `Codigo.gs` no arquivo de código e crie um arquivo HTML chamado `index` com o conteúdo de `apps-script/index.html`.
3. Em `Codigo.gs`, troque `ADMIN_EMAIL` pelo e-mail da dona do estúdio e `SHEET_ID` pelo ID da planilha (o trecho da URL entre `/d/` e `/edit`).
4. **Implantar → Nova implantação → App da Web**, com **Executar como: usuário que acessa o app** e **Quem pode acessar: qualquer pessoa com Conta do Google**. Assim cada profissional usa a própria conta e a própria planilha. Autorize o acesso. O aviso de "app não verificado" é normal para apps pessoais.
5. Abra o link `/exec` no celular e use **Compartilhar → Adicionar à Tela de Início**.
