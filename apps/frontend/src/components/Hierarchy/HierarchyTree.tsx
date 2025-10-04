import React from 'react';
import type { HierarchyNode } from '../model/types';

interface Props {
  nodes: HierarchyNode[];
  selectedId?: string;
  onSelect: (id?: string) => void;
}

export default function HierarchyTree({ nodes, selectedId, onSelect }: Props) {
  return (
    <div style={{ maxHeight: 300, overflow: 'auto' }}>
      <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
        {nodes.map((n) => (
          <TreeNode key={n.id} node={n} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );
}

function TreeNode({ node, selectedId, onSelect }: { node: HierarchyNode; selectedId?: string; onSelect: (id?: string) => void }) {
  const isSel = node.id === selectedId;
  return (
    <li style={{ margin: '2px 0' }}>
      <button
        onClick={() => onSelect(node.id)}
        style={{
          background: isSel ? '#e5e7eb' : 'transparent',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          padding: '2px 6px',
          cursor: 'pointer',
        }}
      >
        {node.level}: {node.name}
      </button>
      {node.children && node.children.length > 0 && (
        <ul style={{ listStyle: 'none', paddingLeft: 12, margin: 0 }}>
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}


