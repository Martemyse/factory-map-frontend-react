#!/usr/bin/env python3
"""
Convert GeometryCollection to FeatureCollection for tippecanoe compatibility.
"""

import json
from pathlib import Path

def convert_geometry_to_features(input_file, output_file):
    """Convert GeometryCollection to FeatureCollection."""
    
    print(f"Converting {input_file} to FeatureCollection format...")
    
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if data.get("type") != "GeometryCollection":
        print("Error: Expected GeometryCollection format")
        return
    
    geometries = data.get("geometries", [])
    print(f"Found {len(geometries)} geometries")
    
    # Convert geometries to features
    features = []
    for i, geometry in enumerate(geometries):
        feature = {
            "type": "Feature",
            "properties": {
                "id": f"geometry_{i}",
                "geometry_type": geometry.get("type", "Unknown")
            },
            "geometry": geometry
        }
        features.append(feature)
    
    # Create FeatureCollection
    feature_collection = {
        "type": "FeatureCollection",
        "features": features
    }
    
    # Write output file
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(feature_collection, f, ensure_ascii=False, separators=(',', ':'))
    
    print(f"Converted to FeatureCollection with {len(features)} features")
    print(f"Output written to: {output_file}")

if __name__ == "__main__":
    input_file = "data/LTH_simplified_vis_clean.json"
    output_file = "data/LTH_simplified_vis_clean_features.json"
    
    convert_geometry_to_features(input_file, output_file)
