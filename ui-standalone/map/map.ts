import type { MapController, MapOptions, MapState } from './types.js';
import { classrooms, islands, islandSprites, MAP_CONNECTIONS } from './layout.js';
import { MAP_TEXT } from './labels.js';
import { ASSETS } from '../assets/index.js';

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
    background.src = ASSETS.classrooms;

    classrooms.forEach((room, index) => {
      const button = createButton('cse-map__room');
      button.dataset.roomId = room.id;
      button.style.setProperty('--room-index', String(index));
      const area = document.createElement('span');
      area.className = 'cse-map__room-area';
      area.setAttribute('aria-hidden', 'true');
      button.append(area, createLabel(MAP_TEXT.classroomPrefix + (index + 1)));
      button.onclick = () => showIslands(index);
      content.append(button);
      if (room.id === previousRoom) button.focus({ preventScroll: true });
    });
  }

  function appendBridges(): void {
    const namespace = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(namespace, 'svg');
    layer.classList.add('cse-map__bridges');
    layer.setAttribute('viewBox', '0 0 1600 900');
    layer.setAttribute('aria-hidden', 'true');

    MAP_CONNECTIONS.forEach(connection => {
      const from = islands[connection.fromLevel - 1];
      const to = islands[connection.toLevel - 1];
      if (!from || !to) return;

      // Draw left to right so railings stay above the deck on a leftward branch.
      const left = from.x <= to.x ? from : to;
      const right = from.x <= to.x ? to : from;

      // Work in a fixed 16:9 coordinate system; SVG scales with the map.
      // The walkway meets each sprite near its grassy top surface.
      const fromX = left.x * 16;
      const fromY = left.y * 9 + left.width * 16 * 5 / 3 * .69;
      const toX = right.x * 16;
      const toY = right.y * 9 + right.width * 16 * 5 / 3 * .69;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const distance = Math.hypot(dx, dy);
      const startInset = left.width * 16 * .35;
      const endInset = right.width * 16 * .35;
      const x = fromX + dx / distance * startInset;
      const y = fromY + dy / distance * startInset;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      const group = document.createElementNS(namespace, 'g');
      group.setAttribute('transform', 'translate(' + x + ' ' + y + ') rotate(' + angle + ')');
      const image = document.createElementNS(namespace, 'image');
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
    if (destroyed || !room) return;
    setView('islands');
    title.textContent = MAP_TEXT.submapTitles[roomIndex] || MAP_TEXT.classroomTitle;
    state = { ...state, roomId: room.id };
    root.dataset.room = room.tint;
    background.src = ASSETS.dream;
    appendBridges();

    islands.forEach((island, index) => {
      const artwork = islandSprites[island.spriteIndex];
      if (!artwork) return;
      const button = createButton('cse-map__island');
      const levelId = room.id + '-level-0' + (index + 1);
      const selected = state.selectedLevelId === levelId;
      button.dataset.levelId = levelId;
      button.dataset.route = island.route;
      button.dataset.selected = String(selected);
      button.dataset.activationCount = '0';
      button.setAttribute('aria-pressed', String(selected));
      button.style.setProperty('--x', island.x + '%');
      button.style.setProperty('--y', island.y + '%');
      button.style.setProperty('--island-width', island.width + '%');

      // Artwork and pointer area are separate: transparent sky must not click.
      const sprite = document.createElement('span');
      sprite.className = 'cse-map__sprite';
      sprite.style.backgroundPositionX = island.spriteIndex * 25 + '%';
      sprite.setAttribute('aria-hidden', 'true');
      const area = document.createElement('span');
      area.className = 'cse-map__island-area';
      area.style.clipPath = artwork.shape;
      area.setAttribute('aria-hidden', 'true');
      const name = island.route === 'branch' ? MAP_TEXT.minigameNames[index - 5] : MAP_TEXT.levelNames[index];
      button.append(sprite, area, createLabel(name || ''));
      button.onclick = () => selectLevel(button, room.id, levelId, index + 1);
      content.append(button);
    });
    content.querySelector<HTMLButtonElement>('.cse-map__island')?.focus({ preventScroll: true });
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
    if (state.view === 'islands') showRooms();
    else options.onBackToMenu?.();
  };
  root.onkeydown = event => {
    if (event.key === 'Escape' && state.view === 'islands') {
      event.preventDefault();
      showRooms();
    }
  };
  host.append(root);
  showRooms();

  return {
    element: root,
    getState: () => ({ ...state }),
    showRooms,
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

