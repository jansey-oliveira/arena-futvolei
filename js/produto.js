// Página de apresentação e planos (conheca.html).
// Edite aqui nome, contatos e planos. A página se monta sozinha a partir destes dados.

export const PRODUTO = {
  nome: '100 Compromisso',
  sub: 'Torneios de futvôlei',
  // WhatsApp de vendas só com números, com DDI e DDD. Ex.: '5511999998888'. Vazio = botão abre o e-mail.
  whatsapp: '5511925365778',
  email: '',
  instagram: '', // sem @
  manual: 'docs/manual-de-uso.pdf',
  // Pix para receber os planos: o administrador preenche em Admin > Recebimento dos planos (este valor é só um padrão).
  pix: { chave: '', nome: '', cidade: '' },
};

// preco: número em reais (0 = grátis) ou texto livre ('Sob consulta').
// periodo: texto que aparece depois do preço. destaque: true marca o plano recomendado.
export const PLANOS = [
  {
    id: 'experimente', nome: 'Experimente', preco: 0, periodo: '',
    resumo: 'Para conhecer o sistema com um torneio de verdade.',
    itens: ['1 torneio', '1 categoria com até 12 duplas', 'Todas as funcionalidades', 'Conta criada na hora, sem cartão'],
    botao: 'Começar grátis',
    // Limites aplicados pelo sistema (e conferidos nas regras do banco).
    limites: { torneios: 1, categorias: 1, duplas: 12, dias: 365 },
  },
  {
    id: 'avulso', nome: 'Torneio avulso', preco: 49.9, periodo: 'por torneio',
    resumo: 'Para quem organiza um ou dois torneios por ano.',
    itens: ['1 torneio completo', 'Categorias e duplas ilimitadas', 'Identidade visual do seu evento', 'Organizadores extras', 'O crédito não vence'],
    botao: 'Quero este plano',
    limites: { torneios: '+1', categorias: 99, duplas: 999, dias: 3650 },
  },
  {
    id: 'temporada', nome: 'Temporada', preco: 399, periodo: 'por ano', destaque: true, nota: 'equivale a R$ 33,25 por mês',
    resumo: 'Para arenas e circuitos com etapas o ano inteiro.',
    itens: ['Torneios ilimitados por 12 meses', 'Categorias e duplas ilimitadas', 'Ideal para circuitos com ranking', 'Identidade visual por etapa', 'Ajuda na montagem do 1º torneio'],
    botao: 'Quero este plano',
    limites: { torneios: 999, categorias: 99, duplas: 999, dias: 365 },
  },
  {
    id: 'marca', nome: 'Marca própria', preco: 'Sob consulta', periodo: '',
    resumo: 'O sistema inteiro com o nome, o domínio e as cores do seu campeonato.',
    itens: ['Instalação exclusiva com os seus dados', 'Seu logo, suas cores e seu endereço', 'Todos os torneios do circuito', 'Ícone próprio no celular', 'Treinamento da equipe'],
    botao: 'Falar com a gente',
  },
];

export const TODOS_INCLUEM = [
  'Inscrição online com QR code Pix', 'Lotes, cupons e lista de espera', 'Sorteio de chaves e de duplas', 'Placar pelo celular, mesmo sem internet',
  'Check-in e fila inteligente', 'Classificação e mata-mata automáticos', 'Link público e "Onde eu jogo?"', 'Telão com chamada e som',
  'Patrocinadores com QR code', 'Arte do pódio e relatório em PDF', 'Ranking de circuito e galeria de fotos', 'Financeiro e planilhas', 'Manual de uso em PDF',
];
