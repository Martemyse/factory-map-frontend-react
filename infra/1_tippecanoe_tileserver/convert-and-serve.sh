#!/bin/bash

# Script to convert JSON to MBTiles and start tile server
# This script will:
# 1. Build and run the tippecanoe conversion
# 2. Copy the converted file to a local directory
# 3. Start the tile server

echo "Building and running tippecanoe conversion..."
docker-compose up tippecanoe

echo "Conversion complete! Copying MBTiles file to local directory..."
# Create output directory if it doesn't exist
mkdir -p ./output

# Copy the converted file from the Docker volume to local directory
docker run --rm -v mbtiles_data:/data -v $(pwd)/output:/output alpine cp /data/LTH_factory.mbtiles /output/

echo "MBTiles file copied to ./output/LTH_factory.mbtiles"
echo "Starting tile server..."
docker-compose up factory-maps
