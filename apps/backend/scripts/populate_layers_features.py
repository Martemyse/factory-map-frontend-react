#!/usr/bin/env python3
"""
Script to populate layers and features tables from source data.
This script reads from the source database table and creates the hierarchical structure.
Optimized for bulk operations and efficiency.
"""

import sys
import os
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict
import geoalchemy2
from geoalchemy2 import WKTElement

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, insert
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.models import Layer, Feature
from app.config import settings


class DataMigrator:
    def __init__(self):
        # Create engines for source and target databases
        self.source_engine = create_engine(settings.source_database_url)
        self.target_engine = create_engine(settings.sync_database_url)
        self.SessionLocal = sessionmaker(bind=self.target_engine)
        
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

    def create_default_polygon(self, x: float = 0, y: float = 0, width: float = 10, height: float = 10) -> WKTElement:
        """Create a default 10x10 rectangle polygon at given coordinates."""
        # Create a simple rectangle polygon
        wkt = f"POLYGON(({x} {y}, {x + width} {y}, {x + width} {y + height}, {x} {y + height}, {x} {y}))"
        return WKTElement(wkt, srid=3857)

    def migrate_data(self):
        """Main migration function with bulk operations."""
        print("Starting data migration...")
        
        # Get source data
        source_data = self.get_source_data()
        print(f"Found {len(source_data)} active records to migrate")
        
        if not source_data:
            print("No active records found. Exiting.")
            return

        session = self.SessionLocal()
        
        try:
            # Create the main layer
            main_layer = Layer(
                name="Odlagalne cone",
                type="bulk",
                z_index=0,
                visible=True,
                editable=True
            )
            session.add(main_layer)
            session.flush()  # Get the ID
            print(f"Created layer: {main_layer.name} (ID: {main_layer.id})")
            
            # Prepare bulk data
            features_to_insert = []
            feature_map = {}  # (level, name) -> feature_id for parent relationships
            polje_map = {}    # polje_name -> feature_id
            subzone_map = {}  # subzone_name -> feature_id
            
            # Process all records and prepare bulk insert data
            for i, record in enumerate(source_data):
                odlagalna_cona = record["Odlagalna cona"]
                opis = record["Opis"]
                polje = record["Polje"]
                
                # Extract hierarchy
                polje_name, subzone_name, vrsta_name = self.extract_hierarchy(odlagalna_cona)
                
                # Create properties dict
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
                if polje_name not in polje_map:
                    polje_feature = {
                        "layer_id": main_layer.id,
                        "parent_id": None,
                        "name": polje,
                        "opomba": None,
                        "color": None,
                        "level": "polje",
                        "order_index": i,
                        "depth": 0,
                        "properties": properties,
                        "geom": self.create_default_polygon(i * 20, 0),  # Space them out horizontally
                        "x_coord": float(i * 20),
                        "y_coord": 0.0
                    }
                    features_to_insert.append(polje_feature)
                    polje_map[polje_name] = len(features_to_insert) - 1  # Store index for later reference
                    feature_map[("polje", polje)] = len(features_to_insert) - 1
                
                # Create subzone feature if not exists
                if subzone_name not in subzone_map and subzone_name != polje_name:
                    polje_idx = polje_map[polje_name]
                    subzone_feature = {
                        "layer_id": main_layer.id,
                        "parent_id": None,  # Will be set after bulk insert
                        "name": opis,
                        "opomba": opis,
                        "color": None,
                        "level": "subzone",
                        "order_index": i,
                        "depth": 1,
                        "properties": properties,
                        "geom": self.create_default_polygon(i * 20, 10),  # Offset vertically
                        "x_coord": float(i * 20),
                        "y_coord": 10.0
                    }
                    features_to_insert.append(subzone_feature)
                    subzone_map[subzone_name] = len(features_to_insert) - 1
                    feature_map[("subzone", opis)] = len(features_to_insert) - 1
                
                # Create vrsta feature if not exists
                vrsta_key = ("vrsta", opis)
                if vrsta_key not in feature_map and vrsta_name != subzone_name:
                    parent_idx = subzone_map.get(subzone_name, polje_map[polje_name])
                    vrsta_feature = {
                        "layer_id": main_layer.id,
                        "parent_id": None,  # Will be set after bulk insert
                        "name": opis,
                        "opomba": opis,
                        "color": None,
                        "level": "vrsta",
                        "order_index": i,
                        "depth": 2,
                        "properties": properties,
                        "geom": self.create_default_polygon(i * 20, 20),  # Further offset
                        "x_coord": float(i * 20),
                        "y_coord": 20.0
                    }
                    features_to_insert.append(vrsta_feature)
                    feature_map[vrsta_key] = len(features_to_insert) - 1
                
                if (i + 1) % 100 == 0:
                    print(f"Prepared {i + 1} records...")
            
            print(f"Prepared {len(features_to_insert)} features for bulk insert")
            
            # Bulk insert all features
            print("Performing bulk insert...")
            session.bulk_insert_mappings(Feature, features_to_insert)
            session.flush()  # Get the IDs
            
            # Now we need to update parent relationships
            print("Setting up parent relationships...")
            features = session.query(Feature).filter(Feature.layer_id == main_layer.id).all()
            
            # Create maps from feature data to actual feature objects
            feature_objects = {}
            for feature in features:
                key = (feature.level, feature.name)
                feature_objects[key] = feature
            
            # Update parent relationships based on the original data
            for i, record in enumerate(source_data):
                odlagalna_cona = record["Odlagalna cona"]
                opis = record["Opis"]
                polje = record["Polje"]
                
                # Extract hierarchy
                polje_name, subzone_name, vrsta_name = self.extract_hierarchy(odlagalna_cona)
                
                # Update subzone parent relationships
                if subzone_name != polje_name:
                    subzone_key = ("subzone", opis)
                    polje_key = ("polje", polje)
                    if subzone_key in feature_objects and polje_key in feature_objects:
                        subzone_feature = feature_objects[subzone_key]
                        polje_feature = feature_objects[polje_key]
                        subzone_feature.parent_id = polje_feature.id
                        subzone_feature.depth = 1
                
                # Update vrsta parent relationships
                if vrsta_name != subzone_name:
                    vrsta_key = ("vrsta", opis)
                    if vrsta_key in feature_objects:
                        vrsta_feature = feature_objects[vrsta_key]
                        # Try to find subzone parent first
                        if subzone_name != polje_name:
                            subzone_key = ("subzone", opis)
                            if subzone_key in feature_objects:
                                subzone_feature = feature_objects[subzone_key]
                                vrsta_feature.parent_id = subzone_feature.id
                                vrsta_feature.depth = 2
                        else:
                            # Use polje as parent
                            polje_key = ("polje", polje)
                            if polje_key in feature_objects:
                                polje_feature = feature_objects[polje_key]
                                vrsta_feature.parent_id = polje_feature.id
                                vrsta_feature.depth = 1
            
            # Commit all changes
            session.commit()
            
            # Get final counts
            polje_count = session.query(Feature).filter(Feature.layer_id == main_layer.id, Feature.level == "polje").count()
            subzone_count = session.query(Feature).filter(Feature.layer_id == main_layer.id, Feature.level == "subzone").count()
            vrsta_count = session.query(Feature).filter(Feature.layer_id == main_layer.id, Feature.level == "vrsta").count()
            
            print(f"Successfully migrated {len(source_data)} records")
            print(f"Created {polje_count} polje features")
            print(f"Created {subzone_count} subzone features")
            print(f"Created {vrsta_count} vrsta features")
            print(f"Total features created: {polje_count + subzone_count + vrsta_count}")
            
        except Exception as e:
            session.rollback()
            print(f"Error during migration: {e}")
            raise
        finally:
            session.close()


def main():
    """Main entry point."""
    print("Factory Map Data Migration Script")
    print("=" * 40)
    
    migrator = DataMigrator()
    migrator.migrate_data()
    
    print("Migration completed successfully!")


if __name__ == "__main__":
    main()
