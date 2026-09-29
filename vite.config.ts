import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages는 https://senrayab.github.io/keeping-gem/ 하위에서 서비스된다.
// 개발 중에는 루트가 편하므로 빌드(와 빌드 결과를 띄우는 preview)에만 붙인다.
const BASE = '/keeping-gem/'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? BASE : '/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true, port: 5173 },
  plugins: [
    react(),
    VitePWA({
      // 새 버전을 받아 두기만 하고, 바꿔 끼우는 건 사용자가 토스트에서 고른다
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png', 'favicon.ico'],
      manifest: {
        name: 'Keeping Gem - 추억의 밤하늘',
        short_name: 'Keeping Gem',
        lang: 'ko',
        theme_color: '#07060d',
        background_color: '#07060d',
        display: 'standalone',
        orientation: 'portrait',
        // start_url/scope는 base에서 채워진다. '/'로 고정하면 도메인 루트가 열린다.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // 마스커블은 기기가 원/스퀘어클로 잘라내므로 여백을 더 둔 그림을 따로 쓴다
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // 이모지 글꼴은 1MB쯤 된다 — 설치할 때 미리 받지 않고, 이모지를 처음 그릴 때 받아 둔다
        globIgnores: ['**/tossface-*.woff2'],
        // 영수증 스킨의 글꼴(구글 폰트)은 한 번 받아 두고 계속 쓴다 — 비행기 모드에서도 같은 모습
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'skin-fonts-css', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /tossface-.*\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'emoji-font',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'skin-fonts',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}))
