import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, mode }) => {
  // Use HTTPS only when explicitly requested
  const useHttps = process.env.HTTPS === 'true'
  
  return {
    plugins: [
      react(),
      ...(useHttps ? [basicSsl()] : []),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png'],
        manifest: {
          name: 'Kas Pemuda',
          short_name: 'Kas',
          description: 'Aplikasi pencatatan kas pemuda',
          theme_color: '#1e293b',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          icons: [
            {
              src: 'logo.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\/rest\/v1\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
      }),
    ],
    server: {
      host: true,
      port: 5173,
    },
  }
})