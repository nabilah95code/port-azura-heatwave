// Keyboard and mouse state for the game. Held keys are read every frame;
// one-shot actions (enter car, pause, confirm) are queued as edge events the
// game consumes once. The mouse position is tracked in canvas pixels so the
// HUD menus and the player's aim share one coordinate space.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_HORN = 8;
export const ACTION_MUTE = 16;

/** Create the input tracker bound to a canvas. */
export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const clicks = [];
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  function queueFor(code) {
    if (code === 'Enter' || code === 'Space') actions |= ACTION_CONFIRM;
    if (code === 'Escape' || code === 'KeyP') actions |= ACTION_PAUSE;
    if (code === 'KeyE') actions |= ACTION_ENTER;
    if (code === 'KeyH') actions |= ACTION_HORN;
    if (code === 'KeyM') actions |= ACTION_MUTE;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      queueFor(event.code);
      pressed.add(event.code);
    }
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }
  canvas.addEventListener('mousemove', (event) => {
    const point = toCanvas(event);
    mouse.x = point.x;
    mouse.y = point.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = toCanvas(event);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.down = true;
    clicks.push(point);
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  return {
    mouse,
    /** Is a key currently held down? */
    down: (code) => held.has(code),
    /** Was a key pressed since the last frame? (Consumed by reading.) */
    wasPressed(code) {
      const had = pressed.has(code);
      pressed.delete(code);
      return had;
    },
    /** Movement axes from WASD and the arrow keys: x right, y down, each -1..1. */
    axis() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Sprint held (Shift). */
    sprint: () => held.has('ShiftLeft') || held.has('ShiftRight'),
    /** Handbrake / brake held (Space). */
    brake: () => held.has('Space'),
    /** Queued one-shot actions since the last call; clears the queue. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Queued mouse clicks in canvas pixels since the last call; clears them. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}
