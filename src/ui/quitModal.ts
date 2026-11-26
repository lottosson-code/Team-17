import { soundManager } from '../audio/soundManager';
import {
  createBaseModal,
  createModalButton,
} from './baseModal';

export interface QuitModalOptions {
  /** Custom dialog heading (defaults to 'Quit Game'). */
  title?: string;
  /** Custom confirmation body text (defaults to 'Are you sure you want to quit playing?'). */
  description?: string;
  /** Custom confirm button label (defaults to 'Confirm Quit'). */
  confirmLabel?: string;
  /**
   * When true, clicking confirm immediately closes the modal and invokes `onConfirm`
   * (used by the in-game Pause Menu to return to the map without showing the browser farewell screen).
   */
  confirmImmediate?: boolean;
  /** Called when the user confirms they want to quit. */
  onConfirm?: () => void;
  /** Called when the modal is cancelled or dismissed (including returning to the menu). */
  onCancel?: () => void;
  /** Optional signal that aborts and closes the modal automatically. */
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

  // Use custom dialog copy when provided (e.g., from the in-game pause menu), or fall back to Main Menu defaults
  const dialogTitle = options.title ?? 'Quit Game';
  const dialogDescription = options.description ?? 'Are you sure you want to quit playing?';
  const confirmButtonText = options.confirmLabel ?? 'Confirm Quit';

  // `isClosed` prevents cancel() from running twice if multiple dismiss paths fire
  // at the same time (e.g., Escape key + backdrop click in quick succession).
  let isClosed = false;
  // cancel() = tear everything down and tell the caller "user bailed out."
  const cancel = (): void => {
    if (isClosed) return;
    isClosed = true;
    modal.destroy();
    // If the caller provided an onCancel callback, fire it. If not, just do nothing.
    options.onCancel?.();
  };

  // Hand off all the boilerplate (overlay, focus trap, Escape, backdrop, ARIA)
  // to the shared base modal — we just configure it with our title and hook up cancel.
  const modal = createBaseModal(host, {
    ariaLabel: dialogTitle,
    title: dialogTitle,
    cardClassName: 'cse-quit-card',
    onDismiss: cancel,
    signal: options.signal,
  });

  // ---------------------------------------------------------------------------
  // Step 1: Initial Confirmation View
  // ---------------------------------------------------------------------------
  const desc = createDescription(doc, dialogDescription);
  modal.body.append(desc);

  const cancelBtn = createModalButton(doc, {
    label: 'Cancel',
    variant: 'secondary',
    onClick: cancel,
  });

  const confirmBtn = createModalButton(doc, {
    label: confirmButtonText,
    variant: 'danger',
    onClick: () => {
      handleConfirm();
    },
  });

  modal.footer.append(cancelBtn, confirmBtn);

  // ---------------------------------------------------------------------------
  // Step 2: Confirm Handler (Immediate Exit or Farewell View Transition)
  // ---------------------------------------------------------------------------
  // Handler invoked when the user clicks the red confirm action button
  function handleConfirm(): void {
    // In-game pause menu mode: close the modal immediately and trigger onConfirm to exit to the map
    if (options.confirmImmediate) {
      isClosed = true;
      modal.destroy();
      options.onConfirm?.();
      return;
    }

    // Main menu mode: transition the modal content to the post-quit farewell screen
    options.onConfirm?.();

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
