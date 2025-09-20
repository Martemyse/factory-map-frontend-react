from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import layers, features

app = FastAPI(title='Factory Map Backend')

# CORS for Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(layers.router)
app.include_router(features.router)


