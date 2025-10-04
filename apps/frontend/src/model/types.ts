export type Level = 'polje' | 'subzone' | 'vrsta' | 'globina';

export type LocalPoint = [number, number];

export interface HierarchyNode {
  id: string;
  level: Level;
  name: string;
  opomba?: string;
  color?: string;
  remoteId?: number;
  parentLocalId?: string;
  visible?: boolean;
  order?: number;
  depth?: number;
  polygon: LocalPoint[]; // closed ring preferred (first == last)
  children?: HierarchyNode[];
  cona?: string;
  max_capacity?: number;
  taken_capacity?: number;
  shape_gl?: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  x_coord_gl?: number;
  y_coord_gl?: number;
}

export interface HierarchyDocument {
  origin: LocalPoint;
  units: 'm' | 'cm' | 'mm' | 'px';
  styleRules?: unknown;
  nodes: HierarchyNode[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  id: string;
  properties: {
    level: Level;
    parent_id: string | null;
    path: string;
    name: string;
    opomba?: string;
    color?: string;
    visible?: boolean;
    order?: number;
    depth?: number;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  coordinateSystem?: 'local-meters';
  features: GeoJsonFeature[];
}


