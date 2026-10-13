# Arena Futvôlei

Sistema online para organizar torneios de futvôlei, do sorteio ao pódio.

- **Categorias** com formato próprio: grupos + mata-mata, todos contra todos ou mata-mata direto. Cada uma define pontuação (até 18, vantagem de 2, teto), vagas, valor e quadras.
- **Duplas**: cadastro uma a uma ou colando a lista do WhatsApp, com cabeças de chave.
- **Sorteio de chaves** equilibrado e jogos gerados na hora, com todas as categorias na mesma fila.
- **Mesário pelo celular**: link secreto, sem cadastro. Escolhe a quadra, chama o próximo jogo e marca os pontos com + e −.
- **Classificação automática**: vitórias, saldo, pontos feitos, confronto direto e melhores terceiros.
- **Mata-mata automático**: oitavas, quartas, semis, final e 3º lugar, com avanço sozinho do vencedor.
- **Inscrições online** com chave Pix para copiar e aprovação pelo organizador.
- **Link público ao vivo** e **modo TV** para o telão, com patrocinadores.

O site fica hospedado de graça no **GitHub Pages**. Os dados ficam no **Firebase**, também no plano gratuito.

---

## Como colocar no ar (uns 15 minutos)

Você só faz isso uma vez. Use o mesmo e-mail do Google em todos os passos.

### 1. Criar o projeto no Firebase

1. Abra **https://console.firebase.google.com** e entre com sua conta Google.
2. Clique em **Criar um projeto** (ou "Adicionar projeto").
3. Dê um nome, por exemplo `arena-futvolei`.
4. Desative o Google Analytics (não é necessário) e clique em **Criar projeto**.

### 2. Criar o banco de dados

1. No menu da esquerda, abra **Criação > Firestore Database**.
2. Clique em **Criar banco de dados**.
3. Escolha o local **southamerica-east1 (São Paulo)**.
4. Escolha **Iniciar no modo de produção** e confirme.

### 3. Ativar os logins

1. No menu, abra **Criação > Authentication** e clique em **Vamos começar**.
2. Na aba **Método de login**, ative **Google** (escolha seu e-mail de suporte) e salve.
3. Clique em **Adicionar novo provedor**, ative **Anônimo** e salve.
   O login anônimo é o que deixa mesários e atletas usarem o site sem criar conta.

### 4. Publicar as regras de segurança

1. Volte em **Firestore Database** e abra a aba **Regras**.
2. Apague o que estiver lá e cole todo o conteúdo do arquivo [`firestore.rules`](firestore.rules) deste repositório.
3. Clique em **Publicar**.

### 5. Autorizar o endereço do site

1. Em **Authentication**, abra a aba **Configurações** e depois **Domínios autorizados**.
2. Clique em **Adicionar domínio** e digite: `jansey-oliveira.github.io`

### 6. Cadastrar você como organizadora

1. Em **Firestore Database**, aba **Dados**, clique em **Iniciar coleção**.
2. ID da coleção: `admins`
3. ID do documento: **o seu e-mail do Google, todo em letras minúsculas** (exemplo: `maria@gmail.com`).
4. Adicione um campo `nome` do tipo string, com seu nome, e salve.

Para ter mais organizadores, crie outro documento na coleção `admins` com o e-mail da pessoa.

### 7. Conectar o site ao Firebase

1. No Firebase, clique na engrenagem ao lado de **Visão geral do projeto** e abra **Configurações do projeto**.
2. Em **Seus apps**, clique no ícone **`</>`** (Web). Dê um apelido, como `site`, **não** marque Firebase Hosting e clique em **Registrar app**.
3. Vai aparecer um bloco `const firebaseConfig = { ... }`. Deixe essa página aberta.
4. Aqui no GitHub, abra o arquivo [`js/config.js`](js/config.js) e clique no lápis (**Edit this file**).
5. Troque cada `COLE_AQUI` pelo valor correspondente do Firebase (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
6. Clique em **Commit changes**.

Esses valores não são senhas. Quem protege os dados são as regras do passo 4.

### 8. Ligar o GitHub Pages

1. No repositório, abra **Settings > Pages**.
2. Em **Build and deployment > Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha `main` e a pasta `/ (root)`. Clique em **Save**.
4. Em 1 ou 2 minutos o site estará em: **https://jansey-oliveira.github.io/arena-futvolei/**

---

## Como usar no dia do torneio

1. Abra o site e clique em **Organizador** (no topo) para entrar com o Google.
2. Clique em **Gerar torneio de exemplo** para conhecer, ou em **Criar torneio** para começar o seu.
3. Na aba **Categorias**, crie Iniciante, Misto, Feminino… com a pontuação e o formato de cada uma.
4. Na aba **Duplas**, cadastre ou cole a lista e clique em **Sortear chaves**.
5. No **Painel**, copie os links e envie pelo WhatsApp:
   - **Público**: jogadores e torcida acompanham ao vivo.
   - **Inscrição**: atletas se inscrevem e veem a chave Pix.
   - **Mesário**: só para os mesários. Cada um escolhe a quadra e lança os pontos.
   - **Telão**: abra numa TV ou notebook ligado ao telão.
6. Quando a fase de grupos terminar, vá em **Classificação** e clique em **Gerar mata-mata**.

Placar lançado errado? Na aba **Jogos**, o organizador clica em **Editar placar** e a classificação é recalculada na hora.

Se um link de mesário vazar, clique em **Gerar novo link de mesário** no Painel. O antigo para de funcionar.

## Instalar no celular

Abra o site no celular e use **Adicionar à tela inicial** (Safari: botão de compartilhar; Chrome: menu ⋮). Ele abre como um aplicativo.

## Limites do plano gratuito

O plano grátis do Firebase permite cerca de 50 mil leituras e 20 mil gravações por dia, o que cobre com folga torneios de algumas dezenas de duplas. Cada pessoa que abre o site lê os jogos do torneio, então um torneio com centenas de pessoas assistindo ao mesmo tempo pode chegar perto do limite. Se isso acontecer, o Firebase avisa no console e o site volta a funcionar no dia seguinte.

## Estrutura dos arquivos

| Arquivo | O que é |
| --- | --- |
| `index.html` | Página do site |
| `css/style.css` | Visual (claro e escuro) |
| `js/app.js` | Telas e ligação com o Firebase |
| `js/logica.js` | Regras do torneio: pontuação, classificação, sorteio e mata-mata |
| `js/config.js` | Configuração do seu projeto Firebase |
| `firestore.rules` | Regras de segurança do banco |
| `testes/logica.test.mjs` | Testes das regras (rode com `node testes/logica.test.mjs`) |
