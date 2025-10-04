export interface Factory {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  status: 'active' | 'inactive' | 'maintenance';
  capacity: number;
  currentProduction: number;
  efficiency: number;
}

export interface ProductionLine {
  id: string;
  factoryId: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  output: number;
  target: number;
}

export interface FilterState {
  status: string[];
  capacityRange: [number, number];
  efficiencyRange: [number, number];
}
