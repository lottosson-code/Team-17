export interface LevelSelection {
  // Pass these stable IDs to the destination gameplay scene's level loader.
  readonly roomId: string;
  readonly levelId: string;
  // Internal nodes 1–5 are Level 1–5; nodes 6–8 display Minigame 1–3.
  readonly levelNumber: number;
  readonly selectionCount: number;
}
// Shared route graph. Numbers are internal node indices, not display names.
export interface MapConnection {
  readonly fromLevel: number;
  readonly toLevel: number;
}
export interface MapState {
  readonly view: 'rooms' | 'islands';
  readonly roomId: string | null;
  readonly selectedLevelId: string | null;
  readonly selectionCount: number;
}
export interface MapOptions {
  // Island click -> bounce, update state, then call the host with the level ID.
  // The host hides this UI and mounts gameplay; the map never loads gameplay itself.
  // On leaving gameplay, the host shows the UI and calls ui.showMap().
  onLevelSelect?: (selection: LevelSelection) => void;
  // Classroom Main Menu click -> ask the host to show its existing menu.
  // createGameUI provides this callback automatically.
  onBackToMenu?: () => void;
}
export interface MapController {
  readonly element: HTMLElement;
  // Returns a copy. Changing it does not change the map.
  getState(): Readonly<MapState>;
  showRooms(): void;
  // Focus the first destination button after the host makes the map visible.
  focus(): void;
  destroy(): void;
}
