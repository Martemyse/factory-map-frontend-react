#!/usr/bin/env python3
"""
Test script to verify color assignments and naming in the migration results.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


def test_colors_and_naming():
    """Test the color assignments and naming."""
    print("Testing color assignments and naming...")
    print("=" * 50)
    
    engine = create_engine(settings.sync_database_url)
    
    with engine.connect() as conn:
        # Get features with their colors and names
        query = text("""
            SELECT f.name, f.level, f.color, f.depth, 
                   pf.name as parent_name, pf.color as parent_color
            FROM features f
            LEFT JOIN features pf ON f.parent_id = pf.id
            WHERE f.layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            ORDER BY f.level, f.name
            LIMIT 20
        """)
        
        result = conn.execute(query)
        features = result.fetchall()
        
        print("Sample features with colors:")
        print("-" * 80)
        print(f"{'Name':<30} {'Level':<8} {'Color':<10} {'Depth':<5} {'Parent':<20}")
        print("-" * 80)
        
        for feature in features:
            name = feature[0] or 'None'
            level = feature[1]
            color = feature[2] or 'None'
            depth = feature[3]
            parent_name = feature[4] or 'None'
            
            print(f"{name[:29]:<30} {level:<8} {color:<10} {depth:<5} {parent_name[:19]:<20}")
        
        # Show color distribution by polje
        print("\n" + "=" * 50)
        print("Color distribution by Polje (first 10):")
        print("-" * 50)
        
        polje_query = text("""
            SELECT f.name, f.color, COUNT(*) as feature_count
            FROM features f
            WHERE f.layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            AND f.level = 'polje'
            GROUP BY f.name, f.color
            ORDER BY f.name
            LIMIT 10
        """)
        
        result = conn.execute(polje_query)
        polje_features = result.fetchall()
        
        for polje in polje_features:
            name = polje[0]
            color = polje[1]
            count = polje[2]
            print(f"{name:<30} {color:<10} ({count} features)")
        
        # Show subzone/vrsta colors for a specific polje
        print("\n" + "=" * 50)
        print("Color inheritance example (LJ, STGH 2):")
        print("-" * 50)
        
        inheritance_query = text("""
            SELECT f.name, f.level, f.color, f.depth
            FROM features f
            WHERE f.layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            AND (f.name = 'LJ, STGH 2' OR f.parent_id IN (
                SELECT id FROM features 
                WHERE name = 'LJ, STGH 2' AND level = 'polje'
            ))
            ORDER BY f.depth, f.level
        """)
        
        result = conn.execute(inheritance_query)
        inheritance_features = result.fetchall()
        
        for feature in inheritance_features:
            name = feature[0]
            level = feature[1]
            color = feature[2]
            depth = feature[3]
            indent = "  " * depth
            print(f"{indent}{name:<25} [{level}] {color}")


if __name__ == "__main__":
    test_colors_and_naming()
