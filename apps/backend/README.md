# Backend (FastAPI + Postgres)

- DEV_MODE toggles DB host: `localhost` vs `postgres_c`.
- Uses SQLAlchemy 2.0, GeoAlchemy2, Alembic.

Run locally (Windows PowerShell):

```
cd backend
python -m venv .layout_proizvodnja_backend_fastapi
.layout_proizvodnja_backend_fastapi\Scripts\activate.bat
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Migrations:

```
cd backend
alembic revision --autogenerate -m "init tables"
alembic upgrade head
```

Create `.env` file in `backend/` directory:

```
DEV_MODE=true
PG_USER=postgres
PG_PASSWORD=martinmi
PG_PORT=5432
PG_DB=layout_proizvodnja_libre_konva
PG_HOST_DEV=localhost
PG_HOST_PROD=postgres_c
```

Structure:

```
backend/
  app/
    main.py
    config.py
    db.py
    models.py
    schemas.py
    crud.py
    routers/
      layers.py
      features.py
  alembic/
  alembic.ini
  requirements.txt
```
