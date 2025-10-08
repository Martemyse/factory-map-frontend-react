# Factory Map Application

Interactive Factory Mapping Application built with React, TypeScript, and MapLibre GL.

## Quick Start

### Development (Windows)
```bash
# Start both backend and frontend
start_dev.bat

# Or start manually:
# Backend (Port 7998)
cd apps\backend
python run_server.py

# Frontend (Port 8077) 
cd apps\frontend
npm install
npm run dev
```

### Production (Linux)
```bash
# Quick deployment
./deploy-production.sh

# Or manually:
docker-compose -f docker-compose.prod.yml up --build -d

# Access at: http://ecotech.utlth-ol.si:8077
```

📚 **[See Full Production Deployment Guide →](PRODUCTION_DEPLOYMENT.md)**

## Project Structure

```
├── apps/
│   ├── backend/          # FastAPI backend with PostGIS
│   │   ├── app/          # Main application code
│   │   ├── scripts/      # Database migration scripts
│   │   └── requirements.txt
│   └── frontend/         # React + TypeScript frontend
│       ├── src/          # Source code
│       └── package.json  # Dependencies
├── infra/                # Tile server infrastructure
└── docker-compose.*.yml  # Docker configurations
```

## Features

- **Interactive Factory Mapping** with MapLibre GL
- **PostGIS Integration** for spatial data
- **Hierarchical Data Structure** (polje → subzone → vrsta)
- **Real-time Updates** with WebSocket support
- **Docker Support** for easy deployment
- **Nginx Reverse Proxy** for secure single-port access
- **Production-Ready** with health checks and monitoring

## Dependencies

### Backend
- FastAPI
- SQLAlchemy
- PostGIS
- GeoAlchemy2

### Frontend
- React 19
- TypeScript
- MapLibre GL
- Deck.GL
- Vite

## Database

Uses PostgreSQL with PostGIS extension for spatial data storage and queries.

## Documentation

- 📖 [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md) - Complete production deployment instructions
- 🔧 [Nginx Proxy Setup](NGINX_PROXY_SETUP.md) - Reverse proxy architecture and configuration
- 📝 [Changes Summary](CHANGES_SUMMARY.md) - Detailed changelog of recent updates
- 🚀 [Deployment Script](DEPLOYMENT.md) - Original deployment documentation

## Architecture

### Production Setup
All services are accessible through a single port (8077) using Nginx as a reverse proxy:

```
Browser (Port 8077)
    ├── / → Static React App
    ├── /api/* → Backend (FastAPI on port 7998)
    └── /tiles/* → Tileserver (TileServer GL on port 80)
```

**Benefits:**
- ✅ Only one port needs to be open in firewall
- ✅ No CORS issues (same-origin requests)
- ✅ Better security (backend/tileserver not exposed)
- ✅ Easy to add SSL/TLS

## License

MIT