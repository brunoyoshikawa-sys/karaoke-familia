// Service worker minimo, so pra cumprir o requisito de instalabilidade do PWA
// (poder "Instalar app" no Chrome/Android, ou "Adicionar a tela de inicio" no
// iOS). De proposito NAO faz cache de nada: a fila, o catalogo e ate a versao
// do proprio HTML mudam o tempo todo durante uma festa, entao um cache
// agressivo aqui causaria bugs de "ta desatualizado" bem na hora errada.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
