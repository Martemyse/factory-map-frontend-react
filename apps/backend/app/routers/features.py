from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from ..db import get_db
from .. import crud, schemas


router = APIRouter(prefix='/features', tags=['features'])


@router.get('/', response_model=list[schemas.FeatureRead])
async def get_features(db: AsyncSession = Depends(get_db)):
  rows = await crud.list_features(db)
  out: list[schemas.FeatureRead] = []
  for f in rows:
    # Extract coordinates from WKT for client (simple POLYGON case)
    coords: list[list[float]] = []
    try:
      # Use the geometry object directly in the query
      result = await db.execute(text("SELECT ST_AsText(geom) FROM features WHERE id = :id"), {"id": f.id})
      wkt: str = result.scalar_one()  # type: ignore
      print(f"Feature {f.id} WKT: {wkt}")
      if wkt.startswith('POLYGON((') and wkt.endswith('))'):
        inner = wkt[len('POLYGON(('):-2]
        pts = inner.split(',')
        for p in pts:
          xy = p.strip().split(' ')
          if len(xy) >= 2:
            coords.append([float(xy[0]), float(xy[1])])
        print(f"Feature {f.id} extracted coords: {coords}")
      else:
        print(f"Feature {f.id} WKT format not recognized: {wkt}")
    except Exception as e:
      print(f"Feature {f.id} WKT extraction failed: {e}")
      coords = []
    out.append(schemas.FeatureRead(
      id=f.id, layer_id=f.layer_id, parent_id=f.parent_id, name=f.name, opomba=f.opomba,
      color=f.color, level=f.level, order_index=f.order_index, depth=f.depth, properties=f.properties,
      coordinates=coords, x_coord=f.x_coord, y_coord=f.y_coord,
      shape_gl=getattr(f, 'shape_gl', None), x_coord_gl=getattr(f, 'x_coord_gl', None), y_coord_gl=getattr(f, 'y_coord_gl', None)
    ))
  return out


@router.post('/', response_model=schemas.FeatureRead)
async def post_feature(payload: schemas.FeatureCreate, db: AsyncSession = Depends(get_db)):
  f = await crud.create_feature(db, payload)
  # For now, return the coordinates from the input payload
  # TODO: Extract coordinates from WKT for proper round-trip
  return schemas.FeatureRead(
    id=f.id, layer_id=f.layer_id, parent_id=f.parent_id, name=f.name, opomba=f.opomba,
    color=f.color, level=f.level, order_index=f.order_index, depth=f.depth, properties=f.properties,
    coordinates=payload.coordinates, x_coord=f.x_coord, y_coord=f.y_coord,
    shape_gl=getattr(f, 'shape_gl', None), x_coord_gl=getattr(f, 'x_coord_gl', None), y_coord_gl=getattr(f, 'y_coord_gl', None)
  )


@router.delete('/{feature_id}', response_model=schemas.FeatureDeleteResponse)
async def delete_feature(feature_id: int, db: AsyncSession = Depends(get_db)):
  await crud.delete_feature(db, feature_id)
  return schemas.FeatureDeleteResponse(ok=True)


@router.patch('/{feature_id}', response_model=schemas.FeatureRead)
async def patch_feature(feature_id: int, payload: schemas.FeatureUpdate, db: AsyncSession = Depends(get_db)):
  f = await crud.update_feature(db, feature_id, payload)
  if f is None:
    raise HTTPException(status_code=404, detail="Feature not found")
  # For now, return coordinates from payload if provided, otherwise empty
  # TODO: Extract coordinates from WKT for proper round-trip
  coords = payload.coordinates if payload.coordinates else []
  return schemas.FeatureRead(
    id=f.id, layer_id=f.layer_id, parent_id=f.parent_id, name=f.name, opomba=f.opomba,
    color=f.color, level=f.level, order_index=f.order_index, depth=f.depth, properties=f.properties,
    coordinates=coords, x_coord=f.x_coord, y_coord=f.y_coord,
    shape_gl=getattr(f, 'shape_gl', None), x_coord_gl=getattr(f, 'x_coord_gl', None), y_coord_gl=getattr(f, 'y_coord_gl', None)
  )


