import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPauseMenu } from '../pause-menu';
import type { PauseMenuController } from '../types';

interface MockElement {
  tagName: string;
  className: string;
  id: string;
  hidden: boolean;
  textContent: string;
  tabIndex: number;
  disabled?: boolean;
  type?: string;
  children: MockElement[];
  parentElement: MockElement | null;
  attributes: Record<string, string>;
  dataset: Record<string, string>;
  ownerDocument: MockDocument;
  style: Record<string, string> & { setProperty: (k: string, v: string) => void };
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | undefined;
  append: (...items: MockElement[]) => void;
  remove: () => void;
  contains: (child: MockElement) => boolean;
  getAnimations: () => unknown[];
  addEventListener: (ev: string, fn: (e: unknown) => void) => void;
  removeEventListener: (ev: string, fn: (e: unknown) => void) => void;
  focus: () => void;
  click: () => void;
  onclick?: () => void;
  querySelector?: (sel: string) => MockElement | null;
  querySelectorAll?: (sel: string) => MockElement[];
}

interface MockDocument {
  createElement: (tag: string) => MockElement;
  activeElement: MockElement | null;
  defaultView?: {
    matchMedia: (q: string) => { matches: boolean };
  };
}

function createMockDoc(): MockDocument {
  const doc: MockDocument = {
    activeElement: null,
    defaultView: {
      matchMedia: () => ({ matches: true }),
    },
    createElement(tag: string): MockElement {
      const styles: Record<string, string> = {};
      const el: MockElement = {
        tagName: tag.toUpperCase(),
        className: '',
        id: '',
        hidden: false,
        textContent: '',
        tabIndex: 0,
        children: [],
        parentElement: null,
        attributes: {},
        dataset: {},
        ownerDocument: doc,
        style: Object.assign(styles, {
          setProperty(k: string, v: string) {
            styles[k] = v;
          },
        }),
        setAttribute(name, val) {
          el.attributes[name] = val;
        },
        getAttribute(name) {
          return el.attributes[name];
        },
        append(...items) {
          for (const item of items) {
            item.parentElement = el;
            el.children.push(item);
          }
        },
        remove() {
          if (el.parentElement) {
            el.parentElement.children = el.parentElement.children.filter((c) => c !== el);
            el.parentElement = null;
          }
        },
        contains(child: MockElement) {
          if (!child) return false;
          let curr: MockElement | null = child;
          while (curr) {
            if (curr === el) return true;
            curr = curr.parentElement;
          }
          return false;
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getAnimations: () => [],
        focus() {
          doc.activeElement = el;
        },
        click() {
          if (!el.disabled && el.onclick) el.onclick();
        },
        querySelector(sel: string): MockElement | null {
          const all = el.querySelectorAll ? el.querySelectorAll(sel) : [];
          return all[0] ?? null;
        },
        querySelectorAll(sel: string): MockElement[] {
          const results: MockElement[] = [];
          const check = (node: MockElement) => {
            if (sel.startsWith('[role="') && node.attributes['role'] === sel.slice(7, -2)) {
              results.push(node);
            } else if (sel.startsWith('button[data-action="') && node.dataset['action'] === sel.slice(20, -2)) {
              results.push(node);
            }
            for (const child of node.children) check(child);
          };
          for (const child of el.children) check(child);
          return results;
        },
      };
      return el;
    },
  };
  return doc;
}

describe('createPauseMenu', () => {
  let doc: MockDocument;
  let host: MockElement;
  let menu: PauseMenuController;

  beforeEach(() => {
    doc = createMockDoc();
    host = doc.createElement('div');
  });

  it('mounts into host with accessible dialog role and hidden state when configured with visible: false', () => {
    menu = createPauseMenu(host as unknown as HTMLElement, { visible: false });

    expect(menu.element).toBeDefined();
    expect(menu.element.className).toContain('cse-pause-menu');
    expect(menu.element.hidden).toBe(true);
    expect(menu.getState().visible).toBe(false);

    const board = (menu.element as unknown as MockElement).querySelector?.('[role="dialog"]');
    expect(board).not.toBeNull();
    expect(board?.getAttribute('aria-modal')).toBe('true');
  });

  it('toggles visibility and reflects in getState()', () => {
    menu = createPauseMenu(host as unknown as HTMLElement, { visible: false });

    menu.setVisible(true);
    expect(menu.element.hidden).toBe(false);
    expect(menu.getState().visible).toBe(true);

    menu.setVisible(false);
    expect(menu.element.hidden).toBe(true);
    expect(menu.getState().visible).toBe(false);
  });

  it('triggers action callbacks when buttons are activated', async () => {
    const resumeSpy = vi.fn();
    const restartSpy = vi.fn();
    const settingsSpy = vi.fn();
    const quitSpy = vi.fn();

    menu = createPauseMenu(host as unknown as HTMLElement, {
      visible: true,
      callbacks: {
        resume: resumeSpy,
        restart: restartSpy,
        settings: settingsSpy,
        quit: quitSpy,
      },
    });

    const rootEl = menu.element as unknown as MockElement;
    const resumeBtn = rootEl.querySelector?.('button[data-action="resume"]');
    const settingsBtn = rootEl.querySelector?.('button[data-action="settings"]');

    expect(resumeBtn).not.toBeNull();
    expect(settingsBtn).not.toBeNull();

    resumeBtn?.click();
    await Promise.resolve();
    expect(resumeSpy).toHaveBeenCalledTimes(1);
    expect(menu.getState().lastAction).toBe('resume');

    settingsBtn?.click();
    await Promise.resolve();
    expect(settingsSpy).toHaveBeenCalledTimes(1);
    expect(menu.getState().lastAction).toBe('settings');
  });

  it('allows disabling specific actions', () => {
    const restartSpy = vi.fn();
    menu = createPauseMenu(host as unknown as HTMLElement, {
      visible: true,
      disabled: { restart: true },
      callbacks: { restart: restartSpy },
    });

    const rootEl = menu.element as unknown as MockElement;
    const restartBtn = rootEl.querySelector?.('button[data-action="restart"]');
    expect(restartBtn?.disabled).toBe(true);

    menu.setDisabled('restart', false);
    expect(restartBtn?.disabled).toBe(false);
  });

  it('destroys cleanly and removes itself from the host', () => {
    menu = createPauseMenu(host as unknown as HTMLElement, { visible: true });
    expect(host.children.includes(menu.element as unknown as MockElement)).toBe(true);

    menu.destroy();
    expect(host.children.includes(menu.element as unknown as MockElement)).toBe(false);
  });
});
