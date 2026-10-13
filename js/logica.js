// Regras do torneio: pontuação, classificação, sorteio e chaves do mata-mata.
// Funções puras (sem banco de dados), usadas pelo app e pelos testes.

export const letra = i => String.fromCharCode(65 + i);
export const shuffle = (a, rnd = Math.random) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** O jogo pode ser encerrado com este placar? */
export function fimValido(c, pa, pb) {
  const alvo = +c.pontos || 18, teto = +c.teto || 0, hi = Math.max(pa, pb), lo = Math.min(pa, pb);
  if (hi === lo) return false;
  if (teto && hi >= teto) return hi === teto;
  if (hi < alvo) return false;
  return c.vantagem ? (hi - lo >= 2 && (hi === alvo || hi - lo === 2)) : hi === alvo;
}
export const regraTxt = c => `Jogo até ${c.pontos}${c.vantagem ? ', com vantagem de 2' : ''}${+c.teto ? `, teto ${c.teto}` : ''}`;

/** Tabela de uma chave: vitórias, saldo, pontos feitos e confronto direto. */
export function tabela(duplas, jogos, cid, chave) {
  const row = {};
  duplas.filter(d => d.cat === cid && d.chave === chave).forEach(d => row[d.id] = { id: d.id, j: 0, v: 0, d: 0, pp: 0, pc: 0 });
  const js = jogos.filter(j => j.cat === cid && j.fase === 'grupo' && j.chave === chave && j.status === 'fim');
  js.forEach(j => {
    const A = row[j.a], B = row[j.b]; if (!A || !B) return;
    A.j++; B.j++; A.pp += j.pa; A.pc += j.pb; B.pp += j.pb; B.pc += j.pa;
    if (j.pa > j.pb) { A.v++; B.d++; } else { B.v++; A.d++; }
  });
  const arr = Object.values(row); arr.forEach(r => r.sg = r.pp - r.pc);
  const h2h = (x, y) => { const g = js.find(j => (j.a === x.id && j.b === y.id) || (j.a === y.id && j.b === x.id)); if (!g) return 0; return ((g.a === x.id) === (g.pa > g.pb)) ? -1 : 1; };
  arr.sort((x, y) => y.v - x.v || y.sg - x.sg || y.pp - x.pp || h2h(x, y));
  return arr;
}
export const chavesCat = (duplas, cid) => [...new Set(duplas.filter(d => d.cat === cid && d.chave).map(d => d.chave))].sort();

/** Duplas classificadas para o mata-mata, da melhor para a pior. */
export function classificados(c, duplas, jogos) {
  const tabs = chavesCat(duplas, c.id).map(ch => tabela(duplas, jogos, c.id, ch));
  const cmp = (x, y) => y.v - x.v || y.sg - x.sg || y.pp - x.pp;
  const seeds = [];
  for (let p = 0; p < (+c.classificam || 1); p++) seeds.push(...tabs.map(tb => tb[p]).filter(Boolean).sort(cmp).map(r => r.id));
  if (+c.extras) seeds.push(...tabs.map(tb => tb[+c.classificam]).filter(Boolean).sort(cmp).slice(0, +c.extras).map(r => r.id));
  return seeds;
}

/** Todos contra todos (método do círculo): lista de rodadas, cada uma com pares. */
export function roundRobin(ids) {
  const a = [...ids]; if (a.length % 2) a.push(null); const n = a.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const rd = [];
    for (let i = 0; i < n / 2; i++) { const x = a[i], y = a[n - 1 - i]; if (x && y) rd.push(r % 2 ? [y, x] : [x, y]); }
    rounds.push(rd); a.splice(1, 0, a.pop());
  }
  return rounds;
}

/** Distribui as duplas nas chaves: cabeças primeiro, depois sorteio em zigue-zague. */
export function montarGrupos(c, ds, rnd = Math.random) {
  const k = c.formato === 'todos' ? 1 : Math.max(1, Math.min(+c.chaves || 1, Math.floor(ds.length / 2)));
  const ord = [...ds.filter(d => d.cabeca), ...shuffle(ds.filter(d => !d.cabeca), rnd)];
  const grupos = [...Array(k)].map(() => []);
  ord.forEach((d, i) => { const r = Math.floor(i / k), p = i % k; grupos[r % 2 === 0 ? p : k - 1 - p].push(d.id); });
  return grupos;
}
export function jogosDeGrupo(c, grupos, ci, uid) {
  const out = [];
  grupos.forEach((g, gi) => roundRobin(g).forEach((rd, ri) => rd.forEach((par, pi) => out.push({
    id: uid(), cat: c.id, fase: 'grupo', chave: letra(gi), rodada: ri + 1,
    ordem: (ri + 1) * 10000 + gi * 100 + ci * 10 + pi, a: par[0], b: par[1], pa: 0, pb: 0, status: 'agendado'
  }))));
  return out;
}

export function seedOrder(n) { let s = [1, 2]; while (s.length < n) { const m = s.length * 2 + 1; s = s.flatMap(x => [x, m - x]); } return s; }
export const nomeRodada = n => ({ 2: 'Final', 4: 'Semifinal', 8: 'Quartas', 16: 'Oitavas', 32: '16 avos' })[n] || `Rodada de ${n}`;

