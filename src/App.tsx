import React, { useState, useMemo } from 'react';
import MapContainer from './components/Map/MapContainer';
import FactoryPanel from './components/FactoryPanel/FactoryPanel';
import MapControls from './components/Controls/MapControls';
import FilterPanel from './components/Controls/FilterPanel';
import { useMapState } from './hooks/useMapState';
import { mockFactories, mockProductionLines } from './data/mockData';
import { Factory } from './types';
import './App.css';

function App() {
  const { viewState, updateViewState, resetView } = useMapState();
  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);
  const [filteredFactories, setFilteredFactories] = useState<Factory[]>(mockFactories);

  const handleFactoryClick = (factory: Factory) => {
    setSelectedFactory(factory);
  };

  const handleClosePanel = () => {
    setSelectedFactory(null);
  };

  const totalProduction = useMemo(() => 
    filteredFactories.reduce((sum, factory) => sum + factory.currentProduction, 0), 
    [filteredFactories]
  );

  const totalCapacity = useMemo(() => 
    filteredFactories.reduce((sum, factory) => sum + factory.capacity, 0), 
    [filteredFactories]
  );

  const averageEfficiency = useMemo(() => {
    if (filteredFactories.length === 0) return 0;
    const totalEfficiency = filteredFactories.reduce((sum, factory) => sum + factory.efficiency, 0);
    return totalEfficiency / filteredFactories.length;
  }, [filteredFactories]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Factory Map Dashboard</h1>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Production</span>
            <span className="stat-value">{totalProduction.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Capacity</span>
            <span className="stat-value">{totalCapacity.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg Efficiency</span>
            <span className="stat-value">{(averageEfficiency * 100).toFixed(1)}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Factories</span>
            <span className="stat-value">
              {filteredFactories.filter(f => f.status === 'active').length}
            </span>
          </div>
        </div>
      </header>

      <div className="app-content">
        <div className="sidebar">
          <FilterPanel 
            factories={mockFactories}
            onFilterChange={setFilteredFactories}
          />
        </div>

        <div className="map-section">
          <MapContainer
            viewState={viewState}
            onViewStateChange={updateViewState}
            factories={filteredFactories}
            selectedFactory={selectedFactory?.id}
            onFactoryClick={handleFactoryClick}
          />
          
          <MapControls
            viewState={viewState}
            onViewStateChange={updateViewState}
            onResetView={resetView}
          />
        </div>

        {selectedFactory && (
          <FactoryPanel
            selectedFactory={selectedFactory}
            productionLines={mockProductionLines}
            onClose={handleClosePanel}
          />
        )}
      </div>
    </div>
  );
}

export default App;
