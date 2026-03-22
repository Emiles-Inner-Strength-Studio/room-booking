import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.NODE_ENV === 'production' ? '/room-booking/' : '/',
  server: {
    allowedHosts: ['emclaw', 'emclaw.tailb991f7.ts.net'],
  },
})
