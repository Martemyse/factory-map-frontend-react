from typing import Optional
from pydantic import BaseModel


class LayerBase(BaseModel):
  name: str
  type: str
  z_index: int = 0
  visible: bool = True
  editable: bool = True


class LayerCreate(LayerBase):
  pass


class LayerRead(LayerBase):
  id: int

  class Config:
    from_attributes = True


class FeatureBase(BaseModel):
  layer_id: Optional[int] = None
  parent_id: Optional[int] = None
  name: str
  opomba: Optional[str] = None
  color: Optional[str] = None
  level: str
  order_index: Optional[int] = None
  depth: Optional[int] = None
  properties: dict = {}
  # geometry provided as GeoJSON-like
  coordinates: list
  # Position relative to factory floor
  x_coord: Optional[float] = None
  y_coord: Optional[float] = None
  # MapLibre GL fields (optional on create)
  shape_gl: Optional[dict] = None
  x_coord_gl: Optional[float] = None
  y_coord_gl: Optional[float] = None


class FeatureCreate(FeatureBase):
  pass


class FeatureRead(BaseModel):
  id: int
  layer_id: int
  parent_id: Optional[int]
  name: str
  opomba: Optional[str]
  color: Optional[str]
  level: str
  order_index: Optional[int]
  depth: Optional[int]
  properties: dict
  coordinates: list
  x_coord: Optional[float]
  y_coord: Optional[float]
  # MapLibre GL fields
  shape_gl: Optional[dict]
  x_coord_gl: Optional[float]
  y_coord_gl: Optional[float]

  class Config:
    from_attributes = True


class FeatureDeleteResponse(BaseModel):
  ok: bool


class FeatureUpdate(BaseModel):
  layer_id: Optional[int] = None
  parent_id: Optional[int] = None
  name: Optional[str] = None
  opomba: Optional[str] = None
  color: Optional[str] = None
  level: Optional[str] = None
  order_index: Optional[int] = None
  depth: Optional[int] = None
  properties: Optional[dict] = None
  coordinates: Optional[list] = None
  x_coord: Optional[float] = None
  y_coord: Optional[float] = None
  # MapLibre GL fields (optional on update)
  shape_gl: Optional[dict] = None
  x_coord_gl: Optional[float] = None
  y_coord_gl: Optional[float] = None
