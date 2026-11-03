import { soundManager } from '../audio/soundManager';

export interface QuitModalOptions {
  onConfirm?: () => void;
  onCancel?: () => void;
  signal?: AbortSignal;
}

export interface QuitModalController {
  readonly element: HTMLElement;
  destroy(): void;
}

export function createQuitModal(
  host: HTMLElement,
  options: QuitModalOptions = {}
): QuitModalController {
  const doc = host.ownerDocument;
  const previousActiveElement = doc.activeElement as HTMLElement | null;

  const overlay = doc.createElement('div');
  overlay.className = 'cse-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Quit Game');

  const card = doc.createElement('div');
  card.className = 'cse-modal-card cse-quit-card';

  // Header
  const header = doc.createElement('div');
  header.className = 'cse-modal-header';

  const title = doc.createElement('h2');
  title.className = 'cse-modal-title';
  title.textContent = 'Quit Game';

  header.append(title);

  // Body
  const body = doc.createElement('div');
  body.className = 'cse-modal-body';

  const desc = doc.createElement('p');
  desc.className = 'cse-modal-desc';
  desc.textContent = 'Are you sure you want to quit playing?';

  body.append(desc);

  // Footer
  const footer = doc.createElement('div');
  footer.className = 'cse-modal-footer';

  const cancelBtn = doc.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cse-modal-btn cse-modal-btn--secondary';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = doc.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'cse-modal-btn cse-modal-btn--danger';
  confirmBtn.textContent = 'Confirm Quit';

  footer.append(cancelBtn, confirmBtn);

  card.append(header, body, footer);
  overlay.append(card);
  host.append(overlay);

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    doc.removeEventListener('keydown', handleKeydown);
    overlay.remove();
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      try {
        previousActiveElement.focus();
      } catch {
        // Safe fallback
      }
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = [cancelBtn, confirmBtn].filter((el) => !el.disabled);
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

  const cancel = () => {
    destroy();
    options.onCancel?.();
  };

  if (options.signal) {
    if (options.signal.aborted) {
      cancel();
      return { element: overlay, destroy };
    }
    options.signal.addEventListener('abort', () => cancel(), { once: true });
  }

  cancelBtn.onclick = cancel;
  overlay.onclick = (e: MouseEvent) => {
    if (e.target === overlay) cancel();
  };

  confirmBtn.onclick = () => {
    options.onConfirm?.();

    header.replaceChildren();
    const farewellTitle = doc.createElement('h2');
    farewellTitle.className = 'cse-modal-title';
    farewellTitle.textContent = 'Thanks for Playing!';
    header.append(farewellTitle);

    body.replaceChildren();
    const farewellDesc = doc.createElement('p');
    farewellDesc.className = 'cse-modal-desc';
    farewellDesc.textContent =
      'You can safely close this browser window or return to the main menu.';
    body.append(farewellDesc);

    footer.replaceChildren();
    const returnBtn = doc.createElement('button');
    returnBtn.type = 'button';
    returnBtn.className = 'cse-modal-btn cse-modal-btn--primary';
    returnBtn.textContent = 'Return to Menu';
    returnBtn.onclick = () => {
      soundManager.playSfx('click');
      cancel();
    };
    footer.append(returnBtn);
    returnBtn.focus();
  };

  doc.addEventListener('keydown', handleKeydown);
  cancelBtn.focus();

  return { element: overlay, destroy };
}
