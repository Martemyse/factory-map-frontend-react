# Production Deployment Guide

## Quick Start

### On Linux Production Server

```bash
cd /data/docker-extended/2_React_App_Factory_Map_Frontend

# Make scripts executable (first time only)
chmod +x deploy-production.sh
chmod +x test-deployment.sh

# Deploy
./deploy-production.sh

# Test (optional)
./test-deployment.sh
```

### Expected Result

✅ Application accessible at: **http://ecotech.utlth-ol.si:8087**

## Architecture

### Single Port Access
```
                    ┌─────────────────────────────────┐
                    │  Firewall: Only Port 8087 Open │
                    └─────────────────┬───────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │   Nginx (Frontend Container)    │
                    │         Port 8087               │
                    └─────────────────┬───────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
        ┌───────────────────┐             ┌─────────────────────┐
        │  Static React App │             │   Reverse Proxy     │
        │   (/, /index.html)│             │   (/api, /tiles)    │
        └───────────────────┘             └──────────┬──────────┘
                                                     │
                                    ┌────────────────┴────────────────┐
                                    │                                 │
                                    ▼                                 ▼
                        ┌─────────────────────┐         ┌──────────────────────┐
                        │  Backend FastAPI    │         │  Tileserver GL       │
                        │  Port 7998          │         │  Port 80             │
                        │  (Internal Only)    │         │  (Internal Only)     │
                        └─────────────────────┘         └──────────────────────┘
```

### Request Routing

| URL Pattern | Nginx Action | Backend Service |
|-------------|-------------|-----------------|
| `http://ecotech.utlth-ol.si:8087/` | Serve static files | React App |
| `http://ecotech.utlth-ol.si:8087/api/*` | Proxy to `http://React_App_Factory_Map_Backend:7998/` | FastAPI Backend |
| `http://ecotech.utlth-ol.si:8087/tiles/*` | Proxy to `http://factory_tileserver:80/` | TileServer GL |

## Files Overview

### Core Configuration
- `docker-compose.prod.yml` - Production container orchestration
- `apps/frontend/nginx.conf` - Nginx reverse proxy configuration
- `apps/frontend/Dockerfile` - Frontend build with Nginx
- `apps/frontend/src/config.ts` - Frontend environment configuration

### Deployment Scripts
- `deploy-production.sh` - Automated deployment script
- `test-deployment.sh` - Automated testing script
- `test-frontend-browser.html` - Browser-based diagnostic tool

### Documentation
- `NGINX_PROXY_SETUP.md` - Detailed Nginx configuration guide
- `CHANGES_SUMMARY.md` - Complete changelog
- `PRODUCTION_DEPLOYMENT.md` - This file

## Deployment Steps (Manual)

If you prefer to run commands manually instead of using the script:

### 1. Pull Latest Code
```bash
cd /data/docker-extended/2_React_App_Factory_Map_Frontend
git pull
```

### 2. Stop Existing Containers
```bash
sudo docker compose -f docker-compose.prod.yml down
```

### 3. Build and Start
```bash
sudo docker compose -f docker-compose.prod.yml up --build -d
```

### 4. Wait for Health Checks
```bash
sleep 45
```

### 5. Verify Deployment
```bash
sudo docker ps
curl http://localhost:8087/
curl http://localhost:8087/api/health
curl http://localhost:8087/tiles/
```

## Port Configuration

### ✅ Exposed Ports (External)
- **8087** - Frontend (Nginx) - HTTP

### 🔒 Internal Ports (Docker Network Only)
- **7998** - Backend (FastAPI)
- **80** - Tileserver (TileServer GL)

### Firewall Rules

**Open port 8087 ONLY:**
```bash
# UFW
sudo ufw allow 8087/tcp
sudo ufw status

# Firewalld
sudo firewall-cmd --permanent --add-port=8087/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

**Close previously opened ports (if any):**
```bash
# UFW
sudo ufw delete allow 7998/tcp
sudo ufw delete allow 7999/tcp

