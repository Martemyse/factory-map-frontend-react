import { Stage, Layer, Rect, Text, Group, Transformer, Line } from 'react-konva';
import { useMemo, useRef, useState, useEffect } from 'react';
import type { HierarchyDocument, HierarchyNode, Level } from '../model/types';
import docJson from '../data/factory_hierarchy.json';
import { hierarchyToGeoJson } from '../model/convert';
import HierarchyTree from './HierarchyTree';

const initialDoc = docJson as unknown as HierarchyDocument;

function flatten(nodes: HierarchyNode[], acc: HierarchyNode[] = []): HierarchyNode[] {
  for (const n of nodes) {
    acc.push(n);
    if (n.children && n.children.length) flatten(n.children, acc);
  }
  return acc;
}

function colorByLevel(level: Level) {
  switch (level) {
    case 'polje':
      return '#CDEAFE';
    case 'subzone':
      return '#FFE2B5';
    case 'vrsta':
      return '#D5F2C3';
    default:
      return '#F5D0FE';
  }
}

export default function Editor() {
  const [doc, setDoc] = useState<HierarchyDocument>(initialDoc);
  const all = useMemo(() => flatten(doc.nodes), [doc]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const stageWidth = 900;
  const stageHeight = 500;
  const [showBackground, setShowBackground] = useState(true);
  const [bgPaths, setBgPaths] = useState<number[][]>([]);
  const [bgBbox, setBgBbox] = useState<[number, number, number, number] | null>(null);
  const [bgScale, setBgScale] = useState<number>(0.001);
  const [bgRaw, setBgRaw] = useState<any | null>(null);
  const stageRef = useRef<any>(null);
  const [viewScale, setViewScale] = useState<number>(1);
  const [viewOffset, setViewOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const userInteractedRef = useRef<boolean>(false);

  // Load factory_clean.json as background (from public/)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/factory_clean.json');
        if (!res.ok) return;
        const gj = await res.json();
        const [paths, bbox] = geojsonToKonvaPaths(gj, bgScale);
        if (!cancelled) {
          setBgRaw(gj);
          setBgPaths(paths);
          setBgBbox(bbox);
          // eslint-disable-next-line no-console
          console.log('Editor background paths:', paths.length, 'bbox:', bbox);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to load factory_clean.json for editor background', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!bgRaw) return;
    const [paths, bbox] = geojsonToKonvaPaths(bgRaw, bgScale);
    setBgPaths(paths);
    setBgBbox(bbox);
  }, [bgRaw, bgScale]);

  // Compute data bbox
  const bbox = useMemo(() => {
    if (!all.length) return null as null | [number, number, number, number];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of all) {
      for (const p of n.polygon) {
        const x = p[0];
        const y = p[1];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (bgBbox) {
      const [bminX, bminY, bmaxX, bmaxY] = bgBbox;
      minX = Math.min(minX, bminX);
      minY = Math.min(minY, bminY);
      maxX = Math.max(maxX, bmaxX);
      maxY = Math.max(maxY, bmaxY);
    }
    return [minX, minY, maxX, maxY] as [number, number, number, number];
  }, [all, bgBbox]);

  // Fit content to stage with padding
  const fit = useMemo(() => {
    if (!bbox) return { scale: 1, offsetX: 0, offsetY: 0 };
    const [minX, minY, maxX, maxY] = bbox;
    const padding = 30;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const scale = Math.min((stageWidth - padding * 2) / width, (stageHeight - padding * 2) / height);
    const offsetX = padding + (-minX) * scale;
    const offsetY = padding + (-minY) * scale;
    // eslint-disable-next-line no-console
    console.log('Editor bbox:', bbox, 'scale:', scale.toFixed(3));
    return { scale, offsetX, offsetY };
  }, [bbox]);

  // Initialize interactive view from fit, until user pans/zooms
  useEffect(() => {
    if (!userInteractedRef.current) {
      setViewScale(fit.scale);
      setViewOffset({ x: fit.offsetX, y: fit.offsetY });
    }
  }, [fit]);

  // Wheel zoom centered on pointer
  function onWheel(e: any) {
    e.evt.preventDefault();
    userInteractedRef.current = true;
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = viewScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.1;
    const direction = e.evt.deltaY > 0 ? -1 : 1; // natural: wheel up zoom in
    const newScale = Math.max(0.0001, Math.min(1000, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy));
    const mousePointTo = {
      x: (pointer.x - viewOffset.x) / oldScale,
      y: (pointer.y - viewOffset.y) / oldScale,
    };
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setViewScale(newScale);
    setViewOffset(newPos);
  }

  // Middle/right mouse panning
  const isPanningRef = useRef<boolean>(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  function onMouseDown(e: any) {
    const btn = e.evt.button;
    if (btn === 1 || btn === 2) {
      isPanningRef.current = true;
      lastPosRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      userInteractedRef.current = true;
    }
  }
  function onMouseUp() {
    isPanningRef.current = false;
    lastPosRef.current = null;
  }
  function onMouseMove(e: any) {
    if (!isPanningRef.current || !lastPosRef.current) return;
    const p = { x: e.evt.clientX, y: e.evt.clientY };
    const dx = p.x - lastPosRef.current.x;
    const dy = p.y - lastPosRef.current.y;
    lastPosRef.current = p;
    setViewOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }

  useEffect(() => {
    if (!userInteractedRef.current) {
      setViewScale(fit.scale);
      setViewOffset({ x: fit.offsetX, y: fit.offsetY });
    }
  }, [fit]);

  // Selection/transformer
  const transformerRef = useRef<any>(null);
  const rectRefs = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!transformerRef.current) return;
    if (selectedId && rectRefs.current[selectedId]) {
      transformerRef.current.nodes([rectRefs.current[selectedId]]);
      transformerRef.current.getLayer()?.batchDraw();
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, doc]);

  function exportGeoJson() {
    const fc = hierarchyToGeoJson(doc);
    // For now, just log it. Later: send to backend or download.
    // eslint-disable-next-line no-console
    console.log('Exported GeoJSON', fc);
    alert('GeoJSON exported to console');
  }

  function updateNodeRect(id: string, x: number, y: number, width: number, height: number) {
    setDoc((prev) => {
      const copy: HierarchyDocument = JSON.parse(JSON.stringify(prev));
      const node = findNodeById(copy.nodes, id);
      if (!node) return prev;
      // Assume rectangle polygon ordered: [p0,p1,p2,p3]
      node.polygon = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ];
      return copy;
    });
  }

  function findNodeById(nodes: HierarchyNode[], id: string): HierarchyNode | undefined {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const f = findNodeById(n.children, id);
        if (f) return f;
      }
    }
    return undefined;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={exportGeoJson}>Export GeoJSON</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showBackground} onChange={e => setShowBackground(e.target.checked)} />
          Show background
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          BG scale
          <input
            type="number"
            step="0.001"
            min="0.0001"
            value={bgScale}
            onChange={e => setBgScale(Math.max(0.0001, Number(e.target.value) || 0.001))}
            style={{ width: 90 }}
          />
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Hierarchy</div>
          <HierarchyTree nodes={doc.nodes} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          style={{ border: '1px solid #e5e7eb', background: 'white', borderRadius: 8 }}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
        >
          <Layer listening={false}>
            {showBackground && (
              <Group x={viewOffset.x} y={viewOffset.y} scaleX={viewScale} scaleY={viewScale}>
                {bgPaths.slice(0, 20000).map((pts, i) => (
                  <Line key={`bg-${i}`} points={pts} stroke="#9ca3af" strokeWidth={Math.max(0.6 / Math.max(viewScale, 1e-6), 0.2)} opacity={0.7} />
                ))}
              </Group>
            )}
          </Layer>
          <Layer>
            <Group x={viewOffset.x} y={viewOffset.y} scaleX={viewScale} scaleY={viewScale}>
            {all.map((n) => {
              const x = n.polygon[0][0];
              const y = n.polygon[0][1];
              const w = n.polygon[1][0] - n.polygon[0][0];
              const h = n.polygon[2][1] - n.polygon[1][1] || n.polygon[3][1] - n.polygon[0][1];
              const isSel = n.id === selectedId;
              return (
                <Group key={n.id}>
                  <Rect
                    ref={(el) => { if (el) rectRefs.current[n.id] = el; }}
                    x={x}
                    y={y}
                    width={Math.abs(w)}
                    height={Math.abs(h)}
                    fill={n.color || colorByLevel(n.level)}
                    stroke={isSel ? '#2563eb' : '#111827'}
                    strokeWidth={(isSel ? 1.5 : 0.5) / Math.max(viewScale, 1e-6)}
                    draggable
                    onClick={() => setSelectedId(n.id)}
                    onDragEnd={(e) => {
                      const node = e.target as any;
                      const nx = node.x();
                      const ny = node.y();
                      updateNodeRect(n.id, nx, ny, Math.abs(w), Math.abs(h));
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target as any;
                      const newW = Math.max(1, node.width() * node.scaleX());
                      const newH = Math.max(1, node.height() * node.scaleY());
                      const nx = node.x();
                      const ny = node.y();
                      node.scaleX(1);
                      node.scaleY(1);
                      updateNodeRect(n.id, nx, ny, newW, newH);
                    }}
                  />
                  <Text x={x + 3} y={y + 3} text={n.name} fontSize={12} fill="#111827" />
                </Group>
              );
            })}
            </Group>
            <Transformer ref={transformerRef} rotateEnabled={false} keepRatio={false} />
            <Text x={6} y={stageHeight - 18} text={`items: ${all.length} viewScale: ${viewScale.toFixed(3)}`} fontSize={12} fill="#6b7280" />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

