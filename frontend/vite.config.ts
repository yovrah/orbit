import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Orbit Remote',
        short_name: 'Orbit',
        description: 'Premium remote controller for Windows PCs',
        theme_color: '#f8f9fa',
        background_color: '#eef2f7',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // LAN tool: prefer the network so a freshly scanned QR always loads the
        // latest code. The cache is only a fallback when the PC is unreachable.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, request }) =>
              sameOrigin &&
              (request.mode === 'navigate' || ['script', 'style'].includes(request.destination)),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'orbit-app',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 64 },
            },
          },
        ],
      }
    })
  ],
  server: {
    port: 3000,
    host: true
  }
});
