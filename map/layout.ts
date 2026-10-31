import type { MapConnection } from './types.js';

// Coordinates and hit shapes are percentages of the existing artwork.
// Change this file when replacing an island sprite or moving a classroom.
export const classrooms = [
  { id: 'classroom-01', tint: 'amber' },
  { id: 'classroom-02', tint: 'olive' },
  { id: 'classroom-03', tint: 'blue' },
];

export const islandSprites = [
  {
    shape: 'polygon(76% 36%,84% 41%,85% 48%,92% 55%,97% 65%,94% 76%,76% 84%,70% 92%,49% 95%,24% 91%,15% 84%,6% 75%,3% 65%,8% 55%,18% 49%,24% 44%,66% 43%)',
  },
  {
    shape: 'polygon(60% 32%,88% 33%,91% 45%,89% 50%,96% 58%,97% 71%,92% 83%,71% 91%,63% 96%,57% 93%,29% 91%,22% 83%,13% 75%,4% 65%,8% 57%,16% 49%,23% 43%,59% 42%)',
  },
  {
    shape: 'polygon(26% 22%,81% 23%,86% 34%,90% 48%,97% 59%,97% 76%,90% 83%,80% 92%,73% 100%,38% 100%,33% 94%,21% 86%,12% 77%,6% 66%,12% 57%,20% 49%,22% 35%)',
  },
  {
    shape: 'polygon(39% 26%,54% 28%,66% 35%,70% 43%,78% 47%,87% 55%,90% 60%,97% 65%,96% 76%,87% 85%,73% 92%,66% 100%,54% 95%,31% 91%,28% 85%,18% 79%,10% 72%,3% 65%,18% 59%,38% 55%,27% 50%,22% 42%,25% 35%,31% 30%)',
  },
  {
    shape: 'polygon(46% 5%,66% 6%,75% 11%,84% 15%,92% 20%,90% 44%,96% 54%,97% 69%,91% 80%,78% 88%,73% 100%,35% 100%,28% 94%,24% 89%,16% 84%,8% 76%,4% 68%,6% 55%,12% 49%,6% 40%,6% 33%,10% 25%,18% 20%,20% 14%,38% 10%)',
  },
];


// All three classrooms share these two routes and reuse the same five sprites.
export const islands = [
  { x: 12, y: 16, width: 12, spriteIndex: 0, route: 'main' },
  { x: 31, y: 7, width: 12, spriteIndex: 1, route: 'main' },
  { x: 50, y: 18, width: 12, spriteIndex: 2, route: 'main' },
  { x: 69, y: 7, width: 12, spriteIndex: 3, route: 'main' },
  { x: 88, y: 16, width: 12, spriteIndex: 4, route: 'main' },
  { x: 20, y: 56, width: 10.5, spriteIndex: 0, route: 'branch' },
  { x: 50, y: 57, width: 10.5, spriteIndex: 1, route: 'branch' },
  { x: 80, y: 60, width: 10.5, spriteIndex: 2, route: 'branch' },
];

// The host can use these links later for travel or unlock rules.
// The UI currently lets the player select any island.
export const MAP_CONNECTIONS: MapConnection[] = [
  { fromLevel: 1, toLevel: 2 },
  { fromLevel: 2, toLevel: 3 },
  { fromLevel: 3, toLevel: 4 },
  { fromLevel: 4, toLevel: 5 },
  { fromLevel: 3, toLevel: 6 },
  { fromLevel: 6, toLevel: 7 },
  { fromLevel: 7, toLevel: 8 },
];
