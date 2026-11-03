import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQuitModal } from './quitModal';

interface MockElement {
  tagName: string;
  className: string;
  id: string;
  textContent: string;
  disabled?: boolean;
  children: MockElement[];
  parentElement: MockElement | null;
  attributes: Record<string, string>;
  ownerDocument: MockDocument;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | undefined;
  append: (...items: MockElement[]) => void;
  replaceChildren: (...items: MockElement[]) => void;
  remove: () => void;
  focus: () => void;
  click: () => void;
  onclick?: (e?: unknown) => void;
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
        children: [],
        parentElement: null,
        attributes: {},
        ownerDocument: doc,
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

describe('QuitModal', () => {
  let doc: MockDocument;
  let host: MockElement;

  beforeEach(() => {
    doc = createMockDoc();
    host = doc.createElement('div');
  });

  it('renders quit confirmation dialog with title and description', () => {
    createQuitModal(host as unknown as HTMLElement);

    const overlay = findElementBy(host, (el) => el.className.includes('cse-modal-overlay'));
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('role')).toBe('dialog');

    const desc = findElementBy(host, (el) => el.className.includes('cse-modal-desc'));
    expect(desc?.textContent).toContain('Are you sure you want to quit');
  });

  it('cancels quit and calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    createQuitModal(host as unknown as HTMLElement, { onCancel });

    const cancelBtn = findElementBy(host, (el) => el.textContent === 'Cancel')!;
    cancelBtn.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(host.children.length).toBe(0);
  });

  it('displays farewell screen and invokes onConfirm when Confirm Quit is clicked', () => {
    const onConfirm = vi.fn();
    createQuitModal(host as unknown as HTMLElement, { onConfirm });

    const confirmBtn = findElementBy(host, (el) => el.textContent === 'Confirm Quit')!;
    confirmBtn.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);

    const farewellTitle = findElementBy(host, (el) => el.textContent === 'Thanks for Playing!');
    expect(farewellTitle).not.toBeNull();

    const returnBtn = findElementBy(host, (el) => el.textContent === 'Return to Menu');
    expect(returnBtn).not.toBeNull();
  });

  it('closes dialog when Return to Menu is clicked on farewell screen', () => {
    const onCancel = vi.fn();
    createQuitModal(host as unknown as HTMLElement, { onCancel });

    const confirmBtn = findElementBy(host, (el) => el.textContent === 'Confirm Quit')!;
    confirmBtn.click();

    const returnBtn = findElementBy(host, (el) => el.textContent === 'Return to Menu')!;
    returnBtn.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(host.children.length).toBe(0);
  });

  it('cancels quit when Escape key is pressed', () => {
    const onCancel = vi.fn();
    createQuitModal(host as unknown as HTMLElement, { onCancel });

    const keydownListeners = doc.listeners['keydown'] || [];
    keydownListeners.forEach((fn) => fn({ key: 'Escape', preventDefault: vi.fn() }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(host.children.length).toBe(0);
  });

  it('restores focus to previous active element on cancel', () => {
    const previousBtn = doc.createElement('button');
    previousBtn.focus();
    expect(doc.activeElement).toBe(previousBtn);

    createQuitModal(host as unknown as HTMLElement);
    const cancelBtn = findElementBy(host, (el) => el.textContent === 'Cancel')!;
    expect(doc.activeElement).toBe(cancelBtn);

    cancelBtn.click();
    expect(doc.activeElement).toBe(previousBtn);
  });

  it('traps Tab focus to cycle between Cancel and Confirm buttons', () => {
    createQuitModal(host as unknown as HTMLElement);

    const cancelBtn = findElementBy(host, (el) => el.textContent === 'Cancel')!;
    const confirmBtn = findElementBy(host, (el) => el.textContent === 'Confirm Quit')!;

    // Focus Confirm Quit and press Tab -> wraps to Cancel
    confirmBtn.focus();
    const keydownListeners = doc.listeners['keydown'] || [];
    keydownListeners.forEach((fn) =>
      fn({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() })
    );
    expect(doc.activeElement).toBe(cancelBtn);

    // Focus Cancel and press Shift+Tab -> wraps to Confirm Quit
    keydownListeners.forEach((fn) =>
      fn({ key: 'Tab', shiftKey: true, preventDefault: vi.fn() })
    );
    expect(doc.activeElement).toBe(confirmBtn);
  });

  it('cancels modal when abort signal triggers', () => {
    const controller = new AbortController();
    const onCancel = vi.fn();

    createQuitModal(host as unknown as HTMLElement, {
      onCancel,
      signal: controller.signal,
    });

    expect(host.children.length).toBe(1);

    controller.abort();
    expect(host.children.length).toBe(0);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
