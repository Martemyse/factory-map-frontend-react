import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
// @ts-ignore - No types available for mapbox-gl-draw
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import HierarchyNavigator from '../components/Hierarchy/HierarchyNavigator';
import type { HierarchyNode, Level } from '../model/types';
import { config } from '../config';

const API_BASE = config.API_BASE;

// Helper functions
function calculateAnnotationBounds(_annotations: HierarchyNode[]): [number, number, number, number] | null {
  const coords: number[][] = [];
  for (const annotation of _annotations) {
    if (annotation.polygon && annotation.polygon.length) {
      coords.push(...annotation.polygon);
    }
  }
  
  if (coords.length === 0) return null;
  
  const lngs = coords.map(c => c[0]).filter(lng => isFinite(lng) && lng >= -180 && lng <= 180);
  const lats = coords.map(c => c[1]).filter(lat => isFinite(lat) && lat >= -90 && lat <= 90);
  
  if (lngs.length === 0 || lats.length === 0) return null;
  
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

export default function Viewer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const fittedRef = useRef<boolean>(false); // kept for future use
  const [showHierarchy, setShowHierarchy] = useState(true);
  const [doc, setDoc] = useState<{ origin: [number, number]; units: 'm' | 'cm' | 'mm' | 'px'; nodes: HierarchyNode[] }>({ origin: [0, 0], units: 'm', nodes: [] });
  const [all, setAll] = useState<HierarchyNode[]>([]);
  const [factoryLoaded, setFactoryLoaded] = useState<boolean>(false);
  
  // Annotation editing state
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingVertex, setIsDraggingVertex] = useState<boolean>(false);
  const [draggedVertexIndex, setDraggedVertexIndex] = useState<number | null>(null);
  const [vertexDragStart, setVertexDragStart] = useState<{ x: number; y: number } | null>(null);
  
  // Checkbox-based visibility system
  const [checkedNodes, setCheckedNodes] = useState<Set<string>>(new Set());
  
  
  const [displayLevel, setDisplayLevel] = useState<Level>('polje');

  // Refs to avoid stale values during drag
  const checkedNodesRef = useRef<Set<string>>(new Set());
  const displayLevelRef = useRef<Level>('polje');
  useEffect(() => { checkedNodesRef.current = checkedNodes; }, [checkedNodes]);
  useEffect(() => { displayLevelRef.current = displayLevel; }, [displayLevel]);

  // Live refs to avoid stale closures in map event handlers
  const allRef = useRef<HierarchyNode[]>([]);
  const selectedAnnotationRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const vertexDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedVertexIndexRef = useRef<number | null>(null);
  const hoveredVertexIdRef = useRef<string | null>(null);

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

  // Update annotation position by delta (fast path: refs + source update; commit to state on mouseup)
  function updateAnnotationPosition(annotationId: string, deltaLng: number, deltaLat: number) {
    // Instead of accumulating deltas, set absolute position based on start + total delta
    const dragData = dragStartRef.current as any;
    if (!dragData?.startRing) return;
    
    const next = allRef.current.map(node => {
      if (node.id !== annotationId) return node;
      const moved = {
        ...node,
        polygon: dragData.startRing.map(([lng, lat]: number[]) => [lng + deltaLng, lat + deltaLat]) as any
      } as HierarchyNode;
      // Also update shape_gl if present
      if (dragData.startRingGL) {
        const updatedRing = dragData.startRingGL.map((coord: number[]) => [coord[0] + deltaLng, coord[1] + deltaLat]);
        (moved as any).shape_gl = { type: 'Polygon', coordinates: [updatedRing] };
      }
      return moved;
    });
    allRef.current = next;
    refreshAnnotationsSource();
  }

  // Update map source with current annotation data (fallback legacy)
  function updateMapSource() {
    refreshAnnotationsSource();
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

  // Update a specific vertex of an annotation
  function updateAnnotationVertex(annotationId: string, vertexIndex: number, deltaLng: number, deltaLat: number) {
    // Use absolute positioning from starting ring for accuracy
    const dragData = vertexDragStartRef.current as any;
    if (!dragData?.startRing) return;
    
    const next = allRef.current.map(node => {
      if (node.id !== annotationId) return node;
      // Work with starting ring for accuracy
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
      
      // Keep shape_gl in sync
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


  // Resize annotation by scaling from center
  function resizeAnnotation(annotationId: string, scaleFactor: number) {
    const annotation = all.find(node => node.id === annotationId);
    if (!annotation || !annotation.shape_gl) return;
    
    // Calculate center point
    const coords = annotation.shape_gl.coordinates[0];
    const centerLng = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
    const centerLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
    
    // Scale coordinates relative to center
    const newCoords = coords.map((coord: number[]) => [
      centerLng + (coord[0] - centerLng) * scaleFactor,
      centerLat + (coord[1] - centerLat) * scaleFactor
    ]);
    
    // Update the annotation data
    const updatedAnnotation = {
      ...annotation,
      shape_gl: {
        ...annotation.shape_gl,
        coordinates: [newCoords]
      }
    };
    
    // Update the all state
    setAll(prev => prev.map(node => 
      node.id === annotationId ? updatedAnnotation : node
    ));
    
    // Update the map source
    updateMapSource();
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
          tiles: ['http://localhost:8080/data/LTH_factory/{z}/{x}/{y}.pbf']
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
          projection: 'mercator' // Use Web Mercator projection for consistency
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

        // Handle vertex selection and dragging
        map.current!.on('click', 'vertices', (e) => {
          e.originalEvent.stopPropagation();
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const annotationId = feature.properties?.annotationId;
            const vertexIndex = feature.properties?.vertexIndex;
            if (annotationId !== undefined && vertexIndex !== undefined) {
              setDraggedVertexIndex(vertexIndex);
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
              setDraggedVertexIndex(vertexIndex);
              draggedVertexIndexRef.current = vertexIndex;
              setSelectedAnnotation(annotationId);
              selectedAnnotationRef.current = annotationId;
              setVertexDragStart({ x: e.point.x, y: e.point.y });
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
              setDragStart({ x: e.point.x, y: e.point.y });
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
            // Use lng/lat delta for accurate drag that matches cursor movement
            const startLngLat = (dragStartRef.current as any).lngLat as [number, number];
            const currLngLat = map.current!.unproject([e.point.x, e.point.y]);
            const deltaLng = currLngLat.lng - startLngLat[0];
            const deltaLat = currLngLat.lat - startLngLat[1];
            updateAnnotationPosition(selectedAnnotationRef.current, deltaLng, deltaLat);
            setDragStart({ x: e.point.x, y: e.point.y });
            dragStartRef.current.x = e.point.x;
            dragStartRef.current.y = e.point.y;
          } else if (vertexDragStartRef.current && selectedAnnotationRef.current !== null && draggedVertexIndexRef.current !== null) {
            // Use lng/lat delta for accurate drag that matches cursor movement
            const startLngLat = (vertexDragStartRef.current as any).lngLat as [number, number];
            const currLngLat = map.current!.unproject([e.point.x, e.point.y]);
            const deltaLng = currLngLat.lng - startLngLat[0];
            const deltaLat = currLngLat.lat - startLngLat[1];
            updateAnnotationVertex(selectedAnnotationRef.current, draggedVertexIndexRef.current, deltaLng, deltaLat);
            setVertexDragStart({ x: e.point.x, y: e.point.y });
            vertexDragStartRef.current.x = e.point.x;
            vertexDragStartRef.current.y = e.point.y;
          }
        });

        // Handle mouse up to stop dragging
        map.current!.on('mouseup', () => {
          if (dragStartRef.current) {
            dragStartRef.current = null;
            setIsDragging(false);
            setDragStart(null);
            // Commit ref changes to state
            setAll(allRef.current);
            // Force refresh to ensure visibility respects current filters
            refreshAnnotationsSource();
            map.current!.getCanvas().style.cursor = 'grab';
            try { map.current!.dragPan.enable(); } catch {}
          }
          if (vertexDragStartRef.current) {
            vertexDragStartRef.current = null;
            draggedVertexIndexRef.current = null;
            setIsDraggingVertex(false);
            setDraggedVertexIndex(null);
            setVertexDragStart(null);
            // Commit ref changes to state
            setAll(allRef.current);
            // Force refresh to ensure visibility respects current filters
            refreshAnnotationsSource();
            map.current!.getCanvas().style.cursor = 'grab';
            try { map.current!.dragPan.enable(); } catch {}
            if (selectedAnnotationRef.current) addVertexMarkers(selectedAnnotationRef.current);
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
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Load data and setup map
  useEffect(() => {
    const setupMap = async () => {
      const [annotations, layoutData] = await Promise.all([
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

      // Add text labels
      map.current.addLayer({
        id: 'annotations-labels',
        type: 'symbol',
        source: 'annotations',
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 14,
            'text-anchor': 'center',
            'text-offset': [0, 0]
        },
        paint: {
          'text-color': '#000',
          'text-halo-color': '#fff',
          'text-halo-width': 1
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
  const bringCheckedIntoView = () => {
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
    
    // Get all checked annotations
    const checkedAnnotations = allRef.current.filter(node => checkedNodes.has(node.id));
    
    if (checkedAnnotations.length === 0) {
      alert('No annotations are checked. Please check some annotations first.');
      return;
    }
    
    console.log(`Fitting ${checkedAnnotations.length} checked annotations into view with scaling`);
    
    // Calculate available space - use entire viewport with no padding
    const viewWidth = viewBounds.east - viewBounds.west;
    const viewHeight = viewBounds.north - viewBounds.south;
    
    // Determine optimal layout: prefer horizontal arrangement for better use of screen space
    let cols, rows;
    if (checkedAnnotations.length <= 4) {
      // For 1-4 annotations, arrange horizontally
      cols = checkedAnnotations.length;
      rows = 1;
    } else {
      // For more annotations, use a more square-ish grid
      cols = Math.ceil(Math.sqrt(checkedAnnotations.length));
      rows = Math.ceil(checkedAnnotations.length / cols);
    }
    
    // Each annotation gets exact equal share of space - no gaps
    const annotationWidth = viewWidth / cols;
    const annotationHeight = viewHeight / rows;
    
    console.log(`Layout: ${cols}x${rows}, Each annotation: ${annotationWidth.toFixed(6)} x ${annotationHeight.toFixed(6)} (shoulder-to-shoulder)`);
    
    // Calculate the center of the entire grid for rotation
    const gridCenterX = (viewBounds.west + viewBounds.east) / 2;
    const gridCenterY = (viewBounds.south + viewBounds.north) / 2;
    const rotationAngle = 3.35; // degrees
    const angleRad = (rotationAngle * Math.PI) / 180;
    
    // Reposition and rescale each checked annotation to fill their allocated space completely
    const updatedAnnotations = allRef.current.map(node => {
      if (!checkedNodes.has(node.id)) return node;
      
      const index = checkedAnnotations.findIndex(a => a.id === node.id);
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      // Calculate exact boundaries for this annotation (no gaps)
      const left = viewBounds.west + (col * annotationWidth);
      const right = viewBounds.west + ((col + 1) * annotationWidth);
      const bottom = viewBounds.south + (row * annotationHeight);
      const top = viewBounds.south + ((row + 1) * annotationHeight);
      
      // Create polygon that exactly fills the allocated rectangle
      const newPolygon: [number, number][] = [
        [left, bottom],   // bottom-left
        [right, bottom],  // bottom-right
        [right, top],     // top-right
        [left, top],      // top-left
        [left, bottom]    // close the ring
      ];
      
      // Apply rotation to each corner around the grid center to maintain rectangularity
      const rotatedPolygon = newPolygon.map(([x, y]) => {
        // Translate to grid center
        const translatedX = x - gridCenterX;
        const translatedY = y - gridCenterY;
        
        // Apply rotation
        const rotatedX = translatedX * Math.cos(angleRad) - translatedY * Math.sin(angleRad);
        const rotatedY = translatedX * Math.sin(angleRad) + translatedY * Math.cos(angleRad);
        
        // Translate back
        return [rotatedX + gridCenterX, rotatedY + gridCenterY] as [number, number];
      });
      
      // Update both polygon and shape_gl
      const updatedNode = {
        ...node,
        polygon: rotatedPolygon
      };
      
      // Update shape_gl if it exists
      if ((node as any).shape_gl) {
        (updatedNode as any).shape_gl = {
          type: 'Polygon',
          coordinates: [rotatedPolygon]
        };
      }
      
      return updatedNode;
    });
    
    // Update the state and refs
    allRef.current = updatedAnnotations;
    setAll([...updatedAnnotations]);
    
    // Update the map source to reflect the new positions
    refreshAnnotationsSource();
    
    console.log(`Annotations repositioned shoulder-to-shoulder into current view. Grid: ${cols}x${rows}, Each: ${annotationWidth.toFixed(6)}x${annotationHeight.toFixed(6)}`);
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
            // Fit to all annotation polygons
            const coords: number[][] = [];
            for (const n of allRef.current) {
              if (n.polygon && n.polygon.length) coords.push(...n.polygon);
            }
            const lngs = coords.map(c => c[0]).filter(lng => isFinite(lng) && lng >= -180 && lng <= 180);
            const lats = coords.map(c => c[1]).filter(lat => isFinite(lat) && lat >= -90 && lat <= 90);
            if (lngs.length && lats.length) {
              const bbox: [number, number, number, number] = [
                Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)
              ];
              try { map.current.fitBounds(bbox, { padding: 60 }); } catch {}
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
          style={{ ...btn, backgroundColor: '#8B5CF6' }}
          onClick={() => {
            if (!map.current) return;
            // Zoom to factory layout bounds from TileJSON
            // Bounds: [5.246049,43.261091,11.329715,47.162805] (west, south, east, north)
            const bounds: [number, number, number, number] = [5.246049, 43.261091, 11.329715, 47.162805];
            map.current.fitBounds(bounds, { padding: 50 });
            
            // Add a test marker to verify coordinates
            if (!map.current.getSource('test-marker')) {
              map.current.addSource('test-marker', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [10.857239, 45.504422] // Center of factory bounds
                  },
                  properties: {
                    name: 'Test Marker'
                  }
                }
              });
              
              map.current.addLayer({
                id: 'test-marker-layer',
                type: 'circle',
                source: 'test-marker',
                paint: {
                  'circle-color': '#00ff00',
                  'circle-radius': 10,
                  'circle-opacity': 1.0
                }
              });
              
              console.log('Test marker added at factory location');
            }
            
            // Debug zoom level and layer visibility
            console.log('Current zoom level:', map.current.getZoom());
            console.log('Factory layer visibility:', map.current.getLayoutProperty('factory-tiles-lines', 'visibility'));
            console.log('Factory layer minzoom:', map.current.getLayer('factory-tiles-lines')?.minzoom);
            console.log('Factory layer maxzoom:', map.current.getLayer('factory-tiles-lines')?.maxzoom);
          }}
        >
          Zoom to Layout
        </button>
        
        {/* Rotation Controls */}
        <button
          style={{ ...btn, backgroundColor: '#F59E0B' }}
          onClick={() => {
            if (!map.current) return;
            map.current.setBearing(-4.65);
            console.log('Rotated map to -4.65°');
          }}
        >
          Test Map Rotation
        </button>
        
        <button
          style={{ ...btn, backgroundColor: '#EF4444' }}
          onClick={() => {
            if (!map.current) return;
            map.current.setBearing(0);
            console.log('Reset rotation to 0°');
          }}
        >
          Reset Rotation
        </button>
        
        <button
          style={{ ...btn, backgroundColor: '#8B5CF6' }}
          onClick={() => {
            if (!map.current) return;
            const currentBearing = map.current.getBearing();
            const newBearing = currentBearing + 1;
            map.current.setBearing(newBearing);
            console.log(`Rotated to ${newBearing.toFixed(2)}°`);
          }}
        >
          +1°
        </button>
        
        <button
          style={{ ...btn, backgroundColor: '#8B5CF6' }}
          onClick={() => {
            if (!map.current) return;
            const currentBearing = map.current.getBearing();
            const newBearing = currentBearing - 1;
            map.current.setBearing(newBearing);
            console.log(`Rotated to ${newBearing.toFixed(2)}°`);
          }}
        >
          -1°
        </button>
      </div>
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