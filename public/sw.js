/**
 * Service Worker - 最小実装（PWA基盤）
 * 
 * 現状: 登録のみ（キャッシュ戦略は将来実装）
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = 'static-' + CACHE_VERSION;

// インストール時
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  self.skipWaiting(); // 即座にアクティブ化
});

// アクティベーション時
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    // 古いキャッシュをクリア（将来のキャッシュ戦略用）
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// フェッチ時（現状: キャッシュなし、ネットワークのみ）
self.addEventListener('fetch', (event) => {
  // 将来のキャッシュ戦略実装用のエントリーポイント
  // 現状はネットワークから取得
  event.respondWith(fetch(event.request));
});
