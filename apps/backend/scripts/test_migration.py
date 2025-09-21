#!/usr/bin/env python3
"""
Test script to verify the migration results.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


def test_migration():
    """Test the migration results."""
    engine = create_engine(settings.sync_database_url)
    
    with engine.connect() as conn:
        # Check layers
        result = conn.execute(text("SELECT COUNT(*) FROM layers"))
        layer_count = result.scalar()
        print(f"Layers created: {layer_count}")
        
        # Check features by level
        result = conn.execute(text("""
            SELECT level, COUNT(*) as count 
            FROM features 
            GROUP BY level 
            ORDER BY level
        """))
        print("\nFeatures by level:")
        for row in result:
            print(f"  {row[0]}: {row[1]}")
        
        # Check hierarchy depth
        result = conn.execute(text("""
            SELECT 
                MIN(depth) as min_depth,
                MAX(depth) as max_depth,
                AVG(depth) as avg_depth
            FROM features
        """))
        depth_stats = result.fetchone()
        print(f"\nDepth statistics:")
        print(f"  Min: {depth_stats[0]}")
        print(f"  Max: {depth_stats[1]}")
        print(f"  Avg: {depth_stats[2]:.2f}")
        
        # Check parent-child relationships
        result = conn.execute(text("""
            SELECT 
                COUNT(*) as total_features,
                COUNT(parent_id) as features_with_parent,
                COUNT(*) - COUNT(parent_id) as root_features
            FROM features
        """))
        hierarchy_stats = result.fetchone()
        print(f"\nHierarchy statistics:")
        print(f"  Total features: {hierarchy_stats[0]}")
        print(f"  Features with parent: {hierarchy_stats[1]}")
        print(f"  Root features: {hierarchy_stats[2]}")
        
        # Sample some features
        result = conn.execute(text("""
            SELECT f.name, f.level, f.depth, l.name as layer_name, 
                   pf.name as parent_name
            FROM features f
            JOIN layers l ON f.layer_id = l.id
            LEFT JOIN features pf ON f.parent_id = pf.id
            ORDER BY f.depth, f.name
            LIMIT 10
        """))
        print(f"\nSample features:")
        for row in result:
            parent_info = f" (parent: {row[4]})" if row[4] else " (root)"
            print(f"  {row[0]} [{row[1]}] depth={row[2]}{parent_info}")


if __name__ == "__main__":
    print("Testing migration results...")
    print("=" * 40)
    test_migration()
    print("\nTest completed!")
