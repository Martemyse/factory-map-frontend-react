/**
 * Frontend Configuration
 * Backend runs on port 7998 for both development and production
 */

// Use Vite's mode to detect environment (set at build time, not runtime)
const isDevelopment = import.meta.env.DEV
const isProduction = import.meta.env.PROD

// Set backend port based on environment
const backendPort = 7998  // Both dev and prod use port 7998

export const config = {
  // Backend API configuration - use relative URLs for Docker compatibility
  API_BASE: isDevelopment ? `http://localhost:${backendPort}` : '/api',
  
  // Tileserver configuration - use relative URLs for Docker compatibility
  TILESERVER_BASE: isDevelopment ? 'http://localhost:7999' : '/tiles',
  
  // Environment info
  isDevelopment,
  isProduction,
  
  // Ports
  backendPort,
  frontendPort: isDevelopment ? 5173 : 8077,
  
  // Debug info
  mode: import.meta.env.MODE
}

// Log configuration in development
if (config.isDevelopment) {
  console.log('Frontend Config:', config)
}
