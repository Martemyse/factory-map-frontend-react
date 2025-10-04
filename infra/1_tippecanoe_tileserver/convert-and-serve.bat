@echo off
REM Script to convert JSON to MBTiles and start tile server on Windows

echo Building and running tippecanoe conversion...
docker-compose up tippecanoe

echo Conversion complete! Copying MBTiles file to local directory...
REM Create output directory if it doesn't exist
if not exist "output" mkdir output

REM Copy the converted file from the Docker volume to local directory
docker run --rm -v mbtiles_data:/data -v %cd%/output:/output alpine cp /data/LTH_factory.mbtiles /output/

echo MBTiles file copied to ./output/LTH_factory.mbtiles
echo Starting tile server...
docker-compose up factory-maps
