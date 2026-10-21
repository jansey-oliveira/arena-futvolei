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

// Sorteio de duplas sem potes: 9 atletas → 4 duplas e 1 sobra, ninguém repetido
const at = [...Array(9)].map((_, i) => ({ id: 'a' + i, nome: 'Atleta ' + i }));
const s1 = L.sortearDuplas(at);
assert.equal(s1.pares.length, 4); assert.equal(s1.sobra.length, 1);
assert.equal(new Set([...s1.pares.flat(), ...s1.sobra].map(a => a.id)).size, 9);

// Com potes: toda dupla tem um de cada pote
const ap = [...Array(6)].map((_, i) => ({ id: 'p' + i, pote: i < 4 ? 1 : 2 }));
const s2 = L.sortearDuplas(ap, true);
assert.equal(s2.pares.length, 2); assert.equal(s2.sobra.length, 2);
s2.pares.forEach(([x, y]) => { assert.equal(x.pote || 1, 1); assert.equal(y.pote, 2); });
assert.ok(s2.sobra.every(a => a.pote === 1), 'sobram os do pote maior');

// Lista de atletas com pote opcional
assert.deepEqual(L.lerAtletas('1) Rafa\nTiago - 2\nAna (2)\nBia pote 1\nCarla'),
  [{ nome: 'Rafa', pote: null }, { nome: 'Tiago', pote: 2 }, { nome: 'Ana', pote: 2 }, { nome: 'Bia', pote: 1 }, { nome: 'Carla', pote: null }]);

// Desempate manual: duas duplas com estatísticas iguais e sem confronto direto
const dEmp = [{ id: 'x', cat: 'k', chave: 'A' }, { id: 'y', cat: 'k', chave: 'A' }];
const tSem = L.tabela(dEmp, [], 'k', 'A');
assert.ok(tSem.every(r => r.empate), 'empate detectado');
assert.deepEqual(L.tabela(dEmp, [], 'k', 'A', ['y', 'x']).map(r => r.id), ['y', 'x'], 'ordem manual vale');
assert.deepEqual(L.tabela(dEmp, [], 'k', 'A', ['x', 'y']).map(r => r.id), ['x', 'y']);

// Melhor de 3 sets
const cs = { pontos: 18, vantagem: true, finalSets: true, pontosSet: 18, pontosTie: 15 };
assert.equal(L.jogoEmSets(cs, { fase: 'mata', rodadaNome: 'Final' }), true);
assert.equal(L.jogoEmSets(cs, { fase: 'mata', rodadaNome: 'Semifinal' }), false);
assert.equal(L.jogoEmSets({ ...cs, finalSets: false }, { fase: 'mata', rodadaNome: 'Final' }), false);
assert.equal(L.regraDoSet(cs, 2).pontos, 15);
assert.deepEqual(L.setsVencidos([[18, 15], [14, 18], [15, 10]]), { a: 2, b: 1 });
assert.deepEqual(L.lerSets('18-15, 15x18; 15 10'), [[18, 15], [15, 18], [15, 10]]);
assert.equal(L.validarSets(cs, L.lerSets('18-15, 15-18, 15-10')), null);
assert.equal(L.validarSets(cs, L.lerSets('18-15, 18-12')), null);
assert.match(L.validarSets(cs, L.lerSets('18-15')), /vencedor/);
assert.match(L.validarSets(cs, L.lerSets('18-17, 18-12')), /1º set/);
assert.match(L.validarSets(cs, L.lerSets('18-15, 18-12, 15-3')), /decidida/);

