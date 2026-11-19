// Port Azura: Heatwave — boot, the game loop and the screen state machine.
// The world advances in fixed 1/60 s steps; the renderer and HUD paint after.
// Screens: title, help, play, pause, busted, wasted. The city stays alive
// behind the title screen; everything freezes behind pause and the end screens.
//
// ?shot=<scene>&seed=<n> stages a screenshot scene instead of running the
// game (see shots.js and shots.json); it paints twice and sets
// window.__shotReady when the frame is final.
import { MUTE_KEY, START_DEBT, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { generateCity } from './city.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_HORN, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { clearSave, hasSave, loadSave, writeSave } from './save.js';
import {
  createPlayer, enterCar, exitCar, nearestEnterableCar, spawnParkedCars,
  spawnPed, spawnTrafficCar, updateEntities,
} from './entities.js';
import { MISSIONS, banner, createStory, refreshObjective, say, updateMissions } from './missions.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const CITY_SEED = 20261119;
const MAX_FRAME = 0.25;

/** An input that does nothing: the title screen's idle world runs on it. */
const IDLE_INPUT = {
  mouse: { x: 0, y: 0, down: false },
  down: () => false,
  wasPressed: () => false,
  axis: () => ({ x: 0, y: 0 }),
  sprint: () => false,
  brake: () => false,
  takeActions: () => 0,
  takeClicks: () => [],
};

/** Build the whole game state around a fresh Port Azura. */
export function createGame(canvas) {
  const audio = createAudio();
  const rng = createRandom(CITY_SEED);
  const city = generateCity(createRandom(CITY_SEED));
  const state = {
    time: 0,
    clock: 13 * 60 + 24,
    screen: 'title',
    city,
    rng,
    player: createPlayer(city.landmarks.motel.doorX, city.landmarks.motel.doorY + 12),
    cars: [],
    peds: [],
    wanted: 0,
    wantedCalm: 0,
    crimeCd: { steal: 0, shoot: 0, hitPed: 0, killPed: 0, hitPolice: 0 },
    policeSpawnTimer: 0,
    ambientTimer: 0,
    tracers: [],
    particles: [],
    floaters: [],
    dialogue: [],
    events: [],
    banner: null,
    objective: null,
    cash: 120,
    debt: START_DEBT,
    story: createStory(),
    storyTitle: '',
    stats: { earned: 0, stolen: 0 },
    camera: { x: city.landmarks.motel.x, y: city.landmarks.motel.y },
    shake: 0,
    audio,
    mouse: { x: 0, y: 0, down: false },
    hint: '',
    nearGarage: false,
    garageDwell: 0,
    hasSave: hasSave(),
    lastFine: 0,
    requestSave: false,
  };
  populateCity(state);
  return state;
}

/** Fill a fresh city: parked cars in the lots, traffic on the roads, people out. */
function populateCity(state) {
  state.cars = [];
  state.peds = [];
  spawnParkedCars(state);
  for (let i = 0; i < 16; i++) spawnTrafficCar(state);
  for (let i = 0; i < 40 && state.peds.length < 30; i++) spawnPed(state);
}

/** The save record for the current run. */
function saveRecord(state) {
  return {
    cash: state.cash,
    debt: state.debt,
    storyIndex: state.story.index,
    storyDone: state.story.done,
    player: { x: state.player.x, y: state.player.y },
    stats: state.stats,
  };
}

/** Persist the game (after jobs, and from the pause menu). */
export function saveGame(state) {
  writeSave(saveRecord(state));
  state.hasSave = true;
}

/** Start over: a fresh debt, a fresh story, the same sunny city. */
export function newGame(state) {
  clearSave();
  state.cash = 120;
  state.debt = START_DEBT;
  state.stats = { earned: 0, stolen: 0 };
  state.story = createStory();
  state.wanted = 0;
  state.wantedCalm = 0;
  state.dialogue = [];
  state.objective = null;
  const motel = state.city.landmarks.motel;
  state.player = createPlayer(motel.doorX, motel.doorY + 12);
  populateCity(state);
  state.screen = 'play';
  state.hasSave = false;
  banner(state, 'Port Azura', 'Five jobs between you and a clean slate.');
  say(state, 'Dalia (phone)', 'Morning, Milo. Beautiful day to owe me money. First job incoming — check the gold beacon.');
}

/** Continue from the save: cash, story progress and position restored. */
export function continueGame(state) {
  const save = loadSave();
  if (!save) {
    newGame(state);
    return;
  }
  state.cash = save.cash;
  state.debt = save.debt;
  state.stats = save.stats ?? { earned: 0, stolen: 0 };
  state.story = createStory();
  state.story.index = Math.min(save.storyIndex ?? 0, MISSIONS.length - 1);
  state.story.done = Boolean(save.storyDone);
  if (state.story.done) state.story.index = MISSIONS.length;
  state.story.breather = 2;
  state.story.sideJobTimer = 8;
  state.wanted = 0;
  state.player = createPlayer(save.player?.x ?? state.city.landmarks.motel.doorX, save.player?.y ?? state.city.landmarks.motel.doorY + 12);
  populateCity(state);
  state.screen = 'play';
  banner(state, 'Welcome back', state.story.done ? 'The city is yours.' : 'Dalia is still waiting on her money.');
}

/** The price of an arrest or a hospital visit, and where the player wakes up. */
function settleEnd(state, kind) {
  const fine = kind === 'busted'
    ? Math.min(state.cash, 60 + state.wanted * 45)
    : Math.floor(state.cash * 0.12);
  state.lastFine = fine;
  state.cash -= fine;
  const spot = kind === 'busted' ? state.city.landmarks.station : state.city.landmarks.hospital;
  if (state.player.car) {
    state.player.car.driver = null;
    state.player.car = null;
  }
  state.player.x = spot.doorX;
  state.player.y = spot.doorY + 10;
  state.player.health = 100;
  state.player.dead = false;
  state.player.bustMeter = 0;
  state.wanted = 0;
  state.wantedCalm = 0;
  state.audio.engine(0, false);
  state.audio.siren(0);
}

/** Process the world's event queue: arrests, hospital trips, lost heat. */
function handleEvents(state) {
  for (const event of state.events) {
    if (event.type === 'busted' && state.screen === 'play') {
      settleEnd(state, 'busted');
      state.screen = 'busted';
      state.audio.fail();
    } else if (event.type === 'wasted' && state.screen === 'play') {
      settleEnd(state, 'wasted');
      state.screen = 'wasted';
      state.audio.fail();
    }
  }
  state.events = [];
}

/** The contextual hint line: what E would do, what the garage offers. */
function refreshHint(state) {
  const player = state.player;
  if (player.car) {
    state.hint = state.nearGarage ? 'Sunset Garage: hold still — fresh plates, $150' : '';
    return;
  }
  const car = nearestEnterableCar(state);
  state.hint = car ? `E — ${car.driver === 'traffic' ? 'steal' : 'get in'} the ${car.kind}` : '';
}

/** Steer the camera: follow the player with a little velocity lead. */
function updateCamera(state, dt, w, h) {
  const target = state.player.car ?? state.player;
  const lead = 0.32;
  const tx = target.x + (target.vx ?? 0) * lead;
  const ty = target.y + (target.vy ?? 0) * lead;
  const cam = state.camera;
  const k = Math.min(1, dt * 5.2);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.x = w >= WORLD ? WORLD / 2 : Math.min(WORLD - w / 2, Math.max(w / 2, cam.x));
  cam.y = h >= WORLD ? WORLD / 2 : Math.min(WORLD - h / 2, Math.max(h / 2, cam.y));
}

/** Advance the game one fixed step, given the live input. */
export function stepGame(state, input, dt) {
  state.time += dt;
  state.mouse = input.mouse;
  if (state.banner) state.banner.t -= dt;
  for (const line of state.dialogue) line.t -= dt;
  state.dialogue = state.dialogue.filter((line) => line.t > 0);
  state.shake = Math.max(0, state.shake - dt * 16);

  if (state.screen === 'title' || state.screen === 'help') {
    // The city idles behind the menus: traffic flows, people stroll.
    updateEntities(state, IDLE_INPUT, state.player, dt);
    const t = state.time * 0.05;
    state.camera.x = WORLD / 2 + Math.cos(t) * 620;
    state.camera.y = WORLD / 2 + Math.sin(t * 0.8) * 620;
    return;
  }
  if (state.screen !== 'play') return;

  state.clock = (state.clock + dt * 0.22) % (24 * 60);
  const cam = state.camera;
  const mouseWorld = {
    x: input.mouse.x + cam.x - state.viewW / 2,
    y: input.mouse.y + cam.y - state.viewH / 2,
  };

  updateEntities(state, input, mouseWorld, dt);
  updateMissions(state, dt);
  state.storyTitle = state.story.active ? MISSIONS[state.story.index].title : state.story.done ? 'Free roam' : 'Port Azura';
  refreshHint(state);
  handleEvents(state);
  if (state.requestSave) {
    state.requestSave = false;
    saveGame(state);
  }
  state.audio.music(dt);
}

/** Handle one-shot actions and menu clicks for the current screen. */
export function handleActions(state, input, hud) {
  const actions = input.takeActions();
  const clicks = input.takeClicks();
  const clickButton = (ids) => {
    for (const click of clicks) {
      for (let i = hud.buttons.length - 1; i >= 0; i--) {
        const b = hud.buttons[i];
        if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
          if (ids.includes(b.id)) return b.id;
        }
      }
    }
    return null;
  };

  if (actions & ACTION_MUTE) {
    const muted = !state.audio.isMuted();
    state.audio.setMuted(muted);
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch { /* storage off */ }
  }

  if (state.screen === 'title') {
    const id = clickButton(['new', 'continue', 'help']);
    if (id === 'new') newGame(state);
    else if (id === 'continue') continueGame(state);
    else if (id === 'help') state.screen = 'help';
    else if (actions & ACTION_CONFIRM) (state.hasSave ? continueGame : newGame)(state);
    return;
  }
  if (state.screen === 'help') {
    if (clickButton(['back']) || (actions & ACTION_PAUSE)) state.screen = 'title';
    return;
  }
  if (state.screen === 'busted' || state.screen === 'wasted') {
    if (clickButton(['continue-after-end']) || (actions & ACTION_CONFIRM)) state.screen = 'play';
    return;
  }
  if (state.screen === 'pause') {
    const id = clickButton(['resume', 'save', 'mute', 'restart', 'title']);
    if (id === 'resume' || (actions & ACTION_PAUSE)) state.screen = 'play';
    else if (id === 'save') {
      saveGame(state);
      banner(state, 'Saved', 'Port Azura will remember this.');
    } else if (id === 'mute') {
      // Handled by the ACTION_MUTE path only when M is pressed; a click toggles here.
      const muted = !state.audio.isMuted();
      state.audio.setMuted(muted);
    } else if (id === 'restart') newGame(state);
    else if (id === 'title') state.screen = 'title';
    return;
  }
  // Play screen.
  if (actions & ACTION_PAUSE) {
    state.screen = 'pause';
    state.audio.engine(0, false);
    return;
  }
  if (actions & ACTION_ENTER) {
    if (state.player.car) exitCar(state);
    else {
      const car = nearestEnterableCar(state);
      if (car) enterCar(state, car);
    }
  }
  if ((actions & ACTION_HORN) && state.player.car) state.audio.horn();
}

