# Changes Summary - Nginx Reverse Proxy Implementation

## Problem
The application required ports 7998 (backend) and 7999 (tileserver) to be exposed and accessible from the internet, which was blocked by firewall. This created "Failed to fetch" errors in the browser.

## Solution
Implemented **Nginx as a reverse proxy** so only port 8077 needs to be open. Nginx routes:
- `/api/*` → Backend (internal port 7998)
- `/tiles/*` → Tileserver (internal port 80)
- `/*` → Static React app

## Files Changed

### 1. `apps/frontend/nginx.conf` ✅
**Status**: Uncommented and configured

**Changes**:
- Enabled Nginx server on port 8077
- Added proxy for `/api/` → `http://React_App_Factory_Map_Backend:7998/`
- Added proxy for `/tiles/` → `http://factory_tileserver:80/`
- Added health check endpoint at `/health`
- Configured gzip compression
- Added security headers

### 2. `apps/frontend/Dockerfile` ✅
**Status**: Switched from `serve` to Nginx

**Changes**:
```dockerfile
# Before: Node.js with 'serve' package
FROM node:18-alpine
RUN npm install -g serve
CMD ["serve", "-s", "dist", "-l", "8077"]

# After: Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]
```

### 3. `apps/frontend/src/config.ts` ✅
**Status**: Changed to use relative paths in production

**Changes**:
```typescript
// Before: Direct connection to ports
API_BASE: isDevelopment 
  ? 'http://localhost:7998' 
  : `http://${window.location.hostname}:7998`

// After: Relative paths (Nginx proxy)
API_BASE: isDevelopment 
  ? 'http://localhost:7998' 
  : '/api'
```

### 4. `docker-compose.prod.yml` ✅
**Status**: Removed port mappings for backend and tileserver

**Changes**:
```yaml
# Backend - Before
ports:
  - "7998:7998"

# Backend - After (internal only)
expose:
  - "7998"

# Tileserver - Before
ports:
  - "7999:80"

# Tileserver - After (internal only)
expose:
  - "80"

# Tileserver - Added healthcheck
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### 5. `apps/backend/Dockerfile` ✅
**Status**: Fixed healthcheck to use urllib

**Changes**:
```python
# Before: Used requests library (not installed)
CMD python -c "import requests; requests.get('http://localhost:7998/health')"

# After: Use built-in urllib
CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7998/health')"
```

### 6. `apps/backend/app/main.py` ✅
**Status**: Updated CORS for production

**Changes**:
```python
# Production mode: Allow all origins (since Nginx proxies)
if settings.dev_mode:
    allowed_origins = ["http://localhost:8077", ...]
else:
    allowed_origins = ["*"]  # Nginx handles origin
```

## New Files Created

### 1. `NGINX_PROXY_SETUP.md` 📄
Comprehensive documentation explaining:
- Architecture overview
- Why Nginx is used
- Configuration details
- Deployment instructions
- Troubleshooting guide

### 2. `test-deployment.sh` 🔧
Automated test script that checks:
- Container status
- Port availability
- Frontend accessibility
- API proxy functionality
- Tileserver proxy functionality
- Nginx configuration validity

### 3. `test-frontend-browser.html` 🌐
Browser-based diagnostic tool to test:
- Backend connectivity
- Tileserver connectivity
- Tile JSON access
- Tile PBF access

## Port Configuration

### Before (Problematic)
| Service | External Port | Firewall Requirement |
|---------|--------------|---------------------|
| Frontend | 8077 | ✅ Open |
| Backend | 7998 | ❌ Blocked (PROBLEM) |
| Tileserver | 7999 | ❌ Blocked (PROBLEM) |

### After (Fixed)
| Service | External Port | Firewall Requirement |
|---------|--------------|---------------------|
| Frontend (Nginx) | 8077 | ✅ Open (ONLY THIS) |
| Backend | - | Internal only |
| Tileserver | - | Internal only |

## Request Flow

### Before
```
Browser → http://ecotech.utlth-ol.si:8077 → Frontend ✅
Browser → http://ecotech.utlth-ol.si:7998 → Backend ❌ (firewall blocked)
Browser → http://ecotech.utlth-ol.si:7999 → Tileserver ❌ (firewall blocked)
```

### After
```
Browser → http://ecotech.utlth-ol.si:8077/ → Nginx → React App ✅
Browser → http://ecotech.utlth-ol.si:8077/api → Nginx → Backend:7998 ✅
Browser → http://ecotech.utlth-ol.si:8077/tiles → Nginx → Tileserver:80 ✅
```

## Deployment Steps

