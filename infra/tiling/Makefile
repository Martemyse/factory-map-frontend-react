SHELL := /usr/bin/env bash

.PHONY: tiles serve clean build-tippecanoe

# Usage:
# make tiles INPUT=input.geojson OUTPUT=factory.mbtiles
# make serve MBTILES=factory.mbtiles PORT=8080

INPUT ?= input.geojson
OUTPUT ?= factory.mbtiles
MBTILES ?= $(OUTPUT)
PORT ?= 8080

build-tippecanoe:
	docker compose build tippecanoe

tiles: build-tippecanoe
	docker compose run --rm tippecanoe -o /data/$(OUTPUT) /data/$(INPUT)

serve:
	MBTILES=$(MBTILES) PORT=$(PORT) docker compose up tileserver

clean:
	rm -f $(OUTPUT)


