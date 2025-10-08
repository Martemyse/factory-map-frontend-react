"""
Dash Callbacks for URL Parameter Handling
==========================================

This script contains the Dash callbacks to read filter parameters from URL 
and populate the input fields accordingly.

Add these callbacks to your Dash app to enable URL-based filter loading.
"""

from dash import callback, Output, Input, State
from dash.exceptions import PreventUpdate
from urllib.parse import parse_qs, urlencode

# ============================================================================
# URL SYNC CALLBACKS
# ============================================================================

@callback(
    Output('url', 'search'),
    Input('input_odlagalne_zone', 'value'),
    Input('input_od_operacije', 'value'),
    Input('input_do_operacije', 'value'),
    Input('dropdown_status', 'value'),
    Input('input_artikel', 'value'),
    Input('logistika_dropdown_dodatne_oznake', 'value'),
    Input('radiobutton_mode_agg', 'value'),
    Input('radiobutton_indicator_mode', 'value'),
    State('url', 'search'),
    prevent_initial_call=True
)
def update_url_with_all_filters(
    odlagalne_zone, od_operacije, do_operacije, status_list, artikel,
    dodatne_oznake, mode_agg, indicator_mode, current_search
):
    """
    Update URL query string with all filter values.
    This allows sharing filtered views via URL.
    """
    query_params = {}
    
    if odlagalne_zone:
        query_params['input_odlagalne_zone'] = odlagalne_zone
    if od_operacije is not None:
        query_params['input_od_operacije'] = od_operacije
    if do_operacije is not None:
        query_params['input_do_operacije'] = do_operacije
    if status_list:
        # Convert list to comma-separated string
        query_params['dropdown_status'] = ','.join(status_list) if isinstance(status_list, list) else status_list
    if artikel:
        query_params['input_artikel'] = artikel
    if dodatne_oznake:
        # Convert list to comma-separated string
        query_params['logistika_dropdown_dodatne_oznake'] = ','.join(dodatne_oznake) if isinstance(dodatne_oznake, list) else dodatne_oznake
    if mode_agg:
        query_params['radiobutton_mode_agg'] = mode_agg
    if indicator_mode:
        query_params['radiobutton_indicator_mode'] = indicator_mode
    
    if not query_params:
        return ''  # Clear URL if no filters
    
    return '?' + urlencode(query_params)


# ============================================================================
# URL TO FILTERS CALLBACKS
# ============================================================================

@callback(
    Output('input_odlagalne_zone', 'value'),
    State('url', 'search'),
    Input('url', 'pathname'),  # Trigger on page load
    prevent_initial_call=False
)
def load_odlagalne_zone_from_url(search, pathname):
    """Load odlagalne_zone from URL query string."""
    if not search:
        raise PreventUpdate
    
    parsed = parse_qs(search.lstrip('?'))
    value = parsed.get('input_odlagalne_zone', [None])[0]
    
    if not value:
        raise PreventUpdate
    
    return value.strip()


@callback(
    Output('input_od_operacije', 'value'),
    State('url', 'search'),
    Input('url', 'pathname'),
    prevent_initial_call=False
)
def load_od_operacije_from_url(search, pathname):
    """Load od_operacije from URL query string."""
    if not search:
        raise PreventUpdate
    
    parsed = parse_qs(search.lstrip('?'))
    value = parsed.get('input_od_operacije', [None])[0]
    
    if value is None:
        raise PreventUpdate
    
    try:
        return int(value)
    except (ValueError, TypeError):
        raise PreventUpdate


@callback(
    Output('input_do_operacije', 'value'),
    State('url', 'search'),
    Input('url', 'pathname'),
    prevent_initial_call=False
)
def load_do_operacije_from_url(search, pathname):
    """Load do_operacije from URL query string."""
    if not search:
        raise PreventUpdate
    
    parsed = parse_qs(search.lstrip('?'))
    value = parsed.get('input_do_operacije', [None])[0]
    
    if value is None:
        raise PreventUpdate
    
    try:
        return int(value)
    except (ValueError, TypeError):
        raise PreventUpdate


@callback(
    Output('dropdown_status', 'value'),
    State('url', 'search'),
    Input('url', 'pathname'),
    prevent_initial_call=False
)
def load_status_from_url(search, pathname):
    """Load status from URL query string (comma-separated)."""
    if not search:
        raise PreventUpdate
    
    parsed = parse_qs(search.lstrip('?'))
    value = parsed.get('dropdown_status', [None])[0]
    
    if not value:
        raise PreventUpdate
    
    # Split comma-separated values
    return value.split(',')


@callback(
    Output('input_artikel', 'value'),
    State('url', 'search'),
    Input('url', 'pathname'),
    prevent_initial_call=False
)
def load_artikel_from_url(search, pathname):
    """Load artikel from URL query string."""
    if not search:
        raise PreventUpdate
    
    parsed = parse_qs(search.lstrip('?'))
    value = parsed.get('input_artikel', [None])[0]
    
    if not value:
        raise PreventUpdate
    
    return value.strip()


@callback(
    Output('logistika_dropdown_dodatne_oznake', 'value'),
    State('url', 'search'),
    Input('url', 'pathname'),
    prevent_initial_call=False
)
def load_dodatne_oznake_from_url(search, pathname):
    """Load dodatne oznake from URL query string (comma-separated)."""
    if not search:
        raise PreventUpdate
    
    parsed = parse_qs(search.lstrip('?'))
    value = parsed.get('logistika_dropdown_dodatne_oznake', [None])[0]
    
    if not value:
        raise PreventUpdate
    
    # Split comma-separated values
    return value.split(',')


