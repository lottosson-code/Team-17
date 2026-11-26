import type { MapController, MapOptions, MapState } from './types.js';
import { classrooms, islands, MAP_CONNECTIONS } from './layout.js';
import { MAP_TEXT } from './labels.js';
import { ASSETS } from '../assets/index.js';
import { MAP_ART, MAP_ISLAND_SIZE, type ClassroomArtwork } from '../assets/map/reimagined/index.js';
// [Added] Shared fade-to-black transition between the classroom list and a classroom's islands.
import { fadeTransition } from '../src/ui/fadeTransition.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ISLAND_HEIGHT_RATIO = MAP_ISLAND_SIZE.height / MAP_ISLAND_SIZE.width;

function createButton(className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  return button;
}

function createLabel(text: string): HTMLSpanElement {
  const label = document.createElement('span');
  label.className = 'cse-map__label';
  label.textContent = text;
  return label;
}

/** Mount the map UI. The host decides how to load the selected game level. */
export function createMap(host: HTMLElement, options: MapOptions = {}): MapController {
  const root = document.createElement('section');
  root.className = 'cse-map';
  root.setAttribute('aria-label', MAP_TEXT.accessibleTitle);

  const background = document.createElement('img');
  background.className = 'cse-map__background';
  background.alt = '';
  background.draggable = false;
  const shade = document.createElement('div');
  shade.className = 'cse-map__shade';
  const title = document.createElement('h1');
  title.className = 'cse-map__title';
  title.textContent = MAP_TEXT.classroomTitle;
  const back = createButton('cse-map__back');
  back.textContent = MAP_TEXT.back;
  const content = document.createElement('div');
  content.className = 'cse-map__content';
  const status = document.createElement('span');
  status.className = 'cse-map__sr';
  status.setAttribute('role', 'status');
  root.append(background, shade, title, back, content, status);

  let destroyed = false;
  let state: MapState = { view: 'rooms', roomId: null, selectedLevelId: null, selectionCount: 0 };

  function setView(view: 'rooms' | 'islands'): void {
    content.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    content.replaceChildren();
    state = { ...state, view };
    root.dataset.view = view;
    background.hidden = view === 'rooms';
    title.hidden = false;
    back.hidden = view === 'rooms' && !options.onBackToMenu;
    back.textContent = view === 'rooms' ? MAP_TEXT.mainMenu : MAP_TEXT.back;
    status.textContent = '';
  }

  function showRooms(): void {
    if (destroyed) return;
    const previousRoom = state.roomId;
    setView('rooms');
    title.textContent = MAP_TEXT.classroomTitle;
    state = { ...state, roomId: null };
    root.dataset.room = '';
    classrooms.forEach((room, index) => {
      const artwork = MAP_ART[index];
      if (!artwork) return;
      const button = createButton('cse-map__room');
      const isUnlocked = options.isRoomUnlocked ? options.isRoomUnlocked(index) : true;
      button.dataset.roomId = room.id;
      button.style.setProperty('--room-index', String(index));
      const preview = document.createElement('img');
      preview.className = 'cse-map__room-preview';
      preview.src = artwork.preview;
      preview.alt = '';
      preview.draggable = false;
      const labelText = isUnlocked
        ? MAP_TEXT.classroomPrefix + (index + 1)
        : MAP_TEXT.classroomPrefix + (index + 1) + ' 🔒';
      button.append(preview, createLabel(labelText));

      if (!isUnlocked) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.title = `Module ${index + 1} Locked — Complete Module ${index} first`;
      } else {
        // [Changed] Was showIslands(index) directly; now behind the fade-to-black transition.
        button.onclick = () => { void fadeTransition(() => showIslands(index)); };
      }
      content.append(button);
      if (room.id === previousRoom) button.focus({ preventScroll: true });
    });
  }

  function appendBridges(artwork: ClassroomArtwork): void {
    const layer = document.createElementNS(SVG_NAMESPACE, 'svg');
    layer.classList.add('cse-map__bridges');
    layer.setAttribute('viewBox', '0 0 1600 900');
    layer.setAttribute('aria-hidden', 'true');

    MAP_CONNECTIONS.forEach(connection => {
      const from = connection.fromLevel - 1;
      const to = connection.toLevel - 1;
      const fromIsland = islands[from];
      const toIsland = islands[to];
      if (!fromIsland || !toIsland) return;

      // Draw left to right so railings stay above the deck on a leftward branch.
      const [leftIndex, rightIndex] = fromIsland.x <= toIsland.x ? [from, to] : [to, from];
      const left = islands[leftIndex];
      const right = islands[rightIndex];
      const leftArt = artwork.islands[leftIndex];
      const rightArt = artwork.islands[rightIndex];
      if (!left || !right || !leftArt || !rightArt) return;

      // Work in the map's fixed 16:9 coordinates and meet each island at its deck.
      const fromX = left.x * 16;
      const fromY = left.y * 9 + left.width * 16 * ISLAND_HEIGHT_RATIO * leftArt.deck;
      const toX = right.x * 16;
      const toY = right.y * 9 + right.width * 16 * ISLAND_HEIGHT_RATIO * rightArt.deck;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const distance = Math.hypot(dx, dy);
      const startInset = left.width * 16 * .35;
      const endInset = right.width * 16 * .35;
      const x = fromX + dx / distance * startInset;
      const y = fromY + dy / distance * startInset;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      const group = document.createElementNS(SVG_NAMESPACE, 'g');
      group.setAttribute('transform', 'translate(' + x + ' ' + y + ') rotate(' + angle + ')');
      const image = document.createElementNS(SVG_NAMESPACE, 'image');
      image.classList.add('cse-map__bridge');
      image.setAttribute('data-from', String(connection.fromLevel));
      image.setAttribute('data-to', String(connection.toLevel));
      image.setAttribute('href', ASSETS.bridge);
      image.setAttribute('x', '-12');
      image.setAttribute('y', '-62');
      image.setAttribute('width', String(distance - startInset - endInset + 24));
      image.setAttribute('height', '124');
      image.setAttribute('preserveAspectRatio', 'none');
      group.append(image);
      layer.append(group);
    });
    content.append(layer);
  }

  function showIslands(roomIndex: number): void {
    const room = classrooms[roomIndex];
    const classroomArt = MAP_ART[roomIndex];
    if (destroyed || !room || !classroomArt) return;
    setView('islands');
    title.textContent = MAP_TEXT.submapTitles[roomIndex] || MAP_TEXT.classroomTitle;
    state = { ...state, roomId: room.id };
    root.dataset.room = room.tint;
    background.src = classroomArt.background;
    appendBridges(classroomArt);

    islands.forEach((island, index) => {
      const artwork = classroomArt.islands[index];
      if (!artwork) return;
      const button = createButton('cse-map__island');
      const levelId = room.id + '-level-0' + (index + 1);
      const isUnlocked = options.isLevelUnlocked ? options.isLevelUnlocked(roomIndex, index + 1) : true;
      const isCompleted = options.isLevelCompleted ? options.isLevelCompleted(roomIndex, index + 1) : false;
      const selected = state.selectedLevelId === levelId;
      button.dataset.levelId = levelId;
      button.dataset.route = island.route;
      button.dataset.selected = String(selected);
      button.dataset.activationCount = '0';
      button.setAttribute('aria-pressed', String(selected));
      button.style.setProperty('--x', island.x + '%');
      button.style.setProperty('--y', island.y + '%');
      button.style.setProperty('--island-width', island.width + '%');

      const sprite = document.createElement('img');
      sprite.className = 'cse-map__sprite';
      sprite.src = artwork.src;
      sprite.width = MAP_ISLAND_SIZE.width;
      sprite.height = MAP_ISLAND_SIZE.height;
      sprite.alt = '';
      sprite.draggable = false;
      // The same traced path draws the outline and receives pointer input.
      const area = document.createElementNS(SVG_NAMESPACE, 'svg');
      area.classList.add('cse-map__island-area');
      area.setAttribute('viewBox', '0 0 ' + MAP_ISLAND_SIZE.width + ' ' + MAP_ISLAND_SIZE.height);
      area.setAttribute('aria-hidden', 'true');
      const outline = document.createElementNS(SVG_NAMESPACE, 'path');
      outline.classList.add('cse-map__island-outline');
      outline.setAttribute('d', artwork.path);
      area.append(outline);
      let name = island.route === 'branch' ? MAP_TEXT.minigameNames[index - 5] : MAP_TEXT.levelNames[index];
      if (isCompleted) {
        name = '✓ ' + (name || '');
      } else if (!isUnlocked) {
        name = '🔒 ' + (name || '');
      }
      button.append(sprite, area, createLabel(name || ''));

      if (!isUnlocked) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.title = 'Level Locked';
      } else {
        button.onclick = () => selectLevel(button, room.id, levelId, index + 1);
      }
      content.append(button);
    });
    appendNextClassroom(roomIndex);
    content.querySelector<HTMLButtonElement>('.cse-map__island')?.focus({ preventScroll: true });
  }

  function appendNextClassroom(roomIndex: number): void {
    const nextRoomIndex = roomIndex + 1;
    const finalLevel = MAP_TEXT.levelNames.length;
    if (!classrooms[nextRoomIndex] ||
        !options.isLevelCompleted?.(roomIndex, finalLevel) ||
        options.isRoomUnlocked?.(nextRoomIndex) === false) return;
    const finalIsland = islands[finalLevel - 1];
    if (!finalIsland) return;
    const button = createButton('cse-map__next-classroom');
    button.style.setProperty('--level-x', finalIsland.x + '%');
    button.style.setProperty('--level-y', finalIsland.y + '%');
    button.style.setProperty('--level-height', (finalIsland.width * ISLAND_HEIGHT_RATIO) + 'cqw');
    const label = document.createElement('span');
    label.textContent = MAP_TEXT.nextClassroom;
    button.append(label);
    button.onclick = () => { void fadeTransition(() => showIslands(nextRoomIndex)); };
    content.append(button);
  }

  function selectLevel(button: HTMLButtonElement, roomId: string, levelId: string, levelNumber: number): void {
    if (destroyed) return;
    state = { ...state, selectedLevelId: levelId, selectionCount: state.selectionCount + 1 };
    root.dataset.selectedLevelId = levelId;
    const buttons = content.querySelectorAll<HTMLButtonElement>('button[data-level-id]');
    buttons.forEach(node => {
      const selected = node === button;
      node.dataset.selected = String(selected);
      node.setAttribute('aria-pressed', String(selected));
    });
    button.dataset.activationCount = String(Number(button.dataset.activationCount) + 1);
    bounce(button);
    // placeholder：Accessible selection announcement, using the same button name.
    status.textContent = button.textContent + ' selected.';
    options.onLevelSelect?.({ roomId, levelId, levelNumber, selectionCount: state.selectionCount });
  }

  function bounce(button: HTMLButtonElement): void {
    button.getAnimations().forEach(animation => animation.cancel());
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    button.animate([
      { transform: 'translateX(-50%) translateY(0)' },
      { transform: 'translateX(-50%) translateY(-0.65cqw)', offset: 0.32 },
      { transform: 'translateX(-50%) translateY(0.12cqw)', offset: 0.7 },
      { transform: 'translateX(-50%) translateY(0)' },
    ], { duration: 300, easing: 'ease-out' });
  }

  back.onclick = () => {
    if (destroyed) return;
    // [Changed] Islands -> classrooms fades through black (the menu side does its own in game-ui.ts).
    if (state.view === 'islands') void fadeTransition(showRooms);
    else options.onBackToMenu?.();
  };
  root.onkeydown = event => {
    if (event.key === 'Escape' && state.view === 'islands') {
      event.preventDefault();
      // [Changed] Same fade as the Back button.
      void fadeTransition(showRooms);
    }
  };
  host.append(root);
  showRooms();

  return {
    element: root,
    getState: () => ({ ...state }),
    showRooms,
    showIslands,
    focus(): void {
      if (!destroyed) content.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      root.querySelectorAll('button').forEach(button => { button.onclick = null; });
      root.onkeydown = null;
      root.remove();
    },
  };
}

