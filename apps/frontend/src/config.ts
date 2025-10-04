/**
 * Frontend Configuration
 * Backend runs on port 7998 for both development and production
 */

// Detect OS in browser environment
const isWindows = navigator.userAgent.includes('Windows')
const isLinux = navigator.userAgent.includes('Linux')

// Set backend port based on OS detection
const backendPort = 7998  // Both dev and prod use port 7998

export const config = {
  // Backend API configuration
  API_BASE: `http://localhost:${backendPort}`,
  
  // Environment info
  isDevelopment: isWindows,
  isProduction: isLinux,
  
  // Ports
  backendPort,
  frontendPort: isWindows ? 5173 : 8077,
  
  // Debug info
  userAgent: navigator.userAgent,
  platform: isWindows ? 'Windows' : isLinux ? 'Linux' : 'Unknown'
}

// Log configuration in development
if (config.isDevelopment) {
  console.log('Frontend Config:', config)
}
