import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
// @ts-ignore - No types available for mapbox-gl-draw
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import HierarchyNavigator from '../components/Hierarchy/HierarchyNavigator';
import AnnotationEditModal from '../components/AnnotationModal/AnnotationEditModal';
import type { HierarchyNode, Level } from '../model/types';
import { config } from '../config';

const API_BASE = config.API_BASE;

// Helper functions
// Calculate the orientation angle of a polygon (in radians)
function calculatePolygonOrientation(coordinates: number[][]): number {
  if (coordinates.length < 3) return 0;
  
  // Find the longest edge to determine orientation
  let maxLength = 0;
  let orientationAngle = 0;
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > maxLength) {
      maxLength = length;
      orientationAngle = Math.atan2(dy, dx);
    }
  }
  
  return orientationAngle;
}


// Calculate reference orientation from the hardcoded reference polygon
function calculateReferenceOrientation(): number {
  // Hardcoded reference polygon from user - ID 19703
  // POLYGON ((10.975172639350573 45.16873541903552, 9.753687796547522 45.1184584160307, 9.829368801142177 44.26715166696913, 11.029076321130045 44.3174412910695, 10.975172639350573 45.16873541903552))
  const referenceCoords = [
    [10.975172639350573, 45.16873541903552],
    [9.753687796547522, 45.1184584160307],
    [9.829368801142177, 44.26715166696913],
    [11.029076321130045, 44.3174412910695],
    [10.975172639350573, 45.16873541903552]  // Closed ring
  ];
  
  const orientation = calculatePolygonOrientation(referenceCoords);
  console.log(`Reference polygon orientation: ${(orientation * 180 / Math.PI).toFixed(2)}°`);
  return orientation;
}

