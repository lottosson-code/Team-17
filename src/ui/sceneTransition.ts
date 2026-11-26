import Phaser from 'phaser';
import { fadeTransition } from './fadeTransition';

// Phaser helpers for the shared fade-to-black transition (see fadeTransition.ts for the look).
// Use these instead of scene.start / scene.restart wherever the player changes screen.

// Resolves when `target` has finished create(), i.e. the new screen is built and can be shown.
// Resolves at once if the scene can't be watched (e.g. mocked scenes in unit tests).
function whenCreated(target: Phaser.Scene | undefined): Promise<void> {
    if (!target?.events?.once) return Promise.resolve();
    return new Promise(resolve => target.events.once(Phaser.Scenes.Events.CREATE, () => resolve()));
}

// Starts another scene behind the fade-to-black transition (replaces from.scene.start(key, data)).
export function startSceneWithTransition(from: Phaser.Scene, key: string, data?: object): Promise<void> {
    return fadeTransition(() => {
        const ready = whenCreated(from.scene.get?.(key));
        from.scene.start(key, data);
        return ready;
    });
}

// Restarts the current scene behind the fade-to-black transition (replaces scene.scene.restart(data)).
export function restartSceneWithTransition(scene: Phaser.Scene, data?: object): Promise<void> {
    return fadeTransition(() => {
        const ready = whenCreated(scene);
        scene.scene.restart(data);
        return ready;
    });
}
