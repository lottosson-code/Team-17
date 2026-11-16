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

  const walk = (node: HTMLElement): void => {
    // 1. Get the tag name (e.g., 'BUTTON', 'INPUT', 'DIV')
    let tagName = '';
    if (node.tagName) {
      tagName = node.tagName.toUpperCase();
    }

    // 2. Determine if the element is currently disabled
    let isDisabled = false;
    if ('disabled' in node) {
      const formElement = node as HTMLButtonElement | HTMLInputElement;
      if (formElement.disabled) {
        isDisabled = true;
      }
    }

    // 3. Keep it if it's an active focusable control
    if (FOCUSABLE_TAGS.has(tagName) && !isDisabled) {
      elements.push(node);
    }

    let children: HTMLElement[] = [];
    const rawChildren = (node as unknown as { children?: ArrayLike<HTMLElement> }).children;
    if (rawChildren) {
      children = Array.from(rawChildren);
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
  button.type = 'button';
  button.className = 'cse-modal-btn cse-modal-btn--' + (config.variant ?? 'secondary');
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
  const previousActiveElement = doc.activeElement as HTMLElement | null;

  // 1. Overlay (full-screen backdrop)
  const overlay = doc.createElement('div');
  overlay.className = 'cse-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', options.ariaLabel);

  // 2. Card container
  const card = doc.createElement('div');
  card.className = options.cardClassName
    ? 'cse-modal-card ' + options.cardClassName
    : 'cse-modal-card';

  // 3. Header
  const header = doc.createElement('div');
  header.className = 'cse-modal-header';

  const title = doc.createElement('h2');
  title.className = 'cse-modal-title';
  title.textContent = options.title;
  header.append(title);

  let closeBtn: HTMLButtonElement | null = null;
  if (options.showCloseButton) {
    closeBtn = doc.createElement('button') as HTMLButtonElement;
    closeBtn.type = 'button';
    closeBtn.className = 'cse-modal-close-btn';
    closeBtn.setAttribute('aria-label', options.closeButtonAriaLabel ?? 'Close modal');
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => dismiss();
    header.append(closeBtn);
  }

  // 4. Body
  const body = doc.createElement('div');
  body.className = 'cse-modal-body';

  // 5. Footer
  const footer = doc.createElement('div');
  footer.className = 'cse-modal-footer';

  // Assemble DOM hierarchy
  card.append(header, body, footer);
  overlay.append(card);
  host.append(overlay);

  // Lifecycle states
  let destroyed = false;

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;

    doc.removeEventListener('keydown', handleKeydown);
    overlay.remove();

    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      try {
        previousActiveElement.focus();
      } catch {
        // Defensive: Safe fallback for environments with non-standard focus implementations
      }
    }
  };

  const dismiss = (): void => {
    if (destroyed) return;
    destroy();
    options.onDismiss?.();
  };

  // Keyboard navigation & focus trap
  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
      return;
    }

    if (e.key === 'Tab') {
      const focusable = getFocusableElements(card);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  doc.addEventListener('keydown', handleKeydown);

  // Backdrop click dismissal
  overlay.onclick = (e: MouseEvent): void => {
    if (e.target === overlay) {
      dismiss();
    }
  };

  // AbortSignal lifecycle integration
  if (options.signal) {
    if (options.signal.aborted) {
      dismiss();
    } else {
      options.signal.addEventListener('abort', () => dismiss(), { once: true });
    }
  }

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
