"""
Dash URL Callbacks for Advanced Search Integration
This script provides callbacks to handle URL parameters and pass them to the Dash app filters.
"""

import dash
from dash import dcc, html, Input, Output, State, callback
from dash.exceptions import PreventUpdate
from urllib.parse import parse_qs, urlencode
import dash_bootstrap_components as dbc

def create_url_callbacks(app):
    """
    Create all URL-related callbacks for the Dash app
    """
    
    @app.callback(
        Output('url', 'search'),
        Input('input_odlagalne_zone', 'value'),
        State('url', 'search'),
        prevent_initial_call=True
    )
    def update_url_with_odlagalne_zone(odlagalne_zone_value, current_search):
        """Update URL when odlagalne_zone input changes"""
        # Prevent circular trigger
        ctx = dash.callback_context
        if ctx.triggered_id != 'input_odlagalne_zone':
            raise PreventUpdate

        if not odlagalne_zone_value:
            return ''  # Clear the query if input is empty

        query = {'input_odlagalne_zone': odlagalne_zone_value.strip()}
        return '?' + urlencode(query)

    @app.callback(
        Output('input_odlagalne_zone', 'value'),
        State('url', 'search'),
        Input('input_odlagalne_zone', 'id'),
        prevent_initial_call=False
    )
    def load_odlagalne_zone_from_url(search, input_polje_id):
        """Load odlagalne_zone from URL parameters"""
        if not search:
            raise PreventUpdate

        parsed = parse_qs(search.lstrip('?'))
        odlagalne_zone = parsed.get('input_odlagalne_zone', [None])[0]

        if not odlagalne_zone:
            raise PreventUpdate

        return odlagalne_zone.strip()

    @app.callback(
        Output('input_od_operacije', 'value'),
        State('url', 'search'),
        Input('input_od_operacije', 'id'),
        prevent_initial_call=False
    )
    def load_od_operacije_from_url(search, input_id):
        """Load od_operacije from URL parameters"""
        if not search:
            raise PreventUpdate

        parsed = parse_qs(search.lstrip('?'))
        od_operacije = parsed.get('input_od_operacije', [None])[0]

        if not od_operacije:
            raise PreventUpdate

        try:
            return int(od_operacije.strip())
        except (ValueError, TypeError):
            raise PreventUpdate

    @app.callback(
        Output('input_do_operacije', 'value'),
        State('url', 'search'),
        Input('input_do_operacije', 'id'),
        prevent_initial_call=False
    )
    def load_do_operacije_from_url(search, input_id):
        """Load do_operacije from URL parameters"""
        if not search:
            raise PreventUpdate

        parsed = parse_qs(search.lstrip('?'))
        do_operacije = parsed.get('input_do_operacije', [None])[0]

        if not do_operacije:
            raise PreventUpdate

        try:
            return int(do_operacije.strip())
        except (ValueError, TypeError):
            raise PreventUpdate

    @app.callback(
        Output('dropdown_status', 'value'),
        State('url', 'search'),
        Input('dropdown_status', 'id'),
        prevent_initial_call=False
    )
    def load_status_from_url(search, input_id):
        """Load status from URL parameters"""
        if not search:
            raise PreventUpdate

        parsed = parse_qs(search.lstrip('?'))
        status = parsed.get('dropdown_status', [None])[0]

        if not status:
            raise PreventUpdate

        # Split comma-separated values
        return [s.strip() for s in status.split(',') if s.strip()]

    @app.callback(
        Output('input_artikel', 'value'),
        State('url', 'search'),
        Input('input_artikel', 'id'),
        prevent_initial_call=False
    )
    def load_artikel_from_url(search, input_id):
        """Load artikel from URL parameters"""
        if not search:
            raise PreventUpdate

        parsed = parse_qs(search.lstrip('?'))
        artikel = parsed.get('input_artikel', [None])[0]

        if not artikel:
            raise PreventUpdate

        return artikel.strip()

    @app.callback(
        Output('logistika_dropdown_dodatne_oznake', 'value'),
        State('url', 'search'),
        Input('logistika_dropdown_dodatne_oznake', 'id'),
        prevent_initial_call=False
    )
    def load_dodatne_oznake_from_url(search, input_id):
        """Load dodatne_oznake from URL parameters"""
        if not search:
            raise PreventUpdate

        parsed = parse_qs(search.lstrip('?'))
        dodatne_oznake = parsed.get('logistika_dropdown_dodatne_oznake', [None])[0]

        if not dodatne_oznake:
            raise PreventUpdate

        # Split comma-separated values
        return [s.strip() for s in dodatne_oznake.split(',') if s.strip()]

    @app.callback(
        Output('radiobutton_mode_agg', 'value'),
        State('url', 'search'),
        Input('radiobutton_mode_agg', 'id'),
        prevent_initial_call=False
    )
    def load_mode_from_url(search, input_id):
        """Load mode from URL parameters"""
        if not search:
            raise PreventUpdate

        parsed = parse_qs(search.lstrip('?'))
        mode = parsed.get('radiobutton_mode_agg', [None])[0]

        if not mode:
            raise PreventUpdate

        return mode.strip()

    @app.callback(
        Output('radiobutton_indicator_mode', 'value'),
        State('url', 'search'),
        Input('radiobutton_indicator_mode', 'id'),
        prevent_initial_call=False
    )
    def load_indicator_mode_from_url(search, input_id):
        """Load indicator_mode from URL parameters"""
        if not search:
            raise PreventUpdate

        parsed = parse_qs(search.lstrip('?'))
        indicator_mode = parsed.get('radiobutton_indicator_mode', [None])[0]

        if not indicator_mode:
            raise PreventUpdate

        return indicator_mode.strip()

    @app.callback(
        Output('url', 'search'),
        [
            Input('input_od_operacije', 'value'),
            Input('input_do_operacije', 'value'),
            Input('dropdown_status', 'value'),
            Input('input_artikel', 'value'),
            Input('logistika_dropdown_dodatne_oznake', 'value'),
            Input('radiobutton_mode_agg', 'value'),
            Input('radiobutton_indicator_mode', 'value')
        ],
        State('url', 'search'),
        prevent_initial_call=True
    )
    def update_url_with_all_filters(
        od_operacije, do_operacije, status, artikel, 
        dodatne_oznake, mode, indicator_mode, current_search
    ):
        """Update URL with all filter parameters"""
        # Prevent circular trigger
        ctx = dash.callback_context
        if not ctx.triggered:
            raise PreventUpdate

        # Build query parameters
        query_params = {}
        
        # Get current odlagalne_zone from URL to preserve it
        if current_search:
            parsed = parse_qs(current_search.lstrip('?'))
            odlagalne_zone = parsed.get('input_odlagalne_zone', [None])[0]
            if odlagalne_zone:
                query_params['input_odlagalne_zone'] = odlagalne_zone

        # Add other parameters if they have values
        if od_operacije is not None:
            query_params['input_od_operacije'] = od_operacije
        if do_operacije is not None:
            query_params['input_do_operacije'] = do_operacije
        if status:
            query_params['dropdown_status'] = ','.join(status)
        if artikel:
            query_params['input_artikel'] = artikel
        if dodatne_oznake:
            query_params['logistika_dropdown_dodatne_oznake'] = ','.join(dodatne_oznake)
        if mode:
            query_params['radiobutton_mode_agg'] = mode
        if indicator_mode:
            query_params['radiobutton_indicator_mode'] = indicator_mode

        if query_params:
            return '?' + urlencode(query_params)
        else:
            return ''

