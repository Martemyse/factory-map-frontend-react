import type { GeoJsonFeature, GeoJsonFeatureCollection, HierarchyDocument, HierarchyNode } from './types';

function ensureClosedRing(points: [number, number][]): [number, number][] {
  if (points.length === 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

export function hierarchyToGeoJson(doc: HierarchyDocument): GeoJsonFeatureCollection {
  const features: GeoJsonFeature[] = [];

  function walk(node: HierarchyNode, parentId: string | null, parentPath: string) {
    const path = parentPath ? `${parentPath}/${node.id}` : node.id;
    const ring = ensureClosedRing(node.polygon);
    const feature: GeoJsonFeature = {
      type: 'Feature',
      id: node.id,
      properties: {
        level: node.level,
        parent_id: parentId,
        path,
        name: node.name,
        opomba: node.opomba,
        color: node.color,
        visible: node.visible,
        order: node.order,
        depth: node.depth,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    };
    features.push(feature);
    if (node.children) node.children.forEach(child => walk(child, node.id, path));
  }

  doc.nodes.forEach(n => walk(n, null, ''));

  return { type: 'FeatureCollection', coordinateSystem: 'local-meters', features };
}

export function geoJsonToHierarchy(fc: GeoJsonFeatureCollection): HierarchyDocument {
  const idToNode = new Map<string, HierarchyNode>();
  const roots: HierarchyNode[] = [];

  for (const f of fc.features) {
    const coords = (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]) as [number, number][];
    const polygon = coords.slice(0, coords.length - 1); // strip closing ring if present
    const node: HierarchyNode = {
      id: f.id,
      level: f.properties.level,
      name: String(f.properties.name ?? f.id),
      opomba: (f.properties as any).opomba,
      color: (f.properties as any).color,
      visible: (f.properties as any).visible,
      order: (f.properties as any).order,
      depth: (f.properties as any).depth,
      polygon,
      children: [],
    };
    idToNode.set(node.id, node);
  }

  for (const f of fc.features) {
    const parentId = (f.properties as any).parent_id as string | null;
    const node = idToNode.get(f.id)!;
    if (parentId && idToNode.has(parentId)) {
      idToNode.get(parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return {
    origin: [0, 0],
    units: 'm',
    nodes: roots,
  };
}


