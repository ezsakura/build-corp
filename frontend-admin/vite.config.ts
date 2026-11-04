import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    proxy: {
      '/api': 'http://localhost:3002',
      '/uploads': 'http://localhost:3002',
    },
  },
})