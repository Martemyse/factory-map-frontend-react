#!/usr/bin/env python3
"""
Diagnostic script to check what's in the source database table.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


def diagnose_source_data():
    """Check what's in the source table."""
    print("Diagnosing source database...")
    print(f"Source database: {settings.source_pg_db}")
    print(f"Source URL: {settings.source_database_url}")
    print("=" * 50)
    
    source_engine = create_engine(settings.source_database_url)
    
    with source_engine.connect() as conn:
        # Check if table exists
        table_check = text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'zabojniki_proizvodnje_tisna0120_odlagalne_cone'
            )
        """)
        table_exists = conn.execute(table_check).scalar()
        print(f"Table exists: {table_exists}")
        
        if not table_exists:
            # List all tables
            tables_query = text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            tables = conn.execute(tables_query).fetchall()
            print("\nAvailable tables:")
            for table in tables:
                print(f"  - {table[0]}")
            return
        
        # Check total row count
        count_query = text("SELECT COUNT(*) FROM zabojniki_proizvodnje_tisna0120_odlagalne_cone")
        total_count = conn.execute(count_query).scalar()
        print(f"Total rows: {total_count}")
        
        # Check column names
        columns_query = text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'zabojniki_proizvodnje_tisna0120_odlagalne_cone'
            ORDER BY ordinal_position
        """)
        columns = conn.execute(columns_query).fetchall()
        print(f"\nColumns ({len(columns)}):")
        for col in columns:
            print(f"  - {col[0]} ({col[1]})")
        
        # Check for count columns
        count_columns = [col[0] for col in columns if 'count' in col[0].lower()]
        print(f"\nCount-related columns: {count_columns}")
        
        # Sample some data
        sample_query = text("SELECT * FROM zabojniki_proizvodnje_tisna0120_odlagalne_cone LIMIT 5")
        sample_data = conn.execute(sample_query).fetchall()
        print(f"\nSample data (first 5 rows):")
        for i, row in enumerate(sample_data, 1):
            print(f"Row {i}: {dict(row._mapping)}")
        
        # Check for active records with different conditions
        if count_columns:
            for col in count_columns:
                try:
                    active_query = text(f"SELECT COUNT(*) FROM zabojniki_proizvodnje_tisna0120_odlagalne_cone WHERE {col} > 0")
                    active_count = conn.execute(active_query).scalar()
                    print(f"Records with {col} > 0: {active_count}")
                except Exception as e:
                    print(f"Error checking {col}: {e}")
        
        # Check for non-null values in count columns
        for col in count_columns:
            try:
                non_null_query = text(f"SELECT COUNT(*) FROM zabojniki_proizvodnje_tisna0120_odlagalne_cone WHERE {col} IS NOT NULL")
                non_null_count = conn.execute(non_null_query).scalar()
                print(f"Records with {col} IS NOT NULL: {non_null_count}")
            except Exception as e:
                print(f"Error checking {col} for non-null: {e}")


if __name__ == "__main__":
    diagnose_source_data()
