#!/usr/bin/env python3
"""
Convert factory_clean.json from local coordinates to WGS84 (lat/lng).
Uses the same transformation as the annotation migration script.
"""

import json
import os
from pathlib import Path

# Same transformation parameters as in populate_layers_features_optimized.py
BASE_LNG = 14.5
BASE_LAT = 46.0
SCALE_DEG_PER_UNIT = 0.000009  # degrees per unit (assuming meters)

def to_wgs84(x, y):
    """Convert local coordinates to WGS84 lat/lng."""
    lng = BASE_LNG + (x * SCALE_DEG_PER_UNIT)
    lat = BASE_LAT + (y * SCALE_DEG_PER_UNIT)
    return [lng, lat]

def transform_geometry(geom):
    """Transform geometry coordinates from local to WGS84."""
    if not geom or "type" not in geom or "coordinates" not in geom:
        return geom
    
    geom_type = geom["type"]
    coordinates = geom["coordinates"]
    
    if geom_type == "Point":
        return {
            "type": geom_type,
            "coordinates": to_wgs84(coordinates[0], coordinates[1])
        }
    
    elif geom_type in ("MultiPoint", "LineString"):
        return {
            "type": geom_type,
            "coordinates": [to_wgs84(p[0], p[1]) for p in coordinates]
        }
    
    elif geom_type in ("MultiLineString", "Polygon"):
        return {
            "type": geom_type,
            "coordinates": [[to_wgs84(p[0], p[1]) for p in ring] for ring in coordinates]
        }
    
    elif geom_type == "MultiPolygon":
        return {
            "type": geom_type,
            "coordinates": [
                [[to_wgs84(p[0], p[1]) for p in ring] for ring in polygon]
                for polygon in coordinates
            ]
        }
    
    return geom

def main():
    # Paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    input_file = project_root / "frontend" / "public" / "factory_clean.json"
    output_file = project_root / "frontend" / "public" / "factory_clean_wgs84.json"
    
    print(f"Reading factory layout from: {input_file}")
    
    if not input_file.exists():
        print(f"Error: Input file not found: {input_file}")
        return 1
    
    # Load the factory layout
    with open(input_file, "r", encoding="utf-8") as f:
        factory_data = json.load(f)
    
    print(f"Loaded {len(factory_data.get('features', []))} features")
    
    # Transform all features
    transformed_features = []
    for feature in factory_data.get("features", []):
        if "geometry" in feature:
            feature["geometry"] = transform_geometry(feature["geometry"])
        transformed_features.append(feature)
    
    # Create output GeoJSON
    output_data = {
        "type": "FeatureCollection",
        "features": transformed_features
    }
    
    # Write the transformed data
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"Wrote WGS84 factory layout to: {output_file}")
    print(f"Transformed {len(transformed_features)} features")
    
    # Calculate bounding box for verification
    all_coords = []
    for feature in transformed_features:
        geom = feature.get("geometry", {})
        if geom.get("type") == "Point":
            all_coords.append(geom["coordinates"])
        elif geom.get("type") in ("LineString", "MultiPoint"):
            all_coords.extend(geom["coordinates"])
        elif geom.get("type") in ("Polygon", "MultiLineString"):
            for ring in geom["coordinates"]:
                all_coords.extend(ring)
        elif geom.get("type") == "MultiPolygon":
            for polygon in geom["coordinates"]:
                for ring in polygon:
                    all_coords.extend(ring)
    
    if all_coords:
        lngs = [coord[0] for coord in all_coords]
        lats = [coord[1] for coord in all_coords]
        bbox = [min(lngs), min(lats), max(lngs), max(lats)]
        print(f"WGS84 bounding box: {bbox}")
        print(f"Center: [{sum(lngs)/len(lngs):.6f}, {sum(lats)/len(lats):.6f}]")
    
    return 0

if __name__ == "__main__":
    exit(main())
