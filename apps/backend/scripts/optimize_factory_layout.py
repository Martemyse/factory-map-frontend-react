#!/usr/bin/env python3
"""
Create an optimized version of the factory layout by sampling geometries.
This reduces file size while maintaining visual representation.
"""

import json
import random
from pathlib import Path

def optimize_factory_layout(input_file, output_file, sample_ratio=0.1):
    """Create an optimized factory layout by sampling geometries."""
    
    print(f"Loading factory layout from: {input_file}")
    
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if data.get("type") != "FeatureCollection":
        print("Error: Expected FeatureCollection format")
        return
    
    features = data.get("features", [])
    total_features = len(features)
    sample_size = int(total_features * sample_ratio)
    
    print(f"Original features: {total_features}")
    print(f"Sampling {sample_size} features ({sample_ratio*100:.1f}%)")
    
    # Sample features randomly
    sampled_features = random.sample(features, sample_size)
    
    # Create optimized GeoJSON
    optimized_data = {
        "type": "FeatureCollection",
        "features": sampled_features
    }
    
    # Write optimized file
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(optimized_data, f, ensure_ascii=False, separators=(',', ':'))
    
    # Get file sizes
    input_size = Path(input_file).stat().st_size / (1024 * 1024)  # MB
    output_size = Path(output_file).stat().st_size / (1024 * 1024)  # MB
    
    print(f"Optimized factory layout written to: {output_file}")
    print(f"File size: {input_size:.1f}MB -> {output_size:.1f}MB ({output_size/input_size*100:.1f}%)")
    print(f"Features: {total_features} -> {sample_size}")

if __name__ == "__main__":
    # Paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    input_file = project_root / "frontend" / "public" / "factory_clean_wgs84.json"
    output_file = project_root / "frontend" / "public" / "factory_clean_wgs84_optimized.json"
    
    # Create optimized version with 10% sampling
    optimize_factory_layout(input_file, output_file, sample_ratio=0.1)
