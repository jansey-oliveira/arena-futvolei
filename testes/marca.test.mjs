// Testes da identidade visual. Rode com: node testes/marca.test.mjs
import assert from 'node:assert/strict';
import * as M from '../js/marca.js';

// Todos os modelos geram texto legível (contraste AA 4.5 para texto, 3 para destaques)
for (const [k, base] of Object.entries(M.MODELOS)) {
  const m = M.completar(base), v = M.tokens(m);
  const c = (a, b) => M.contraste(v[a], v[b]);
  assert.ok(c('--ink', '--bg') >= 7, `${k}: texto/fundo ${c('--ink', '--bg')}`);
  assert.ok(c('--ink', '--surface') >= 7, `${k}: texto/cartão`);
  assert.ok(c('--muted', '--bg') >= 4.5, `${k}: texto secundário ${c('--muted', '--bg').toFixed(2)}`);
  assert.ok(c('--muted', '--surface') >= 4.5, `${k}: secundário/cartão ${c('--muted', '--surface').toFixed(2)}`);
  assert.ok(c('--accent-ink', '--accent') >= 4.5, `${k}: botão ${c('--accent-ink', '--accent').toFixed(2)}`);
  assert.ok(c('--accent-txt', '--bg') >= 3, `${k}: destaque como texto`);
  assert.ok(c('--board-ink', '--board') >= 7, `${k}: placar`);
  assert.ok(c('--board-dim', '--board') >= 4.5, `${k}: placar secundário ${c('--board-dim', '--board').toFixed(2)}`);
  assert.ok(c('--tv-ink', '--tv-bg') >= 7, `${k}: telão`);
  assert.ok(c('--tv-dim', '--tv-bg') >= 4.5, `${k}: telão secundário ${c('--tv-dim', '--tv-bg').toFixed(2)}`);
  for (const p of m.paleta) assert.ok(M.contraste(M.corCategoria(m, p.cor), v['--bg']) >= 3, `${k}: categoria ${p.nome}`);
}

// Cores do manual 100 Compromisso preservadas
const cem = M.completar(M.MODELOS.cem);
assert.equal(M.tokens(cem)['--bg'], '#0B0B0B');
assert.equal(M.tokens(cem)['--accent'], '#2AA8E8');
assert.deepEqual(cem.paleta.map(p => p.cor), ['#2AA8E8', '#D4A25E', '#F2A2C6', '#9A9A9A']);

// Marca de cliente com cor ruim (amarelo claro num fundo branco) ainda fica legível
const ruim = M.completar({ modo: 'claro', cores: { fundo: '#FFFFFF', texto: '#111111', destaque: '#FFE600', secundaria: '#FFF000' } });
const vr = M.tokens(ruim);
assert.ok(M.contraste(vr['--accent-txt'], vr['--surface']) >= 3, 'destaque corrigido');
assert.equal(vr['--accent-ink'], '#0B0B0B', 'texto escuro sobre botão amarelo');

// Entradas inválidas caem no padrão
const inv = M.completar({ cores: { destaque: 'azul' }, fonteTitulo: 'Comic Sans', modo: 'xyz' });
assert.equal(inv.cores.destaque, '#2AA8E8'); assert.equal(inv.fonteTitulo, 'Bebas Neue'); assert.equal(inv.modo, 'escuro');
assert.equal(M.normHex('#abc'), '#AABBCC');
assert.match(M.urlFontes(cem), /Bebas\+Neue.*Montserrat/);

console.log('Testes da marca passaram.');
