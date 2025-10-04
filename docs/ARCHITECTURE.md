# Architecture

## Overview

This monorepo contains three main parts:

- `apps/frontend`: React + TypeScript (Vite) map viewer with MapLibre GL
- `apps/backend`: FastAPI app providing features/layers APIs
- `infra/tiling`: Tippecanoe build and tileserver-gl for serving MVT tiles

Shared assets live in `data/`.

## Frontend

- Coordinates: local factory meters using deck.gl `COORDINATE_SYSTEM.METER_OFFSETS`
- Layers: GeoJsonLayer/TileLayer for 2D/3D toggles, tooltips
- Data: loads GeoJSON from `src/data` during dev, optionally from backend later

## Backend

- FastAPI app at `app/main.py`
- Alembic migrations under `alembic/`
- Routers in `app/routers/`

## Tiling

- `Dockerfile` builds Tippecanoe and installs tileserver-gl
- `docker-compose.yaml` mounts `../../data` inside containers as `/data`
- To generate tiles: run tippecanoe inside the image or locally

## Development

- Root `package.json` defines npm workspaces for the frontend
- Run `npm install` at root to hoist dependencies
- Start frontend: `npm run dev`
- Start backend: `uvicorn app.main:app --reload`

## Future

- Add root-level compose for backend + frontend + tiles
- Add CI for typecheck/lint
- Split shared TypeScript types into `packages/` if needed


