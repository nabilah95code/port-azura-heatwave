// The save game: one JSON record in localStorage holding cash, story progress,
// position and lifetime stats. Storage can be unavailable (private windows), so
// every access is guarded and failure just means the save lasts the visit.
import { SAVE_KEY } from './config.js';

/** Read the saved game, or null when there is none (or it is unreadable). */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Write the save game. */
export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage off: play on without persisting.
  }
}

/** Forget the save game (New Game). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** True when a save game exists for the title screen's Continue button. */
export function hasSave() {
  return loadSave() !== null;
}
