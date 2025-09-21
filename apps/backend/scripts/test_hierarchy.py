#!/usr/bin/env python3
"""
Test script to verify the hierarchy structure is correct for sunburst visualization.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


def test_hierarchy():
    """Test the hierarchy structure for sunburst visualization."""
    print("Testing hierarchy structure for sunburst...")
    print("=" * 60)
    
    engine = create_engine(settings.sync_database_url)
    
    with engine.connect() as conn:
        # Test the hierarchy structure
        print("Hierarchy structure by level:")
        print("-" * 40)
        
        hierarchy_query = text("""
            SELECT 
                level,
                COUNT(*) as count,
                COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as root_count,
                COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as child_count
            FROM features 
            WHERE layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            GROUP BY level
            ORDER BY level
        """)
        
        result = conn.execute(hierarchy_query)
        hierarchy_stats = result.fetchall()
        
        print(f"{'Level':<8} {'Total':<6} {'Root':<6} {'Child':<6}")
        print("-" * 30)
        
        for stat in hierarchy_stats:
            level = stat[0]
            total = stat[1]
            root = stat[2]
            child = stat[3]
            print(f"{level:<8} {total:<6} {root:<6} {child:<6}")
        
        # Test cona-based hierarchy
        print("\n" + "=" * 60)
        print("Cona-based hierarchy validation:")
        print("-" * 40)
        
        cona_validation_query = text("""
            SELECT 
                f1.level as child_level,
                f1.cona as child_cona,
                f1.name as child_name,
                f2.level as parent_level,
                f2.cona as parent_cona,
                f2.name as parent_name,
                CASE 
                    WHEN f1.level = 'subzone' AND f2.level = 'polje' AND f2.cona = SUBSTRING(f1.cona, 1, 4) THEN 'CORRECT'
                    WHEN f1.level = 'vrsta' AND f2.level = 'subzone' AND f2.cona = SUBSTRING(f1.cona, 1, 5) THEN 'CORRECT'
                    WHEN f1.level = 'vrsta' AND f2.level = 'polje' AND f2.cona = SUBSTRING(f1.cona, 1, 4) THEN 'CORRECT (direct)'
                    ELSE 'INCORRECT'
                END as relationship_status
            FROM features f1
            LEFT JOIN features f2 ON f1.parent_id = f2.id
            WHERE f1.layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            AND f1.parent_id IS NOT NULL
            ORDER BY f1.level, f1.cona
            LIMIT 20
        """)
        
        result = conn.execute(cona_validation_query)
        relationships = result.fetchall()
        
        print(f"{'Child':<12} {'Child Cona':<10} {'Parent':<12} {'Parent Cona':<12} {'Status':<15}")
        print("-" * 70)
        
        for rel in relationships:
            child_level = rel[0]
            child_cona = rel[1] or 'NULL'
            child_name = rel[2] or 'NULL'
            parent_level = rel[3] or 'NULL'
            parent_cona = rel[4] or 'NULL'
            parent_name = rel[5] or 'NULL'
            status = rel[6]
            
            print(f"{child_level:<12} {child_cona:<10} {parent_level:<12} {parent_cona:<12} {status:<15}")
        
        # Test specific example from your data
        print("\n" + "=" * 60)
        print("Specific example - LJ za peskanje na pretočn hierarchy:")
        print("-" * 40)
        
        example_query = text("""
            WITH RECURSIVE hierarchy AS (
                -- Root polje features
                SELECT id, name, cona, level, parent_id, 0 as depth
                FROM features 
                WHERE layer_id IN (
                    SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
                )
                AND level = 'polje'
                AND cona LIKE '5001%'
                
                UNION ALL
                
                -- Child features
                SELECT f.id, f.name, f.cona, f.level, f.parent_id, h.depth + 1
                FROM features f
                JOIN hierarchy h ON f.parent_id = h.id
            )
            SELECT 
                REPEAT('  ', depth) || name as indented_name,
                cona,
                level,
                parent_id
            FROM hierarchy
            ORDER BY cona, depth
        """)
        
        result = conn.execute(example_query)
        example_hierarchy = result.fetchall()
        
        for item in example_hierarchy:
            indented_name = item[0]
            cona = item[1]
            level = item[2]
            parent_id = item[3]
            print(f"{indented_name} [{cona}] ({level}) parent_id={parent_id}")
        
        # Count incorrect relationships
        incorrect_query = text("""
            SELECT COUNT(*) as incorrect_count
            FROM features f1
            LEFT JOIN features f2 ON f1.parent_id = f2.id
            WHERE f1.layer_id IN (
                SELECT id FROM layers WHERE name = 'Odlagalne cone' AND type = 'bulk'
            )
            AND f1.parent_id IS NOT NULL
            AND NOT (
                (f1.level = 'subzone' AND f2.level = 'polje' AND f2.cona = SUBSTRING(f1.cona, 1, 4))
                OR (f1.level = 'vrsta' AND f2.level = 'subzone' AND f2.cona = SUBSTRING(f1.cona, 1, 5))
                OR (f1.level = 'vrsta' AND f2.level = 'polje' AND f2.cona = SUBSTRING(f1.cona, 1, 4))
            )
        """)
        
        result = conn.execute(incorrect_query)
        incorrect_count = result.scalar()
        
        print(f"\nIncorrect relationships: {incorrect_count}")
        
        if incorrect_count == 0:
            print("✅ All relationships are correct!")
        else:
            print("❌ Some relationships are incorrect!")


if __name__ == "__main__":
    test_hierarchy()
