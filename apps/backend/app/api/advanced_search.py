from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from sqlalchemy import text, create_engine
from app.db import engine
from app.config import settings
import pandas as pd

zabojniki_engine = create_engine(
    settings.source_database_url,
    echo=False
)

router = APIRouter()

@router.get("/advanced-search/annotations")
async def get_filtered_annotations(
    odlagalne_zone: Optional[str] = Query(None, description="Odlagalna zona filter"),
    od_operacije: Optional[int] = Query(None, description="Od operacije filter"),
    do_operacije: Optional[int] = Query(None, description="Do operacije filter"),
    status: Optional[str] = Query(None, description="Status filter (comma-separated)"),
    artikel: Optional[str] = Query(None, description="Artikel filter"),
    dodatne_oznake: Optional[str] = Query(None, description="Dodatne oznake filter (comma-separated)"),
    mode: Optional[str] = Query("agg_Artikel_Cona", description="Aggregation mode"),
    indicator_mode: Optional[str] = Query("Artikel", description="Indicator mode"),
    nalog: Optional[str] = Query(None, description="Nalog filter (contains)"),
    onk: Optional[str] = Query(None, description="ONK filter (contains)")
):
    """
    Get filtered annotations based on zabojniki_proizvodnje_tisna5237_aktivni data
    and join with features table to get only relevant odlagalne cone
    """
    try:
        # print(f"=== ADVANCED SEARCH BACKEND DEBUG ===")
        # print(f"Received parameters:")
        # print(f"  odlagalne_zone: {odlagalne_zone}")
        # print(f"  od_operacije: {od_operacije}")
        # print(f"  do_operacije: {do_operacije}")
        # print(f"  status: {status}")
        # print(f"  artikel: {artikel}")
        # print(f"  dodatne_oznake: {dodatne_oznake}")
        # print(f"  mode: {mode}")
        # print(f"  indicator_mode: {indicator_mode}")
        # print(f"  nalog: {nalog}")
        # print(f"  onk: {onk}")
        
        # Parse comma-separated values
        status_list = status.split(',') if status else []
        dodatne_oznake_list = dodatne_oznake.split(',') if dodatne_oznake else []
        
        # print(f"Parsed lists:")
        # print(f"  status_list: {status_list}")
        # print(f"  dodatne_oznake_list: {dodatne_oznake_list}")
        
        # Build the query to get zabojniki data with odlagalne cone
        where_clauses = []
        params = {}
        
        # Filter by odlagalne_zone
        if odlagalne_zone:
            where_clauses.append("\"Odlagalna cona\" LIKE :odlagalne_zone")
            params["odlagalne_zone"] = f"{odlagalne_zone}%"
        
        # Filter by Operacija range
        if od_operacije is not None:
            where_clauses.append("\"Operacija\" >= :od_operacije")
            params["od_operacije"] = od_operacije
        if do_operacije is not None:
            where_clauses.append("\"Operacija\" <= :do_operacije")
            params["do_operacije"] = do_operacije
        
        # Filter by Status list
        if status_list:
            status_placeholders = []
            for i, status_val in enumerate(status_list):
                placeholder = f"status{i}"
                status_placeholders.append(f":{placeholder}")
                params[placeholder] = status_val
            where_clauses.append("\"Status\" IN (" + ", ".join(status_placeholders) + ")")
        
        # Filter by Artikel pattern
        if artikel:
            where_clauses.append("\"Artikel\" LIKE :artikel")
            params["artikel"] = f"%{artikel}%"
        
        # Filter by Dodatna oznaka zabojnika
        if dodatne_oznake_list:
            dodatna_clauses = []
            for i, oznaka in enumerate(dodatne_oznake_list):
                placeholder = f"dodatna{i}"
                dodatna_clauses.append(f"\"Dodatna oznaka zabojnika\" LIKE :{placeholder}")
                params[placeholder] = f"%{oznaka}%"
            where_clauses.append("(" + " OR ".join(dodatna_clauses) + ")")
        
        # Filter by Nalog (contains)
        if nalog:
            where_clauses.append("\"Nalog\" LIKE :nalog")
            params["nalog"] = f"%{nalog}%"
        
        # Filter by ONK (contains)
        if onk:
            where_clauses.append("\"ONK\" LIKE :onk")
            params["onk"] = f"%{onk}%"
        
        where_clause = ""
        if where_clauses:
            where_clause = "WHERE " + " AND ".join(where_clauses)
        
        # Query to get aggregated zabojniki data with counts per odlagalna cona
        # We need 3 levels of aggregation: 4, 5, and 6 characters
        zabojniki_query = f"""
        WITH aggregated_data AS (
            SELECT 
                "Odlagalna cona",
                LEFT("Odlagalna cona", 4) as cona_4,
                LEFT("Odlagalna cona", 5) as cona_5,
                LEFT("Odlagalna cona", 6) as cona_6,
                COUNT(*) as zabojniki_count
            FROM zabojniki_proizvodnje_tisna5237_aktivni
            {where_clause}
            GROUP BY "Odlagalna cona"
        )
        SELECT 
            "Odlagalna cona",
            cona_4,
            cona_5,
            cona_6,
            zabojniki_count
        FROM aggregated_data
        """
        
        # Execute query to get odlagalne cone with counts from zabojniki database
        print(f"Executing zabojniki query with params: {params}")
        with zabojniki_engine.connect() as connection:
            result = connection.execute(text(zabojniki_query), params)
            zabojniki_data = result.fetchall()
        
        print(f"Zabojniki query returned {len(zabojniki_data)} rows")
        if zabojniki_data:
            print(f"First few rows: {zabojniki_data[:3]}")
        
        if not zabojniki_data:
            print("No zabojniki data found, returning empty result")
            return {
                "annotations": [],
                "total_count": 0,
                "message": "No matching odlagalne cone found"
            }
        
        # Create mappings for different aggregation levels
        cona_counts = {}
        cona_4_counts = {}
        cona_5_counts = {}
        cona_6_counts = {}
        
        for row in zabojniki_data:
            odlagalna_cona = row[0]
            cona_4 = row[1]
            cona_5 = row[2]
            cona_6 = row[3]
            count = row[4]
            
            # Store exact match
            cona_counts[odlagalna_cona] = count
            
            # Aggregate by 4 characters (Polje level)
            cona_4_counts[cona_4] = cona_4_counts.get(cona_4, 0) + count
            
            # Aggregate by 5 characters (Subzone level)
            cona_5_counts[cona_5] = cona_5_counts.get(cona_5, 0) + count
            
            # Aggregate by 6 characters (Vrsta level)
            cona_6_counts[cona_6] = cona_6_counts.get(cona_6, 0) + count
        
        # Get all possible odlagalne cone for features query
        all_odlagalne_cone = set()
        all_odlagalne_cone.update(cona_counts.keys())
        all_odlagalne_cone.update(cona_4_counts.keys())
        all_odlagalne_cone.update(cona_5_counts.keys())
        all_odlagalne_cone.update(cona_6_counts.keys())
        
        # Now get features that match these odlagalne cone
        features_query = """
        SELECT 
            id,
            name,
            color,
            properties,
            ST_AsGeoJSON(geom)::json as geom,
            x_coord,
            y_coord,
            cona,
            max_capacity,
            taken_capacity,
            level
        FROM features
        WHERE cona = ANY(:odlagalne_cone)
        ORDER BY name
        """
        
        # Execute features query from features database
        async with engine.begin() as connection:
            features_result = await connection.execute(text(features_query), {"odlagalne_cone": list(all_odlagalne_cone)})
            features = features_result.fetchall()
        
        # Convert to list of dictionaries
        annotations = []
        for feature in features:
            cona = feature[7]  # feature[7] is cona
            level = feature[10]  # feature[10] is level
            
            # Determine the appropriate count based on level and cona length
            zabojniki_count = 0
            
            if level == 'polje':
                # For polje level, use 4-character aggregation
                cona_4 = cona[:4] if len(cona) >= 4 else cona
                zabojniki_count = cona_4_counts.get(cona_4, 0)
            elif level == 'subzone':
                # For subzone level, use 5-character aggregation
                cona_5 = cona[:5] if len(cona) >= 5 else cona
                zabojniki_count = cona_5_counts.get(cona_5, 0)
            elif level == 'vrsta':
                # For vrsta level, use 6-character aggregation
                cona_6 = cona[:6] if len(cona) >= 6 else cona
                zabojniki_count = cona_6_counts.get(cona_6, 0)
            else:
                # Fallback to exact match
                zabojniki_count = cona_counts.get(cona, 0)
            
            annotation = {
                "id": feature[0],
                "name": feature[1],
                "color": feature[2],
                "properties": feature[3],
                "geom": feature[4],
                "x_coord": float(feature[5]) if feature[5] else None,
                "y_coord": float(feature[6]) if feature[6] else None,
                "cona": cona,
                "max_capacity": feature[8],
                "taken_capacity": zabojniki_count,  # Use aggregated count from zabojniki
                "level": level,
                "shape_gl": None,  # Not available in this database
                "x_coord_gl": None,  # Not available in this database
                "y_coord_gl": None   # Not available in this database
            }
            annotations.append(annotation)
        
        return {
            "annotations": annotations,
            "total_count": len(annotations),
            "filters_applied": {
                "odlagalne_zone": odlagalne_zone,
                "od_operacije": od_operacije,
                "do_operacije": do_operacije,
                "status": status_list,
                "artikel": artikel,
                "dodatne_oznake": dodatne_oznake_list,
                "mode": mode,
                "indicator_mode": indicator_mode,
                "nalog": nalog,
                "onk": onk
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching filtered annotations: {str(e)}")

@router.get("/advanced-search/iframe-url")
async def get_iframe_url(
    odlagalne_zone: Optional[str] = Query(None),
    od_operacije: Optional[int] = Query(None),
    do_operacije: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    artikel: Optional[str] = Query(None),
    dodatne_oznake: Optional[str] = Query(None),
    mode: Optional[str] = Query("agg_Artikel_Cona"),
    indicator_mode: Optional[str] = Query("Artikel"),
    nalog: Optional[str] = Query(None),
    onk: Optional[str] = Query(None)
):
    """
    Generate iframe URL with filter parameters
    """
    try:
        from urllib.parse import urlencode
        
        # Build query parameters
        query_params = {}
        
        if odlagalne_zone:
            query_params['input_odlagalne_zone'] = odlagalne_zone
        if od_operacije is not None:
            query_params['input_od_operacije'] = od_operacije
        if do_operacije is not None:
            query_params['input_do_operacije'] = do_operacije
        if status:
            query_params['dropdown_status'] = status
        if artikel:
            query_params['input_artikel'] = artikel
        if dodatne_oznake:
            query_params['logistika_dropdown_dodatne_oznake'] = dodatne_oznake
        if mode:
            query_params['radiobutton_mode_agg'] = mode
        if indicator_mode:
            query_params['radiobutton_indicator_mode'] = indicator_mode
        if nalog:
            query_params['input_nalog'] = nalog
        if onk:
            query_params['input_onk'] = onk
        
        # Generate URL
        base_url = "http://ecotech.utlth-ol.si:8082/iframe/findzabojnikilokacije"
        if query_params:
            query_string = urlencode(query_params)
            iframe_url = f"{base_url}?{query_string}"
        else:
            iframe_url = base_url
        
        return {
            "iframe_url": iframe_url,
            "parameters": query_params
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating iframe URL: {str(e)}")
