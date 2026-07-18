import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env variables based on the current mode (development, production, etc.)
  const env = loadEnv(mode, process.cwd())

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      host: '0.0.0.0',       // 👈 Makes the dev server accessible on your LAN
    },
  }
})
