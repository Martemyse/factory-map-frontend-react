import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import geojson from '../data/factory_export.geojson?url';

type Level = 'polje' | 'subzone' | 'vrsta' | 'globina';

const ORIGIN: [number, number] = [14.505, 46.056];

export default function Viewer() {
  const divRef = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState<MapboxOverlay | null>(null);
  const [is3D, setIs3D] = useState(false);
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
    setOverlay(ov);
    return () => {
      ov.setProps({ layers: [] });
      map.remove();
    };
  }, []);

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

    const featureVisible = (f: any) => !!visibleLevels[f.properties.level as Level];

    const layer = new GeoJsonLayer({
      id: 'floor-annotations',
      data: geojson,
      coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
      coordinateOrigin: ORIGIN,
      pickable: true,
      stroked: true,
      filled: true,
      lineWidthMinPixels: 1,
      getLineColor: [0, 0, 0],
      getFillColor: (f: any) => hexOrLevel(f.properties),
      visible: true,
      getElevation: (f: any) => (is3D ? getElevation(f.properties.level as Level) : 0),
      extruded: is3D,
      filter: ({ object }: any) => (object ? featureVisible(object) : true),
      getTooltip: ({ object }: any) => (object ? `${object.properties.name}` : null),
    } as any);
    return [layer];
  }, [is3D, visibleLevels]);

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


