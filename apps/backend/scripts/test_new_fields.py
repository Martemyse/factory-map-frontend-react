#!/usr/bin/env python3
"""
Test script to verify the new cona and capacity fields in the migration results.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


def test_new_fields():
    """Test the new cona and capacity fields."""
    print("Testing new fields (cona, max_capacity, taken_capacity)...")
    print("=" * 60)
    
    engine = create_engine(settings.sync_database_url)
    
    with engine.connect() as conn:
        # Test cona field lengths by level
        print("Cona field lengths by level:")
        print("-" * 40)
        
        cona_query = text("""
            SELECT level, cona, LENGTH(cona) as cona_length, name
            FROM features 
            WHERE layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            ORDER BY level, cona
            LIMIT 20
        """)
        
        result = conn.execute(cona_query)
        features = result.fetchall()
        
        print(f"{'Level':<8} {'Cona':<10} {'Length':<6} {'Name':<30}")
        print("-" * 60)
        
        for feature in features:
            level = feature[0]
            cona = feature[1] or 'NULL'
            length = feature[2] or 0
            name = feature[3] or 'NULL'
            print(f"{level:<8} {cona:<10} {length:<6} {name[:29]:<30}")
        
        # Test capacity fields
        print("\n" + "=" * 60)
        print("Capacity fields by level:")
        print("-" * 40)
        
        capacity_query = text("""
            SELECT level, 
                   AVG(max_capacity) as avg_max_capacity,
                   AVG(taken_capacity) as avg_taken_capacity,
                   MAX(max_capacity) as max_capacity_value,
                   MAX(taken_capacity) as max_taken_capacity,
                   COUNT(*) as feature_count
            FROM features 
            WHERE layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            GROUP BY level
            ORDER BY level
        """)
        
        result = conn.execute(capacity_query)
        capacity_stats = result.fetchall()
        
        print(f"{'Level':<8} {'Avg Max':<10} {'Avg Taken':<10} {'Max Value':<10} {'Max Taken':<10} {'Count':<6}")
        print("-" * 70)
        
        for stat in capacity_stats:
            level = stat[0]
            avg_max = round(stat[1] or 0, 1)
            avg_taken = round(stat[2] or 0, 1)
            max_value = stat[3] or 0
            max_taken = stat[4] or 0
            count = stat[5]
            print(f"{level:<8} {avg_max:<10} {avg_taken:<10} {max_value:<10} {max_taken:<10} {count:<6}")
        
        # Show sample features with all new fields
        print("\n" + "=" * 60)
        print("Sample features with all new fields:")
        print("-" * 60)
        
        sample_query = text("""
            SELECT name, level, cona, max_capacity, taken_capacity, color
            FROM features 
            WHERE layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            AND max_capacity > 0
            ORDER BY max_capacity DESC
            LIMIT 10
        """)
        
        result = conn.execute(sample_query)
        sample_features = result.fetchall()
        
        print(f"{'Name':<25} {'Level':<8} {'Cona':<10} {'Max':<6} {'Taken':<6} {'Color':<10}")
        print("-" * 80)
        
        for feature in sample_features:
            name = feature[0] or 'NULL'
            level = feature[1]
            cona = feature[2] or 'NULL'
            max_cap = feature[3] or 0
            taken_cap = feature[4] or 0
            color = feature[5] or 'NULL'
            print(f"{name[:24]:<25} {level:<8} {cona:<10} {max_cap:<6} {taken_cap:<6} {color:<10}")
        
        # Verify cona field logic
        print("\n" + "=" * 60)
        print("Cona field validation:")
        print("-" * 40)
        
        validation_query = text("""
            SELECT 
                level,
                COUNT(*) as total,
                COUNT(CASE WHEN LENGTH(cona) = 4 THEN 1 END) as length_4,
                COUNT(CASE WHEN LENGTH(cona) = 5 THEN 1 END) as length_5,
                COUNT(CASE WHEN LENGTH(cona) > 5 THEN 1 END) as length_6_plus
            FROM features 
            WHERE layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            AND cona IS NOT NULL
            GROUP BY level
            ORDER BY level
        """)
        
        result = conn.execute(validation_query)
        validation_stats = result.fetchall()
        
        print(f"{'Level':<8} {'Total':<6} {'Len=4':<6} {'Len=5':<6} {'Len>5':<6}")
        print("-" * 40)
        
        for stat in validation_stats:
            level = stat[0]
            total = stat[1]
            len_4 = stat[2]
            len_5 = stat[3]
            len_6_plus = stat[4]
            print(f"{level:<8} {total:<6} {len_4:<6} {len_5:<6} {len_6_plus:<6}")
        
        print("\nValidation rules:")
        print("- Polje level should have cona length = 4")
        print("- Subzone level should have cona length = 5") 
        print("- Vrsta level should have cona length > 5")


if __name__ == "__main__":
    test_new_fields()
