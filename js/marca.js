// Identidade visual configurável (white-label).
// Uma "marca" é um objeto simples. O site calcula a partir dela todas as cores,
// fontes e o logo, então cada campeonato pode ter a sua aparência.

export const FONTES_TITULO = {
  'Bebas Neue': { peso: 400, familia: 'Bebas+Neue' },
  'Oswald': { peso: 600, familia: 'Oswald:wght@500;600;700' },
  'Anton': { peso: 400, familia: 'Anton' },
  'Barlow Condensed': { peso: 700, familia: 'Barlow+Condensed:wght@600;700;800' },
  'Archivo Black': { peso: 400, familia: 'Archivo+Black' },
  'Teko': { peso: 600, familia: 'Teko:wght@500;600' },
};
export const FONTES_TEXTO = {
  'Montserrat': 'Montserrat:wght@400;500;600;700',
  'Figtree': 'Figtree:wght@400;500;600;700',
  'Inter': 'Inter:wght@400;500;600;700',
  'Poppins': 'Poppins:wght@400;500;600;700',
  'Nunito Sans': 'Nunito+Sans:wght@400;600;700',
  'Barlow': 'Barlow:wght@400;500;600;700',
};

/** Modelos prontos. O primeiro é a marca 100 Compromisso, extraída do manual de uniformes. */
export const MODELOS = {
  cem: {
    nome: '100 Compromisso', sub: 'Futvôlei', lema: 'Disciplina · Foco · Resultado',
    logo: 'img/marca/100-compromisso-escudo.png', logoTinta: true,
    modo: 'escuro', cantos: 'retos',
    cores: { fundo: '#0B0B0B', texto: '#F2F2F2', destaque: '#2AA8E8', secundaria: '#D4A25E' },
    fonteTitulo: 'Bebas Neue', fonteTexto: 'Montserrat',
    paleta: [
      { nome: 'Azul', cor: '#2AA8E8' }, { nome: 'Dourado', cor: '#D4A25E' },
      { nome: 'Rosa', cor: '#F2A2C6' }, { nome: 'Grafite', cor: '#9A9A9A' },
    ],
  },
  areia: {
    nome: 'Arena Futvôlei', sub: 'Torneios', lema: 'Do sorteio ao pódio',
    logo: '', logoTinta: false, modo: 'claro', cantos: 'arredondados',
    cores: { fundo: '#F3EFE7', texto: '#1B1A17', destaque: '#E0672B', secundaria: '#1F6F8B' },
    fonteTitulo: 'Oswald', fonteTexto: 'Inter',
    paleta: [
      { nome: 'Laranja', cor: '#E0672B' }, { nome: 'Petróleo', cor: '#1F6F8B' },
      { nome: 'Verde', cor: '#3E8E5A' }, { nome: 'Vinho', cor: '#9B2F4B' },
    ],
  },
  noite: {
    nome: 'Arena Futvôlei', sub: 'Torneios', lema: 'Do sorteio ao pódio',
    logo: '', logoTinta: false, modo: 'escuro', cantos: 'arredondados',
    cores: { fundo: '#0A161D', texto: '#E6EDF0', destaque: '#F5C22B', secundaria: '#55B4E4' },
    fonteTitulo: 'Barlow Condensed', fonteTexto: 'Figtree',
    paleta: [
      { nome: 'Amarelo', cor: '#F5C22B' }, { nome: 'Azul', cor: '#55B4E4' },
      { nome: 'Verde', cor: '#4CC37F' }, { nome: 'Coral', cor: '#FF7A66' },
    ],
  },
};
export const NOMES_MODELOS = { cem: '100 Compromisso (preto)', areia: 'Areia (claro)', noite: 'Noite (azul-marinho)' };

