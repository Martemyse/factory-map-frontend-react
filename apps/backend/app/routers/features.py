from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ..db import get_db
from .. import crud, schemas


router = APIRouter(prefix='/features', tags=['features'])


@router.get('/', response_model=list[schemas.FeatureRead])
async def get_features(db: AsyncSession = Depends(get_db)):
  return await crud.list_features(db)


@router.post('/', response_model=schemas.FeatureRead)
async def post_feature(payload: schemas.FeatureCreate, db: AsyncSession = Depends(get_db)):
  return await crud.create_feature(db, payload)


