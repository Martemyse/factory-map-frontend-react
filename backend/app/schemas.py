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
  layer_id: int
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

  class Config:
    from_attributes = True

