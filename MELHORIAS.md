# Melhorias futuras · Sistema de torneios 100 Compromisso

Lista de ideias para as próximas versões, registrada em 21/10/2026. Prioridade sugerida entre parênteses.

## Antes de novas funções: testes
- [ ] **Testar a conta de cliente com um segundo e-mail Google:** cadastro, criar torneio, limite do plano, contratação e aprovação no Admin. O caminho só foi testado no ambiente simulado. (alta)
- [ ] **Ensaio geral antes do 100 Compromisso Cup (19/12/2026):** duplicar o torneio, fazer inscrições de teste e usar 2 celulares como mesários com o telão ligado. Desligar o 4G de um mesário no meio de um jogo. (alta)

## Funcionalidades
- [ ] **Domínio próprio** (ex.: torneios100compromisso.com.br) no lugar do endereço do GitHub Pages. Rápido, barato e passa mais confiança na venda. (alta)
- [ ] **Link pessoal da inscrição:** o atleta acompanha a situação e edita a inscrição de qualquer aparelho, com o link enviado pelo WhatsApp. Hoje ele só vê no aparelho em que se inscreveu. (alta)
- [ ] **Confirmação automática do Pix:** integrar um intermediário de pagamento (Mercado Pago ou Asaas), com um pequeno servidor (Cloud Functions, plano Blaze do Firebase), para confirmar inscrições e planos sem conferir comprovante. É o maior ganho para vender em escala. (média)
- [ ] **Notificação no celular:** aviso "seu jogo é o próximo" sem o atleta abrir o site. Usa notificações do navegador; no iPhone só funciona com o site instalado na tela inicial. (média)
- [ ] **Outros esportes:** vôlei de praia e beach tennis, com nomenclatura e pontuação configuráveis. Amplia o mercado. (média)

## Técnicas
- [ ] **Torneios muito grandes:** dividir duplas, atletas e categorias em subcoleções, porque hoje tudo fica num único documento do Firestore, com limite de 1 MB. Aguenta bem centenas de duplas; é necessário para circuitos grandes. (baixa)
- [ ] **Testes automáticos das regras de segurança:** emulador do Firebase rodando no GitHub Actions a cada mudança, para evitar que uma atualização quebre algo em produção. (baixa)
