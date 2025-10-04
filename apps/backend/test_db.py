#!/usr/bin/env python3
import asyncio
from app.db import get_db
from app.crud import list_features

async def main():
    async for db in get_db():
        features = await list_features(db)
        print(f'Found {len(features)} features')
        for f in features:
            print(f'  {f.id}: {f.name} (x:{f.x_coord}, y:{f.y_coord})')
        break

if __name__ == "__main__":
    asyncio.run(main())
