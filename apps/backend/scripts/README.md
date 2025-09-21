# Data Migration Scripts

This directory contains scripts for populating the database with data from external sources.

## Scripts

### `populate_layers_features.py`

Standard version using SQLAlchemy ORM with bulk operations.

### `populate_layers_features_optimized.py` ⚡

**RECOMMENDED** - Optimized version using raw SQL for maximum performance.

Both scripts populate the `layers` and `features` tables from the source table `zabojniki_proizvodnje_tisna0120_odlagalne_cone`.

**Features:**
- Creates a hierarchical structure: polje → subzone → vrsta
- Only migrates records where `count_aktivni > 0` OR `count_zaprti > 0`
- Uses the `Odlagalna cona` field as the primary identifier
- Creates proper parent-child relationships
- **Adds default 10x10 rectangle polygons** for each feature
- **Uses bulk operations** for maximum efficiency

**Hierarchy Logic:**
- **Polje**: First 4 characters of `Odlagalna cona`
- **Subzone**: First 5 characters of `Odlagalna cona` 
- **Vrsta**: First 6 characters of `Odlagalna cona`

**Default Geometry:**
- Each feature gets a 10x10 rectangle polygon
- Features are spaced 20 units apart horizontally
- Different levels are offset vertically (polje=0, subzone=10, vrsta=20)

**Usage:**
```bash
# Activate virtual environment first
# Then run the optimized version (recommended):
python scripts/populate_layers_features_optimized.py

# OR the standard version:
python scripts/populate_layers_features.py

# OR use the simple runner:
python scripts/run_migration.py
```

**Requirements:**
- Virtual environment must be activated
- Both source and target databases must be accessible
- Source table `zabojniki_proizvodnje_tisna0120_odlagalne_cone` must exist in source database (`bpsna_dobri_slabi_lj`)
- Tables `layers` and `features` must exist in target database (run migrations first)

**Database Configuration:**
- **Source Database**: `bpsna_dobri_slabi_lj` (contains production data)
- **Target Database**: `layout_proizvodnja_libre_konva` (where features will be created)
- Both databases use the same connection settings (host, user, password, port)
- You can override the source database by setting `SOURCE_PG_DB` environment variable

### `run_migration.py`

Simple wrapper script to run the migration. Just calls the main function from `populate_layers_features.py`.

## Database Setup

Before running the migration, ensure:

1. Database tables are created:
   ```bash
   alembic upgrade head
   ```

2. Source data table exists with the expected structure

3. Virtual environment is activated:
   ```bash
   # Windows
   .layout_proizvodnja_backend_fastapi\Scripts\activate
   
   # Linux/Mac
   source .layout_proizvodnja_backend_fastapi/bin/activate
   ```

## Output

The script will:
- Create one layer named "Odlagalne cone" of type "bulk"
- Create features with proper hierarchy
- Print progress information
- Show summary of created records
