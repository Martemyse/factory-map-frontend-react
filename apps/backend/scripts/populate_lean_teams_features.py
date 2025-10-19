#!/usr/bin/env python3
"""
Migration script to populate features from lean teams data.
Creates hierarchical annotations for lean teams and machines.

Hierarchy:
1. Polje: Lean Team name or "Ostalo" for non-production machines
2. Subzone: Sklop (if present) or Ser. artikel
3. Vrsta: Ser. artikel

Machines are categorized as:
- Production machines: machine name is substring in Stroj_Sklop_concat from lean_teami_definicije_strojev
- Other machines: Ljubljana machines with specific Skupina cifra values
"""

import sys
import os
import json
import colorsys
from typing import Dict, List, Tuple, Set
from collections import defaultdict

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


class LeanTeamsDataMigrator:
    def __init__(self):
        # Create engines for source and target databases
        self.source_engine = create_engine(settings.source_database_url)
        self.target_engine = create_engine(settings.sync_database_url)
        
        # Column names to exclude
        self.excluded_columns = {'TPM', 'Artikel', 'Postaja', 'TPM Pranje', 'TPM PT'}
        
        # Skupina cifra values for "Ostalo" machines
        self.ostalo_skupine = {'10', '20', '50', '90', '200', '220', '230', '240', 
                               '800', '810', '80', '695', '685', '680', '660', '560', '520'}
        
    def get_lean_teams_config(self) -> Dict[str, int]:
        """Fetch lean teams configuration mapping team name to ID."""
        with self.source_engine.connect() as conn:
            query = text("""
                SELECT id, tim
                FROM lean_timi_config
                WHERE identifier IS NULL OR (identifier != '_bosch' AND identifier != '_proizvodnja')
                ORDER BY id
            """)
            result = conn.execute(query)
            return {row.tim: row.id for row in result}
    
    def get_lean_teams_colors(self) -> Dict[str, str]:
        """Fetch lean teams colors mapping team name to color."""
        with self.source_engine.connect() as conn:
            query = text("""
                SELECT tim, color
                FROM lean_timi_config
                WHERE tim IS NOT NULL 
                AND (identifier IS NULL OR (identifier != '_bosch' AND identifier != '_proizvodnja'))
                ORDER BY id
            """)
            result = conn.execute(query)
            colors = {}
            for row in result:
                # Use the color from database, or default to #33acff if null/empty
                color = row.color if row.color and row.color.strip() else "#33acff"
                colors[row.tim] = color
            return colors
    
    def get_production_machines(self) -> Dict[str, str]:
        """Get mapping of machine names to their lean team from lean_teami_definicije_strojev."""
        with self.source_engine.connect() as conn:
            query = text("""
                SELECT DISTINCT
                    ltds.machine,
                    ltds.sheet_name,
                    ltds.column_name
                FROM lean_teami_definicije_strojev ltds
                LEFT JOIN lean_timi_config ltc ON ltds.sheet_name = ltc.tim
                WHERE ltds.sheet_name IS NOT NULL
                  AND ltds.column_name IS NOT NULL
                  AND ltds.machine IS NOT NULL
                  AND ltds.column_name NOT IN :excluded_columns
                  AND (ltc.identifier IS NULL OR (ltc.identifier != '_bosch' AND ltc.identifier != '_proizvodnja'))
                ORDER BY ltds.sheet_name, ltds.machine
            """)
            result = conn.execute(query, {'excluded_columns': tuple(self.excluded_columns)})
            return {row.machine: row.sheet_name for row in result}
    
    def get_machines_data(self) -> List[Dict]:
        """Fetch machine data from sklopi table."""
        with self.source_engine.connect() as conn:
            query = text("""
                SELECT 
                    "Ser. artikel" as ser_artikel,
                    "Serijska številka" as serijska_stevilka,
                    "Opis" as opis,
                    "Sklop" as sklop,
                    "Skupina cifra" as skupina_cifra,
                    "Skupina serijskega artikla" as skupina_serijskega_artikla,
                    "Specifikacija B" as specifikacija_b,
                    "Status" as status,
                    "Proizvajalec" as proizvajalec,
                    "Tip_stroja" as tip_stroja,
                    "Obrat" as obrat,
                    "Oddelek" as oddelek,
                    "Pododdelek" as pododdelek,
                    "Stroj_Sklop_concat" as stroj_sklop_concat
                FROM sklopi_tsfcg2100_porocanje_stroj_provis_uo_infor
                WHERE "Obrat" = 'Ljubljana'
                  AND "Status" = 'Aktivno'
                  AND "Skupina cifra" IN :skupine_cifra
                ORDER BY "Ser. artikel"
            """)
            result = conn.execute(query, {'skupine_cifra': tuple(self.ostalo_skupine)})
            return [dict(row._mapping) for row in result]

    def create_default_polygon_wkt(self, x: float = 0, y: float = 0, level: str = "artikel") -> str:
        """Create a default rectangle polygon WKT string."""
        if level == "polje":
            width, height = 20, 8
        elif level == "subzone":
            width, height = 12, 8
        elif level == "vrsta":
            width, height = 8, 8
        else:  # artikel
            width, height = 6, 6
        
        corners = [
            (x, y), (x + width, y), (x + width, y + height), 
            (x, y + height), (x, y)
        ]
        
        wkt_points = ", ".join([f"{cx} {cy}" for cx, cy in corners])
        return f"POLYGON(({wkt_points}))"
    
    def get_coordinates_within_bounds(self, index: int, total: int, level: int) -> Tuple[float, float]:
        """Calculate coordinates within the factory layout bounds."""
        x_min, x_max = 584000, 1262000
        y_min, y_max = 5350000, 6000000
        
        rows = 28
        cols = (total + rows - 1) // rows
        
        col = index % cols
        row = index // cols
        
        level_offset_x = level * 50000
        level_offset_y = level * 50000
        
        x_spacing = (x_max - x_min) / max(1, cols - 1) if cols > 1 else 0
        y_spacing = (y_max - y_min) / max(1, rows - 1) if rows > 1 else 0
        
        x = x_min + col * x_spacing + level_offset_x
        y = y_min + row * y_spacing + level_offset_y
        
        x = max(x_min, min(x_max - 1000, x))
        y = max(y_min, min(y_max - 1000, y))
        
        return x, y

    def darken_color(self, hex_color: str, factor: float = 0.7) -> str:
        """Darken a hex color by the given factor."""
        hex_color = hex_color.lstrip('#')
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        r = int(r * factor)
        g = int(g * factor)
        b = int(b * factor)
        return f"#{r:02x}{g:02x}{b:02x}"

    def migrate_data(self):
        """Main migration function."""
        print("Starting lean teams data migration...")
        
        # Get configuration
        teams_config = self.get_lean_teams_config()
        print(f"Loaded {len(teams_config)} lean teams from configuration")
        
        team_colors = self.get_lean_teams_colors()
        print(f"Loaded {len(team_colors)} team colors")
        
        # Get production machines mapping
        production_machines = self.get_production_machines()
        print(f"Found {len(production_machines)} production machines")
        
        # Get all machines data
        machines_data = self.get_machines_data()
        print(f"Found {len(machines_data)} total machines to process")
        
        if not machines_data:
            print("No records found. Exiting.")
            return

        # Categorize machines
        categorized_machines = defaultdict(lambda: defaultdict(list))
        
        for machine in machines_data:
            ser_artikel = machine['ser_artikel']
            stroj_sklop_concat = machine['stroj_sklop_concat'] or ''
            
            # Determine which team this machine belongs to
            team_name = None
            for prod_machine, prod_team in production_machines.items():
                if prod_machine in stroj_sklop_concat:
                    team_name = prod_team
                    break
            
            if not team_name:
                team_name = "Ostalo"
            
            # Create subzone key (Sklop or Ser. artikel)
            sklop = machine['sklop']
            subzone_key = sklop if sklop else ser_artikel
            
            categorized_machines[team_name][subzone_key].append(machine)
        
        print(f"Categorized into {len(categorized_machines)} teams/groups")
        for team_name in sorted(categorized_machines.keys()):
            print(f"  {team_name}: {sum(len(v) for v in categorized_machines[team_name].values())} machines")

        with self.target_engine.connect() as conn:
            trans = conn.begin()
            
            try:
                # Get or create layer
                layer_query = text("SELECT id FROM layers WHERE name = 'Stroji' AND type = 'lean_teams'")
                layer_id = conn.execute(layer_query).scalar()
                
                if layer_id is None:
                    layer_id = conn.execute(text("""
                        INSERT INTO layers (name, type, z_index, visible, editable)
                        VALUES ('Stroji', 'lean_teams', 1, true, true)
                        RETURNING id
                    """)).scalar()
                    print(f"Created layer: Stroji (ID: {layer_id})")
                else:
                    conn.execute(text("DELETE FROM features WHERE layer_id = :layer_id"), {'layer_id': layer_id})
                    print(f"Using existing layer: Stroji (ID: {layer_id}), cleared old data")
                
                # Build features
                unique_features = []
                feature_index = 0
                polje_order_indices = {}
                subzone_order_indices = {}
                
                polje_count = 0
                for team_name in sorted(categorized_machines.keys()):
                    team_id = teams_config.get(team_name, 999)  # Use 999 for "Ostalo"
                    team_color = team_colors.get(team_name, "#808080")  # Gray for "Ostalo"
                    
                    x, y = self.get_coordinates_within_bounds(polje_count, len(categorized_machines), 0)
                    
                    # Create polje
                    polje_feature = {
                        'layer_id': layer_id,
                        'parent_id': None,
                        'name': team_name,
                        'opomba': f"Team: {team_name}",
                        'color': team_color,
                        'level': 'polje',
                        'order_index': feature_index,
                        'depth': 0,
                        'properties': json.dumps({'team_name': team_name, 'team_id': team_id}),
                        'geom_wkt': self.create_default_polygon_wkt(x, y, level='polje'),
                        'x_coord': x,
                        'y_coord': y,
                        'cona': f"{team_id:02d}",
                        'max_capacity': None,
                        'taken_capacity': None
                    }
                    unique_features.append(polje_feature)
                    polje_order_indices[team_name] = feature_index
                    feature_index += 1
                    polje_count += 1
                    
                    # Create subzone level
                    subzone_count = 0
                    for subzone_key in sorted(categorized_machines[team_name].keys()):
                        x, y = self.get_coordinates_within_bounds(subzone_count, len(categorized_machines[team_name]), 1)
                        subzone_color = self.darken_color(team_color, 0.7)
                        
                        subzone_feature = {
                            'layer_id': layer_id,
                            'parent_id': None,
                            'name': subzone_key,
                            'opomba': f"{team_name} - {subzone_key}",
                            'color': subzone_color,
                            'level': 'subzone',
                            'order_index': feature_index,
                            'depth': 1,
                            'properties': json.dumps({'team_name': team_name, 'subzone': subzone_key}),
                            'geom_wkt': self.create_default_polygon_wkt(x, y, level='subzone'),
                            'x_coord': x,
                            'y_coord': y,
                            'cona': f"{team_id:02d}{subzone_count+1:02d}",
                            'max_capacity': None,
                            'taken_capacity': None
                        }
                        unique_features.append(subzone_feature)
                        subzone_order_indices[(team_name, subzone_key)] = feature_index
                        feature_index += 1
                        subzone_count += 1
                        
                        # Create vrsta level (3rd level)
                        vrsta_count = 0
                        for machine in categorized_machines[team_name][subzone_key]:
                            x, y = self.get_coordinates_within_bounds(vrsta_count, len(categorized_machines[team_name][subzone_key]), 2)
                            vrsta_color = self.darken_color(team_color, 0.5)
                            
                            vrsta_feature = {
                                'layer_id': layer_id,
                                'parent_id': None,
                                'name': machine['ser_artikel'],
                                'opomba': f"{machine['opis'] or machine['ser_artikel']}",
                                'color': vrsta_color,
                                'level': 'vrsta',
                                'order_index': feature_index,
                                'depth': 2,
                                'properties': json.dumps({
                                    'team_name': team_name,
                                    'subzone': subzone_key,
                                    'ser_artikel': machine['ser_artikel'],
                                    'serijska_stevilka': machine['serijska_stevilka'],
                                    'tip_stroja': machine['tip_stroja'],
                                    'proizvajalec': machine['proizvajalec'],
                                    'specifikacija_b': machine['specifikacija_b'],
                                    'skupina_cifra': machine['skupina_cifra'],
                                    'skupina_serijskega_artikla': machine['skupina_serijskega_artikla'],
                                    'sklop': machine['sklop']
                                }),
                                'geom_wkt': self.create_default_polygon_wkt(x, y, level='vrsta'),
                                'x_coord': x,
                                'y_coord': y,
                                'cona': f"{team_id:02d}{subzone_count:02d}{vrsta_count+1:02d}",
                                'max_capacity': None,
                                'taken_capacity': None
                            }
                            unique_features.append(vrsta_feature)
                            feature_index += 1
                            vrsta_count += 1
                    
                print(f"Prepared {len(unique_features)} features for bulk insert")
                
                # Insert features
                print("Performing bulk insert...")
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
                
                batch_size = 100
                for i in range(0, len(unique_features), batch_size):
                    batch = unique_features[i:i + batch_size]
                    for feature in batch:
                        conn.execute(insert_query, feature)
                    print(f"Inserted batch {i//batch_size + 1}/{(len(unique_features) + batch_size - 1)//batch_size}")
                
                # Set up parent relationships
                print("Setting up parent relationships...")
                
                conn.execute(text("ALTER TABLE features ADD COLUMN IF NOT EXISTS parent_order_index INTEGER"))
                
                # Update subzone parents (subzone -> polje)
                for (team_name, subzone_key), subzone_order_index in subzone_order_indices.items():
                    polje_order_index = polje_order_indices[team_name]
                    conn.execute(text("""
                    UPDATE features 
                        SET parent_order_index = :parent_order_index
                        WHERE layer_id = :layer_id AND order_index = :order_index
                    """), {'layer_id': layer_id, 'parent_order_index': polje_order_index, 'order_index': subzone_order_index})
                
                # Update vrsta parents (vrsta -> subzone)
                conn.execute(text("""
                    UPDATE features f1
                    SET parent_order_index = (
                        SELECT f2.order_index FROM features f2
                        WHERE f2.layer_id = :layer_id 
                        AND f2.level = 'subzone'
                        AND f2.properties::jsonb->>'team_name' = f1.properties::jsonb->>'team_name'
                        AND f2.properties::jsonb->>'subzone' = f1.properties::jsonb->>'subzone'
                        LIMIT 1
                    )
                    WHERE f1.layer_id = :layer_id 
                    AND f1.level = 'vrsta'
                """), {'layer_id': layer_id})
                
                # Update parent_id using parent_order_index
                for level in ['subzone', 'vrsta']:
                    conn.execute(text("""
                    UPDATE features 
                    SET parent_id = (
                        SELECT f2.id FROM features f2
                        WHERE f2.layer_id = :layer_id 
                            AND f2.order_index = features.parent_order_index
                        )
                        WHERE layer_id = :layer_id AND level = :level
                    """), {'layer_id': layer_id, 'level': level})
                
                conn.execute(text("ALTER TABLE features DROP COLUMN IF EXISTS parent_order_index"))
                
                # Debug info
                result = conn.execute(text("""
                    SELECT level, COUNT(*) as total, COUNT(parent_id) as with_parent
                    FROM features WHERE layer_id = :layer_id
                    GROUP BY level ORDER BY level
                """), {'layer_id': layer_id})
                print("Parent relationship debug:")
                for row in result:
                    print(f"  {row[0]}: {row[1]} total, {row[2]} with parent")
                
                trans.commit()
                
                result = conn.execute(text("""
                    SELECT level, COUNT(*) as count
                    FROM features WHERE layer_id = :layer_id
                    GROUP BY level ORDER BY level
                """), {'layer_id': layer_id})
                counts = {row[0]: row[1] for row in result}
                
                print(f"Successfully migrated machines")
                print(f"Created {counts.get('polje', 0)} teams")
                print(f"Created {counts.get('subzone', 0)} subzones")
                print(f"Created {counts.get('vrsta', 0)} vrstas")
                print(f"Total features: {sum(counts.values())}")
                
            except Exception as e:
                trans.rollback()
                print(f"Error during migration: {e}")
                raise


def main():
    """Main entry point."""
    print("Lean Teams Data Migration Script")
    print("=" * 50)
    
    migrator = LeanTeamsDataMigrator()
    migrator.migrate_data()
    
    print("Migration completed successfully!")


if __name__ == "__main__":
    main()