@callback(
    Output('radiobutton_mode_agg', 'value'),
    State('url', 'search'),
    Input('url', 'pathname'),
    prevent_initial_call=False
)
def load_mode_agg_from_url(search, pathname):
    """Load aggregation mode from URL query string."""
    if not search:
        raise PreventUpdate
    
    parsed = parse_qs(search.lstrip('?'))
    value = parsed.get('radiobutton_mode_agg', [None])[0]
    
    if not value:
        raise PreventUpdate
    
    return value


@callback(
    Output('radiobutton_indicator_mode', 'value'),
    State('url', 'search'),
    Input('url', 'pathname'),
    prevent_initial_call=False
)
def load_indicator_mode_from_url(search, pathname):
    """Load indicator mode from URL query string."""
    if not search:
        raise PreventUpdate
    
    parsed = parse_qs(search.lstrip('?'))
    value = parsed.get('radiobutton_indicator_mode', [None])[0]
    
    if not value:
        raise PreventUpdate
    
    return value


# ============================================================================
# MAIN TABLE CALLBACK (UPDATED TO USE URL PARAMS)
# ============================================================================

@callback(
    Output('table_odlagalne_zone', 'columns'),
    Output('table_odlagalne_zone', 'data'),
    Output('table_odlagalne_zone', 'style_data_conditional'),
    Output('table_odlagalne_zone_indicator', 'children'),
    Output('table_odlagalne_zone', 'tooltip_data'),
    Input('input_odlagalne_zone', 'value'),
    Input('input_od_operacije', 'value'),
    Input('input_do_operacije', 'value'),
    Input('dropdown_status', 'value'),
    Input('input_artikel', 'value'),
    Input('logistika_dropdown_dodatne_oznake', 'value'),
    Input('radiobutton_mode_agg', 'value'),
    Input('radiobutton_indicator_mode', 'value'),
    State('url', 'search'),
    prevent_initial_call=False
)
def table_odlagalne_zone(
    odlagalne_zone, od_operacije, do_operacije, status_list, artikel,
    dodatne_oznake, mode, radiobutton_indicator_mode, url_search
):
    """
    Main table callback - uses values from inputs (which are populated from URL).
    
    Note: Removed polje_filter and vrsta_filter as requested.
    """
    if not artikel:
        raise PreventUpdate
    
    # Override from URL if present (for initial load)
    if url_search:
        parsed = parse_qs(url_search.lstrip('?'))
        
        # Override each parameter if present in URL
        if 'input_odlagalne_zone' in parsed and parsed['input_odlagalne_zone'][0]:
            odlagalne_zone = parsed['input_odlagalne_zone'][0].strip()
        if 'input_od_operacije' in parsed and parsed['input_od_operacije'][0]:
            try:
                od_operacije = int(parsed['input_od_operacije'][0])
            except ValueError:
                pass
        if 'input_do_operacije' in parsed and parsed['input_do_operacije'][0]:
            try:
                do_operacije = int(parsed['input_do_operacije'][0])
            except ValueError:
                pass
        if 'dropdown_status' in parsed and parsed['dropdown_status'][0]:
            status_list = parsed['dropdown_status'][0].split(',')
        if 'input_artikel' in parsed and parsed['input_artikel'][0]:
            artikel = parsed['input_artikel'][0].strip()
        if 'logistika_dropdown_dodatne_oznake' in parsed and parsed['logistika_dropdown_dodatne_oznake'][0]:
            dodatne_oznake = parsed['logistika_dropdown_dodatne_oznake'][0].split(',')
        if 'radiobutton_mode_agg' in parsed and parsed['radiobutton_mode_agg'][0]:
            mode = parsed['radiobutton_mode_agg'][0]
        if 'radiobutton_indicator_mode' in parsed and parsed['radiobutton_indicator_mode'][0]:
            radiobutton_indicator_mode = parsed['radiobutton_indicator_mode'][0]
    
    # Fetch and process dataframe
    # NOTE: Removed polje_filter and vrsta_filter parameters as requested
    df = get_zabojniki_aggregation(
        odlagalne_zone, od_operacije, do_operacije,
        status_list, artikel, None, None,  # polje_filter and vrsta_filter set to None
        mode, dodatne_oznake
    )
    
    # ... rest of your table processing logic ...
    # (columns, data, styling, indicators, tooltips)
    
    return columns, data, style_data_conditional, indicator, tooltip_data


# ============================================================================
# USAGE INSTRUCTIONS
# ============================================================================

"""
To use these callbacks in your Dash app:

1. Import this file in your main Dash app:
   from dash_url_callbacks import *

2. Make sure your Dash app has a dcc.Location component:
   app.layout = html.Div([
       dcc.Location(id='url', refresh=False),
       # ... rest of your layout
   ])

3. Update your get_zabojniki_aggregation function signature to remove
   polje_filter and vrsta_filter parameters (or set them to None):
   
   def get_zabojniki_aggregation(
       odlagalne_zone, od_operacije, do_operacije, status_list, artikel,
       polje_filter, vrsta_filter,  # These will be None
       mode, logistika_dropdown_dodatne_oznake
   ):
       # Remove any logic related to polje_filter and vrsta_filter
       ...

4. The callbacks will automatically:
   - Read URL parameters on page load
   - Populate input fields with URL values
   - Update URL when filters change
   - Work seamlessly with iframe integration from React app

5. Example URL:
   http://ecotech.utlth-ol.si:8090/findzabojnikilokacije?input_odlagalne_zone=5012&input_artikel=02&dropdown_status=Prevzeto
"""

