-- Add GL coordinate columns to features table
-- Run this script manually against your PostgreSQL database

ALTER TABLE features 
ADD COLUMN shape_gl JSON,
ADD COLUMN x_coord_gl FLOAT,
ADD COLUMN y_coord_gl FLOAT;

-- Add comments for documentation
COMMENT ON COLUMN features.shape_gl IS 'GeoJSON shape data for MapLibre GL JS rendering';
COMMENT ON COLUMN features.x_coord_gl IS 'X coordinate for MapLibre GL JS coordinate system';
COMMENT ON COLUMN features.y_coord_gl IS 'Y coordinate for MapLibre GL JS coordinate system';
