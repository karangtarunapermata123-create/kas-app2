import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ command, mode }) => {
  // Use HTTPS only when explicitly requested
  const useHttps = process.env.HTTPS === 'true'
  
  return {
    plugins: [
      react(),
      ...(useHttps ? [basicSsl()] : [])
    ],
    server: {
      host: true,
      port: 5173,
    },
  }
})
