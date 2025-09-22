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
            
            # Check if columns already exist
            check_columns = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'features' 
                AND column_name IN ('shape_gl', 'x_coord_gl', 'y_coord_gl')
            """)
            
            existing_columns = conn.execute(check_columns).fetchall()
            existing_column_names = [row[0] for row in existing_columns]
            
            if 'shape_gl' not in existing_column_names:
                print("Adding shape_gl column...")
                conn.execute(text("ALTER TABLE features ADD COLUMN shape_gl JSON"))
                conn.commit()
            else:
                print("shape_gl column already exists")
                
            if 'x_coord_gl' not in existing_column_names:
                print("Adding x_coord_gl column...")
                conn.execute(text("ALTER TABLE features ADD COLUMN x_coord_gl FLOAT"))
                conn.commit()
            else:
                print("x_coord_gl column already exists")
                
            if 'y_coord_gl' not in existing_column_names:
                print("Adding y_coord_gl column...")
                conn.execute(text("ALTER TABLE features ADD COLUMN y_coord_gl FLOAT"))
                conn.commit()
            else:
                print("y_coord_gl column already exists")
            
            # Add comments
            print("Adding column comments...")
            conn.execute(text("""
                COMMENT ON COLUMN features.shape_gl IS 'GeoJSON shape data for MapLibre GL JS rendering'
            """))
            conn.execute(text("""
                COMMENT ON COLUMN features.x_coord_gl IS 'X coordinate for MapLibre GL JS coordinate system'
            """))
            conn.execute(text("""
                COMMENT ON COLUMN features.y_coord_gl IS 'Y coordinate for MapLibre GL JS coordinate system'
            """))
            conn.commit()
            
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
