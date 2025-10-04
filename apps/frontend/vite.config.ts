import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

// Detect OS and set appropriate port
const isWindows = os.platform() === 'win32'
const port = isWindows ? 5173 : 8077

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: port,
    host: '0.0.0.0', // Allow external connections
  },
  preview: {
    port: port,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    sourcemap: isWindows, // Only generate sourcemaps in development
  },
})
