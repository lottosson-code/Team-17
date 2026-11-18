import { soundManager } from '../audio/soundManager';
import {
  createBaseModal,
  createModalButton,
} from './baseModal';

export interface QuitModalOptions {
  // Called when the user confirms they want to quit (clicked "Confirm Quit").
  // Optional because some callers (like the standalone preview) don't need it.
  onConfirm?: () => void;
  // Called when the user backs out (Cancel, Escape, backdrop click, etc.).
  onCancel?: () => void;
  // If the parent scene dies, this signal fires and auto-closes the modal.
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

  // `isClosed` prevents cancel() from running twice if multiple dismiss paths fire
  // at the same time (e.g., Escape key + backdrop click in quick succession).
  let isClosed = false;
  // cancel() = tear everything down and tell the caller "user bailed out."
  const cancel = (): void => {
    if (isClosed) return;
    isClosed = true;
    modal.destroy();
    // If the caller provided an onCancel callback, fire it. If not, just do nothing.
    if (options.onCancel) {
      options.onCancel();
    }
  };

  // Hand off all the boilerplate (overlay, focus trap, Escape, backdrop, ARIA)
  // to the shared base modal — we just configure it with our title and hook up cancel.
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
    // When the user clicks "Confirm Quit", swap the entire modal content
    // from the confirmation view to a farewell screen.
    onClick: () => {
      showFarewellView();
    },
  });

  modal.footer.append(cancelBtn, confirmBtn);

  // ---------------------------------------------------------------------------
  // Step 2: Farewell View Transition
  // ---------------------------------------------------------------------------
  function showFarewellView(): void {
    // Let the caller know the user confirmed (MainMenuScene uses this to play a sound).
    if (options.onConfirm) {
      options.onConfirm();
    }

    // Swap out the header, body, and footer content in-place.
    modal.setTitle('Thanks for Playing!');

    // replaceChildren wipes the old content and puts the new description in.
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

  // Defensive: set initial focus on Cancel to avoid accidental confirmations.
  // Check that the scene hasn't already aborted before focusing.
  const hasAborted = options.signal ? options.signal.aborted : false;
  if (!hasAborted) {
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
