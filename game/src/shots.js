// The screenshot scenes behind ?shot=chase|city|mission|start. Each one builds
// a real moment of the game — a police chase at three stars, a downtown
// sidewalk, a delivery run with Dalia on the phone, the title screen over the
// living city — by placing the cast and then running the genuine simulation
// with scripted input for a second or two. Same seed, same frame, every time.
import { STEP } from './config.js';
import { spawnCar, spawnPed } from './entities.js';
import { refreshObjective, say } from './missions.js';
import { stepGame } from './main.js';

/** A scripted stand-in for the keyboard: a held axis, nothing else. */
function scriptedInput(state, axis, brake = false) {
  return {
    mouse: { x: state.viewW / 2, y: state.viewH / 2, down: false },
    down: () => false,
    wasPressed: () => false,
    axis: () => axis,
    sprint: () => false,
    brake: () => brake,
    takeActions: () => 0,
    takeClicks: () => [],
  };
}

/** Run the simulation forward, keeping the camera on the player. */
function runScene(state, input, seconds, lookAhead = 0) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    stepGame(state, input, STEP);
    state.camera.x = state.player.x + lookAhead;
    state.camera.y = state.player.y;
  }
}

/** Put the player behind the wheel of a fresh car at a place and heading. */
function putPlayerInCar(state, kind, x, y, angle) {
  const car = spawnCar(state, kind, x, y, angle, 'player');
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

/** Add a police interceptor already rolling, in chase mode. */
function addPolice(state, x, y, angle) {
  const car = spawnCar(state, 'police', x, y, angle, 'police');
  car.mode = 'chase';
  car.vx = Math.cos(angle) * 150;
  car.vy = Math.sin(angle) * 150;
  return car;
}

/** Add a traffic car with a heading the road AI can pick up. */
function addTraffic(state, kind, x, y, dirIndex) {
  const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const car = spawnCar(state, kind, x, y, angles[dirIndex], 'traffic');
  car.dirIndex = dirIndex;
  return car;
}

/** Scene: three stars, Dalia in the passenger seat, the PAPD closing in. */
function stageChase(state) {
  state.screen = 'play';
  state.story.index = 2;
  state.story.active = true;
  state.story.step = 1;
  state.story.passenger = true;
  putPlayerInCar(state, 'coupe', 1560, 2190, 0);
  state.player.car.color = '#204060';
  state.wanted = 3;
  addPolice(state, 1290, 2190, 0);
  addPolice(state, 1380, 2132, 0);
  addPolice(state, 1190, 2248, 0);
  addTraffic(state, 'sedan', 2120, 2190, 0);
  addTraffic(state, 'taxi', 2380, 2130, 2);
  refreshObjective(state);
  runScene(state, scriptedInput(state, { x: 0.12, y: -1 }), 0.95, 130);
  state.banner = null;
}

/** Scene: Milo on foot downtown, traffic flowing, the first job waiting. */
function stageCity(state) {
  state.screen = 'play';
  state.story.active = true;
  state.story.step = 0;
  state.player.x = 2558;
  state.player.y = 1790;
  state.player.angle = Math.PI;
  spawnPed(state, 2530, 1740);
  spawnPed(state, 2590, 1850);
  spawnPed(state, 2500, 1900);
  spawnPed(state, 2610, 1690);
  spawnPed(state, 2470, 1800);
  addTraffic(state, 'taxi', 2670, 1560, 1);
  addTraffic(state, 'sedan', 2610, 1980, 3);
  refreshObjective(state);
  runScene(state, scriptedInput(state, { x: 0, y: 0 }), 0.7);
  state.banner = null;
}

/** Scene: the first delivery, rolling south to the marina, cook on the phone. */
function stageMission(state) {
  state.screen = 'play';
  state.story.active = true;
  state.story.step = 1;
  putPlayerInCar(state, 'sedan', 3090, 3120, Math.PI / 2);
  state.player.car.color = '#c94f42';
  addTraffic(state, 'van', 3150, 2760, 3);
  addTraffic(state, 'sedan', 3090, 3480, 1);
  refreshObjective(state);
  runScene(state, scriptedInput(state, { x: 0, y: -1 }), 0.55, 0);
  say(state, 'Cook', 'No name, no questions. Just get it to the marina before it gets warm.');
  state.banner = null;
}

/** Scene: the title screen, the city idling in the afternoon sun behind it. */
function stageStart(state) {
  state.screen = 'title';
  state.hasSave = false;
  runScene(state, scriptedInput(state, { x: 0, y: 0 }), 1.6);
}

/** Stage the named scene on a fresh game state. Unknown names stage the chase. */
export function stageShot(name, state) {
  if (name === 'city') stageCity(state);
  else if (name === 'mission') stageMission(state);
  else if (name === 'start') stageStart(state);
  else stageChase(state);
}
