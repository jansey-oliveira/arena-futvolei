// Service worker: deixa o site abrir mesmo sem internet (mesário e telão).
// Arquivos do próprio site: tenta a rede primeiro (para pegar atualizações) e usa a cópia guardada se cair.
// Bibliotecas e fontes externas: usa a cópia guardada e atualiza em segundo plano.
const CACHE = 'arena-v1';
const BASE = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/logica.js', 'js/marca.js', 'js/config.js', 'manifest.webmanifest', 'img/marca/100-compromisso-escudo.png', 'img/marca/icone-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).catch(() => { })); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (/firestore\.googleapis|identitytoolkit|securetoken|googleapis\.com\/(v1|identity)/.test(u.href)) return; // dados ao vivo: sempre pela rede
  const guardar = res => { if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(CACHE).then(k => k.put(r, c)); } return res; };
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(guardar).catch(() => caches.match(r, { ignoreSearch: true }).then(x => x || caches.match('index.html'))));
  } else if (/gstatic\.com|fonts\.googleapis|fonts\.gstatic|jsdelivr/.test(u.host)) {
    e.respondWith(caches.match(r).then(x => { const f = fetch(r).then(guardar).catch(() => x); return x || f; }));
  }
});
