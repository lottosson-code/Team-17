/**
 * Shared Accessible Modal Foundation.
 *
 * Provides a reusable, accessible base dialog overlay for all in-game modals
 * (e.g., settings, quit confirmation). Encapsulates ARIA attributes,
 * keyboard accessibility (Escape dismissal and dynamic Tab focus trapping),
 * backdrop click handling, defensive focus restoration, and AbortSignal teardown.
 */

/**
 * Styling variants for standard modal action buttons.
 */
export type ModalButtonVariant = 'primary' | 'secondary' | 'danger';

/**
 * Configuration for creating standard modal action buttons.
 */
export interface ModalButtonConfig {
  /** Visible button text. */
  label: string;
  /** Visual variant affecting CSS class names. Defaults to 'secondary'. */
  variant?: ModalButtonVariant;
  /** Click event listener. */
  onClick: () => void;
}

/**
 * Configuration options for mounting a base modal dialog.
 */
export interface BaseModalOptions {
  /** Accessible dialog description (aria-label). */
  ariaLabel: string;
  /** Primary modal title rendered in the header. */
  title: string;
  /** Optional additional CSS class name(s) for the card container. */
  cardClassName?: string;
  /** Whether to render an accessible '✕' close button in the header. */
  showCloseButton?: boolean;
  /** Accessible label for the close button. Defaults to 'Close modal'. */
  closeButtonAriaLabel?: string;
  /** Callback fired whenever the modal is dismissed (via close button, Escape, backdrop, or abort). */
  onDismiss?: () => void;
  /** Optional AbortSignal for automatic lifecycle teardown. */
  signal?: AbortSignal;
}

/**
 * Controller interface returned by createBaseModal.
 */
export interface BaseModalController {
  /** Full-screen overlay container element. */
  readonly overlay: HTMLElement;
  /** Dialog card container element. */
  readonly card: HTMLElement;
  /** Header section element containing the title and optional close button. */
  readonly header: HTMLElement;
  /** Content body section element for inputs or descriptions. */
  readonly body: HTMLElement;
  /** Footer section element for action buttons. */
  readonly footer: HTMLElement;
  /** Dynamically updates the header title (e.g., for multi-step dialog flows). */
  setTitle(newTitle: string): void;
  /** Teardown method to remove event listeners and detach DOM elements. */
  destroy(): void;
}

/**
 * Tags that can receive user keyboard focus.
 */
// These are the only HTML tags we care about for keyboard navigation inside a modal.
const FOCUSABLE_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

/**
 * Traverses an element tree recursively using node.children to collect focusable elements.
 *
 * NOTE: Never uses querySelectorAll to maintain strict compatibility with custom
 * lightweight MockDocument / MockElement test harnesses that only implement .children.
 *
 * @param root The root container element to search within.
 * @returns Array of active (non-disabled) focusable HTMLElements.
 */
export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const elements: HTMLElement[] = [];

  // Walk the whole DOM tree under `root` by hand, collecting every button/input/etc
  // that isn't disabled. We avoid querySelectorAll here so the function still works
  // with our lightweight mock DOM in tests (which doesn't support query selectors).
  const walk = (node: HTMLElement): void => {
    // Grab the tag name so we can check if it's something the user can tab to.
    let tagName = '';
    if (node.tagName) {
      tagName = node.tagName.toUpperCase();
    }

    // Check if the element is disabled (disabled elements cannot be tabbed to).
    let isDisabled = false;
    if ('disabled' in node) {
      const formElement = node as HTMLButtonElement | HTMLInputElement;
      if (formElement.disabled === true) {
        isDisabled = true;
      }
    }

    // If it's a focusable tag and it's not disabled, add it to our list.
    if (FOCUSABLE_TAGS.has(tagName) && !isDisabled) {
      elements.push(node);
    }

    // Collect child elements. We cast through unknown to handle both standard browser
    // HTMLCollection and our lightweight test MockElement which returns a simple array.
    let children: HTMLElement[] = [];
    const nodeWithChildren = node as unknown as { children?: ArrayLike<HTMLElement> };
    if (nodeWithChildren.children) {
      children = Array.from(nodeWithChildren.children);
    }

    for (const child of children) {
      walk(child);
    }
  };

  walk(root);
  return elements;
}

/**
 * Helper to construct an accessible modal button with consistent styling and type attributes.
 *
 * @param doc The owner Document instance.
 * @param config Button label, variant, and click handler.
 * @returns HTMLButtonElement configured with appropriate classes and handlers.
 */
export function createModalButton(
  doc: Document,
  config: ModalButtonConfig
): HTMLButtonElement {
  const button = doc.createElement('button') as HTMLButtonElement;
  // type='button' prevents it from accidentally submitting a form if one ever wraps this.
  button.type = 'button';

  // Choose button style class: primary = gold, secondary = muted green, danger = red.
  let variantClass = 'secondary';
  if (config.variant) {
    variantClass = config.variant;
  }
  button.className = 'cse-modal-btn cse-modal-btn--' + variantClass;
  button.textContent = config.label;
  button.onclick = config.onClick;
  return button;
}

