import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/ambria-calendar/',
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.GITHUB_SHA?.slice(0, 7) || Date.now().toString()
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      includeAssets: ['favicon.png', 'logo.png', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Ambria Calendar',
        short_name: 'Ambria',
        description: 'Ambria Calendar',
        theme_color: '#E85D75',
        background_color: '#FAFAF8',
        display: 'standalone',
        start_url: '/ambria-calendar/',
        scope: '/ambria-calendar/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
