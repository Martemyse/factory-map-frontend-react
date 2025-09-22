import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
// @ts-ignore - No types available for mapbox-gl-draw
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import HierarchyNavigator from '../editor/HierarchyNavigator';
import type { HierarchyNode, Level } from '../model/types';

const API_BASE = 'http://localhost:8000';

// Helper functions
function calculateAnnotationBounds(annotations: HierarchyNode[]): [number, number, number, number] | null {
  const coords: number[][] = [];
  for (const annotation of annotations) {
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
  const fittedRef = useRef<boolean>(false);
  const [showHierarchy, setShowHierarchy] = useState(true);
  const [displayLevel, setDisplayLevel] = useState<'polje' | 'subzone' | 'vrsta'>('polje');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [doc, setDoc] = useState<{ origin: [number, number]; units: 'm' | 'cm' | 'mm' | 'px'; nodes: HierarchyNode[] }>({ origin: [0, 0], units: 'm', nodes: [] });
  const [all, setAll] = useState<HierarchyNode[]>([]);
  const [factoryLoaded, setFactoryLoaded] = useState<boolean>(false);
  // Drawing functionality temporarily disabled
  // const [drawingMode, setDrawingMode] = useState<boolean>(false);
  // const [drawnFeatures, setDrawnFeatures] = useState<any[]>([]);
  // const drawRef = useRef<MapboxDraw | null>(null);

  // Load annotations from backend using GL coordinates
  async function loadAnnotations(): Promise<HierarchyNode[]> {
    try {
      console.log('Loading annotations from:', `${API_BASE}/features`);
      const response = await fetch(`${API_BASE}/features`);
      console.log('Response status:', response.status);
      const features = await response.json();
      console.log('Loaded features from backend:', features.length);
      
      // Check if GL coordinates are populated
      const featuresWithGL = features.filter((f: any) => f?.shape_gl && f.shape_gl.coordinates && Array.isArray(f.shape_gl.coordinates[0]) && f.shape_gl.coordinates[0].length >= 3);
      const featuresMissingGL = features.length - featuresWithGL.length;
      console.log(`Features with GL polygons: ${featuresWithGL.length}/${features.length} (missing: ${featuresMissingGL})`);
      
      if (featuresWithGL.length === 0) {
        console.warn('No features have valid shape_gl polygons! You may need to run the migration script.');
      }
      
      const nodes: HierarchyNode[] = [];
      const nodeMap = new Map<number, HierarchyNode>();
      
      // First pass: create all nodes using GL coordinates
      const offending: number[] = [];
      for (const feature of features) {
        // Use GL coordinates for MapLibre GL rendering
        let polygon: [number, number][] = [];
        
        // Debug logging for GL coordinates
        console.log(`Feature ${feature.id} GL data:`, {
          shape_gl: feature.shape_gl,
          x_coord_gl: feature.x_coord_gl,
          y_coord_gl: feature.y_coord_gl,
          level: feature.level
        });
        
        if (feature.shape_gl && feature.shape_gl.coordinates && Array.isArray(feature.shape_gl.coordinates[0]) && feature.shape_gl.coordinates[0].length >= 3) {
          // Use the pre-calculated GL coordinates
          polygon = feature.shape_gl.coordinates[0].map((coord: number[]) => [coord[0], coord[1]]);
          console.log('Using GL coordinates for feature', feature.id, ':', polygon);
        } else {
          console.error('Missing or invalid shape_gl for feature', feature.id, feature.shape_gl);
          offending.push(feature.id);
          continue;
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

      if (offending.length > 0) {
        console.error(`Missing shape_gl for ${offending.length} features. Example IDs: ${offending.slice(0, 10).join(', ')}`);
        throw new Error(`Missing shape_gl for ${offending.length} features`);
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

  // Load factory layout GeoJSON
  async function loadFactoryLayout(): Promise<any> {
    try {
      const res = await fetch('/factory_clean_wgs84.json');
      const data = await res.json();
      console.log('Loaded factory layout features:', data.features?.length || 0);
      
      if (!data.features || data.features.length === 0) {
        console.warn('No features found in factory layout');
        return { data: null, bbox: null };
      }
      
      // Calculate bounding box for map fitting - use a safer approach
      const allCoords: number[][] = [];
      
      for (const feature of data.features) {
        if (feature.geometry && feature.geometry.coordinates) {
          // Handle different geometry types safely
          if (feature.geometry.type === 'Polygon' && Array.isArray(feature.geometry.coordinates[0])) {
            // Polygon: coordinates[0] is the outer ring
            allCoords.push(...feature.geometry.coordinates[0]);
          } else if (feature.geometry.type === 'MultiPolygon' && Array.isArray(feature.geometry.coordinates)) {
            // MultiPolygon: coordinates[0][0] is the first polygon's outer ring
            for (const polygon of feature.geometry.coordinates) {
              if (Array.isArray(polygon[0])) {
                allCoords.push(...polygon[0]);
              }
            }
          } else if (feature.geometry.type === 'LineString' && Array.isArray(feature.geometry.coordinates)) {
            // LineString: coordinates is the line
            allCoords.push(...feature.geometry.coordinates);
          } else if (feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
            // Point: coordinates is [lng, lat]
            allCoords.push(feature.geometry.coordinates);
          }
        }
      }
      
      if (allCoords.length === 0) {
        console.warn('No valid coordinates found in factory layout');
        return { data: null, bbox: null };
      }
      
      const lngs = allCoords.map(c => c[0]).filter(lng => isFinite(lng) && lng >= -180 && lng <= 180);
      const lats = allCoords.map(c => c[1]).filter(lat => isFinite(lat) && lat >= -90 && lat <= 90);
      
      if (lngs.length === 0 || lats.length === 0) {
        console.warn('No valid lat/lng coordinates found');
        return { data: null, bbox: null };
      }
      
      const bbox = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
      console.log('Factory bbox:', bbox);
      
      // Validate bbox
      if (bbox[0] < -180 || bbox[1] < -90 || bbox[2] > 180 || bbox[3] > 90) {
        console.error('Invalid bounding box:', bbox);
        return { data: null, bbox: null };
      }
      
      return { data, bbox };
    } catch (e) {
      console.error('Failed to load factory layout', e);
      return { data: null, bbox: null };
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
          center: [10.8, 38.5], // Center on annotation area
          zoom: 12
        });

      map.current.on('load', () => {
        console.log('Map loaded');
        
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
        
        // Handle drawing events (temporarily disabled)
        // map.current!.on('draw.create', (e) => {
        //   const feature = e.features[0];
        //   console.log('Drawn feature:', feature);
        //   console.log('Coordinates:', feature.geometry.coordinates);
        //   
        //   // Calculate center point
        //   const coords = feature.geometry.coordinates[0];
        //   const centerLng = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
        //   const centerLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
        //   
        //   console.log(`Center: [${centerLng.toFixed(6)}, ${centerLat.toFixed(6)}]`);
        //   
        //   setDrawnFeatures(prev => [...prev, feature]);
        // });
        // 
        // map.current!.on('draw.delete', (e) => {
        //   console.log('Deleted features:', e.features);
        //   setDrawnFeatures(prev => prev.filter(f => f.id !== e.features[0].id));
        // });
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
        // Add factory layout only if valid lat/lng GeoJSON and not already loaded
        if (layoutData && layoutData.data && layoutData.bbox && !factoryLoaded) {
          if (!map.current.getSource('factory')) {
            map.current.addSource('factory', {
              type: 'geojson',
              data: layoutData.data
            });

            map.current.addLayer({
              id: 'factory-fill',
              type: 'fill',
              source: 'factory',
              paint: {
                'fill-color': '#e0e0e0',
                'fill-opacity': 0.3
              }
            });

            map.current.addLayer({
              id: 'factory-outline',
              type: 'line',
              source: 'factory',
              paint: {
                'line-color': '#666',
                'line-width': 1
              }
            });
            
            setFactoryLoaded(true);
          }

          try {
            // Focus on annotation area instead of full factory layout
            const annotationBounds = calculateAnnotationBounds(annotations);
            if (annotationBounds) {
              map.current.fitBounds(annotationBounds, { padding: 100 });
            } else {
              map.current.fitBounds(layoutData.bbox, { padding: 50 });
            }
          } catch (error) {
            console.warn('Failed to fit bounds to factory layout:', error);
          }
        } else {
          // Fallback: fit to annotations' bbox
          const coords: number[][] = [];
          for (const n of annotations) {
            if (n.polygon && n.polygon.length) {
              coords.push(...n.polygon);
            }
          }
          const lngs = coords.map(c => c[0]).filter(lng => isFinite(lng) && lng >= -180 && lng <= 180);
          const lats = coords.map(c => c[1]).filter(lat => isFinite(lat) && lat >= -90 && lat <= 90);
          if (lngs.length && lats.length) {
            const bbox: [number, number, number, number] = [
              Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)
            ];
            try {
              map.current.fitBounds(bbox, { padding: 80 });
    } catch (e) {
              console.warn('Failed to fit bounds to annotations:', e);
            }
          } else {
            console.warn('No valid annotation bbox available');
          }
        }
      }
    };

    setupMap();
  }, []);

  // After annotations load, fit to their bbox once
  useEffect(() => {
    if (!map.current || fittedRef.current) return;
    if (!all || all.length === 0) return;

    // Compute bbox from all annotations' polygons
    const coords: number[][] = [];
    for (const n of all) {
      if (n.polygon && n.polygon.length) coords.push(...n.polygon);
    }
    const lngs = coords.map(c => c[0]).filter(lng => isFinite(lng) && lng >= -180 && lng <= 180);
    const lats = coords.map(c => c[1]).filter(lat => isFinite(lat) && lat >= -90 && lat <= 90);
    if (lngs.length && lats.length) {
      const bbox: [number, number, number, number] = [
        Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)
      ];
      try {
        map.current.fitBounds(bbox, { padding: 80 });
        fittedRef.current = true;
      } catch (e) {
        console.warn('Failed to fit bounds to annotations (post-load):', e);
      }
    } else {
      console.warn('No valid annotation bbox available (post-load)');
    }
  }, [all]);

  // Update annotations on map when display level changes
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

    // Filter annotations based on display level
    let visibleAnnotations = all;
    
    if (displayLevel === 'polje') {
      visibleAnnotations = all.filter(node => node.level === 'polje');
    } else if (displayLevel === 'subzone' && selectedParentId) {
      const parentNode = all.find(node => node.id === selectedParentId);
      if (parentNode) {
        visibleAnnotations = all.filter(node => 
          node.level === 'subzone' && node.parentLocalId === selectedParentId
        );
      }
    } else if (displayLevel === 'vrsta' && selectedParentId) {
      const parentNode = all.find(node => node.id === selectedParentId);
      if (parentNode) {
        visibleAnnotations = all.filter(node => 
          node.level === 'vrsta' && node.parentLocalId === selectedParentId
        );
      }
    }

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
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.8
          }
        });

        // Add outline layer (on top of factory)
        map.current.addLayer({
          id: 'annotations-outline',
          type: 'line',
          source: 'annotations',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3
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
      } catch (e) {
        // ignore if moveLayer fails
      }

      // Focus on visible annotations
      const bounds = calculateAnnotationBounds(visibleAnnotations);
      if (bounds) {
        try {
          map.current.fitBounds(bounds, { padding: 100 });
        } catch (e) {
          console.warn('Failed to fit bounds to visible annotations:', e);
        }
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
  }, [all, displayLevel, selectedParentId, factoryLoaded]);

  const handleSelect = (nodeId: string) => {
    const node = all.find(n => n.id === nodeId);
    if (!node) return;

    if (node.level === 'polje') {
      setDisplayLevel('subzone');
      setSelectedParentId(nodeId);
    } else if (node.level === 'subzone') {
      setDisplayLevel('vrsta');
      setSelectedParentId(nodeId);
    } else if (node.level === 'vrsta') {
      // For vrsta level, show all vrstas of the same parent
      const parentNode = all.find(n => n.id === node.parentLocalId);
      if (parentNode) {
        setDisplayLevel('vrsta');
        setSelectedParentId(parentNode.id);
      }
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
      
      {/* Drawing Controls - Temporarily disabled */}
      {/* <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000 }}>
        <button>Drawing Disabled</button>
      </div> */}
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