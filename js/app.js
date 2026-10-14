// Arena Futvôlei — aplicativo (GitHub Pages + Firebase)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, marcaPadrao } from './config.js';
import * as L from './logica.js';
import * as MK from './marca.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const token = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hora = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataBR = d => d ? d.split('-').reverse().join('/') : '';
const lsGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };

const params = new URLSearchParams(location.search);
const S = {
  boot: 'carregando', user: null, org: false, mesario: false, torneios: [], tid: params.get('t') || lsGet('tid'),
  jogos: [], insc: [], privado: null, pats: [], foto: null, tab: 'painel', cat: null, quadra: lsGet('quadra'), editJogo: null, editCat: null,
  modal: null, tv: false, tvIdx: 0, pend: false, novoT: false
};
const unsubs = { jogos: null, insc: null, priv: null, pats: null };

/* ---------- Firebase ---------- */
const configurado = !Object.values(firebaseConfig).some(v => String(v).includes('COLE_AQUI'));
let app, auth, db;
if (configurado) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
}
const R = p => doc(db, p);
const C = p => collection(db, p);
const jp = id => `torneios/${S.tid}/jogos/${id}`;

const filas = {};
function chain(path, fn) { filas[path] = (filas[path] || Promise.resolve()).then(fn).catch(erro); return filas[path]; }
const setD = (p, d) => chain(p, () => setDoc(R(p), d));
const updD = (p, d) => chain(p, () => updateDoc(R(p), d));
const delD = p => chain(p, () => deleteDoc(R(p)));
async function lote(ops) { // ops: [path, data|null]
  try { for (let i = 0; i < ops.length; i += 400) { const b = writeBatch(db); ops.slice(i, i + 400).forEach(([p, d]) => d === null ? b.delete(R(p)) : b.set(R(p), d)); await b.commit(); } }
  catch (e) { erro(e); throw e; }
}
let authPromise = null;
async function ensureAuth() {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  authPromise = authPromise || signInAnonymously(auth).then(c => c.user).finally(() => { authPromise = null; });
  return authPromise;
}

function erro(e) {
  const c = e?.code || '';
  const m = c.includes('permission-denied') ? 'Você não tem permissão para fazer isso. Entre como organizador ou use o link de mesário.' :
    c.includes('unavailable') ? 'Sem conexão com o servidor. Verifique a internet e tente de novo.' :
    c.includes('resource-exhausted') ? 'Limite gratuito do Firebase atingido por hoje.' :
    c.includes('popup-closed') ? 'Login cancelado.' :
    c.includes('unauthorized-domain') ? 'Este endereço não está autorizado no Firebase. Veja o passo 5 do guia (README).' :
    c.includes('operation-not-allowed') ? 'Ative os métodos de login Google e Anônimo no Firebase (passo 3 do guia).' :
    'Não foi possível concluir agora. Tente de novo.';
  toast(m); console.error(e);
}
let toastT; function toast(m) { $('#toast').innerHTML = `<div class="toast" role="status">${esc(m)}</div>`; clearTimeout(toastT); toastT = setTimeout(() => $('#toast').innerHTML = '', 3600); }
function confirmar(msg, ok, fn) { S.modal = { msg, ok, fn }; renderModal(); }

/* ---------- acesso aos dados ---------- */
const T = () => S.torneios.find(x => x.id === S.tid)?.d || null;
const cats = () => T()?.categorias || [];
const catById = id => cats().find(c => c.id === id);
const duplas = () => T()?.duplas || [];
const dupla = id => duplas().find(d => d.id === id);
const atletas = () => T()?.atletas || [];
const sorteadas = c => c?.modoDuplas === 'sorteadas';
const nomeInsc = i => i.j2 ? `${i.j1} / ${i.j2}` : i.j1;
const dn = id => { const d = dupla(id); return d ? `${d.j1} / ${d.j2}` : (id ? '—' : 'A definir'); };
const jogosCat = cid => S.jogos.filter(j => j.cat === cid && j.status !== 'bye');
/* ---------- identidade visual ---------- */
const marca = () => MK.completar(S.tab === 'marca' && S.rascunho ? S.rascunho : (T()?.marca || marcaPadrao), MK.completar(marcaPadrao));
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const partesData = d => { if (!d) return null; const [y, m, dd] = d.split('-').map(Number); const dt = new Date(y, m - 1, dd); return { dm: `${String(dd).padStart(2, '0')}.${String(m).padStart(2, '0')}`, semana: SEMANA[dt.getDay()], mes: MESES[m - 1], ano: y }; };
/** Cor de uma categoria: a escolhida pelo organizador ou, se não houver, a da paleta da marca pela ordem. */
function corCat(c, onde = 'fundo') {
  const m = marca(); if (!c) return MK.corCategoria(m, m.cores.destaque, onde);
  const i = Math.max(0, cats().findIndex(x => x.id === c.id));
  return MK.corCategoria(m, c.cor || m.paleta[i % m.paleta.length]?.cor || m.cores.destaque, onde);
}
const estCat = (c, onde) => { const k = corCat(c, onde); return `--cat:${k};--cat-ink:${MK.tintaSobre(k)}`; };
/** Logo da marca. Logos "de uma cor só" são pintados com a cor indicada (como nos uniformes). */
function logoHTML(m, tam = '36px', cor = '') {
  if (!m.logo) return `<span class="logo-txt" style="--s:${tam};${cor ? '--c:' + cor : ''}" aria-hidden="true">${esc((m.nome || '?').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 3).toUpperCase())}</span>`;
  // url() dentro de variável CSS resolve a partir do arquivo .css, então o endereço precisa ser absoluto
  const src = m.logo.startsWith('data:') ? m.logo : new URL(m.logo, location.href).href;
  if (m.logoTinta) return `<span class="logo-m" role="img" aria-label="${esc(m.nome)}" style="--s:${tam};--logo:url('${src}');${cor ? '--c:' + cor : ''}"></span>`;
  return `<img class="logo-i" src="${m.logo}" alt="${esc(m.nome)}" style="--s:${tam}">`;
}
const opt = k => T()?.opcoes?.[k] !== false; // funcionalidades opcionais: ligadas por padrão
const manuais = () => opt('desempate') ? (T()?.desempate || {}) : {};
const tabela = (cid, ch) => L.tabela(duplas(), S.jogos, cid, ch, manuais()[cid + '|' + ch] || null);
const emSets = j => L.jogoEmSets(catById(j.cat), j);
const regraAtual = j => { const c = catById(j.cat); return emSets(j) ? L.regraDoSet(c, (j.sets || []).length) : c; };
const COTAS = [['master', 'Master'], ['ouro', 'Ouro'], ['prata', 'Prata'], ['apoio', 'Apoio']];
const cotaNome = k => (COTAS.find(c => c[0] === k) || COTAS[3])[1];
const patsOrdem = () => [...S.pats].sort((a, b) => COTAS.findIndex(c => c[0] === a.cota) - COTAS.findIndex(c => c[0] === b.cota) || (a.em || 0) - (b.em || 0));
const linkPat = l => { l = String(l || '').trim(); if (!l) return ''; if (l.startsWith('@')) return 'https://instagram.com/' + l.slice(1); return /^https?:\/\//i.test(l) ? l : 'https://' + l; };
function qrImg(texto, cls = 'qr') {
  try { const q = window.qrcode(0, 'M'); q.addData(texto); q.make(); return `<img class="${cls}" src="${q.createDataURL(6, 2)}" alt="QR code para ${esc(texto)}">`; } catch { return ''; }
}
/** Lê uma imagem escolhida pelo usuário e devolve um data URL comprimido (para caber no banco gratuito). */
function comprimirImagem(file, lado, limite, manterPng = false) {
  return new Promise((ok, falha) => {
    if (!file) return falha(new Error('sem arquivo'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, lado / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
      const cx = cv.getContext('2d');
      const png = manterPng && /png|svg|webp/i.test(file.type);
      if (!png) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); }
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      if (png) { const d = cv.toDataURL('image/png'); if (d.length <= limite) return ok(d); }
      for (let q = 0.8; q >= 0.3; q -= 0.1) { const d = cv.toDataURL(png ? 'image/webp' : 'image/jpeg', q); if (d.length <= limite) return ok(d); }
      falha(new Error('grande demais'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('formato')); };
    img.src = url;
  });
}
const chavesCat = cid => L.chavesCat(duplas(), cid);
const podio = c => L.podio(c, duplas(), S.jogos, manuais());
const catPermite = (cid, q) => { const c = catById(cid); return !c?.quadras?.length || c.quadras.includes(q); };
const fila = q => L.fila(S.jogos, catPermite, q);
const regraTxt = L.regraTxt;
const podeEscrever = () => S.org || S.mesario;
const saveT = patch => { const e = S.torneios.find(x => x.id === S.tid); if (e) e.d = { ...e.d, ...patch }; return updD('torneios/' + S.tid, patch); };

function estadoCat(c) {
  if (podio(c)) return ['Encerrada', 'ok'];
  if (S.jogos.some(j => j.cat === c.id && j.fase === 'mata')) return ['Mata-mata', 'sea'];
  if (S.jogos.some(j => j.cat === c.id && j.fase === 'grupo')) return [c.formato === 'todos' ? 'Todos contra todos' : 'Fase de grupos', 'sea'];
  return ['Montando duplas', ''];
}
function previsoes() {
  const t = T(); const nq = Math.max(1, (t?.quadras || []).length), dur = (+t?.duracao || 20) * 60000;
  const out = {}; fila().forEach((j, i) => out[j.id] = Date.now() + Math.floor(i / nq) * dur + dur * .5); return out;
}
const linkBase = () => location.origin + location.pathname;
const links = () => {
  const b = linkBase() + '?t=' + S.tid;
  return { publico: b, inscricao: b + '#inscricao', tv: b + '#tv', mesario: S.privado?.mesarioToken ? `${b}&m=${S.privado.mesarioToken}#mesario` : '' };
};

/* ---------- ações do torneio ---------- */
const apagarJogosOps = cid => S.jogos.filter(j => !cid || j.cat === cid).map(j => [jp(j.id), null]);

async function sortear(c) {
  const ds = duplas().filter(d => d.cat === c.id);
  if (ds.length < 2) return toast('Cadastre pelo menos 2 duplas nesta categoria.');
  const ci = cats().findIndex(x => x.id === c.id);
  if (c.formato === 'mata') {
    const seeds = [...ds.filter(d => d.cabeca), ...L.shuffle(ds.filter(d => !d.cabeca))].map(d => d.id);
    await saveT({ duplas: duplas().map(d => d.cat === c.id ? { ...d, chave: null } : d) });
    await lote([...apagarJogosOps(c.id), ...L.montarMata(c, seeds, ci, uid).map(g => [jp(g.id), g])]);
    return toast('Chave do mata-mata gerada.');
  }
  const grupos = L.montarGrupos(c, ds);
  await saveT({ duplas: duplas().map(d => { if (d.cat !== c.id) return d; const gi = grupos.findIndex(g => g.includes(d.id)); return { ...d, chave: L.letra(gi) }; }) });
  const novos = L.jogosDeGrupo(c, grupos, ci, uid);
  await lote([...apagarJogosOps(c.id), ...novos.map(j => [jp(j.id), j])]);
  toast(`${grupos.length > 1 ? grupos.length + ' chaves sorteadas' : 'Tabela gerada'} com ${novos.length} jogos.`);
}
async function gerarMata(c) {
  const seeds = L.classificados(c, duplas(), S.jogos, manuais());
  if (seeds.length < 2) return toast('São necessárias ao menos 2 duplas classificadas.');
  const ci = cats().findIndex(x => x.id === c.id);
  const velhos = S.jogos.filter(j => j.cat === c.id && j.fase === 'mata').map(j => [jp(j.id), null]);
  await lote([...velhos, ...L.montarMata(c, seeds, ci, uid).map(g => [jp(g.id), g])]);
}
async function finalizar(j, pa, pb, sets = null) {
  const venc = pa > pb ? j.a : j.b, perd = pa > pb ? j.b : j.a;
  await updD(jp(j.id), { pa, pb, status: 'fim', vencedor: venc, fim: Date.now(), ...(sets ? { sets } : {}) });
  if (j.prox) await updD(jp(j.prox.id), { [j.prox.slot]: venc });
  if (j.perdProx) await updD(jp(j.perdProx.id), { [j.perdProx.slot]: perd });
}
async function reabrir(j) {
  await updD(jp(j.id), { status: 'agendado', pa: 0, pb: 0, vencedor: null, quadra: null, sets: [] });
  for (const lk of [j.prox, j.perdProx]) { if (!lk) continue; const nx = S.jogos.find(x => x.id === lk.id); if (nx && nx.status !== 'fim') await updD(jp(lk.id), { [lk.slot]: null }); }
}
async function chamar(quadra) {
  const j = fila(quadra)[0]; if (!j) return toast('Nenhum jogo disponível para esta quadra agora.');
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(R(jp(j.id)));
      if (!s.exists() || s.data().status !== 'agendado') throw { code: 'ocupado' };
      tx.update(R(jp(j.id)), { status: 'aovivo', quadra, inicio: Date.now() });
    });
  } catch (e) { if (e.code === 'ocupado') toast('Este jogo acabou de ser chamado em outra quadra. Toque de novo.'); else erro(e); }
}

const novaCat = () => ({ id: uid(), nome: 'Nova categoria', formato: 'grupos', chaves: 2, classificam: 2, extras: 0, pontos: 18, vantagem: true, teto: 0, terceiro: true, vagas: 16, valor: 80, cobranca: 'dupla', quadras: [], modoDuplas: 'fixas', potes: false, finalSets: false, pontosSet: 18, pontosTie: 15 });
function trocarTorneio(id) {
  S.tid = id; lsSet('tid', id); S.cat = null; S.rascunho = null; S.editJogo = S.editCat = null; S.mesario = false;
  const u = new URL(location.href); if (id) u.searchParams.set('t', id); else u.searchParams.delete('t'); u.searchParams.delete('m');
  history.replaceState(null, '', u.pathname + u.search + u.hash);
  assinarTorneio(); verificarMesario();
}
async function criarTorneio(d) {
  const id = uid();
  const t = { nome: d.nome || 'Novo torneio', data: d.data || '', local: d.local || '', quadras: (d.quadras || 'Quadra 1, Quadra 2').split(',').map(s => s.trim()).filter(Boolean), duracao: 20, pix: '', pixNome: '', contato: '', inscricoes: true, opcoes: { comprovante: true, desempate: true, patrocinadores: true }, categorias: [], duplas: [], atletas: [], criado: Date.now() };
  S.torneios = [{ id, d: t }, ...S.torneios];
  await lote([['torneios/' + id, t], [`torneios/${id}/privado/config`, { mesarioToken: token() }]]);
  trocarTorneio(id); S.tab = 'categorias'; render();
}
const esperar = async (fn, ms = 8000) => { const t0 = Date.now(); while (!fn() && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 150)); };
async function criarExemplo() {
  toast('Criando torneio de exemplo…');
  const id = uid();
  const hoje = new Date().toISOString().slice(0, 10);
  const ini = { ...novaCat(), nome: 'Iniciante', chaves: 3, classificam: 2, extras: 2, vagas: 12, valor: 80, finalSets: true, dia: hoje, hora: '08:00' };
  const mis = { ...novaCat(), nome: 'Misto', vagas: 8, valor: 45, cobranca: 'atleta', dia: hoje, hora: '12:00', regra: 'No Misto, o atleta masculino pode ser de nível até Amador C. A partir do 3º saque, o homem pode receber o saque.' };
  const sor = { ...novaCat(), nome: 'Duplas sorteadas', vagas: 8, valor: 40, cobranca: 'atleta', modoDuplas: 'sorteadas', potes: true, dia: hoje, hora: '15:00' };
  const ats = ['Caio', 'Murilo', 'Renato', 'Fabrício', 'Wesley', 'Alan', 'Pietro', 'Cauã', 'Bento', 'Ravi', 'Theo', 'Yuri'].map((nome, i) => ({ id: uid(), cat: sor.id, nome, pote: i < 6 ? 1 : 2 }));
  const mk = (l, cat, n) => l.map((s, i) => { const [a, b] = s.split(' / '); return { id: uid(), cat, j1: a, j2: b, cabeca: i < n, chave: null }; });
  const ds = [...mk(['Rafa / Tiago', 'Bruno / Caio', 'Lucas / Pedro', 'Igor / Vitor', 'André / Felipe', 'Marcos / Diego', 'Heitor / Davi', 'Gui / Leo', 'João / Enzo', 'Thiago / Nico', 'Samuel / Otávio', 'Breno / Kauã'], ini.id, 3),
    ...mk(['Ana / Paulo', 'Bia / Renan', 'Carla / Edu', 'Duda / Fábio', 'Elis / Gabriel', 'Júlia / Hugo', 'Lara / Ivan', 'Nina / Jorge'], mis.id, 2)];
  const t = { nome: 'Etapa Verão (exemplo)', data: new Date().toISOString().slice(0, 10), local: 'Arena de exemplo', quadras: ['Quadra 1', 'Quadra 2', 'Quadra 3'], duracao: 20, pix: 'financeiro@exemplo.com.br', pixNome: 'Arena de exemplo', contato: '(11) 90000-0000', inscricoes: true, insc: { edicao: '1ª edição', boasVindas: 'Um dia inteiro de futvôlei, competição e resenha na areia.\nPrepare sua dupla e venha fazer parte dessa história!', instagram: '@arenadeexemplo', incluso: 'Troféus\nBrindes\nPremiação\nCobertura fotográfica\nÁgua durante o evento\nFrutas para os atletas', pixBanco: 'Banco de exemplo' }, opcoes: { comprovante: true, desempate: true, patrocinadores: true }, categorias: [ini, mis, sor], duplas: ds, atletas: ats, criado: Date.now(), exemplo: true };
  S.torneios = [{ id, d: t }, ...S.torneios];
  const pats = [['Água de Coco Sol', 'master', 'A água de coco oficial da arena', '@aguadecocosol'], ['Loja da Areia', 'ouro', 'Bolas, viseiras e camisetas', 'lojadaareia.com.br'], ['Academia Ponto Forte', 'apoio', '', '']]
    .map(([nome, cota, frase, link], i) => [`torneios/${id}/patrocinadores/${uid()}`, { nome, cota, frase, link, logo: null, em: Date.now() + i }]);
  await lote([['torneios/' + id, t], [`torneios/${id}/privado/config`, { mesarioToken: token() }], ...pats]);
  trocarTorneio(id);
  await sortear(ini); await sortear(mis);
  await esperar(() => S.jogos.filter(j => j.fase === 'grupo').length >= 30);
  const gs = S.jogos.filter(j => j.fase === 'grupo').sort((x, y) => x.ordem - y.ordem).slice(0, 9);
  for (const j of gs) { const w = Math.random() < .5, lo = 8 + Math.floor(Math.random() * 8); await finalizar(j, w ? 18 : lo, w ? lo : 18); }
  const nx = fila('Quadra 1')[0]; if (nx) await updD(jp(nx.id), { status: 'aovivo', quadra: 'Quadra 1', inicio: Date.now(), pa: 11, pb: 9 });
  S.tab = 'painel'; render(); toast('Torneio de exemplo pronto.');
}
async function apagarTorneio() {
  const id = S.tid;
  const ins = await getDocs(C(`torneios/${id}/inscricoes`)).catch(() => null);
  const mes = await getDocs(C(`torneios/${id}/mesarios`)).catch(() => null);
  const comp = await getDocs(C(`torneios/${id}/comprovantes`)).catch(() => null);
  const pat = await getDocs(C(`torneios/${id}/patrocinadores`)).catch(() => null);
  await lote([...apagarJogosOps(), ...[ins, mes, comp, pat].flatMap(q => (q?.docs || []).map(d => [d.ref.path, null])), [`torneios/${id}/privado/config`, null], ['torneios/' + id, null]]);
  S.torneios = S.torneios.filter(x => x.id !== id);
  trocarTorneio(S.torneios[0]?.id || null); S.tab = 'painel'; render(); toast('Torneio apagado.');
}