# Firewalld
sudo firewall-cmd --permanent --remove-port=7998/tcp
sudo firewall-cmd --permanent --remove-port=7999/tcp
sudo firewall-cmd --reload
```

## Verification

### 1. Container Status
```bash
sudo docker ps
```

Expected output:
```
CONTAINER ID   IMAGE                      STATUS                    PORTS                    NAMES
xxxxxxxxxx     ...frontend                Up X minutes (healthy)    0.0.0.0:8087->8087/tcp   React_App_Factory_Map_Frontend
xxxxxxxxxx     ...backend                 Up X minutes (healthy)                             React_App_Factory_Map_Backend
xxxxxxxxxx     maptiler/tileserver-gl     Up X minutes (healthy)                             factory_tileserver
```

### 2. Health Checks
```bash
# Frontend
curl http://localhost:8087/health
# Expected: "healthy"

# API via proxy
curl http://localhost:8087/api/health
# Expected: {"status":"healthy","mode":"production",...}

# Tiles via proxy
curl -I http://localhost:8087/tiles/
# Expected: HTTP/1.1 200 OK
```

### 3. Browser Test

**Open:** `http://ecotech.utlth-ol.si:8087/`

**Press F12 (Developer Tools) → Console Tab**

Expected console output:
```
=== Frontend Configuration ===
Environment Mode: production
Is Development: false
Is Production: true
API_BASE: /api
TILESERVER_BASE: /tiles
==============================
```

**Check Network Tab:**
- All requests should go to `http://ecotech.utlth-ol.si:8087/*`
- No requests should go to ports 7998 or 7999
- `/api/features/geojson` → 200 OK
- `/tiles/data/LTH_factory/{z}/{x}/{y}.pbf` → 200/204

## Troubleshooting

### Issue: Container Unhealthy

**Check logs:**
```bash
sudo docker logs React_App_Factory_Map_Frontend
sudo docker logs React_App_Factory_Map_Backend
sudo docker logs factory_tileserver
```

**Restart specific container:**
```bash
sudo docker compose -f docker-compose.prod.yml restart <container_name>
```

### Issue: 502 Bad Gateway

**Cause:** Backend or tileserver not responding

**Fix:**
```bash
# Check container is running
sudo docker ps | grep -E "Backend|tileserver"

# Check logs
sudo docker logs React_App_Factory_Map_Backend --tail 50
sudo docker logs factory_tileserver --tail 50

# Restart if needed
sudo docker compose -f docker-compose.prod.yml restart react_app_factory_map_backend
sudo docker compose -f docker-compose.prod.yml restart tileserver
```

### Issue: 404 on /api or /tiles

**Cause:** Nginx configuration not loaded

**Fix:**
```bash
# Check Nginx config
sudo docker exec React_App_Factory_Map_Frontend cat /etc/nginx/conf.d/default.conf

# Test Nginx config
sudo docker exec React_App_Factory_Map_Frontend nginx -t

# Rebuild frontend
sudo docker compose -f docker-compose.prod.yml up --build -d react_app_factory_map_frontend
```

### Issue: Frontend Loads but Map Doesn't Show

**Cause:** Tiles not loading or API requests failing

**Check browser console (F12):**
- Look for red error messages
- Check Network tab for failed requests
- Verify API_BASE is `/api` (not full URL)
- Verify TILESERVER_BASE is `/tiles` (not full URL)

**Check if proxying works:**
```bash
# Test API proxy
curl http://localhost:8087/api/health

# Test tiles proxy
curl http://localhost:8087/tiles/data/LTH_factory.json
```

### Issue: Old Version Still Showing

**Cause:** Browser cache or containers not rebuilt

**Fix:**
```bash
# Hard refresh browser: Ctrl+Shift+R or Ctrl+F5

# Force rebuild containers
sudo docker compose -f docker-compose.prod.yml down
sudo docker compose -f docker-compose.prod.yml build --no-cache
sudo docker compose -f docker-compose.prod.yml up -d
```

## Monitoring

### View Logs

```bash
# All frontend logs
sudo docker logs React_App_Factory_Map_Frontend

# Follow frontend logs (live)
sudo docker logs -f React_App_Factory_Map_Frontend

# Last 50 lines
sudo docker logs React_App_Factory_Map_Frontend --tail 50

# Backend logs
sudo docker logs React_App_Factory_Map_Backend --tail 50

# Tileserver logs
sudo docker logs factory_tileserver --tail 50
```

### Container Stats

```bash
# Resource usage
sudo docker stats

# Specific container
sudo docker stats React_App_Factory_Map_Frontend
```

### Network Inspection

```bash
# Inspect Docker network
sudo docker network inspect 2_react_app_factory_map_frontend_postgres_network

# Check which ports are listening
sudo netstat -tulpn | grep -E "8087|7998|7999"
# Should only see 8087!

# Check connections
sudo ss -tulpn | grep 8087
```