// Fila respeita o horário de início das categorias
const jf = [{ id: 'g1', cat: 'cedo', status: 'agendado', a: 'a', b: 'b', ordem: 2 }, { id: 'g2', cat: 'tarde', status: 'agendado', a: 'c', b: 'd', ordem: 1 }];
assert.deepEqual(L.fila(jf, () => true, null, cid => cid !== 'tarde').map(j => j.id), ['g1']);
assert.deepEqual(L.fila(jf).map(j => j.id), ['g2', 'g1']);
const ini = L.inicioCategoria({ hora: '15:00' }, '2026-12-19');
assert.equal(new Date(ini).getHours(), 15);
assert.equal(L.inicioCategoria({ hora: '' }, '2026-12-19'), null);
assert.equal(L.inicioCategoria({ hora: '10:00', dia: '2026-12-20' }, '2026-12-19'), new Date('2026-12-20T10:00').getTime());
// Previsões: 2 quadras, 20 min, categoria "tarde" só depois das 15h
const ag = new Date('2026-12-19T08:00').getTime(), m20 = 20 * 60000, t15 = new Date('2026-12-19T15:00').getTime();
const jp = [1, 2, 3].map(i => ({ id: 'c' + i, cat: 'cedo', status: 'agendado', ordem: i })).concat([{ id: 't1', cat: 'tarde', status: 'agendado', ordem: 0 }]);
const pv = L.previsoes(jp, 2, m20, cid => cid === 'tarde' ? t15 : null, ag);
assert.equal(pv.t1, t15, 'categoria da tarde começa às 15h');
assert.equal(pv.c1, ag); assert.equal(pv.c2, ag); assert.equal(pv.c3, ag + m20);

// Pix copia e cola (exemplo oficial do manual do BR Code)
assert.equal(L.pixPayload({ chave: '123e4567-e12b-12d1-a456-426655440000', nome: 'Fulano de Tal', cidade: 'BRASILIA' }),
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***63041D3D'.slice(0, -4) + L.crc16('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***6304'));
assert.equal(L.crc16('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'), '1D3D', 'CRC do exemplo oficial');
assert.equal(L.chavePix('(11) 92536-5778'), '+5511925365778');
assert.equal(L.chavePix('529.982.247-25'), '52998224725');
assert.equal(L.chavePix('Fin@Exemplo.com'), 'fin@exemplo.com');
assert.equal(L.chavePix('12.345.678/0001-95'), '12345678000195');
const px = L.pixPayload({ chave: 'pix@arena.com', nome: 'Arena São João', cidade: 'São Paulo', valor: 80 });
assert.ok(px.includes('540580.00'), 'valor no payload');
assert.ok(px.includes('5914ARENA SAO JOAO') && px.includes('6009SAO PAULO'));
assert.equal(px.slice(-4), L.crc16(px.slice(0, -4)));

// Descanso mínimo e fila com jogos segurados
const jd = [{ id: 'f1', status: 'fim', a: 'a', b: 'x', fim: 1000 }, { id: 'p1', status: 'agendado', a: 'a', b: 'c', ordem: 1, cat: 'k' }, { id: 'p2', status: 'agendado', a: 'd', b: 'e', ordem: 2, cat: 'k', segurar: true }];
assert.equal(L.descansoRestante(jd, 'a', 1000 + 60000, 10 * 60000), 9 * 60000);
assert.equal(L.descansoRestante(jd, 'c', 5000, 10 * 60000), 0);
assert.equal(L.descansoRestante(jd, 'a', 1000 + 60000, 0), 0);
assert.deepEqual(L.fila(jd, () => true, null, () => true, j => !j.segurar && !L.descansoRestante(jd, j.a, 61000, 600000)).map(j => j.id), []);
assert.deepEqual(L.fila(jd, () => true, null, () => true, j => !j.segurar).map(j => j.id), ['p1']);
// Desfazer ponto
assert.deepEqual(L.desfazerPonto({ pa: 3, pb: 2, log: [{ k: 'pa', d: 1 }, { k: 'pb', d: 1 }] }), { pb: 1, log: [{ k: 'pa', d: 1 }] });
assert.equal(L.desfazerPonto({ pa: 0, pb: 0, log: [] }), null);

console.log('Todos os testes passaram.');