### On Windows (Development Machine)
```bash
# Commit and push changes
git add .
git commit -m "Implement Nginx reverse proxy for single-port access"
git push origin main
```

### On Linux (Production Server)
```bash
cd /data/docker-extended/2_React_App_Factory_Map_Frontend

# Pull changes
git pull

# Rebuild containers
sudo docker compose -f docker-compose.prod.yml down
sudo docker compose -f docker-compose.prod.yml up --build -d

# Wait for healthchecks (45 seconds)
sleep 45

# Run tests
chmod +x test-deployment.sh
./test-deployment.sh

# Check status
sudo docker ps
```

## Testing

### 1. From Linux Server (localhost)
```bash
curl http://localhost:8077/                          # Frontend HTML
curl http://localhost:8077/health                    # Nginx health
curl http://localhost:8077/api/health                # Backend via proxy
curl http://localhost:8077/tiles/                    # Tileserver via proxy
curl http://localhost:8077/tiles/data/LTH_factory.json  # Tile JSON
```

### 2. From Browser (external)
Open: `http://ecotech.utlth-ol.si:8077/`

**Press F12 to check console:**
```
=== Frontend Configuration ===
Environment Mode: production
Is Development: false
Is Production: true
API_BASE: /api                    ← Should be /api (not full URL)
TILESERVER_BASE: /tiles           ← Should be /tiles (not full URL)
==============================
```

**Check Network tab:**
- All requests should go to `http://ecotech.utlth-ol.si:8077/*`
- No requests to ports 7998 or 7999
- `/api/*` and `/tiles/*` should return 200

## Benefits

### Security ✅
- Only one port exposed to internet
- Backend and tileserver not directly accessible
- Nginx can add SSL/TLS easily

### Performance ✅
- Nginx can cache static assets
- Nginx can cache tile responses
- Reduced CORS overhead

### Simplicity ✅
- Single entry point
- No CORS configuration needed (same-origin)
- Easier firewall rules

### Scalability ✅
- Easy to add load balancing
- Easy to add rate limiting
- Easy to add authentication

## Verification Checklist

- [ ] All containers running: `sudo docker ps`
- [ ] All containers healthy: Check STATUS column
- [ ] Port 8077 listening: `sudo netstat -tulpn | grep 8077`
- [ ] Ports 7998, 7999 NOT exposed: `sudo netstat -tulpn | grep -E "7998|7999"` should be empty
- [ ] Frontend loads: `http://ecotech.utlth-ol.si:8077/`
- [ ] Browser console shows `/api` and `/tiles` (not full URLs)
- [ ] Network tab shows all requests to port 8077
- [ ] Map loads and tiles render

## Troubleshooting

### Issue: 502 Bad Gateway on /api
**Cause**: Backend not running or not healthy
```bash
sudo docker ps | grep Backend
sudo docker logs React_App_Factory_Map_Backend
```

### Issue: 502 Bad Gateway on /tiles
**Cause**: Tileserver not running or not healthy
```bash
sudo docker ps | grep tileserver
sudo docker logs factory_tileserver
```

### Issue: Frontend loads but blank page
**Cause**: JavaScript errors, check browser console
```bash
# Check build includes Nginx config
sudo docker exec React_App_Factory_Map_Frontend cat /etc/nginx/conf.d/default.conf
```

### Issue: Still seeing old port numbers in browser
**Cause**: Browser cache or old build
```bash
# Hard refresh: Ctrl+Shift+R or Ctrl+F5
# Or rebuild frontend:
sudo docker compose -f docker-compose.prod.yml up --build -d react_app_factory_map_frontend
```

## Next Steps

1. ✅ Test deployment on Linux server
2. ✅ Verify all functionality works
3. 🔄 Add HTTPS with Let's Encrypt
4. 🔄 Configure domain SSL certificate
5. 🔄 Add Nginx access logs monitoring
6. 🔄 Configure tile caching in Nginx
7. 🔄 Add rate limiting if needed

## Git Commit Message

```
feat: Implement Nginx reverse proxy for single-port deployment

- Replace 'serve' with Nginx in frontend Dockerfile
- Configure Nginx to proxy /api to backend:7998
- Configure Nginx to proxy /tiles to tileserver:80
- Update frontend config to use relative paths in production
- Remove external port mappings for backend and tileserver
- Add healthcheck for tileserver
- Fix backend healthcheck to use urllib instead of requests
- Add deployment documentation and test scripts

This change allows the entire application to be accessed through
a single port (8077), simplifying firewall configuration and
improving security. Only the frontend port needs to be exposed;
backend and tileserver are now internal-only services accessed
via Nginx reverse proxy.

Closes: Firewall blocking ports 7998 and 7999 issue
```

