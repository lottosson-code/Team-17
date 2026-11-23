import { settingsStore } from '../state/settingsStore';
import { soundManager } from '../audio/soundManager';
import {
  createBaseModal,
  createModalButton,
} from './baseModal';

export interface SettingsModalOptions {
  // Optional callback called when the user closes the modal (Done, close '✕' button, Escape, etc.).
  onClose?: () => void;
  // If the parent scene dies while this modal is open, this signal triggers cleanup.
  signal?: AbortSignal;
}

export interface SettingsModalController {
  readonly element: HTMLElement;
  destroy(): void;
}

/**
 * Configuration for creating a slider settings row.
 */
export interface SliderRowConfig {
  id: string;
  label: string;
  initialValue: number;
  // onInput fires continuously in real-time as you drag the slider (updates volume smoothly).
  onInput: (value: number) => void;
  // onChange fires only once when you let go of the mouse (used to play a preview sound).
  onChange?: (value: number) => void;
}

/**
 * Controller returned by createSliderRow allowing external value updates.
 */
export interface SliderRowController {
  readonly element: HTMLElement;
  setValue(value: number): void;
}

/**
 * Configuration for creating a checkbox settings row.
 */
export interface CheckboxRowConfig {
  id: string;
  label: string;
  initialChecked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Controller returned by createCheckboxRow allowing external checked updates.
 */
export interface CheckboxRowController {
  readonly element: HTMLElement;
  setChecked(checked: boolean): void;
}

/**
 * Constructs an accessible slider row with a label, range input, and live percentage display.
 */
export function createSliderRow(
  doc: Document,
  config: SliderRowConfig
): SliderRowController {
  const row = doc.createElement('div');
  row.className = 'cse-settings-row';

  const label = doc.createElement('label');
  label.textContent = config.label;
  label.htmlFor = config.id;

  const sliderWrap = doc.createElement('div');
  sliderWrap.className = 'cse-settings-slider-wrap';

  const input = doc.createElement('input') as HTMLInputElement;
  input.id = config.id;
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.value = String(config.initialValue);

  // Live text display next to the slider showing the number (e.g. "75%").
  const valueDisplay = doc.createElement('span');
  valueDisplay.className = 'cse-settings-val';
  valueDisplay.textContent = `${config.initialValue}%`;

  // `oninput` runs constantly while sliding. We parse the string value to a number,
  // update the percentage label immediately, and notify the callback.
  input.oninput = (): void => {
    const val = parseInt(input.value, 10);
    if (!Number.isNaN(val)) {
      valueDisplay.textContent = `${val}%`;
      config.onInput(val);
    }
  };

  // `onchange` only fires when the user releases the slider thumb or finishes editing.
  // We use this so sound preview effects don't trigger 60 times a second while dragging.
  if (config.onChange) {
    input.onchange = (): void => {
      const val = parseInt(input.value, 10);
      let safeVal = 0;
      if (!Number.isNaN(val)) {
        safeVal = val;
      }
      if (config.onChange) {
        config.onChange(safeVal);
      }
    };
  }

  sliderWrap.append(input, valueDisplay);
  row.append(label, sliderWrap);

  return {
    element: row,
    // Allows external code (like "Reset Defaults") to update the slider and text label.
    setValue(value: number): void {
      input.value = String(value);
      valueDisplay.textContent = `${value}%`;
    },
  };
}

/**
 * Constructs an accessible checkbox row with a label and toggle input.
 */
export function createCheckboxRow(
  doc: Document,
  config: CheckboxRowConfig
): CheckboxRowController {
  const row = doc.createElement('div');
  row.className = 'cse-settings-row cse-settings-row--checkbox';

  const label = doc.createElement('label');
  label.textContent = config.label;
  label.htmlFor = config.id;

  const input = doc.createElement('input') as HTMLInputElement;
  input.id = config.id;
  input.type = 'checkbox';
  input.checked = config.initialChecked;

  // Whenever the user clicks the checkbox, notify the callback with true or false.
  input.onchange = (): void => {
    config.onChange(Boolean(input.checked));
  };

  row.append(label, input);

  return {
    element: row,
    // Allows external code to programmatically check or uncheck the box.
    setChecked(checked: boolean): void {
      input.checked = checked;
    },
  };
}

/**
 * Mounts an accessible Game Settings modal dialog.
 *
 * Provides controls for:
 * - Music volume slider (0-100%)
 * - SFX volume slider (0-100%) with audio preview on release
 * - Mute all audio toggle
 * - Reset to defaults and Done buttons
 *
 * @param host Parent DOM container to mount into.
 * @param options Callbacks and lifecycle signal options.
 * @returns SettingsModalController exposing the overlay element and destroy method.
 */
export function createSettingsModal(
  host: HTMLElement,
  options: SettingsModalOptions = {}
): SettingsModalController {
  const doc = host.ownerDocument;
  const initialSettings = settingsStore.getSettings();

  // Guard flag so closing only happens once, even if multiple close triggers happen
  // at the exact same moment (like pressing Escape while clicking Done).
  let closed = false;
  const notifyClose = (): void => {
    if (closed) return;
    closed = true;
    // Stop listening to store changes to prevent memory leaks when the modal is closed.
    unsubscribe();
    modal.destroy();
    if (options.onClose) {
      options.onClose();
    }
  };

  // Mount the shared base modal foundation (handles ARIA, Escape, focus trapping, backdrop).
  const modal = createBaseModal(host, {
    ariaLabel: 'Game Settings',
    title: 'Settings',
    cardClassName: 'cse-settings-card',
    showCloseButton: true,
    closeButtonAriaLabel: 'Close settings',
    onDismiss: notifyClose,
    signal: options.signal,
  });

  // ---------------------------------------------------------------------------
  // Body: Form Controls
  // ---------------------------------------------------------------------------
  const musicRow = createSliderRow(doc, {
    id: 'cse-music-vol',
    label: 'Music Volume',
    initialValue: initialSettings.musicVolume,
    onInput: (val) => {
      settingsStore.setMusicVolume(val);
    },
  });

  const sfxRow = createSliderRow(doc, {
    id: 'cse-sfx-vol',
    label: 'Sound Effects',
    initialValue: initialSettings.sfxVolume,
    onInput: (val) => {
      settingsStore.setSfxVolume(val);
    },
    onChange: () => {
      soundManager.playSfx('hover');
    },
  });

  const muteRow = createCheckboxRow(doc, {
    id: 'cse-mute-audio',
    label: 'Mute All Audio',
    initialChecked: initialSettings.muted,
    onChange: (checked) => {
      settingsStore.setMuted(checked);
      soundManager.playSfx('click');
    },
  });

  modal.body.append(musicRow.element, sfxRow.element, muteRow.element);

  // ---------------------------------------------------------------------------
  // Store Subscription: Live Synchronisation
  // ---------------------------------------------------------------------------
  // If settings change from somewhere else while this modal is open (or when reset),
  // this subscriber automatically updates the slider handles and checkbox to match.
  const unsubscribe = settingsStore.subscribe((s) => {
    musicRow.setValue(s.musicVolume);
    sfxRow.setValue(s.sfxVolume);
    muteRow.setChecked(s.muted);
  });

  // ---------------------------------------------------------------------------
  // Footer: Action Buttons
  // ---------------------------------------------------------------------------
  const resetBtn = createModalButton(doc, {
    label: 'Reset Defaults',
    variant: 'secondary',
    onClick: () => {
      // Revert volumes back to 80% and mute to false in the underlying store.
      settingsStore.resetToDefaults();
      soundManager.playSfx('click');
      const reset = settingsStore.getSettings();
      musicRow.setValue(reset.musicVolume);
      sfxRow.setValue(reset.sfxVolume);
      muteRow.setChecked(reset.muted);
    },
  });

  const doneBtn = createModalButton(doc, {
    label: 'Done',
    variant: 'primary',
    onClick: () => {
      notifyClose();
    },
  });

  modal.footer.append(resetBtn, doneBtn);

  // Set initial keyboard focus on the 'Done' button so the user can easily press Enter to close.
  // We check aborted first so we don't try to focus a button if the scene was already destroyed.
  const hasAborted = options.signal ? options.signal.aborted : false;
  if (!hasAborted) {
    doneBtn.focus();
  }

  return {
    element: modal.overlay,
    destroy: () => {
      modal.destroy();
      notifyClose();
    },
  };
}
