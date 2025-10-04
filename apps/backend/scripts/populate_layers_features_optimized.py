#!/usr/bin/env python3
"""
Optimized script to populate layers and features tables from source data.
This version uses raw SQL for maximum efficiency.

Creates clean rectangular annotations without rotation.
"""

import sys
import os
import json
import random
import colorsys
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict
import geoalchemy2
from geoalchemy2 import WKTElement
import math

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


class OptimizedDataMigrator:
    def __init__(self):
        # Create engines for source and target databases
        self.source_engine = create_engine(settings.source_database_url)
        self.target_engine = create_engine(settings.sync_database_url)
        
    def get_source_data(self) -> List[Dict]:
        """Fetch data from source table with only active records."""
        with self.source_engine.connect() as conn:
            query = text("""
                SELECT 
                    "Odlagalna cona",
                    "Opis",
                    "Tip zone",
                    "Karantena cona",
                    "Pripadajoča karantena cona",
                    "Karantena cona opis",
                    "Skladišče",
                    "Lokacija",
                    "Cona",
                    "Vrsta",
                    "Polje",
                    "count_aktivni",
                    "count_zaprti"
                FROM zabojniki_proizvodnje_tisna0120_odlagalne_cone
                WHERE ("count_aktivni" > 0 OR "count_zaprti" > 0)
            """)
            
            result = conn.execute(query)
            return [dict(row._mapping) for row in result]

    def extract_hierarchy(self, odlagalna_cona: str) -> Tuple[str, str, str]:
        """
        Extract polje, subzone, and vrsta from Odlagalna cona.
        - Polje: first 4 characters
        - Subzone: first 5 characters  
        - Vrsta: first 6 characters
        """
        if len(odlagalna_cona) >= 6:
            return odlagalna_cona[:4], odlagalna_cona[:5], odlagalna_cona[:6]
        elif len(odlagalna_cona) >= 5:
            return odlagalna_cona[:4], odlagalna_cona[:5], odlagalna_cona
        elif len(odlagalna_cona) >= 4:
            return odlagalna_cona[:4], odlagalna_cona, odlagalna_cona
        else:
            return odlagalna_cona, odlagalna_cona, odlagalna_cona


    def create_default_polygon_wkt(self, x: float = 0, y: float = 0, width: float = 5, height: float = 5, level: str = "vrsta") -> str:
        """Create a default rectangle polygon WKT string."""
        # Create more reasonable rectangle proportions
        if level == "polje":
            width = 20  # Reduced from 60 to make it less extreme
            height = 8  # Increased from 5 to make it more square-like
        elif level == "subzone":
            width = 12
            height = 8
        else:  # vrsta
            width = 8
            height = 8
        
        # Create rectangle corners (no rotation here - will be done in database)
        corners = [
            (x, y),                    # bottom-left
            (x + width, y),            # bottom-right
            (x + width, y + height),   # top-right
            (x, y + height),           # top-left
            (x, y)                     # close the ring
        ]
        
        # Create WKT string
        wkt_points = ", ".join([f"{cx} {cy}" for cx, cy in corners])
        return f"POLYGON(({wkt_points}))"
    
    def get_coordinates_within_bounds(self, index: int, total: int, level: int) -> tuple[float, float]:
        """Calculate coordinates within the factory layout bounds for proper distribution."""
        # Factory layout bounds (Web Mercator EPSG:3857 coordinates)
        # Based on factory tile bounds: west=5.246049, east=11.329715, south=43.261091, north=47.162805
        x_min, x_max = 584000, 1262000  # Web Mercator X bounds for factory area
        y_min, y_max = 5350000, 6000000  # Web Mercator Y bounds for factory area
        
        # Use a grid that covers the factory layout area
        rows = 28
        cols = (total + rows - 1) // rows  # Calculate columns needed
        
        # Calculate position in grid
        col = index % cols
        row = index // cols
        
        # Add level offset for hierarchy (polje=0, subzone=1, vrsta=2)
        # Use larger offsets to spread annotations across the factory
        level_offset_x = level * 50000  # 50k units offset per level
        level_offset_y = level * 50000  # 50k units offset per level
        
        # Calculate spacing across the factory area
        x_spacing = (x_max - x_min) / max(1, cols - 1) if cols > 1 else 0
        y_spacing = (y_max - y_min) / max(1, rows - 1) if rows > 1 else 0
        
        # Calculate coordinates
        x = x_min + col * x_spacing + level_offset_x
        y = y_min + row * y_spacing + level_offset_y
        
        # Ensure coordinates stay within factory bounds
        x = max(x_min, min(x_max - 1000, x))  # Leave 1000 units margin
        y = max(y_min, min(y_max - 1000, y))  # Leave 1000 units margin
        
        return x, y

    def convert_to_maplibre_coords(self, x: float, y: float) -> Tuple[float, float]:
        """Convert Web Mercator coordinates to longitude/latitude for MapLibre GL."""
        import math
        
        # Convert Web Mercator (EPSG:3857) to lat/lng
        lng = (x / 20037508.34) * 180
        lat = (y / 20037508.34) * 180
        lat = 180 / math.pi * (2 * math.atan(math.exp(lat * math.pi / 180)) - math.pi / 2)
        
        return lng, lat

    def generate_color_palette(self, num_colors: int) -> List[str]:
        """Generate a distinct color palette for the given number of colors."""
        colors = []
        for i in range(num_colors):
            # Generate colors with good distribution
            hue = (i * 137.5) % 360  # Golden angle for good distribution
            saturation = 0.7 + (i % 3) * 0.1  # Vary saturation slightly
            lightness = 0.5 + (i % 2) * 0.2   # Vary lightness slightly
            
            # Convert HSL to RGB
            rgb = colorsys.hls_to_rgb(hue/360, lightness, saturation)
            # Convert to hex
            hex_color = f"#{int(rgb[0]*255):02x}{int(rgb[1]*255):02x}{int(rgb[2]*255):02x}"
            colors.append(hex_color)
        
        return colors

    def darken_color(self, hex_color: str, factor: float = 0.7) -> str:
        """Darken a hex color by the given factor."""
        # Remove # if present
        hex_color = hex_color.lstrip('#')
        
        # Convert to RGB
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        
        # Darken by factor
        r = int(r * factor)
        g = int(g * factor)
        b = int(b * factor)
        
        # Convert back to hex
        return f"#{r:02x}{g:02x}{b:02x}"

    def get_cona_value(self, odlagalna_cona: str, level: str) -> str:
        """Get the cona value based on the level and odlagalna_cona."""
        if level == "polje":
            return odlagalna_cona[:4] if len(odlagalna_cona) >= 4 else odlagalna_cona
        elif level == "subzone":
            return odlagalna_cona[:5] if len(odlagalna_cona) >= 5 else odlagalna_cona
        else:  # vrsta
            return odlagalna_cona  # Full length

    def calculate_capacity(self, count_aktivni: int, count_zaprti: int) -> tuple[int, int]:
        """Calculate max_capacity and taken_capacity based on counts."""
        # Max capacity is the total of active and closed
        max_capacity = count_aktivni + count_zaprti
        
        # Taken capacity is the closed count (assuming closed means taken/occupied)
        taken_capacity = count_zaprti
        
        return max_capacity, taken_capacity

    def migrate_data(self):
        """Main migration function using raw SQL for maximum efficiency."""
        print("Starting optimized data migration...")
        
        # Get source data
        source_data = self.get_source_data()
        print(f"Found {len(source_data)} active records to migrate")
        
        if not source_data:
            print("No active records found. Exiting.")
            return

        with self.target_engine.connect() as conn:
            # Start transaction
            trans = conn.begin()
            
            try:
                # Clear existing features for this layer to avoid duplicates
                clear_query = text("""
                    DELETE FROM features WHERE layer_id IN (
                        SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
                    )
                """)
                conn.execute(clear_query)
                print("Cleared existing features for fresh migration")
                
                # Get or create the main layer
                layer_query = text("""
                    SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
                """)
                layer_result = conn.execute(layer_query)
                layer_id = layer_result.scalar()
                
                if layer_id is None:
                    # Create the layer if it doesn't exist
                    create_layer_query = text("""
                        INSERT INTO layers (name, type, z_index, visible, editable)
                        VALUES ('Odlagalne cone', 'bulk', 0, true, true)
                        RETURNING id
                    """)
                    layer_result = conn.execute(create_layer_query)
                    layer_id = layer_result.scalar()
                    print(f"Created layer: Odlagalne cone (ID: {layer_id})")
                else:
                    print(f"Using existing layer: Odlagalne cone (ID: {layer_id})")
                
                # Collect unique features to avoid duplicates
                unique_features = {}  # (level, cona) -> feature_data
                polje_map = {}        # polje_cona -> feature_data
                subzone_map = {}      # subzone_cona -> feature_data
                
                # Count features for coordinate distribution
                polje_count = 0
                subzone_count = 0
                vrsta_count = 0
                
                # Collect all unique polje names for color generation
                unique_polje_names = set()
                
                # First pass: collect all unique polje names
                for record in source_data:
                    odlagalna_cona = record["Odlagalna cona"]
                    polje_name, _, _ = self.extract_hierarchy(odlagalna_cona)
                    unique_polje_names.add(polje_name)
                
                # Generate color palette for all unique polje names
                polje_colors = {}
                color_palette = self.generate_color_palette(len(unique_polje_names))
                for i, polje_name in enumerate(sorted(unique_polje_names)):
                    polje_colors[polje_name] = color_palette[i]
                
                print(f"Generated color palette for {len(unique_polje_names)} unique polje names")
                
                # Process all records and collect unique features
                for i, record in enumerate(source_data):
                    odlagalna_cona = record["Odlagalna cona"]
                    opis = record["Opis"]
                    polje = record["Polje"]
                    
                    # Extract hierarchy
                    polje_name, subzone_name, vrsta_name = self.extract_hierarchy(odlagalna_cona)
                    
                    # Create properties JSON
                    properties = {
                        "odlagalna_cona": odlagalna_cona,
                        "tip_zone": record["Tip zone"],
                        "karantena_cona": record["Karantena cona"],
                        "pripadajoca_karantena_cona": record["Pripadajoča karantena cona"],
                        "karantena_cona_opis": record["Karantena cona opis"],
                        "skladisce": record["Skladišče"],
                        "lokacija": record["Lokacija"],
                        "cona": record["Cona"],
                        "vrsta": record["Vrsta"],
                        "count_aktivni": record["count_aktivni"],
                        "count_zaprti": record["count_zaprti"]
                    }
                    
                    # Create polje feature if not exists
                    polje_cona = self.get_cona_value(odlagalna_cona, "polje")
                    if polje_cona not in polje_map:
                        # Calculate capacity for polje (sum of all records with same polje cona)
                        polje_max_capacity = 0
                        polje_taken_capacity = 0
                        for record in source_data:
                            record_polje_cona = self.get_cona_value(record["Odlagalna cona"], "polje")
                            if record_polje_cona == polje_cona:
                                max_cap, taken_cap = self.calculate_capacity(
                                    record["count_aktivni"], record["count_zaprti"]
                                )
                                polje_max_capacity += max_cap
                                polje_taken_capacity += taken_cap
                        
                        # Calculate coordinates within bounds
                        x, y = self.get_coordinates_within_bounds(polje_count, len(unique_polje_names), 0)
                        
                        # Note: GL coordinates are now computed from PostGIS geometry
                        
                        polje_feature = {
                            "layer_id": layer_id,
                            "parent_id": None,
                            "name": f"{polje or f'Polje_{polje_cona}'} ({polje_cona})",  # Use Polje field for polje level with cona
                            "opomba": None,
                            "color": polje_colors[polje_name],  # Assign unique color
                            "level": "polje",
                            "order_index": i,
                            "depth": 0,
                            "properties": properties,
                            "geom_wkt": self.create_default_polygon_wkt(x, y, level="polje"),
                            "x_coord": x,
                            "y_coord": y,
                            "cona": polje_cona,  # First 4 chars
                            "max_capacity": polje_max_capacity,
                            "taken_capacity": polje_taken_capacity
                        }
                        polje_count += 1
                        polje_map[polje_cona] = polje_feature
                        unique_features[("polje", polje_cona)] = polje_feature
                    
                    # Create subzone feature if not exists
                    subzone_cona = self.get_cona_value(odlagalna_cona, "subzone")
                    if subzone_cona not in subzone_map and subzone_cona != polje_cona:
                        # Get parent polje color and darken it
                        parent_color = polje_colors[polje_name]
                        subzone_color = self.darken_color(parent_color, 0.8)
                        
                        # Calculate capacity for subzone (sum of all records with same subzone cona)
                        subzone_max_capacity = 0
                        subzone_taken_capacity = 0
                        for record in source_data:
                            record_subzone_cona = self.get_cona_value(record["Odlagalna cona"], "subzone")
                            if record_subzone_cona == subzone_cona:
                                max_cap, taken_cap = self.calculate_capacity(
                                    record["count_aktivni"], record["count_zaprti"]
                                )
                                subzone_max_capacity += max_cap
                                subzone_taken_capacity += taken_cap
                        
                        # Calculate coordinates within bounds
                        x, y = self.get_coordinates_within_bounds(subzone_count, len(unique_features), 1)
                        
                        # Note: GL coordinates are now computed from PostGIS geometry
                        
                        subzone_feature = {
                            "layer_id": layer_id,
                            "parent_id": None,  # Will be set later
                            "name": f"{opis or f'Subzone_{subzone_cona}'} ({subzone_cona})",  # Use Opis field for subzone level with cona
                            "opomba": opis or f"Subzone_{subzone_cona}",
                            "color": subzone_color,  # Darker version of parent color
                            "level": "subzone",
                            "order_index": i,
                            "depth": 1,
                            "properties": properties,
                            "geom_wkt": self.create_default_polygon_wkt(x, y, level="subzone"),
                            "x_coord": x,
                            "y_coord": y,
                            "cona": subzone_cona,  # First 5 chars
                            "max_capacity": subzone_max_capacity,
                            "taken_capacity": subzone_taken_capacity
                        }
                        subzone_count += 1
                        subzone_map[subzone_cona] = subzone_feature
                        unique_features[("subzone", subzone_cona)] = subzone_feature
                    
                    # Create vrsta feature if not exists
                    vrsta_cona = self.get_cona_value(odlagalna_cona, "vrsta")
                    vrsta_key = ("vrsta", vrsta_cona)
                    if vrsta_key not in unique_features and vrsta_cona != subzone_cona:
                        # Get parent polje color and darken it more for vrsta
                        parent_color = polje_colors[polje_name]
                        vrsta_color = self.darken_color(parent_color, 0.6)
                        
                        # Calculate capacity for vrsta (sum of all records with same vrsta cona)
                        vrsta_max_capacity = 0
                        vrsta_taken_capacity = 0
                        for record in source_data:
                            record_vrsta_cona = self.get_cona_value(record["Odlagalna cona"], "vrsta")
                            if record_vrsta_cona == vrsta_cona:
                                max_cap, taken_cap = self.calculate_capacity(
                                    record["count_aktivni"], record["count_zaprti"]
                                )
                                vrsta_max_capacity += max_cap
                                vrsta_taken_capacity += taken_cap
                        
                        # Calculate coordinates within bounds
                        x, y = self.get_coordinates_within_bounds(vrsta_count, len(unique_features), 2)
                        
                        # Note: GL coordinates are now computed from PostGIS geometry
                        
                        vrsta_feature = {
                            "layer_id": layer_id,
                            "parent_id": None,  # Will be set later
                            "name": f"{opis or f'Vrsta_{vrsta_cona}'} ({vrsta_cona})",  # Use Opis field for vrsta level with cona
                            "opomba": opis or f"Vrsta_{vrsta_cona}",
                            "color": vrsta_color,  # Even darker version of parent color
                            "level": "vrsta",
                            "order_index": i,
                            "depth": 2,
                            "properties": properties,
                            "geom_wkt": self.create_default_polygon_wkt(x, y, level="vrsta"),
                            "x_coord": x,
                            "y_coord": y,
                            "cona": vrsta_cona,  # Full length
                            "max_capacity": vrsta_max_capacity,
                            "taken_capacity": vrsta_taken_capacity
                        }
                        vrsta_count += 1
                        unique_features[vrsta_key] = vrsta_feature
                    
                    if (i + 1) % 100 == 0:
                        print(f"Processed {i + 1} records...")
                
                print(f"Prepared {len(unique_features)} unique features for bulk insert")
                
                # Insert all features using parameterized queries
                print("Performing bulk insert...")
                
                # Prepare the insert query
                features_list = list(unique_features.values())
                
                insert_query = text("""
                    INSERT INTO features (
                        layer_id, parent_id, name, opomba, color, level, 
                        order_index, depth, properties, geom, x_coord, y_coord,
                        cona, max_capacity, taken_capacity
                    ) VALUES (
                        :layer_id, :parent_id, :name, :opomba, :color, :level,
                        :order_index, :depth, :properties, 
                        ST_GeomFromText(:geom_wkt, 3857), :x_coord, :y_coord,
                        :cona, :max_capacity, :taken_capacity
                    )
                """)
                
                # No rotation - create clean rectangular annotations
                
                # Insert features in batches for better performance
                batch_size = 100
                for i in range(0, len(features_list), batch_size):
                    batch = features_list[i:i + batch_size]
                    
                    for feature in batch:
                        # Prepare the feature data
                        feature_data = {
                            'layer_id': feature['layer_id'],
                            'parent_id': None,
                            'name': feature['name'] or '',
                            'opomba': feature['opomba'],
                            'color': feature['color'],
                            'level': feature['level'],
                            'order_index': feature['order_index'],
                            'depth': feature['depth'],
                            'properties': json.dumps(feature['properties']),
                            'geom_wkt': feature['geom_wkt'],
                            'x_coord': feature['x_coord'],
                            'y_coord': feature['y_coord'],
                            'cona': feature['cona'],
                            'max_capacity': feature['max_capacity'],
                            'taken_capacity': feature['taken_capacity'],
                        }
                        
                        conn.execute(insert_query, feature_data)
                    
                    print(f"Inserted batch {i//batch_size + 1}/{(len(features_list) + batch_size - 1)//batch_size}")
                
                # Now update parent relationships based on cona field hierarchy
                print("Setting up parent relationships based on cona hierarchy...")
                
                # Update subzone parent relationships (5-char cona -> 4-char cona)
                subzone_update_query = text("""
                    UPDATE features 
                    SET parent_id = (
                        SELECT f2.id FROM features f2
                        WHERE f2.layer_id = :layer_id 
                        AND f2.level = 'polje' 
                        AND f2.cona = SUBSTRING(features.cona, 1, 4)
                    )
                    WHERE layer_id = :layer_id 
                    AND level = 'subzone' 
                    AND LENGTH(cona) = 5
                """)
                conn.execute(subzone_update_query, {'layer_id': layer_id})
                
                # Update vrsta parent relationships (6+ char cona -> 5-char cona if exists, otherwise 4-char cona)
                vrsta_update_query = text("""
                    UPDATE features 
                    SET parent_id = (
                        SELECT f2.id FROM features f2
                        WHERE f2.layer_id = :layer_id 
                        AND f2.level = 'subzone' 
                        AND f2.cona = SUBSTRING(features.cona, 1, 5)
                        AND LENGTH(f2.cona) = 5
                        LIMIT 1
                    )
                    WHERE layer_id = :layer_id 
                    AND level = 'vrsta' 
                    AND LENGTH(cona) > 5
                    AND EXISTS (
                        SELECT 1 FROM features f3
                        WHERE f3.layer_id = :layer_id 
                        AND f3.level = 'subzone' 
                        AND f3.cona = SUBSTRING(features.cona, 1, 5)
                        AND LENGTH(f3.cona) = 5
                    )
                """)
                conn.execute(vrsta_update_query, {'layer_id': layer_id})
                
                # Update remaining vrsta features that don't have subzone parents (direct to polje)
                vrsta_direct_update_query = text("""
                    UPDATE features 
                    SET parent_id = (
                        SELECT f2.id FROM features f2
                        WHERE f2.layer_id = :layer_id 
                        AND f2.level = 'polje' 
                        AND f2.cona = SUBSTRING(features.cona, 1, 4)
                    )
                    WHERE layer_id = :layer_id 
                    AND level = 'vrsta' 
                    AND parent_id IS NULL
                """)
                conn.execute(vrsta_direct_update_query, {'layer_id': layer_id})
                
                # Commit transaction
                trans.commit()
                
                # Get final counts
                count_query = text("""
                    SELECT 
                        level,
                        COUNT(*) as count
                    FROM features 
                    WHERE layer_id = :layer_id
                    GROUP BY level
                    ORDER BY level
                """)
                result = conn.execute(count_query, {'layer_id': layer_id})
                counts = {row[0]: row[1] for row in result}
                
                print(f"Successfully migrated {len(source_data)} records")
                print(f"Created {counts.get('polje', 0)} polje features")
                print(f"Created {counts.get('subzone', 0)} subzone features")
                print(f"Created {counts.get('vrsta', 0)} vrsta features")
                print(f"Total features created: {sum(counts.values())}")
                
            except Exception as e:
                trans.rollback()
                print(f"Error during migration: {e}")
                raise


def main():
    """Main entry point."""
    print("Factory Map Optimized Data Migration Script")
    print("=" * 50)
    
    migrator = OptimizedDataMigrator()
    migrator.migrate_data()
    
    print("Migration completed successfully!")


if __name__ == "__main__":
    main()
