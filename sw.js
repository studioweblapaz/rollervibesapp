// ==========================================
// SERVICE WORKER - ROLLER VIBES MX LA PAZ
// ==========================================
// Este archivo hace dos cosas mágicas:
// 1. Permite que la app se instale en el celular.
// 2. Recibe las notificaciones push (recordatorios de pago) en segundo plano.

const CACHE_NAME = 'roller-vibes-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './manifest-admin.json',
  './logo.png',
  './logo-192.png'
];

// 1. INSTALACIÓN: Guarda los archivos básicos para que la app cargue rápido
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('🛼 Roller Vibes: Archivos en caché guardados.');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((err) => console.log('Error al guardar caché:', err))
  );
  self.skipWaiting(); // Activa el nuevo service worker inmediatamente
});

// 2. ACTIVACIÓN: Limpia cachés viejas si actualizamos la app en el futuro
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('🛼 Roller Vibes: Borrando caché vieja.');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // Toma el control de todas las pestañas abiertas
});

// 3. PETICIONES (FETCH): Estrategia "Network First"
// Siempre intenta traer los datos más frescos de internet (Firebase).
// Si no hay internet, usa la caché.
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean de nuestro dominio o que sean de Firebase/Cloudinary
  if (event.request.url.includes('firebase') || event.request.url.includes('cloudinary')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, la guardamos en caché para la próxima
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla internet, buscamos en la caché
        return caches.match(event.request);
      })
  );
});

// 4. NOTIFICACIONES PUSH: Aquí llegan los recordatorios de pago desde Firebase
self.addEventListener('push', (event) => {
  let data = { title: 'Roller Vibes MX', body: 'Tienes una nueva notificación.', icon: './logo-192.png' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || './logo-192.png',
    badge: './logo-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './admin.html' // Al hacer clic, abre el panel de admin
    },
    actions: [
      { action: 'ver', title: 'Ver ahora' },
      { action: 'cerrar', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. CLIC EN LA NOTIFICACIÓN: Abre la app en la pantalla correcta
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'cerrar') return;

  const urlToOpen = event.notification.data.url || './admin.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta, la enfocamos
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no, abrimos una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});