/* ---------- inscrições ---------- */
const vagasCat = c => {
  const pend = S.insc.filter(i => i.cat === c.id && i.status === 'pendente');
  if (sorteadas(c)) return Math.max(0, (+c.vagas || 0) * 2 - atletas().filter(a => a.cat === c.id).length - pend.reduce((n, i) => n + (i.j2 ? 2 : 1), 0));
  return Math.max(0, (+c.vagas || 0) - duplas().filter(d => d.cat === c.id).length - pend.length);
};
async function decidirInsc(id, status) {
  const it = S.insc.find(i => i.id === id); if (!it) return;
  if (status === 'aprovada') {
    if (sorteadas(catById(it.cat))) await saveT({ atletas: [...atletas(), ...[it.j1, it.j2].filter(Boolean).map(nome => ({ id: uid(), cat: it.cat, nome, pote: 1 }))] });
    else await saveT({ duplas: [...duplas(), { id: uid(), cat: it.cat, j1: it.j1, j2: it.j2, apelido: it.nomeDupla || '', cabeca: false, chave: null }] });
  }
  await updD(`torneios/${S.tid}/inscricoes/${id}`, { status });
  toast(status === 'aprovada' ? (sorteadas(catById(it.cat)) ? 'Inscrição aprovada. O atleta entrou na lista do sorteio.' : 'Inscrição aprovada. A dupla entrou na lista.') : 'Inscrição recusada. A vaga voltou a abrir.');
}

