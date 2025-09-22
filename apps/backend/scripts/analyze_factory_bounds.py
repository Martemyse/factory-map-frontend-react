#!/usr/bin/env python3
"""
Analyze the factory layout bounds to understand where to place annotations.
"""

import json
from pathlib import Path

def analyze_factory_bounds():
    """Analyze the factory layout to get its bounding box."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    factory_file = project_root / "frontend" / "public" / "factory_clean_wgs84.json"
    
    print(f"Analyzing factory layout: {factory_file}")
    
    with open(factory_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    all_coords = []
    
    for feature in data.get("features", []):
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
    
    if not all_coords:
        print("No coordinates found!")
        return
    
    lngs = [coord[0] for coord in all_coords]
    lats = [coord[1] for coord in all_coords]
    
    min_lng, max_lng = min(lngs), max(lngs)
    min_lat, max_lat = min(lats), max(lats)
    
    center_lng = (min_lng + max_lng) / 2
    center_lat = (min_lat + max_lat) / 2
    
    print(f"Factory layout bounds:")
    print(f"  Longitude: {min_lng:.6f} to {max_lng:.6f}")
    print(f"  Latitude: {min_lat:.6f} to {max_lat:.6f}")
    print(f"  Center: [{center_lng:.6f}, {center_lat:.6f}]")
    print(f"  Width: {max_lng - min_lng:.6f} degrees")
    print(f"  Height: {max_lat - min_lat:.6f} degrees")
    
    # Convert back to local coordinates for annotation placement
    # Using the same conversion as in the migration script
    BASE_LNG = 14.5
    BASE_LAT = 46.0
    SCALE_DEG_PER_UNIT = 0.000009
    
    def wgs84_to_local(lng, lat):
        x = (lng - BASE_LNG) / SCALE_DEG_PER_UNIT
        y = (lat - BASE_LAT) / SCALE_DEG_PER_UNIT
        return x, y
    
    min_x, min_y = wgs84_to_local(min_lng, min_lat)
    max_x, max_y = wgs84_to_local(max_lng, max_lat)
    center_x, center_y = wgs84_to_local(center_lng, center_lat)
    
    print(f"\nLocal coordinates (for annotation placement):")
    print(f"  X: {min_x:.2f} to {max_x:.2f}")
    print(f"  Y: {min_y:.2f} to {max_y:.2f}")
    print(f"  Center: [{center_x:.2f}, {center_y:.2f}]")
    print(f"  Width: {max_x - min_x:.2f} units")
    print(f"  Height: {max_y - min_y:.2f} units")
    
    return {
        "wgs84": {
            "min_lng": min_lng, "max_lng": max_lng,
            "min_lat": min_lat, "max_lat": max_lat,
            "center_lng": center_lng, "center_lat": center_lat
        },
        "local": {
            "min_x": min_x, "max_x": max_x,
            "min_y": min_y, "max_y": max_y,
            "center_x": center_x, "center_y": center_y
        }
    }

if __name__ == "__main__":
    analyze_factory_bounds()
