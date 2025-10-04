#!/usr/bin/env python3
"""
Factory Map Backend Server
Automatically detects OS and runs in appropriate mode:
- Windows: Development mode (port 8000)
- Linux: Production mode (port 7998)
"""

import platform
import uvicorn
from app.config import settings

if __name__ == "__main__":
    print(f"Starting Factory Map Backend...")
    print(f"OS: {platform.system()}")
    print(f"Mode: {'Development' if settings.dev_mode else 'Production'}")
    print(f"Database Host: {settings.pg_host}")
    print(f"Backend Port: {settings.backend_port}")
    print(f"Frontend Port: {settings.frontend_port}")
    print(f"Frontend URL: {settings.frontend_url}")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=settings.dev_mode,  # Auto-reload only in development
        log_level="info"
    )