// Calculate reference aspect ratio (width/height) from the hardcoded reference polygon
function calculateReferenceAspectRatio(): number {
  // Hardcoded reference polygon from user - ID 19703
  const referenceCoords: number[][] = [
    [10.975172639350573, 45.16873541903552],
    [9.753687796547522, 45.1184584160307],
    [9.829368801142177, 44.26715166696913],
    [11.029076321130045, 44.3174412910695],
    [10.975172639350573, 45.16873541903552]
  ];
  const refOrientation = calculatePolygonOrientation(referenceCoords);
  const cos = Math.cos(-refOrientation);
  const sin = Math.sin(-refOrientation);
  const rotated = referenceCoords.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
  const xs = rotated.map(p => p[0]);
  const ys = rotated.map(p => p[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  if (height === 0) return Infinity;
  const aspect = width / height;
  console.log(`Reference aspect ratio (w/h): ${aspect}`);
  return aspect;
}

export default function Viewer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [showHierarchy, setShowHierarchy] = useState(true);
  const [doc, setDoc] = useState<{ origin: [number, number]; units: 'm' | 'cm' | 'mm' | 'px'; nodes: HierarchyNode[] }>({ origin: [0, 0], units: 'm', nodes: [] });
  const [all, setAll] = useState<HierarchyNode[]>([]);
  const [factoryLoaded, setFactoryLoaded] = useState<boolean>(false);
  
  // Annotation editing state
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDraggingVertex, setIsDraggingVertex] = useState<boolean>(false);
  
  // Vertex dragging mode: 'free' or 'rectangular'
  const [vertexDragMode, setVertexDragMode] = useState<'free' | 'rectangular'>('rectangular');
  const vertexDragModeRef = useRef<'free' | 'rectangular'>('rectangular');
  
  // Checkbox-based visibility system
  const [checkedNodes, setCheckedNodes] = useState<Set<string>>(new Set());
  
  
  const [displayLevel, setDisplayLevel] = useState<Level>('polje');

  // Modal state for editing annotations
  const [editModalAnnotation, setEditModalAnnotation] = useState<HierarchyNode | null>(null);

  // Refs to avoid stale values during drag
  const checkedNodesRef = useRef<Set<string>>(new Set());
  const displayLevelRef = useRef<Level>('polje');
  useEffect(() => { checkedNodesRef.current = checkedNodes; }, [checkedNodes]);
  useEffect(() => { displayLevelRef.current = displayLevel; }, [displayLevel]);
  useEffect(() => { vertexDragModeRef.current = vertexDragMode; }, [vertexDragMode]);

  // Animation frame for smooth dragging
  const animationFrameRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{ type: 'position' | 'vertex', annotationId: string, deltaLng: number, deltaLat: number, vertexIndex?: number } | null>(null);

  // Live refs to avoid stale closures in map event handlers
  const allRef = useRef<HierarchyNode[]>([]);
  const selectedAnnotationRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const vertexDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedVertexIndexRef = useRef<number | null>(null);
  const hasDraggedRef = useRef<boolean>(false);
  const hasVertexDraggedRef = useRef<boolean>(false);

  useEffect(() => { allRef.current = all; }, [all]);
  useEffect(() => { selectedAnnotationRef.current = selectedAnnotation; }, [selectedAnnotation]);

  // Handle checkbox changes with cascading behavior
  const handleNodeCheck = (nodeId: string, checked: boolean) => {
    setCheckedNodes(prev => {
      const newSet = new Set(prev);
      
      // Find the node being checked/unchecked
      const node = all.find(n => n.id === nodeId);
      if (!node) return newSet;
      
      if (checked) {
        // Check the node itself
        newSet.add(nodeId);
        
        // If it's a polje, also check all its children (subzones and vrstas)
        if (node.level === 'polje') {
          const children = all.filter(n => n.parentLocalId === nodeId);
          children.forEach(child => {
            newSet.add(child.id);
            // Also check vrsta children of subzones
            if (child.level === 'subzone') {
              const grandChildren = all.filter(n => n.parentLocalId === child.id);
              grandChildren.forEach(grandChild => newSet.add(grandChild.id));
            }
          });
        }
        // If it's a subzone, also check all its vrsta children
        else if (node.level === 'subzone') {
          const children = all.filter(n => n.parentLocalId === nodeId);
          children.forEach(child => newSet.add(child.id));
        }
      } else {
        // Uncheck the node itself
        newSet.delete(nodeId);
        
        // If it's a polje, also uncheck all its children
        if (node.level === 'polje') {
          const children = all.filter(n => n.parentLocalId === nodeId);
          children.forEach(child => {
            newSet.delete(child.id);
            // Also uncheck vrsta children of subzones
            if (child.level === 'subzone') {
              const grandChildren = all.filter(n => n.parentLocalId === child.id);
              grandChildren.forEach(grandChild => newSet.delete(grandChild.id));
            }
          });
        }
        // If it's a subzone, also uncheck all its vrsta children
        else if (node.level === 'subzone') {
          const children = all.filter(n => n.parentLocalId === nodeId);
          children.forEach(child => newSet.delete(child.id));
        }
      }
      
      return newSet;
    });
  };

  // Handle display level changes
  const handleDisplayLevelChange = (level: Level) => {
    // Only allow the three main levels for display
    if (level === 'polje' || level === 'subzone' || level === 'vrsta') {
      setDisplayLevel(level);
    }
  };

  // Refresh annotations when visibility changes
  useEffect(() => {
    refreshAnnotationsSource();
  }, [checkedNodes, displayLevel]);

  // Initial refresh when annotations are first loaded
  useEffect(() => {
    if (all.length > 0) {
      refreshAnnotationsSource();
    }
  }, [all.length]);

  // Compute currently visible annotations based on checkboxes and display level
  function computeVisibleAnnotations(): HierarchyNode[] {
    // Always use current refs for the most up-to-date positions and filters during drag
    const currentLevel = displayLevelRef.current;
    const currentChecked = checkedNodesRef.current;
    return allRef.current.filter(node => {
      if (node.level !== currentLevel) return false;
      if (currentChecked.size === 0) return true;
      return currentChecked.has(node.id);
    });
  }

  // Ensure a ring is closed
  function ensureClosedRing(ring: number[][]): number[][] {
    if (!ring.length) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return ring;
    return [...ring, first];
  }

  // Build ring to render for a node, prioritizing edited GL if selected
  function ringForNode(node: HierarchyNode): number[][] {
    // Use polygon for rendering by default
    let ring = node.polygon ? [...node.polygon] as number[][] : [];
    // If selected and has shape_gl updates, use those coordinates instead
    if (selectedAnnotationRef.current === node.id && (node as any).shape_gl?.coordinates?.[0]) {
      ring = (node as any).shape_gl.coordinates[0] as number[][];
    }
    return ensureClosedRing(ring);
  }

  // Refresh the existing annotations GeoJSON source from current refs (fast, no layer re-creation)
  function refreshAnnotationsSource() {
    if (!map.current) return;
    const source = map.current.getSource('annotations') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const visible = computeVisibleAnnotations();
    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: visible.map(node => ({
        type: 'Feature' as const,
        properties: {
          id: node.id,
          name: node.name,
          level: node.level,
          color: node.color,
          cona: node.cona,
          max_capacity: node.max_capacity,
          taken_capacity: node.taken_capacity
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [ringForNode(node)]
        }
      }))
    };
    source.setData(featureCollection);
  }

  // Optimized refresh for drag performance (uses requestAnimationFrame throttling)
  function refreshSingleAnnotation() {
    if (!map.current) return;
    const source = map.current.getSource('annotations') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    
    // Get current data and update all visible features
    const visible = computeVisibleAnnotations();
    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: visible.map(node => ({
        type: 'Feature' as const,
        properties: {
          id: node.id,
          name: node.name,
          level: node.level,
          color: node.color,
          cona: node.cona,
          max_capacity: node.max_capacity,
          taken_capacity: node.taken_capacity
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [ringForNode(node)]
        }
      }))
    };
    source.setData(featureCollection);
  }

  // Process pending updates using requestAnimationFrame for smooth dragging
  function processPendingUpdate() {
    if (!pendingUpdateRef.current) return;
    
    const update = pendingUpdateRef.current;
    pendingUpdateRef.current = null;
    
    if (update.type === 'position') {
      updateAnnotationPositionImmediate(update.annotationId, update.deltaLng, update.deltaLat);
    } else if (update.type === 'vertex' && update.vertexIndex !== undefined) {
      updateAnnotationVertexImmediate(update.annotationId, update.vertexIndex, update.deltaLng, update.deltaLat);
    }
    
    animationFrameRef.current = null;
  }

  // Immediate update for annotation position (called by requestAnimationFrame)
  function updateAnnotationPositionImmediate(annotationId: string, deltaLng: number, deltaLat: number) {
    const dragData = dragStartRef.current as any;
    if (!dragData?.startRing) return;
    
    const next = allRef.current.map(node => {
      if (node.id !== annotationId) return node;
      const moved = {
        ...node,
        polygon: dragData.startRing.map(([lng, lat]: number[]) => [lng + deltaLng, lat + deltaLat]) as any
      } as HierarchyNode;
      if (dragData.startRingGL) {
        const updatedRing = dragData.startRingGL.map((coord: number[]) => [coord[0] + deltaLng, coord[1] + deltaLat]);
        (moved as any).shape_gl = { type: 'Polygon', coordinates: [updatedRing] };
      }
      return moved;
    });
    allRef.current = next;
    refreshSingleAnnotation();
  }

  // Throttled update for annotation position using requestAnimationFrame
  function updateAnnotationPosition(annotationId: string, deltaLng: number, deltaLat: number) {
    pendingUpdateRef.current = { type: 'position', annotationId, deltaLng, deltaLat };
    
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(processPendingUpdate);
    }
  }


  // Add vertex markers for selected annotation
  function addVertexMarkers(annotationId: string) {
    if (!map.current) return;
    
    const annotation = allRef.current.find(node => node.id === annotationId);
    if (!annotation) return;
    
    // Create vertex markers
    let ring: number[][] = [];
    if ((annotation as any).shape_gl?.coordinates?.[0]) {
      ring = (annotation as any).shape_gl.coordinates[0] as number[][];
    } else if (annotation.polygon) {
      ring = annotation.polygon as number[][];
    }
    ring = ensureClosedRing(ring);
    // Skip duplicated last point if same as first
    const coordsForHandles = (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
      ? ring.slice(0, ring.length - 1)
      : ring;

    const vertices = coordsForHandles.map((coord: number[], index: number) => ({
      type: 'Feature' as const,
      id: `vertex-${annotationId}-${index}`,
      properties: {
        annotationId,
        vertexIndex: index
      },
      geometry: {
        type: 'Point' as const,
        coordinates: coord
      }
    }));

    
    // Add or update vertex source
    if (!map.current.getSource('vertices')) {
      map.current.addSource('vertices', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: vertices
        }
      });
    } else {
      const source = map.current.getSource('vertices') as maplibregl.GeoJSONSource;
      source.setData({
        type: 'FeatureCollection',
        features: vertices
      });
    }
    
    // Add vertex layer if missing
    if (!map.current.getLayer('vertices')) {
      map.current.addLayer({
        id: 'vertices',
        type: 'circle',
        source: 'vertices',
        paint: {
          'circle-radius': 11.2, // 40% larger than original 8
          'circle-color': '#ffff00',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 2
        }
      });
      // Ensure vertices are above annotations
      map.current.moveLayer('vertices');
    }
    
    // Add hover layer for vertices
    if (!map.current.getLayer('vertices-hover')) {
      map.current.addLayer({
        id: 'vertices-hover',
        type: 'circle',
        source: 'vertices',
        paint: {
          'circle-radius': 13.4, // 20% larger than base vertex size
          'circle-color': '#ffd54f', // amber when hovered
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 2
        },
        filter: ['==', ['get', 'id'], ''] // initially no features match
      });
      // Ensure hover vertices are above everything
      map.current.moveLayer('vertices-hover');
    }

  }

  // Remove vertex markers
  function removeVertexMarkers() {
    if (!map.current) return;
    
    if (map.current.getLayer('vertices-hover')) {
      map.current.removeLayer('vertices-hover');
    }
    if (map.current.getLayer('vertices')) {
      map.current.removeLayer('vertices');
    }
    if (map.current.getSource('vertices')) {
      map.current.removeSource('vertices');
    }
  }

  // Immediate update for annotation vertex (called by requestAnimationFrame)
  function updateAnnotationVertexImmediate(annotationId: string, vertexIndex: number, deltaLng: number, deltaLat: number) {
    const dragData = vertexDragStartRef.current as any;
    if (!dragData?.startRing) return;
    
    const next = allRef.current.map(node => {
      if (node.id !== annotationId) return node;
      // Work with starting ring for accuracy
      let ring = [...dragData.startRing] as number[][];
      ring = ensureClosedRing(ring);
      const isClosed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
      const uniqueLen = isClosed ? ring.length - 1 : ring.length;
      
      if (vertexDragModeRef.current === 'free') {
        // FREE MODE: Allow free vertex movement - just move the dragged vertex
        const idx = Math.min(Math.max(vertexIndex, 0), uniqueLen - 1);
        ring[idx] = [ring[idx][0] + deltaLng, ring[idx][1] + deltaLat];
        
        // If closed ring, update the last point to match the first
        if (isClosed) {
          ring[ring.length - 1] = [...ring[0]];
        }
      } else {
        // RECTANGULAR MODE: Maintain rectangular shape while preserving orientation
      if (uniqueLen !== 4) {
        // Fallback: move whole shape by delta if not a rectangle
        const movedRing = ring.map(([x, y], idx) => {
          if (isClosed && idx === ring.length - 1) return [ring[0][0] + deltaLng, ring[0][1] + deltaLat];
          return [x + deltaLng, y + deltaLat];
        });
        const upd = { ...node, polygon: movedRing } as HierarchyNode;
        if (dragData.startRingGL) {
          const movedS = dragData.startRingGL.map((c: number[], idx: number) => {
            if (idx === dragData.startRingGL.length - 1) return [dragData.startRingGL[0][0] + deltaLng, dragData.startRingGL[0][1] + deltaLat];
            return [c[0] + deltaLng, c[1] + deltaLat];
          });
          (upd as any).shape_gl = { type: 'Polygon', coordinates: [movedS] };
        }
        return upd;
      }
      
        // RECTANGULAR MODE: Maintain angles - adjacent vertices move along their opposite edges
        const idx = Math.min(Math.max(vertexIndex, 0), uniqueLen - 1);
        const opp = (idx + 2) % uniqueLen;
        const prev = (idx - 1 + uniqueLen) % uniqueLen;
        const nextIdx = (idx + 1) % uniqueLen;
        
        // Use starting ring to get original edge directions
        let sring = [...(dragData.startRing as number[][])];
        sring = ensureClosedRing(sring);
        
        // Move the dragged vertex
        const moved: [number, number] = [ring[idx][0] + deltaLng, ring[idx][1] + deltaLat];
        ring[idx] = moved;
        
        // Get edge directions from the starting ring (to maintain angles)
        // Edge from opposite to prev
        const oppToPrevDir: [number, number] = [sring[prev][0] - sring[opp][0], sring[prev][1] - sring[opp][1]];
        // Edge from opposite to next
        const oppToNextDir: [number, number] = [sring[nextIdx][0] - sring[opp][0], sring[nextIdx][1] - sring[opp][1]];
        
        // Calculate where prev should be: intersection of line from moved through original prev direction
        // and line from opposite along oppToPrev direction
        const draggedToPrevDir: [number, number] = [sring[prev][0] - sring[idx][0], sring[prev][1] - sring[idx][1]];
        const draggedToNextDir: [number, number] = [sring[nextIdx][0] - sring[idx][0], sring[nextIdx][1] - sring[idx][1]];
        
        // Find intersection: moved + t * draggedToPrevDir = opposite + s * oppToPrevDir
        // Solve for s and t
        const det1 = draggedToPrevDir[0] * oppToPrevDir[1] - draggedToPrevDir[1] * oppToPrevDir[0];
        if (Math.abs(det1) > 1e-10) {
          const dx1 = ring[opp][0] - moved[0];
          const dy1 = ring[opp][1] - moved[1];
          const t1 = (dx1 * oppToPrevDir[1] - dy1 * oppToPrevDir[0]) / det1;
          ring[prev] = [moved[0] + t1 * draggedToPrevDir[0], moved[1] + t1 * draggedToPrevDir[1]];
        }
        
        const det2 = draggedToNextDir[0] * oppToNextDir[1] - draggedToNextDir[1] * oppToNextDir[0];
        if (Math.abs(det2) > 1e-10) {
          const dx2 = ring[opp][0] - moved[0];
          const dy2 = ring[opp][1] - moved[1];
          const t2 = (dx2 * oppToNextDir[1] - dy2 * oppToNextDir[0]) / det2;
          ring[nextIdx] = [moved[0] + t2 * draggedToNextDir[0], moved[1] + t2 * draggedToNextDir[1]];
        }
        
        if (isClosed) {
          ring[ring.length - 1] = [...ring[0]];
        }
      }
      
      const updated = { ...node, polygon: ring } as HierarchyNode;
      
      // Keep shape_gl in sync
      if (dragData.startRingGL) {
        let sgr = [...dragData.startRingGL] as number[][];
        sgr = ensureClosedRing(sgr);
        const sClosed = sgr.length > 1 && sgr[0][0] === sgr[sgr.length - 1][0] && sgr[0][1] === sgr[sgr.length - 1][1];
        const sUnique = sClosed ? sgr.length - 1 : sgr.length;
        
        if (vertexDragModeRef.current === 'free') {
          // FREE MODE: Just move the dragged vertex
          const sIdx = Math.min(Math.max(vertexIndex, 0), sUnique - 1);
          sgr[sIdx] = [sgr[sIdx][0] + deltaLng, sgr[sIdx][1] + deltaLat];
          if (sClosed) {
            sgr[sgr.length - 1] = [...sgr[0]];
          }
        } else {
          // RECTANGULAR MODE: Maintain angles - adjacent vertices move along their opposite edges
          if (sUnique !== 4) {
            const movedS = sgr.map((c: number[], idx: number) => {
              if (idx === sgr.length - 1) return [sgr[0][0] + deltaLng, sgr[0][1] + deltaLat];
              return [c[0] + deltaLng, c[1] + deltaLat];
            });
            (updated as any).shape_gl = { type: 'Polygon', coordinates: [movedS] };
            return updated;
          }
          
          const sIdx = Math.min(Math.max(vertexIndex, 0), sUnique - 1);
          const sOpp = (sIdx + 2) % sUnique;
          const sPrev = (sIdx - 1 + sUnique) % sUnique;
          const sNext = (sIdx + 1) % sUnique;
          
          // Use starting ring to get original edge directions
          let ssring = [...(dragData.startRingGL as number[][])];
          ssring = ensureClosedRing(ssring);
          
          // Move the dragged vertex
          const sMoved: [number, number] = [sgr[sIdx][0] + deltaLng, sgr[sIdx][1] + deltaLat];
          sgr[sIdx] = sMoved;
          
          // Get edge directions from the starting ring (to maintain angles)
          const sOppToPrevDir: [number, number] = [ssring[sPrev][0] - ssring[sOpp][0], ssring[sPrev][1] - ssring[sOpp][1]];
          const sOppToNextDir: [number, number] = [ssring[sNext][0] - ssring[sOpp][0], ssring[sNext][1] - ssring[sOpp][1]];
          const sDraggedToPrevDir: [number, number] = [ssring[sPrev][0] - ssring[sIdx][0], ssring[sPrev][1] - ssring[sIdx][1]];
          const sDraggedToNextDir: [number, number] = [ssring[sNext][0] - ssring[sIdx][0], ssring[sNext][1] - ssring[sIdx][1]];
          
          // Find intersection for prev vertex
          const sDet1 = sDraggedToPrevDir[0] * sOppToPrevDir[1] - sDraggedToPrevDir[1] * sOppToPrevDir[0];
          if (Math.abs(sDet1) > 1e-10) {
            const sDx1 = sgr[sOpp][0] - sMoved[0];
            const sDy1 = sgr[sOpp][1] - sMoved[1];
            const sT1 = (sDx1 * sOppToPrevDir[1] - sDy1 * sOppToPrevDir[0]) / sDet1;
            sgr[sPrev] = [sMoved[0] + sT1 * sDraggedToPrevDir[0], sMoved[1] + sT1 * sDraggedToPrevDir[1]];
          }
          
          // Find intersection for next vertex
          const sDet2 = sDraggedToNextDir[0] * sOppToNextDir[1] - sDraggedToNextDir[1] * sOppToNextDir[0];
          if (Math.abs(sDet2) > 1e-10) {
            const sDx2 = sgr[sOpp][0] - sMoved[0];
            const sDy2 = sgr[sOpp][1] - sMoved[1];
            const sT2 = (sDx2 * sOppToNextDir[1] - sDy2 * sOppToNextDir[0]) / sDet2;
            sgr[sNext] = [sMoved[0] + sT2 * sDraggedToNextDir[0], sMoved[1] + sT2 * sDraggedToNextDir[1]];
          }
          
          if (sClosed) {
            sgr[sgr.length - 1] = [...sgr[0]];
          }
        }
        (updated as any).shape_gl = { type: 'Polygon', coordinates: [sgr] };
      }
      return updated;
    });
    allRef.current = next;
    refreshSingleAnnotation();
  }

  // Throttled update for annotation vertex using requestAnimationFrame
  function updateAnnotationVertex(annotationId: string, vertexIndex: number, deltaLng: number, deltaLat: number) {
    pendingUpdateRef.current = { type: 'vertex', annotationId, deltaLng, deltaLat, vertexIndex };
    
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(processPendingUpdate);
    }
  }

  // ORIGINAL RECTANGLE CONSTRAINT LOGIC (COMMENTED OUT FOR TEMPORARY FREE MOVEMENT)
  // This logic maintained rectangular shapes by moving opposite vertices
  // To restore: replace the simple vertex movement above with this logic
  /*
  function updateAnnotationVertexOriginal(annotationId: string, vertexIndex: number, deltaLng: number, deltaLat: number) {
    const dragData = vertexDragStartRef.current as any;
    if (!dragData?.startRing) return;
    
    const next = allRef.current.map(node => {
      if (node.id !== annotationId) return node;
      let ring = [...dragData.startRing] as number[][];
      ring = ensureClosedRing(ring);
      const isClosed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
      const uniqueLen = isClosed ? ring.length - 1 : ring.length;
      
      if (uniqueLen !== 4) {
        // Fallback: move whole shape by delta if not a rectangle
        const movedRing = ring.map(([x, y], idx) => {
          if (isClosed && idx === ring.length - 1) return [ring[0][0] + deltaLng, ring[0][1] + deltaLat];
          return [x + deltaLng, y + deltaLat];
        });
        const upd = { ...node, polygon: movedRing } as HierarchyNode;
        if (dragData.startRingGL) {
          const movedS = dragData.startRingGL.map((c: number[], idx: number) => {
            if (idx === dragData.startRingGL.length - 1) return [dragData.startRingGL[0][0] + deltaLng, dragData.startRingGL[0][1] + deltaLat];
            return [c[0] + deltaLng, c[1] + deltaLat];
          });
          (upd as any).shape_gl = { type: 'Polygon', coordinates: [movedS] };
        }
        return upd;
      }
      
      const idx = Math.min(Math.max(vertexIndex, 0), uniqueLen - 1);
      const opp = (idx + 2) % uniqueLen;
      const prev = (idx - 1 + uniqueLen) % uniqueLen;
      const nextIdx = (idx + 1) % uniqueLen;
      const moved: [number, number] = [ring[idx][0] + deltaLng, ring[idx][1] + deltaLat];
      const opposite: [number, number] = [ring[opp][0], ring[opp][1]];
      const p1: [number, number] = [opposite[0], moved[1]];
      const p2: [number, number] = [moved[0], opposite[1]];
      const distSq = (a: number[], b: number[]) => (a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]);
      const prevToP1 = distSq(ring[prev], p1);
      const prevToP2 = distSq(ring[prev], p2);
      const useP1ForPrev = prevToP1 <= prevToP2;
      ring[idx] = [moved[0], moved[1]];
      ring[prev] = useP1ForPrev ? [p1[0], p1[1]] : [p2[0], p2[1]];
      ring[nextIdx] = useP1ForPrev ? [p2[0], p2[1]] : [p1[0], p1[1]];
      if (isClosed) {
        ring[ring.length - 1] = [...ring[0]];
      }
      const updated = { ...node, polygon: ring } as HierarchyNode;
      
      if (dragData.startRingGL) {
        let sgr = [...dragData.startRingGL] as number[][];
        sgr = ensureClosedRing(sgr);
        const sClosed = sgr.length > 1 && sgr[0][0] === sgr[sgr.length - 1][0] && sgr[0][1] === sgr[sgr.length - 1][1];
        const sUnique = sClosed ? sgr.length - 1 : sgr.length;
        const sIdx = Math.min(Math.max(vertexIndex, 0), sUnique - 1);
        const sOpp = (sIdx + 2) % sUnique;
        const sPrev = (sIdx - 1 + sUnique) % sUnique;
        const sNext = (sIdx + 1) % sUnique;
        const sMoved: [number, number] = [sgr[sIdx][0] + deltaLng, sgr[sIdx][1] + deltaLat];
        const sOppPt: [number, number] = [sgr[sOpp][0], sgr[sOpp][1]];
        const sP1: [number, number] = [sOppPt[0], sMoved[1]];
        const sP2: [number, number] = [sMoved[0], sOppPt[1]];
        const sPrevToP1 = distSq(sgr[sPrev], sP1);
        const sPrevToP2 = distSq(sgr[sPrev], sP2);
        const sUseP1ForPrev = sPrevToP1 <= sPrevToP2;
        sgr[sIdx] = [sMoved[0], sMoved[1]];
        sgr[sPrev] = sUseP1ForPrev ? [sP1[0], sP1[1]] : [sP2[0], sP2[1]];
        sgr[sNext] = sUseP1ForPrev ? [sP2[0], sP2[1]] : [sP1[0], sP1[1]];
        if (sClosed) {
          sgr[sgr.length - 1] = [...sgr[0]];
        }
        (updated as any).shape_gl = { type: 'Polygon', coordinates: [sgr] };
      }
      return updated;
    });
    allRef.current = next;
    refreshAnnotationsSource();
  }
  */


  // Update annotation in database
  async function updateAnnotationInDatabase(annotationId: string) {
    try {
      const annotation = allRef.current.find(node => node.id === annotationId);
      if (!annotation) {
        console.error('Annotation not found:', annotationId);
        return;
      }

      // Extract remote ID from annotation ID (format: backend_123)
      const remoteId = annotation.remoteId;
      if (!remoteId) {
        console.error('No remote ID found for annotation:', annotationId);
        return;
      }

      // Get current polygon coordinates
      let coordinates: number[][];
      if ((annotation as any).shape_gl?.coordinates?.[0]) {
        coordinates = (annotation as any).shape_gl.coordinates[0];
      } else if (annotation.polygon) {
        coordinates = annotation.polygon;
      } else {
        console.error('No coordinates found for annotation:', annotationId);
        return;
      }

      // Calculate x_coord and y_coord from first point
      const xCoord = coordinates[0][0];
      const yCoord = coordinates[0][1];

      // Prepare update payload
      const updatePayload = {
        coordinates: coordinates,
        x_coord: xCoord,
        y_coord: yCoord
      };

      console.log('Updating annotation in database:', {
        id: remoteId,
        coordinates: coordinates.length,
        x_coord: xCoord,
        y_coord: yCoord
      });

      // Send PATCH request to update the feature
      const response = await fetch(`${API_BASE}/features/${remoteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedFeature = await response.json();
      console.log('Successfully updated annotation in database:', updatedFeature);
      
    } catch (error) {
      console.error('Failed to update annotation in database:', error);
    }
  }

  // Update annotation max_capacity in database
  async function updateAnnotationCapacity(annotationId: string, newCapacity: number) {
    try {
      const annotation = allRef.current.find(node => node.id === annotationId);
      if (!annotation) {
        console.error('Annotation not found:', annotationId);
        return;
      }

      const remoteId = annotation.remoteId;
      if (!remoteId) {
        console.error('No remote ID found for annotation:', annotationId);
        return;
      }

      // Update local state immediately for responsive UI
      const updatedAnnotations = allRef.current.map(node => 
        node.id === annotationId ? { ...node, max_capacity: newCapacity } : node
      );
      allRef.current = updatedAnnotations;
      setAll([...updatedAnnotations]);
      refreshAnnotationsSource();

      // Send PATCH request to update the feature
      const response = await fetch(`${API_BASE}/features/${remoteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ max_capacity: newCapacity })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Successfully updated max_capacity to:', newCapacity);
      
    } catch (error) {
      console.error('Failed to update max_capacity:', error);
    }
  }


  // Load annotations from backend using GL coordinates
  async function loadAnnotations(): Promise<HierarchyNode[]> {
    try {
      console.log('Loading annotations from:', `${API_BASE}/features/geojson`);
      const response = await fetch(`${API_BASE}/features/geojson`);
      console.log('Response status:', response.status);
      const geojsonData = await response.json();
      
      // Handle GeoJSON FeatureCollection format
      const features = geojsonData.features || geojsonData;
      console.log('Loaded features from backend:', features.length);
      
      const nodes: HierarchyNode[] = [];
      const nodeMap = new Map<number, HierarchyNode>();
      
      // First pass: create all nodes using GeoJSON geometry
      const offending: number[] = [];
      for (const feature of features) {
        // Extract geometry from GeoJSON feature
        let polygon: [number, number][] = [];
        
        if (feature.geometry && feature.geometry.coordinates) {
          if (feature.geometry.type === 'Polygon') {
            // Take the first ring (exterior ring) of the polygon
            polygon = feature.geometry.coordinates[0].map((coord: number[]) => [coord[0], coord[1]]);
          } else if (feature.geometry.type === 'MultiPolygon') {
            // Take the first polygon's first ring
            polygon = feature.geometry.coordinates[0][0].map((coord: number[]) => [coord[0], coord[1]]);
          }
        }
        
        if (polygon.length < 3) {
          console.error('Invalid polygon for feature', feature.properties.id, polygon);
          offending.push(feature.properties.id);
          continue;
        }
        
        const node: HierarchyNode = {
          id: `backend_${feature.properties.id}`,
          remoteId: feature.properties.id,
          name: feature.properties.name,
          level: feature.properties.level as Level,
          color: feature.properties.color || colorByLevel(feature.properties.level as Level),
          polygon: polygon,
          children: [],
          parentLocalId: feature.properties.parent_id ? `backend_${feature.properties.parent_id}` : undefined,
          cona: feature.properties.cona,
          max_capacity: feature.properties.max_capacity,
          taken_capacity: feature.properties.taken_capacity,
          // Store the GeoJSON geometry for MapLibre GL
          shape_gl: feature.geometry,
          x_coord_gl: feature.properties.x_coord,
          y_coord_gl: feature.properties.y_coord,
        };
        nodeMap.set(feature.properties.id, node);
      }

      if (offending.length > 0) {
        console.error(`Missing shape_gl for ${offending.length} features. Example IDs: ${offending.slice(0, 10).join(', ')}`);
        throw new Error(`Missing shape_gl for ${offending.length} features`);
      }
      
      // Second pass: build hierarchy
      for (const feature of features) {
        const node = nodeMap.get(feature.properties.id);
        if (!node) continue;
        
        if (feature.properties.parent_id) {
          const parent = nodeMap.get(feature.properties.parent_id);
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
        if (node.color) continue;
        const parent = allNodes.find(p => p.children?.some(c => c.id === node.id));
        if (parent?.color) {
          node.color = darkenColor(parent.color, 0.8);
        }
      }
      
      return allNodes;
    } catch (error) {
      console.error('Failed to load annotations:', error);
      return [];
    }
  }

  // Load factory layout from tileserver
  function loadFactoryLayout(): Promise<any> {
    return new Promise((resolve) => {
      console.log('Loading factory layout from tileserver...');
      
      if (map.current && map.current.isStyleLoaded()) {
        addFactoryTiles();
        resolve({ data: null, bbox: null });
      } else if (map.current) {
        // Wait for map to be ready
        map.current.on('load', () => {
          addFactoryTiles();
          resolve({ data: null, bbox: null });
        });
      } else {
        resolve({ data: null, bbox: null });
      }
    });
  }

  function addFactoryTiles() {
    if (map.current && !map.current.getSource('factory-tiles')) {
      try {
        map.current.addSource('factory-tiles', {
          type: 'vector',
          tiles: ['http://localhost:7999/data/LTH_factory/{z}/{x}/{y}.pbf']
        });
        
        map.current.addLayer({
          id: 'factory-tiles-lines',
          type: 'line',
          source: 'factory-tiles',
          //'source-layer': 'LTH_simple_bigndjson',
          'source-layer': 'factory',
          minzoom: 0,
          maxzoom: 16,
          paint: {
            'line-color': '#ffffff',  // White
            'line-width': 1,  // Much thinner
            'line-opacity': 0.4  // 40% transparent
          },
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': 'visible'
          }
        });
        
        console.log('Factory tiles added to map');
        console.log('Map layers:', map.current.getStyle().layers.map(l => l.id));
        console.log('Map sources:', Object.keys(map.current.getStyle().sources));
        
        // Add event listener to detect when tiles are loaded
        map.current.on('sourcedata', (e) => {
          if (e.sourceId === 'factory-tiles' && e.isSourceLoaded) {
            console.log('Factory tiles source loaded successfully');
            // Check if layer is visible
            if (map.current) {
              const layer = map.current.getLayer('factory-tiles-lines');
              if (layer) {
                console.log('Factory layer found:', layer);
                console.log('Layer visibility:', map.current.getLayoutProperty('factory-tiles-lines', 'visibility'));
              }
            }
          }
        });
        
        // Also check layer after a short delay
        setTimeout(() => {
          if (map.current) {
            const layer = map.current.getLayer('factory-tiles-lines');
            console.log('Factory layer after timeout:', layer);
            if (layer) {
              console.log('Layer paint properties:', map.current.getPaintProperty('factory-tiles-lines', 'line-color'));
              console.log('Layer source:', map.current.getSource('factory-tiles'));
            }
          }
        }, 2000);
      } catch (error) {
        console.error('Failed to add factory tiles:', error);
      }
    }
  }

  // Initialize map
  useEffect(() => {
    if (mapContainer.current && !map.current) {
        map.current = new maplibregl.Map({
          container: mapContainer.current,
          style: {
            version: 8,
            sources: {},
            layers: [],
            glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
          },
          center: [14.476, 46.085], // Center on factory location (Litostrojska cesta 46, Ljubljana)
          zoom: 16, // Zoom level to show factory details
          bearing: 0, // No map rotation
          pitch: 0, // Orthographic projection - no perspective skewness
         // projection: 'mercator' // Use Web Mercator projection for consistency
        });

      map.current.on('load', () => {
        console.log('Map loaded');
        
        // Add factory tiles when map is ready
        addFactoryTiles();
        
        // Initialize drawing controls (temporarily disabled due to style errors)
        // drawRef.current = new MapboxDraw({
        //   displayControlsDefault: false,
        //   controls: {
        //     polygon: true,
        //     trash: true
        //   },
        //   defaultMode: 'draw_polygon'
        // });
        
        // map.current!.addControl(drawRef.current);
        
        // Handle annotation selection and editing
        map.current!.on('click', 'annotations-fill', (e) => {
          e.originalEvent.stopPropagation();
          try { (e.originalEvent as any)?.preventDefault?.(); } catch {}
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const annotationId = feature.properties?.id;
            if (annotationId) {
              setSelectedAnnotation(annotationId);
              addVertexMarkers(annotationId);
              console.log('Selected annotation:', annotationId);
            }
          }
        });

        // Handle double-click to open edit modal
        map.current!.on('dblclick', 'annotations-fill', (e) => {
          e.originalEvent.stopPropagation();
          try { (e.originalEvent as any)?.preventDefault?.(); } catch {}
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const annotationId = feature.properties?.id;
            if (annotationId) {
              const annotation = allRef.current.find(node => node.id === annotationId);
              if (annotation) {
                setEditModalAnnotation(annotation);
                console.log('Opening edit modal for annotation:', annotationId);
              }
            }
          }
        });

        // Handle vertex selection and dragging
        map.current!.on('click', 'vertices', (e) => {
          e.originalEvent.stopPropagation();
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const annotationId = feature.properties?.annotationId;
            const vertexIndex = feature.properties?.vertexIndex;
            if (annotationId !== undefined && vertexIndex !== undefined) {
              draggedVertexIndexRef.current = vertexIndex;
              console.log('Selected vertex:', vertexIndex, 'for annotation:', annotationId);
            }
          }
        });

        // Handle vertex mouse down for dragging
        map.current!.on('mousedown', 'vertices', (e) => {
          // prevent map from panning while dragging a vertex
          try { e.preventDefault?.(); } catch {}
          try { (e.originalEvent as any)?.preventDefault?.(); } catch {}
          try { (e.originalEvent as any)?.stopPropagation?.(); } catch {}
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const annotationId = feature.properties?.annotationId;
            const vertexIndex = feature.properties?.vertexIndex;
            if (annotationId !== undefined && vertexIndex !== undefined) {
              setIsDraggingVertex(true);
              draggedVertexIndexRef.current = vertexIndex;
              setSelectedAnnotation(annotationId);
              selectedAnnotationRef.current = annotationId;
              vertexDragStartRef.current = { x: e.point.x, y: e.point.y };
              // Store initial position for accurate delta calculations
              const startLngLat = map.current!.unproject([e.point.x, e.point.y]);
              (vertexDragStartRef.current as any).lngLat = [startLngLat.lng, startLngLat.lat];
              // Capture starting ring for selected annotation
              const ann = allRef.current.find(n => n.id === annotationId);
              if (ann) {
                (vertexDragStartRef.current as any).startRing = ann.polygon ? [...ann.polygon] : [];
                const sg: any = (ann as any).shape_gl;
                if (sg?.coordinates?.[0]) {
                  (vertexDragStartRef.current as any).startRingGL = [...sg.coordinates[0]];
                }
              }
              map.current!.getCanvas().style.cursor = 'grabbing';
              try { map.current!.dragPan.disable(); } catch {}
            }
          }
        });


        // Deselect when clicking on empty space
        map.current!.on('click', (_e) => {
          if (selectedAnnotation) {
            setSelectedAnnotation(null);
            removeVertexMarkers();
            console.log('Deselected annotation');
          }
        });

        // Handle mouse down for dragging on annotation body
        map.current!.on('mousedown', 'annotations-fill', (e) => {
          // prevent map from panning while dragging an annotation body
          try { e.preventDefault?.(); } catch {}
          try { (e.originalEvent as any)?.preventDefault?.(); } catch {}
          try { (e.originalEvent as any)?.stopPropagation?.(); } catch {}
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const annotationId = feature.properties?.id;
            if (annotationId) {
              setSelectedAnnotation(annotationId);
              selectedAnnotationRef.current = annotationId;
              setIsDragging(true);
              dragStartRef.current = { x: e.point.x, y: e.point.y };
              // Store initial position for accurate delta calculations
              const startLngLat = map.current!.unproject([e.point.x, e.point.y]);
              (dragStartRef.current as any).lngLat = [startLngLat.lng, startLngLat.lat];
              // Capture starting ring for selected annotation
              const ann = allRef.current.find(n => n.id === annotationId);
              if (ann) {
                (dragStartRef.current as any).startRing = ann.polygon ? [...ann.polygon] : [];
                const sg: any = (ann as any).shape_gl;
                if (sg?.coordinates?.[0]) {
                  (dragStartRef.current as any).startRingGL = [...sg.coordinates[0]];
                }
              }
              // Remove vertices when starting to drag annotation
              removeVertexMarkers();
              map.current!.getCanvas().style.cursor = 'grabbing';
              try { map.current!.dragPan.disable(); } catch {}
            }
          }
        });

        // Handle mouse move for dragging
        map.current!.on('mousemove', (e) => {
          if (dragStartRef.current && selectedAnnotationRef.current) {
            // Mark that dragging has occurred
            hasDraggedRef.current = true;
            
            // Use lng/lat delta for accurate drag that matches cursor movement
            const startLngLat = (dragStartRef.current as any).lngLat as [number, number];
            const currLngLat = map.current!.unproject([e.point.x, e.point.y]);
            const deltaLng = currLngLat.lng - startLngLat[0];
            const deltaLat = currLngLat.lat - startLngLat[1];
            updateAnnotationPosition(selectedAnnotationRef.current, deltaLng, deltaLat);
            dragStartRef.current.x = e.point.x;
            dragStartRef.current.y = e.point.y;
          } else if (vertexDragStartRef.current && selectedAnnotationRef.current !== null && draggedVertexIndexRef.current !== null) {
            // Mark that vertex dragging has occurred
            hasVertexDraggedRef.current = true;
            
            // Use lng/lat delta for accurate drag that matches cursor movement
            const startLngLat = (vertexDragStartRef.current as any).lngLat as [number, number];
            const currLngLat = map.current!.unproject([e.point.x, e.point.y]);
            const deltaLng = currLngLat.lng - startLngLat[0];
            const deltaLat = currLngLat.lat - startLngLat[1];
            updateAnnotationVertex(selectedAnnotationRef.current, draggedVertexIndexRef.current, deltaLng, deltaLat);
            vertexDragStartRef.current.x = e.point.x;
            vertexDragStartRef.current.y = e.point.y;
          }
        });

        // Handle mouse up to stop dragging
        map.current!.on('mouseup', async () => {
          // Cancel any pending animation frames
          if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          pendingUpdateRef.current = null;
          
          if (dragStartRef.current) {
            const annotationId = selectedAnnotationRef.current;
            const wasDragging = hasDraggedRef.current;
            
            dragStartRef.current = null;
            setIsDragging(false);
            hasDraggedRef.current = false;
            
            // Commit ref changes to state
            setAll(allRef.current);
            // Force refresh to ensure visibility respects current filters
            refreshAnnotationsSource();
            map.current!.getCanvas().style.cursor = 'grab';
            try { map.current!.dragPan.enable(); } catch {}
            
            // Update annotation in database ONLY if actual dragging occurred
            if (annotationId && wasDragging) {
              console.log('Updating annotation in database after drag');
              await updateAnnotationInDatabase(annotationId);
            }
          }
          if (vertexDragStartRef.current) {
            const annotationId = selectedAnnotationRef.current;
            const wasVertexDragging = hasVertexDraggedRef.current;
            
            vertexDragStartRef.current = null;
            draggedVertexIndexRef.current = null;
            setIsDraggingVertex(false);
            hasVertexDraggedRef.current = false;
            
            // Commit ref changes to state
            setAll(allRef.current);
            // Force refresh to ensure visibility respects current filters
            refreshAnnotationsSource();
            map.current!.getCanvas().style.cursor = 'grab';
            try { map.current!.dragPan.enable(); } catch {}
            if (selectedAnnotationRef.current) addVertexMarkers(selectedAnnotationRef.current);
            
            // Update annotation in database ONLY if actual vertex dragging occurred
            if (annotationId && wasVertexDragging) {
              console.log('Updating annotation in database after vertex drag');
              await updateAnnotationInDatabase(annotationId);
            }
          }
        });

        // Change cursor on hover
        map.current!.on('mouseenter', 'annotations-fill', () => {
          map.current!.getCanvas().style.cursor = 'grab';
        });

        map.current!.on('mouseleave', 'annotations-fill', () => {
          if (!isDragging && !isDraggingVertex) {
            map.current!.getCanvas().style.cursor = '';
          }
        });

        // Change cursor on vertex hover
        map.current!.on('mouseenter', 'vertices', (e) => {
          map.current!.getCanvas().style.cursor = 'grab';
          if (e.features && e.features.length > 0) {
            const f = e.features[0];
            map.current!.setFilter('vertices-hover', ['==', ['get', 'id'], f.id as string]);
          }
        });

        map.current!.on('mouseleave', 'vertices', () => {
          if (!isDraggingVertex) {
            map.current!.getCanvas().style.cursor = '';
          }
          map.current!.setFilter('vertices-hover', ['==', ['get', 'id'], '']);
        });

      });
    }

    return () => {
      // Cancel any pending animation frames
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Load data and setup map
  useEffect(() => {
    const setupMap = async () => {
      const [annotations] = await Promise.all([
        loadAnnotations(),
        loadFactoryLayout()
      ]);

      setAll(annotations);
      setDoc({ origin: [0, 0], units: 'm', nodes: annotations.filter(n => !n.parentLocalId) });

      if (map.current) {
        // Factory layout is now loaded via tileserver, no need for JSON loading
        if (!factoryLoaded) {
          setFactoryLoaded(true);
          console.log('Factory layout tileserver ready');
          
          // Set initial view to factory layout center (matching "Reset View" functionality)
          const factoryBounds: [number, number, number, number] = [5.246049, 43.261091, 11.329715, 47.162805];
          try { 
            map.current.fitBounds(factoryBounds, { padding: 50 }); 
            console.log('Initial view set to factory layout center');
          } catch (e) {
            console.log('Could not set initial view:', e);
          }
        }
      }
    };

    setupMap();
  }, []);

  // Removed automatic post-load fit to avoid camera jumps

  // Update annotations on map when display level changes or rotation is applied
  useEffect(() => {
    if (!map.current || all.length === 0) return;

    // Remove existing annotation layers
    if (map.current.getLayer('annotations-fill')) {
      map.current.removeLayer('annotations-fill');
    }
    if (map.current.getLayer('annotations-outline')) {
      map.current.removeLayer('annotations-outline');
    }
    if (map.current.getLayer('annotations-labels')) {
      map.current.removeLayer('annotations-labels');
    }
    if (map.current.getSource('annotations')) {
      map.current.removeSource('annotations');
    }

    // Use the new checkbox-based visibility system
    const visibleAnnotations = computeVisibleAnnotations();

    console.log('Visible annotations:', visibleAnnotations.length);

    if (visibleAnnotations.length > 0) {
      // Create GeoJSON for annotations (ensure closed rings)
      const annotationGeoJSON: any = {
        type: 'FeatureCollection',
        features: visibleAnnotations.map(node => {
          const ring = [...node.polygon];
          if (
            ring.length > 0 &&
            (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
          ) {
            ring.push(ring[0]);
          }
          return {
            type: 'Feature',
            properties: {
              id: node.id,
              name: node.name,
              level: node.level,
              color: node.color,
              cona: node.cona,
              max_capacity: node.max_capacity,
              taken_capacity: node.taken_capacity
            },
            geometry: {
              type: 'Polygon',
              coordinates: [ring]
            }
          };
        })
      };

      // Add annotations to map
      map.current.addSource('annotations', {
        type: 'geojson',
        data: annotationGeoJSON
      });

        // Add fill layer (on top of factory)
        map.current.addLayer({
          id: 'annotations-fill',
          type: 'fill',
          source: 'annotations',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'id'], selectedAnnotation || ''],
              '#ffff00', // Yellow for selected
              ['get', 'color'] // Original color for unselected
            ],
            'fill-opacity': [
              'case',
              ['==', ['get', 'id'], selectedAnnotation || ''],
              0.9, // More opaque for selected
              0.8
            ]
          }
        });

        // Add outline layer (on top of factory)
        map.current.addLayer({
          id: 'annotations-outline',
          type: 'line',
          source: 'annotations',
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'id'], selectedAnnotation || ''],
              '#000000', // Black outline for selected
              ['get', 'color']
            ],
            'line-width': [
              'case',
              ['==', ['get', 'id'], selectedAnnotation || ''],
              4, // Thicker outline for selected
              3
            ]
          }
        });

      // Add text labels with capacity information
      map.current.addLayer({
        id: 'annotations-labels',
        type: 'symbol',
        source: 'annotations',
        layout: {
            'text-field': [
              'concat',
              ['get', 'name'],
              '\n',
              ['to-string', ['get', 'taken_capacity']],
              ' / ',
              ['to-string', ['get', 'max_capacity']]
            ],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 12,
            'text-anchor': 'center',
            'text-offset': [0, 0],
            'text-line-height': 1.2
        },
        paint: {
          'text-color': '#000',
          'text-halo-color': '#fff',
          'text-halo-width': 1.5
        }
      });

      // Ensure annotation layers are on top
      try {
        map.current.moveLayer('annotations-fill');
        map.current.moveLayer('annotations-outline');
        map.current.moveLayer('annotations-labels');
        
        // Ensure vertex and edge layers are always on top
        if (map.current.getLayer('vertices')) {
          map.current.moveLayer('vertices');
        }
        if (map.current.getLayer('vertices-hover')) {
          map.current.moveLayer('vertices-hover');
        }
      } catch (e) {
        // ignore if moveLayer fails
      }

      // Add click handler for annotations
      map.current.on('click', 'annotations-fill', (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          console.log('Clicked annotation:', feature.properties);
        }
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'annotations-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'annotations-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    }
  }, [checkedNodes, displayLevel, factoryLoaded]);

  // Update map layers when selection changes
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      // Update the paint properties to reflect selection
      map.current.setPaintProperty('annotations-fill', 'fill-color', [
        'case',
        ['==', ['get', 'id'], selectedAnnotation || ''],
        '#ffff00',
        ['get', 'color']
      ]);
      
      map.current.setPaintProperty('annotations-fill', 'fill-opacity', [
        'case',
        ['==', ['get', 'id'], selectedAnnotation || ''],
        0.9,
        0.8
      ]);
      
      map.current.setPaintProperty('annotations-outline', 'line-color', [
        'case',
        ['==', ['get', 'id'], selectedAnnotation || ''],
        '#000000',
        ['get', 'color']
      ]);
      
      map.current.setPaintProperty('annotations-outline', 'line-width', [
        'case',
        ['==', ['get', 'id'], selectedAnnotation || ''],
        4,
        3
      ]);
    }
  }, [selectedAnnotation]);

  const handleSelect = (nodeId: string) => {
    // Tree selection no longer affects visibility - only used for navigation/selection
    console.log('Selected node:', nodeId);
  };

  // Bring checked annotations into the current camera view with optimal scaling
  const bringCheckedIntoView = async () => {
    if (!map.current) return;
    
    // Get current map bounds
    const bounds = map.current.getBounds();
    if (!bounds) return;
    
    const viewBounds = {
      west: bounds.getWest(),
      east: bounds.getEast(),
      south: bounds.getSouth(),
      north: bounds.getNorth()
    };
    
    console.log('Current view bounds:', viewBounds);
    
    // Get all checked annotations filtered by current display level
    const targetLevel = displayLevelRef.current;
    const checkedAnnotationsAll = allRef.current.filter(node => checkedNodes.has(node.id));
    const checkedAnnotations = checkedAnnotationsAll.filter(node => node.level === targetLevel);
    
    if (checkedAnnotations.length === 0) {
      alert(`No annotations at level "${targetLevel}" are checked. Please check some annotations first.`);
      return;
    }
    
    console.log(`Fitting ${checkedAnnotations.length} checked annotations at level ${targetLevel} (from ${checkedAnnotationsAll.length} total checked)`);
    
    // Calculate reference orientation and aspect from the hardcoded reference polygon
    const referenceOrientation = calculateReferenceOrientation();
    const referenceAspect = calculateReferenceAspectRatio();
    
    // Use pixel-space layout based on current zoom so polygons fill the viewport visually
    const containerEl = map.current.getContainer() as HTMLElement;
    const viewportWidthPx = containerEl.clientWidth;
    const viewportHeightPx = containerEl.clientHeight;
    
    console.log('=== VIEWPORT INFO ===');
    console.log(`Viewport size: ${viewportWidthPx}px x ${viewportHeightPx}px`);
    console.log(`Geographic bounds:`, viewBounds);
    console.log(`Current zoom: ${map.current.getZoom()}`);
    
    // Layout: 5 annotations per row, multiple rows; each row fills viewport width
    const perRow = 5;
    const total = checkedAnnotations.length;
    const rows = Math.max(1, Math.ceil(total / perRow));
    const rowHeightPx = viewportHeightPx / rows;
    console.log(`\n=== LAYOUT ===`);
    console.log(`Rows: ${rows}, perRow: ${perRow}, rowHeightPx: ${rowHeightPx.toFixed(2)}px`);
    
    // Reposition and rescale each checked annotation to fill their allocated space completely
    const updatedAnnotations = allRef.current.map(node => {
      if (!checkedNodes.has(node.id)) return node;
      
      const index = checkedAnnotations.findIndex(a => a.id === node.id);
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      // Determine how many items are in this row (last row can be shorter)
      const itemsInThisRow = Math.min(perRow, total - row * perRow);
      
      // Compute cell size for this row and center in pixel coordinates
      const cellWidthPx = viewportWidthPx / itemsInThisRow;
      const cellHeightPx = rowHeightPx;
      const centerXPx = col * cellWidthPx + cellWidthPx / 2;
      const centerYPx = row * rowHeightPx + rowHeightPx / 2;
      
      // Compute rectangle size in pixels to preserve reference aspect and fill height if possible
      let rectHeightPx = cellHeightPx;
      let rectWidthPx = rectHeightPx * referenceAspect;
      if (rectWidthPx > cellWidthPx) {
        rectWidthPx = cellWidthPx;
        rectHeightPx = rectWidthPx / referenceAspect;
      }
      
      if (index === 0) {
        console.log(`\n=== FIRST ANNOTATION (${node.name}) ===`);
        console.log(`Cell center: (${centerXPx.toFixed(2)}px, ${centerYPx.toFixed(2)}px)`);
        console.log(`Rectangle size: ${rectWidthPx.toFixed(2)}px x ${rectHeightPx.toFixed(2)}px`);
        console.log(`Reference aspect: ${referenceAspect.toFixed(4)}`);
        console.log(`Reference orientation: ${(referenceOrientation * 180 / Math.PI).toFixed(2)}°`);
      }
      
      // Build rectangle in pixel space, rotate by reference orientation, then unproject to lng/lat
      const halfW = rectWidthPx / 2;
      const halfH = rectHeightPx / 2;
      const localPx: [number, number][] = [
        [-halfW, -halfH],
        [ halfW, -halfH],
        [ halfW,  halfH],
        [-halfW,  halfH]
      ];
      const cos = Math.cos(referenceOrientation);
      const sin = Math.sin(referenceOrientation);
      const rotatePx = (x: number, y: number): [number, number] => {
        // Pixel Y grows down; convert to math coords (Y up), rotate, then convert back
        const yUp = -y;
        const xr = x * cos - yUp * sin;
        const yrUp = x * sin + yUp * cos;
        const yr = -yrUp;
        return [xr, yr];
      };
      const ringLngLat: [number, number][] = localPx.map(([x, y]) => {
        const [rx, ry] = rotatePx(x, y);
        const px = centerXPx + rx;
        const py = centerYPx + ry;
        const ll = map.current!.unproject([px, py]);
        return [ll.lng, ll.lat];
      });
      // close ring
      ringLngLat.push(ringLngLat[0]);
      const normalizedPolygon = ringLngLat as [number, number][];
      
      if (index === 0) {
        console.log(`\n=== UNPROJECTED COORDINATES ===`);
        console.log(`First vertex pixel: (${(centerXPx - halfW).toFixed(2)}px, ${(centerYPx - halfH).toFixed(2)}px)`);
        console.log(`First vertex lng/lat:`, normalizedPolygon[0]);
        console.log(`Second vertex lng/lat:`, normalizedPolygon[1]);
        console.log(`Polygon width in degrees: ${(normalizedPolygon[1][0] - normalizedPolygon[0][0]).toFixed(6)}`);
        console.log(`Polygon height in degrees: ${(normalizedPolygon[2][1] - normalizedPolygon[1][1]).toFixed(6)}`);
      }
      
      // Update both polygon and shape_gl
      const updatedNode = {
        ...node,
        polygon: normalizedPolygon
      };
      
      // Update shape_gl if it exists
      if ((node as any).shape_gl) {
        (updatedNode as any).shape_gl = {
          type: 'Polygon',
          coordinates: [normalizedPolygon]
        };
      }
      
      return updatedNode;
    });
    
    // Update the state and refs
    allRef.current = updatedAnnotations;
    setAll([...updatedAnnotations]);
    
    // Update the map source to reflect the new positions
    refreshAnnotationsSource();
    
    // Fit the map to show all the placed annotations (use the original viewport bounds)
    const finalBounds: [number, number, number, number] = [
      viewBounds.west,
      viewBounds.south,
      viewBounds.east,
      viewBounds.north
    ];
    
    try {
      map.current.fitBounds(finalBounds, { padding: 0, animate: false });
      console.log('Fitted map to annotation bounds');
    } catch (e) {
      console.error('Failed to fit bounds:', e);
    }
    
    console.log(`Annotations repositioned into view. Rows: ${rows}, perRow: 5, viewport: ${viewportWidthPx}x${viewportHeightPx}px`);

    // Bulk update moved annotations to backend in a single transaction
    try {
      const targetLevel = displayLevelRef.current;
      console.log(`Bulk updating ${checkedAnnotations.length} annotations at level ${targetLevel}...`);
      
      // Prepare bulk update payload
      const updates = checkedAnnotations.map(node => {
        const annotation = allRef.current.find(a => a.id === node.id);
        if (!annotation) return null;
        
        let coordinates: number[][];
        if ((annotation as any).shape_gl?.coordinates?.[0]) {
          coordinates = (annotation as any).shape_gl.coordinates[0];
        } else if (annotation.polygon) {
          coordinates = annotation.polygon;
        } else {
          return null;
        }
        
        return {
          id: annotation.remoteId,
          coordinates: coordinates,
          x_coord: coordinates[0][0],
          y_coord: coordinates[0][1]
        };
      }).filter(item => item !== null);
      
      if (updates.length === 0) {
        console.warn('No valid annotations to update');
        return;
      }
      
      const response = await fetch(`${API_BASE}/features/bulk_update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: updates })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`Bulk update finished: ${result.updated_count} updated, ${result.failed_ids.length} failed`);
      if (result.failed_ids.length > 0) {
        console.warn('Failed IDs:', result.failed_ids);
      }
    } catch (err) {
      console.error('Bulk update failed:', err);
    }
  };


  const btn = {
    background: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Hierarchy Navigator */}
      <div style={{ width: '300px', borderRight: '1px solid #ccc', padding: '10px' }}>
        <h3>Factory Hierarchy</h3>
        <button 
          style={{ ...btn, marginBottom: '10px' }} 
          onClick={() => setShowHierarchy(!showHierarchy)}
        >
          {showHierarchy ? 'Hide Hierarchy' : 'Show Hierarchy'}
        </button>
        {showHierarchy && (
          <HierarchyNavigator
            doc={doc}
            onSelect={handleSelect}
            checkedNodes={checkedNodes}
            onNodeCheck={handleNodeCheck}
            displayLevel={displayLevel}
            onDisplayLevelChange={handleDisplayLevelChange}
          />
        )}
      </div>

      {/* Map Container */}
      <div 
        ref={mapContainer} 
        style={{ 
          flex: 1, 
          height: '100%',
          position: 'relative'
        }} 
      />
      

      {/* View Controls */}
      <div style={{ position: 'absolute', left: '320px', top: '10px', zIndex: 1000, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          style={btn}
          onClick={() => {
            if (!map.current) return;
            // Center on factory layout bounds (derived from reference polygon and annotations)
            // Factory layout bounds: approximately [5.25, 43.26, 11.33, 47.16]
            const factoryBounds: [number, number, number, number] = [5.246049, 43.261091, 11.329715, 47.162805];
            try { 
              map.current.fitBounds(factoryBounds, { padding: 50 });
              console.log('Reset view to factory layout center');
            } catch (e) {
              console.error('Failed to reset view:', e);
            }
          }}
        >
          Reset View
        </button>
        
        <button
          style={{ ...btn, backgroundColor: '#10B981' }}
          onClick={bringCheckedIntoView}
        >
          Bring Selected into View
        </button>
        
        <button
          style={{ 
            ...btn, 
            backgroundColor: vertexDragMode === 'free' ? '#EF4444' : '#10B981',
            fontWeight: 'bold'
          }}
          onClick={() => {
            const newMode = vertexDragMode === 'free' ? 'rectangular' : 'free';
            setVertexDragMode(newMode);
            console.log(`Vertex drag mode switched to: ${newMode}`);
          }}
        >
          {vertexDragMode === 'free' ? 'Free Vertex Drag' : 'Rectangular Drag'}
        </button>
      </div>

      {/* Edit Modal */}
      {editModalAnnotation && (
        <AnnotationEditModal
          annotationName={editModalAnnotation.name}
          maxCapacity={editModalAnnotation.max_capacity}
          onClose={() => setEditModalAnnotation(null)}
          onUpdateCapacity={(newCapacity) => {
            updateAnnotationCapacity(editModalAnnotation.id, newCapacity);
          }}
        />
      )}
    </div>
  );
}

// Helper functions
function colorByLevel(level: Level): string {
  switch (level) {
    case 'polje': return '#3B82F6';
    case 'subzone': return '#10B981';
    case 'vrsta': return '#F59E0B';
    case 'globina': return '#EF4444';
    default: return '#6B7280';
  }
}

function darkenColor(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = Math.floor(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.floor(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.floor(parseInt(h.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function flatten(nodes: HierarchyNode[]): HierarchyNode[] {
  const result: HierarchyNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      result.push(...flatten(node.children));
    }
  }
  return result;
}