// Configuração do Firebase do projeto arena-futvolei.
// Para trocar de projeto: Console do Firebase > Configurações do projeto >
// Seus apps > App da Web > "Configuração do SDK" (opção "Config").
// Esses valores não são senhas: a proteção dos dados fica nas regras do Firestore (firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyC7ikABBgFx4gz4dFFgM-pFufp4m3f1PAQ",
  authDomain: "arena-futvolei.firebaseapp.com",
  projectId: "arena-futvolei",
  storageBucket: "arena-futvolei.firebasestorage.app",
  messagingSenderId: "872948460855",
  appId: "1:872948460855:web:9ff571b48559c8f549beb2"
};

// Marca padrão desta instalação (white-label).
// Para vender o sistema para outro campeonato, troque estes valores (ou use um dos modelos
// de js/marca.js). Cada torneio também pode ter a própria marca, na aba "Identidade visual".
import { MODELOS } from './marca.js';
export const marcaPadrao = {
  ...MODELOS.cem,
  nome: '100 Compromisso',
  sub: 'Futvôlei',
  lema: 'Disciplina · Foco · Resultado',
};

// Mantido por compatibilidade.
export const nomeDoSite = marcaPadrao.nome;
