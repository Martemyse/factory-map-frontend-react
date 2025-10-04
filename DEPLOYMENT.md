# Factory Map Deployment Guide

This application automatically detects the operating system and configures itself accordingly:

- **Windows**: Development mode (Backend: 8000, Frontend: 5173)
- **Linux**: Production mode (Backend: 7998, Frontend: 8077)

## Quick Start

### Option 1: Universal Python Script (Recommended)
```bash
python start.py
```

### Option 2: OS-Specific Scripts

**Windows:**
```cmd
start_dev.bat
```

**Linux:**
```bash
./start_prod.sh
```

## Prerequisites

### Development (Windows)
- Python 3.11+
- Node.js 18+
- PostgreSQL (running locally on port 5432)

### Production (Linux)
- Python 3.11+
- Node.js 18+
- PostgreSQL (in Docker container `postgres_c`)

## Configuration

The application automatically detects the OS and sets:

| Component | Windows (Dev) | Linux (Prod) |
|-----------|---------------|--------------|
| Backend Port | 8000 | 7998 |
| Frontend Port | 5173 | 8077 |
| Database Host | localhost | postgres_c |
| Auto-reload | Yes | No |
| Sourcemaps | Yes | No |

## Environment Variables

You can override default settings with environment variables:

```bash
# Database configuration
export PG_USER=postgres
export PG_PASSWORD=your_password
export PG_HOST_DEV=localhost
export PG_HOST_PROD=postgres_c
export PG_DB=layout_proizvodnja_libre_konva

# Port configuration
export BACKEND_PORT_DEV=8000
export BACKEND_PORT_PROD=7998
export FRONTEND_PORT_DEV=5173
export FRONTEND_PORT_PROD=8077
```

## Docker Deployment

### Production with Docker Compose
```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Services Included
- **postgres_c**: PostgreSQL database
- **backend**: FastAPI backend (port 7998)
- **frontend**: React frontend (port 8077)
- **tileserver**: Map tiles server (port 8080)

## Manual Setup

### Backend Setup
```bash
cd apps/backend
pip install -r requirements.txt
python run_server.py
```

### Frontend Setup
```bash
cd apps/frontend
npm install
npm run dev
```

## Database Setup

### Development (Windows)
1. Install PostgreSQL locally
2. Create database: `layout_proizvodnja_libre_konva`
3. Run migrations:
   ```bash
   cd apps/backend
   alembic upgrade head
   ```

### Production (Linux)
1. Database is automatically created in Docker container
2. Migrations run automatically on startup

## Troubleshooting

### Port Already in Use
If you get port conflicts, check what's using the ports:
```bash
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :5173

# Linux
sudo netstat -tulpn | grep :7998
sudo netstat -tulpn | grep :8077
```

### Database Connection Issues
- **Windows**: Ensure PostgreSQL is running locally
- **Linux**: Ensure Docker container `postgres_c` is running

### CORS Issues
The application automatically configures CORS based on the detected environment. If you encounter CORS issues, check that the frontend URL matches the configured ports.

## File Structure

```
factory-map-frontend-react/
├── start.py                 # Universal startup script
├── start_dev.bat           # Windows development script
├── start_prod.sh           # Linux production script
├── docker-compose.prod.yml # Production Docker setup
├── apps/
│   ├── backend/
│   │   ├── run_server.py   # Backend startup script
│   │   ├── Dockerfile      # Backend Docker image
│   │   └── app/
│   │       ├── config.py   # OS-based configuration
│   │       └── main.py     # FastAPI application
│   └── frontend/
│       ├── Dockerfile      # Frontend Docker image
│       ├── nginx.conf      # Nginx configuration
│       ├── vite.config.ts  # Vite configuration
│       └── src/
│           └── config.ts   # Frontend configuration
```

## Monitoring

### Health Checks
- Backend: `http://localhost:7998/health` (or 8000 on Windows)
- Frontend: `http://localhost:8077/health` (or 5173 on Windows)

### Logs
- **Development**: Check console output
- **Production**: `docker-compose -f docker-compose.prod.yml logs -f`

## Security Notes

- Production mode disables auto-reload and sourcemaps
- CORS is configured per environment
- Database credentials should be set via environment variables
- Use HTTPS in production deployments
