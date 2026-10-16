# Contexto do projeto · Sistema de torneios de futvôlei (100 Compromisso)

## O que é
Sistema web para organizar torneios de futvôlei do sorteio ao pódio, inspirado no RankingCup e com mais funções. Nasceu para o grupo **100 Compromisso**. Ele é **white-label** para ser vendido com a marca de cada campeonato.

- **App:** https://jansey-oliveira.github.io/arena-futvolei/
- **Página de vendas e planos:** …/conheca.html
- **Manual de uso:** …/docs/manual-de-uso.pdf
- **Repositório:** github.com/jansey-oliveira/arena-futvolei (branch `main`, publicado pelo GitHub Pages)
- **Firebase:** projeto `arena-futvolei` (Firestore + Authentication), plano gratuito Spark.
- **Torneio real em uso:** "100 Compromisso Cup", 19/12/2026, categorias Masculino e Misto 100 Compromisso.

## Stack e arquitetura
- **Front:** site estático em HTML, CSS e JavaScript puro (ES modules). Sem build, sem framework, sem npm em produção.
- **Firebase JS SDK 10.12.2** via gstatic (Firestore com `initializeFirestore` e Auth).
- **Login:**
  - Google, para administradores e organizadores.
  - Anônimo, para mesários e atletas.
- **Tempo real:** `onSnapshot` na lista de torneios, nos jogos, nos patrocinadores e, para o organizador, nas inscrições, no `privado` e nos organizadores.
- **Imagens:** comprimidas no navegador (canvas) e gravadas como data URL no Firestore. O Storage exige plano pago e não é usado. Limites:
  - logo: aprox. 300 KB;
  - patrocinador: 280 KB;
  - comprovante: 700 KB.
- **QR code:** `qrcode-generator@1.4.4` (jsDelivr).
- **Fontes:** Google Fonts. A marca injeta as fontes escolhidas.
- **PWA:** `manifest.webmanifest` e ícones, sem service worker.

## Arquivos
| Arquivo | Papel |
|---|---|
| `index.html` | Casca do app (topbar, abas, view, modal, telão) |
| `js/app.js` (~1.270 linhas) | Estado `S`, telas, handlers `ACT` (cliques) e `FORM` (submits), assinaturas Firestore e permissões |
| `js/logica.js` | Regras puras e testáveis: placar válido, tabela, classificados, grupos, round-robin, mata-mata (seed, byes, avanço), pódio, fila, sorteio de duplas, sets, leitura de listas |
| `js/marca.js` | Motor de marca: modelos (`cem`, `areia`, `noite`), tokens CSS, contraste automático, cor por categoria, fontes, favicon |
| `js/config.js` | `firebaseConfig` e `marcaPadrao` da instalação |
| `js/produto.js` | Nome, WhatsApp de vendas (5511925365778), planos e preços da página de vendas |
| `css/style.css` | Visual 100% por tokens CSS (variáveis definidas pela marca) |
| `conheca.html` | Landing de vendas: funcionalidades, inscrições, como funciona, planos, FAQ, adesão via WhatsApp |
| `firestore.rules` | Regras de segurança (publicadas manualmente no Console) |
| `testes/*.test.mjs` | Testes de lógica e de contraste (`node testes/logica.test.mjs`) |
| `docs/manual-de-uso.pdf` | Manual ilustrado (30 páginas) |
| `img/marca/`, `img/site/` | Escudo, ícones e capturas de tela da landing |

## Modelo de dados (Firestore)
- `admins/{email}`: `{nome}`. Administradores globais, cadastrados só pelo Console.
- `torneios/{tid}`: um documento por torneio. Campos:
  - `nome`, `data`, `local`, `quadras[]`, `duracao`, `contato`, `pix`, `pixNome`, `inscricoes`;
  - `opcoes{comprovante, desempate, patrocinadores}`;
  - `categorias[]`, `duplas[]`, `atletas[]`;
  - `desempate{"cid|chave": [ids]}`, `marca{}|null`, `insc{}` (configuração da página de inscrição), `criado`, `exemplo`.
  - **Categoria:** `id`, `nome`, `formato` (`grupos`|`todos`|`mata`), `chaves`, `classificam`, `extras`, `pontos`, `vantagem`, `teto`, `terceiro`, `vagas`, `valor`, `cobranca` (`dupla`|`atleta`), `quadras[]`, `modoDuplas` (`fixas`|`sorteadas`), `potes`, `finalSets`, `pontosSet`, `pontosTie`, `cor`, `dia`, `hora`, `regra`.