/** Monta todos os jogos do mata-mata, com avanço automático e "bye" quando a chave não fecha. */
export function montarMata(c, seeds, ci, uid) {
  const N = seeds.length; if (N < 2) return [];
  let size = 2; while (size < N) size *= 2;
  const base = 5000000 + ci * 10000, rounds = [];
  let m = size / 2, r = 0;
  while (m >= 1) {
    rounds.push([...Array(m)].map((_, i) => ({ id: uid(), cat: c.id, fase: 'mata', rodadaNome: nomeRodada(m * 2), nivel: r, idx: i, a: null, b: null, pa: 0, pb: 0, status: 'agendado', ordem: base + r * 1000 + i * 2 + (ci % 2) })));
    m /= 2; r++;
  }
  rounds.forEach((rd, ri) => { if (ri < rounds.length - 1) rd.forEach((g, i) => g.prox = { id: rounds[ri + 1][Math.floor(i / 2)].id, slot: i % 2 ? 'b' : 'a' }); });
  let t3 = null;
  if (c.terceiro && size >= 4 && !(size === 4 && N < 4)) {
    const last = rounds.length - 1;
    t3 = { id: uid(), cat: c.id, fase: 'mata', rodadaNome: '3º lugar', nivel: last, idx: 1, a: null, b: null, pa: 0, pb: 0, status: 'agendado', ordem: base + last * 1000 - 1 };
    rounds[last - 1].forEach((g, i) => g.perdProx = { id: t3.id, slot: i % 2 ? 'b' : 'a' });
  }
  const order = seedOrder(size);
  rounds[0].forEach((g, i) => { g.a = seeds[order[2 * i] - 1] || null; g.b = seeds[order[2 * i + 1] - 1] || null; });
  const all = [...rounds.flat(), ...(t3 ? [t3] : [])], byId = Object.fromEntries(all.map(g => [g.id, g]));
  rounds[0].forEach(g => { if (!!g.a !== !!g.b) { g.status = 'bye'; g.vencedor = g.a || g.b; if (g.prox) byId[g.prox.id][g.prox.slot] = g.vencedor; } });
  return all;
}

/** [campeã, vice, 3º, (outro 3º)] ou null se a categoria não terminou. */
export function podio(c, duplas, jogos) {
  if (c.formato === 'todos') {
    const js = jogos.filter(j => j.cat === c.id && j.status !== 'bye');
    if (!js.length || js.some(j => j.status !== 'fim')) return null;
    return tabela(duplas, jogos, c.id, 'A').slice(0, 3).map(r => r.id);
  }
  const fin = jogos.find(j => j.cat === c.id && j.fase === 'mata' && j.rodadaNome === 'Final');
  if (!fin || fin.status !== 'fim') return null;
  const vice = fin.a === fin.vencedor ? fin.b : fin.a;
  const t3 = jogos.find(j => j.cat === c.id && j.rodadaNome === '3º lugar');
  const terc = t3 ? (t3.status === 'fim' ? [t3.vencedor] : [])
    : jogos.filter(j => j.cat === c.id && j.rodadaNome === 'Semifinal' && j.status === 'fim').map(j => j.a === j.vencedor ? j.b : j.a);
  return [fin.vencedor, vice, ...terc];
}

/** Próximos jogos que podem entrar numa quadra (sem dupla jogando em outra quadra). */
export function fila(jogos, permite = () => true, quadra = null) {
  const ocup = new Set(jogos.filter(j => j.status === 'aovivo').flatMap(j => [j.a, j.b]));
  return jogos.filter(j => j.status === 'agendado' && j.a && j.b && !ocup.has(j.a) && !ocup.has(j.b) && (!quadra || permite(j.cat, quadra)))
    .sort((x, y) => x.ordem - y.ordem);
}

/**
 * Sorteia duplas entre atletas avulsos.
 * Sem potes: embaralha todos e junta de dois em dois.
 * Com potes: cada dupla tem um atleta do pote 1 e um do pote 2
 * (ex.: experiente + iniciante, ou homem + mulher no misto).
 * Retorna { pares: [[atletaA, atletaB], ...], sobra: [atletas sem par] }.
 */
export function sortearDuplas(atletas, usarPotes = false, rnd = Math.random) {
  if (!usarPotes) {
    const a = shuffle(atletas, rnd), pares = [];
    for (let i = 0; i + 1 < a.length; i += 2) pares.push([a[i], a[i + 1]]);
    return { pares, sobra: a.length % 2 ? [a[a.length - 1]] : [] };
  }
  const p1 = shuffle(atletas.filter(x => (x.pote || 1) === 1), rnd);
  const p2 = shuffle(atletas.filter(x => x.pote === 2), rnd);
  const n = Math.min(p1.length, p2.length);
  return { pares: [...Array(n)].map((_, i) => [p1[i], p2[i]]), sobra: [...p1.slice(n), ...p2.slice(n)] };
}

/** Lê uma lista de atletas, um por linha ("1) Rafa", "Tiago - 2" vai para o pote 2). */
export function lerAtletas(texto) {
  return String(texto).split('\n').map(l => l.replace(/^\s*\d+[\).\-\s]+/, '').trim()).filter(Boolean)
    .map(l => { const m = l.match(/^(.*?)[\s\-–(]+(?:pote\s*)?([12])\)?$/i); return m && m[1].trim() ? { nome: m[1].trim(), pote: +m[2] } : { nome: l, pote: null }; });
}

/** Lê uma lista colada do WhatsApp: "Rafa / Tiago", "Bruno e Caio", "1) Ana & Bia". */
export function lerLista(texto) {
  return String(texto).split('\n').map(l => l.replace(/^\s*\d+[\).\-\s]*/, '').trim()).filter(Boolean)
    .map(l => { const p = l.split(/\s*(?:\/|\s+e\s+|\s+&\s+|\s+x\s+|,)\s*/i).filter(Boolean); return p.length >= 2 ? [p[0], p.slice(1).join(' ')] : null; })
    .filter(Boolean);
}
