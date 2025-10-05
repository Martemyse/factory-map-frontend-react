#!/usr/bin/env python3
"""
Script to normalize all polygon orientations to match the first polygon's orientation.
This ensures all annotations have the same orientation regardless of size.
"""

import sys
import os
import math
from typing import List, Tuple, Optional
from sqlalchemy import create_engine, text
from geoalchemy2 import WKTElement
import geoalchemy2.functions as func

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings


class PolygonOrientationNormalizer:
    def __init__(self):
        self.engine = create_engine(settings.sync_database_url)
        
    def _is_closed(self, coordinates: List[Tuple[float, float]]) -> bool:
        if len(coordinates) < 2:
            return False
        return coordinates[0][0] == coordinates[-1][0] and coordinates[0][1] == coordinates[-1][1]

    def calculate_polygon_orientation(self, coordinates: List[Tuple[float, float]]) -> float:
        """Calculate the orientation angle of a polygon based on its longest edge."""
        if len(coordinates) < 3:
            return 0.0
            
        max_length = 0
        orientation_angle = 0
        
        for i in range(len(coordinates) - 1):
            p1 = coordinates[i]
            p2 = coordinates[i + 1]
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            length = math.sqrt(dx * dx + dy * dy)
            
            if length > max_length:
                max_length = length
                orientation_angle = math.atan2(dy, dx)
                
        return orientation_angle
    
    def calculate_reference_aspect_ratio(self) -> float:
        """Calculate width/height aspect ratio of the hardcoded reference polygon in its own axis."""
        # Hardcoded reference polygon from user (closed ring) - ID 19703
        reference_coords = [
            (10.975172639350573, 45.16873541903552),
            (9.753687796547522, 45.1184584160307),
            (9.829368801142177, 44.26715166696913),
            (11.029076321130045, 44.3174412910695),
            (10.975172639350573, 45.16873541903552)
        ]

        ref_orientation = self.calculate_polygon_orientation(reference_coords)
        cos_a = math.cos(-ref_orientation)
        sin_a = math.sin(-ref_orientation)

        xs: List[float] = []
        ys: List[float] = []
        # rotate into reference axis, collect bounds
        for (x, y) in reference_coords:
            xr = x * cos_a - y * sin_a
            yr = x * sin_a + y * cos_a
            xs.append(xr)
            ys.append(yr)

        width = max(xs) - min(xs)
        height = max(ys) - min(ys)
        if height == 0:
            return float('inf')
        aspect = width / height
        return aspect

    def normalize_polygon_orientation(self, coordinates: List[Tuple[float, float]], 
                                    reference_orientation: float) -> List[Tuple[float, float]]:
        """Normalize polygon to have the same orientation as reference polygon."""
        if len(coordinates) < 3:
            return coordinates
            
        # Calculate current orientation
        current_orientation = self.calculate_polygon_orientation(coordinates)
        
        # Calculate rotation angle needed
        rotation_angle = reference_orientation - current_orientation
        
        # Find centroid for rotation
        centroid_x = sum(coord[0] for coord in coordinates) / len(coordinates)
        centroid_y = sum(coord[1] for coord in coordinates) / len(coordinates)
        
        # Apply rotation around centroid
        cos_angle = math.cos(rotation_angle)
        sin_angle = math.sin(rotation_angle)
        
        normalized_coords = []
        for coord in coordinates:
            # Translate to origin
            x = coord[0] - centroid_x
            y = coord[1] - centroid_y
            
            # Apply rotation
            rotated_x = x * cos_angle - y * sin_angle
            rotated_y = x * sin_angle + y * cos_angle
            
            # Translate back
            normalized_coords.append((rotated_x + centroid_x, rotated_y + centroid_y))
            
        return normalized_coords
    
    def normalize_polygon_shape_and_orientation(self, coordinates: List[Tuple[float, float]], 
                                               reference_orientation: float,
                                               reference_aspect_ratio: float) -> List[Tuple[float, float]]:
        """Rotate to reference orientation and scale axes to match reference aspect ratio (width/height).

        We keep the polygon's width (in the reference axis) unchanged and scale the height so that
        width/height == reference_aspect_ratio, preserving centroid.
        """
        if len(coordinates) < 3:
            return coordinates

        # Ensure open ring for calculation
        was_closed = self._is_closed(coordinates)
        ring = coordinates[:-1] if was_closed else coordinates[:]

        # Compute centroid
        cx = sum(p[0] for p in ring) / len(ring)
        cy = sum(p[1] for p in ring) / len(ring)

        # Current orientation and rotation delta
        current_orientation = self.calculate_polygon_orientation(coordinates)
        rot = reference_orientation - current_orientation
        cos_r = math.cos(rot)
        sin_r = math.sin(rot)

        # First rotate around centroid to reference axis
        rotated: List[Tuple[float, float]] = []
        for (x, y) in ring:
            dx = x - cx
            dy = y - cy
            xr = dx * cos_r - dy * sin_r
            yr = dx * sin_r + dy * cos_r
            rotated.append((xr, yr))

        # Compute current width/height in reference axis
        xs = [p[0] for p in rotated]
        ys = [p[1] for p in rotated]
        width = (max(xs) - min(xs)) or 0.0
        height = (max(ys) - min(ys)) or 0.0
        if height == 0:
            # Degenerate - cannot scale Y; just return rotated ring translated back
            out = [(p[0] + cx, p[1] + cy) for p in rotated]
            if was_closed:
                out.append(out[0])
            return out

        current_aspect = width / height if height != 0 else float('inf')
        if reference_aspect_ratio == 0:
            sy = 1.0
        else:
            # Keep width, scale Y so that width/(height*sy) == reference_aspect_ratio
            sy = current_aspect / reference_aspect_ratio

        # Scale around centroid in reference axis
        scaled: List[Tuple[float, float]] = []
        for (xr, yr) in rotated:
            xs_ = xr  # keep width
            ys_ = yr * sy
            scaled.append((xs_, ys_))

        # Translate back to world coordinates (already at reference orientation)
        normalized = [(xs_ + cx, ys_ + cy) for (xs_, ys_) in scaled]
        if was_closed:
            normalized.append(normalized[0])
        return normalized
    
    def get_reference_orientation(self) -> float:
        """Get the reference orientation from the hardcoded reference polygon."""
        # Hardcoded reference polygon from user - ID 19703
        # POLYGON ((10.975172639350573 45.16873541903552, 9.753687796547522 45.1184584160307, 9.829368801142177 44.26715166696913, 11.029076321130045 44.3174412910695, 10.975172639350573 45.16873541903552))
        reference_coords = [
            (10.975172639350573, 45.16873541903552),
            (9.753687796547522, 45.1184584160307),
            (9.829368801142177, 44.26715166696913),
            (11.029076321130045, 44.3174412910695),
            (10.975172639350573, 45.16873541903552)  # Closed ring
        ]
        
        orientation = self.calculate_polygon_orientation(reference_coords)
        print(f"Reference polygon orientation: {math.degrees(orientation):.2f}°")
        return orientation
    
    def normalize_all_polygons(self, layer_id: int):
        """Normalize all polygons in the layer to match the reference orientation."""
        print(f"Normalizing polygon orientations for layer {layer_id}...")
        
        # Get reference orientation from hardcoded reference polygon
        reference_orientation = self.get_reference_orientation()
        reference_aspect = self.calculate_reference_aspect_ratio()
        
        with self.engine.connect() as conn:
            # Start transaction
            trans = conn.begin()
            
            try:
                # Get all polygons in the layer
                query = text("""
                    SELECT id, ST_AsText(geom) as wkt
                    FROM features 
                    WHERE layer_id = :layer_id 
                    AND ST_GeometryType(geom) = 'ST_Polygon'
                    ORDER BY id
                """)
                
                result = conn.execute(query, {'layer_id': layer_id})
                polygons = result.fetchall()
                
                print(f"Found {len(polygons)} polygons to normalize")
                
                # Process each polygon
                for i, (feature_id, wkt) in enumerate(polygons):
                    # Parse WKT to get coordinates
                    coords_str = wkt.split('((')[1].split('))')[0]
                    coords = []
                    
                    for point_str in coords_str.split(','):
                        x, y = map(float, point_str.strip().split())
                        coords.append((x, y))
                    
                    # Normalize orientation and shape to match reference polygon
                    normalized_coords = self.normalize_polygon_shape_and_orientation(coords, reference_orientation, reference_aspect)
                    
                    # Create new WKT
                    coords_str = ', '.join([f"{x} {y}" for x, y in normalized_coords])
                    new_wkt = f"POLYGON(({coords_str}))"
                    
                    # Update the polygon in database
                    update_query = text("""
                        UPDATE features 
                        SET geom = ST_GeomFromText(:wkt, 3857)
                        WHERE id = :feature_id
                    """)
                    
                    conn.execute(update_query, {
                        'wkt': new_wkt,
                        'feature_id': feature_id
                    })
                    
                    if (i + 1) % 100 == 0:
                        print(f"Processed {i + 1}/{len(polygons)} polygons...")
                
                # Commit transaction
                trans.commit()
                print(f"Successfully normalized {len(polygons)} polygons")
                
            except Exception as e:
                trans.rollback()
                print(f"Error during normalization: {e}")
                raise
    
    def normalize_all_layers(self):
        """Normalize polygons in all layers."""
        with self.engine.connect() as conn:
            # Get all layers
            query = text("""
                SELECT id, name 
                FROM layers 
                WHERE id IN (
                    SELECT DISTINCT layer_id 
                    FROM features 
                    WHERE ST_GeometryType(geom) = 'ST_Polygon'
                )
                ORDER BY id
            """)
            
            result = conn.execute(query)
            layers = result.fetchall()
            
            print(f"Found {len(layers)} layers with polygons")
            
            for layer_id, layer_name in layers:
                print(f"\nProcessing layer: {layer_name} (ID: {layer_id})")
                self.normalize_all_polygons(layer_id)


def main():
    """Main entry point."""
    print("Polygon Orientation Normalization Script")
    print("=" * 50)
    
    normalizer = PolygonOrientationNormalizer()
    normalizer.normalize_all_layers()
    
    print("\nNormalization completed successfully!")


if __name__ == "__main__":
    main()
