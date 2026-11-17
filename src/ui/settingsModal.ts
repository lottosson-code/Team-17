import { settingsStore } from '../state/settingsStore';
import { soundManager } from '../audio/soundManager';
import {
  createBaseModal,
  createModalButton,
} from './baseModal';

export interface SettingsModalOptions {
  onClose?: () => void;
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
  onInput: (value: number) => void;
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

  const valueDisplay = doc.createElement('span');
  valueDisplay.className = 'cse-settings-val';
  valueDisplay.textContent = `${config.initialValue}%`;

  input.oninput = (): void => {
    const val = parseInt(input.value, 10);
    if (!Number.isNaN(val)) {
      valueDisplay.textContent = `${val}%`;
      config.onInput(val);
    }
  };

  if (config.onChange) {
    input.onchange = (): void => {
      const val = parseInt(input.value, 10);
      config.onChange?.(Number.isNaN(val) ? 0 : val);
    };
  }

  sliderWrap.append(input, valueDisplay);
  row.append(label, sliderWrap);

  return {
    element: row,
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

  input.onchange = (): void => {
    config.onChange(Boolean(input.checked));
  };

  row.append(label, input);

  return {
    element: row,
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

  let closed = false;
  const notifyClose = (): void => {
    if (closed) return;
    closed = true;
    unsubscribe();
    modal.destroy();
    options.onClose?.();
  };

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

  // Defensive: set initial focus on Done
  if (!options.signal?.aborted) {
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
