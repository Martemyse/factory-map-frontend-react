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
  # Geometry is provided as local coordinates; ensure polygon is closed
  ring = data.coordinates
  # Ensure polygon is closed (first and last point must be the same)
  if len(ring) < 3:
    raise ValueError("Polygon must have at least 3 points")
  if ring[0] != ring[-1]:
    ring = ring + [ring[0]]  # Close the ring
  wkt = 'POLYGON((' + ','.join(f"{x} {y}" for x, y in ring) + '))'
  
  # Use default layer_id if not provided
  layer_id = data.layer_id or 1
  
  # Calculate x,y coordinates from the first point of the polygon
  x_coord = ring[0][0] if ring else None
  y_coord = ring[0][1] if ring else None
  
  obj = models.Feature(
    layer_id=layer_id,
    parent_id=data.parent_id,
    name=data.name,
    opomba=data.opomba,
    color=data.color,
    level=data.level,
    order_index=data.order_index,
    depth=data.depth,
    properties=data.properties,
    geom=wkt,  # GeoAlchemy2 will accept WKT for Geometry column
    x_coord=x_coord,
    y_coord=y_coord,
    cona=data.cona,
    max_capacity=data.max_capacity,
    taken_capacity=data.taken_capacity,
  )
  db.add(obj)
  try:
    await db.commit()
    await db.refresh(obj)
    return obj
  except Exception as e:
    await db.rollback()
    if "unique_name_per_layer" in str(e):
      raise ValueError(f"Feature with name '{data.name}' already exists on layer {layer_id}")
    raise e


async def delete_feature(db: AsyncSession, feature_id: int) -> None:
  obj = await db.get(models.Feature, feature_id)
  if obj is None:
    return
  await db.delete(obj)
  await db.commit()


async def update_feature(db: AsyncSession, feature_id: int, data: schemas.FeatureUpdate) -> models.Feature | None:
  obj = await db.get(models.Feature, feature_id)
  if obj is None:
    return None
  payload = data.model_dump(exclude_unset=True)
  if 'coordinates' in payload:
    ring = payload.pop('coordinates')
    # Ensure polygon is closed (first and last point must be the same)
    if len(ring) < 3:
      raise ValueError("Polygon must have at least 3 points")
    if ring[0] != ring[-1]:
      ring = ring + [ring[0]]  # Close the ring
    wkt = 'POLYGON((' + ','.join(f"{x} {y}" for x, y in ring) + '))'
    obj.geom = wkt
    # Update x,y coordinates from the first point of the polygon
    obj.x_coord = ring[0][0]
    obj.y_coord = ring[0][1]
  # Use default layer_id if not provided
  if 'layer_id' in payload and payload['layer_id'] is None:
    payload['layer_id'] = 1
  for k, v in payload.items():
    setattr(obj, k, v)
  await db.commit()
  await db.refresh(obj)
  return obj


async def bulk_update_features(db: AsyncSession, updates: list[schemas.FeatureBulkUpdateItem]) -> tuple[int, list[int]]:
  """Bulk update feature geometries in a single transaction.
  
  Returns:
    tuple: (updated_count, failed_ids)
  """
  updated_count = 0
  failed_ids = []
  
  for item in updates:
    try:
      obj = await db.get(models.Feature, item.id)
      if obj is None:
        failed_ids.append(item.id)
        continue
      
      ring = item.coordinates
      if len(ring) < 3:
        failed_ids.append(item.id)
        continue
      
      # Ensure polygon is closed
      if ring[0] != ring[-1]:
        ring = ring + [ring[0]]
      
      wkt = 'POLYGON((' + ','.join(f"{x} {y}" for x, y in ring) + '))'
      obj.geom = wkt
      obj.x_coord = item.x_coord
      obj.y_coord = item.y_coord
      
      updated_count += 1
    except Exception as e:
      print(f"Failed to update feature {item.id}: {e}")
      failed_ids.append(item.id)
  
  # Commit all updates in a single transaction
  await db.commit()
  return updated_count, failed_ids