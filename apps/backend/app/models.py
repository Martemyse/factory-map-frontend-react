from typing import List, Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Boolean, ForeignKey, JSON, Float
from geoalchemy2 import Geometry
from .db import Base


class Layer(Base):
  __tablename__ = 'layers'

  id: Mapped[int] = mapped_column(primary_key=True)
  name: Mapped[str] = mapped_column(String, unique=True)
  type: Mapped[str] = mapped_column(String)  # polje, subzone, etc.
  z_index: Mapped[int] = mapped_column(Integer, default=0)
  visible: Mapped[bool] = mapped_column(Boolean, default=True)
  editable: Mapped[bool] = mapped_column(Boolean, default=True)

  features: Mapped[List['Feature']] = relationship(back_populates='layer', cascade='all, delete-orphan')


class Feature(Base):
  __tablename__ = 'features'

  id: Mapped[int] = mapped_column(primary_key=True)
  layer_id: Mapped[int] = mapped_column(ForeignKey('layers.id', ondelete='CASCADE'))
  parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey('features.id', ondelete='CASCADE'), nullable=True)

  name: Mapped[str] = mapped_column(String)
  opomba: Mapped[Optional[str]] = mapped_column(String, nullable=True)
  color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
  level: Mapped[str] = mapped_column(String)  # polje / subzone / vrsta / globina
  order_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
  depth: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
  properties: Mapped[dict] = mapped_column(JSON, default=dict)

  geom = mapped_column(Geometry(geometry_type='POLYGON', srid=3857))  # Use proper SRID
  x_coord: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
  y_coord: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
  cona: Mapped[Optional[str]] = mapped_column(String, nullable=True)
  max_capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
  taken_capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

  layer: Mapped['Layer'] = relationship(back_populates='features')
  parent: Mapped[Optional['Feature']] = relationship(remote_side=[id])