import React from 'react';
import type { Factory, ProductionLine } from '../../types';

interface FactoryDetailsProps {
  factory: Factory | null;
  productionLines: ProductionLine[];
}

const FactoryDetails: React.FC<FactoryDetailsProps> = ({ factory, productionLines }) => {
  if (!factory) {
    return (
      <div className="factory-details">
        <h3>Select a Factory</h3>
        <p>Click on a factory marker to view details</p>
      </div>
    );
  }

  const factoryLines = productionLines.filter(line => line.factoryId === factory.id);
  const totalOutput = factoryLines.reduce((sum, line) => sum + line.output, 0);
  const totalTarget = factoryLines.reduce((sum, line) => sum + line.target, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'maintenance': return '#f59e0b';
      case 'inactive': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="factory-details">
      <div className="factory-header">
        <h3>{factory.name}</h3>
        <span 
          className="status-badge"
          style={{ backgroundColor: getStatusColor(factory.status) }}
        >
          {factory.status.toUpperCase()}
        </span>
      </div>
      
      <div className="factory-metrics">
        <div className="metric">
          <label>Current Production</label>
          <div className="metric-value">
            {factory.currentProduction.toLocaleString()} / {factory.capacity.toLocaleString()}
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${(factory.currentProduction / factory.capacity) * 100}%`,
                backgroundColor: getStatusColor(factory.status)
              }}
            />
          </div>
        </div>
        
        <div className="metric">
          <label>Efficiency</label>
          <div className="metric-value">
            {(factory.efficiency * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="metric">
          <label>Location</label>
          <div className="metric-value">
            {factory.location.latitude.toFixed(4)}, {factory.location.longitude.toFixed(4)}
          </div>
        </div>
      </div>

      {factoryLines.length > 0 && (
        <div className="production-lines">
          <h4>Production Lines</h4>
          <div className="lines-summary">
            <div className="line-metric">
              <span>Total Output: {totalOutput.toLocaleString()}</span>
            </div>
            <div className="line-metric">
              <span>Target: {totalTarget.toLocaleString()}</span>
            </div>
            <div className="line-metric">
              <span>Performance: {totalTarget > 0 ? ((totalOutput / totalTarget) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
          
          <div className="lines-list">
            {factoryLines.map(line => (
              <div key={line.id} className="line-item">
                <div className="line-name">{line.name}</div>
                <div className="line-status" style={{ color: getStatusColor(line.status) }}>
                  {line.status}
                </div>
                <div className="line-output">
                  {line.output.toLocaleString()} / {line.target.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FactoryDetails;
