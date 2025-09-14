from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from . import models, schemas


async def list_layers(db: AsyncSession) -> List[models.Layer]:
  res = await db.execute(select(models.Layer).order_by(models.Layer.z_index))
  return list(res.scalars().all())


async def create_layer(db: AsyncSession, data: schemas.LayerCreate) -> models.Layer:
  obj = models.Layer(**data.model_dump())
  db.add(obj)
  await db.commit()
  await db.refresh(obj)
  return obj


async def list_features(db: AsyncSession) -> List[models.Feature]:
  res = await db.execute(select(models.Feature))
  return list(res.scalars().all())


async def create_feature(db: AsyncSession, data: schemas.FeatureCreate) -> models.Feature:
  # Geometry is provided as local coordinates; for now store as POLYGON in Web Mercator meter space placeholder
  # Expect coordinates as [[x,y], ...] closed ring
  ring = data.coordinates
  wkt = 'POLYGON((' + ','.join(f"{x} {y}" for x, y in ring) + '))'
  obj = models.Feature(
    layer_id=data.layer_id,
    parent_id=data.parent_id,
    name=data.name,
    opomba=data.opomba,
    color=data.color,
    level=data.level,
    order_index=data.order_index,
    depth=data.depth,
    properties=data.properties,
    geom=wkt,  # GeoAlchemy2 will accept WKT for Geometry column
  )
  db.add(obj)
  await db.commit()
  await db.refresh(obj)
  return obj