// Convert GeoJSON (with LineString/MultiLineString/Polygon/MultiPolygon) to Konva Line point arrays
function geojsonToKonvaPaths(gj: any, scale = 1): [number[][], [number, number, number, number] | null] {
  const paths: number[][] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const mark = (x: number, y: number) => {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  };
  const pushLine = (coords: number[][]) => {
    const flat: number[] = [];
    for (const p of coords) {
      const x = (p[0] as number) * scale;
      const y = (p[1] as number) * scale;
      mark(x, y); flat.push(x, y);
    }
    if (flat.length >= 4) paths.push(flat);
  };
  const pushPolygon = (rings: number[][][]) => {
    for (const ring of rings) pushLine(ring);
  };
  const eachGeom = (geom: any) => {
    if (!geom || !geom.type) return;
    switch (geom.type) {
      case 'LineString':
        pushLine(geom.coordinates);
        break;
      case 'MultiLineString':
        for (const line of geom.coordinates) pushLine(line);
        break;
      case 'Polygon':
        pushPolygon(geom.coordinates);
        break;
      case 'MultiPolygon':
        for (const poly of geom.coordinates) pushPolygon(poly);
        break;
      case 'GeometryCollection':
        for (const g of geom.geometries || []) eachGeom(g);
        break;
      default:
        break;
    }
  };
  if (gj?.type === 'FeatureCollection') {
    for (const f of gj.features || []) eachGeom(f.geometry);
  } else if (gj?.type) {
    eachGeom(gj);
  }
  const bbox = isFinite(minX) ? [minX, minY, maxX, maxY] as [number, number, number, number] : null;
  return [paths, bbox];
}


