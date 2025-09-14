import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';

type Level = 'polje' | 'subzone' | 'vrsta' | 'globina';

const ORIGIN: [number, number] = [0, 0];
// If your DXF is in millimeters, set UNIT_SCALE to 0.001 to convert to meters.
// If it's already meters, leave as 1.
const UNIT_SCALE = 1;

export default function Viewer() {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [overlay, setOverlay] = useState<MapboxOverlay | null>(null);
  const [is3D, setIs3D] = useState(false);
  const [geojsonUrl] = useState<string>('/factory_clean.json');
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [dataBbox, setDataBbox] = useState<[number, number, number, number] | null>(null);
  const [visibleLevels, setVisibleLevels] = useState<Record<Level, boolean>>({
    polje: true,
    subzone: true,
    vrsta: true,
    globina: true,
  });

  useEffect(() => {
    if (!divRef.current) return;
    const map = new maplibregl.Map({
      container: divRef.current,
      style: { version: 8, sources: {}, layers: [] },
      center: ORIGIN,
      zoom: 19,
      pitch: 0,
      bearing: 0,
    });
    const ov = new MapboxOverlay({ interleaved: true });
    map.addControl(ov);
    mapRef.current = map;
    setOverlay(ov);
    return () => {
      ov.setProps({ layers: [] });
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(geojsonUrl);
        const raw = await res.json();
        const normalized = transformGeometryCollections(raw);
        const [translated, bbox] = normalizeToOffsets(normalized, UNIT_SCALE);
        // eslint-disable-next-line no-console
        console.log('Loaded GeoJSON features:', Array.isArray(translated?.features) ? translated.features.length : 0, 'bbox(meters):', bbox);
        if (!cancelled) {
          setGeojsonData(translated);
          setDataBbox(bbox);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load GeoJSON', e);
      }
    })();
    return () => { cancelled = true; };
  }, [geojsonUrl]);

  useEffect(() => {
    if (!mapRef.current || !dataBbox) return;
    const [minX, minY, maxX, maxY] = dataBbox;
    const sw = addMetersToLngLat(ORIGIN, minX, minY);
    const ne = addMetersToLngLat(ORIGIN, maxX, maxY);
    try {
      mapRef.current.fitBounds([sw as any, ne as any], { padding: 40, maxZoom: 21, duration: 0 });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('fitBounds failed', e);
    }
  }, [dataBbox]);

  const layers = useMemo(() => {
    const getElevation = (level: Level) => {
      switch (level) {
        case 'polje':
          return 0.1;
        case 'subzone':
          return 0.2;
        case 'vrsta':
          return 0.3;
        case 'globina':
          return 0.35;
      }
    };

    const featureVisible = (f: any) => {
      const lvl = f?.properties?.level as Level | undefined;
      if (!lvl) return true; // Show features without hierarchy level (DXF-derived lines)
      return !!visibleLevels[lvl];
    };

    const layer = new GeoJsonLayer({
      id: 'floor-annotations',
      data: geojsonData || { type: 'FeatureCollection', features: [] },
      coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
      coordinateOrigin: ORIGIN,
      pickable: true,
      stroked: true,
      filled: true,
      lineWidthMinPixels: 1,
      lineWidthUnits: 'pixels',
      getLineWidth: 2,
      getLineColor: [0, 0, 0],
      getFillColor: (f: any) => (featureVisible(f) ? hexOrLevel(f.properties) : [0, 0, 0, 0]),
      visible: true,
      getElevation: (f: any) => (is3D ? getElevation(f.properties.level as Level) : 0),
      extruded: is3D,
      getTooltip: ({ object }: any) => (object ? `${object.properties?.name ?? ''}` : null),
      updateTriggers: {
        getElevation: [is3D],
        getFillColor: [visibleLevels.polje, visibleLevels.subzone, visibleLevels.vrsta, visibleLevels.globina],
      },
    } as any);
    return [layer];
  }, [is3D, visibleLevels, geojsonData]);

  useEffect(() => {
    if (!overlay) return;
    overlay.setProps({ layers });
  }, [overlay, layers]);

  return (
    <div style={{ height: '60vh', border: '1px solid #e5e7eb', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setIs3D(x => !x)}>{is3D ? 'Switch to 2D' : 'Switch to 3D'}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 6 }}>
          {(['polje', 'subzone', 'vrsta', 'globina'] as Level[]).map(l => (
            <label key={l} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={visibleLevels[l]}
                onChange={(e) => setVisibleLevels(v => ({ ...v, [l]: e.target.checked }))}
              />
              <span style={{ textTransform: 'capitalize' }}>{l}</span>
            </label>
          ))}
        </div>
      </div>
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
function transformGeometryCollections(input: any): any {
  if (!input) return input;
  // If FeatureCollection, expand any GeometryCollection features into individual features
  if (input.type === 'FeatureCollection' && Array.isArray(input.features)) {
    const out: any[] = [];
    for (const f of input.features) {
      if (!f || !f.geometry) continue;
      const g = f.geometry;
      // Skip invalid geometries
      if (!g.type) continue;
      if (g.type === 'GeometryCollection') {
        if (Array.isArray((g as any).geometries)) {
          for (const sub of (g as any).geometries) {
            if (!sub || !sub.type) continue;
            out.push({ type: 'Feature', properties: f.properties ?? {}, geometry: sub });
          }
        }
        // If no geometries array, skip this feature
        continue;
      }
      // For simple geometries, ensure coordinates exist
      if (!('coordinates' in g)) continue;
      out.push(f);
    }
    return { ...input, features: out };
  }
  // If raw GeometryCollection, wrap into FeatureCollection
  if (input.type === 'GeometryCollection' && Array.isArray(input.geometries)) {
    return {
      type: 'FeatureCollection',
      features: input.geometries.map((g: any) => ({ type: 'Feature', properties: {}, geometry: g })),
    };
  }
  return input;
}

