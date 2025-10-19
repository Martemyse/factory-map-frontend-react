import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

// Detect OS and set appropriate port
const isWindows = os.platform() === 'win32'
const port = isWindows ? 8082 : 8082

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
    sourcemap: true, // Always generate sourcemaps for debugging
  },
  // Ensure source maps work in development
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  // Enhanced source map configuration
  esbuild: {
    sourcemap: 'inline'
  }
})
