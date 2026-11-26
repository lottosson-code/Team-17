import type { MapConnection } from './types.js';

export const classrooms = [
  { id: 'classroom-01', tint: 'amber' },
  { id: 'classroom-02', tint: 'olive' },
  { id: 'classroom-03', tint: 'blue' },
];

// Positions are percentages of the map. Classrooms share the route and use their own art.
export const islands = [
  { x: 12, y: 23, width: 12.4, route: 'main' },
  { x: 31, y: 17.5, width: 12.4, route: 'main' },
  { x: 50, y: 24, width: 12.4, route: 'main' },
  { x: 69, y: 17.5, width: 12.4, route: 'main' },
  { x: 88, y: 23, width: 12.8, route: 'main' },
  { x: 22, y: 63, width: 11.5, route: 'branch' },
  { x: 50, y: 61, width: 11.5, route: 'branch' },
  { x: 77, y: 63, width: 11.5, route: 'branch' },
];

export const MAP_CONNECTIONS: MapConnection[] = [
  { fromLevel: 1, toLevel: 2 },
  { fromLevel: 2, toLevel: 3 },
  { fromLevel: 3, toLevel: 4 },
  { fromLevel: 4, toLevel: 5 },
  { fromLevel: 3, toLevel: 6 },
  { fromLevel: 6, toLevel: 7 },
  { fromLevel: 7, toLevel: 8 },
];
