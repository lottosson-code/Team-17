import { ASSETS } from '../assets/index.js';
import type { MenuCharacter } from './types.js';

/** Default scene composition. x/y anchor each sprite's bottom center in percent. */
export const DEFAULT_MENU_CHARACTERS: readonly MenuCharacter[] = [
  { id: 'charcoal-book', imageUrl: ASSETS.characters.charcoalBook, x: 13.5, y: 53, width: 16.5 },
  { id: 'small-eraser', imageUrl: ASSETS.characters.smallEraser, x: 23, y: 48, width: 7 },
  { id: 'pencil', imageUrl: ASSETS.characters.pencil, x: 8.5, y: 75, width: 12.5 },
  { id: 'triangle-ruler', imageUrl: ASSETS.characters.triangleRuler, x: 17, y: 81, width: 12 },
  { id: 'red-book', imageUrl: ASSETS.characters.redBook, x: 84.5, y: 52, width: 14 },
  { id: 'pencil-sharpener', imageUrl: ASSETS.characters.pencilSharpener, x: 92, y: 74, width: 11 },
  { id: 'large-eraser', imageUrl: ASSETS.characters.largeEraser, x: 88.5, y: 91, width: 12 },
];
