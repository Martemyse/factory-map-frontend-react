#!/usr/bin/env python3
"""
Analyze factory layout bounds to determine proper coordinate ranges for annotations.
This script examines the factory tiles to find the actual bounds of the layout.
"""

import sys
import os
import json
from typing import Tuple, List, Dict, Any

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


class FactoryBoundsAnalyzer:
    def __init__(self):
        self.target_engine = create_engine(settings.sync_database_url)
    
    def analyze_existing_annotations(self) -> Dict[str, Any]:
        """Analyze existing annotations to understand current coordinate ranges."""
        with self.target_engine.connect() as conn:
            query = text("""
                SELECT 
                    MIN(ST_X(ST_Centroid(geom))) as min_x,
                    MAX(ST_X(ST_Centroid(geom))) as max_x,
                    MIN(ST_Y(ST_Centroid(geom))) as min_y,
                    MAX(ST_Y(ST_Centroid(geom))) as max_y,
                    COUNT(*) as total_features
                FROM features
                WHERE geom IS NOT NULL
            """)
            
            result = conn.execute(query)
            row = result.fetchone()
            
            if row and row.total_features > 0:
                return {
                    'min_x': float(row.min_x),
                    'max_x': float(row.max_x),
                    'min_y': float(row.min_y),
                    'max_y': float(row.max_y),
                    'total_features': row.total_features,
                    'width': float(row.max_x) - float(row.min_x),
                    'height': float(row.max_y) - float(row.min_y)
                }
            else:
                return None
    
    def get_factory_tile_bounds(self) -> Dict[str, Any]:
        """
        Get factory tile bounds from the tileserver.
        These are the actual bounds of the factory layout tiles.
        """
        # Factory layout bounds from TileJSON (approximate)
        # These should match the actual factory layout bounds
        factory_bounds = {
            'west': 5.246049,   # Western boundary
            'east': 11.329715,  # Eastern boundary  
            'south': 43.261091, # Southern boundary
            'north': 47.162805, # Northern boundary
            'center_lng': (5.246049 + 11.329715) / 2,
            'center_lat': (43.261091 + 47.162805) / 2
        }
        
        return factory_bounds
    
    def convert_latlng_to_web_mercator(self, lng: float, lat: float) -> Tuple[float, float]:
        """Convert lat/lng to Web Mercator (EPSG:3857) coordinates."""
        import math
        
        # Web Mercator projection
        x = lng * 20037508.34 / 180
        y = math.log(math.tan((90 + lat) * math.pi / 360)) / (math.pi / 180)
        y = y * 20037508.34 / 180
        
        return x, y
    
    def get_annotation_bounds_for_factory(self) -> Dict[str, Any]:
        """
        Calculate appropriate annotation bounds that fit within the factory layout.
        Returns bounds in Web Mercator coordinates (EPSG:3857).
        """
        factory_bounds = self.get_factory_tile_bounds()
        
        # Convert factory bounds to Web Mercator
        west_x, south_y = self.convert_latlng_to_web_mercator(
            factory_bounds['west'], factory_bounds['south']
        )
        east_x, north_y = self.convert_latlng_to_web_mercator(
            factory_bounds['east'], factory_bounds['north']
        )
        
        # Add some padding around the factory bounds for annotations
        padding_factor = 0.1  # 10% padding
        width = east_x - west_x
        height = north_y - south_y
        
        padded_west = west_x - (width * padding_factor)
        padded_east = east_x + (width * padding_factor)
        padded_south = south_y - (height * padding_factor)
        padded_north = north_y + (height * padding_factor)
        
        return {
            'min_x': padded_west,
            'max_x': padded_east,
            'min_y': padded_south,
            'max_y': padded_north,
            'width': padded_east - padded_west,
            'height': padded_north - padded_south,
            'center_x': (padded_west + padded_east) / 2,
            'center_y': (padded_south + padded_north) / 2,
            'factory_center_lng': factory_bounds['center_lng'],
            'factory_center_lat': factory_bounds['center_lat']
        }
    
    def analyze_and_report(self):
        """Main analysis function."""
        print("Factory Bounds Analysis")
        print("=" * 50)
        
        # Check existing annotations
        existing = self.analyze_existing_annotations()
        if existing:
            print(f"Existing annotations bounds:")
            print(f"  X: {existing['min_x']:.2f} to {existing['max_x']:.2f} (width: {existing['width']:.2f})")
            print(f"  Y: {existing['min_y']:.2f} to {existing['max_y']:.2f} (height: {existing['height']:.2f})")
            print(f"  Total features: {existing['total_features']}")
        else:
            print("No existing annotations found.")
        
        print()
        
        # Get recommended bounds
        recommended = self.get_annotation_bounds_for_factory()
        print(f"Recommended annotation bounds (Web Mercator EPSG:3857):")
        print(f"  X: {recommended['min_x']:.2f} to {recommended['max_x']:.2f} (width: {recommended['width']:.2f})")
        print(f"  Y: {recommended['min_y']:.2f} to {recommended['max_y']:.2f} (height: {recommended['height']:.2f})")
        print(f"  Center: ({recommended['center_x']:.2f}, {recommended['center_y']:.2f})")
        print(f"  Factory center (lat/lng): ({recommended['factory_center_lng']:.6f}, {recommended['factory_center_lat']:.6f})")
        
        print()
        print("Use these bounds in populate_layers_features_optimized.py:")
        print(f"  x_min, x_max = {recommended['min_x']:.2f}, {recommended['max_x']:.2f}")
        print(f"  y_min, y_max = {recommended['min_y']:.2f}, {recommended['max_y']:.2f}")
        
        return recommended


def main():
    """Main entry point."""
    analyzer = FactoryBoundsAnalyzer()
    bounds = analyzer.analyze_and_report()
    
    print("\nAnalysis completed successfully!")
    return bounds


if __name__ == "__main__":
    main()
