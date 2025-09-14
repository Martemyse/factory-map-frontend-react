import React from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { MapViewState, Factory } from '../../types';

interface DeckGLMapProps {
  viewState: MapViewState;
  onViewStateChange: (viewState: MapViewState) => void;
  factories: Factory[];
  selectedFactory?: string | null;
  onFactoryClick: (factory: Factory) => void;
}

const DeckGLMap: React.FC<DeckGLMapProps> = ({
  viewState,
  onViewStateChange,
  factories,
  selectedFactory,
  onFactoryClick,
}) => {
  const getFactoryColor = (factory: Factory) => {
    switch (factory.status) {
      case 'active':
        return [34, 197, 94]; // Green
      case 'maintenance':
        return [251, 191, 36]; // Yellow
      case 'inactive':
        return [239, 68, 68]; // Red
      default:
        return [107, 114, 128]; // Gray
    }
  };

  const getFactorySize = (factory: Factory) => {
    const baseSize = 50;
    const efficiencyMultiplier = factory.efficiency * 0.5 + 0.5;
    return baseSize * efficiencyMultiplier;
  };

  const layers = [
    new ScatterplotLayer({
      id: 'factories',
      data: factories,
      getPosition: (d: Factory) => [d.location.longitude, d.location.latitude],
      getRadius: getFactorySize,
      getFillColor: getFactoryColor,
      getLineColor: [0, 0, 0],
      lineWidthMinPixels: 2,
      pickable: true,
      onClick: ({ object }) => object && onFactoryClick(object as Factory),
      updateTriggers: {
        getFillColor: [selectedFactory],
        getRadius: [selectedFactory],
      },
    }),
    new HeatmapLayer({
      id: 'factory-heatmap',
      data: factories,
      getPosition: (d: Factory) => [d.location.longitude, d.location.latitude],
      getWeight: (d: Factory) => d.currentProduction,
      radiusPixels: 100,
      intensity: 1,
      threshold: 0.1,
    }),
  ];

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={({ viewState }) => onViewStateChange(viewState as MapViewState)}
      layers={layers}
      controller={true}
      getTooltip={({ object }) => {
        if (!object) return null;
        const factory = object as Factory;
        return {
          html: `
            <div style="padding: 8px; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="margin: 0 0 4px 0; font-size: 14px;">${factory.name}</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">Status: ${factory.status}</p>
              <p style="margin: 0; font-size: 12px; color: #666;">Production: ${factory.currentProduction}/${factory.capacity}</p>
              <p style="margin: 0; font-size: 12px; color: #666;">Efficiency: ${(factory.efficiency * 100).toFixed(1)}%</p>
            </div>
          `,
          style: {
            backgroundColor: 'transparent',
            border: 'none',
          },
        };
      }}
    />
  );
};

export default DeckGLMap;
