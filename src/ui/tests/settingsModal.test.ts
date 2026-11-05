import { describe, it, expect, beforeEach, vi } from 'vitest';
import { settingsStore } from '../../state/settingsStore';
import { soundManager } from '../../audio/soundManager';
import { createSettingsModal } from '../settingsModal';

interface MockElement {
  tagName: string;
  className: string;
  id: string;
  textContent: string;
  type?: string;
  value?: string;
  min?: string;
  max?: string;
  step?: string;
  checked?: boolean;
  disabled?: boolean;
  htmlFor?: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
  children: MockElement[];
  parentElement: MockElement | null;
  attributes: Record<string, string>;
  ownerDocument: MockDocument;
  classList: {
    toggle: (cls: string, force?: boolean) => void;
    contains: (cls: string) => boolean;
  };
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | undefined;
  append: (...items: MockElement[]) => void;
  replaceChildren: (...items: MockElement[]) => void;
  remove: () => void;
  focus: () => void;
  click: () => void;
  onclick?: (e?: unknown) => void;
  oninput?: (e?: unknown) => void;
  onchange?: (e?: unknown) => void;
}

interface MockDocument {
  createElement: (tag: string) => MockElement;
  addEventListener: (event: string, fn: (e: unknown) => void) => void;
  removeEventListener: (event: string, fn: (e: unknown) => void) => void;
  listeners: Record<string, Array<(e: unknown) => void>>;
  activeElement: MockElement | null;
}

function createMockDoc(): MockDocument {
  const doc: MockDocument = {
    listeners: {},
    activeElement: null,
    addEventListener(event, fn) {
      if (!doc.listeners[event]) doc.listeners[event] = [];
      doc.listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (!doc.listeners[event]) return;
      doc.listeners[event] = doc.listeners[event].filter((f) => f !== fn);
    },
    createElement(tag: string): MockElement {
      const el: MockElement = {
        tagName: tag.toUpperCase(),
        className: '',
        id: '',
        textContent: '',
        dataset: {},
        style: {},
        children: [],
        parentElement: null,
        attributes: {},
        ownerDocument: doc,
        classList: {
          toggle(cls: string, force?: boolean) {
            const has = el.className.split(' ').includes(cls);
            const shouldAdd = force !== undefined ? force : !has;
            const parts = el.className.split(' ').filter((c) => c && c !== cls);
            if (shouldAdd) parts.push(cls);
            el.className = parts.join(' ');
          },
          contains(cls: string) {
            return el.className.split(' ').includes(cls);
          },
        },
        setAttribute(name, val) {
          el.attributes[name] = val;
        },
        getAttribute(name) {
          return el.attributes[name];
        },
        append(...items) {
          items.forEach((child) => {
            child.parentElement = el;
            el.children.push(child);
          });
        },
        replaceChildren(...items) {
          el.children.forEach((c) => {
            c.parentElement = null;
          });
          el.children = [];
          el.append(...items);
        },
        remove() {
          if (el.parentElement) {
            el.parentElement.children = el.parentElement.children.filter((c) => c !== el);
            el.parentElement = null;
          }
        },
        focus() {
          doc.activeElement = el;
        },
        click() {
          el.onclick?.();
        },
      };
      return el;
    },
  };
  return doc;
}

function findElementBy(root: MockElement, predicate: (el: MockElement) => boolean): MockElement | null {
  if (predicate(root)) return root;
  for (const child of root.children) {
    const found = findElementBy(child, predicate);
    if (found) return found;
  }
  return null;
}

function findAllElementsBy(root: MockElement, predicate: (el: MockElement) => boolean): MockElement[] {
  const result: MockElement[] = [];
  if (predicate(root)) result.push(root);
  for (const child of root.children) {
    result.push(...findAllElementsBy(child, predicate));
  }
  return result;
}

