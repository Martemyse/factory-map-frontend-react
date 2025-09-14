import { useState, useCallback } from 'react';
import type { MapViewState } from '../types';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -74.006,
  latitude: 40.7128,
  zoom: 10,
  pitch: 0,
  bearing: 0,
};

export const useMapState = () => {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);

  const updateViewState = useCallback((newViewState: Partial<MapViewState>) => {
    setViewState(prev => ({ ...prev, ...newViewState }));
  }, []);

  const resetView = useCallback(() => {
    setViewState(INITIAL_VIEW_STATE);
  }, []);

  return {
    viewState,
    updateViewState,
    resetView,
  };
};
