from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import layers, features
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

# CORS configuration - explicitly allow frontend origins (avoid '*' with credentials)
allowed_origins = [
    f"http://localhost:{settings.frontend_port}",
    f"http://127.0.0.1:{settings.frontend_port}",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(layers.router)
app.include_router(features.router)


