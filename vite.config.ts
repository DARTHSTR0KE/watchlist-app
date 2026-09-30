import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// The same /tmdb forwarding vercel.json does in production, so search
// works locally too. The browser never calls api.themoviedb.org itself.
const tmdbProxy = {
  '/tmdb': {
    target: 'https://api.themoviedb.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/tmdb/, '/3'),
  },
}

export default defineConfig({
  server: { proxy: tmdbProxy },
  preview: { proxy: tmdbProxy },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Chhobidam',
        short_name: 'Chhobidam',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#101014',
        // Matches the icon's own ground. When these differ, Android's
        // splash draws the tile as a lighter box on a darker field.
        background_color: '#121218',
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
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
