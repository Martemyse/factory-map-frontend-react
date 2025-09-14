import type { Factory, ProductionLine } from '../types';

export const mockFactories: Factory[] = [
  {
    id: '1',
    name: 'Main Production Facility',
    location: { latitude: 40.7128, longitude: -74.0060 },
    status: 'active',
    capacity: 1000,
    currentProduction: 850,
    efficiency: 0.85,
  },
  {
    id: '2',
    name: 'Secondary Assembly Plant',
    location: { latitude: 40.7589, longitude: -73.9851 },
    status: 'active',
    capacity: 750,
    currentProduction: 720,
    efficiency: 0.96,
  },
  {
    id: '3',
    name: 'Quality Control Center',
    location: { latitude: 40.6892, longitude: -74.0445 },
    status: 'maintenance',
    capacity: 500,
    currentProduction: 0,
    efficiency: 0.0,
  },
  {
    id: '4',
    name: 'Research & Development Lab',
    location: { latitude: 40.7505, longitude: -73.9934 },
    status: 'active',
    capacity: 300,
    currentProduction: 280,
    efficiency: 0.93,
  },
  {
    id: '5',
    name: 'Warehouse Distribution',
    location: { latitude: 40.6782, longitude: -73.9442 },
    status: 'inactive',
    capacity: 2000,
    currentProduction: 0,
    efficiency: 0.0,
  },
];

export const mockProductionLines: ProductionLine[] = [
  { id: '1', factoryId: '1', name: 'Assembly Line A', status: 'running', output: 425, target: 500 },
  { id: '2', factoryId: '1', name: 'Assembly Line B', status: 'running', output: 425, target: 500 },
  { id: '3', factoryId: '2', name: 'Packaging Line 1', status: 'running', output: 360, target: 375 },
  { id: '4', factoryId: '2', name: 'Packaging Line 2', status: 'running', output: 360, target: 375 },
  { id: '5', factoryId: '3', name: 'QC Station 1', status: 'stopped', output: 0, target: 250 },
  { id: '6', factoryId: '3', name: 'QC Station 2', status: 'stopped', output: 0, target: 250 },
  { id: '7', factoryId: '4', name: 'Prototype Line', status: 'running', output: 140, target: 150 },
  { id: '8', factoryId: '4', name: 'Testing Line', status: 'running', output: 140, target: 150 },
];