def create_advanced_search_callbacks(app, get_zabojniki_aggregation_func):
    """
    Create callbacks for the advanced search functionality
    """
    
    @app.callback(
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
        Input('radiobutton_mode_agg', 'value'),
        Input('radiobutton_indicator_mode', 'value'),
        Input('logistika_dropdown_dodatne_oznake', 'value'),
        Input('url', 'search'),
        prevent_initial_call=False
    )
    def table_odlagalne_zone(
        odlagalne_zone, od_operacije, do_operacije, status_list, artikel,
        mode, radiobutton_indicator_mode, logistika_dropdown_dodatne_oznake, search
    ):
        """Main callback for updating the table based on all filters"""
        if not artikel:
            raise PreventUpdate
            
        if search:
            parsed = parse_qs(search.lstrip('?'))
            odlagalne_zone_from_url = parsed.get('input_odlagalne_zone', [None])[0]
            if odlagalne_zone_from_url:
                odlagalne_zone = odlagalne_zone_from_url.strip()

        # Call the zabojniki aggregation function
        df = get_zabojniki_aggregation_func(
            odlagalne_zone, od_operacije, do_operacije,
            status_list, artikel, mode, logistika_dropdown_dodatne_oznake
        )

        # Process the dataframe and return table data
        # This is a placeholder - you'll need to implement the actual table processing
        # based on your existing table_odlagalne_zone function
        
        return (
            [],  # columns
            [],  # data
            [],  # style_data_conditional
            "",  # indicator children
            []   # tooltip_data
        )

# Example usage in your main Dash app:
"""
# In your main app file, add:

from dash_url_callbacks import create_url_callbacks, create_advanced_search_callbacks

# Create the callbacks
create_url_callbacks(app)
create_advanced_search_callbacks(app, get_zabojniki_aggregation)

# Make sure you have a dcc.Location component in your layout:
layout = html.Div([
    dcc.Location(id='url', refresh=False),
    # ... rest of your layout
])
"""