/** Boot the page: size the canvas, build the game, run the loop (or a shot). */
function boot() {
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  const renderer = createRenderer(canvas);
  const hud = createHud(canvas);
  const state = createGame(canvas);
  state.viewW = canvas.width;
  state.viewH = canvas.height;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.viewW = canvas.width;
    state.viewH = canvas.height;
  }
  resize();
  window.addEventListener('resize', resize);

  try {
    if (window.localStorage.getItem(MUTE_KEY) === '1') state.audio.setMuted(true);
  } catch { /* storage off */ }

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    stageShot(shot, state);
    let painted = 0;
    const paint = () => {
      renderer.draw(state);
      hud.draw(state);
      painted += 1;
      if (painted < 3) requestAnimationFrame(paint);
      else window.__shotReady = true;
    };
    requestAnimationFrame(paint);
    return;
  }

  const input = createInput(canvas);
  const wake = () => state.audio.unlock();
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(state, input, hud);
    while (accumulator >= STEP) {
      stepGame(state, input, STEP);
      accumulator -= STEP;
      if (state.screen === 'pause' || state.screen === 'busted' || state.screen === 'wasted') {
        accumulator = 0;
        break;
      }
    }
    updateCamera(state, 1 / 60, canvas.width, canvas.height);
    renderer.draw(state);
    hud.draw(state);
    if (status) status.textContent = `Port Azura Heatwave — ${state.screen}. Cash $${state.cash}. Wanted ${state.wanted} stars.`;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') state.screen = 'pause';
  });
  requestAnimationFrame(frame);
}

boot();
