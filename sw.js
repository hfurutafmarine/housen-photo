/* Housen Photo — オフライン用キャッシュ（アプリ本体のみ。写真データは端末のIndexedDBに保存） */
const VERSION = 'housen-v2';
const APP = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
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
