/**
 * DentalFlow — Service Worker v2
 * Cache-first para archivos estáticos, network-first para API.
 * Sin dependencias externas (100% offline-ready).
 */

const CACHE_NAME = 'dentalflow-v9';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/localdb.js',
  '/js/api.js',
  '/js/components/toast.js',
  '/js/components/calendar.js',
  '/js/components/odontogram.js',
  '/js/views/appointments.js',
  '/js/views/dashboard.js',
  '/js/views/messages.js',
  '/js/views/patients.js',
  '/js/views/patientDetail.js',
  '/js/views/newAppointment.js',
  '/js/views/auth.js',
  '/js/views/settings.js',
  '/js/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ---- Instalación: cachear todos los assets estáticos ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// ---- Activación: limpiar caches antiguos ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: estrategia dual ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Rutas de API → Network-first (si falla, error claro)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'Sin conexión al servidor. La app funciona en modo offline.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Resto de archivos (HTML, CSS, JS) → Network-first (intenta red, si falla usa caché)
  event.respondWith(
    fetch(request).then((response) => {
      // Guardar una copia fresca en caché
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => {
      // Si no hay red, buscar en caché
      return caches.match(request).then((cached) => {
        if (cached) return cached;
        // Fallback final para navegación
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ---- Mensaje para forzar actualización ----
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});