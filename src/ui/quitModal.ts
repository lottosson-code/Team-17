import { soundManager } from '../audio/soundManager';
import {
  createBaseModal,
  createModalButton,
} from './baseModal';

export interface QuitModalOptions {
  onConfirm?: () => void;
  onCancel?: () => void;
  signal?: AbortSignal;
}

export interface QuitModalController {
  readonly element: HTMLElement;
  destroy(): void;
}

/**
 * Helper to construct standard modal description paragraphs.
 */
function createDescription(doc: Document, text: string): HTMLParagraphElement {
  const desc = doc.createElement('p') as HTMLParagraphElement;
  desc.className = 'cse-modal-desc';
  desc.textContent = text;
  return desc;
}

/**
 * Mounts an accessible Quit Game confirmation modal dialog.
 *
 * Flow:
 * 1. Step 1 (Confirmation View): Asks the user to confirm quitting with Cancel and Confirm Quit buttons.
 * 2. Step 2 (Farewell View): If confirmed, transitions header, body, and footer into a farewell screen
 *    with a Return to Menu button and dynamic focus updating.
 *
 * @param host Parent DOM container to mount into.
 * @param options Callbacks and lifecycle signal options.
 * @returns QuitModalController exposing the overlay element and destroy method.
 */
export function createQuitModal(
  host: HTMLElement,
  options: QuitModalOptions = {}
): QuitModalController {
  const doc = host.ownerDocument;

  let isClosed = false;
  const cancel = (): void => {
    if (isClosed) return;
    isClosed = true;
    modal.destroy();
    options.onCancel?.();
  };

  const modal = createBaseModal(host, {
    ariaLabel: 'Quit Game',
    title: 'Quit Game',
    cardClassName: 'cse-quit-card',
    onDismiss: cancel,
    signal: options.signal,
  });

  // ---------------------------------------------------------------------------
  // Step 1: Initial Confirmation View
  // ---------------------------------------------------------------------------
  const desc = createDescription(doc, 'Are you sure you want to quit playing?');
  modal.body.append(desc);

  const cancelBtn = createModalButton(doc, {
    label: 'Cancel',
    variant: 'secondary',
    onClick: cancel,
  });

  const confirmBtn = createModalButton(doc, {
    label: 'Confirm Quit',
    variant: 'danger',
    onClick: () => {
      showFarewellView();
    },
  });

  modal.footer.append(cancelBtn, confirmBtn);

  // ---------------------------------------------------------------------------
  // Step 2: Farewell View Transition
  // ---------------------------------------------------------------------------
  function showFarewellView(): void {
    options.onConfirm?.();

    modal.setTitle('Thanks for Playing!');

    modal.body.replaceChildren(
      createDescription(
        doc,
        'You can safely close this browser window or return to the main menu.'
      )
    );

    const returnBtn = createModalButton(doc, {
      label: 'Return to Menu',
      variant: 'primary',
      onClick: () => {
        soundManager.playSfx('click');
        cancel();
      },
    });

    modal.footer.replaceChildren(returnBtn);
    returnBtn.focus();
  }

  // Defensive: set initial focus on Cancel to avoid accidental confirmations
  if (!options.signal?.aborted) {
    cancelBtn.focus();
  }

  return {
    element: modal.overlay,
    destroy: () => {
      isClosed = true;
      modal.destroy();
    },
  };
}
