import type Phaser from 'phaser';

/** Align a DOM UI host with the actual FIT-scaled Phaser canvas. */
export function createSceneOverlay(scene: Phaser.Scene) {
  const canvas = scene.game.canvas;
  const parent = canvas.parentElement;
  if (!parent) throw Error('Missing game canvas parent');
  const element = parent.ownerDocument.createElement('div');
  element.className = 'game-ui-host';
  element.dataset.scene = scene.sys.settings.key;
  parent.append(element);
  let destroyed = false;

  function resize(): void {
    if (destroyed) return;
    const bounds = canvas.getBoundingClientRect();
    const area = parent!.getBoundingClientRect();
    Object.assign(element.style, {
      left: bounds.left - area.left + 'px', top: bounds.top - area.top + 'px',
      width: bounds.width + 'px', height: bounds.height + 'px',
    });
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  observer.observe(parent);
  scene.scale.on('resize', resize);
  window.addEventListener('resize', resize);
  resize();

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    observer.disconnect();
    scene.scale.off('resize', resize);
    window.removeEventListener('resize', resize);
    element.remove();
  }
  scene.events.once('shutdown', destroy);
  return { element, destroy };
}
