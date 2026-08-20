import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    // Fail loudly instead of silently picking another port if 5183 is already taken
    // (usually means a dev server is still running — stop that one first).
    strictPort: true,
  },
})
