from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db, engine
import pandas as pd

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
    db: AsyncSession = Depends(get_db)
):
    """
    Get filtered annotations based on zabojniki_proizvodnje_tisna5237_aktivni data
    and join with features table to get only relevant odlagalne cone
    """
    try:
        # Parse comma-separated values
        status_list = status.split(',') if status else []
        dodatne_oznake_list = dodatne_oznake.split(',') if dodatne_oznake else []
        
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
        
        where_clause = ""
        if where_clauses:
            where_clause = "WHERE " + " AND ".join(where_clauses)
        
        # Query to get aggregated zabojniki data with counts per odlagalna cona
        zabojniki_query = f"""
        SELECT 
            "Odlagalna cona",
            COUNT(*) as zabojniki_count
        FROM zabojniki_proizvodnje_tisna5237_aktivni
        {where_clause}
        GROUP BY "Odlagalna cona"
        """
        
        # Execute query to get odlagalne cone with counts
        result = await db.execute(text(zabojniki_query), params)
        zabojniki_data = result.fetchall()
        
        if not zabojniki_data:
            return {
                "annotations": [],
                "total_count": 0,
                "message": "No matching odlagalne cone found"
            }
        
        # Create a mapping of odlagalna_cona to count
        cona_counts = {row[0]: row[1] for row in zabojniki_data}
        odlagalne_cone = list(cona_counts.keys())
        
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
            ST_AsGeoJSON(shape_gl)::json as shape_gl,
            x_coord_gl,
            y_coord_gl
        FROM features
        WHERE cona = ANY(:odlagalne_cone)
        ORDER BY name
        """
        
        # Execute features query
        features_result = await db.execute(text(features_query), {"odlagalne_cone": odlagalne_cone})
        features = features_result.fetchall()
        
        # Convert to list of dictionaries
        annotations = []
        for feature in features:
            # Get the count from zabojniki data
            zabojniki_count = cona_counts.get(feature[7], 0)  # feature[7] is cona
            
            annotation = {
                "id": feature[0],
                "name": feature[1],
                "color": feature[2],
                "properties": feature[3],
                "geom": feature[4],
                "x_coord": float(feature[5]) if feature[5] else None,
                "y_coord": float(feature[6]) if feature[6] else None,
                "cona": feature[7],
                "max_capacity": feature[8],
                "taken_capacity": zabojniki_count,  # Use count from zabojniki
                "shape_gl": feature[10],
                "x_coord_gl": float(feature[11]) if feature[11] else None,
                "y_coord_gl": float(feature[12]) if feature[12] else None
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
                "indicator_mode": indicator_mode
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
    indicator_mode: Optional[str] = Query("Artikel")
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
        
        # Generate URL
        base_url = "http://ecotech.utlth-ol.si:8077/iframe/findzabojnikilokacije"
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
