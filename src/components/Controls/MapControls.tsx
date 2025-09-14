import React from 'react';
import { MapViewState } from '../../types';

interface MapControlsProps {
  viewState: MapViewState;
  onViewStateChange: (viewState: MapViewState) => void;
  onResetView: () => void;
}

const MapControls: React.FC<MapControlsProps> = ({
  viewState,
  onViewStateChange,
  onResetView,
}) => {
  const handleZoomIn = () => {
    onViewStateChange({
      ...viewState,
      zoom: Math.min(viewState.zoom + 1, 20),
    });
  };

  const handleZoomOut = () => {
    onViewStateChange({
      ...viewState,
      zoom: Math.max(viewState.zoom - 1, 1),
    });
  };

  return (
    <div className="map-controls">
      <div className="control-group">
        <button 
          className="control-button"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          +
        </button>
        <button 
          className="control-button"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          −
        </button>
        <button 
          className="control-button"
          onClick={onResetView}
          title="Reset View"
        >
          ⌂
        </button>
      </div>
      
      <div className="view-info">
        <div>Zoom: {viewState.zoom.toFixed(1)}</div>
        <div>Lat: {viewState.latitude.toFixed(4)}</div>
        <div>Lng: {viewState.longitude.toFixed(4)}</div>
      </div>
    </div>
  );
};

export default MapControls;
