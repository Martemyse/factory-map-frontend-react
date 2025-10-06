from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from ..db import get_db
from .. import crud, schemas
import json


router = APIRouter(prefix='/features', tags=['features'])


@router.get('/', response_model=list[schemas.FeatureRead])
async def get_features(db: AsyncSession = Depends(get_db)):
  # Use optimized PostGIS query that returns GeoJSON directly
  query = text("""
    SELECT 
        id, layer_id, parent_id, name, opomba, color, level, order_index, depth, properties,
        ST_AsGeoJSON(geom)::json as geometry,
        ST_X(ST_Centroid(geom)) as x_coord,
        ST_Y(ST_Centroid(geom)) as y_coord,
        cona, max_capacity, taken_capacity
    FROM features 
    ORDER BY order_index
  """)
  
  result = await db.execute(query)
  rows = result.fetchall()
  
  out: list[schemas.FeatureRead] = []
  for row in rows:
    # Convert GeoJSON to coordinates array for backward compatibility
    coords: list[list[float]] = []
    try:
      if row.geometry and 'coordinates' in row.geometry:
        # Handle Polygon GeoJSON format
        if row.geometry['type'] == 'Polygon' and row.geometry['coordinates']:
          # Take the first ring (exterior ring) of the polygon
          coords = row.geometry['coordinates'][0]
        elif row.geometry['type'] == 'MultiPolygon' and row.geometry['coordinates']:
          # Take the first polygon's first ring
          coords = row.geometry['coordinates'][0][0]
    except Exception as e:
      print(f"Feature {row.id} GeoJSON parsing failed: {e}")
      coords = []
    
    out.append(schemas.FeatureRead(
      id=row.id, 
      layer_id=row.layer_id, 
      parent_id=row.parent_id, 
      name=row.name, 
      opomba=row.opomba,
      color=row.color, 
      level=row.level, 
      order_index=row.order_index, 
      depth=row.depth, 
      properties=row.properties,
      coordinates=coords, 
      x_coord=row.x_coord, 
      y_coord=row.y_coord,
      # Pass the GeoJSON geometry directly for MapLibre GL
      shape_gl=row.geometry,
      x_coord_gl=row.x_coord,  # Use the same coordinates
      y_coord_gl=row.y_coord
    ))
  return out


@router.get('/geojson')
async def get_features_geojson(db: AsyncSession = Depends(get_db)):
  """
  Returns features as a proper GeoJSON FeatureCollection for MapLibre GL.
  This is the most efficient format for mapping libraries.
  """
  query = text("""
    SELECT 
        id, layer_id, parent_id, name, opomba, color, level, order_index, depth, properties,
        ST_AsGeoJSON(geom)::json as geometry,
        cona, max_capacity, taken_capacity
    FROM features 
    ORDER BY order_index
  """)
  
  result = await db.execute(query)
  rows = result.fetchall()
  
  features = []
  for row in rows:
    feature = {
      "type": "Feature",
      "geometry": row.geometry,
      "properties": {
        "id": row.id,
        "layer_id": row.layer_id,
        "parent_id": row.parent_id,
        "name": row.name,
        "opomba": row.opomba,
        "color": row.color,
        "level": row.level,
        "order_index": row.order_index,
        "depth": row.depth,
        "cona": row.cona,
        "max_capacity": row.max_capacity,
        "taken_capacity": row.taken_capacity,
        # Merge additional properties
        **(row.properties or {})
      }
    }
    features.append(feature)
  
  return {
    "type": "FeatureCollection",
    "features": features
  }


@router.post('/', response_model=schemas.FeatureRead)
async def post_feature(payload: schemas.FeatureCreate, db: AsyncSession = Depends(get_db)):
  f = await crud.create_feature(db, payload)
  # For now, return the coordinates from the input payload
  # TODO: Extract coordinates from WKT for proper round-trip
  return schemas.FeatureRead(
    id=f.id, layer_id=f.layer_id, parent_id=f.parent_id, name=f.name, opomba=f.opomba,
    color=f.color, level=f.level, order_index=f.order_index, depth=f.depth, properties=f.properties,
    coordinates=payload.coordinates, x_coord=f.x_coord, y_coord=f.y_coord,
    cona=f.cona, max_capacity=f.max_capacity, taken_capacity=f.taken_capacity,
    shape_gl=None, x_coord_gl=f.x_coord, y_coord_gl=f.y_coord
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
    cona=f.cona, max_capacity=f.max_capacity, taken_capacity=f.taken_capacity,
    shape_gl=None, x_coord_gl=f.x_coord, y_coord_gl=f.y_coord
  )


@router.post('/bulk_update', response_model=schemas.FeatureBulkUpdateResponse)
async def bulk_update_features(payload: schemas.FeatureBulkUpdate, db: AsyncSession = Depends(get_db)):
  """Bulk update feature geometries in a single transaction."""
  updated_count, failed_ids = await crud.bulk_update_features(db, payload.features)
  return schemas.FeatureBulkUpdateResponse(
    updated_count=updated_count,
    failed_ids=failed_ids
  )


