import { Stage, Layer, Rect, Text } from 'react-konva';
import { useMemo, useState } from 'react';
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

  function exportGeoJson() {
    const fc = hierarchyToGeoJson(doc);
    // For now, just log it. Later: send to backend or download.
    // eslint-disable-next-line no-console
    console.log('Exported GeoJSON', fc);
    alert('GeoJSON exported to console');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={exportGeoJson}>Export GeoJSON</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Hierarchy</div>
          <HierarchyTree nodes={doc.nodes} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <Stage width={900} height={500} style={{ border: '1px solid #e5e7eb', background: 'white', borderRadius: 8 }}>
          <Layer>
            {all.map((n) => {
              const x = n.polygon[0][0];
              const y = n.polygon[0][1];
              const w = n.polygon[1][0] - n.polygon[0][0];
              const h = n.polygon[2][1] - n.polygon[1][1] || n.polygon[3][1] - n.polygon[0][1];
              const isSel = n.id === selectedId;
              return (
                <>
                  <Rect
                    key={`${n.id}-rect`}
                    x={x}
                    y={y}
                    width={Math.abs(w)}
                    height={Math.abs(h)}
                    fill={n.color || colorByLevel(n.level)}
                    stroke={isSel ? '#2563eb' : '#111827'}
                    strokeWidth={isSel ? 1.5 : 0.5}
                    onClick={() => setSelectedId(n.id)}
                  />
                  <Text key={`${n.id}-label`} x={x + 3} y={y + 3} text={n.name} fontSize={12} fill="#111827" />
                </>
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}


