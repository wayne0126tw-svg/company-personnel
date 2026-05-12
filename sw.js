const CACHE_VERSION = 'v4.1';
const CACHE_NAME = `company-mgmt-${CACHE_VERSION}`;

// 安裝 - 快取靜態資源
self.addEventListener('install', (event) => {
  console.log('[SW] 安裝中...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 快取已建立:', CACHE_NAME);
      return self.skipWaiting();
    }).catch(err => {
      console.warn('[SW] 快取建立失敗:', err);
      return self.skipWaiting();
    })
  );
});

// 啟動 - 清除舊 cache
self.addEventListener('activate', (event) => {
  console.log('[SW] 啟動中...');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME && name.startsWith('company-mgmt-')) {
            console.log('[SW] 刪除舊快取:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      console.log('[SW] 已啟動，版本:', CACHE_VERSION);
      return self.clients.claim();
    })
  );
});

// 攔截請求 - 網路優先，回退到快取
self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  const { request } = event;

  // HTML 檔案：網路優先
  if (request.destination === 'document' || request.url.includes('.html')) {
    event.respondWith(
      fetch(request, { credentials: 'same-origin' })
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          }).catch(() => {});
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || new Response('離線模式：無快取版本', { status: 503 });
          });
        })
    );
    return;
  }

  // 字體和外部資源：快取優先
  if (request.url.includes('fonts.googleapis') || request.url.includes('fonts.gstatic') || request.url.includes('cdnjs')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request, { credentials: 'same-origin' }).then((response) => {
          if (!response || response.status !== 200) return response;
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse).catch(() => {});
          });
          return response;
        });
      }).catch(() => caches.match(request))
    );
    return;
  }

  // 其他：直接通過
  event.respondWith(fetch(request));
});

// 處理後台更新訊息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

