/* Housen Photo — オフライン用キャッシュ（アプリ本体のみ。写真データは端末のIndexedDBに保存） */
const VERSION = 'housen-v4';
const APP = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const TEMPLATES = ['./templates/SMD-007-R0-Photo-Album-Template.xlsx'];
self.addEventListener('install', e => {
  // 1つでも取得できないファイルがあっても、残りはキャッシュする
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.allSettled([...APP, ...TEMPLATES, './icon-192.png', './icon-512.png', './apple-touch-icon.png'].map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Excelテンプレート：通信できれば最新版、圏外ならキャッシュ（?v= の違いは無視）
  if (url.origin === location.origin && url.pathname.includes('/templates/')) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(url.pathname, copy)); }
      return res;
    }).catch(() => caches.match(url.pathname, { ignoreSearch: true }).then(r => r || caches.match(req, { ignoreSearch: true }))
      .then(r => r || new Response('', { status: 504 }))));
    return;
  }
  // アプリ本体：通信できれば最新版を取得してキャッシュ更新、圏外ならキャッシュを使う
  if (req.mode === 'navigate' || (url.origin === location.origin && APP.some(p => url.pathname.endsWith(p.replace('./', '/')) ))) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy));
      return res;
    }).catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // フォント・Supabaseライブラリ：一度取得したらキャッシュを使う（圏外でも起動できるように）
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@'))) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }).catch(() => new Response('', { status: 503 }))));
  }
});