/**
 * Creates and mounts a standardized accessible modal dialog into the specified host.
 *
 * Features:
 * - Proper ARIA dialog attributes (role="dialog", aria-modal="true", aria-label).
 * - Automatic keyboard handling for Escape (dismissal) and Tab (dynamic focus loop).
 * - Focus restoration to previously active element on close.
 * - Backdrop click-to-dismiss.
 * - AbortSignal integration for clean teardown on scene changes.
 *
 * @param host The parent container to append the modal overlay into.
 * @param options Modal configuration options.
 * @returns BaseModalController exposing structural elements and lifecycle methods.
 */
export function createBaseModal(
  host: HTMLElement,
  options: BaseModalOptions
): BaseModalController {
  const doc = host.ownerDocument;
  // Remember what was focused before we opened the modal so we can put focus
  // back there when the modal closes (good for accessibility).
  const previousActiveElement = doc.activeElement as HTMLElement | null;

  // --- Build the DOM skeleton: overlay > card > header + body + footer ---

  // The overlay is the full-screen dark backdrop behind the modal card.
  const overlay = doc.createElement('div');
  overlay.className = 'cse-modal-overlay';
  // ARIA attrs tell screen readers "this is a dialog and nothing behind it is interactive."
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', options.ariaLabel);

  // The card is the visible floating box the user sees.
  const card = doc.createElement('div');
  // If the caller passes a custom class (like 'cse-quit-card'), tack it on.
  let cardClassName = 'cse-modal-card';
  if (options.cardClassName) {
    cardClassName = 'cse-modal-card ' + options.cardClassName;
  }
  card.className = cardClassName;

  const header = doc.createElement('div');
  header.className = 'cse-modal-header';

  const title = doc.createElement('h2');
  title.className = 'cse-modal-title';
  title.textContent = options.title;
  header.append(title);

  // Only add the ✕ close button if the caller asked for one (settings uses it, quit doesn't).
  let closeBtn: HTMLButtonElement | null = null;
  if (options.showCloseButton) {
    closeBtn = doc.createElement('button') as HTMLButtonElement;
    closeBtn.type = 'button';
    closeBtn.className = 'cse-modal-close-btn';

    let closeAriaLabel = 'Close modal';
    if (options.closeButtonAriaLabel) {
      closeAriaLabel = options.closeButtonAriaLabel;
    }
    closeBtn.setAttribute('aria-label', closeAriaLabel);
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => dismiss();
    header.append(closeBtn);
  }

  // Body = where each modal puts its own content (description text, sliders, etc.).
  const body = doc.createElement('div');
  body.className = 'cse-modal-body';

  // Footer = where the action buttons go (Cancel, Confirm, Done, etc.).
  const footer = doc.createElement('div');
  footer.className = 'cse-modal-footer';

  // Assemble DOM hierarchy
  card.append(header, body, footer);
  overlay.append(card);
  host.append(overlay);

  // --- Lifecycle: destroy + dismiss ---

  // `destroyed` flag prevents double-cleanup if destroy() gets called more than once.
  let destroyed = false;

  // destroy() tears down the DOM and listeners. It does NOT notify the caller.
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;

    doc.removeEventListener('keydown', handleKeydown);
    overlay.remove();

    // Put focus back on whatever was focused before the modal opened.
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      try {
        previousActiveElement.focus();
      } catch {
        // Defensive: Safe fallback for environments with non-standard focus implementations
      }
    }
  };

  // dismiss() = destroy + tell the caller it happened (via onDismiss callback).
  // This is what fires when the user presses Escape, clicks the backdrop, etc.
  const dismiss = (): void => {
    if (destroyed) return;
    destroy();

    // Call onDismiss only if the consumer provided it
    if (options.onDismiss) {
      options.onDismiss();
    }
  };

  // --- Keyboard handling ---

  const handleKeydown = (e: KeyboardEvent): void => {
    // Escape key = close the modal.
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
      return;
    }

    // Focus trap: when the user presses Tab, keep focus cycling inside the modal
    // instead of letting it escape to the page behind the overlay.
    if (e.key === 'Tab') {
      // Ask getFocusableElements what's currently tabbable inside the card.
      const focusable = getFocusableElements(card);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // If Shift+Tab on the first element, wrap to the last.
      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      // If Tab on the last element, wrap to the first.
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  doc.addEventListener('keydown', handleKeydown);

  // Clicking the dark area behind the card (the overlay itself) dismisses the modal.
  overlay.onclick = (e: MouseEvent): void => {
    if (e.target === overlay) {
      dismiss();
    }
  };

  // --- AbortSignal integration ---
  // If the Phaser scene shuts down while this modal is open, the scene's AbortSignal
  // fires and we auto-close the modal so it doesn't linger as a zombie.
  if (options.signal) {
    // If the signal already fired before we got here, close immediately.
    if (options.signal.aborted) {
      dismiss();
    } else {
      // Otherwise, listen for the abort and auto-close when it fires.
      options.signal.addEventListener('abort', () => dismiss(), { once: true });
    }
  }

  // setTitle lets a modal swap its heading without rebuilding everything.
  // The quit modal uses this to go from "Quit Game" → "Thanks for Playing!".
  const setTitle = (newTitle: string): void => {
    header.replaceChildren();
    const newTitleEl = doc.createElement('h2');
    newTitleEl.className = 'cse-modal-title';
    newTitleEl.textContent = newTitle;
    header.append(newTitleEl);

    if (options.showCloseButton && closeBtn) {
      header.append(closeBtn);
    }
  };

  return {
    overlay,
    card,
    header,
    body,
    footer,
    setTitle,
    destroy,
  };
}
