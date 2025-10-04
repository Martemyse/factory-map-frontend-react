import React from 'react';
import FactoryDetails from './FactoryDetails';
import type { Factory, ProductionLine } from '../../types';

interface FactoryPanelProps {
  selectedFactory: Factory | null;
  productionLines: ProductionLine[];
  onClose: () => void;
}

const FactoryPanel: React.FC<FactoryPanelProps> = ({ 
  selectedFactory, 
  productionLines, 
  onClose 
}) => {
  return (
    <div className="factory-panel">
      <div className="panel-header">
        <h2>Factory Details</h2>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="panel-content">
        <FactoryDetails 
          factory={selectedFactory} 
          productionLines={productionLines} 
        />
      </div>
    </div>
  );
};

export default FactoryPanel;