- Subcoleções de `torneios/{tid}`:
  - `jogos/{jid}`: `cat`, `fase` (`grupo`|`mata`), `chave`, `rodada`, `rodadaNome`, `ordem`, `a`, `b`, `pa`, `pb`, `status` (`agendado`|`aovivo`|`fim`|`bye`), `quadra`, `inicio`, `fim`, `vencedor`, `prox{id,slot}`, `perdProx`, `sets[[a,b]]`.
  - `privado/config`: `{mesarioToken}`.
  - `mesarios/{uid}`: `{token, em}`.
  - `organizadores/{email}`: `{nome, em, por}`. O ID é o e-mail em minúsculas.
  - `inscricoes/{iid}`: `cat`, `j1`, `j2`, `zap`, `resp`, `email`, `ig1`, `ig2`, `uni1`, `uni2`, `nomeDupla`, `extras{}`, `aceites[]`, `comprovante`, `status`, `em`, `uid`.
  - `comprovantes/{iid}`: `{uid, img, em}`.
  - `patrocinadores/{pid}`: `{nome, cota, frase, link, logo, em}`.

## Papéis e segurança
- **Administrador** (`admins`): cria e apaga torneios, organiza todos.
- **Organizador do torneio** (`organizadores/{email}`): edita só aquele torneio. Pode adicionar ou remover outros organizadores. Não cria nem apaga torneios.
- **Mesário:** link `?t=ID&m=TOKEN` grava `mesarios/{uid}` com o token atual. Só altera os campos de placar dos jogos. Trocar o token invalida todos os mesários.
- **Atleta:** cria inscrição `pendente` com campos e tamanhos validados nas regras. Não lê inscrições.
- **Público:** lê torneios, jogos e patrocinadores.
- Nas regras, `isOrg()` = `isAdmin()` ou existe `organizadores/{email.lower()}`.

## Convenções de trabalho
- **Idioma:** interface, textos, commits e documentação em **português do Brasil**.
- **Código:** sem dependências novas sem necessidade; lógica nova testável vai para `js/logica.js` com teste.
- **Visual:** nunca cores fixas no CSS, sempre tokens da marca.
- **Funcionalidades opcionais:** podem ser desligadas (em `opcoes` do torneio ou na categoria).
- **Testes de interface:** Playwright com mocks de Firebase (app, auth, firestore) servidos localmente, conferindo desktop (1360px) e celular (390px, sem rolagem horizontal).
- **Mudanças em `firestore.rules`:** precisam ser **publicadas no Console** (Firestore › Regras › Publicar). Sem isso, campos novos são bloqueados.
- **Publicação:** push na `main` publica no GitHub Pages em 1 a 2 minutos. Os usuários precisam recarregar (F5).
- **Commits:** autor `Claude <noreply@anthropic.com>` com Co-Authored-By e link da sessão.

## Limitações conhecidas
1. Todo o torneio (categorias, duplas, atletas, marca com logo) fica em **um documento** (limite de 1 MB do Firestore). Torneios muito grandes, com logo pesado, podem chegar perto.
2. **Planos não são aplicados no sistema.** A ativação é manual: o administrador cria o torneio e adiciona o e-mail do cliente como organizador. Não há cobrança automática.
3. Cota gratuita do Firebase: cerca de 50 mil leituras e 20 mil gravações por dia. Cada visitante assina a lista de **todos** os torneios.
4. Sem **testes automatizados das regras** (o emulador não baixa neste ambiente) e sem CI.
5. **Sem modo offline:** mesário e telão precisam de internet.
6. O atleta não edita nem acompanha a própria inscrição depois de enviar (só um registro em `localStorage`).
7. Erro de digitação "ao vvo" na descrição do repositório no GitHub.

## Melhorias sugeridas (por prioridade)
**Alta: vender e escalar**
- Cadastro self-service: o cliente entra com Google, escolhe o plano, paga Pix e o plano ativa; limites do plano aplicados nas regras (nº de torneios, categorias e duplas).
- Pagamento automático com Pix dinâmico e webhook (Mercado Pago ou Asaas), via Cloud Function ou Worker. Serve para os planos e, como opcional, para as inscrições, com confirmação automática do comprovante.
- Separar `duplas`, `atletas` e `categorias` em subcoleções, ou vigiar o tamanho do documento; listar só os torneios ativos e arquivar os antigos.
- Testes das regras com o emulador e GitHub Actions rodando os testes a cada push.

**Média: dia do torneio**
- Check-in das duplas no dia, com W.O. automático após tolerância.
- Aviso "sua partida é a próxima" por WhatsApp (link pronto) ou notificação push.
- Lista de espera quando a categoria esgota.
- Cronograma por quadra com horário fixo e atraso acumulado.
- Modo offline do mesário (service worker com fila de pontos para sincronizar).
- Súmula e resultado final em PDF; certificado ou arte do pódio para o Instagram.

**Média: atletas e circuito**
- Ranking de circuito somando pontos entre etapas.
- Perfil do atleta com histórico de resultados.
- O atleta acompanha e edita a própria inscrição; cupom de desconto e lote de preços por data.

**Baixa: produto**
- Domínio próprio e versão marca própria com o próprio Firebase do cliente (script de instalação).
- Outros esportes (vôlei de praia, beach tennis): pontuação e nomenclatura configuráveis.
- Painel do administrador com clientes, planos, vencimentos e uso.
- Galeria de fotos do evento ligada aos jogos.
- Acessibilidade (auditoria WCAG) e métricas de uso (eventos anônimos).
