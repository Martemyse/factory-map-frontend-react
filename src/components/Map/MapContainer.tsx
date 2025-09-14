import React from 'react';
import DeckGLMap from './DeckGLMap';
import type { MapViewState, Factory } from '../../types';

interface MapContainerProps {
  viewState: MapViewState;
  onViewStateChange: (viewState: MapViewState) => void;
  factories: Factory[];
  selectedFactory?: string | null;
  onFactoryClick: (factory: Factory) => void;
}

const MapContainer: React.FC<MapContainerProps> = ({
  viewState,
  onViewStateChange,
  factories,
  selectedFactory,
  onFactoryClick,
}) => {
  return (
    <div className="map-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <DeckGLMap
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        factories={factories}
        selectedFactory={selectedFactory}
        onFactoryClick={onFactoryClick}
      />
    </div>
  );
};

export default MapContainer;
