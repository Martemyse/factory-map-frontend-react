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
  // Backend API configuration
  // In development: use localhost directly
  // In production: use relative paths (Nginx proxies /api -> backend:7998)
  API_BASE: isDevelopment 
    ? `http://localhost:${backendPort}/api` 
    : '/api',
  
  // Tileserver configuration
  // In development: use localhost directly
  // In production: use absolute URL (MapLibre GL needs absolute URLs for tiles)
  TILESERVER_BASE: isDevelopment 
    ? 'http://localhost:7999' 
    : 'http://ecotech.utlth-ol.si:8082/tiles',
  
  // Environment info
  isDevelopment,
  isProduction,
  
  // Ports
  backendPort,
  frontendPort: isDevelopment ? 8082 : 8082,
  
  // Debug info
  mode: import.meta.env.MODE
}

// Always log configuration to debug
console.log('=== Frontend Configuration ===')
console.log('Environment Mode:', import.meta.env.MODE)
console.log('Is Development:', config.isDevelopment)
console.log('Is Production:', config.isProduction)
console.log('API_BASE:', config.API_BASE)
console.log('TILESERVER_BASE:', config.TILESERVER_BASE)
console.log('==============================')
