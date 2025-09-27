# Tippecanoe Tile Server

This project converts GeoJSON data to MBTiles format using Tippecanoe and serves it with a tile server.

## Project Structure

- `data/` - Contains input GeoJSON files
- `backend/` - Docker configuration for tippecanoe and tile server
- `frontend/` - React frontend for map visualization
- `output/` - Generated MBTiles files (created after conversion)

## Quick Start

### Option 1: Convert and Serve (Recommended)

```bash
# Make the script executable (Linux/Mac)
chmod +x convert-and-serve.sh

# Run conversion and start tile server
./convert-and-serve.sh
```

### Option 2: Manual Steps

1. **Convert JSON to MBTiles:**
   ```bash
   docker-compose up tippecanoe
   ```

2. **Copy the converted file to local directory:**
   ```bash
   # Create output directory
   mkdir -p ./output
   
   # Copy from Docker volume to local directory
   docker run --rm -v mbtiles_data:/data -v $(pwd)/output:/output alpine cp /data/LTH_factory.mbtiles /output/
   ```

3. **Start the tile server:**
   ```bash
   docker-compose up factory-maps
   ```

### Option 3: Manual Docker Exec (as requested)

If you want to run the conversion manually inside the container:

```bash
# Build the tippecanoe container
docker-compose build tippecanoe

# Run the conversion
docker-compose run --rm tippecanoe -o /output/LTH_factory.mbtiles -zg --drop-densest-as-needed LTH_simplified_vis_clean.json

# Copy the result to local directory
mkdir -p ./output
docker run --rm -v mbtiles_data:/data -v $(pwd)/output:/output alpine cp /data/LTH_factory.mbtiles /output/

# Start the tile server
docker-compose up factory-maps
```

## Accessing the Services

- **Tile Server**: http://localhost:8080
- **Frontend**: http://localhost:3000

## Files Generated

After conversion, you'll find:
- `./output/LTH_factory.mbtiles` - The converted MBTiles file
- The file is also accessible in the Docker volume `mbtiles_data`

## Docker Commands Reference

```bash
# Build all services
docker-compose build

# Run only the conversion
docker-compose up tippecanoe

# Run only the tile server
docker-compose up factory-maps

# Run everything
docker-compose up

# Clean up
docker-compose down
docker volume rm 1_tippecanoe_tileserver_mbtiles_data
```