/* ---------- cores ---------- */
const hexOk = h => /^#[0-9a-f]{6}$/i.test(String(h || ''));
export const normHex = (h, pad) => { h = String(h || '').trim(); if (/^#[0-9a-f]{3}$/i.test(h)) h = '#' + [...h.slice(1)].map(c => c + c).join(''); return hexOk(h) ? h.toUpperCase() : pad; };
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
/** Mistura a cor `a` com `b` na proporção `t` (0 = só a, 1 = só b). */
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
export const luminancia = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Preto ou branco, o que tiver mais contraste sobre a cor. */
export const tintaSobre = c => contraste(c, '#0B0B0B') >= contraste(c, '#FFFFFF') ? '#0B0B0B' : '#FFFFFF';
/** Ajusta uma cor para ter contraste mínimo sobre o fundo (para textos e ícones coloridos). */
export function legivel(cor, fundo, min = 3) {
  let c = cor; const alvo = luminancia(fundo) < 0.4 ? '#FFFFFF' : '#000000';
  for (let i = 0; i < 12 && contraste(c, fundo) < min; i++) c = mix(c, alvo, 0.12);
  return c;
}

/** Mistura `t` com `f` o máximo possível (até `r`) mantendo contraste mínimo sobre todos os fundos. */
function suave(t, f, r, fundos, min = 4.6) {
  for (let k = r; k > 0; k -= 0.03) { const c = mix(t, f, k); if (fundos.every(b => contraste(c, b) >= min)) return c; }
  return t;
}

/** Completa uma marca parcial com os valores do modelo base, e corrige cores inválidas. */
export function completar(m, base = MODELOS.cem) {
  m = m || {};
  const cores = { ...base.cores, ...(m.cores || {}) };
  Object.keys(base.cores).forEach(k => cores[k] = normHex(cores[k], base.cores[k]));
  const paleta = (Array.isArray(m.paleta) && m.paleta.length ? m.paleta : base.paleta)
    .map(p => ({ nome: String(p.nome || '').slice(0, 24), cor: normHex(p.cor, cores.destaque) })).slice(0, 8);
  return {
    ...base, ...m, cores, paleta,
    modo: m.modo === 'claro' ? 'claro' : m.modo === 'escuro' ? 'escuro' : base.modo,
    fonteTitulo: FONTES_TITULO[m.fonteTitulo] ? m.fonteTitulo : base.fonteTitulo,
    fonteTexto: FONTES_TEXTO[m.fonteTexto] ? m.fonteTexto : base.fonteTexto,
    cantos: m.cantos === 'arredondados' ? 'arredondados' : m.cantos === 'retos' ? 'retos' : base.cantos,
  };
}

/** Calcula as variáveis CSS do site a partir da marca. Função pura (testável). */
export function tokens(m) {
  const { fundo: f, texto: t, destaque: a, secundaria: s } = m.cores;
  const escuro = m.modo !== 'claro';
  const v = {};
  v['--bg'] = f;
  v['--ink'] = t;
  if (escuro) {
    v['--surface'] = mix(f, t, 0.045); v['--surface2'] = mix(f, t, 0.08); v['--line'] = mix(f, t, 0.15);
    v['--muted'] = suave(t, f, 0.42, [f, v['--surface'], v['--surface2']]);
    v['--board'] = mix(f, '#000000', 0.35); v['--board-2'] = mix(f, t, 0.06); v['--board-line'] = mix(f, t, 0.14);
    v['--board-ink'] = t; v['--board-dim'] = suave(t, f, 0.45, [v['--board'], v['--board-2']]);
    v['--live'] = '#FF5A47'; v['--ok'] = '#4CC37F';
  } else {
    v['--surface'] = mix(f, '#FFFFFF', 0.7); v['--surface2'] = mix(f, t, 0.035); v['--line'] = mix(f, t, 0.14);
    v['--muted'] = suave(t, f, 0.45, [f, v['--surface'], v['--surface2']]);
    const b = luminancia(t) < 0.06 ? mix(t, a, 0.06) : '#141414';
    v['--board'] = b; v['--board-2'] = mix(b, '#FFFFFF', 0.07); v['--board-line'] = mix(b, '#FFFFFF', 0.14);
    v['--board-ink'] = mix(f, '#FFFFFF', 0.6); v['--board-dim'] = suave(v['--board-ink'], b, 0.45, [b, v['--board-2']]);
    v['--live'] = '#C8321F'; v['--ok'] = '#1D7F48';
  }
  v['--accent'] = a; v['--accent-ink'] = tintaSobre(a);
  v['--accent-txt'] = legivel(legivel(a, f, 3), v['--surface'], 3);   // destaque usado como texto
  v['--accent-board'] = legivel(a, v['--board'], 3);
  v['--sec'] = legivel(legivel(s, f, 3), v['--surface'], 3); v['--sec-ink'] = tintaSobre(s);
  // telão: sempre escuro
  const tv = escuro ? f : v['--board'];
  v['--tv-bg'] = tv; v['--tv-panel'] = mix(tv, '#FFFFFF', 0.06); v['--tv-line'] = mix(tv, '#FFFFFF', 0.14);
  v['--tv-ink'] = escuro ? t : '#F2F2F2'; v['--tv-dim'] = suave(v['--tv-ink'], tv, 0.45, [tv, v['--tv-panel']]); v['--tv-accent'] = legivel(a, tv, 3);
  v['--r'] = m.cantos === 'retos' ? '3px' : '10px';
  v['--r-sm'] = m.cantos === 'retos' ? '2px' : '8px';
  v['--f-display'] = `"${m.fonteTitulo}","Arial Narrow",system-ui,sans-serif`;
  v['--f-display-w'] = String(FONTES_TITULO[m.fonteTitulo]?.peso || 700);
  v['--f-body'] = `"${m.fonteTexto}",system-ui,-apple-system,"Segoe UI",sans-serif`;
  return v;
}

/** Cor da categoria ajustada para leitura sobre o fundo da marca. */
export const corCategoria = (m, cor, onde = 'fundo') => {
  const c = normHex(cor, m.cores.destaque), t = tokens(m);
  return legivel(c, onde === 'board' ? t['--board'] : onde === 'tv' ? t['--tv-bg'] : t['--bg'], 3);
};

export function urlFontes(m) {
  const fam = [FONTES_TITULO[m.fonteTitulo]?.familia, FONTES_TEXTO[m.fonteTexto]].filter(Boolean);
  return 'https://fonts.googleapis.com/css2?' + fam.map(f => 'family=' + f).join('&') + '&display=swap';
}

let ultima = '';
/** Aplica a marca ao documento: variáveis CSS, fontes, título, ícone e cor do navegador. */
export function aplicar(marca, { titulo } = {}) {
  const m = completar(marca);
  const chave = JSON.stringify(m) + '|' + (titulo || '');
  if (chave === ultima) return m;
  ultima = chave;
  const root = document.documentElement, v = tokens(m);
  Object.entries(v).forEach(([k, val]) => root.style.setProperty(k, val));
  root.style.colorScheme = m.modo === 'claro' ? 'light' : 'dark';
  root.dataset.modo = m.modo;
  let link = document.getElementById('fontes-marca');
  const href = urlFontes(m);
  if (!link) { link = document.createElement('link'); link.id = 'fontes-marca'; link.rel = 'stylesheet'; document.head.appendChild(link); }
  if (link.href !== href) link.href = href;
  document.title = titulo ? `${titulo} · ${m.nome}` : `${m.nome}${m.sub ? ' · ' + m.sub : ''}`;
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = v['--board'];
  iconeDaMarca(m).then(url => { if (!url) return; let ic = document.querySelector('link[rel="icon"]'); if (!ic) { ic = document.createElement('link'); ic.rel = 'icon'; document.head.appendChild(ic); } ic.type = 'image/png'; ic.href = url; }).catch(() => { });
  return m;
}

/** Desenha o ícone da aba com o logo da marca (pintado na cor de destaque, se for de uma cor só). */
function iconeDaMarca(m) {
  return new Promise(ok => {
    if (!m.logo) return ok('');
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const n = 64, cv = document.createElement('canvas'); cv.width = cv.height = n; const cx = cv.getContext('2d');
        const p = 3, lg = document.createElement('canvas'); lg.width = lg.height = n; const lx = lg.getContext('2d');
        lx.drawImage(img, p, p, n - 2 * p, n - 2 * p);
        if (m.logoTinta) { lx.globalCompositeOperation = 'source-in'; lx.fillStyle = m.cores.destaque; lx.fillRect(0, 0, n, n); }
        cx.fillStyle = m.cores.fundo; cx.beginPath(); cx.arc(n / 2, n / 2, n / 2, 0, Math.PI * 2); cx.fill();
        cx.drawImage(lg, 0, 0);
        ok(cv.toDataURL('image/png'));
      } catch { ok(''); }
    };
    img.onerror = () => ok(''); img.src = m.logo;
  });
}
