from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import layers, features
from .api import advanced_search
from .config import settings

app = FastAPI(title='Factory Map Backend')

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "mode": "development" if settings.dev_mode else "production",
        "backend_port": settings.backend_port,
        "frontend_port": settings.frontend_port,
        "database_host": settings.pg_host
    }

# CORS configuration
# In development: allow specific localhost origins
# In production: allow all origins since requests come through nginx proxy
if settings.dev_mode:
    allowed_origins = [
        f"http://localhost:{settings.frontend_port}",
        f"http://127.0.0.1:{settings.frontend_port}",
        "http://localhost:8077",
        "http://127.0.0.1:8077",
    ]
    allow_credentials = True
else:
    # Production: allow all origins since nginx handles the proxying
    allowed_origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(layers.router)
app.include_router(features.router)
app.include_router(advanced_search.router, prefix="/api", tags=["advanced-search"])


