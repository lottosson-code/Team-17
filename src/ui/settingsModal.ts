import { settingsStore, GameDifficulty } from '../state/settingsStore';
import { soundManager } from '../audio/soundManager';

export interface SettingsModalOptions {
  onClose?: () => void;
  signal?: AbortSignal;
}

export interface SettingsModalController {
  readonly element: HTMLElement;
  destroy(): void;
}

export function createSettingsModal(
  host: HTMLElement,
  options: SettingsModalOptions = {}
): SettingsModalController {
  const doc = host.ownerDocument;
  const previousActiveElement = doc.activeElement as HTMLElement | null;

  const overlay = doc.createElement('div');
  overlay.className = 'cse-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Game Settings');

  const card = doc.createElement('div');
  card.className = 'cse-modal-card cse-settings-card';

  // Header
  const header = doc.createElement('div');
  header.className = 'cse-modal-header';

  const title = doc.createElement('h2');
  title.className = 'cse-modal-title';
  title.textContent = 'Settings';

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cse-modal-close-btn';
  closeBtn.setAttribute('aria-label', 'Close settings');
  closeBtn.textContent = '✕';

  header.append(title, closeBtn);

  // Body
  const body = doc.createElement('div');
  body.className = 'cse-modal-body';

  const initialSettings = settingsStore.getSettings();

  // Music Volume row
  const musicRow = doc.createElement('div');
  musicRow.className = 'cse-settings-row';

  const musicLabel = doc.createElement('label');
  musicLabel.textContent = 'Music Volume';
  musicLabel.htmlFor = 'cse-music-vol';

  const musicSliderWrap = doc.createElement('div');
  musicSliderWrap.className = 'cse-settings-slider-wrap';

  const musicInput = doc.createElement('input');
  musicInput.id = 'cse-music-vol';
  musicInput.type = 'range';
  musicInput.min = '0';
  musicInput.max = '100';
  musicInput.step = '5';
  musicInput.value = String(initialSettings.musicVolume);

  const musicVal = doc.createElement('span');
  musicVal.className = 'cse-settings-val';
  musicVal.textContent = `${initialSettings.musicVolume}%`;

  musicSliderWrap.append(musicInput, musicVal);
  musicRow.append(musicLabel, musicSliderWrap);

  // SFX Volume row
  const sfxRow = doc.createElement('div');
  sfxRow.className = 'cse-settings-row';

  const sfxLabel = doc.createElement('label');
  sfxLabel.textContent = 'Sound Effects';
  sfxLabel.htmlFor = 'cse-sfx-vol';

  const sfxSliderWrap = doc.createElement('div');
  sfxSliderWrap.className = 'cse-settings-slider-wrap';

  const sfxInput = doc.createElement('input');
  sfxInput.id = 'cse-sfx-vol';
  sfxInput.type = 'range';
  sfxInput.min = '0';
  sfxInput.max = '100';
  sfxInput.step = '5';
  sfxInput.value = String(initialSettings.sfxVolume);

  const sfxVal = doc.createElement('span');
  sfxVal.className = 'cse-settings-val';
  sfxVal.textContent = `${initialSettings.sfxVolume}%`;

  sfxSliderWrap.append(sfxInput, sfxVal);
  sfxRow.append(sfxLabel, sfxSliderWrap);

  // Mute Audio row
  const muteRow = doc.createElement('div');
  muteRow.className = 'cse-settings-row cse-settings-row--checkbox';

  const muteLabel = doc.createElement('label');
  muteLabel.textContent = 'Mute All Audio';
  muteLabel.htmlFor = 'cse-mute-audio';

  const muteInput = doc.createElement('input');
  muteInput.id = 'cse-mute-audio';
  muteInput.type = 'checkbox';
  muteInput.checked = initialSettings.muted;

  muteRow.append(muteLabel, muteInput);

  // Difficulty row
  const diffRow = doc.createElement('div');
  diffRow.className = 'cse-settings-row';

  const diffLabel = doc.createElement('label');
  diffLabel.textContent = 'Difficulty';

  const diffGroup = doc.createElement('div');
  diffGroup.className = 'cse-difficulty-group';

  const diffButtons: HTMLButtonElement[] = [];
  const difficulties: GameDifficulty[] = ['Easy', 'Normal', 'Hard'];

  difficulties.forEach((diff) => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = `cse-difficulty-btn${initialSettings.difficulty === diff ? ' cse-difficulty-btn--active' : ''}`;
    btn.textContent = diff;
    btn.dataset.diff = diff;
    diffButtons.push(btn);
    diffGroup.append(btn);
  });

  diffRow.append(diffLabel, diffGroup);

  body.append(musicRow, sfxRow, muteRow, diffRow);

  // Footer
  const footer = doc.createElement('div');
  footer.className = 'cse-modal-footer';

  const resetBtn = doc.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'cse-modal-btn cse-modal-btn--secondary';
  resetBtn.textContent = 'Reset Defaults';

  const doneBtn = doc.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'cse-modal-btn cse-modal-btn--primary';
  doneBtn.textContent = 'Done';

  footer.append(resetBtn, doneBtn);

  card.append(header, body, footer);
  overlay.append(card);
  host.append(overlay);

  // Handlers
  musicInput.oninput = () => {
    const vol = parseInt(musicInput.value, 10);
    if (!Number.isNaN(vol)) {
      musicVal.textContent = `${vol}%`;
      settingsStore.setMusicVolume(vol);
    }
  };

  sfxInput.oninput = () => {
    const vol = parseInt(sfxInput.value, 10);
    if (!Number.isNaN(vol)) {
      sfxVal.textContent = `${vol}%`;
      settingsStore.setSfxVolume(vol);
    }
  };

  sfxInput.onchange = () => {
    soundManager.playSfx('hover');
  };

  muteInput.onchange = () => {
    settingsStore.setMuted(muteInput.checked);
    soundManager.playSfx('click');
  };

  diffButtons.forEach((btn) => {
    btn.onclick = () => {
      const diff = btn.dataset.diff as GameDifficulty;
      settingsStore.setDifficulty(diff);
      soundManager.playSfx('click');
      diffButtons.forEach((b) =>
        b.classList.toggle('cse-difficulty-btn--active', b.dataset.diff === diff)
      );
    };
  });

  resetBtn.onclick = () => {
    settingsStore.resetToDefaults();
    soundManager.playSfx('click');
    const reset = settingsStore.getSettings();
    musicInput.value = String(reset.musicVolume);
    musicVal.textContent = `${reset.musicVolume}%`;
    sfxInput.value = String(reset.sfxVolume);
    sfxVal.textContent = `${reset.sfxVolume}%`;
    muteInput.checked = reset.muted;
    diffButtons.forEach((b) =>
      b.classList.toggle('cse-difficulty-btn--active', b.dataset.diff === reset.difficulty)
    );
  };

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    doc.removeEventListener('keydown', handleKeydown);
    overlay.remove();
    options.onClose?.();
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      try {
        previousActiveElement.focus();
      } catch {
        // Safe fallback
      }
    }
  };

  const focusableElements = [
    closeBtn,
    musicInput,
    sfxInput,
    muteInput,
    ...diffButtons,
    resetBtn,
    doneBtn,
  ];

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      destroy();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = focusableElements.filter((el) => !el.disabled);
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

  if (options.signal) {
    if (options.signal.aborted) {
      destroy();
      return { element: overlay, destroy };
    }
    options.signal.addEventListener('abort', () => destroy(), { once: true });
  }

  closeBtn.onclick = destroy;
  doneBtn.onclick = destroy;
  overlay.onclick = (e: MouseEvent) => {
    if (e.target === overlay) destroy();
  };

  doc.addEventListener('keydown', handleKeydown);

  // Focus done button initially
  doneBtn.focus();

  return { element: overlay, destroy };
}
