/** Static asset URLs: Vite can discover and emit every referenced image. */
export const ASSETS = {
  mainMenuBackground: new URL('./main-menu/classroom.png', import.meta.url).href,
  mapIcon: new URL('./icons/map.svg', import.meta.url).href,
  classrooms: new URL('./map/classrooms.png', import.meta.url).href,
  dream: new URL('./map/dream.png', import.meta.url).href,
  islands: new URL('./map/islands.png', import.meta.url).href,
  bridge: new URL('./map/bridge.png', import.meta.url).href,
  characters: {
    charcoalBook: new URL('./characters/charcoal-book.png', import.meta.url).href,
    smallEraser: new URL('./characters/small-eraser.png', import.meta.url).href,
    pencil: new URL('./characters/pencil.png', import.meta.url).href,
    triangleRuler: new URL('./characters/triangle-ruler.png', import.meta.url).href,
    redBook: new URL('./characters/red-book.png', import.meta.url).href,
    pencilSharpener: new URL('./characters/pencil-sharpener.png', import.meta.url).href,
    largeEraser: new URL('./characters/large-eraser.png', import.meta.url).href,
  },
};

/** Chalk colours in assets/chalk/. */
export type ChalkColor = 'white' | 'yellow' | 'orange';

/** URL of one chalk character image; glyph is '0'-'9', 'times', 'plus' or 'equals'. */
export function chalkGlyphUrl(color: ChalkColor, glyph: string): string {
  return new URL(`./chalk/${color}-${glyph}.png`, import.meta.url).href;
}
