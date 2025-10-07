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
  // In development: use localhost
  // In production: use window.location.hostname to get the current host
  API_BASE: isDevelopment 
    ? `http://localhost:${backendPort}` 
    : `http://${window.location.hostname}:7998`,
  
  // Tileserver configuration
  TILESERVER_BASE: isDevelopment 
    ? 'http://localhost:7999' 
    : `http://${window.location.hostname}:7999`,
  
  // Environment info
  isDevelopment,
  isProduction,
  
  // Ports
  backendPort,
  frontendPort: isDevelopment ? 8077 : 8077,
  
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
