// Arena Futvôlei — aplicativo (GitHub Pages + Firebase)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, nomeDoSite } from './config.js';
import * as L from './logica.js';

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
  S.tid = id; lsSet('tid', id); S.cat = null; S.editJogo = S.editCat = null; S.mesario = false;
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
  const ini = { ...novaCat(), nome: 'Iniciante', chaves: 3, classificam: 2, extras: 2, vagas: 12, valor: 80, finalSets: true };
  const mis = { ...novaCat(), nome: 'Misto', vagas: 8, valor: 45, cobranca: 'atleta' };
  const sor = { ...novaCat(), nome: 'Duplas sorteadas', vagas: 8, valor: 40, cobranca: 'atleta', modoDuplas: 'sorteadas', potes: true };
  const ats = ['Caio', 'Murilo', 'Renato', 'Fabrício', 'Wesley', 'Alan', 'Pietro', 'Cauã', 'Bento', 'Ravi', 'Theo', 'Yuri'].map((nome, i) => ({ id: uid(), cat: sor.id, nome, pote: i < 6 ? 1 : 2 }));
  const mk = (l, cat, n) => l.map((s, i) => { const [a, b] = s.split(' / '); return { id: uid(), cat, j1: a, j2: b, cabeca: i < n, chave: null }; });
  const ds = [...mk(['Rafa / Tiago', 'Bruno / Caio', 'Lucas / Pedro', 'Igor / Vitor', 'André / Felipe', 'Marcos / Diego', 'Heitor / Davi', 'Gui / Leo', 'João / Enzo', 'Thiago / Nico', 'Samuel / Otávio', 'Breno / Kauã'], ini.id, 3),
    ...mk(['Ana / Paulo', 'Bia / Renan', 'Carla / Edu', 'Duda / Fábio', 'Elis / Gabriel', 'Júlia / Hugo', 'Lara / Ivan', 'Nina / Jorge'], mis.id, 2)];
  const t = { nome: 'Etapa Verão (exemplo)', data: new Date().toISOString().slice(0, 10), local: 'Arena de exemplo', quadras: ['Quadra 1', 'Quadra 2', 'Quadra 3'], duracao: 20, pix: 'financeiro@exemplo.com.br', pixNome: 'Arena de exemplo', contato: '(11) 90000-0000', inscricoes: true, opcoes: { comprovante: true, desempate: true, patrocinadores: true }, categorias: [ini, mis, sor], duplas: ds, atletas: ats, criado: Date.now(), exemplo: true };
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
    else await saveT({ duplas: [...duplas(), { id: uid(), cat: it.cat, j1: it.j1, j2: it.j2, cabeca: false, chave: null }] });
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
  if (S.org) t.push(['config', 'Torneio'], ['categorias', 'Categorias'], ['duplas', 'Duplas']);
  t.push(['jogos', 'Jogos'], ['classificacao', 'Classificação'], ['chave', 'Mata-mata']);
  if (podeEscrever()) t.push(['mesario', 'Mesário']);
  t.push(['inscricao', S.org ? 'Inscrições' : 'Inscrição'], ['tv', 'Modo TV']);
  return t;
}
function renderChrome() {
  const logado = S.user && !S.user.isAnonymous;
  $('#topbar').innerHTML = `<div class="brand"><span class="ball" aria-hidden="true"></span>${esc(nomeDoSite)}</div>
    ${S.torneios.length ? `<select id="selT" aria-label="Torneio">${S.torneios.map(x => `<option value="${x.id}"${x.id === S.tid ? ' selected' : ''}>${esc(x.d.nome)}${x.d.data ? ' · ' + dataBR(x.d.data) : ''}</option>`).join('')}</select>` : '<span style="flex:1"></span>'}
    <span class="role">${S.org ? 'Organizador' : S.mesario ? 'Mesário' : 'Público'}</span>
    ${configurado ? `<div class="auth">${logado ? `<button data-act="sair" title="${esc(S.user.email || '')}">Sair</button>` : `<button data-act="entrar">Organizador</button>`}</div>` : ''}`;
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
  if (S.boot === 'carregando') return `<div class="empty"><div class="court"></div><p class="muted">Carregando torneios…</p></div>`;
  if (S.boot === 'erro') return `<div class="empty"><div class="court"></div><h2>Não foi possível carregar os torneios</h2><p class="muted">Confira a internet. Se você acabou de instalar o site, verifique se o banco Firestore foi criado e se as regras foram publicadas (passos 2 e 4 do guia).</p></div>`;
  if (!S.torneios.length) return emptyHTML();
  if (!T()) return '';
  const v = { painel, config, categorias, duplas: duplasV, jogos: jogosV, classificacao, chave: chaveV, mesario, inscricao }[S.tab];
  return (v || painel)();
}
function setupHTML() {
  return `<div class="panel setup stack"><h2>Falta conectar o Firebase</h2><p class="muted" style="margin:0">O site está no ar, mas ainda não sabe onde guardar os torneios.</p>
  <ol><li>Crie um projeto grátis em <b>console.firebase.google.com</b>.</li><li>Adicione um app da Web e copie a configuração.</li><li>Cole os valores no arquivo <code>js/config.js</code> do repositório.</li></ol>
  <p class="small muted" style="margin:0">O passo a passo completo está no arquivo README.md do repositório.</p></div>`;
}
function emptyHTML() {
  if (!S.org) return `<div class="empty"><div class="court"></div><h2>Nenhum torneio publicado ainda</h2><p class="muted">Quando o organizador criar um torneio, as chaves, os jogos e os placares aparecem aqui ao vivo.</p>
    ${S.user && !S.user.isAnonymous ? `<p class="small muted">Você entrou como ${esc(S.user.email)}, mas este e-mail não está cadastrado como organizador (passo 6 do guia).</p>` : ''}</div>`;
  return `<div class="empty"><div class="court"></div><h2>Monte seu primeiro torneio</h2>
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
   <div class="meta">${st}<span>${esc(c?.nome || '')}</span><span>${esc(fase || '')}</span>${detSets}${S.org && opts.edit && S.editJogo !== j.id && j.a && j.b ? `<button class="link small" data-act="editJogo" data-id="${j.id}">Editar placar</button>` : ''}</div>${edit}</div>`;
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

function painel() {
  const t = T(); const ao = S.jogos.filter(j => j.status === 'aovivo'); const prev = previsoes(); const nx = fila().slice(0, 6);
  const tot = S.jogos.filter(j => j.status !== 'bye'), fin = tot.filter(j => j.status === 'fim').length;
  return `<div class="stack">
  <div class="sect-head"><div><div class="label">${esc(dataBR(t.data))}${t.local ? ' · ' + esc(t.local) : ''}</div><h2>${esc(t.nome)}</h2>${t.exemplo ? '<span class="chip">Exemplo</span>' : ''}</div>
  ${S.org ? `<div class="row"><button class="btn ghost sm" data-act="novoT2">Novo torneio</button><button class="btn sm" data-act="tab" data-k="tv">Abrir modo TV</button></div>` : ''}</div>
  ${S.org && S.novoT ? novoTForm() : ''}
  <div class="panel stats"><div class="stat"><b class="num">${cats().length}</b><span class="label">categorias</span></div><div class="stat"><b class="num">${duplas().length}</b><span class="label">duplas</span></div><div class="stat"><b class="num">${fin}/${tot.length}</b><span class="label">jogos encerrados</span></div><div class="stat"><b class="num">${ao.length}/${(t.quadras || []).length}</b><span class="label">quadras em jogo</span></div></div>
  <div class="grid2">
    <section class="panel"><h3>Em quadra agora</h3><div class="games">${ao.length ? ao.sort((a, b) => (a.quadra || '').localeCompare(b.quadra || '')).map(j => gameRow(j)).join('') : '<p class="muted">Nenhum jogo em andamento.</p>'}</div></section>
    <section class="panel"><h3>Próximos jogos</h3><div class="games">${nx.length ? nx.map(j => gameRow(j, { prev })).join('') : '<p class="muted">A fila está vazia. Sorteie as chaves para gerar os jogos.</p>'}</div></section>
  </div>
  <section class="stack"><h3>Categorias</h3><div class="grid2">${cats().map(c => {
    const js = jogosCat(c.id), f = js.filter(j => j.status === 'fim').length, [e, cl] = estadoCat(c), pd = podio(c);
    return `<div class="panel cat-card"><div class="row between"><h3>${esc(c.nome)}</h3><span class="chip ${cl}">${e}</span></div>
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

function categorias() {
  const t = T();
  const formatoTxt = c => ({ grupos: `Grupos (${c.chaves} chaves, ${c.classificam} por chave${+c.extras ? ` + ${c.extras} melhores ${+c.classificam + 1}º` : ''}) + mata-mata`, todos: 'Todos contra todos', mata: 'Mata-mata direto' })[c.formato];
  return `<div class="stack"><div class="sect-head"><div><h2>Categorias</h2><p class="muted small" style="margin:0">Cada categoria tem formato, pontuação, vagas e quadras próprias.</p></div><button class="btn" data-act="addCat">Adicionar categoria</button></div>
  ${cats().map(c => S.editCat === c.id ? catForm(c, t) : `<div class="panel row between"><div style="min-width:0"><h3>${esc(c.nome)}</h3><div class="small muted">${formatoTxt(c)}${sorteadas(c) ? ` · duplas sorteadas${c.potes ? ' com 2 potes' : ''}` : ''} · ${regraTxt(c)}${c.finalSets && c.formato !== 'todos' ? ` · final em 3 sets (${c.pontosSet || c.pontos}/${c.pontosSet || c.pontos}/${c.pontosTie || 15})` : ''} · ${c.vagas} vagas · ${brl(c.valor)}/${c.cobranca}${c.quadras?.length ? ' · ' + esc(c.quadras.join(', ')) : ''}</div></div>
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
   <label class="check full"><input id="cf-fs" name="finalSets" type="checkbox"${c.finalSets ? ' checked' : ''}> Final em melhor de 3 sets</label>
   ${f('pontosSet', 'Sets da final até (pontos)', c.pontosSet || c.pontos || 18, 'number', 'min="1"')}${f('pontosTie', '3º set até (pontos)', c.pontosTie || 15, 'number', 'min="1"')}
   <fieldset class="full" style="border:1px solid var(--line);border-radius:8px"><legend class="small muted">Quadras desta categoria (nenhuma marcada = todas)</legend><div class="row">${(t.quadras || []).map((q, i) => `<label class="check"><input id="cf-q${i}" type="checkbox" name="q" value="${esc(q)}"${c.quadras?.includes(q) ? ' checked' : ''}> ${esc(q)}</label>`).join('')}</div></fieldset>
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
  return `<div class="stack"><div class="sect-head"><div><h2>Jogos · ${esc(c.nome)}</h2><p class="muted small" style="margin:0">${regraTxt(c)}</p></div>${pk}</div>
  ${Object.keys(grp).length ? Object.entries(grp).map(([k, g]) => `<section class="panel"><h3>${esc(k)}</h3><div class="games">${g.map(j => gameRow(j, { prev, edit: true })).join('')}</div></section>`).join('') : `<div class="panel muted">Os jogos aparecem aqui depois do sorteio.</div>`}</div>`;
}

function classificacao() {
  const pk = catPicker(); if (!S.cat) return semCat(); const c = catById(S.cat);
  if (c.formato === 'mata') return `<div class="stack"><div class="sect-head"><h2>Classificação · ${esc(c.nome)}</h2>${pk}</div><div class="panel muted">Esta categoria é mata-mata direto. Veja a aba Mata-mata.</div></div>`;
  const chs = chavesCat(c.id); const gj = S.jogos.filter(j => j.cat === c.id && j.fase === 'grupo'); const done = gj.length && gj.every(j => j.status === 'fim');
  const temMata = S.jogos.some(j => j.cat === c.id && j.fase === 'mata');
  const sel = new Set(c.formato === 'grupos' ? L.classificados(c, duplas(), S.jogos, manuais()) : []);
  return `<div class="stack"><div class="sect-head"><div><h2>Classificação · ${esc(c.nome)}</h2><p class="muted small" style="margin:0">Critérios: vitórias, saldo, pontos feitos${opt('desempate') ? ', desempate do organizador' : ''} e confronto direto.</p></div><div class="row">${pk}
   ${S.org && c.formato === 'grupos' ? `<button class="btn" data-act="gerarMata" data-id="${c.id}"${done ? '' : ' disabled'}>${temMata ? 'Refazer mata-mata' : 'Gerar mata-mata'}</button>` : ''}</div></div>
   ${S.org && c.formato === 'grupos' && !done && gj.length ? `<p class="small muted" style="margin:0">O mata-mata fica disponível quando os ${gj.length} jogos da fase de grupos terminarem (${gj.filter(j => j.status === 'fim').length} encerrados).</p>` : ''}
  ${chs.length ? `<div class="grid2">${chs.map(ch => `<section class="panel"><h3>${c.formato === 'todos' ? 'Tabela' : 'Chave ' + ch}</h3><div class="tw"><table><thead><tr><th></th><th>Dupla</th><th class="n">J</th><th class="n">V</th><th class="n">SG</th><th class="n">PF</th>${S.org && opt('desempate') ? '<th></th>' : ''}</tr></thead><tbody>
    ${(() => { const tb = tabela(c.id, ch), mov = S.org && opt('desempate'), igual = (x, y) => x && y && x.v === y.v && x.sg === y.sg && x.pp === y.pp && x.j > 0;
      return tb.map((r, i) => `<tr class="${(c.formato === 'grupos' ? sel.has(r.id) : i < 3) ? 'q' : ''}"><td class="pos">${i + 1}</td><td>${esc(dn(r.id))}${r.empate && r.j > 0 && S.org ? ' <span class="chip">empate</span>' : ''}</td><td class="n">${r.j}</td><td class="n">${r.v}</td><td class="n">${r.sg > 0 ? '+' : ''}${r.sg}</td><td class="n">${r.pp}</td>${mov ? `<td class="n mv">${igual(r, tb[i - 1]) ? `<button class="link" data-act="desempate" data-c="${c.id}" data-ch="${ch}" data-i="${i}" data-dir="-1" aria-label="Subir ${esc(dn(r.id))}">▲</button>` : ''}${igual(r, tb[i + 1]) ? `<button class="link" data-act="desempate" data-c="${c.id}" data-ch="${ch}" data-i="${i}" data-dir="1" aria-label="Descer ${esc(dn(r.id))}">▼</button>` : ''}</td>` : ''}</tr>`).join(''); })()}</tbody></table></div>
    ${S.org && opt('desempate') && manuais()[c.id + '|' + ch] ? `<button class="link small" data-act="limparDesempate" data-c="${c.id}" data-ch="${ch}">Desfazer desempate manual desta chave</button>` : ''}</section>`).join('')}</div>
    ${S.org && opt('desempate') ? '<p class="small muted" style="margin:0">Quando duas duplas empatam em vitórias, saldo e pontos, use ▲ ▼ para definir a ordem.</p>' : ''}
    <p class="small muted" style="margin:0">A barra verde marca as duplas ${c.formato === 'todos' ? 'no pódio' : 'classificadas para o mata-mata'}.</p>` : '<div class="panel muted">A classificação aparece depois do sorteio das chaves.</div>'}</div>`;
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
  return `<div class="stack"><div class="sect-head"><h2>Mata-mata · ${esc(c.nome)}</h2>${pk}</div>
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
    return `<div class="stack"><h2>Mesário · ${esc(S.quadra)}</h2>${qsel}<div class="board"><div class="bar"><span>Quadra livre</span></div>
    ${nx ? `<div style="text-align:center"><div class="label" style="color:var(--board-dim)">Próximo da fila · ${esc(catById(nx.cat)?.nome || '')} · ${esc(nx.fase === 'grupo' ? 'Chave ' + nx.chave : nx.rodadaNome)}</div><h2 style="margin:8px 0 16px">${esc(dn(nx.a))} × ${esc(dn(nx.b))}</h2><button class="btn" data-act="chamar">Chamar próximo jogo</button></div>` : '<p style="text-align:center;margin:0">Nenhum jogo disponível para esta quadra agora.</p>'}</div></div>`;
  }
  const c = catById(j.cat), md3 = emSets(j), rg = regraAtual(j), fim = L.fimValido(rg, j.pa, j.pb);
  const sv = L.setsVencidos(j.sets), nSet = (j.sets || []).length + 1;
  const decide = md3 && fim && ((j.pa > j.pb ? sv.a : sv.b) + 1 === 2);
  const side = (k, id) => `<div class="side"><div class="nm">${esc(dn(id))}</div><div class="pt">${j[k]}</div><div class="pm"><button class="minus" data-act="ponto" data-k="${k}" data-d="-1" aria-label="Tirar ponto"${j[k] <= 0 ? ' disabled' : ''}>−</button><button class="plus" data-act="ponto" data-k="${k}" data-d="1" aria-label="Somar ponto"${fim ? ' disabled' : ''}>+</button></div></div>`;
  return `<div class="stack"><h2>Mesário · ${esc(S.quadra)}</h2>${qsel}
  <div class="board"><div class="bar"><span class="chip live">ao vivo</span><span>${esc(c.nome)} · ${esc(j.fase === 'grupo' ? 'Chave ' + j.chave : j.rodadaNome)} · ${md3 ? `${nSet}º set até ${rg.pontos}${c.vantagem ? ', vantagem de 2' : ''}` : regraTxt(c)}</span></div>
   ${md3 ? `<div class="setsbar"><span>Sets</span><b class="num">${sv.a} × ${sv.b}</b>${(j.sets || []).length ? `<span>${(j.sets || []).map(x => x.join('-')).join(' · ')}</span>` : ''}</div>` : ''}
   <div class="sides">${side('pa', j.a)}${side('pb', j.b)}</div>
   <div class="row between"><button class="btn ghost sm" style="color:var(--board-ink);border-color:#2c4657" data-act="devolver">Devolver à fila</button>
   <button class="btn" data-act="encerrar"${fim ? '' : ' disabled'}>${!fim ? (md3 ? `${nSet}º set em andamento` : 'Jogo em andamento') : md3 && !decide ? `Fechar ${nSet}º set` : 'Encerrar jogo'}</button></div></div></div>`;
}

function inscricao() {
  const t = T();
  const pixBox = t.pix ? `<div class="pix"><span class="small muted">Pix${t.pixNome ? ' · ' + esc(t.pixNome) : ''}</span><code id="pixk">${esc(t.pix)}</code><button type="button" class="btn sm" data-act="copiarPix">Copiar chave Pix</button></div>` : '<p class="small muted">O organizador ainda não informou a chave Pix.</p>';
  const primeira = cats().find(c => vagasCat(c)) || cats()[0]; const ind = sorteadas(primeira);
  const form = !t.inscricoes ? '<div class="panel muted">As inscrições deste torneio estão fechadas.</div>' :
    `<form class="panel form" data-form="insc"><h3 class="full" id="in-tit">${ind ? 'Inscrição individual' : 'Inscrever dupla'}</h3>
    <label class="field full"><span>Categoria</span><select id="in-cat" name="cat" data-change="inscCat" required>${cats().map(c => { const v = vagasCat(c); return `<option value="${c.id}"${v ? '' : ' disabled'}>${esc(c.nome)} · ${brl(c.valor)}/${c.cobranca} · ${v ? v + (sorteadas(c) ? (v === 1 ? ' vaga de atleta' : ' vagas de atleta') : ' vagas restantes') : 'esgotada'}</option>`; }).join('')}</select></label>
    <label class="field"><span id="in-1-l">${ind ? 'Nome do atleta' : 'Atleta 1'}</span><input id="in-1" name="j1" type="text" maxlength="60" required></label>
    <label class="field" id="in-2-w"${ind ? ' hidden' : ''}><span>Atleta 2</span><input id="in-2" name="j2" type="text" maxlength="60"${ind ? '' : ' required'}></label>
    <p class="full small muted" id="in-ind" style="margin:0"${ind ? '' : ' hidden'}>Nesta categoria as duplas são sorteadas entre os atletas inscritos. Inscreva só você.</p>
    <label class="field full"><span>WhatsApp para contato</span><input id="in-z" name="zap" type="tel" maxlength="30" required placeholder="(11) 90000-0000"></label>
    <div class="full">${pixBox}</div>
    ${opt('comprovante') ? `<label class="field full"><span>Comprovante do Pix (foto ou print)</span><input id="in-f" name="foto" type="file" accept="image/*" required></label>
    <p class="full small muted" style="margin:0">Faça o Pix, anexe o comprovante e envie. A inscrição vale depois da aprovação do organizador.</p>` :
    `<p class="full small muted" style="margin:0">Faça o Pix e envie o comprovante ao organizador${t.contato ? ' pelo WhatsApp ' + esc(t.contato) : ''}. A inscrição vale depois da aprovação.</p>`}
    <div class="full"><button class="btn">Enviar inscrição</button></div></form>`;
  const chipI = s => s === 'aprovada' ? '<span class="chip ok">aprovada</span>' : s === 'recusada' ? '<span class="chip">recusada</span>' : '<span class="chip sea">pendente</span>';
  if (S.org) {
    const pend = S.insc.filter(i => i.status === 'pendente'), dec = S.insc.filter(i => i.status !== 'pendente');
    return `<div class="stack"><div class="sect-head"><div><h2>Inscrições</h2><p class="muted small" style="margin:0">${t.inscricoes ? 'Abertas' : 'Fechadas'} · ${pend.length} pendentes · ${dec.filter(i => i.status === 'aprovada').length} aprovadas · ${dec.filter(i => i.status === 'recusada').length} recusadas</p></div><button class="btn ghost sm" data-act="copiar" data-k="inscricao">Copiar link de inscrição</button></div>
    <section class="panel"><div class="games">${pend.map(i => `<div class="game" style="grid-template-columns:minmax(0,1fr) auto"><div class="t"><b>${esc(nomeInsc(i))}</b><div class="small muted">${esc(catById(i.cat)?.nome || '')} · ${brl(catById(i.cat)?.valor)} · ${hora(i.em)} · WhatsApp <span style="user-select:all">${esc(i.zap)}</span></div></div>
      <div class="row">${i.comprovante ? `<button class="btn ghost sm" data-act="verComp" data-id="${i.id}">Ver comprovante</button>` : '<span class="small muted">sem comprovante</span>'}<button class="btn sm" data-act="insc" data-id="${i.id}" data-s="aprovada">Aprovar</button><button class="btn ghost sm" data-act="insc" data-id="${i.id}" data-s="recusada">Recusar</button></div></div>`).join('') || '<p class="muted">Nenhuma inscrição pendente.</p>'}</div></section>
    ${dec.length ? `<section class="panel"><h3>Já decididas</h3><div class="games">${dec.map(i => `<div class="game" style="grid-template-columns:minmax(0,1fr) auto"><div class="t">${esc(nomeInsc(i))} <span class="small muted">· ${esc(catById(i.cat)?.nome || '')}</span></div>${chipI(i.status)}</div>`).join('')}</div></section>` : ''}
    <details class="panel"><summary class="small" style="cursor:pointer">Ver o formulário como os atletas veem</summary><div style="margin-top:12px">${form}</div></details></div>`;
  }
  const minhas = lsGet('minhas', []).filter(i => i.tid === S.tid);
  return `<div class="stack"><div><div class="label">${esc(dataBR(t.data))}${t.local ? ' · ' + esc(t.local) : ''}</div><h2>Inscrição · ${esc(t.nome)}</h2></div>${form}
  ${minhas.length ? `<section class="panel"><h3>Inscrições enviadas deste aparelho</h3><div class="games">${minhas.map(i => `<div class="game" style="grid-template-columns:minmax(0,1fr) auto"><div class="t">${esc(nomeInsc(i))} <span class="small muted">· ${esc(catById(i.cat)?.nome || '')}</span></div>${(sorteadas(catById(i.cat)) ? atletas().some(a => a.cat === i.cat && a.nome === i.j1) : duplas().some(d => d.cat === i.cat && d.j1 === i.j1 && d.j2 === i.j2)) ? chipI('aprovada') : '<span class="chip sea">aguardando</span>'}</div>`).join('')}</div></section>` : ''}</div>`;
}

/* ---------- modo TV ---------- */
function tvSlides() {
  const t = T(); if (!t) return []; const sl = []; const prev = previsoes();
  const ao = S.jogos.filter(j => j.status === 'aovivo');
  if (ao.length) sl.push(`<h2>Em quadra agora</h2><div class="tvgames">${ao.map(j => `<div class="tvg"><div class="nm">${esc(dn(j.a))}</div><div class="pt num">${j.pa} <span style="color:#8ea3af">×</span> ${j.pb}</div><div class="nm b">${esc(dn(j.b))}</div><div class="mt">${esc(j.quadra)} · ${esc(catById(j.cat)?.nome || '')} · ${esc(j.fase === 'grupo' ? 'Chave ' + j.chave : j.rodadaNome)}${emSets(j) ? ` · ${(j.sets || []).length + 1}º set · sets ${L.setsVencidos(j.sets).a}×${L.setsVencidos(j.sets).b}` : ''}</div></div>`).join('')}</div>`);
  const nx = fila().slice(0, 7);
  if (nx.length) sl.push(`<h2>Próximos jogos</h2><div class="tvlist">${nx.map(j => `<div><span class="num">~${hora(prev[j.id])}</span><span>${esc(dn(j.a))} × ${esc(dn(j.b))}</span><span style="color:#8ea3af">${esc(catById(j.cat)?.nome || '')}</span></div>`).join('')}</div>`);
  cats().forEach(c => {
    const chs = chavesCat(c.id);
    if (c.formato !== 'mata' && chs.length && !S.jogos.some(j => j.cat === c.id && j.fase === 'mata')) for (let i = 0; i < chs.length; i += 2) {
      const part = chs.slice(i, i + 2);
      sl.push(`<h2>${esc(c.nome)} · Classificação</h2><div class="tvgames">${part.map(ch => `<div><div style="color:#8ea3af;font-family:var(--f-display);font-size:1.4em">${c.formato === 'todos' ? 'Tabela' : 'Chave ' + ch}</div><table><thead><tr><th></th><th>Dupla</th><th class="n">V</th><th class="n">SG</th></tr></thead><tbody>${tabela(c.id, ch).map((r, k) => `<tr><td>${k + 1}</td><td>${esc(dn(r.id))}</td><td class="n">${r.v}</td><td class="n">${r.sg > 0 ? '+' : ''}${r.sg}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>`);
    }
    const b = bracketHTML(c); if (b) sl.push(`<h2>${esc(c.nome)} · Mata-mata</h2>${b}`);
    const pd = podio(c); if (pd) sl.push(`<h2>${esc(c.nome)} · Pódio</h2>${podioHTML(pd)}`);
  });
  if (opt('patrocinadores') && S.pats.length) {
    const ps = patsOrdem(), card = (p, big) => `<div class="tvpat${big ? ' big' : ''}">${p.logo ? `<img class="logo" src="${p.logo}" alt="${esc(p.nome)}">` : `<b class="nome">${esc(p.nome)}</b>`}<div class="tx">${p.logo ? `<b>${esc(p.nome)}</b>` : ''}${p.frase ? `<span>${esc(p.frase)}</span>` : ''}</div>${p.link ? `<div class="qrbox">${qrImg(linkPat(p.link))}</div>` : ''}</div>`;
    ps.filter(p => p.cota === 'master').forEach(p => sl.push(`<h2>Patrocínio master</h2>${card(p, true)}`));
    const outros = ps.filter(p => p.cota !== 'master');
    for (let i = 0; i < outros.length; i += 6) sl.push(`<h2>Patrocinadores</h2><div class="tvpats">${outros.slice(i, i + 6).map(p => card(p, false)).join('')}</div>`);
  }
  const sp = opt('patrocinadores') && !S.pats.length ? (t.patrocinadores || '').split('\n').map(s => s.trim()).filter(Boolean) : [];
  if (sp.length) sl.push(`<h2>Patrocinadores</h2><div class="spons">${sp.map(s => { const [a, ...b] = s.split(':'); return b.length ? `<div><span style="color:#8ea3af;text-transform:uppercase;letter-spacing:.1em">${esc(a)}</span><b>${esc(b.join(':').trim())}</b></div>` : `<div><b>${esc(s)}</b></div>`; }).join('')}</div>`);
  if (!sl.length) sl.push(`<h2>${esc(t.nome)}</h2><p style="font-size:1.6rem;color:#8ea3af">Os jogos aparecem aqui assim que as chaves forem sorteadas.</p>`);
  return sl;
}
let tvTimer = null, wake = null;
function renderTV() {
  if (!S.tv) { $('#tvroot').innerHTML = ''; return; }
  const t = T(), sl = tvSlides(); S.tvIdx %= sl.length;
  const sp = !opt('patrocinadores') ? [] : S.pats.length ? patsOrdem().map(p => p.nome) : (t?.patrocinadores || '').split('\n').map(s => s.split(':').pop().trim()).filter(Boolean);
  $('#tvroot').innerHTML = `<div class="tv" role="dialog" aria-label="Modo TV"><div class="tvh"><h1>${esc(t?.nome || '')}</h1><div class="row"><span class="chip live" style="font-size:.9rem">ao vivo</span><button class="tvx" data-act="tvFull">Tela cheia</button><button class="tvx" data-act="fecharTV">Sair</button></div></div>
   <div class="slide">${sl[S.tvIdx]}</div>
   <div class="foot"><span>${sp.length ? 'Patrocínio: ' + sp.map(esc).join(' · ') : esc(t?.local || '')}</span><div class="dots">${sl.map((_, i) => `<i class="${i === S.tvIdx ? 'on' : ''}"></i>`).join('')}</div></div></div>`;
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
  tab: d => { if (d.k === 'tv') { abrirTV(); return; } S.tab = d.k; S.editJogo = null; S.editCat = null; history.replaceState(null, '', location.pathname + location.search + (d.k === 'painel' ? '' : '#' + d.k)); render(); window.scrollTo(0, 0); },
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
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'selT') { trocarTorneio(el.value); render(); return; }
  if (el.dataset.change === 'cat') { S.cat = el.value; el.blur(); render(); }
  if (el.dataset.change === 'pote') { saveT({ atletas: atletas().map(a => a.id === el.dataset.id ? { ...a, pote: +el.value } : a) }); el.blur(); render(); return; }
  if (el.dataset.change === 'inscCat') {
    const ind = sorteadas(catById(el.value)), w = $('#in-2-w'), i2 = $('#in-2');
    if (w) { w.hidden = ind; i2.required = !ind; if (ind) i2.value = ''; }
    if ($('#in-ind')) $('#in-ind').hidden = !ind;
    if ($('#in-tit')) $('#in-tit').textContent = ind ? 'Inscrição individual' : 'Inscrever dupla';
    if ($('#in-1-l')) $('#in-1-l').textContent = ind ? 'Nome do atleta' : 'Atleta 1';
    return;
  }
  if (el.dataset.change === 'cabeca') saveT({ duplas: duplas().map(d => d.id === el.dataset.id ? { ...d, cabeca: el.checked } : d) });
});
const num = (v, d, min) => Math.max(min, Number.isFinite(+v) && v !== '' ? +v : d);
const FORM = {
  novoT: fd => { S.novoT = false; criarTorneio(Object.fromEntries(fd)).catch(() => { }); },
  config: fd => { const o = Object.fromEntries(fd); saveT({ nome: o.nome, data: o.data, local: o.local, quadras: o.quadras.split(',').map(s => s.trim()).filter(Boolean), duracao: num(o.duracao, 20, 5), contato: o.contato, pix: o.pix, pixNome: o.pixNome, inscricoes: fd.has('inscricoes'), opcoes: { comprovante: fd.has('op_comprovante'), desempate: fd.has('op_desempate'), patrocinadores: fd.has('op_patrocinadores') } }).then(() => toast('Torneio salvo.')); },
  cat: (fd, f) => {
    const o = Object.fromEntries(fd); const id = f.dataset.id;
    const up = { nome: o.nome, formato: o.formato, chaves: num(o.chaves, 1, 1), classificam: num(o.classificam, 1, 1), extras: num(o.extras, 0, 0), pontos: num(o.pontos, 18, 1), teto: num(o.teto, 0, 0), vagas: num(o.vagas, 2, 2), valor: num(o.valor, 0, 0), cobranca: o.cobranca, vantagem: fd.has('vantagem'), terceiro: fd.has('terceiro'), quadras: fd.getAll('q'), modoDuplas: o.modoDuplas === 'sorteadas' ? 'sorteadas' : 'fixas', potes: fd.has('potes'), finalSets: fd.has('finalSets'), pontosSet: num(o.pontosSet, 18, 1), pontosTie: num(o.pontosTie, 15, 1) };
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
    const o = Object.fromEntries(fd); const c = catById(o.cat); if (!c || !vagasCat(c)) return toast('Esta categoria está esgotada.');
    if (sorteadas(c)) o.j2 = ''; else if (!String(o.j2 || '').trim()) return toast('Informe o nome dos dois atletas.');
    try {
      const u = await ensureAuth(); const id = uid();
      let img = null;
      if (opt('comprovante')) {
        const file = fd.get('foto'); if (!file || !file.size) return toast('Anexe a foto ou o print do comprovante do Pix.');
        try { img = await comprimirImagem(file, 1400, 700000); } catch (e) { return toast(e.message === 'formato' ? 'Não consegui abrir esta imagem. Envie um print em JPG ou PNG.' : 'A imagem ficou grande demais. Tente um print da tela do comprovante.'); }
      }
      const item = { cat: o.cat, j1: o.j1.trim().slice(0, 60), j2: String(o.j2 || '').trim().slice(0, 60), zap: o.zap.trim().slice(0, 30), status: 'pendente', em: Date.now(), uid: u.uid, comprovante: !!img };
      if (img) await setDoc(R(`torneios/${S.tid}/comprovantes/${id}`), { uid: u.uid, img, em: Date.now() });
      await setDoc(R(`torneios/${S.tid}/inscricoes/${id}`), item);
      lsSet('minhas', [...lsGet('minhas', []), { id, tid: S.tid, cat: item.cat, j1: item.j1, j2: item.j2 }]);
      f.reset(); toast('Inscrição enviada. Aguarde a aprovação do organizador.'); render();
    } catch (e) { erro(e); }
  },
};
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target; document.activeElement?.blur?.(); S.pend = false; FORM[f.dataset.form]?.(new FormData(f), f); setTimeout(render, 0); });

/* ---------- início ---------- */
function init() {
  const h = location.hash.slice(1);
  if (['mesario', 'inscricao', 'jogos', 'classificacao', 'chave'].includes(h)) S.tab = h;
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