## Backup & Rollback

### Create Backup

```bash
# Backup current state
sudo docker compose -f docker-compose.prod.yml down
sudo tar -czf backup-$(date +%Y%m%d).tar.gz ./

# Or just backup images
sudo docker save -o frontend-backup.tar 2_react_app_factory_map_frontend-react_app_factory_map_frontend
sudo docker save -o backend-backup.tar 2_react_app_factory_map_frontend-react_app_factory_map_backend
```

### Rollback to Previous Version

```bash
# Go back to previous commit
git log --oneline -10
git checkout <previous-commit-hash>

# Rebuild
sudo docker compose -f docker-compose.prod.yml down
sudo docker compose -f docker-compose.prod.yml up --build -d
```

## Performance Optimization

### Enable Nginx Caching

Add to `apps/frontend/nginx.conf`:

```nginx
# Tile caching
proxy_cache_path /var/cache/nginx/tiles levels=1:2 keys_zone=tiles_cache:10m max_size=1g inactive=60m;

location /tiles/ {
    proxy_cache tiles_cache;
    proxy_cache_valid 200 60m;
    proxy_cache_valid 404 10m;
    # ... rest of config
}
```

### Monitor Performance

```bash
# Nginx access logs
sudo docker exec React_App_Factory_Map_Frontend tail -f /var/log/nginx/access.log

# Response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8087/api/health
```

## Security Best Practices

### 1. Enable HTTPS

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d ecotech.utlth-ol.si
```

### 2. Restrict Backend CORS (if needed)

In `apps/backend/app/main.py`:
```python
allowed_origins = ["http://ecotech.utlth-ol.si:8087"]  # Instead of ["*"]
```

### 3. Add Rate Limiting

In `apps/frontend/nginx.conf`:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ... rest of config
}
```

## Maintenance

### Update Docker Images

```bash
# Pull latest base images
sudo docker pull nginx:alpine
sudo docker pull python:3.13-slim
sudo docker pull node:18-alpine
sudo docker pull maptiler/tileserver-gl

# Rebuild
sudo docker compose -f docker-compose.prod.yml up --build -d
```

### Clean Up

```bash
# Remove unused images
sudo docker image prune -a

# Remove unused volumes
sudo docker volume prune

# Remove everything unused
sudo docker system prune -a
```

## Support

### Diagnostic Tools

1. **Automated test script:**
   ```bash
   ./test-deployment.sh
   ```

2. **Browser diagnostic tool:**
   - Open `test-frontend-browser.html?hostname=ecotech.utlth-ol.si`
   - Click test buttons to verify connectivity

3. **Docker health checks:**
   ```bash
   sudo docker inspect React_App_Factory_Map_Frontend --format='{{.State.Health.Status}}'
   sudo docker inspect React_App_Factory_Map_Backend --format='{{.State.Health.Status}}'
   sudo docker inspect factory_tileserver --format='{{.State.Health.Status}}'
   ```

### Useful Commands Cheat Sheet

```bash
# Quick status
sudo docker ps
sudo docker compose -f docker-compose.prod.yml ps

# Restart all
sudo docker compose -f docker-compose.prod.yml restart

# Rebuild specific service
sudo docker compose -f docker-compose.prod.yml up --build -d <service_name>

# View config
sudo docker exec React_App_Factory_Map_Frontend cat /etc/nginx/conf.d/default.conf

# Test Nginx config
sudo docker exec React_App_Factory_Map_Frontend nginx -t

# Shell access
sudo docker exec -it React_App_Factory_Map_Frontend sh
sudo docker exec -it React_App_Factory_Map_Backend bash

# Network test from container
sudo docker exec React_App_Factory_Map_Frontend wget -O- http://React_App_Factory_Map_Backend:7998/health
```

## Success Criteria

✅ Deployment is successful when:

1. All three containers show `(healthy)` status
2. Port 8087 is listening, ports 7998 and 7999 are NOT exposed
3. `http://ecotech.utlth-ol.si:8087/` loads the application
4. Browser console shows `/api` and `/tiles` (relative paths)
5. Map loads and renders tiles correctly
6. No CORS errors in browser console
7. All network requests go to port 8087 only

---

**Last Updated:** October 2025  
**Contact:** For issues, check logs and run diagnostic tests first.

