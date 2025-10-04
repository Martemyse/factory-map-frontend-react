from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ..db import get_db
from .. import crud, schemas


router = APIRouter(prefix='/layers', tags=['layers'])


@router.get('/', response_model=list[schemas.LayerRead])
async def get_layers(db: AsyncSession = Depends(get_db)):
  return await crud.list_layers(db)


@router.post('/', response_model=schemas.LayerRead)
async def post_layer(payload: schemas.LayerCreate, db: AsyncSession = Depends(get_db)):
  return await crud.create_layer(db, payload)


