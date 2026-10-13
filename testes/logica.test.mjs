// Testes das regras do torneio. Rode com: node testes/logica.test.mjs
import assert from 'node:assert/strict';
import * as L from '../js/logica.js';

let n = 0; const uid = () => 'g' + (n++);
const cat = { id: 'c1', formato: 'grupos', chaves: 3, classificam: 2, extras: 2, pontos: 18, vantagem: true, teto: 0, terceiro: true };

// Pontuação
assert.equal(L.fimValido(cat, 18, 10), true);
assert.equal(L.fimValido(cat, 18, 17), false, 'sem vantagem de 2');
assert.equal(L.fimValido(cat, 19, 17), true);
assert.equal(L.fimValido(cat, 20, 17), false, 'placar impossível com vantagem');
assert.equal(L.fimValido({ ...cat, vantagem: false }, 18, 17), true);
assert.equal(L.fimValido({ ...cat, teto: 21 }, 21, 20), true, 'teto encerra');
assert.equal(L.fimValido(cat, 12, 10), false);

// Todos contra todos: 4 duplas → 3 rodadas, 6 jogos, cada par uma vez
const rr = L.roundRobin(['a', 'b', 'c', 'd']);
assert.equal(rr.length, 3);
const pares = rr.flat().map(p => [...p].sort().join());
assert.equal(new Set(pares).size, 6);
assert.equal(L.roundRobin(['a', 'b', 'c', 'd', 'e']).flat().length, 10);

// Sorteio: 12 duplas, 3 cabeças, 3 chaves de 4, cabeças separadas
const ds = [...Array(12)].map((_, i) => ({ id: 'd' + i, cat: 'c1', cabeca: i < 3 }));
const gr = L.montarGrupos(cat, ds);
assert.deepEqual(gr.map(g => g.length), [4, 4, 4]);
gr.forEach((g, i) => assert.equal(g[0], 'd' + i, 'uma cabeça por chave'));
const jogos = L.jogosDeGrupo(cat, gr, 0, uid);
assert.equal(jogos.length, 18);

// Classificação com resultados
const duplas = ds.map(d => ({ ...d, chave: L.letra(gr.findIndex(g => g.includes(d.id))) }));
jogos.forEach(j => { j.status = 'fim'; const aWin = j.a < j.b; j.pa = aWin ? 18 : 10; j.pb = aWin ? 10 : 18; j.vencedor = aWin ? j.a : j.b; });
const tbA = L.tabela(duplas, jogos, 'c1', 'A');
assert.equal(tbA.length, 4);
assert.ok(tbA[0].v >= tbA[1].v && tbA[1].v >= tbA[2].v);
const seeds = L.classificados(cat, duplas, jogos);
assert.equal(seeds.length, 8, '2 por chave + 2 melhores terceiros');

// Mata-mata com 8: quartas, semis, final, 3º lugar
const mm = L.montarMata(cat, seeds, 0, uid);
assert.equal(mm.filter(g => g.rodadaNome === 'Quartas').length, 4);
assert.equal(mm.filter(g => g.rodadaNome === 'Semifinal').length, 2);
assert.equal(mm.filter(g => g.rodadaNome === 'Final').length, 1);
assert.equal(mm.filter(g => g.rodadaNome === '3º lugar').length, 1);
const q1 = mm.find(g => g.rodadaNome === 'Quartas' && g.idx === 0);
assert.equal(q1.a, seeds[0]); assert.equal(q1.b, seeds[7], '1º enfrenta o 8º');

// Mata-mata com 6: dois "bye" para os melhores
const mm6 = L.montarMata(cat, seeds.slice(0, 6), 0, uid);
const byes = mm6.filter(g => g.status === 'bye');
assert.equal(byes.length, 2);
assert.deepEqual(byes.map(b => b.vencedor).sort(), [seeds[0], seeds[1]].sort());
const semis6 = mm6.filter(g => g.rodadaNome === 'Semifinal');
assert.ok(semis6.some(s => s.a === seeds[0] || s.b === seeds[0]), 'bye já avançou para a semi');

// Pódio após a final
const sim = mm.map(g => ({ ...g }));
const byId = Object.fromEntries(sim.map(g => [g.id, g]));
for (const nome of ['Quartas', 'Semifinal', '3º lugar', 'Final']) {
  sim.filter(g => g.rodadaNome === nome).forEach(g => {
    g.status = 'fim'; g.pa = 18; g.pb = 12; g.vencedor = g.a;
    if (g.prox) byId[g.prox.id][g.prox.slot] = g.a;
    if (g.perdProx) byId[g.perdProx.id][g.perdProx.slot] = g.b;
  });
}
const pd = L.podio(cat, duplas, sim);
assert.equal(pd[0], seeds[0]);
assert.equal(pd.length, 3);

// Fila: dupla em quadra não é chamada de novo
const f = L.fila([{ id: 'x', a: 'd0', b: 'd1', status: 'aovivo', ordem: 1 }, { id: 'y', a: 'd0', b: 'd2', status: 'agendado', ordem: 2 }, { id: 'z', a: 'd3', b: 'd4', status: 'agendado', ordem: 3 }]);
assert.deepEqual(f.map(j => j.id), ['z']);

// Lista do WhatsApp
assert.deepEqual(L.lerLista('1) Rafa / Tiago\nBruno e Caio\nAna & Bia\nsozinho'), [['Rafa', 'Tiago'], ['Bruno', 'Caio'], ['Ana', 'Bia']]);

console.log('Todos os testes passaram.');
