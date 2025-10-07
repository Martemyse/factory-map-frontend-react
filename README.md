# Factory Map Application

Interactive Factory Mapping Application built with React, TypeScript, and MapLibre GL.

## Quick Start

### Development
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

### Production
```bash
# Using Docker
docker-compose -f docker-compose.prod.yml up --build
```

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

## License

MIT