describe('SettingsModal', () => {
  let doc: MockDocument;
  let host: MockElement;

  beforeEach(() => {
    doc = createMockDoc();
    host = doc.createElement('div');
    settingsStore.resetToDefaults();
  });

  it('creates modal with settings inputs initialized to store values', () => {
    createSettingsModal(host as unknown as HTMLElement);

    const overlay = findElementBy(host, (el) => el.className.includes('cse-modal-overlay'));
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('role')).toBe('dialog');

    const musicInput = findElementBy(host, (el) => el.id === 'cse-music-vol');
    expect(musicInput?.value).toBe(String(settingsStore.musicVolume));

    const sfxInput = findElementBy(host, (el) => el.id === 'cse-sfx-vol');
    expect(sfxInput?.value).toBe(String(settingsStore.sfxVolume));

    const muteInput = findElementBy(host, (el) => el.id === 'cse-mute-audio');
    expect(muteInput?.checked).toBe(settingsStore.muted);
  });

  it('updates settingsStore and display label when music volume slider is dragged', () => {
    createSettingsModal(host as unknown as HTMLElement);

    const musicInput = findElementBy(host, (el) => el.id === 'cse-music-vol')!;
    const musicLabel = findElementBy(host, (el) => el.className === 'cse-settings-val')!;

    musicInput.value = '85';
    musicInput.oninput?.();

    expect(settingsStore.musicVolume).toBe(85);
    expect(musicLabel.textContent).toBe('85%');
  });

  it('safely ignores NaN volume input', () => {
    createSettingsModal(host as unknown as HTMLElement);
    const musicInput = findElementBy(host, (el) => el.id === 'cse-music-vol')!;

    musicInput.value = 'invalid';
    musicInput.oninput?.();

    expect(settingsStore.musicVolume).toBe(70);
  });

  it('updates settingsStore and plays hover sfx when sound effects volume is changed', () => {
    const playSfxSpy = vi.spyOn(soundManager, 'playSfx');
    createSettingsModal(host as unknown as HTMLElement);

    const sfxInput = findElementBy(host, (el) => el.id === 'cse-sfx-vol')!;
    sfxInput.value = '40';
    sfxInput.oninput?.();
    sfxInput.onchange?.();

    expect(settingsStore.sfxVolume).toBe(40);
    expect(playSfxSpy).toHaveBeenCalledWith('hover');
    playSfxSpy.mockRestore();
  });

  it('toggles muted state and plays click sfx on mute checkbox change', () => {
    const playSfxSpy = vi.spyOn(soundManager, 'playSfx');
    createSettingsModal(host as unknown as HTMLElement);

    const muteInput = findElementBy(host, (el) => el.id === 'cse-mute-audio')!;
    muteInput.checked = true;
    muteInput.onchange?.();

    expect(settingsStore.muted).toBe(true);
    expect(playSfxSpy).toHaveBeenCalledWith('click');
    playSfxSpy.mockRestore();
  });

  it('resets inputs and store to defaults on Reset Defaults click', () => {
    settingsStore.setMusicVolume(10);

    createSettingsModal(host as unknown as HTMLElement);

    const resetBtn = findElementBy(host, (el) => el.textContent === 'Reset Defaults')!;
    resetBtn.click();

    expect(settingsStore.musicVolume).toBe(70);

    const musicInput = findElementBy(host, (el) => el.id === 'cse-music-vol')!;
    expect(musicInput.value).toBe('70');
  });

  it('calls onClose callback and cleans up element when Done button is clicked', () => {
    const onClose = vi.fn();
    const modal = createSettingsModal(host as unknown as HTMLElement, { onClose });

    const doneBtn = findElementBy(host, (el) => el.textContent === 'Done')!;
    doneBtn.click();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(host.children.length).toBe(0);
  });

  it('calls onClose callback and cleans up when close "✕" button is clicked', () => {
    const onClose = vi.fn();
    createSettingsModal(host as unknown as HTMLElement, { onClose });

    const closeBtn = findElementBy(host, (el) => el.className.includes('cse-modal-close-btn'))!;
    closeBtn.click();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(host.children.length).toBe(0);
  });

  it('closes modal when Escape key is pressed', () => {
    const onClose = vi.fn();
    createSettingsModal(host as unknown as HTMLElement, { onClose });

    const keydownListeners = doc.listeners['keydown'] || [];
    keydownListeners.forEach((fn) => fn({ key: 'Escape', preventDefault: vi.fn() }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(host.children.length).toBe(0);
  });

  it('restores focus to previously active element on close', () => {
    const previousBtn = doc.createElement('button');
    previousBtn.focus();
    expect(doc.activeElement).toBe(previousBtn);

    createSettingsModal(host as unknown as HTMLElement);
    // Modal should have focused its doneBtn
    const doneBtn = findElementBy(host, (el) => el.textContent === 'Done')!;
    expect(doc.activeElement).toBe(doneBtn);

    doneBtn.click();
    expect(doc.activeElement).toBe(previousBtn);
  });

  it('traps Tab focus to cycle within modal elements', () => {
    createSettingsModal(host as unknown as HTMLElement);

    const closeBtn = findElementBy(host, (el) => el.className.includes('cse-modal-close-btn'))!;
    const doneBtn = findElementBy(host, (el) => el.textContent === 'Done')!;

    // Focus last element and press Tab -> should wrap to first (closeBtn)
    doneBtn.focus();
    const keydownListeners = doc.listeners['keydown'] || [];
    keydownListeners.forEach((fn) =>
      fn({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() })
    );
    expect(doc.activeElement).toBe(closeBtn);

    // Focus first element and press Shift+Tab -> should wrap to last (doneBtn)
    keydownListeners.forEach((fn) =>
      fn({ key: 'Tab', shiftKey: true, preventDefault: vi.fn() })
    );
    expect(doc.activeElement).toBe(doneBtn);
  });

  it('cleans up automatically when abort signal is triggered', () => {
    const controller = new AbortController();
    const onClose = vi.fn();

    createSettingsModal(host as unknown as HTMLElement, {
      onClose,
      signal: controller.signal,
    });

    expect(host.children.length).toBe(1);

    controller.abort();
    expect(host.children.length).toBe(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
