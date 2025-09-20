import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { HierarchyDocument, HierarchyNode, Level } from '../model/types';

type SunNode = {
  id: string;
  name: string;
  level: Level;
  color?: string;
  parentLocalId?: string;
  children?: SunNode[];
};

function toSun(doc: HierarchyDocument): SunNode {
  return {
    id: 'root',
    name: 'root',
    level: 'polje',
    children: doc.nodes.map(mapNode)
  } as any;
}

function mapNode(n: HierarchyNode): SunNode {
  return {
    id: n.id,
    name: n.name,
    level: n.level,
    color: n.color,
    parentLocalId: n.parentLocalId,
    children: n.children?.map(mapNode)
  } as any;
}

// Color inheritance system - same as in Editor
function getPoljeBaseColor(poljeId: string): string {
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Green  
    '#F59E0B', // Orange
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange-red
    '#EC4899', // Pink
    '#6366F1', // Indigo
  ];
  
  let hash = 0;
  for (let i = 0; i < poljeId.length; i++) {
    const char = poljeId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInheritedColor(node: SunNode, allNodes: SunNode[]): string {
  // Find the root polje for this node - same logic as Editor
  let current = node;
  while (current.parentLocalId) {
    const parent = allNodes.find(n => n.id === current.parentLocalId);
    if (!parent) break;
    current = parent;
  }
  
  // If this is already a polje, return its base color
  if (current.level === 'polje') {
    return current.color || getPoljeBaseColor(current.id);
  }
  
  // Get the polje's base color
  const poljeColor = current.color || getPoljeBaseColor(current.id);
  
  // Create darker shades based on level depth
  const levelDepths = { 'polje': 0, 'subzone': 1, 'vrsta': 2, 'globina': 3 };
  const depth = levelDepths[node.level] || 0;
  
  return darkenColor(poljeColor, depth * 0.3); // Each level gets 30% darker
}

function darkenColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const newR = Math.max(0, Math.floor(r * (1 - amount)));
  const newG = Math.max(0, Math.floor(g * (1 - amount)));
  const newB = Math.max(0, Math.floor(b * (1 - amount)));
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

export interface SunburstProps {
  doc: HierarchyDocument;
  activeId?: string;
  onSelect: (id: string, level: Level) => void;
}

// Simple ring list (not full polar arcs) for fast MVP
export default function Sunburst({ doc, onSelect }: SunburstProps) {
  const root = useMemo(() => toSun(doc), [doc]);
  const labels: string[] = [];
  const parents: string[] = [];
  const ids: string[] = [];
  const values: number[] = [];
  const colors: string[] = [];

  // Flatten all nodes for color inheritance lookup
  const allNodes: SunNode[] = [];
  function flattenNodes(node: SunNode) {
    allNodes.push(node);
    node.children?.forEach(flattenNodes);
  }
  flattenNodes(root);

  function walk(node: SunNode, parentId: string | null) {
    ids.push(node.id);
    labels.push(node.name);
    parents.push(parentId ?? '');
    // Use leaf count as value; Plotly sunburst requires parent value >= sum(children)
    const leafCount = countLeaves(node);
    values.push(Math.max(1, leafCount));
    
    // Get inherited color for this node
    const nodeColor = getInheritedColor(node, allNodes);
    colors.push(nodeColor);
    
    node.children?.forEach((c) => walk(c, node.id));
  }
  walk(root, null);

  return (
    <Plot
      data={[
        {
          type: 'sunburst',
          labels,
          parents,
          ids,
          values,
          marker: {
            colors: colors
          },
          branchvalues: 'total',
          maxdepth: 4,
          insidetextorientation: 'radial',
        } as any,
      ]}
      layout={{
        width: 300,
        height: 300,
        margin: { l: 0, r: 0, t: 0, b: 0 },
        paper_bgcolor: 'black',
        plot_bgcolor: 'black',
        font: { color: 'white' },
        showlegend: false,
      }}
      onClick={(ev: any) => {
        const p = ev?.points?.[0];
        if (!p) return;
        const id = p.id as string;
        const node = findById(root, id);
        if (node) onSelect(node.id, node.level);
      }}
      config={{ displayModeBar: false }}
    />
  );
}

function findById(node: SunNode, id: string): SunNode | null {
  if (node.id === id) return node;
  for (const c of node.children || []) {
    const r = findById(c, id);
    if (r) return r;
  }
  return null;
}

function countLeaves(node: SunNode): number {
  if (!node.children || node.children.length === 0) return 1;
  let sum = 0;
  for (const c of node.children) sum += countLeaves(c);
  return Math.max(1, sum);
}


