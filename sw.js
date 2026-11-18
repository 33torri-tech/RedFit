/* RedFit Pro – serve solo a farla aprire anche senza internet.
   Alla prima apertura (con internet) salva l'app nel telefono: dopo parte anche in palestra, senza segnale.
   Se metti online una versione nuova, la vedi alla seconda apertura.
   I tuoi allenamenti non c'entrano: restano salvati nel telefono, come sempre. */

const CACHE = 'redfit-app-v1';
const SHELL = new URL('./', self.registration.scope).href;          // la pagina dell'app (index.html)

// Se il server ha girato l'indirizzo (redirect), il browser rifiuta la risposta: la rifaccio pulita.
async function pulita(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const res = await fetch(SHELL, { cache: 'reload' });
    if (!res.ok) throw new Error('Pagina non trovata: ' + res.status);
    const cache = await caches.open(CACHE);
    await cache.put(SHELL, await pulita(res));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;      // tutto il resto passa normalmente

  // Controllo in background se c'è una versione più nuova (se non c'è rete, pazienza).
  const aggiorna = (async () => {
    const res = await fetch(SHELL, { cache: 'no-cache' });
    if (res.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(SHELL, await pulita(res.clone()));
    }
    return res;
  })();
  event.waitUntil(aggiorna.catch(() => {}));

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const salvata = await cache.match(SHELL);
    if (salvata) return salvata;                                      // parte subito, anche senza internet
    try {
      return await pulita(await aggiorna);
    } catch (e) {
      return new Response('Per la prima apertura serve internet.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
