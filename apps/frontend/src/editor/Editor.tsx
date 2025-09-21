import { Stage, Layer, Rect, Text, Group, Transformer, Shape } from 'react-konva';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { HierarchyDocument, HierarchyNode, Level } from '../model/types';
// removed seed hierarchy import; editor now loads only backend features
import HierarchyNavigator from './HierarchyNavigator';

const initialDoc: HierarchyDocument = { origin: [0, 0], units: 'm', nodes: [] as HierarchyNode[] };

function flatten(nodes: HierarchyNode[], acc: HierarchyNode[] = []): HierarchyNode[] {
  for (const n of nodes) {
    acc.push(n);
    if (n.children && n.children.length) flatten(n.children, acc);
  }
  return acc;
}

// Color inheritance system - each polje gets a base color, children get darker shades
function getPoljeBaseColor(poljeId: string): string {
  // Generate consistent colors for each polje based on ID
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
  
  // Simple hash function to get consistent color for polje ID
  let hash = 0;
  for (let i = 0; i < poljeId.length; i++) {
    const char = poljeId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInheritedColor(node: HierarchyNode, allNodes: HierarchyNode[]): string {
  // Find the root polje for this node
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
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Darken by reducing each component
  const newR = Math.max(0, Math.floor(r * (1 - amount)));
  const newG = Math.max(0, Math.floor(g * (1 - amount)));
  const newB = Math.max(0, Math.floor(b * (1 - amount)));
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Legacy function for backward compatibility
function colorByLevel(level: Level) {
  switch (level) {
    case 'polje':
      return '#3B82F6';
    case 'subzone':
      return '#2563EB';
    case 'vrsta':
      return '#1D4ED8';
    default:
      return '#1E40AF';
  }
}

export default function Editor() {
  const [doc, setDoc] = useState<HierarchyDocument>(initialDoc);
  const all = useMemo(() => flatten(doc.nodes), [doc]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [visibleLevel, setVisibleLevel] = useState<Level | 'all'>('all');
  const [displayLevel, setDisplayLevel] = useState<'root' | 'polje' | 'subzone' | 'vrsta'>('root');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [stageWidth, setStageWidth] = useState(900);
  const [stageHeight, setStageHeight] = useState(500);
  const [showBackground] = useState(true);
  const [bgPaths, setBgPaths] = useState<number[][]>([]);
  const [bgBbox, setBgBbox] = useState<[number, number, number, number] | null>(null);
  const [bgScale] = useState<number>(0.001);
  const [bgRaw, setBgRaw] = useState<any | null>(null);
  const stageRef = useRef<any>(null);
  const [viewScale, setViewScale] = useState<number>(1);
  const [viewOffset, setViewOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const userInteractedRef = useRef<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string>('#d6f0ff');
  const [selectedOrder, setSelectedOrder] = useState<number>(0);
  const [showHierarchy, setShowHierarchy] = useState<boolean>(true);

  // Function to move selected annotation and its children to current camera position
  const bringToView = useCallback(() => {
    console.log('🔍 Bring to view called, selectedId:', selectedId);
    
    if (!selectedId) {
      console.log('❌ No selectedId, returning');
      return;
    }
    
    const selectedNode = all.find(n => n.id === selectedId);
    console.log('🎯 Selected node:', selectedNode);
    
    if (!selectedNode) {
      console.log('❌ Selected node not found, returning');
      return;
    }
    
    // Get all children of the selected node
    const getChildren = (node: HierarchyNode): HierarchyNode[] => {
      const children = all.filter(n => n.parentLocalId === node.id);
      const allChildren = [...children];
      children.forEach(child => {
        allChildren.push(...getChildren(child));
      });
      return allChildren;
    };
    
    const children = getChildren(selectedNode);
    const allNodes = [selectedNode, ...children];
    console.log('👥 All nodes (selected + children):', allNodes.length, allNodes.map(n => ({ id: n.id, name: n.name, level: n.level })));
    
    if (allNodes.length === 0) {
      console.log('❌ No nodes to move, returning');
      return;
    }
    
    // Calculate current viewport center in world coordinates
    const viewportCenterX = (stageWidth / 2 - viewOffset.x) / viewScale;
    const viewportCenterY = (stageHeight / 2 - viewOffset.y) / viewScale;
    
    console.log('📷 Current viewport center:', { viewportCenterX, viewportCenterY });
    console.log('📷 Current view settings:', { viewScale, viewOffset });
    
    // Calculate the current bounding box of all selected nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    allNodes.forEach(node => {
      console.log('📍 Processing node:', node.id, 'polygon:', node.polygon);
      if (node.polygon && node.polygon.length > 0) {
        node.polygon.forEach((point: [number, number]) => {
          const [x, y] = point;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        });
      }
    });
    
    console.log('📦 Current bounding box:', { minX, minY, maxX, maxY });
    
    if (minX === Infinity) {
      console.log('❌ No valid points found, returning');
      return;
    }
    
    // Calculate the center of the selected nodes
    const currentCenterX = (minX + maxX) / 2;
    const currentCenterY = (minY + maxY) / 2;
    
    console.log('🎯 Current center of selected nodes:', { currentCenterX, currentCenterY });
    
    // Calculate the offset needed to move the center to viewport center
    const offsetX = viewportCenterX - currentCenterX;
    const offsetY = viewportCenterY - currentCenterY;
    
    console.log('📐 Offset to move to viewport center:', { offsetX, offsetY });
    
    // Move all selected nodes by the calculated offset
    setDoc((prev) => {
      const copy: HierarchyDocument = JSON.parse(JSON.stringify(prev));
      
      allNodes.forEach(nodeToMove => {
        const node = findNodeById(copy.nodes, nodeToMove.id);
        if (node && node.polygon) {
          // Update the polygon coordinates
          node.polygon = node.polygon.map((point: [number, number]) => [
            point[0] + offsetX,
            point[1] + offsetY
          ]);
          
          // Update x_coord and y_coord if they exist
          if (node.polygon.length > 0) {
            const [x, y] = node.polygon[0];
            // Update the node's position properties if they exist
            if ('x' in node) (node as any).x = x;
            if ('y' in node) (node as any).y = y;
          }
          
          console.log('✅ Moved node:', node.id, 'new polygon:', node.polygon);
          
          // Persist the changes to backend if the node has a remoteId
          if (node.remoteId) {
            const ring = node.polygon.slice(0, -1); // Remove last point if it's a duplicate of first
            const [x, y] = node.polygon[0];
            
            persistPatch(node.remoteId, { 
              coordinates: ring,
              x_coord: x,
              y_coord: y
            }).catch((e) => console.warn('Failed to persist moved node:', node.id, e));
          }
        }
      });
      
      return copy;
    });
    
    console.log('✅ All selected nodes moved to viewport center');
    // NOTE: We intentionally do NOT change displayLevel or selectedParentId here
    // to preserve the sunburst state
  }, [selectedId, all, stageWidth, stageHeight, viewScale, viewOffset]);

  // Calculate dynamic canvas dimensions
  useEffect(() => {
    const calculateDimensions = () => {
      // Calculate height: 100vh minus navbar (60px) and button bar (60px) and padding (20px)
      const availableHeight = window.innerHeight - 60 - 60 - 20;
      setStageHeight(Math.max(400, availableHeight));
      
      // Calculate width based on sunburst visibility
      const hierarchyWidth = showHierarchy ? 320 : 0;
      const gap = 12;
      const padding = 24; // Reduced padding
      const availableWidth = window.innerWidth - hierarchyWidth - gap - padding;
      setStageWidth(Math.max(400, availableWidth)); // Minimum width of 400px
    };

    calculateDimensions();
    window.addEventListener('resize', calculateDimensions);
    return () => window.removeEventListener('resize', calculateDimensions);
  }, [showHierarchy]);

  // Load existing annotations from backend on mount
  useEffect(() => {
    let cancelled = false;
    loadAnnotations().then(backendNodes => {
      if (cancelled) return;
      // console.log('Loaded backend annotations:', backendNodes.length, backendNodes);
      // Always replace the document with backend annotations (even if empty)
      setDoc(prev => ({
        ...prev,
        nodes: backendNodes
      }));
    });
    return () => { cancelled = true; };
  }, []);

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
          // console.log('Editor background paths:', paths.length, 'bbox:', bbox);
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

  // Center view on factory layout with scale 1
  const fit = useMemo(() => {
    // Use factory background bbox for centering, fallback to annotations if no background
    const targetBbox = bgBbox || bbox;
    if (!targetBbox) return { scale: 3, offsetX: 1200, offsetY: 1400 };
    
    // const [minX, minY, maxX, maxY] = targetBbox;
    // const centerX = (minX + maxX) / 2;
    // const centerY = (minY + maxY) / 2;
    
    // Center the factory layout in the viewport with scale 1
    const offsetX = 1200;
    const offsetY = 1400;
    
    // eslint-disable-next-line no-console
    // console.log('Factory centered view - bbox:', targetBbox, 'center:', centerX, centerY, 'offset:', offsetX, offsetY);
    return { scale: 3, offsetX, offsetY };
  }, [bgBbox, bbox]);

  // Initialize interactive view from fit, until user pans/zooms
  useEffect(() => {
    if (!userInteractedRef.current) {
      setViewScale(3); // Always use scale 1 as requested
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

  // Mouse panning (left click on empty space, middle/right click anywhere)
  const isPanningRef = useRef<boolean>(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const clickedOnAnnotationRef = useRef<boolean>(false);
  
  function onMouseDown(e: any) {
    const btn = e.evt.button;
    const target = e.target;
    
    // Check if clicked on an annotation (Rect or Group containing annotation)
    const parent = target.getParent ? target.getParent() : null;
    const isAnnotation = (
      target.className === 'Rect' ||
      (parent && parent.className === 'Group')
    );
    
    clickedOnAnnotationRef.current = isAnnotation;
    
    // Enable panning for:
    // - Middle mouse (button 1) or right mouse (button 2) - anywhere
    // - Left mouse (button 0) - only if not on annotation
    if (btn === 1 || btn === 2 || (btn === 0 && !isAnnotation)) {
      isPanningRef.current = true;
      lastPosRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      userInteractedRef.current = true;
      
      // Prevent default behavior for left click panning
      if (btn === 0 && !isAnnotation) {
        e.evt.preventDefault();
      }
    }
  }
  
  function onMouseUp() {
    isPanningRef.current = false;
    lastPosRef.current = null;
    clickedOnAnnotationRef.current = false;
  }
  
  function onMouseMove(e: any) {
    if (!isPanningRef.current || !lastPosRef.current) return;
    const p = { x: e.evt.clientX, y: e.evt.clientY };
    const dx = p.x - lastPosRef.current.x;
    const dy = p.y - lastPosRef.current.y;
    lastPosRef.current = p;
    setViewOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }


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


  function updateNodeRect(id: string, x: number, y: number, width: number, height: number) {
    // console.log('updateNodeRect called:', id, 'pos:', x, y, 'size:', width, height);
    // x, y, width, height are already in factory coordinates (same as background)
    setDoc((prev) => {
      const copy: HierarchyDocument = JSON.parse(JSON.stringify(prev));
      const node = findNodeById(copy.nodes, id);
      if (!node) return prev;
      // Store in factory coordinates: [p0,p1,p2,p3,p0] - closed ring
      node.polygon = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
        [x, y], // Close the ring
      ];
      return copy;
    });
    
    // Persist immediately - only if the annotation already exists in backend
    const existing = findNodeById(doc.nodes, id);
    const ring = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
      [x, y], // Close the ring
    ];
    if (existing && (existing as any).remoteId) {
      // console.log('Persisting to backend:', (existing as any).remoteId, ring, 'x:', x, 'y:', y);
      // Update existing annotation in backend with coordinates and x,y position
      persistPatch((existing as any).remoteId!, { 
        coordinates: ring,
        x_coord: x,
        y_coord: y
      }).catch((e) => console.warn('patch failed', e));
    } else {
      // console.log('No remoteId found for node:', id, existing);
      // console.log('This annotation is not persisted to backend yet');
    }
    // Note: Don't create new annotations when moving existing ones
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

  function nextLevel(l: Level): Level | null {
    if (l === 'polje') return 'subzone';
    if (l === 'subzone') return 'vrsta';
    if (l === 'vrsta') return 'globina';
    return null;
  }

  function addAnnotationAtCenter() {
    // Calculate center in factory coordinates
    const center = {
      x: (stageWidth / 2 - viewOffset.x) / Math.max(viewScale, 1e-6),
      y: (stageHeight / 2 - viewOffset.y) / Math.max(viewScale, 1e-6),
    };
    const size = 5; // Size in factory coordinates
    // Determine parent based on current sunburst selection
    let parent: HierarchyNode | undefined;
    let targetLevel: Level;
    if (selectedId) {
      const sel = findNodeById(doc.nodes, selectedId);
      if (sel) {
        const child = nextLevel(sel.level);
        if (!child) {
          // eslint-disable-next-line no-alert
          alert('Reached deepest level for this branch. Select a higher level to add children.');
          return;
        }
        parent = sel;
        targetLevel = child;
      } else {
        targetLevel = 'polje';
      }
    } else {
      targetLevel = 'polje';
    }
    const baseName = `New ${targetLevel}`;
    const uniqueName = generateUniqueName(baseName, targetLevel);
    
    const newNode: HierarchyNode = {
      id: `ann-${Date.now()}`,
      level: targetLevel,
      parentLocalId: parent?.id,
      name: uniqueName,
      polygon: [
        [center.x - size, center.y - size],
        [center.x + size, center.y - size],
        [center.x + size, center.y + size],
        [center.x - size, center.y + size],
        [center.x - size, center.y - size], // Close the ring
      ],
      children: [],
    } as any;
    
    // Set color based on inheritance system
    const tempAll = [...all, newNode];
    newNode.color = getInheritedColor(newNode, tempAll);
    setDoc((prev) => insertNode(prev, newNode, parent?.id));
    setSelectedId(newNode.id);
    // Persist to backend (best-effort)
    persistCreate(newNode, parent).catch((e) => console.warn('create feature failed', e));
  }

  function deleteSelected() {
    if (!selectedId) return;
    const node = findNodeById(doc.nodes, selectedId);
    if (!node) return;
    setDoc((prev) => removeNode(prev, selectedId));
    setSelectedId(undefined);
    if ((node as any).remoteId) persistDelete((node as any).remoteId!).catch((e) => console.warn('delete failed', e));
  }

  function handleRename(id: string) {
    const node = findNodeById(doc.nodes, id);
    if (!node) return;
    // eslint-disable-next-line no-alert
    const name = window.prompt('Rename annotation', node.name);
    if (!name) return;
    
    // Generate unique name if needed
    const uniqueName = generateUniqueName(name, node.level);
    
    setDoc((prev) => {
      const copy: HierarchyDocument = JSON.parse(JSON.stringify(prev));
      const n = findNodeById(copy.nodes, id);
      if (!n) return prev;
      n.name = uniqueName;
      return copy;
    });
    if ((node as any).remoteId) persistPatch((node as any).remoteId!, { name: uniqueName }).catch((e) => console.warn('rename failed', e));
  }


  function insertNode(state: HierarchyDocument, node: HierarchyNode, parentId?: string): HierarchyDocument {
    const copy: HierarchyDocument = JSON.parse(JSON.stringify(state));
    if (!parentId) {
      copy.nodes.push(node);
      return copy;
    }
    const parent = findNodeById(copy.nodes, parentId);
    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      copy.nodes.push(node);
    }
    return copy;
  }

  function removeNode(state: HierarchyDocument, id: string): HierarchyDocument {
    const copy: HierarchyDocument = JSON.parse(JSON.stringify(state));
    function rec(nodes: HierarchyNode[]): HierarchyNode[] {
      return nodes.filter((n) => {
        if (n.id === id) return false;
        if (n.children) n.children = rec(n.children);
        return true;
      });
    }
    copy.nodes = rec(copy.nodes);
    return copy;
  }

  const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

  // Load existing annotations from backend
  async function loadAnnotations(): Promise<HierarchyNode[]> {
    try {
      // console.log('Loading annotations from:', `${API_BASE}/features/`);
      const res = await fetch(`${API_BASE}/features/`);
      if (!res.ok) {
        console.error('Failed to load annotations:', res.status, res.statusText);
        return [];
      }
      const features = await res.json();
      // console.log('Raw features from backend:', features);
      // console.log('Number of features loaded:', features.length);
      
      // If no features exist, log it
      if (features.length === 0) {
        // console.log('No features found in backend.');
      }
      
      // Convert backend features to HierarchyNode format
      const nodes: HierarchyNode[] = [];
      const nodeMap = new Map<number, HierarchyNode>();
      
      // First pass: create all nodes
      for (const feature of features) {
        // Use the stored coordinates directly as the polygon
        let polygon: [number, number][] = [];
        
        if (feature.coordinates && feature.coordinates.length >= 3) {
          // Use the stored coordinates directly - they already have the correct shape and position
          polygon = feature.coordinates as [number, number][];
          // console.log(`Feature ${feature.id}: using stored coordinates, polygon:`, polygon);
        } else {
          // Fallback: create a default rectangle at x_coord, y_coord
          const x = feature.x_coord || 0;
          const y = feature.y_coord || 0;
          const width = 10;
          const height = 10;
          polygon = [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height],
            [x, y] // Close the ring
          ];
          // console.log(`Feature ${feature.id}: using fallback coordinates, x=${x}, y=${y}, polygon:`, polygon);
        }
        
        const node: HierarchyNode = {
          id: `backend_${feature.id}`,
          remoteId: feature.id,
          name: feature.name,
          level: feature.level as Level,
          color: feature.color || colorByLevel(feature.level as Level),
          polygon: polygon,
          children: [],
          parentLocalId: feature.parent_id ? `backend_${feature.parent_id}` : undefined,
          cona: feature.cona,
          max_capacity: feature.max_capacity,
          taken_capacity: feature.taken_capacity
        };
        nodeMap.set(feature.id, node);
      }
      
      // Second pass: build hierarchy
      for (const feature of features) {
        const node = nodeMap.get(feature.id);
        if (!node) continue;
        
        if (feature.parent_id) {
          const parent = nodeMap.get(feature.parent_id);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(node);
          }
        } else {
          nodes.push(node);
        }
      }
      
      // Apply inherited color system to all nodes
      const allNodes = flatten(nodes);
      for (const node of allNodes) {
        node.color = getInheritedColor(node, allNodes);
      }
      
      // console.log('Converted to HierarchyNodes with inherited colors:', nodes.length, nodes);
      return nodes;
    } catch (error) {
      console.error('Failed to load annotations:', error);
      return [];
    }
  }

  async function persistCreate(n: HierarchyNode, parent?: HierarchyNode) {
    try {
      // console.log('Creating feature in backend:', n.name, n.polygon);
      const res = await fetch(`${API_BASE}/features/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer_id: 1, // Use default annotations layer
          parent_id: parent && (parent as any).remoteId ? (parent as any).remoteId : null,
          name: n.name,
          color: n.color || null,
          level: n.level,
          properties: {},
          coordinates: n.polygon,
          x_coord: n.polygon[0][0],
          y_coord: n.polygon[0][1]
        })
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to create feature:', res.status, res.statusText, errorText);
        return;
      }
      const json = await res.json();
      // console.log('Feature created successfully:', json);
      setDoc((prev) => {
        const copy: HierarchyDocument = JSON.parse(JSON.stringify(prev));
        const node = findNodeById(copy.nodes, n.id);
        if (node) (node as any).remoteId = json.id;
        return copy;
      });
    } catch (error) {
      console.error('Error creating feature:', error);
    }
  }
  async function persistDelete(remoteId: number) {
    try { await fetch(`${API_BASE}/features/${remoteId}`, { method: 'DELETE' }); } catch {}
  }
  async function persistPatch(remoteId: number, patch: any) {
    try {
      // console.log('Patching feature:', remoteId, patch);
      const res = await fetch(`${API_BASE}/features/${remoteId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to patch feature:', res.status, res.statusText, errorText);
        return;
      }
      // console.log('Feature patched successfully');
    } catch (error) {
      console.error('Error patching feature:', error);
    }
  }

  // Update selected annotation color
  function updateSelectedColor(color: string) {
    if (!selectedId) return;
    const node = all.find(n => n.id === selectedId);
    if (!node) return;
    
    node.color = color;
    setDoc(prev => ({ ...prev }));
    
    // Persist to backend
    if ((node as any).remoteId) {
      persistPatch((node as any).remoteId, { color });
    }
  }

  // Update selected annotation order
  function updateSelectedOrder(order: number) {
    if (!selectedId) return;
    const node = all.find(n => n.id === selectedId);
    if (!node) return;
    
    node.order = order;
    setDoc(prev => ({ ...prev }));
    
    // Persist to backend
    if ((node as any).remoteId) {
      persistPatch((node as any).remoteId, { order_index: order });
    }
  }

  // Update selected annotation when selection changes
  useEffect(() => {
    if (selectedId) {
      const node = all.find(n => n.id === selectedId);
      if (node) {
        setSelectedColor(node.color || '#d6f0ff');
        setSelectedOrder(node.order || 0);
      }
    }
  }, [selectedId, all]);

  // Generate unique name for new annotations
  function generateUniqueName(baseName: string, level: Level): string {
    const existingNames = all
      .filter(n => n.level === level)
      .map(n => n.name)
      .filter(name => name.startsWith(baseName));
    
    if (!existingNames.includes(baseName)) {
      return baseName;
    }
    
    let counter = 1;
    let newName = `${baseName} ${counter}`;
    while (existingNames.includes(newName)) {
      counter++;
      newName = `${baseName} ${counter}`;
    }
    return newName;
  }


  const darkPanel = { border: '1px solid #1f2937', borderRadius: 8, background: '#0b0f17', padding: 8, display: 'grid', gap: 8 } as const;
  const btn = { padding: '6px 10px', borderRadius: 8, border: '1px solid #374151', background: '#111827', color: 'white', cursor: 'pointer', minWidth: 120 } as const;
  const labelStyle = { color: '#9ca3af', fontSize: 12 } as const;

  return (
    <div style={{ background: '#0b0f17', height: '100vh', color: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center', padding: '8px 0', height: '60px', flexShrink: 0 }}>
        <label style={{ ...labelStyle }}>Level
          <select style={{ marginLeft: 6, background: '#111827', color: 'white', border: '1px solid #374151', borderRadius: 6, padding: '6px 8px' }} value={visibleLevel} onChange={e => setVisibleLevel(e.target.value as any)}>
            <option value="all">All</option>
            <option value="polje">polje</option>
            <option value="subzone">subzone</option>
            <option value="vrsta">vrsta</option>
            <option value="globina">globina</option>
          </select>
        </label>
        <button style={btn} onClick={() => addAnnotationAtCenter()}>Add annotation</button>
        <button style={btn} onClick={() => deleteSelected()} disabled={!selectedId}>Delete</button>
        <button style={btn} onClick={() => setShowHierarchy(!showHierarchy)}>
          {showHierarchy ? 'Hide Hierarchy' : 'Show Hierarchy'}
        </button>
        <button style={btn} onClick={bringToView} disabled={!selectedId}>
          Bring to view
        </button>
        {selectedId && (
          <>
            <label style={{ ...labelStyle }}>Color
              <input 
                type="color" 
                style={{ marginLeft: 6, background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '2px 4px' }} 
                value={selectedColor} 
                onChange={e => updateSelectedColor(e.target.value)} 
              />
              <span style={{ marginLeft: 8, fontSize: 10, color: '#6b7280' }}>
                (Inherited: {getInheritedColor(all.find(n => n.id === selectedId)!, all)})
              </span>
            </label>
            <label style={{ ...labelStyle }}>Order
              <input 
                type="number" 
                style={{ marginLeft: 6, background: '#111827', color: 'white', border: '1px solid #374151', borderRadius: 6, padding: '6px 8px', width: 80 }} 
                value={selectedOrder} 
                onChange={e => updateSelectedOrder(parseInt(e.target.value) || 0)} 
              />
            </label>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flex: 1, overflow: 'hidden' }}>
        {showHierarchy && (
          <div style={{ ...darkPanel, width: '320px', flexShrink: 0 }}>
            <HierarchyNavigator
              doc={doc}
              activeId={selectedId}
              onSelect={(id, lvl) => {
                console.log('HierarchyNavigator onSelect:', { id, lvl });
                setSelectedId(id);
                setVisibleLevel(lvl);
                
                // Set display level and parent based on what was clicked
                if (id === 'root' || lvl === 'polje') {
                  // Show only polje level
                  console.log('Setting displayLevel to root');
                  setDisplayLevel('root');
                  setSelectedParentId(null);
                } else if (lvl === 'subzone') {
                  // Show all subzones of the parent polje
                  console.log('Setting displayLevel to polje');
                  setDisplayLevel('polje');
                  // Find the parent polje of this subzone
                  const subzoneNode = all.find(n => n.id === id);
                  console.log('Subzone node:', subzoneNode);
                  const parentPoljeId = subzoneNode?.parentLocalId;
                  console.log('Parent polje ID:', parentPoljeId);
                  setSelectedParentId(parentPoljeId || null);
                } else if (lvl === 'vrsta') {
                  // Show all vrste of the parent subzone
                  console.log('Setting displayLevel to subzone');
                  setDisplayLevel('subzone');
                  // Find the parent subzone of this vrsta
                  const vrstaNode = all.find(n => n.id === id);
                  console.log('Vrsta node:', vrstaNode);
                  const parentSubzoneId = vrstaNode?.parentLocalId;
                  console.log('Parent subzone ID:', parentSubzoneId);
                  setSelectedParentId(parentSubzoneId || null);
                }
              }}
            />
        </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            style={{ border: '1px solid #1f2937', background: 'black', borderRadius: 8, flex: 1 }}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
        >
          <Layer listening={false}>
            {showBackground && (
              <Group x={viewOffset.x} y={viewOffset.y} scaleX={viewScale} scaleY={viewScale}>
                <Shape
                  sceneFunc={(ctx) => {
                    ctx.save();
                    ctx.globalAlpha = 0.9;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = Math.max(0.6 / Math.max(viewScale, 1e-6), 0.2);
                    const arr = bgPaths; // already in data coords
                    for (let k = 0; k < arr.length; k++) {
                      const pts = arr[k];
                      if (!pts || pts.length < 4) continue;
                      ctx.beginPath();
                      ctx.moveTo(pts[0], pts[1]);
                      for (let i = 2; i < pts.length; i += 2) {
                        ctx.lineTo(pts[i], pts[i + 1]);
                      }
                      ctx.stroke();
                    }
                    ctx.restore();
                  }}
                />
              </Group>
            )}
          </Layer>
          <Layer>
            <Group x={viewOffset.x} y={viewOffset.y} scaleX={viewScale} scaleY={viewScale}>
            {all
              .filter((n) => {
                // First apply the manual level filter if set
                if (visibleLevel !== 'all' && n.level !== (visibleLevel as Level)) {
                  return false;
                }
                
                // Then apply the display level logic
                if (displayLevel === 'root') {
                  // Show only polje level
                  return n.level === 'polje';
                } else if (displayLevel === 'polje') {
                  // Show only direct children of selected polje (subzones)
                  const show = n.level === 'subzone' && n.parentLocalId === selectedParentId;
                  if (show) console.log('Showing subzone:', n.name, 'parent:', n.parentLocalId, 'selectedParent:', selectedParentId);
                  return show;
                } else if (displayLevel === 'subzone') {
                  // Show only direct children of selected subzone (vrste)
                  const show = n.level === 'vrsta' && n.parentLocalId === selectedParentId;
                  if (show) console.log('Showing vrsta:', n.name, 'parent:', n.parentLocalId, 'selectedParent:', selectedParentId);
                  return show;
                }
                
                return true;
              })
              .filter((n) => n.polygon && n.polygon.length >= 3) // Only render annotations with valid polygons
              .map((n) => {
              // Use factory coordinates directly (same as background)
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
                    fill={getInheritedColor(n, all)}
                    opacity={0.5}
                    stroke={isSel ? '#2563eb' : '#111827'}
                    strokeWidth={(isSel ? 1.5 : 0.5) / Math.max(viewScale, 1e-6)}
                    draggable
                    onClick={(e) => {
                      e.cancelBubble = true; // Prevent event from bubbling to stage
                      setSelectedId(n.id);
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true; // Prevent event from bubbling to stage
                      // console.log('dblclick rename', n.id);
                      handleRename(n.id);
                    }}
                    onDragEnd={(e) => {
                      const node = e.target as any;
                      const nx = node.x();
                      const ny = node.y();
                      const nw = node.width();
                      const nh = node.height();
                      // console.log('Drag ended:', n.id, 'new pos:', nx, ny, 'size:', nw, nh);
                      updateNodeRect(n.id, nx, ny, nw, nh);
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
                   <Text x={x + 3} y={y + 3} text={n.name} fontSize={4} fill="#111827" listening={false} />
                   <Text x={x + 3} y={y + 3} text={n.name} fontSize={4} fill="#ffffff" listening={false} />
                </Group>
              );
            })}
            </Group>
            <Transformer ref={transformerRef} rotateEnabled={false} keepRatio={false} />
            <Text x={6} y={stageHeight - 18} text={`items: ${all.length} viewScale: ${viewScale.toFixed(3)}`} fontSize={12} fill="#9ca3af" />
          </Layer>
        </Stage>
        </div>
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


