// Shared fade-to-black transition for every screen change (menu, map, levels, minigames).
// Plain DOM + Web Animations, no Phaser, so the standalone UI modules (main menu/, map/) can use it too.
//
// How it looks: the screen quickly goes black, stays black for a moment while the next screen
// is built, then fades back in. Tune everything in FADE_TRANSITION below; it changes every
// screen change in the game at once.

/** Every knob for the transition (times in ms). */
export const FADE_TRANSITION = {
    enabled: true, // false = screens change instantly
    fadeOutMs: 120, // Screen goes black
    holdMs: 80, // Minimum time fully black (longer if the next screen is still loading)
    fadeInMs: 120, // Screen comes back
    maxWaitMs: 4000, // Fade in anyway if the next screen takes longer than this to get ready
    color: '#000000',
    easingOut: 'ease-in',
    easingIn: 'ease-out',
    zIndex: 9000, // Above the game canvas and every DOM overlay
    respectReducedMotion: true, // Players who ask the OS for less motion get an instant change
};

let running: Promise<void> | null = null;

// True while a transition is playing; callers can ignore extra clicks in the meantime.
export function isFadeTransitionRunning(): boolean {
    return running !== null;
}

// Whether to animate at all: off when disabled, with reduced motion, or without Web Animations
// (e.g. jsdom in unit tests), where the screen changes instantly instead.
function shouldAnimate(): boolean {
    if (!FADE_TRANSITION.enabled) return false;
    if (typeof document === 'undefined' || typeof Element === 'undefined') return false;
    if (typeof Element.prototype.animate !== 'function') return false;
    if (FADE_TRANSITION.respectReducedMotion && typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
}

// Full-screen black layer that blocks clicks while it is up.
function createCurtain(): HTMLDivElement {
    const curtain = document.createElement('div');
    curtain.className = 'fade-transition';
    curtain.setAttribute('aria-hidden', 'true');
    Object.assign(curtain.style, {
        position: 'fixed', inset: '0', zIndex: String(FADE_TRANSITION.zIndex),
        background: FADE_TRANSITION.color, opacity: '0', pointerEvents: 'auto',
    });
    return curtain;
}

// Waits for a Web Animation to end (or be cancelled).
function finished(animation: Animation): Promise<void> {
    return animation.finished.then(() => undefined, () => undefined);
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fades to black, runs `swap` (the function that changes the screen), then fades back in.
 * If swap returns a Promise, the fade-in waits for it (up to maxWaitMs). Calls made while
 * another transition is playing are ignored. Without animation support swap just runs at once.
 */
export function fadeTransition(swap: () => void | Promise<void>): Promise<void> {
    if (running) return running;
    if (!shouldAnimate()) {
        const result = swap();
        // Don't wait for the swap here: tests and instant mode must not hang on it.
        void Promise.resolve(result).catch(error => console.error(error));
        return Promise.resolve();
    }
    running = play(swap).finally(() => { running = null; });
    return running;
}

// The animation itself: fade out, swap, hold, fade in, clean up.
async function play(swap: () => void | Promise<void>): Promise<void> {
    const cfg = FADE_TRANSITION;
    const curtain = createCurtain();
    document.body.append(curtain);
    try {
        await finished(curtain.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: cfg.fadeOutMs, easing: cfg.easingOut, fill: 'forwards',
        }));

        let swapError: unknown = null;
        const swapped = Promise.resolve().then(swap).catch(error => { swapError = error; });
        await Promise.all([Promise.race([swapped, delay(cfg.maxWaitMs)]), delay(cfg.holdMs)]);
        // Let the new screen draw one frame before showing it.
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (swapError) console.error(swapError);

        await finished(curtain.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: cfg.fadeInMs, easing: cfg.easingIn, fill: 'forwards',
        }));
    } finally {
        curtain.remove();
    }
}
