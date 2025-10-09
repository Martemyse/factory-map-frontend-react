# Advanced Search Implementation Summary

## Overview
Implemented "Napredno iskanje" (Advanced Search) functionality to filter annotations based on `zabojniki_proizvodnje_tisna5237_aktivni` data, joining with the `features` table.

## Key Features

### 1. **Frontend Components**

#### AdvancedSearchModal (`apps/frontend/src/components/AdvancedSearchModal/AdvancedSearchModal.tsx`)
- **Input Fields** (NO Polje, Vrsta, or Cona as requested):
  - `odlagalne_zone` - Text input for odlagalna zona
  - `artikel` - Text input for artikel filter
  - `od_operacije` - Number input (min operation)
  - `do_operacije` - Number input (max operation)
  - `status` - Multi-select dropdown (Za popra, Prevzeto, Defekt, Dodelava, Izmet)
  - `dodatne_oznake` - Multi-select dropdown (Impregnacija, Ponovno peskanje, RTG, Ročno čiščenje)
  - `mode` - Radio buttons (Na vseh conah skupaj, Na posamezni coni)
  - `indicator_mode` - Radio buttons (Po artiklu, Po nalogu)

#### Updated AnnotationEditModal
- Added "Napredno iskanje" button
- Dynamic iframe URL generation with all filter parameters
- Filters are passed to iframe via URL parameters using exact same names as Dash app

#### Updated Viewer Component
- "Napredno iskanje" button in control panel
- Integrated AdvancedSearchModal
- Automatic annotation reload when filters change
- Visual indication of active search mode

### 2. **Backend API**

#### Endpoints (`apps/backend/app/api/advanced_search.py`)

**GET `/api/advanced-search/annotations`**
- Filters `zabojniki_proizvodnje_tisna5237_aktivni` table
- Groups by `Odlagalna cona` and counts rows
- Joins with `features` table on `cona` = `Odlagalna cona`
- Returns only matching annotations with updated `taken_capacity`

**GET `/api/advanced-search/iframe-url`**
- Generates iframe URL with all filter parameters
- Uses same parameter names as Dash app for compatibility

### 3. **Database Integration**

#### Queries
```sql
-- Get zabojniki counts per odlagalna cona
SELECT 
    "Odlagalna cona",
    COUNT(*) as zabojniki_count
FROM zabojniki_proizvodnje_tisna5237_aktivni
WHERE [filters]
GROUP BY "Odlagalna cona"

-- Join with features
SELECT * FROM features
WHERE cona = ANY(:odlagalne_cone)
```

#### Filter Logic
- **odlagalne_zone**: `LIKE 'value%'`
- **od_operacije**: `>= value`
- **do_operacije**: `<= value`
- **status**: `IN (values)`
- **artikel**: `LIKE '%value%'`
- **dodatne_oznake**: `OR` of multiple `LIKE '%value%'`

### 4. **URL Parameter Mapping** (Frontend ↔ Iframe)

| Frontend Filter | URL Parameter | Dash App Input |
|----------------|---------------|----------------|
| `odlagalne_zone` | `input_odlagalne_zone` | `input_odlagalne_zone` |
| `od_operacije` | `input_od_operacije` | `input_od_operacije` |
| `do_operacije` | `input_do_operacije` | `input_do_operacije` |
| `status` | `dropdown_status` | `dropdown_status` |
| `artikel` | `input_artikel` | `input_artikel` |
| `dodatne_oznake` | `logistika_dropdown_dodatne_oznake` | `logistika_dropdown_dodatne_oznake` |
| `mode` | `radiobutton_mode_agg` | `radiobutton_mode_agg` |
| `indicator_mode` | `radiobutton_indicator_mode` | `radiobutton_indicator_mode` |

### 5. **User Flow**

1. User clicks "Napredno iskanje" button
2. Modal opens with all filter inputs
3. User sets filters and clicks "Išči"
4. Backend queries `zabojniki_proizvodnje_tisna5237_aktivni` with filters
5. Backend counts zabojniki per odlagalna cona
6. Backend joins with `features` table
7. Frontend displays only matching annotations with updated capacity
8. User double-clicks annotation → Opens iframe with all filters in URL
9. Dash app reads URL parameters and applies filters

## Technical Details

### Database Tables

#### zabojniki_proizvodnje_tisna5237_aktivni (bpsna_dobri_slabi_lj DB)
- Database: `bpsna_dobri_slabi_lj` (postgres_c container)
- Key columns: `Artikel`, `Nalog`, `Operacija`, `Status`, `Odlagalna cona`, `Dodatna oznaka zabojnika`

#### features (layout_proizvodnja_libre_konva DB)
- Database: `layout_proizvodnja_libre_konva`
- Key columns: `id`, `cona` (matches zabojniki's `Odlagalna cona`), `name`, `geom`, `max_capacity`

### Iframe Integration
- Production URL: `http://ecotech.utlth-ol.si:8090/iframe/findzabojnikilokacije`
- Development URL: `http://127.0.0.1:8050/findzabojnikilokacije`
- All filters passed as query parameters

### Capacity Counting
- `taken_capacity` is set to the COUNT of matching rows from `zabojniki_proizvodnje_tisna5237_aktivni`
- Updates dynamically based on applied filters

## Files Modified

1. `apps/frontend/src/components/AdvancedSearchModal/AdvancedSearchModal.tsx` - NEW
2. `apps/frontend/src/components/AnnotationModal/AnnotationEditModal.tsx` - UPDATED
3. `apps/frontend/src/viewer/Viewer.tsx` - UPDATED
4. `apps/backend/app/api/advanced_search.py` - NEW
5. `apps/backend/app/main.py` - UPDATED

## Testing

### Frontend
```bash
npm run dev
# Navigate to map, click "Napredno iskanje"
# Set filters, verify annotations update
# Double-click annotation, verify iframe URL contains all parameters
```

### Backend
```bash
# Test annotations endpoint
curl "http://localhost:7998/api/advanced-search/annotations?artikel=02&status=Prevzeto"

# Test iframe URL generation
curl "http://localhost:7998/api/advanced-search/iframe-url?artikel=02&status=Prevzeto"
```

## Notes
- **NO** Polje, Vrsta, or Cona filter fields in the modal (as requested)
- Uses `cona` field from features table to match with `Odlagalna cona` from zabojniki
- All zabojniki filters work except Polje/Vrsta (removed from modal)
- Iframe URL uses exact same parameter names as Dash app for seamless integration

