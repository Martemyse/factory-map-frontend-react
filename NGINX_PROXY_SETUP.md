# Nginx Reverse Proxy Setup

## Architecture Overview

This application uses **Nginx as a reverse proxy** to handle all external traffic through a single port (8077). This provides better security and simplifies firewall configuration.

### Port Configuration

| Service | Internal Port | External Port | Access |
|---------|--------------|---------------|---------|
| Frontend (Nginx) | 8077 | 8077 | ✅ Public |
| Backend API | 7998 | - | ❌ Internal only |
| Tileserver | 80 | - | ❌ Internal only |

### Request Flow

```
Browser → http://ecotech.utlth-ol.si:8077/
         ├─ / → Nginx serves static React app
         ├─ /api/* → Nginx proxies to Backend:7998
         └─ /tiles/* → Nginx proxies to Tileserver:80
```

## Why Use Nginx?

### ✅ Advantages
1. **Single Port**: Only port 8077 needs to be open in firewall
2. **Security**: Backend and tileserver are not directly exposed
3. **CORS**: No CORS issues since all requests appear to come from same origin
4. **Caching**: Nginx can cache static assets and tiles
5. **SSL/TLS**: Easy to add HTTPS with Let's Encrypt

### ❌ Without Nginx (previous setup)
- Required ports 8077, 7998, 7999 all open
- CORS configuration needed on backend
- Browser directly connects to multiple services
- More firewall rules needed

## Configuration Files

### 1. Nginx Configuration (`apps/frontend/nginx.conf`)

```nginx
server {
    listen 8077;
    server_name _;
    
    # Serve static React app
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy to backend
    location /api/ {
        proxy_pass http://React_App_Factory_Map_Backend:7998/;
        # ... proxy headers
    }
    
    # Proxy to tileserver
    location /tiles/ {
        proxy_pass http://factory_tileserver:80/;
        # ... proxy headers
    }
}
```

### 2. Frontend Config (`apps/frontend/src/config.ts`)

```typescript
export const config = {
  // Development: Direct connection
  API_BASE: isDevelopment 
    ? 'http://localhost:7998' 
    : '/api',  // ← Relative path in production
  
  TILESERVER_BASE: isDevelopment 
    ? 'http://localhost:7999' 
    : '/tiles',  // ← Relative path in production
}
```

### 3. Docker Compose (`docker-compose.prod.yml`)

```yaml
services:
  # Backend - no external port
  react_app_factory_map_backend:
    expose:
      - "7998"  # Only accessible within Docker network
    
  # Frontend - Nginx with port 8077
  react_app_factory_map_frontend:
    ports:
      - "8077:8077"  # Only port exposed to host
    
  # Tileserver - no external port
  tileserver:
    expose:
      - "80"  # Only accessible within Docker network
```

## Deployment Instructions

### 1. On Linux Server

```bash
cd /data/docker-extended/2_React_App_Factory_Map_Frontend

# Pull latest changes
git pull

# Rebuild containers
sudo docker compose -f docker-compose.prod.yml down
sudo docker compose -f docker-compose.prod.yml up --build -d

# Wait for health checks (45 seconds)
sleep 45

# Check status
sudo docker ps
```

### 2. Verify Deployment

```bash
# Check Nginx is serving frontend
curl http://localhost:8077/

# Check health endpoint
curl http://localhost:8077/health

# Check API proxy
curl http://localhost:8077/api/health

# From browser
open http://ecotech.utlth-ol.si:8077/
```

### 3. Firewall Configuration

Only port 8077 needs to be open:

```bash
# UFW
sudo ufw allow 8077/tcp

# Firewalld
sudo firewall-cmd --permanent --add-port=8077/tcp
sudo firewall-cmd --reload

# Close previously opened ports (if any)
sudo ufw delete allow 7998/tcp
sudo ufw delete allow 7999/tcp
```

## Troubleshooting

### Issue: Frontend loads but map doesn't show

**Check Nginx logs:**
```bash
sudo docker logs React_App_Factory_Map_Frontend
```

**Check if proxying works:**
```bash
# Should return backend health
curl http://localhost:8077/api/health

# Should return tileserver HTML
curl http://localhost:8077/tiles/
```

### Issue: 502 Bad Gateway

**Cause**: Backend or tileserver not running

**Fix**:
```bash
sudo docker ps  # Check all containers are healthy
sudo docker logs React_App_Factory_Map_Backend
sudo docker logs factory_tileserver
```

### Issue: 404 Not Found on /api or /tiles

**Cause**: Nginx configuration not applied

**Fix**:
```bash
# Check nginx config
sudo docker exec React_App_Factory_Map_Frontend cat /etc/nginx/conf.d/default.conf

# Rebuild frontend
sudo docker compose -f docker-compose.prod.yml up --build -d react_app_factory_map_frontend
```

## Browser Console Debugging

When you open `http://ecotech.utlth-ol.si:8077/`, the console should show:

```
=== Frontend Configuration ===
Environment Mode: production
Is Development: false
Is Production: true
API_BASE: /api
TILESERVER_BASE: /tiles
==============================
```

### Expected Network Requests

1. `http://ecotech.utlth-ol.si:8077/` → 200 (HTML)
2. `http://ecotech.utlth-ol.si:8077/assets/index-XXX.js` → 200 (JS)
3. `http://ecotech.utlth-ol.si:8077/assets/index-XXX.css` → 200 (CSS)
4. `http://ecotech.utlth-ol.si:8077/api/features/geojson` → 200 (API)
5. `http://ecotech.utlth-ol.si:8077/tiles/data/LTH_factory/{z}/{x}/{y}.pbf` → 200/204 (Tiles)

**All requests go to port 8077** - Nginx handles the routing internally!

## Development vs Production

### Development (Windows)
- Frontend: `http://localhost:5173` (Vite dev server)
- Backend: `http://localhost:7998` (Direct)
- Tileserver: `http://localhost:7999` (Direct)
- All ports exposed

### Production (Linux)
- Everything: `http://ecotech.utlth-ol.si:8077`
- Only port 8077 exposed
- Nginx routes `/api` and `/tiles`

## Next Steps

1. **Add HTTPS**: Use Let's Encrypt with Certbot
2. **Domain SSL**: Configure for `https://ecotech.utlth-ol.si`
3. **Performance**: Enable Nginx caching for tiles
4. **Monitoring**: Add access logs and metrics

