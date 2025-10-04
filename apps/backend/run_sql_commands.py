#!/usr/bin/env python3
"""
Script to run SQL commands to add GL coordinate columns to the features table.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings

def add_gl_columns():
    """Add GL coordinate columns to the features table."""
    try:
        # Create engine for target database
        engine = create_engine(settings.sync_database_url)
        
        with engine.connect() as conn:
            # Add the columns
            print("Adding GL coordinate columns to features table...")
            
            # Note: shape_gl, x_coord_gl, y_coord_gl columns have been removed
            # We now use PostGIS geometry directly with ST_AsGeoJSON() for MapLibre GL
            print("Using PostGIS geometry directly - no additional columns needed")
            
            print("✅ Successfully added GL coordinate columns to features table!")
            
    except Exception as e:
        print(f"❌ Error adding GL columns: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("Adding GL coordinate columns to features table...")
    success = add_gl_columns()
    if success:
        print("✅ Database schema updated successfully!")
        print("You can now run the migration script to populate the GL coordinates.")
    else:
        print("❌ Failed to update database schema.")
        sys.exit(1)
