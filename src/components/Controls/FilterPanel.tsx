import React, { useState } from 'react';
import type { Factory } from '../../types';

interface FilterPanelProps {
  factories: Factory[];
  onFilterChange: (filteredFactories: Factory[]) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ factories, onFilterChange }) => {
  const [statusFilter, setStatusFilter] = useState<string[]>(['active', 'maintenance', 'inactive']);
  const [efficiencyRange, setEfficiencyRange] = useState<[number, number]>([0, 1]);
  const [capacityRange, setCapacityRange] = useState<[number, number]>([0, 2000]);

  const applyFilters = () => {
    const filtered = factories.filter(factory => {
      const statusMatch = statusFilter.includes(factory.status);
      const efficiencyMatch = factory.efficiency >= efficiencyRange[0] && factory.efficiency <= efficiencyRange[1];
      const capacityMatch = factory.capacity >= capacityRange[0] && factory.capacity <= capacityRange[1];
      
      return statusMatch && efficiencyMatch && capacityMatch;
    });
    
    onFilterChange(filtered);
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    if (checked) {
      setStatusFilter(prev => [...prev, status]);
    } else {
      setStatusFilter(prev => prev.filter(s => s !== status));
    }
  };

  React.useEffect(() => {
    applyFilters();
  }, [statusFilter, efficiencyRange, capacityRange]);

  return (
    <div className="filter-panel">
      <h3>Filters</h3>
      
      <div className="filter-group">
        <h4>Status</h4>
        {['active', 'maintenance', 'inactive'].map(status => (
          <label key={status} className="filter-checkbox">
            <input
              type="checkbox"
              checked={statusFilter.includes(status)}
              onChange={(e) => handleStatusChange(status, e.target.checked)}
            />
            <span className="status-indicator" data-status={status}></span>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </label>
        ))}
      </div>

      <div className="filter-group">
        <h4>Efficiency Range</h4>
        <div className="range-inputs">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={efficiencyRange[0]}
            onChange={(e) => setEfficiencyRange([parseFloat(e.target.value), efficiencyRange[1]])}
          />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={efficiencyRange[1]}
            onChange={(e) => setEfficiencyRange([efficiencyRange[0], parseFloat(e.target.value)])}
          />
        </div>
        <div className="range-labels">
          <span>{(efficiencyRange[0] * 100).toFixed(0)}%</span>
          <span>{(efficiencyRange[1] * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="filter-group">
        <h4>Capacity Range</h4>
        <div className="range-inputs">
          <input
            type="range"
            min="0"
            max="2000"
            step="50"
            value={capacityRange[0]}
            onChange={(e) => setCapacityRange([parseInt(e.target.value), capacityRange[1]])}
          />
          <input
            type="range"
            min="0"
            max="2000"
            step="50"
            value={capacityRange[1]}
            onChange={(e) => setCapacityRange([capacityRange[0], parseInt(e.target.value)])}
          />
        </div>
        <div className="range-labels">
          <span>{capacityRange[0].toLocaleString()}</span>
          <span>{capacityRange[1].toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
