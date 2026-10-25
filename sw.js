/* Service worker: guarda la aplicación en caché para abrirla sin conexión.
   Cambiar VERSION en cada publicación para limpiar cachés antiguas. */
const VERSION = "sikuani-med-v5";
const ARCHIVOS = ["./", "./index.html", "./styles.css", "./app.js", "./cifrado.js", "./manifest.webmanifest", "./iconos/icono-192.png", "./iconos/icono-512.png", "./cuerpo3d.js", "./tema-vega.css", "./fuentes/epilogue-latin-400-normal.woff2", "./fuentes/epilogue-latin-600-normal.woff2", "./fuentes/epilogue-latin-700-normal.woff2", "./fuentes/epilogue-latin-800-normal.woff2", "./vendor/three/three.module.min.js", "./vendor/three/three.core.min.js", "./vendor/three/addons/loaders/GLTFLoader.js", "./vendor/three/addons/controls/OrbitControls.js", "./vendor/three/addons/utils/BufferGeometryUtils.js", "./modelos/cuerpo_hombre.glb", "./modelos/cuerpo_mujer.glb", "./modelos/esqueleto.glb"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(caches.keys()
    .then((nombres) => Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Red primero (con conexión siempre llega la versión nueva) y caché como respaldo sin conexión.
self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET" || new URL(evento.request.url).origin !== self.location.origin) return;
  evento.respondWith(
    fetch(evento.request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(evento.request, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(evento.request, { ignoreSearch: true }).then((enCache) => enCache || caches.match("./index.html"))));
});
