const CACHE_NAME = 'prohappy-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('Failed to cache some resources:', err);
          // Don't fail the installation if some resources can't be cached
          return Promise.resolve();
        });
      })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim all clients immediately
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(err => {
          console.warn('Fetch failed:', err);
          // Return a basic offline page or error response if needed
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
          throw err;
        });
      })
  );
});

// Enhanced push event listener with error handling
self.addEventListener('push', event => {
  console.log('Push event received');
  
  if (!event.data) {
    console.warn('Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('New notification', data);
    
    const options = {
      body: data.body || 'New notification',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'prohappy-notification',
      requireInteraction: false,
      silent: false
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'ProHappy', options)
    );
  } catch (error) {
    console.error('Error handling push event:', error);
    // Show a fallback notification
    event.waitUntil(
      self.registration.showNotification('ProHappy', {
        body: 'You have a new notification',
        icon: '/logo.png',
        badge: '/logo.png'
      })
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});