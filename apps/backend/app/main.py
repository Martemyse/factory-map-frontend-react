from fastapi import FastAPI
from .routers import layers, features

app = FastAPI(title='Factory Map Backend')

app.include_router(layers.router)
app.include_router(features.router)