function normalizeToOffsets(fc: any, unitScale: number): [any, [number, number, number, number] | null] {
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) return [fc, null];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const scale = Number.isFinite(unitScale) && unitScale > 0 ? unitScale : 1;
  const scaleCoord = (p: number[]) => [p[0] * scale, p[1] * scale, ...(p.length > 2 ? [p[2]] : [])];

  const walk = (geom: any): any => {
    const t = geom?.type;
    if (!t) return geom;
    const mark = (x: number, y: number) => {
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    };
    if (t === 'Point') {
      const c = scaleCoord(geom.coordinates);
      mark(c[0], c[1]);
      return { ...geom, coordinates: c };
    }
    if (t === 'MultiPoint' || t === 'LineString') {
      const c = geom.coordinates.map((p: number[]) => {
        const q = scaleCoord(p); mark(q[0], q[1]); return q;
      });
      return { ...geom, coordinates: c };
    }
    if (t === 'MultiLineString' || t === 'Polygon') {
      const c = geom.coordinates.map((ring: number[][]) => ring.map((p: number[]) => {
        const q = scaleCoord(p); mark(q[0], q[1]); return q;
      }));
      return { ...geom, coordinates: c };
    }
    if (t === 'MultiPolygon') {
      const c = geom.coordinates.map((poly: number[][][]) => poly.map((ring: number[][]) => ring.map((p: number[]) => {
        const q = scaleCoord(p); mark(q[0], q[1]); return q;
      })));
      return { ...geom, coordinates: c };
    }
    return geom;
  };

  const out = {
    ...fc,
    features: fc.features.map((f: any) => ({ ...f, geometry: walk(f.geometry) }))
  };
  return [out, isFinite(minX) ? [minX, minY, maxX, maxY] as [number, number, number, number] : null];
}

function addMetersToLngLat(origin: [number, number], dx: number, dy: number): [number, number] {
  const latRad = (origin[1] * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(latRad);
  const dLat = dy / metersPerDegLat;
  const dLon = dx / metersPerDegLon;
  return [origin[0] + dLon, origin[1] + dLat];
}


function hexOrLevel(p: any) {
  if (p.color) return hexToRgbaArray(p.color);
  switch (p.level) {
    case 'polje':
      return [205, 234, 254, 255];
    case 'subzone':
      return [255, 226, 181, 255];
    case 'vrsta':
      return [213, 242, 195, 255];
    default:
      return [245, 208, 254, 255];
  }
}

function hexToRgbaArray(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b, 255];
}


