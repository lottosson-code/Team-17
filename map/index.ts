// Standalone map entry: provide callbacks to connect destination game scenes.
// See ../README.md. Shared artwork resolves through the root assets/index.ts registry.
export { createMap } from './map.js';
export { MAP_CONNECTIONS } from './layout.js';
export type { LevelSelection, MapConnection, MapState, MapOptions, MapController } from './types.js';