/* ---------- assinaturas em tempo real ---------- */
function assinarTorneio() {
  Object.keys(unsubs).forEach(k => { unsubs[k]?.(); unsubs[k] = null; });
  S.jogos = []; S.insc = []; S.privado = null; S.pats = [];
  if (!S.tid || !db) return;
  unsubs.jogos = onSnapshot(C(`torneios/${S.tid}/jogos`), s => { S.jogos = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, erro);
  unsubs.pats = onSnapshot(C(`torneios/${S.tid}/patrocinadores`), s => { S.pats = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => { S.pats = []; });
  if (S.org) {
    unsubs.insc = onSnapshot(C(`torneios/${S.tid}/inscricoes`), s => { S.insc = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.em - a.em); render(); }, erro);
    unsubs.priv = onSnapshot(R(`torneios/${S.tid}/privado/config`), s => { S.privado = s.exists() ? s.data() : null; render(); }, erro);
  }
}
let mesarioEmCurso = null;
function verificarMesario() { mesarioEmCurso = mesarioEmCurso || _verificarMesario().finally(() => { mesarioEmCurso = null; }); return mesarioEmCurso; }
async function _verificarMesario() {
  S.mesario = false;
  if (!S.tid || !db) return;
  await auth.authStateReady();
  const m = params.get('m');
  try {
    if (m) {
      const u = await ensureAuth();
      await setDoc(R(`torneios/${S.tid}/mesarios/${u.uid}`), { token: m, em: Date.now() });
      S.mesario = true; params.delete('m');
      const url = new URL(location.href); url.searchParams.delete('m'); history.replaceState(null, '', url.pathname + url.search + url.hash);
      toast('Link de mesário ativado neste aparelho.');
    } else if (auth.currentUser) {
      const s = await getDoc(R(`torneios/${S.tid}/mesarios/${auth.currentUser.uid}`));
      S.mesario = s.exists();
    }
  } catch (e) { if (m) toast('Este link de mesário não vale mais. Peça um novo ao organizador.'); }
  render();
}
async function verificarAdmin(u) {
  S.org = false;
  if (u && !u.isAnonymous && u.email) { try { S.org = (await getDoc(R('admins/' + u.email))).exists(); } catch { S.org = false; } }
}

/* ---------- render ---------- */
function editingInView() { const a = document.activeElement; return a && $('#view').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }
document.addEventListener('focusout', () => setTimeout(() => { if (S.pend && !editingInView()) { S.pend = false; render(); } }, 0));

function tabsList() {
  const t = [['painel', S.org ? 'Painel' : 'Ao vivo']];
  if (S.org) t.push(['config', 'Torneio'], ['marca', 'Identidade visual'], ['categorias', 'Categorias'], ['duplas', 'Duplas']);
  t.push(['jogos', 'Jogos'], ['classificacao', 'Classificação'], ['chave', 'Mata-mata']);
  if (podeEscrever()) t.push(['mesario', 'Mesário']);
  t.push(['inscricao', S.org ? 'Inscrições' : 'Inscrição'], ['tv', 'Modo TV']);
  return t;
}
function renderChrome() {
  const logado = S.user && !S.user.isAnonymous;
  const m = marca();
  MK.aplicar(m, { titulo: T()?.nome });
  $('#topbar').innerHTML = `<div class="brand">${logoHTML(m, '38px', 'var(--accent-board)')}<div class="nm"><b>${esc(m.nome)}</b>${m.sub ? `<span>${esc(m.sub)}</span>` : ''}</div></div>
    ${S.torneios.length ? `<select id="selT" aria-label="Torneio">${S.torneios.map(x => `<option value="${x.id}"${x.id === S.tid ? ' selected' : ''}>${esc(x.d.nome)}${x.d.data ? ' · ' + dataBR(x.d.data) : ''}</option>`).join('')}</select>` : '<span style="flex:1"></span>'}
    <span class="role">${S.org ? 'Organizador' : S.mesario ? 'Mesário' : 'Público'}</span>
    ${configurado ? `<div class="auth">${logado ? `<button data-act="sair" title="${esc(S.user.email || '')}">Sair</button>` : `<button data-act="entrar">Organizador</button>`}</div>` : ''}`;
  $('#rodape').innerHTML = `<div class="rodape"><span>${esc(T()?.nome || m.nome)}${m.sub ? ' · ' + esc(m.sub) : ''}</span>${m.lema ? `<span>${esc(m.lema)}</span>` : ''}</div>`;
  $('#tabs').innerHTML = T() ? tabsList().map(([k, l]) => `<button data-act="tab" data-k="${k}" aria-current="${S.tab === k}">${l}</button>`).join('') : '';
}
function render() {
  renderChrome();
  if (editingInView()) { S.pend = true; return; }
  $('#view').innerHTML = viewHTML();
  renderModal(); renderTV();
}
function viewHTML() {
  if (!configurado) return setupHTML();
  if (S.boot === 'carregando') return `<div class="empty">${logoHTML(marca(), '120px')}<p class="muted">Carregando torneios…</p></div>`;
  if (S.boot === 'erro') return `<div class="empty">${logoHTML(marca(), '120px')}<h2>Não foi possível carregar os torneios</h2><p class="muted">Confira a internet. Se você acabou de instalar o site, verifique se o banco Firestore foi criado e se as regras foram publicadas (passos 2 e 4 do guia).</p></div>`;
  if (!S.torneios.length) return emptyHTML();
  if (!T()) return '';
  const aba = ['config', 'marca', 'categorias', 'duplas'].includes(S.tab) && !S.org ? 'painel' : S.tab;
  const v = { painel, config, marca: marcaV, categorias, duplas: duplasV, jogos: jogosV, classificacao, chave: chaveV, mesario, inscricao }[aba];
  return (v || painel)();
}
function setupHTML() {
  return `<div class="panel setup stack"><h2>Falta conectar o Firebase</h2><p class="muted" style="margin:0">O site está no ar, mas ainda não sabe onde guardar os torneios.</p>
  <ol><li>Crie um projeto grátis em <b>console.firebase.google.com</b>.</li><li>Adicione um app da Web e copie a configuração.</li><li>Cole os valores no arquivo <code>js/config.js</code> do repositório.</li></ol>
  <p class="small muted" style="margin:0">O passo a passo completo está no arquivo README.md do repositório.</p></div>`;
}
function emptyHTML() {
  if (!S.org) return `<div class="empty">${logoHTML(marca(), '160px')}<h2>Nenhum torneio publicado ainda</h2><p class="muted">Quando o organizador criar um torneio, as chaves, os jogos e os placares aparecem aqui ao vivo.</p>
    ${S.user && !S.user.isAnonymous ? `<p class="small muted">Você entrou como ${esc(S.user.email)}, mas este e-mail não está cadastrado como organizador (passo 6 do guia).</p>` : ''}</div>`;
  return `<div class="empty">${logoHTML(marca(), '160px')}<h2>Monte seu primeiro torneio</h2>
  <p class="muted">Crie o torneio, cadastre as categorias e as duplas, sorteie as chaves e acompanhe os placares até o pódio. Para conhecer o sistema, gere um torneio de exemplo com duas categorias e jogos em andamento.</p>
  <div class="row" style="justify-content:center"><button class="btn" data-act="novoT">Criar torneio</button><button class="btn ghost" data-act="exemplo">Gerar torneio de exemplo</button></div></div>
  ${S.novoT ? novoTForm() : ''}`;
}
function novoTForm() {
  return `<div class="panel" style="max-width:640px;margin:0 auto;width:100%"><form data-form="novoT" class="form">
  <label class="field full"><span>Nome do torneio</span><input id="nt-nome" name="nome" type="text" required placeholder="Ex.: Etapa Primavera"></label>
  <label class="field"><span>Data</span><input id="nt-data" name="data" type="date"></label>
  <label class="field"><span>Local</span><input id="nt-local" name="local" type="text" placeholder="Arena, cidade"></label>
  <label class="field full"><span>Quadras (separadas por vírgula)</span><input id="nt-q" name="quadras" type="text" value="Quadra 1, Quadra 2"></label>
  <div class="row full"><button class="btn">Criar e montar categorias</button><button type="button" class="btn ghost" data-act="cancelNovo">Cancelar</button></div></form></div>`;
}

const gameRow = (j, opts = {}) => {
  const c = catById(j.cat); const prev = opts.prev?.[j.id];
  const st = j.status === 'aovivo' ? `<span class="chip live">ao vivo · ${esc(j.quadra || '')}</span>` : j.status === 'fim' ? `<span class="chip ok">encerrado</span>` : `<span class="chip">na fila${prev ? ' · ~' + hora(prev) : ''}</span>`;
  const wa = j.status === 'fim' && j.vencedor === j.a, wb = j.status === 'fim' && j.vencedor === j.b;
  const md3 = emSets(j), sv = L.setsVencidos(j.sets);
  const sc = j.status === 'agendado' ? '×' : `${j.pa} <span class="muted">×</span> ${j.pb}`;
  const detSets = md3 && (j.sets || []).length ? `<span>${j.status === 'fim' ? 'Sets' : `Sets ${sv.a}×${sv.b} ·`} ${(j.sets || []).map(x => x.join('-')).join(', ')}${j.status === 'aovivo' ? ` · ${(j.sets || []).length + 1}º set` : ''}</span>` : (md3 ? '<span>Melhor de 3 sets</span>' : '');
  const fase = j.fase === 'grupo' ? (c?.formato === 'todos' ? `Rodada ${j.rodada}` : `Chave ${j.chave} · Rodada ${j.rodada}`) : j.rodadaNome;
  let edit = '';
  if (S.org && opts.edit && S.editJogo === j.id) {
    edit = `<form class="edit-row" data-form="editJogo" data-id="${j.id}">
      ${md3 ? `<label class="field" style="flex:1 1 260px"><span>Sets (${esc(dn(j.a))} primeiro)</span><input id="ej-s-${j.id}" name="sets" type="text" placeholder="18-15, 15-18, 15-10" value="${esc(j.status === 'fim' ? (j.sets || []).map(x => x.join('-')).join(', ') : '')}"></label>` : `<label class="check">${esc(dn(j.a))} <input id="ej-a-${j.id}" name="pa" type="number" min="0" value="${j.pa}"></label>
      <label class="check"><input id="ej-b-${j.id}" name="pb" type="number" min="0" value="${j.pb}"> ${esc(dn(j.b))}</label>`}
      <label class="check small"><input id="ej-f-${j.id}" name="forcar" type="checkbox"> aceitar fora da regra</label>
      <button class="btn sm">Salvar resultado</button>
      ${j.status !== 'agendado' ? `<button type="button" class="btn ghost sm" data-act="reabrir" data-id="${j.id}">Voltar para a fila</button>` : ''}
      <button type="button" class="link small" data-act="editJogo" data-id="">Cancelar</button></form>`;
  }
  return `<div class="game"><div class="t${wa ? ' win' : ''}">${esc(dn(j.a))}</div><div class="sc num">${sc}</div><div class="t b${wb ? ' win' : ''}">${esc(dn(j.b))}</div>
   <div class="meta">${st}<span class="cat-tag" style="${estCat(c)}">${esc(c?.nome || '')}</span><span>${esc(fase || '')}</span>${detSets}${S.org && opts.edit && S.editJogo !== j.id && j.a && j.b ? `<button class="link small" data-act="editJogo" data-id="${j.id}">Editar placar</button>` : ''}</div>${edit}</div>`;
};
const podioHTML = pd => `<div class="podium">${[0, 1, 2].map(i => `<div class="p p${i + 1}"><b>${i + 1}º</b>${esc(pd[i] ? dn(pd[i]) : '—')}${i === 2 && pd[3] ? '<br>' + esc(dn(pd[3])) : ''}</div>`).join('')}</div>`;

function compartilharHTML() {
  const l = links();
  const ln = (titulo, desc, url, key) => `<div class="ln"><div><b>${titulo}</b><div class="small muted">${desc}</div><code>${esc(url || 'gerando…')}</code></div><button class="btn ghost sm" data-act="copiar" data-k="${key}"${url ? '' : ' disabled'}>Copiar</button></div>`;
  return `<section class="panel share"><h3>Links para compartilhar</h3>
    ${ln('Público', 'Jogadores e torcida acompanham tudo ao vivo, sem cadastro.', l.publico, 'publico')}
    ${ln('Inscrição', 'Formulário com as categorias, vagas e chave Pix.', l.inscricao, 'inscricao')}
    ${ln('Mesário', 'Link secreto: quem abrir lança placares neste torneio. Envie só para os mesários.', l.mesario, 'mesario')}
    ${ln('Telão', 'Abre direto no modo TV.', l.tv, 'tv')}
    <div><button class="link small" data-act="novoToken">Gerar novo link de mesário</button> <span class="small muted">(o link antigo deixa de funcionar)</span></div></section>`;
}

function heroHTML(t) {
  const m = marca(), d = partesData(t.data);
  const eb = [t.local, m.sub, t.exemplo ? 'exemplo' : ''].filter(Boolean).map(esc).join(' · ');
  return `<section class="hero">
    <div>
      <div class="eyebrow">${eb || '&nbsp;'}</div>
      <h1 class="tit">${esc(t.nome)}</h1>
      ${cats().length ? `<div class="bars">${cats().map(c => `<span style="${estCat(c)}"><i></i>${esc(c.nome)}</span>`).join('')}</div>` : ''}
      ${d ? `<div class="data"><b class="num">${d.dm}</b><span>${esc(d.semana)}<br><strong>${esc(d.mes)} ${d.ano}</strong></span></div>` : ''}
      ${S.org ? `<div class="acoes"><button class="btn sm" data-act="tab" data-k="tv">Abrir modo TV</button><button class="btn ghost sm" data-act="novoT2">Novo torneio</button><button class="btn ghost sm" data-act="tab" data-k="marca">Identidade visual</button></div>` : ''}
    </div>
    <div class="emb" aria-hidden="true">${logoHTML(m, '360px')}</div>
    ${m.lema ? `<div class="lema">${esc(m.lema)}</div>` : ''}
  </section>`;
}
function painel() {
  const t = T(); const ao = S.jogos.filter(j => j.status === 'aovivo'); const prev = previsoes(); const nx = fila().slice(0, 6);
  const tot = S.jogos.filter(j => j.status !== 'bye'), fin = tot.filter(j => j.status === 'fim').length;
  return `<div class="stack">
  ${heroHTML(t)}
  ${S.org && S.novoT ? novoTForm() : ''}
  <div class="panel stats"><div class="stat"><b class="num">${cats().length}</b><span class="label">categorias</span></div><div class="stat"><b class="num">${duplas().length}</b><span class="label">duplas</span></div><div class="stat"><b class="num">${fin}/${tot.length}</b><span class="label">jogos encerrados</span></div><div class="stat"><b class="num">${ao.length}/${(t.quadras || []).length}</b><span class="label">quadras em jogo</span></div></div>
  <div class="grid2">
    <section class="panel"><h3>Em quadra agora</h3><div class="games">${ao.length ? ao.sort((a, b) => (a.quadra || '').localeCompare(b.quadra || '')).map(j => gameRow(j)).join('') : '<p class="muted">Nenhum jogo em andamento.</p>'}</div></section>
    <section class="panel"><h3>Próximos jogos</h3><div class="games">${nx.length ? nx.map(j => gameRow(j, { prev })).join('') : '<p class="muted">A fila está vazia. Sorteie as chaves para gerar os jogos.</p>'}</div></section>
  </div>
  <section class="stack"><h3>Categorias</h3><div class="grid2">${cats().map(c => {
    const js = jogosCat(c.id), f = js.filter(j => j.status === 'fim').length, [e, cl] = estadoCat(c), pd = podio(c);
    return `<div class="panel cat-card" style="${estCat(c)}"><div class="row between"><h3>${esc(c.nome)}</h3><span class="chip ${cl}">${e}</span></div>
    <div class="small muted">${duplas().filter(d => d.cat === c.id).length} duplas · ${regraTxt(c)}</div>
    <div class="progress" aria-label="Progresso"><i style="width:${js.length ? Math.round(f / js.length * 100) : 0}%"></i></div>
    <div class="small muted num">${f} de ${js.length} jogos</div>${pd ? podioHTML(pd) : ''}</div>`;
  }).join('') || '<p class="muted">Nenhuma categoria ainda.</p>'}</div></section>
  ${S.org ? compartilharHTML() : ''}
  ${patsFaixa()}
  </div>`;
}
function patsFaixa() {
  if (!opt('patrocinadores') || !S.pats.length) return '';
  return `<section class="pats-strip" aria-label="Patrocinadores"><span class="label">Patrocínio</span><div class="row">${patsOrdem().map(p => { const inner = p.logo ? `<img src="${p.logo}" alt="${esc(p.nome)}">` : `<b>${esc(p.nome)}</b>`; const l = linkPat(p.link); return l ? `<a href="${esc(l)}" target="_blank" rel="noopener" title="${esc(p.nome)}">${inner}</a>` : `<span title="${esc(p.nome)}">${inner}</span>`; }).join('')}</div></section>`;
}

function config() {
  const t = T();
  return `<div class="stack"><div class="sect-head"><h2>Dados do torneio</h2><button class="btn danger sm" data-act="apagarT">Apagar torneio</button></div>
  <form class="panel form" data-form="config">
    <label class="field full"><span>Nome</span><input id="c-nome" name="nome" type="text" value="${esc(t.nome)}" required></label>
    <label class="field"><span>Data</span><input id="c-data" name="data" type="date" value="${esc(t.data)}"></label>
    <label class="field"><span>Local / endereço</span><input id="c-local" name="local" type="text" value="${esc(t.local)}"></label>
    <label class="field full"><span>Quadras (separadas por vírgula)</span><input id="c-q" name="quadras" type="text" value="${esc((t.quadras || []).join(', '))}"></label>
    <label class="field"><span>Duração média do jogo (min)</span><input id="c-dur" name="duracao" type="number" min="5" value="${esc(t.duracao || 20)}"></label>
    <label class="field"><span>WhatsApp do organizador</span><input id="c-zap" name="contato" type="tel" value="${esc(t.contato)}"></label>
    <label class="field"><span>Chave Pix</span><input id="c-pix" name="pix" type="text" value="${esc(t.pix)}"></label>
    <label class="field"><span>Nome do recebedor</span><input id="c-pixn" name="pixNome" type="text" value="${esc(t.pixNome)}"></label>
    <label class="check full"><input id="c-insc" name="inscricoes" type="checkbox"${t.inscricoes ? ' checked' : ''}> Inscrições online abertas</label>
    <fieldset class="full opcoes"><legend>Funcionalidades</legend>
      <label class="check"><input id="c-op1" name="op_comprovante" type="checkbox"${opt('comprovante') ? ' checked' : ''}> Pedir foto do comprovante do Pix na inscrição</label>
      <label class="check"><input id="c-op2" name="op_desempate" type="checkbox"${opt('desempate') ? ' checked' : ''}> Permitir desempate manual na classificação</label>
      <label class="check"><input id="c-op3" name="op_patrocinadores" type="checkbox"${opt('patrocinadores') ? ' checked' : ''}> Mostrar patrocinadores com logo e QR code no telão e no link público</label>
      <p class="small muted" style="margin:0">A final em melhor de 3 sets é ligada em cada categoria, na aba Categorias.</p>
    </fieldset>
    <div class="full"><button class="btn">Salvar torneio</button></div>
  </form>
  ${patsAdmin()}</div>`;
}
function patsAdmin() {
  const lista = patsOrdem();
  return `<section class="panel stack" style="gap:14px"><div class="sect-head"><div><h3>Patrocinadores</h3><p class="small muted" style="margin:0">${opt('patrocinadores') ? 'Aparecem no telão, com logo, frase e QR code, e no link público.' : 'Desativado nas funcionalidades acima: os patrocinadores ficam salvos, mas não aparecem.'}</p></div></div>
    ${lista.length ? `<div class="pats-admin">${lista.map(p => `<div class="pat-item">${p.logo ? `<img src="${p.logo}" alt="">` : '<div class="pat-noimg">sem logo</div>'}<div style="min-width:0"><b>${esc(p.nome)}</b><div class="small muted">${cotaNome(p.cota)}${p.frase ? ' · ' + esc(p.frase) : ''}</div>${p.link ? `<div class="small muted" style="overflow-wrap:anywhere">${esc(linkPat(p.link))}</div>` : ''}</div><button class="link small" data-act="delPat" data-id="${p.id}">Remover</button></div>`).join('')}</div>` : '<p class="muted" style="margin:0">Nenhum patrocinador cadastrado.</p>'}
    <form class="form" data-form="pat">
      <label class="field"><span>Nome</span><input id="pt-nome" name="nome" type="text" maxlength="60" required></label>
      <label class="field"><span>Cota</span><select id="pt-cota" name="cota">${COTAS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="field full"><span>Frase (opcional)</span><input id="pt-frase" name="frase" type="text" maxlength="90" placeholder="Ex.: O açaí oficial da arena"></label>
      <label class="field"><span>Link para o QR code (site, Instagram ou WhatsApp)</span><input id="pt-link" name="link" type="text" maxlength="200" placeholder="@perfil ou site.com.br"></label>
      <label class="field"><span>Logo (PNG ou JPG)</span><input id="pt-logo" name="logo" type="file" accept="image/*"></label>
      <div class="full"><button class="btn">Adicionar patrocinador</button></div>
    </form></section>`;
}

function marcaV() {
  const salva = T().marca ? MK.completar(T().marca) : null, padrao = MK.completar(marcaPadrao);
  if (!S.rascunho) S.rascunho = JSON.parse(JSON.stringify(salva || padrao));
  const m = MK.completar(S.rascunho), mudou = JSON.stringify(m) !== JSON.stringify(salva || padrao);
  const cor = (k, l) => `<div class="cor"><input id="mk-c-${k}" type="color" data-mk="cor" data-k="${k}" value="${m.cores[k]}" aria-label="${l}"><label class="field"><span>${l}</span><input id="mk-t-${k}" type="text" data-mk="corTxt" data-k="${k}" value="${m.cores[k]}" maxlength="7"></label></div>`;
  const modelos = Object.entries(MK.MODELOS).map(([k, x]) => { const mm = MK.completar(x); return `<button type="button" class="modelo" data-act="modeloMarca" data-k="${k}" style="--m-bg:${mm.cores.fundo};--m-ink:${mm.cores.texto};--m-font:'${mm.fonteTitulo}'"><b>${esc(MK.NOMES_MODELOS[k])}</b><span class="sw">${mm.paleta.map(p => `<i style="background:${p.cor}"></i>`).join('')}</span></button>`; }).join('');
  return `<div class="stack"><div class="sect-head"><div><div class="eyebrow">${esc(T().nome)}</div><h2>Identidade visual</h2><p class="muted small" style="margin:0">${salva ? 'Este torneio usa uma marca própria.' : 'Este torneio usa a marca padrão do site.'} As mudanças aparecem na hora como prévia e só valem para todos depois de salvar.</p></div>
    <div class="row">${mudou ? `<button class="btn ghost sm" data-act="descartarMarca">Descartar mudanças</button>` : ''}<button class="btn" data-act="salvarMarca"${mudou ? '' : ' disabled'}>Salvar identidade</button></div></div>
  <div class="mk">
   <form class="stack" data-form="marca" onsubmit="return false">
    <section class="panel stack" style="gap:14px"><h3>Modelos prontos</h3><div class="modelos">${modelos}</div><p class="dica" style="margin:0">Comece por um modelo e ajuste o que quiser. O modelo 100 Compromisso usa as cores e o escudo do manual de uniformes.</p></section>
    <section class="panel form"><h3 class="full">Nome e logo</h3>
      <label class="field"><span>Nome da marca</span><input id="mk-nome" data-mk="txt" name="nome" type="text" maxlength="40" value="${esc(m.nome)}"></label>
      <label class="field"><span>Subtítulo</span><input id="mk-sub" data-mk="txt" name="sub" type="text" maxlength="30" value="${esc(m.sub)}" placeholder="Futvôlei"></label>
      <label class="field full"><span>Lema (rodapé e telão)</span><input id="mk-lema" data-mk="txt" name="lema" type="text" maxlength="60" value="${esc(m.lema)}" placeholder="Disciplina · Foco · Resultado"></label>
      <div class="full row" style="align-items:center;gap:16px">${logoHTML(m, '72px')}<div class="stack" style="gap:8px;flex:1;min-width:200px">
        <label class="field"><span>Logo (PNG com fundo transparente é o ideal)</span><input id="mk-logo" type="file" accept="image/*" data-mk="logo"></label>
        <label class="check"><input id="mk-tinta" type="checkbox" data-mk="chk" name="logoTinta"${m.logoTinta ? ' checked' : ''}> Logo de uma cor só: pintar com a cor de destaque e das categorias</label>
        ${m.logo ? '<button type="button" class="link small" data-act="semLogo" style="align-self:flex-start">Remover logo (usar as iniciais)</button>' : ''}
      </div></div>
    </section>
    <section class="panel stack" style="gap:14px"><h3>Cores</h3>
      <div class="row"><label class="check"><input type="radio" name="modo" value="escuro" data-mk="radio"${m.modo === 'escuro' ? ' checked' : ''}> Fundo escuro</label><label class="check"><input type="radio" name="modo" value="claro" data-mk="radio"${m.modo === 'claro' ? ' checked' : ''}> Fundo claro</label></div>
      <div class="cores">${cor('fundo', 'Fundo')}${cor('texto', 'Texto')}${cor('destaque', 'Destaque')}${cor('secundaria', 'Secundária')}</div>
      <div><div class="field"><span>Cores das categorias</span></div><div class="pal">${m.paleta.map((p, i) => `<div class="it"><input id="mk-p${i}" type="color" data-mk="pal" data-i="${i}" value="${p.cor}" aria-label="Cor ${i + 1}"><input id="mk-pn${i}" type="text" data-mk="palNome" data-i="${i}" value="${esc(p.nome)}" maxlength="24" aria-label="Nome da cor ${i + 1}"><button type="button" class="link small" data-act="palMenos" data-i="${i}"${m.paleta.length <= 1 ? ' disabled' : ''}>Remover</button></div>`).join('')}</div>
      ${m.paleta.length < 8 ? '<button type="button" class="link small" data-act="palMais" style="margin-top:8px">Adicionar cor</button>' : ''}</div>
      <p class="dica" style="margin:0">Se alguma cor ficar difícil de ler sobre o fundo, o sistema ajusta o tom automaticamente nos textos.</p>
    </section>
    <section class="panel form"><h3 class="full">Fontes e cantos</h3>
      <label class="field"><span>Fonte dos títulos</span><select id="mk-ft" data-mk="sel" name="fonteTitulo">${Object.keys(MK.FONTES_TITULO).map(f => `<option${f === m.fonteTitulo ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
      <label class="field"><span>Fonte do texto</span><select id="mk-fx" data-mk="sel" name="fonteTexto">${Object.keys(MK.FONTES_TEXTO).map(f => `<option${f === m.fonteTexto ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
      <div class="full row"><label class="check"><input type="radio" name="cantos" value="retos" data-mk="radio"${m.cantos === 'retos' ? ' checked' : ''}> Cantos retos</label><label class="check"><input type="radio" name="cantos" value="arredondados" data-mk="radio"${m.cantos === 'arredondados' ? ' checked' : ''}> Cantos arredondados</label></div>
    </section>
    ${salva ? `<section class="panel row between"><div><b>Voltar para a marca padrão</b><div class="small muted">Remove a marca própria deste torneio. A marca padrão é a de ${esc(padrao.nome)}.</div></div><button type="button" class="btn ghost sm" data-act="marcaPadrao">Usar marca padrão</button></section>` : ''}
   </form>
   <aside class="prev stack" style="gap:10px"><div class="eyebrow">Prévia</div>
    <div class="mini"><div class="mh">${logoHTML(m, '30px', 'var(--accent-board)')}<b>${esc(m.nome)}</b></div>
      <div class="mb"><div class="eyebrow">${esc(m.sub || '')}</div><div class="mt">${esc(T().nome)}</div>
        <div class="row" style="gap:10px">${m.paleta.map(p => `<span class="cat-tag small" style="--cat:${MK.corCategoria(m, p.cor)}">${esc(p.nome)}</span>`).join('')}</div>
        <div class="mg" style="--cat:${MK.corCategoria(m, m.paleta[0]?.cor)}"><span>Rafa / Tiago</span><b class="num">18 × 15</b><span style="text-align:right">Bruno / Caio</span></div>
        <div class="row"><button type="button" class="btn sm">Botão</button><span class="chip live">ao vivo</span><span class="chip ok">encerrado</span></div>
      </div></div>
    <p class="small muted" style="margin:0">O site inteiro, o link público, o mesário e o telão já mostram a prévia. Abra o Modo TV para conferir.</p>
   </aside>
  </div></div>`;
}
function lerMarcaDoForm() {
  const f = document.querySelector('form[data-form="marca"]'); if (!f) return S.rascunho;
  const m = JSON.parse(JSON.stringify(S.rascunho || {}));
  m.nome = f.querySelector('#mk-nome').value.trim().slice(0, 40) || 'Minha marca';
  m.sub = f.querySelector('#mk-sub').value.trim().slice(0, 30);
  m.lema = f.querySelector('#mk-lema').value.trim().slice(0, 60);
  m.logoTinta = f.querySelector('#mk-tinta').checked;
  m.modo = f.querySelector('input[name=modo]:checked')?.value || 'escuro';
  m.cantos = f.querySelector('input[name=cantos]:checked')?.value || 'retos';
  m.fonteTitulo = f.querySelector('#mk-ft').value; m.fonteTexto = f.querySelector('#mk-fx').value;
  m.cores = { ...(m.cores || {}) };
  ['fundo', 'texto', 'destaque', 'secundaria'].forEach(k => { m.cores[k] = MK.normHex(f.querySelector('#mk-t-' + k).value, f.querySelector('#mk-c-' + k).value); });
  m.paleta = [...f.querySelectorAll('[data-mk="pal"]')].map(el => ({ cor: MK.normHex(el.value, '#888888'), nome: (f.querySelector('#mk-pn' + el.dataset.i)?.value || '').trim().slice(0, 24) }));
  return m;
}
function previaMarca() {
  S.rascunho = lerMarcaDoForm(); MK.aplicar(MK.completar(S.rascunho, MK.completar(marcaPadrao)), { titulo: T()?.nome });
  const b = document.querySelector('[data-act="salvarMarca"]'); if (b) b.disabled = false;
  S.pend = true; // redesenha a prévia (nomes, logo) quando o campo perder o foco
}

function categorias() {
  const t = T();
  const formatoTxt = c => ({ grupos: `Grupos (${c.chaves} chaves, ${c.classificam} por chave${+c.extras ? ` + ${c.extras} melhores ${+c.classificam + 1}º` : ''}) + mata-mata`, todos: 'Todos contra todos', mata: 'Mata-mata direto' })[c.formato];
  return `<div class="stack"><div class="sect-head"><div><h2>Categorias</h2><p class="muted small" style="margin:0">Cada categoria tem formato, pontuação, vagas e quadras próprias.</p></div><button class="btn" data-act="addCat">Adicionar categoria</button></div>
  ${cats().map(c => S.editCat === c.id ? catForm(c, t) : `<div class="panel row between" style="${estCat(c)}"><div style="min-width:0"><h3 class="cat-tag">${esc(c.nome)}</h3><div class="small muted">${formatoTxt(c)}${sorteadas(c) ? ` · duplas sorteadas${c.potes ? ' com 2 potes' : ''}` : ''} · ${regraTxt(c)}${c.finalSets && c.formato !== 'todos' ? ` · final em 3 sets (${c.pontosSet || c.pontos}/${c.pontosSet || c.pontos}/${c.pontosTie || 15})` : ''} · ${c.vagas} vagas · ${brl(c.valor)}/${c.cobranca}${c.quadras?.length ? ' · ' + esc(c.quadras.join(', ')) : ''}</div></div>
    <div class="row"><button class="btn ghost sm" data-act="editCat" data-id="${c.id}">Editar</button><button class="btn danger sm" data-act="delCat" data-id="${c.id}">Remover</button></div></div>`).join('') || '<div class="panel muted">Nenhuma categoria. Adicione Iniciante, Misto, Feminino…</div>'}
  </div>`;
}
function catForm(c, t) {
  const f = (n, l, v, type = 'text', extra = '') => `<label class="field"><span>${l}</span><input id="cf-${n}" name="${n}" type="${type}" value="${esc(v)}" ${extra}></label>`;
  return `<form class="panel form" data-form="cat" data-id="${c.id}">
   <label class="field full"><span>Nome</span><input id="cf-nome" name="nome" type="text" value="${esc(c.nome)}" required></label>
   <label class="field"><span>Formato</span><select id="cf-formato" name="formato">${[['grupos', 'Grupos + mata-mata'], ['todos', 'Todos contra todos'], ['mata', 'Mata-mata direto']].map(([k, l]) => `<option value="${k}"${c.formato === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
   ${f('chaves', 'Número de chaves', c.chaves, 'number', 'min="1"')}${f('classificam', 'Classificam por chave', c.classificam, 'number', 'min="1"')}${f('extras', 'Melhores próximos colocados', c.extras, 'number', 'min="0"')}
   ${f('pontos', 'Jogo até (pontos)', c.pontos, 'number', 'min="1"')}${f('teto', 'Teto de pontos (0 = sem)', c.teto, 'number', 'min="0"')}
   ${f('vagas', 'Vagas (duplas)', c.vagas, 'number', 'min="2"')}${f('valor', 'Valor da inscrição (R$)', c.valor, 'number', 'min="0" step="0.01"')}
   <label class="field"><span>Cobrança</span><select id="cf-cob" name="cobranca"><option value="dupla"${c.cobranca === 'dupla' ? ' selected' : ''}>por dupla</option><option value="atleta"${c.cobranca === 'atleta' ? ' selected' : ''}>por atleta</option></select></label>
   <label class="check"><input id="cf-v" name="vantagem" type="checkbox"${c.vantagem ? ' checked' : ''}> Vantagem de 2 pontos</label>
   <label class="check"><input id="cf-3" name="terceiro" type="checkbox"${c.terceiro ? ' checked' : ''}> Disputa de 3º lugar</label>
   <label class="field"><span>Como as duplas são formadas</span><select id="cf-modo" name="modoDuplas"><option value="fixas"${!sorteadas(c) ? ' selected' : ''}>Duplas fixas (se inscrevem juntas)</option><option value="sorteadas"${sorteadas(c) ? ' selected' : ''}>Duplas sorteadas entre os atletas</option></select></label>
   <label class="check"><input id="cf-potes" name="potes" type="checkbox"${c.potes ? ' checked' : ''}> Sortear com 2 potes (cada dupla tem um atleta de cada pote)</label>
   <label class="field"><span>Dia da categoria</span><input id="cf-dia" name="dia" type="date" value="${esc(c.dia || '')}"></label>
   <label class="field"><span>Horário de início</span><input id="cf-hora" name="hora" type="time" value="${esc(c.hora || '')}"></label>
   <label class="field full"><span>Regra específica da categoria (o atleta precisa aceitar na inscrição)</span><textarea id="cf-regra" name="regra" maxlength="1500" placeholder="Ex.: no Misto Estreante, o atleta masculino pode ser de nível até Amador C.">${esc(c.regra || '')}</textarea></label>
   <label class="check full"><input id="cf-fs" name="finalSets" type="checkbox"${c.finalSets ? ' checked' : ''}> Final em melhor de 3 sets</label>
   ${f('pontosSet', 'Sets da final até (pontos)', c.pontosSet || c.pontos || 18, 'number', 'min="1"')}${f('pontosTie', '3º set até (pontos)', c.pontosTie || 15, 'number', 'min="1"')}
   <fieldset class="full opcoes"><legend>Cor da categoria (usada nos jogos, chaves, telão e placar)</legend><div class="swatches">
     <label style="--sw:${corCat({ ...c, cor: '' })}"><input type="radio" name="cor" value=""${!c.cor ? ' checked' : ''}><i></i>Automática</label>
     ${marca().paleta.map((p, i) => `<label style="--sw:${MK.corCategoria(marca(), p.cor)}"><input id="cf-cor${i}" type="radio" name="cor" value="${p.cor}"${(c.cor || '').toUpperCase() === p.cor ? ' checked' : ''}><i></i>${esc(p.nome)}</label>`).join('')}
     <label style="--sw:${c.cor && !marca().paleta.some(p => p.cor === (c.cor || '').toUpperCase()) ? c.cor : 'var(--muted)'}"><input type="radio" name="cor" value="outra"${c.cor && !marca().paleta.some(p => p.cor === (c.cor || '').toUpperCase()) ? ' checked' : ''}><i></i>Outra:</label>
     <input id="cf-cor-x" type="color" name="corOutra" value="${MK.normHex(c.cor, '#888888')}" aria-label="Outra cor">
   </div></fieldset>
   <fieldset class="full opcoes"><legend>Quadras desta categoria (nenhuma marcada = todas)</legend><div class="row">${(t.quadras || []).map((q, i) => `<label class="check"><input id="cf-q${i}" type="checkbox" name="q" value="${esc(q)}"${c.quadras?.includes(q) ? ' checked' : ''}> ${esc(q)}</label>`).join('')}</div></fieldset>
   <div class="row full"><button class="btn">Salvar categoria</button><button type="button" class="btn ghost" data-act="editCat" data-id="">Cancelar</button></div></form>`;
}

function catPicker() {
  if (!S.cat || !catById(S.cat)) S.cat = cats()[0]?.id || null;
  return cats().length > 1 ? `<select id="pickCat" data-change="cat" aria-label="Categoria" style="max-width:260px">${cats().map(c => `<option value="${c.id}"${c.id === S.cat ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>` : '';
}
const semCat = () => `<div class="panel muted">${S.org ? 'Crie uma categoria na aba Categorias para começar.' : 'As categorias ainda não foram cadastradas.'}</div>`;

function duplasV() {
  const pk = catPicker(); if (!S.cat) return semCat(); const c = catById(S.cat);
  const ds = duplas().filter(d => d.cat === c.id); const temJogos = S.jogos.some(j => j.cat === c.id);
  return `<div class="stack"><div class="sect-head"><div><h2>Duplas · ${esc(c.nome)}</h2><p class="muted small num" style="margin:0">${ds.length} de ${c.vagas} vagas${sorteadas(c) ? ' · duplas sorteadas' : ''}</p></div><div class="row">${pk}
   <button class="btn" data-act="sortear" data-id="${c.id}"${ds.length < 2 ? ' disabled' : ''}>${temJogos ? 'Refazer sorteio das chaves' : c.formato === 'mata' ? 'Gerar chave' : c.formato === 'todos' ? 'Gerar tabela' : 'Sortear chaves'}</button></div></div>
  ${sorteadas(c) ? atletasHTML(c) : `<div class="grid2">
   <form class="panel form" data-form="addDupla"><h3 class="full">Adicionar dupla</h3>
     <label class="field"><span>Atleta 1</span><input id="ad-1" name="j1" type="text" required></label>
     <label class="field"><span>Atleta 2</span><input id="ad-2" name="j2" type="text" required></label>
     <label class="check full"><input id="ad-c" name="cabeca" type="checkbox"> Cabeça de chave</label>
     <div class="full"><button class="btn">Adicionar</button></div></form>
   <form class="panel form" data-form="colar"><h3 class="full">Colar lista do WhatsApp</h3>
     <label class="field full"><span>Uma dupla por linha, separando os atletas com / ou e</span><textarea id="cl-t" name="lista" placeholder="Rafa / Tiago&#10;Bruno e Caio"></textarea></label>
     <div class="full"><button class="btn ghost">Importar duplas</button></div></form>
  </div>`}
  <section class="panel">${sorteadas(c) ? '<h3>Duplas formadas</h3>' : ''}<div class="tw"><table><thead><tr><th>#</th><th>Dupla</th><th>Chave</th><th>Cabeça</th><th></th></tr></thead><tbody>
   ${ds.map((d, i) => `<tr><td class="pos">${i + 1}</td><td>${esc(d.j1)} / ${esc(d.j2)}</td><td>${esc(d.chave || '—')}</td><td><input id="cb-${d.id}" type="checkbox" data-change="cabeca" data-id="${d.id}"${d.cabeca ? ' checked' : ''} aria-label="Cabeça de chave"></td><td class="n"><button class="link small" data-act="delDupla" data-id="${d.id}">Remover</button></td></tr>`).join('') || `<tr><td colspan="5" class="muted">${sorteadas(c) ? 'Cadastre os atletas e clique em Sortear duplas.' : 'Nenhuma dupla nesta categoria.'}</td></tr>`}
  </tbody></table></div></section>${temJogos ? '<p class="small muted">Alterar duplas depois do sorteio não muda os jogos já gerados. Refaça o sorteio para incluir as mudanças.</p>' : ''}</div>`;
}

function atletasHTML(c) {
  const as = atletas().filter(a => a.cat === c.id);
  const n1 = as.filter(a => (a.pote || 1) === 1).length, n2 = as.filter(a => a.pote === 2).length;
  const temDuplas = duplas().some(d => d.cat === c.id);
  const previa = c.potes ? Math.min(n1, n2) : Math.floor(as.length / 2);
  const sobra = c.potes ? Math.abs(n1 - n2) : as.length % 2;
  const poteSel = (id, v) => `<select id="${id}" name="pote"${id.startsWith('pt-') ? ` data-change="pote" data-id="${id.slice(3)}" aria-label="Pote"` : ''}><option value="1"${v !== 2 ? ' selected' : ''}>Pote 1</option><option value="2"${v === 2 ? ' selected' : ''}>Pote 2</option></select>`;
  return `<section class="panel stack" style="gap:14px">
    <div class="sect-head"><div><h3>Atletas para o sorteio</h3><p class="small muted num" style="margin:0">${as.length} atletas${c.potes ? ` · pote 1: ${n1} · pote 2: ${n2}` : ''} · formam ${previa} duplas${sobra ? ` · ${sobra} ${sobra === 1 ? 'fica' : 'ficam'} sem par` : ''}</p></div>
    <button class="btn sea" data-act="sortearDuplas" data-id="${c.id}"${previa < 1 ? ' disabled' : ''}>${temDuplas ? 'Sortear duplas de novo' : 'Sortear duplas'}</button></div>
    ${c.potes ? '<p class="small muted" style="margin:0">Cada dupla terá um atleta do pote 1 e um do pote 2. Use, por exemplo, experientes no pote 1 e iniciantes no pote 2, ou homens e mulheres no misto.</p>' : ''}
    <div class="grid2">
     <form class="form" data-form="addAtleta"><label class="field ${c.potes ? '' : 'full'}"><span>Nome do atleta</span><input id="aa-n" name="nome" type="text" maxlength="60" required></label>
       ${c.potes ? `<label class="field"><span>Pote</span>${poteSel('aa-p', 1)}</label>` : ''}<div class="full"><button class="btn">Adicionar atleta</button></div></form>
     <form class="form" data-form="colarAtletas"><label class="field full"><span>Colar lista (um atleta por linha${c.potes ? '; termine com "- 2" para o pote 2' : ''})</span><textarea id="ca-t" name="lista" placeholder="${c.potes ? 'Rafa&#10;Tiago - 2' : 'Rafa&#10;Tiago'}"></textarea></label><div class="full"><button class="btn ghost">Importar atletas</button></div></form>
    </div>
    ${as.length ? `<div class="tw"><table><thead><tr><th>#</th><th>Atleta</th>${c.potes ? '<th>Pote</th>' : ''}<th>Na dupla</th><th></th></tr></thead><tbody>
      ${as.map((a, i) => { const d = duplas().find(x => x.cat === c.id && (x.a1 === a.id || x.a2 === a.id)); return `<tr><td class="pos">${i + 1}</td><td>${esc(a.nome)}</td>${c.potes ? `<td>${poteSel('pt-' + a.id, a.pote)}</td>` : ''}<td class="small muted">${d ? esc(d.a1 === a.id ? d.j2 : d.j1) : '—'}</td><td class="n"><button class="link small" data-act="delAtleta" data-id="${a.id}">Remover</button></td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="muted" style="margin:0">Nenhum atleta cadastrado nesta categoria.</p>'}
  </section>`;
}
async function sortearDuplasCat(c) {
  const as = atletas().filter(a => a.cat === c.id);
  const { pares, sobra } = L.sortearDuplas(as, !!c.potes);
  if (!pares.length) return toast(c.potes ? 'Cadastre atletas nos dois potes.' : 'Cadastre pelo menos 2 atletas.');
  const novas = pares.map(([a, b]) => ({ id: uid(), cat: c.id, j1: a.nome, j2: b.nome, a1: a.id, a2: b.id, cabeca: false, chave: null }));
  if (S.jogos.some(j => j.cat === c.id)) await lote(apagarJogosOps(c.id));
  await saveT({ duplas: [...duplas().filter(d => d.cat !== c.id), ...novas] });
  render();
  toast(`${novas.length} duplas sorteadas.${sobra.length ? ' Sem par: ' + sobra.map(a => a.nome).join(', ') + '.' : ''} Agora sorteie as chaves.`);
}

function jogosV() {
  const pk = catPicker(); if (!S.cat) return semCat(); const c = catById(S.cat); const prev = previsoes();
  const js = jogosCat(c.id).sort((x, y) => x.ordem - y.ordem);
  const grp = {}; js.forEach(j => { const k = j.fase === 'grupo' ? `Rodada ${j.rodada}` : j.rodadaNome; (grp[k] = grp[k] || []).push(j); });
  return `<div class="stack" style="${estCat(c)}"><div class="sect-head"><div><div class="eyebrow cat-tag">${esc(c.nome)}</div><h2>Jogos</h2><p class="muted small" style="margin:0">${regraTxt(c)}</p></div>${pk}</div>
  ${Object.keys(grp).length ? Object.entries(grp).map(([k, g]) => `<section class="panel"><h3>${esc(k)}</h3><div class="games">${g.map(j => gameRow(j, { prev, edit: true })).join('')}</div></section>`).join('') : `<div class="panel muted">Os jogos aparecem aqui depois do sorteio.</div>`}</div>`;
}

function classificacao() {
  const pk = catPicker(); if (!S.cat) return semCat(); const c = catById(S.cat);
  if (c.formato === 'mata') return `<div class="stack"><div class="sect-head"><h2>Classificação · ${esc(c.nome)}</h2>${pk}</div><div class="panel muted">Esta categoria é mata-mata direto. Veja a aba Mata-mata.</div></div>`;
  const chs = chavesCat(c.id); const gj = S.jogos.filter(j => j.cat === c.id && j.fase === 'grupo'); const done = gj.length && gj.every(j => j.status === 'fim');
  const temMata = S.jogos.some(j => j.cat === c.id && j.fase === 'mata');
  const sel = new Set(c.formato === 'grupos' ? L.classificados(c, duplas(), S.jogos, manuais()) : []);
  return `<div class="stack" style="${estCat(c)}"><div class="sect-head"><div><div class="eyebrow cat-tag">${esc(c.nome)}</div><h2>Classificação</h2><p class="muted small" style="margin:0">Critérios: vitórias, saldo, pontos feitos${opt('desempate') ? ', desempate do organizador' : ''} e confronto direto.</p></div><div class="row">${pk}
   ${S.org && c.formato === 'grupos' ? `<button class="btn" data-act="gerarMata" data-id="${c.id}"${done ? '' : ' disabled'}>${temMata ? 'Refazer mata-mata' : 'Gerar mata-mata'}</button>` : ''}</div></div>
   ${S.org && c.formato === 'grupos' && !done && gj.length ? `<p class="small muted" style="margin:0">O mata-mata fica disponível quando os ${gj.length} jogos da fase de grupos terminarem (${gj.filter(j => j.status === 'fim').length} encerrados).</p>` : ''}
  ${chs.length ? `<div class="grid2">${chs.map(ch => `<section class="panel"><h3>${c.formato === 'todos' ? 'Tabela' : 'Chave ' + ch}</h3><div class="tw"><table><thead><tr><th></th><th>Dupla</th><th class="n">J</th><th class="n">V</th><th class="n">SG</th><th class="n">PF</th>${S.org && opt('desempate') ? '<th></th>' : ''}</tr></thead><tbody>
    ${(() => { const tb = tabela(c.id, ch), mov = S.org && opt('desempate'), igual = (x, y) => x && y && x.v === y.v && x.sg === y.sg && x.pp === y.pp && x.j > 0;
      return tb.map((r, i) => `<tr class="${(c.formato === 'grupos' ? sel.has(r.id) : i < 3) ? 'q' : ''}"><td class="pos">${i + 1}</td><td>${esc(dn(r.id))}${r.empate && r.j > 0 && S.org ? ' <span class="chip">empate</span>' : ''}</td><td class="n">${r.j}</td><td class="n">${r.v}</td><td class="n">${r.sg > 0 ? '+' : ''}${r.sg}</td><td class="n">${r.pp}</td>${mov ? `<td class="n mv">${igual(r, tb[i - 1]) ? `<button class="link" data-act="desempate" data-c="${c.id}" data-ch="${ch}" data-i="${i}" data-dir="-1" aria-label="Subir ${esc(dn(r.id))}">▲</button>` : ''}${igual(r, tb[i + 1]) ? `<button class="link" data-act="desempate" data-c="${c.id}" data-ch="${ch}" data-i="${i}" data-dir="1" aria-label="Descer ${esc(dn(r.id))}">▼</button>` : ''}</td>` : ''}</tr>`).join(''); })()}</tbody></table></div>
    ${S.org && opt('desempate') && manuais()[c.id + '|' + ch] ? `<button class="link small" data-act="limparDesempate" data-c="${c.id}" data-ch="${ch}">Desfazer desempate manual desta chave</button>` : ''}</section>`).join('')}</div>
    ${S.org && opt('desempate') ? '<p class="small muted" style="margin:0">Quando duas duplas empatam em vitórias, saldo e pontos, use ▲ ▼ para definir a ordem.</p>' : ''}
    <p class="small muted" style="margin:0">A barra colorida marca as duplas ${c.formato === 'todos' ? 'no pódio' : 'classificadas para o mata-mata'}.</p>` : '<div class="panel muted">A classificação aparece depois do sorteio das chaves.</div>'}</div>`;
}

function bracketHTML(c) {
  const ms = S.jogos.filter(j => j.cat === c.id && j.fase === 'mata'); if (!ms.length) return '';
  const niveis = [...new Set(ms.map(j => j.nivel))].sort((a, b) => a - b);
  const box = j => {
    if (j.status === 'bye') return `<div class="bm"><div class="w"><span>${esc(dn(j.vencedor))}</span><span>avança</span></div></div>`;
    const wa = j.status === 'fim' && j.vencedor === j.a, wb = j.status === 'fim' && j.vencedor === j.b, sc = v => j.status === 'agendado' ? '' : v;
    return `<div class="bm${j.status === 'aovivo' ? ' live' : ''}"><div class="${wa ? 'w' : ''}"><span>${esc(dn(j.a))}</span><span class="num">${sc(j.pa)}</span></div><div class="${wb ? 'w' : ''}"><span>${esc(dn(j.b))}</span><span class="num">${sc(j.pb)}</span></div></div>`;
  };
  return `<div class="bracket">${niveis.map(n => {
    const col = ms.filter(j => j.nivel === n && j.rodadaNome !== '3º lugar').sort((a, b) => a.idx - b.idx); const t3 = ms.find(j => j.nivel === n && j.rodadaNome === '3º lugar');
    return `<div class="bcol"><h4>${esc(col[0]?.rodadaNome || '')}</h4>${col.map(box).join('')}${t3 ? `<h4 style="margin-top:14px">3º lugar</h4>${box(t3)}` : ''}</div>`;
  }).join('')}</div>`;
}
function chaveV() {
  const pk = catPicker(); if (!S.cat) return semCat(); const c = catById(S.cat); const pd = podio(c); const b = bracketHTML(c);
  return `<div class="stack" style="${estCat(c)}"><div class="sect-head"><div><div class="eyebrow cat-tag">${esc(c.nome)}</div><h2>Mata-mata</h2></div>${pk}</div>
  ${pd ? `<section class="panel stack"><h3>Pódio</h3>${podioHTML(pd)}</section>` : ''}
  ${b ? `<section class="panel">${b}</section>` : `<div class="panel muted">${c.formato === 'todos' ? 'Esta categoria é decidida na tabela de todos contra todos.' : 'A chave do mata-mata aparece quando a fase de grupos terminar e o organizador gerar o mata-mata.'}</div>`}</div>`;
}

function mesario() {
  const t = T(); if (!podeEscrever()) return `<div class="panel muted">Para lançar placares, abra o link de mesário enviado pelo organizador.</div>`;
  if (!S.quadra || !t.quadras.includes(S.quadra)) S.quadra = null;
  const qsel = `<div class="courts" role="group" aria-label="Quadra">${t.quadras.map(q => `<button data-act="quadra" data-q="${esc(q)}" aria-pressed="${S.quadra === q}">${esc(q)}${S.jogos.some(j => j.status === 'aovivo' && j.quadra === q) ? ' ●' : ''}</button>`).join('')}</div>`;
  if (!S.quadra) return `<div class="stack"><h2>Mesário</h2><p class="muted" style="margin:0">Escolha a quadra em que você vai marcar os pontos.</p>${qsel}</div>`;
  const j = S.jogos.find(x => x.status === 'aovivo' && x.quadra === S.quadra);
  if (!j) {
    const nx = fila(S.quadra)[0];
    return `<div class="stack"><h2>Mesário · ${esc(S.quadra)}</h2>${qsel}<div class="board" style="${estCat(nx ? catById(nx.cat) : null, 'board')}"><div class="wm" aria-hidden="true">${logoHTML(marca(), '420px', 'var(--cat)')}</div><div class="bar"><span>Quadra livre</span></div>
    ${nx ? `<div style="text-align:center"><div class="label" style="color:var(--board-dim)">Próximo da fila · ${esc(catById(nx.cat)?.nome || '')} · ${esc(nx.fase === 'grupo' ? 'Chave ' + nx.chave : nx.rodadaNome)}</div><h2 style="margin:8px 0 16px">${esc(dn(nx.a))} × ${esc(dn(nx.b))}</h2><button class="btn" data-act="chamar">Chamar próximo jogo</button></div>` : '<p style="text-align:center;margin:0">Nenhum jogo disponível para esta quadra agora.</p>'}</div></div>`;
  }
  const c = catById(j.cat), md3 = emSets(j), rg = regraAtual(j), fim = L.fimValido(rg, j.pa, j.pb);
  const sv = L.setsVencidos(j.sets), nSet = (j.sets || []).length + 1;
  const decide = md3 && fim && ((j.pa > j.pb ? sv.a : sv.b) + 1 === 2);
  const side = (k, id) => `<div class="side"><div class="nm">${esc(dn(id))}</div><div class="pt">${j[k]}</div><div class="pm"><button class="minus" data-act="ponto" data-k="${k}" data-d="-1" aria-label="Tirar ponto"${j[k] <= 0 ? ' disabled' : ''}>−</button><button class="plus" data-act="ponto" data-k="${k}" data-d="1" aria-label="Somar ponto"${fim ? ' disabled' : ''}>+</button></div></div>`;
  return `<div class="stack"><h2>Mesário · ${esc(S.quadra)}</h2>${qsel}
  <div class="board" style="${estCat(c, 'board')}"><div class="wm" aria-hidden="true">${logoHTML(marca(), '420px', 'var(--cat)')}</div><div class="bar"><span class="chip live">ao vivo</span><span>${esc(c.nome)} · ${esc(j.fase === 'grupo' ? 'Chave ' + j.chave : j.rodadaNome)} · ${md3 ? `${nSet}º set até ${rg.pontos}${c.vantagem ? ', vantagem de 2' : ''}` : regraTxt(c)}</span></div>
   ${md3 ? `<div class="setsbar"><span>Sets</span><b class="num">${sv.a} × ${sv.b}</b>${(j.sets || []).length ? `<span>${(j.sets || []).map(x => x.join('-')).join(' · ')}</span>` : ''}</div>` : ''}
   <div class="sides">${side('pa', j.a)}${side('pb', j.b)}</div>
   <div class="row between"><button class="btn ghost sm" data-act="devolver">Devolver à fila</button>
   <button class="btn" data-act="encerrar"${fim ? '' : ' disabled'}>${!fim ? (md3 ? `${nSet}º set em andamento` : 'Jogo em andamento') : md3 && !decide ? `Fechar ${nSet}º set` : 'Encerrar jogo'}</button></div></div></div>`;
}

/* ---------- página de inscrição ---------- */
const TERMOS_PADRAO = [
  { id: 'apto', titulo: 'Declaração de aptidão física', texto: 'Declaro que não possuo impedimento de ordem médica para a prática de atividade física e esportiva e que estou em condições de saúde compatíveis para participar do torneio.' },
  { id: 'imagem', titulo: 'Autorização de uso de imagem', texto: 'Autorizo, de forma livre e gratuita, a organização do torneio, seus responsáveis e parceiros a captar e utilizar minha imagem, voz e demais registros audiovisuais feitos durante o evento.' },
  { id: 'categoria', titulo: 'Desclassificação por incompatibilidade de categoria', texto: 'A escolha da categoria é de responsabilidade da dupla, que deve estar de acordo com seu nível técnico. A organização poderá avaliar as duplas e, constatada incompatibilidade, desclassificá-las a qualquer momento, sem devolução da taxa de inscrição.' },
];
const TAMANHOS_PADRAO = 'P, M, G, GG, P feminino, M feminino, G feminino, GG feminino';
const TIPOS_PERGUNTA = [['curta', 'Resposta curta'], ['longa', 'Parágrafo'], ['unica', 'Escolha uma opção'], ['varias', 'Várias opções']];
function inscCfg() {
  return {
    edicao: '', boasVindas: '', datas: '', instagram: '', incluso: '', pixBanco: '', outrosHorarios: '', aviso: 'A inscrição só é confirmada depois do pagamento.',
    email: false, instagramAtletas: true, uniforme: true, tamanhos: TAMANHOS_PADRAO, nomeDupla: true,
    termos: TERMOS_PADRAO, perguntas: [], ...(T()?.insc || {}),
  };
}
const listaTam = cfg => String(cfg.tamanhos || '').split(',').map(s => s.trim()).filter(Boolean);
const linhas = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
const igUser = h => String(h || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
const igLink = h => igUser(h) ? 'https://instagram.com/' + igUser(h) : '';
const mapaLink = l => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l);
const horaTxt = h => !h ? '' : h.endsWith(':00') ? h.slice(0, 2).replace(/^0/, '') + 'h' : h.replace(':', 'h').replace(/^0/, '');
const diaTxt = d => { const p = partesData(d); return p ? `${p.semana} · ${p.dm}` : ''; };
function cronograma() {
  const itens = cats().filter(c => c.dia || c.hora).sort((a, b) => ((a.dia || '9') + (a.hora || '')).localeCompare((b.dia || '9') + (b.hora || '')));
  const dias = []; itens.forEach(c => { let g = dias.find(x => x.dia === (c.dia || '')); if (!g) dias.push(g = { dia: c.dia || '', itens: [] }); g.itens.push(c); });
  return dias;
}
const precoTxt = c => `${brl(c.valor)} ${c.cobranca === 'atleta' ? 'por atleta' : 'por dupla'}`;

function paginaInscricao() {
  const t = T(), cfg = inscCfg(), d = partesData(t.data), crono = cronograma();
  if (S.inscOk && S.inscOk.tid === S.tid) return inscConfirmada(S.inscOk);
  const eb = [cfg.edicao, t.local].filter(Boolean).map(esc).join(' · ');
  const quando = cfg.datas || (d ? `${d.semana}, ${d.dm.replace('.', '/')} de ${d.mes} de ${d.ano}` : '');
  const cardsCat = cats().map(c => {
    const v = vagasCat(c), quandoCat = [diaTxt(c.dia), horaTxt(c.hora)].filter(Boolean).join(' · ');
    return `<div class="ins-cat" style="${estCat(c)}"><div class="row between" style="gap:8px"><h4>${esc(c.nome)}</h4>${v ? `<span class="chip">${v} ${sorteadas(c) ? (v === 1 ? 'vaga de atleta' : 'vagas de atleta') : (v === 1 ? 'vaga' : 'vagas')}</span>` : '<span class="chip">esgotada</span>'}</div>
      <b class="preco">${precoTxt(c)}</b>
      ${quandoCat ? `<span class="small muted">${esc(quandoCat)}</span>` : ''}
      ${sorteadas(c) ? '<span class="small muted">Inscrição individual: as duplas são sorteadas.</span>' : ''}
      ${c.regra ? `<details class="small"><summary>Regra da categoria</summary><p style="margin:6px 0 0">${esc(c.regra)}</p></details>` : ''}</div>`;
  }).join('');
  const pix = t.pix ? `<div class="pix"><div style="flex:1;min-width:0"><div class="eyebrow">Pix${t.pixNome ? ' · ' + esc(t.pixNome) : ''}${cfg.pixBanco ? ' · ' + esc(cfg.pixBanco) : ''}</div><code id="pixk">${esc(t.pix)}</code></div><button type="button" class="btn sm" data-act="copiarPix">Copiar chave Pix</button></div>` : '<p class="small muted" style="margin:0">O organizador ainda não informou a chave Pix.</p>';
  return `<div class="stack ins">
  <section class="ins-hero">
    <div class="eyebrow">${eb || 'Inscrições'}</div>
    <h1 class="tit">${esc(t.nome)}</h1>
    <div class="ins-info">
      ${quando ? `<div><span class="eyebrow">Data</span><b>${esc(quando)}</b></div>` : ''}
      ${t.local ? `<div><span class="eyebrow">Local</span><b>${esc(t.local)}</b><a class="link small" href="${mapaLink(t.local)}" target="_blank" rel="noopener">Ver no mapa</a></div>` : ''}
      ${cfg.instagram ? `<div><span class="eyebrow">Dúvidas</span><b>@${esc(igUser(cfg.instagram))}</b><a class="link small" href="${igLink(cfg.instagram)}" target="_blank" rel="noopener">Abrir Instagram</a></div>` : ''}
      ${t.contato ? `<div><span class="eyebrow">WhatsApp</span><b style="user-select:all">${esc(t.contato)}</b></div>` : ''}
    </div>
    ${cfg.boasVindas ? `<div class="ins-texto">${linhas(cfg.boasVindas).map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
  </section>

  <section class="ins-sec"><h3>Categorias</h3><div class="ins-cats">${cardsCat || '<p class="muted">As categorias ainda não foram cadastradas.</p>'}</div></section>

  ${crono.length || cfg.outrosHorarios ? `<section class="ins-sec"><h3>Cronograma</h3><div class="crono">
    ${crono.map(g => `<div class="dia"><div class="eyebrow">${esc(diaTxt(g.dia) || 'Data a definir')}</div>${g.itens.map(c => `<div class="it" style="${estCat(c)}"><b class="num">${esc(horaTxt(c.hora) || '—')}</b><span class="cat-tag">${esc(c.nome)}</span></div>`).join('')}</div>`).join('')}
    ${cfg.outrosHorarios ? `<div class="dia"><div class="eyebrow">Também na programação</div>${linhas(cfg.outrosHorarios).map(l => `<div class="it"><span>${esc(l)}</span></div>`).join('')}</div>` : ''}
  </div></section>` : ''}

  ${cfg.incluso ? `<section class="ins-sec"><h3>O que está incluso</h3><ul class="incluso">${linhas(cfg.incluso).map(l => `<li>${esc(l)}</li>`).join('')}</ul></section>` : ''}

  ${!t.inscricoes ? '<div class="panel muted">As inscrições deste torneio estão fechadas.</div>' : formInscricao(cfg, pix)}
  </div>`;
}

function formInscricao(cfg, pix) {
  const tam = listaTam(cfg), selTam = (id, n) => `<label class="field"><span>Uniforme</span><select id="${id}" name="${n}" required><option value="">Escolha o tamanho</option>${tam.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>`;
  const atleta = (n, extra = '') => `<fieldset class="ins-atleta" id="in-a${n}"${extra}><legend>Atleta ${n}</legend><div class="form">
      <label class="field"><span id="in-${n}-l">Nome completo</span><input id="in-${n}" name="j${n}" type="text" maxlength="60" required autocomplete="off"></label>
      ${cfg.instagramAtletas ? `<label class="field"><span>Instagram</span><input id="in-ig${n}" name="ig${n}" type="text" maxlength="40" placeholder="@usuario" required autocapitalize="off"></label>` : ''}
      ${cfg.uniforme && tam.length ? selTam('in-u' + n, 'uni' + n) : ''}
    </div></fieldset>`;
  const pergunta = p => {
    const req = p.obrig ? ' required' : '', nome = 'q_' + p.id, ops = String(p.opcoes || '').split(',').map(s => s.trim()).filter(Boolean);
    const rot = `<span>${esc(p.texto)}${p.obrig ? '' : ' (opcional)'}</span>`;
    if (p.tipo === 'longa') return `<label class="field full">${rot}<textarea id="iq-${p.id}" name="${nome}" maxlength="600"${req}></textarea></label>`;
    if (p.tipo === 'unica') return `<fieldset class="field full ins-ops"><legend>${esc(p.texto)}${p.obrig ? '' : ' (opcional)'}</legend>${ops.map((o, k) => `<label class="check"><input id="iq-${p.id}-${k}" type="radio" name="${nome}" value="${esc(o)}"${req}> ${esc(o)}</label>`).join('')}</fieldset>`;
    if (p.tipo === 'varias') return `<fieldset class="field full ins-ops" data-varias="${p.id}"${p.obrig ? ' data-obrig="1"' : ''}><legend>${esc(p.texto)}${p.obrig ? '' : ' (opcional)'}</legend>${ops.map((o, k) => `<label class="check"><input id="iq-${p.id}-${k}" type="checkbox" name="${nome}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</fieldset>`;
    return `<label class="field full">${rot}<input id="iq-${p.id}" name="${nome}" type="text" maxlength="200"${req}></label>`;
  };
  let n = 0; const passo = (titulo, corpo, attrs = '') => `<section class="ins-passo"${attrs}><h3><span class="num">${String(++n).padStart(2, '0')}</span>${titulo}</h3>${corpo}</section>`;
  return `<form class="panel ins-form" data-form="insc">
    <div class="sect-head"><div><div class="eyebrow">Formulário</div><h2>Faça sua inscrição</h2></div><span class="small muted">* todos os campos são obrigatórios, exceto os marcados como opcionais</span></div>
    ${passo('Categoria', `<div class="ins-opcoes">${cats().map(c => { const v = vagasCat(c); return `<label class="ins-opt" style="${estCat(c)}"><input type="radio" name="cat" value="${c.id}" data-change="inscCat"${v ? '' : ' disabled'} required><span><b>${esc(c.nome)}</b><small>${precoTxt(c)}${v ? '' : ' · esgotada'}</small></span></label>`; }).join('')}</div>
      <p class="small muted" id="in-ind" hidden style="margin:0">Nesta categoria as duplas são sorteadas entre os atletas. Inscreva só você.</p>`)}
    ${passo('Atletas', `${atleta(1)}${atleta(2)}
      ${cfg.nomeDupla ? `<label class="field" id="in-nd-w"><span>Nome da dupla (opcional)</span><input id="in-nd" name="nomeDupla" type="text" maxlength="60" placeholder="Como vocês querem aparecer no telão"></label>` : ''}`)}
    ${passo('Contato', `<div class="form">
      <label class="field"><span>Nome do responsável pela inscrição</span><input id="in-r" name="resp" type="text" maxlength="60" required></label>
      <label class="field"><span>WhatsApp</span><input id="in-z" name="zap" type="tel" maxlength="30" required placeholder="(11) 90000-0000"></label>
      ${cfg.email ? '<label class="field"><span>E-mail</span><input id="in-e" name="email" type="email" maxlength="80" required></label>' : ''}
    </div>`)}
    ${(cfg.perguntas || []).length ? passo('Perguntas', `<div class="form">${cfg.perguntas.map(pergunta).join('')}</div>`) : ''}
    ${passo('Regras e termos', `<div class="stack" style="gap:12px">
      ${cats().filter(c => c.regra).map(c => `<div class="termo" data-regra="${c.id}" hidden style="${estCat(c)}"><b class="cat-tag">Regra · ${esc(c.nome)}</b><p>${esc(c.regra)}</p><label class="check"><input id="in-rg-${c.id}" type="checkbox" name="aceite" value="regra" required disabled> Li e concordo com a regra da categoria</label></div>`).join('')}
      ${(cfg.termos || []).map(tm => `<div class="termo"><b>${esc(tm.titulo)}</b><p>${esc(tm.texto)}</p><label class="check"><input id="in-t-${tm.id}" type="checkbox" name="aceite" value="${esc(tm.id)}" required> Li e aceito</label></div>`).join('') || '<p class="small muted" style="margin:0">Sem termos para aceitar.</p>'}
    </div>`)}
    ${passo('Pagamento', `<div class="stack" style="gap:12px"><div id="in-valor" class="ins-valor small muted">Escolha a categoria para ver o valor.</div>${pix}
      ${opt('comprovante') ? '<label class="field"><span>Comprovante do Pix (foto ou print)</span><input id="in-f" name="foto" type="file" accept="image/*" required></label>' : `<p class="small muted" style="margin:0">Envie o comprovante ao organizador${T().contato ? ' pelo WhatsApp ' + esc(T().contato) : ''}.</p>`}
      ${cfg.aviso ? `<p class="dica" style="margin:0">${esc(cfg.aviso)}</p>` : ''}</div>`)}
    <div class="row between"><button class="btn" id="in-enviar">Enviar inscrição</button><span class="small muted" id="in-erro" role="alert"></span></div>
  </form>`;
}

/** Ajusta o formulário à categoria escolhida: individual ou dupla, regra específica e valor. */
function ajustarFormInsc(cid) {
  const c = catById(cid), ind = sorteadas(c);
  const a2 = $('#in-a2'); if (a2) { a2.hidden = ind; a2.querySelectorAll('input,select').forEach(el => { el.disabled = ind; }); }
  const nd = $('#in-nd-w'); if (nd) nd.hidden = ind;
  const l1 = $('#in-1-l'); if (l1) l1.textContent = ind ? 'Seu nome completo' : 'Nome completo';
  const a1 = $('#in-a1 legend'); if (a1) a1.textContent = ind ? 'Atleta' : 'Atleta 1';
  if ($('#in-ind')) $('#in-ind').hidden = !ind;
  document.querySelectorAll('[data-regra]').forEach(b => { const on = b.dataset.regra === cid; b.hidden = !on; b.querySelector('input').disabled = !on; });
  const v = $('#in-valor');
  if (v && c) { const total = c.cobranca === 'atleta' && !ind ? c.valor * 2 : c.valor; v.innerHTML = `<b style="color:var(--ink);font-size:1.1rem">${brl(total)}</b> · ${esc(c.nome)}${c.cobranca === 'atleta' && !ind ? ` (${brl(c.valor)} por atleta)` : ''}`; }
}

function inscConfirmada(r) {
  const c = catById(r.cat);
  return `<div class="stack ins"><section class="panel ins-ok stack" style="${estCat(c)}">
    ${logoHTML(marca(), '96px', 'var(--cat)')}
    <div class="eyebrow">Inscrição recebida</div><h2>Tudo certo, ${esc(r.resp.split(' ')[0] || r.j1)}!</h2>
    <p style="margin:0">A inscrição de <b>${esc(r.j2 ? `${r.j1} / ${r.j2}` : r.j1)}</b> na categoria <b class="cat-tag">${esc(c?.nome || '')}</b> foi enviada.
    ${r.comprovante ? 'O organizador vai conferir o comprovante e aprovar.' : 'Envie o comprovante ao organizador para confirmar.'}</p>
    ${inscCfg().aviso ? `<p class="dica" style="margin:0">${esc(inscCfg().aviso)}</p>` : ''}
    <div class="row"><button class="btn ghost" data-act="novaInsc">Fazer outra inscrição</button><button class="btn ghost" data-act="tab" data-k="painel">Ver o torneio</button></div>
  </section></div>`;
}

/* ---------- inscrições: visão do organizador ---------- */
const STATUS_TXT = { pendente: 'pendente', aprovada: 'aprovada', recusada: 'recusada' };
function insDetalhe(i, cfg) {
  const c = catById(i.cat), ex = i.extras || {};
  const at = (n) => { const nm = i['j' + n]; if (!nm) return ''; const ig = i['ig' + n], un = i['uni' + n]; return `<div><b>${esc(nm)}</b>${ig ? ` · <a class="link" href="${igLink(ig)}" target="_blank" rel="noopener">@${esc(igUser(ig))}</a>` : ''}${un ? ` · <span class="chip">${esc(un)}</span>` : ''}</div>`; };
  const perg = (cfg.perguntas || []).filter(p => ex[p.id]).map(p => `<div><span class="muted">${esc(p.texto)}:</span> ${esc(ex[p.id])}</div>`).join('');
  return `<div class="ins-item" style="${estCat(c)}">
    <div class="row between" style="gap:8px"><div style="min-width:0"><b class="cat-tag">${esc(c?.nome || '')}</b>${i.nomeDupla ? ` · <b>${esc(i.nomeDupla)}</b>` : ''}</div><span class="small muted">${new Date(i.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
    <div class="ins-at">${at(1)}${at(2)}</div>
    <div class="small"><span class="muted">Responsável:</span> ${esc(i.resp || '—')} · <span style="user-select:all">${esc(i.zap)}</span>${i.email ? ` · <span style="user-select:all">${esc(i.email)}</span>` : ''}</div>
    ${perg ? `<div class="small stack" style="gap:2px">${perg}</div>` : ''}
    ${i.aceites?.length ? `<div class="small muted">Aceitou ${i.aceites.length} ${i.aceites.length === 1 ? 'termo' : 'termos'}.</div>` : ''}
    <div class="row">${i.comprovante ? `<button class="btn ghost sm" data-act="verComp" data-id="${i.id}">Ver comprovante</button>` : '<span class="small muted">sem comprovante</span>'}
      ${i.status === 'pendente' ? `<button class="btn sm" data-act="insc" data-id="${i.id}" data-s="aprovada">Aprovar</button><button class="btn ghost sm" data-act="insc" data-id="${i.id}" data-s="recusada">Recusar</button>` : `<span class="chip ${i.status === 'aprovada' ? 'ok' : ''}">${STATUS_TXT[i.status] || i.status}</span>`}</div>
  </div>`;
}
function resumoUniformes() {
  const cont = {}; S.insc.filter(i => i.status !== 'recusada').forEach(i => ['uni1', 'uni2'].forEach(k => { if (i[k]) cont[i[k]] = (cont[i[k]] || 0) + 1; }));
  const ord = listaTam(inscCfg()); const ks = Object.keys(cont).sort((a, b) => (ord.indexOf(a) + 1 || 99) - (ord.indexOf(b) + 1 || 99));
  return ks.length ? `<section class="panel stack" style="gap:10px"><h3>Uniformes</h3><div class="row">${ks.map(k => `<span class="uni"><b class="num">${cont[k]}</b>${esc(k)}</span>`).join('')}</div><p class="small muted" style="margin:0">Soma das inscrições pendentes e aprovadas.</p></section>` : '';
}
function csvInscricoes() {
  const cfg = inscCfg(), q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const cab = ['Data', 'Status', 'Categoria', 'Nome da dupla', 'Atleta 1', 'Instagram 1', 'Uniforme 1', 'Atleta 2', 'Instagram 2', 'Uniforme 2', 'Responsável', 'WhatsApp', 'E-mail', ...(cfg.perguntas || []).map(p => p.texto), 'Comprovante'];
  const lin = [...S.insc].sort((a, b) => a.em - b.em).map(i => [new Date(i.em).toLocaleString('pt-BR'), i.status, catById(i.cat)?.nome || '', i.nomeDupla, i.j1, i.ig1, i.uni1, i.j2, i.ig2, i.uni2, i.resp, i.zap, i.email, ...(cfg.perguntas || []).map(p => (i.extras || {})[p.id]), i.comprovante ? 'sim' : 'não']);
  const txt = '﻿' + [cab, ...lin].map(r => r.map(q).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = `inscricoes-${(T().nome || 'torneio').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function configInscHTML() {
  const cfg = inscCfg(), ck = (n, l) => `<label class="check"><input id="ic-${n}" type="checkbox" name="${n}"${cfg[n] ? ' checked' : ''}> ${l}</label>`;
  return `<form class="stack" data-form="inscCfg">
    <section class="panel form"><h3 class="full">Apresentação</h3>
      <label class="field"><span>Edição</span><input id="ic-edicao" name="edicao" type="text" maxlength="40" value="${esc(cfg.edicao)}" placeholder="1ª edição"></label>
      <label class="field"><span>Datas (texto livre)</span><input id="ic-datas" name="datas" type="text" maxlength="80" value="${esc(cfg.datas)}" placeholder="13, 14 e 15 de novembro"></label>
      <label class="field"><span>Instagram para dúvidas</span><input id="ic-ig" name="instagram" type="text" maxlength="40" value="${esc(cfg.instagram)}" placeholder="@seutorneio"></label>
      <label class="field"><span>Banco do Pix (opcional)</span><input id="ic-banco" name="pixBanco" type="text" maxlength="40" value="${esc(cfg.pixBanco)}" placeholder="C6 Bank"></label>
      <label class="field full"><span>Boas-vindas (aparece no topo da página)</span><textarea id="ic-bv" name="boasVindas" maxlength="1200" placeholder="Serão 3 dias de muito futvôlei…">${esc(cfg.boasVindas)}</textarea></label>
      <label class="field"><span>O que está incluso (um por linha)</span><textarea id="ic-inc" name="incluso" maxlength="1200" placeholder="Troféus&#10;Brindes&#10;Cobertura fotográfica">${esc(cfg.incluso)}</textarea></label>
      <label class="field"><span>Outros horários do cronograma (um por linha)</span><textarea id="ic-oh" name="outrosHorarios" maxlength="800" placeholder="Domingo 15h · Professor Arena">${esc(cfg.outrosHorarios)}</textarea></label>
      <label class="field full"><span>Aviso final</span><input id="ic-aviso" name="aviso" type="text" maxlength="160" value="${esc(cfg.aviso)}"></label>
      <p class="dica full" style="margin:0">Data, local, Pix e WhatsApp vêm da aba Torneio. O horário e a regra de cada categoria ficam em Categorias &gt; Editar e formam o cronograma automaticamente.</p>
    </section>
    <section class="panel stack" style="gap:12px"><h3>Campos do formulário</h3>
      ${ck('instagramAtletas', 'Pedir o Instagram de cada atleta')}
      ${ck('uniforme', 'Pedir o tamanho do uniforme de cada atleta')}
      <label class="field"><span>Tamanhos de uniforme (separados por vírgula)</span><input id="ic-tam" name="tamanhos" type="text" maxlength="200" value="${esc(cfg.tamanhos)}"></label>
      ${ck('nomeDupla', 'Pedir o nome da dupla (opcional para o atleta)')}
      ${ck('email', 'Pedir e-mail do responsável')}
      <p class="small muted" style="margin:0">Nome dos atletas, nome do responsável e WhatsApp são sempre pedidos.</p>
    </section>
    <section class="panel stack" style="gap:12px"><h3>Perguntas extras</h3>
      ${(cfg.perguntas || []).map((p, k) => `<div class="ed-item" data-pergunta="${esc(p.id)}"><div class="form">
        <label class="field full"><span>Pergunta ${k + 1}</span><input id="ip-t-${p.id}" data-p="texto" type="text" maxlength="160" value="${esc(p.texto)}"></label>
        <label class="field"><span>Tipo</span><select id="ip-k-${p.id}" data-p="tipo">${TIPOS_PERGUNTA.map(([v, l]) => `<option value="${v}"${p.tipo === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Opções (separadas por vírgula)</span><input id="ip-o-${p.id}" data-p="opcoes" type="text" maxlength="400" value="${esc(p.opcoes || '')}" placeholder="Só para escolha de opções"></label>
        <div class="row full between"><label class="check"><input id="ip-r-${p.id}" data-p="obrig" type="checkbox"${p.obrig ? ' checked' : ''}> Obrigatória</label><button type="button" class="link small" data-act="perguntaMenos" data-id="${esc(p.id)}">Remover pergunta</button></div>
      </div></div>`).join('') || '<p class="small muted" style="margin:0">Nenhuma pergunta extra. Exemplos: "Cidade", "Nível da dupla", "Precisa de recibo?".</p>'}
      <button type="button" class="link small" data-act="perguntaMais" style="align-self:flex-start">Adicionar pergunta</button>
    </section>
    <section class="panel stack" style="gap:12px"><h3>Termos de aceite</h3>
      ${(cfg.termos || []).map((tm, k) => `<div class="ed-item" data-termo="${esc(tm.id)}"><div class="form">
        <label class="field full"><span>Título do termo ${k + 1}</span><input id="it-t-${tm.id}" data-t="titulo" type="text" maxlength="100" value="${esc(tm.titulo)}"></label>
        <label class="field full"><span>Texto</span><textarea id="it-x-${tm.id}" data-t="texto" maxlength="1500">${esc(tm.texto)}</textarea></label>
        <div class="full"><button type="button" class="link small" data-act="termoMenos" data-id="${esc(tm.id)}">Remover termo</button></div>
      </div></div>`).join('') || '<p class="small muted" style="margin:0">Nenhum termo.</p>'}
      <div class="row"><button type="button" class="link small" data-act="termoMais">Adicionar termo</button><button type="button" class="link small" data-act="termosPadrao">Restaurar os 3 termos padrão</button></div>
    </section>
    <div class="row"><button class="btn">Salvar página de inscrição</button><button type="button" class="btn ghost" data-act="inscAba" data-k="previa">Ver como o atleta</button></div>
  </form>`;
}
function lerInscCfg() {
  const f = document.querySelector('form[data-form="inscCfg"]'); const cfg = inscCfg(); if (!f) return cfg;
  const g = n => f.querySelector(`[name="${n}"]`);
  ['edicao', 'datas', 'instagram', 'pixBanco', 'boasVindas', 'incluso', 'outrosHorarios', 'aviso', 'tamanhos'].forEach(n => { cfg[n] = String(g(n)?.value || '').trim(); });
  ['instagramAtletas', 'uniforme', 'nomeDupla', 'email'].forEach(n => { cfg[n] = !!g(n)?.checked; });
  cfg.perguntas = [...f.querySelectorAll('[data-pergunta]')].map(el => ({ id: el.dataset.pergunta, texto: el.querySelector('[data-p=texto]').value.trim() || 'Pergunta', tipo: el.querySelector('[data-p=tipo]').value, opcoes: el.querySelector('[data-p=opcoes]').value.trim(), obrig: el.querySelector('[data-p=obrig]').checked }));
  cfg.termos = [...f.querySelectorAll('[data-termo]')].map(el => ({ id: el.dataset.termo, titulo: el.querySelector('[data-t=titulo]').value.trim() || 'Termo', texto: el.querySelector('[data-t=texto]').value.trim() }));
  return cfg;
}

function inscricao() {
  const t = T();
  if (!S.org) {
    const minhas = lsGet('minhas', []).filter(i => i.tid === S.tid);
    const chipI = s => s === 'aprovada' ? '<span class="chip ok">aprovada</span>' : '<span class="chip sea">aguardando</span>';
    return paginaInscricao() + (minhas.length && !S.inscOk ? `<section class="panel" style="margin-top:22px"><h3>Inscrições enviadas deste aparelho</h3><div class="games">${minhas.map(i => `<div class="game" style="grid-template-columns:minmax(0,1fr) auto"><div class="t">${esc(nomeInsc(i))} <span class="small muted">· ${esc(catById(i.cat)?.nome || '')}</span></div>${chipI((sorteadas(catById(i.cat)) ? atletas().some(a => a.cat === i.cat && a.nome === i.j1) : duplas().some(d => d.cat === i.cat && d.j1 === i.j1 && d.j2 === i.j2)) ? 'aprovada' : '')}</div>`).join('')}</div></section>` : '');
  }
  const aba = S.inscAba || 'recebidas', cfg = inscCfg();
  const pend = S.insc.filter(i => i.status === 'pendente'), apr = S.insc.filter(i => i.status === 'aprovada'), rec = S.insc.filter(i => i.status === 'recusada');
  const abas = [['recebidas', `Recebidas (${S.insc.length})`], ['pagina', 'Configurar página'], ['previa', 'Ver como o atleta']];
  let corpo = '';
  if (aba === 'pagina') corpo = configInscHTML();
  else if (aba === 'previa') corpo = `<p class="dica" style="margin:0">Prévia: é assim que os atletas veem a página. Enviar por aqui cria uma inscrição de verdade.</p>${paginaInscricao()}`;
  else corpo = `<div class="panel stats"><div class="stat"><b class="num">${pend.length}</b><span class="label">pendentes</span></div><div class="stat"><b class="num">${apr.length}</b><span class="label">aprovadas</span></div><div class="stat"><b class="num">${rec.length}</b><span class="label">recusadas</span></div><div class="stat"><b class="num">${brl(apr.reduce((s, i) => { const c = catById(i.cat); return s + (c ? (c.cobranca === 'atleta' && i.j2 ? c.valor * 2 : c.valor) : 0); }, 0))}</b><span class="label">valor aprovado</span></div></div>
    ${resumoUniformes()}
    <section class="panel stack" style="gap:12px"><h3>Pendentes</h3>${pend.map(i => insDetalhe(i, cfg)).join('') || '<p class="muted" style="margin:0">Nenhuma inscrição pendente.</p>'}</section>
    ${apr.length + rec.length ? `<details class="panel"><summary class="small" style="cursor:pointer">Já decididas (${apr.length + rec.length})</summary><div class="stack" style="gap:12px;margin-top:12px">${[...apr, ...rec].map(i => insDetalhe(i, cfg)).join('')}</div></details>` : ''}`;
  return `<div class="stack"><div class="sect-head"><div><div class="eyebrow">${t.inscricoes ? 'Inscrições abertas' : 'Inscrições fechadas'}</div><h2>Inscrições</h2></div>
    <div class="row"><button class="btn ghost sm" data-act="copiar" data-k="inscricao">Copiar link de inscrição</button>${S.insc.length ? '<button class="btn ghost sm" data-act="baixarCsv">Baixar planilha</button>' : ''}</div></div>
    <div class="subabas" role="tablist">${abas.map(([k, l]) => `<button role="tab" data-act="inscAba" data-k="${k}" aria-selected="${aba === k}">${l}</button>`).join('')}</div>
    ${corpo}</div>`;
}

/* ---------- modo TV ---------- */
function tvSlides() {
  const t = T(); if (!t) return []; const sl = []; const prev = previsoes();
  const ao = S.jogos.filter(j => j.status === 'aovivo');
  if (ao.length) sl.push(`<h2>Em quadra agora</h2><div class="tvgames">${ao.map(j => `<div class="tvg" style="${estCat(catById(j.cat), 'tv')}"><div class="nm">${esc(dn(j.a))}</div><div class="pt num">${j.pa} <span style="color:var(--tv-dim)">×</span> ${j.pb}</div><div class="nm b">${esc(dn(j.b))}</div><div class="mt">${esc(j.quadra)} · ${esc(catById(j.cat)?.nome || '')} · ${esc(j.fase === 'grupo' ? 'Chave ' + j.chave : j.rodadaNome)}${emSets(j) ? ` · ${(j.sets || []).length + 1}º set · sets ${L.setsVencidos(j.sets).a}×${L.setsVencidos(j.sets).b}` : ''}</div></div>`).join('')}</div>`);
  const nx = fila().slice(0, 7);
  if (nx.length) sl.push(`<h2>Próximos jogos</h2><div class="tvlist">${nx.map(j => `<div style="${estCat(catById(j.cat), 'tv')}"><span class="num hr">${hora(prev[j.id])}</span><span>${esc(dn(j.a))} × ${esc(dn(j.b))}</span><span class="ct">${esc(catById(j.cat)?.nome || '')}</span></div>`).join('')}</div>`);
  cats().forEach(c => {
    const chs = chavesCat(c.id);
    if (c.formato !== 'mata' && chs.length && !S.jogos.some(j => j.cat === c.id && j.fase === 'mata')) for (let i = 0; i < chs.length; i += 2) {
      const part = chs.slice(i, i + 2);
      sl.push(`<div style="${estCat(c, 'tv')}"><h2>${esc(c.nome)} · Classificação</h2></div><div class="tvgames" style="${estCat(c, 'tv')}">${part.map(ch => `<div><div style="color:var(--tv-dim);font-family:var(--f-display);font-size:1.4em;letter-spacing:.06em">${c.formato === 'todos' ? 'Tabela' : 'Chave ' + ch}</div><table><thead><tr><th></th><th>Dupla</th><th class="n">V</th><th class="n">SG</th></tr></thead><tbody>${tabela(c.id, ch).map((r, k) => `<tr><td>${k + 1}</td><td>${esc(dn(r.id))}</td><td class="n">${r.v}</td><td class="n">${r.sg > 0 ? '+' : ''}${r.sg}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>`);
    }
    const b = bracketHTML(c); if (b) sl.push(`<div style="${estCat(c, 'tv')}" class="stack"><h2>${esc(c.nome)} · Mata-mata</h2>${b}</div>`);
    const pd = podio(c); if (pd) sl.push(`<div style="${estCat(c, 'tv')}" class="stack"><h2>${esc(c.nome)} · Pódio</h2>${podioHTML(pd)}</div>`);
  });
  if (opt('patrocinadores') && S.pats.length) {
    const ps = patsOrdem(), card = (p, big) => `<div class="tvpat${big ? ' big' : ''}">${p.logo ? `<img class="logo" src="${p.logo}" alt="${esc(p.nome)}">` : `<b class="nome">${esc(p.nome)}</b>`}<div class="tx">${p.logo ? `<b>${esc(p.nome)}</b>` : ''}${p.frase ? `<span>${esc(p.frase)}</span>` : ''}</div>${p.link ? `<div class="qrbox">${qrImg(linkPat(p.link))}</div>` : ''}</div>`;
    ps.filter(p => p.cota === 'master').forEach(p => sl.push(`<h2>Patrocínio master</h2>${card(p, true)}`));
    const outros = ps.filter(p => p.cota !== 'master');
    for (let i = 0; i < outros.length; i += 6) sl.push(`<h2>Patrocinadores</h2><div class="tvpats">${outros.slice(i, i + 6).map(p => card(p, false)).join('')}</div>`);
  }
  const sp = opt('patrocinadores') && !S.pats.length ? (t.patrocinadores || '').split('\n').map(s => s.trim()).filter(Boolean) : [];
  if (sp.length) sl.push(`<h2>Patrocinadores</h2><div class="spons">${sp.map(s => { const [a, ...b] = s.split(':'); return b.length ? `<div><span style="color:var(--tv-dim);text-transform:uppercase;letter-spacing:.2em">${esc(a)}</span><b>${esc(b.join(':').trim())}</b></div>` : `<div><b>${esc(s)}</b></div>`; }).join('')}</div>`);
  if (!sl.length) sl.push(`<h2>${esc(t.nome)}</h2><p style="font-size:1.6rem;color:var(--tv-dim)">Os jogos aparecem aqui assim que as chaves forem sorteadas.</p>`);
  return sl;
}
let tvTimer = null, wake = null;
function renderTV() {
  if (!S.tv) { $('#tvroot').innerHTML = ''; return; }
  const t = T(), sl = tvSlides(); S.tvIdx %= sl.length;
  const sp = !opt('patrocinadores') ? [] : S.pats.length ? patsOrdem().map(p => p.nome) : (t?.patrocinadores || '').split('\n').map(s => s.split(':').pop().trim()).filter(Boolean);
  const m = marca(), d = partesData(t?.data);
  $('#tvroot').innerHTML = `<div class="tv" role="dialog" aria-label="Modo TV"><div class="wm" aria-hidden="true">${logoHTML(m, '70vh')}</div>
   <div class="tvh"><div class="id">${logoHTML(m, '84px')}<div><div class="eb">${[m.nome, t?.local, d ? d.dm : ''].filter(Boolean).map(esc).join(' · ')}</div><h1>${esc(t?.nome || '')}</h1></div></div><div class="row"><span class="chip live">ao vivo</span><button class="tvx" data-act="tvFull">Tela cheia</button><button class="tvx" data-act="fecharTV">Sair</button></div></div>
   <div class="slide">${sl[S.tvIdx]}</div>
   <div class="foot"><span>${sp.length ? 'Patrocínio: ' + sp.map(esc).join(' · ') : esc(m.lema || t?.local || '')}</span><div class="dots">${sl.map((_, i) => `<i class="${i === S.tvIdx ? 'on' : ''}"></i>`).join('')}</div></div></div>`;
}
function abrirTV() { S.tv = true; S.tvIdx = 0; clearInterval(tvTimer); tvTimer = setInterval(() => { S.tvIdx++; renderTV(); }, 12000); renderTV(); navigator.wakeLock?.request('screen').then(w => wake = w).catch(() => { }); }
function renderModal() {
  if (S.foto) { $('#modal').innerHTML = `<div class="modal foto"><div class="box" role="dialog" aria-modal="true" aria-label="Comprovante"><img src="${S.foto}" alt="Comprovante do Pix"><button class="btn" data-act="fecharFoto">Fechar</button></div></div>`; return; }
  if (!S.modal) { $('#modal').innerHTML = ''; return; }
  $('#modal').innerHTML = `<div class="modal"><div class="box" role="alertdialog" aria-modal="true"><p style="margin:0">${esc(S.modal.msg)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="modalNo">Cancelar</button><button class="btn" data-act="modalOk">${esc(S.modal.ok)}</button></div></div></div>`;
}
async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Link copiado.'); }
  catch { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Link copiado.'); } catch { toast(txt); } ta.remove(); }
}

/* ---------- eventos ---------- */
const jogoAoVivo = () => S.jogos.find(x => x.status === 'aovivo' && x.quadra === S.quadra);
const ACT = {
  tab: d => { if (d.k === 'tv') { abrirTV(); return; } S.inscOk = null; if (S.tab === 'marca' && d.k !== 'marca') S.rascunho = null; S.tab = d.k; S.editJogo = null; S.editCat = null; history.replaceState(null, '', location.pathname + location.search + (d.k === 'painel' ? '' : '#' + d.k)); render(); window.scrollTo(0, 0); },
  entrar: async () => { const p = new GoogleAuthProvider(); try { await signInWithPopup(auth, p); } catch (e) { if (String(e.code).includes('popup-blocked')) await signInWithRedirect(auth, p); else erro(e); } },
  sair: () => signOut(auth).then(() => toast('Você saiu.')),
  novoT: () => { S.novoT = true; render(); }, novoT2: () => { S.novoT = !S.novoT; render(); }, cancelNovo: () => { S.novoT = false; render(); },
  exemplo: () => criarExemplo().catch(erro),
  apagarT: () => confirmar('Apagar este torneio, com todas as categorias, duplas, jogos e inscrições? Isso não pode ser desfeito.', 'Apagar torneio', () => apagarTorneio().catch(erro)),
  addCat: async () => { const c = novaCat(); await saveT({ categorias: [...cats(), c] }); S.editCat = c.id; render(); },
  editCat: d => { S.editCat = d.id || null; render(); },
  delCat: d => confirmar('Remover esta categoria, suas duplas e seus jogos?', 'Remover', async () => { await lote(apagarJogosOps(d.id)); await saveT({ categorias: cats().filter(c => c.id !== d.id), duplas: duplas().filter(x => x.cat !== d.id), atletas: atletas().filter(x => x.cat !== d.id) }); render(); }),
  delAtleta: d => { saveT({ atletas: atletas().filter(a => a.id !== d.id) }); render(); },
  sortearDuplas: d => {
    const c = catById(d.id); const go = () => sortearDuplasCat(c).catch(() => { });
    if (S.jogos.some(j => j.cat === c.id)) confirmar('Sortear as duplas de novo apaga os jogos e placares desta categoria. Continuar?', 'Sortear de novo', go);
    else if (duplas().some(x => x.cat === c.id)) confirmar('Sortear de novo substitui as duplas atuais desta categoria. Continuar?', 'Sortear de novo', go);
    else go();
  },
  delDupla: d => { saveT({ duplas: duplas().filter(x => x.id !== d.id) }); render(); },
  sortear: d => { const c = catById(d.id); if (S.jogos.some(j => j.cat === c.id)) confirmar('Refazer o sorteio apaga todos os jogos e placares desta categoria. Continuar?', 'Refazer sorteio', () => sortear(c).catch(() => { })); else sortear(c).catch(() => { }); },
  gerarMata: d => {
    const c = catById(d.id); const go = () => gerarMata(c).then(() => { S.tab = 'chave'; render(); toast('Mata-mata gerado.'); }).catch(() => { });
    if (S.jogos.some(j => j.cat === c.id && j.fase === 'mata')) confirmar('Refazer o mata-mata apaga os placares já lançados nele. Continuar?', 'Refazer', go); else go();
  },
  editJogo: d => { S.editJogo = d.id || null; render(); },
  reabrir: d => { const j = S.jogos.find(x => x.id === d.id); S.editJogo = null; reabrir(j); },
  quadra: d => { S.quadra = d.q; lsSet('quadra', d.q); render(); },
  chamar: () => chamar(S.quadra),
  ponto: d => {
    const j = jogoAoVivo(); if (!j) return; const v = j[d.k] + (+d.d);
    if (v < 0 || (+d.d > 0 && L.fimValido(regraAtual(j), j.pa, j.pb))) return;
    j[d.k] = v; render(); navigator.vibrate?.(30); updD(jp(j.id), { [d.k]: v });
  },
  encerrar: () => {
    const j = jogoAoVivo(); if (!j) return;
    if (!emSets(j)) return confirmar(`Encerrar ${dn(j.a)} ${j.pa} × ${j.pb} ${dn(j.b)}?`, 'Encerrar jogo', () => finalizar(j, j.pa, j.pb));
    const sets = [...(j.sets || []), [j.pa, j.pb]], sv = L.setsVencidos(sets), n = sets.length;
    if (sv.a === 2 || sv.b === 2) return confirmar(`Encerrar a final: ${dn(j.a)} ${sv.a} × ${sv.b} ${dn(j.b)} (${sets.map(x => x.join('-')).join(', ')})?`, 'Encerrar final', () => finalizar(j, sv.a, sv.b, sets));
    confirmar(`Fechar o ${n}º set em ${j.pa} × ${j.pb}?`, `Fechar ${n}º set`, () => updD(jp(j.id), { sets, pa: 0, pb: 0 }));
  },
  devolver: () => { const j = jogoAoVivo(); if (!j) return; confirmar('Devolver este jogo para a fila? O placar será zerado.', 'Devolver', () => updD(jp(j.id), { status: 'agendado', quadra: null, pa: 0, pb: 0, sets: [] })); },
  copiarPix: () => copiar(T()?.pix || ''),
  copiar: d => { const u = links()[d.k]; if (u) copiar(u); },
  novoToken: () => confirmar('Gerar um novo link de mesário? Quem usa o link atual perde o acesso e precisa receber o novo.', 'Gerar novo link', async () => {
    await setD(`torneios/${S.tid}/privado/config`, { mesarioToken: token() });
    const mes = await getDocs(C(`torneios/${S.tid}/mesarios`)).catch(() => null); if (mes?.docs.length) await lote(mes.docs.map(d => [d.ref.path, null]));
    toast('Novo link de mesário gerado.');
  }),
  insc: d => decidirInsc(d.id, d.s),
  inscAba: d => { if (S.inscAba === 'pagina' && d.k !== 'pagina') S.inscRasc = null; S.inscAba = d.k; S.inscOk = null; render(); },
  novaInsc: () => { S.inscOk = null; render(); window.scrollTo(0, 0); },
  baixarCsv: () => csvInscricoes(),
  perguntaMais: () => { const c = lerInscCfg(); c.perguntas = [...c.perguntas, { id: 'p' + uid().slice(0, 6), texto: '', tipo: 'curta', opcoes: '', obrig: true }]; saveT({ insc: c }); render(); },
  perguntaMenos: d => { const c = lerInscCfg(); c.perguntas = c.perguntas.filter(p => p.id !== d.id); saveT({ insc: c }); render(); },
  termoMais: () => { const c = lerInscCfg(); c.termos = [...c.termos, { id: 't' + uid().slice(0, 6), titulo: '', texto: '' }]; saveT({ insc: c }); render(); },
  termoMenos: d => { const c = lerInscCfg(); c.termos = c.termos.filter(x => x.id !== d.id); saveT({ insc: c }); render(); },
  termosPadrao: () => { const c = lerInscCfg(); c.termos = [...c.termos.filter(x => !TERMOS_PADRAO.some(p => p.id === x.id)), ...TERMOS_PADRAO]; saveT({ insc: c }); render(); toast('Termos padrão restaurados.'); },
  modeloMarca: d => { const atual = S.rascunho || {}; S.rascunho = JSON.parse(JSON.stringify(MK.MODELOS[d.k])); if (!S.rascunho.logo && atual.logo && atual.logo.startsWith('data:')) { S.rascunho.logo = atual.logo; S.rascunho.logoTinta = atual.logoTinta; } render(); },
  semLogo: () => { S.rascunho = { ...lerMarcaDoForm(), logo: '', logoTinta: false }; render(); },
  palMais: () => { const m = lerMarcaDoForm(); m.paleta = [...m.paleta, { nome: 'Nova cor', cor: m.cores.secundaria }]; S.rascunho = m; render(); },
  palMenos: d => { const m = lerMarcaDoForm(); m.paleta = m.paleta.filter((_, i) => i !== +d.i); S.rascunho = m; render(); },
  descartarMarca: () => { S.rascunho = null; render(); toast('Mudanças descartadas.'); },
  salvarMarca: () => { const m = MK.completar(lerMarcaDoForm(), MK.completar(marcaPadrao)); saveT({ marca: m }).then(() => { S.rascunho = null; render(); toast('Identidade visual salva. Todos os links já mostram a nova marca.'); }); },
  marcaPadrao: () => confirmar('Voltar este torneio para a marca padrão do site? A marca própria dele será apagada.', 'Usar marca padrão', () => { saveT({ marca: null }).then(() => { S.rascunho = null; render(); toast('O torneio voltou a usar a marca padrão.'); }); }),
  verComp: async d => {
    try { const s = await getDoc(R(`torneios/${S.tid}/comprovantes/${d.id}`)); if (!s.exists()) return toast('Comprovante não encontrado.'); S.foto = s.data().img; renderModal(); } catch (e) { erro(e); }
  },
  fecharFoto: () => { S.foto = null; renderModal(); },
  delPat: d => confirmar('Remover este patrocinador?', 'Remover', () => delD(`torneios/${S.tid}/patrocinadores/${d.id}`)),
  desempate: d => {
    const key = d.c + '|' + d.ch, tb = tabela(d.c, d.ch).map(r => r.id), i = +d.i, k = i + (+d.dir);
    if (k < 0 || k >= tb.length) return;
    [tb[i], tb[k]] = [tb[k], tb[i]];
    saveT({ desempate: { ...(T().desempate || {}), [key]: tb } }); render();
  },
  limparDesempate: d => { const m = { ...(T().desempate || {}) }; delete m[d.c + '|' + d.ch]; saveT({ desempate: m }); render(); },
  fecharTV: () => { S.tv = false; clearInterval(tvTimer); wake?.release?.(); document.fullscreenElement && document.exitFullscreen?.().catch(() => { }); renderTV(); },
  tvFull: () => { document.documentElement.requestFullscreen?.().catch(() => toast('Tela cheia indisponível neste aparelho.')); },
  modalNo: () => { S.modal = null; renderModal(); },
  modalOk: () => { const f = S.modal?.fn; S.modal = null; renderModal(); f && f(); },
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; e.preventDefault(); ACT[b.dataset.act]?.(b.dataset, b); });
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset?.mk) return;
  if (el.dataset.mk === 'cor') { const t = document.getElementById('mk-t-' + el.dataset.k); if (t) t.value = el.value.toUpperCase(); }
  if (el.dataset.mk === 'corTxt') { const v = MK.normHex(el.value, ''); if (!v) return; const c = document.getElementById('mk-c-' + el.dataset.k); if (c) c.value = v.toLowerCase(); }
  if (el.dataset.mk === 'logo') return;
  previaMarca();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset?.mk === 'logo') {
    const file = el.files?.[0]; if (!file) return;
    comprimirImagem(file, 640, 300000, true).then(url => { S.rascunho = { ...lerMarcaDoForm(), logo: url }; el.blur(); render(); toast('Logo carregado. Confira a prévia e salve.'); })
      .catch(er => toast(er.message === 'formato' ? 'Não consegui abrir esta imagem. Use PNG ou JPG.' : 'O logo ficou grande demais. Use uma imagem menor.'));
    return;
  }
  if (el.dataset?.mk) { previaMarca(); if (el.type === 'radio' || el.tagName === 'SELECT' || el.type === 'checkbox') { el.blur(); render(); } return; }
  if (el.id === 'selT') { trocarTorneio(el.value); render(); return; }
  if (el.dataset.change === 'cat') { S.cat = el.value; el.blur(); render(); }
  if (el.dataset.change === 'pote') { saveT({ atletas: atletas().map(a => a.id === el.dataset.id ? { ...a, pote: +el.value } : a) }); el.blur(); render(); return; }
  if (el.dataset.change === 'inscCat') { ajustarFormInsc(el.value); return; }
  if (el.dataset.change === 'cabeca') saveT({ duplas: duplas().map(d => d.id === el.dataset.id ? { ...d, cabeca: el.checked } : d) });
});
const num = (v, d, min) => Math.max(min, Number.isFinite(+v) && v !== '' ? +v : d);
const FORM = {
  novoT: fd => { S.novoT = false; criarTorneio(Object.fromEntries(fd)).catch(() => { }); },
  config: fd => { const o = Object.fromEntries(fd); saveT({ nome: o.nome, data: o.data, local: o.local, quadras: o.quadras.split(',').map(s => s.trim()).filter(Boolean), duracao: num(o.duracao, 20, 5), contato: o.contato, pix: o.pix, pixNome: o.pixNome, inscricoes: fd.has('inscricoes'), opcoes: { comprovante: fd.has('op_comprovante'), desempate: fd.has('op_desempate'), patrocinadores: fd.has('op_patrocinadores') } }).then(() => toast('Torneio salvo.')); },
  cat: (fd, f) => {
    const o = Object.fromEntries(fd); const id = f.dataset.id;
    const up = { nome: o.nome, formato: o.formato, chaves: num(o.chaves, 1, 1), classificam: num(o.classificam, 1, 1), extras: num(o.extras, 0, 0), pontos: num(o.pontos, 18, 1), teto: num(o.teto, 0, 0), vagas: num(o.vagas, 2, 2), valor: num(o.valor, 0, 0), cobranca: o.cobranca, vantagem: fd.has('vantagem'), terceiro: fd.has('terceiro'), quadras: fd.getAll('q'), modoDuplas: o.modoDuplas === 'sorteadas' ? 'sorteadas' : 'fixas', potes: fd.has('potes'), finalSets: fd.has('finalSets'), pontosSet: num(o.pontosSet, 18, 1), pontosTie: num(o.pontosTie, 15, 1), cor: o.cor === 'outra' ? MK.normHex(o.corOutra, '') : MK.normHex(o.cor, ''), dia: String(o.dia || ''), hora: String(o.hora || ''), regra: String(o.regra || '').trim().slice(0, 1500) };
    S.editCat = null; saveT({ categorias: cats().map(c => c.id === id ? { ...c, ...up } : c) }).then(() => toast('Categoria salva.'));
  },
  addDupla: (fd, f) => { const o = Object.fromEntries(fd); saveT({ duplas: [...duplas(), { id: uid(), cat: S.cat, j1: o.j1.trim(), j2: o.j2.trim(), cabeca: fd.has('cabeca'), chave: null }] }); f.reset(); },
  colar: (fd, f) => {
    const novas = L.lerLista(fd.get('lista')).map(([a, b]) => ({ id: uid(), cat: S.cat, j1: a, j2: b, cabeca: false, chave: null }));
    if (!novas.length) return toast('Nenhuma dupla reconhecida. Use o formato Atleta / Atleta.');
    saveT({ duplas: [...duplas(), ...novas] }).then(() => toast(`${novas.length} duplas importadas.`)); f.reset();
  },
  pat: async (fd, f) => {
    const o = Object.fromEntries(fd); const nome = String(o.nome || '').trim().slice(0, 60); if (!nome) return;
    let logo = null; const file = fd.get('logo');
    if (file && file.size) { try { logo = await comprimirImagem(file, 520, 280000, true); } catch (e) { return toast(e.message === 'formato' ? 'Não consegui abrir esta imagem. Use PNG ou JPG.' : 'O logo ficou grande demais. Use uma imagem menor.'); } }
    const id = uid(); await setD(`torneios/${S.tid}/patrocinadores/${id}`, { nome, cota: COTAS.some(c => c[0] === o.cota) ? o.cota : 'apoio', frase: String(o.frase || '').trim().slice(0, 90), link: String(o.link || '').trim().slice(0, 200), logo, em: Date.now() });
    f.reset(); toast('Patrocinador adicionado.');
  },
  addAtleta: (fd, f) => { const nome = String(fd.get('nome')).trim().slice(0, 60); if (!nome) return; saveT({ atletas: [...atletas(), { id: uid(), cat: S.cat, nome, pote: +fd.get('pote') || 1 }] }); f.reset(); },
  colarAtletas: (fd, f) => {
    const novos = L.lerAtletas(fd.get('lista')).map(a => ({ id: uid(), cat: S.cat, nome: a.nome.slice(0, 60), pote: a.pote || 1 }));
    if (!novos.length) return toast('Nenhum atleta reconhecido. Coloque um nome por linha.');
    saveT({ atletas: [...atletas(), ...novos] }).then(() => toast(`${novos.length} atletas importados.`)); f.reset();
  },
  editJogo: (fd, f) => {
    const j = S.jogos.find(x => x.id === f.dataset.id); const c = catById(j.cat);
    if (emSets(j)) {
      const sets = L.lerSets(fd.get('sets')); const er = L.validarSets(c, sets);
      if (er && !(fd.has('forcar') && sets.length && sets.every(Boolean))) return toast(er + (sets.length && sets.every(Boolean) ? ' Marque "aceitar fora da regra" para salvar mesmo assim.' : ''));
      const sv = L.setsVencidos(sets); if (sv.a === sv.b) return toast('A final precisa ter um vencedor.');
      S.editJogo = null; return finalizar(j, sv.a, sv.b, sets).then(() => toast('Resultado da final salvo.'));
    }
    const pa = +fd.get('pa'), pb = +fd.get('pb');
    if (pa === pb) return toast('O jogo não pode terminar empatado.');
    if (!L.fimValido(c, pa, pb) && !fd.has('forcar')) return toast(`Placar fora da regra (${regraTxt(c)}). Marque "aceitar fora da regra" para salvar mesmo assim.`);
    S.editJogo = null; finalizar(j, pa, pb).then(() => toast('Resultado salvo. Classificação recalculada.'));
  },
  insc: async (fd, f) => {
    const o = Object.fromEntries(fd), cfg = inscCfg(), c = catById(o.cat);
    if (!c) return toast('Escolha a categoria.');
    if (!vagasCat(c)) return toast('Esta categoria está esgotada.');
    const ind = sorteadas(c); if (ind) o.j2 = '';
    for (const fs of f.querySelectorAll('[data-varias][data-obrig]')) if (!fs.querySelector('input:checked')) return toast('Responda: ' + fs.querySelector('legend').textContent);
    const extras = {}; (cfg.perguntas || []).forEach(p => { const v = p.tipo === 'varias' ? fd.getAll('q_' + p.id).join(', ') : String(fd.get('q_' + p.id) || '').trim(); if (v) extras[p.id] = v.slice(0, 600); });
    const btn = f.querySelector('#in-enviar'); if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
    const volta = () => { if (btn) { btn.disabled = false; btn.textContent = 'Enviar inscrição'; } };
    try {
      const u = await ensureAuth(); const id = uid();
      let img = null;
      if (opt('comprovante')) {
        const file = fd.get('foto'); if (!file || !file.size) { volta(); return toast('Anexe a foto ou o print do comprovante do Pix.'); }
        try { img = await comprimirImagem(file, 1400, 700000); } catch (e) { volta(); return toast(e.message === 'formato' ? 'Não consegui abrir esta imagem. Envie um print em JPG ou PNG.' : 'A imagem ficou grande demais. Tente um print da tela do comprovante.'); }
      }
      const cut = (v, n) => String(v || '').trim().slice(0, n);
      const item = { cat: o.cat, j1: cut(o.j1, 60), j2: cut(o.j2, 60), zap: cut(o.zap, 30), resp: cut(o.resp, 60), status: 'pendente', em: Date.now(), uid: u.uid, comprovante: !!img,
        email: cut(o.email, 80), ig1: cut(igUser(o.ig1), 40), ig2: ind ? '' : cut(igUser(o.ig2), 40), uni1: cut(o.uni1, 30), uni2: ind ? '' : cut(o.uni2, 30), nomeDupla: ind ? '' : cut(o.nomeDupla, 60),
        extras, aceites: fd.getAll('aceite').map(x => cut(x, 40)).slice(0, 30) };
      if (img) await setDoc(R(`torneios/${S.tid}/comprovantes/${id}`), { uid: u.uid, img, em: Date.now() });
      await setDoc(R(`torneios/${S.tid}/inscricoes/${id}`), item);
      lsSet('minhas', [...lsGet('minhas', []), { id, tid: S.tid, cat: item.cat, j1: item.j1, j2: item.j2 }]);
      S.inscOk = { ...item, tid: S.tid }; f.reset(); render(); window.scrollTo(0, 0);
    } catch (e) { volta(); erro(e); }
  },
  inscCfg: () => { const cfg = lerInscCfg(); saveT({ insc: cfg }).then(() => toast('Página de inscrição salva.')); },
};
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target; document.activeElement?.blur?.(); S.pend = false; FORM[f.dataset.form]?.(new FormData(f), f); setTimeout(render, 0); });

/* ---------- início ---------- */
function init() {
  const h = location.hash.slice(1);
  if (['mesario', 'inscricao', 'jogos', 'classificacao', 'chave', 'marca', 'config'].includes(h)) S.tab = h;
  if (!configurado) { S.boot = 'ok'; render(); return; }
  render();
  let primeiraVez = true;
  onAuthStateChanged(auth, async u => {
    S.user = u; await verificarAdmin(u);
    assinarTorneio(); verificarMesario(); render();
  });
  onSnapshot(C('torneios'), snap => {
    S.torneios = snap.docs.map(d => ({ id: d.id, d: d.data() })).sort((a, b) => (b.d.data || '').localeCompare(a.d.data || '') || (b.d.criado || 0) - (a.d.criado || 0));
    if (!S.tid || !S.torneios.some(x => x.id === S.tid)) trocarTorneio(S.torneios[0]?.id || null);
    S.boot = 'ok'; render();
    if (primeiraVez && h === 'tv' && S.tid) abrirTV();
    primeiraVez = false;
  }, e => { console.error(e); S.boot = 'erro'; render(); });
}
init();
