// Everything that moves: the player, traffic, parked cars, pedestrians and the
// Port Azura PD. Cars share one arcade physics model (a velocity vector the
// heading only partly grips), traffic follows the road grid lane by lane,
// police pursue the player, and crimes feed the wanted level.
import {
  CAR_TYPES, PLAYER_MAX_HEALTH, PLAYER_RADIUS, PLAYER_SPRINT, PLAYER_WALK,
  ROAD_CENTERS, WANTED_DECAY_SECONDS, WORLD,
} from './config.js';
import { clampToWorld, collideBuildings, hitsBuilding } from './city.js';

/** Compass directions as unit vectors: east, south, west, north. */
const DIRS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

/** Lane offset for a heading: right-hand traffic, 30 px to the driver's right. */
function laneOffset(dir) {
  return { x: -dir.y * 30, y: dir.x * 30 };
}

/** The next road centre line strictly ahead of `value` travelling `sign`. */
function nextCentre(value, sign) {
  let best = null;
  for (const centre of ROAD_CENTERS) {
    const ahead = sign > 0 ? centre > value + 26 : centre < value - 26;
    if (ahead && (best === null || Math.abs(centre - value) < Math.abs(best - value))) best = centre;
  }
  return best;
}

/** Wrap an angle to [-PI, PI]. */
export function angleWrap(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Distance between two points. */
export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

let nextId = 1;

/** Create any car. Driver is 'traffic', 'police', 'player' or null (parked). */
export function spawnCar(state, kind, x, y, angle, driver) {
  const spec = CAR_TYPES[kind];
  const car = {
    id: nextId++,
    kind,
    x, y, angle,
    vx: 0, vy: 0,
    color: state.rng.pick(spec.colors),
    radius: spec.radius,
    driver,
    hp: kind === 'police' ? 130 : 90,
    cruise: state.rng.range(118, 168),
    target: null,
    dirIndex: 0,
    disabled: false,
    missionCar: false,
    lightPhase: state.rng.range(0, 6),
    hitCooldown: 0,
  };
  state.cars.push(car);
  return car;
}

/** Fill the city's parking spots with stealable cars. */
export function spawnParkedCars(state) {
  for (const spot of state.city.spots) {
    if (state.rng.chance(0.35)) continue;
    const kind = state.rng.pick(['sedan', 'sedan', 'taxi', 'coupe', 'van']);
    const car = spawnCar(state, kind, spot.x, spot.y, spot.angle, null);
    spot.taken = true;
    car.spot = spot;
  }
}

/** A traffic car's next waypoint: its lane point at the next intersection. */
function trafficTarget(car) {
  const dir = DIRS[car.dirIndex];
  const ahead = dir.x !== 0 ? nextCentre(car.x, dir.x) : nextCentre(car.y, dir.y);
  const limit = dir.x !== 0 ? (dir.x > 0 ? WORLD - 130 : 130) : (dir.y > 0 ? WORLD - 200 : 130);
  const along = ahead === null ? limit : ahead;
  const cross = dir.x !== 0 ? car.y : car.x;
  const centreLine = nearestCentre(cross);
  const off = laneOffset(dir);
  return dir.x !== 0
    ? { x: along + off.x, y: centreLine + off.y }
    : { x: centreLine + off.x, y: along + off.y };
}

/** The nearest road centre line to a coordinate. */
function nearestCentre(value) {
  let best = ROAD_CENTERS[0];
  for (const centre of ROAD_CENTERS) {
    if (Math.abs(centre - value) < Math.abs(best - value)) best = centre;
  }
  return best;
}

/** Spawn one traffic car on a random road, away from the player. */
export function spawnTrafficCar(state) {
  const rng = state.rng;
  const horizontal = rng.chance(0.5);
  const centre = rng.pick(ROAD_CENTERS);
  const along = rng.range(160, WORLD - 320);
  const dirIndex = horizontal ? (rng.chance(0.5) ? 0 : 2) : (rng.chance(0.5) ? 1 : 3);
  const dir = DIRS[dirIndex];
  const off = laneOffset(dir);
  const x = horizontal ? along : centre + off.x;
  const y = horizontal ? centre + off.y : along;
  if (distance(x, y, state.player.x, state.player.y) < 460) return null;
  const kind = rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'coupe', 'van']);
  const car = spawnCar(state, kind, x, y, Math.atan2(dir.y, dir.x), 'traffic');
  car.dirIndex = dirIndex;
  car.target = trafficTarget(car);
  return car;
}

/** Spawn a pedestrian on a sidewalk leg. */
export function spawnPed(state, x, y) {
  const rng = state.rng;
  let px = x;
  let py = y;
  if (px === undefined) {
    const centre = rng.pick(ROAD_CENTERS);
    const side = rng.chance(0.5) ? -74 : 74;
    if (rng.chance(0.5)) {
      px = centre + side;
      py = rng.range(140, WORLD - 300);
    } else {
      px = rng.range(140, WORLD - 300);
      py = centre + side;
    }
    if (distance(px, py, state.player.x, state.player.y) < 420) return null;
  }
  const ped = {
    id: nextId++,
    x: px, y: py,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(38, 68),
    shirt: rng.pick(['#e86a5e', '#4a7fb5', '#f2b01e', '#5d8a66', '#e8e8ec', '#9b7ede', '#3f3f46', '#f6cfa8']),
    skin: rng.pick(['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac', '#6b4226']),
    state: 'walk',
    target: null,
    timer: rng.range(0, 2),
    hp: 60,
    hitCooldown: 0,
    downTime: 0,
  };
  ped.target = pickPedTarget(state, ped);
  state.peds.push(ped);
  return ped;
}

/** A sidewalk point for a pedestrian to stroll toward (an intersection corner). */
function pickPedTarget(state, ped) {
  const rng = state.rng;
  const cx = rng.pick(ROAD_CENTERS);
  const cy = rng.pick(ROAD_CENTERS);
  return {
    x: cx + (rng.chance(0.5) ? -74 : 74),
    y: cy + (rng.chance(0.5) ? -74 : 74),
  };
}

/** Create the player: Milo Vane, on foot outside his motel. */
export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    vx: 0, vy: 0,
    health: PLAYER_MAX_HEALTH,
    car: null,
    fireCooldown: 0,
    bustMeter: 0,
    dead: false,
    shirt: '#123c3f', // Milo's teal shirt: the renderer picks him out by it.
    skin: '#f1c27d',
  };
}

/** Add heat. Witnessed crimes are reported through reportCrime instead. */
export function addWanted(state, amount) {
  const before = state.wanted;
  state.wanted = Math.min(5, Math.max(0, state.wanted + amount));
  if (state.wanted > before) {
    state.wantedCalm = 0;
    state.audio.star();
    state.floaters.push({ x: state.player.x, y: state.player.y - 34, text: '★'.repeat(state.wanted), color: '#ffd94a', life: 1.4 });
  }
}

/** Is anyone (pedestrian or police) close enough to have seen a crime? */
function witnessed(state, x, y, range) {
  for (const ped of state.peds) {
    if (ped.state !== 'down' && distance(x, y, ped.x, ped.y) < range) return true;
  }
  for (const car of state.cars) {
    if (car.driver === 'police' && distance(x, y, car.x, car.y) < range + 60) return true;
  }
  return false;
}

/**
 * Report a crime to the wanted system. Kinds: steal, stealParked, shoot,
 * hitPed, killPed, hitPolice. Each kind has its own cooldown so one incident
 * cannot stack stars frame after frame.
 */
export function reportCrime(state, kind, x, y) {
  const cd = state.crimeCd;
  const px = x ?? state.player.x;
  const py = y ?? state.player.y;
  if (kind === 'steal' && cd.steal <= 0) {
    cd.steal = 2;
    addWanted(state, 1);
  } else if (kind === 'stealParked' && cd.steal <= 0) {
    cd.steal = 2;
    if (witnessed(state, px, py, 330)) addWanted(state, 1);
  } else if (kind === 'shoot' && cd.shoot <= 0) {
    cd.shoot = 4;
    if (witnessed(state, px, py, 350)) addWanted(state, 1);
  } else if (kind === 'hitPed' && cd.hitPed <= 0) {
    cd.hitPed = 3;
    if (witnessed(state, px, py, 370)) addWanted(state, 1);
  } else if (kind === 'killPed' && cd.killPed <= 0) {
    cd.killPed = 3;
    addWanted(state, 1);
  } else if (kind === 'hitPolice' && cd.hitPolice <= 0) {
    cd.hitPolice = 3;
    addWanted(state, 1);
  }
}

/** The shared arcade car physics: throttle, steer (-1..1), brake, one tick. */
export function driveCar(state, car, throttle, steer, brake, dt, topSpeed) {
  const spec = CAR_TYPES[car.kind];
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  let forwardSpeed = car.vx * forward.x + car.vy * forward.y;
  const grip = brake ? 2.2 : 8.5;

  // Steering bites in proportion to speed, and reverses when reversing.
  const steerAuthority = Math.max(-1, Math.min(1, forwardSpeed / 130));
  car.angle += steer * 1.9 * steerAuthority * dt * (brake ? 1.35 : 1);

  const newForward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  forwardSpeed = car.vx * newForward.x + car.vy * newForward.y;
  const lateral = {
    x: car.vx - newForward.x * forwardSpeed,
    y: car.vy - newForward.y * forwardSpeed,
  };
  const keep = Math.max(0, 1 - grip * dt);
  car.vx = newForward.x * forwardSpeed + lateral.x * keep;
  car.vy = newForward.y * forwardSpeed + lateral.y * keep;

  // A wrecked car is dead — except the player's, which limps at walking pace
  // so a mission can never soft-lock on a smoking engine.
  const power = car.disabled ? (car.driver === 'player' ? 0.32 : 0) : 1;
  const limit = car.disabled && car.driver === 'player' ? Math.min(topSpeed, 92) : topSpeed;
  if (power > 0) {
    if (throttle > 0 && forwardSpeed < limit) {
      car.vx += newForward.x * spec.accel * power * throttle * dt;
      car.vy += newForward.y * spec.accel * power * throttle * dt;
    } else if (throttle < 0 && forwardSpeed > -118) {
      car.vx += newForward.x * spec.accel * 0.7 * throttle * dt;
      car.vy += newForward.y * spec.accel * 0.7 * throttle * dt;
    }
  }
  if (brake) {
    car.vx *= Math.max(0, 1 - 2.6 * dt);
    car.vy *= Math.max(0, 1 - 2.6 * dt);
  }
  // Rolling drag and a hard cap at the car's top speed (plus a little overshoot).
  const drag = Math.max(0, 1 - 0.35 * dt);
  car.vx *= drag;
  car.vy *= drag;
  const speed = Math.hypot(car.vx, car.vy);
  const cap = topSpeed * 1.12;
  if (speed > cap) {
    car.vx = (car.vx / speed) * cap;
    car.vy = (car.vy / speed) * cap;
  }
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const clamped = clampToWorld(car.x, car.y);
  car.x = clamped.x;
  car.y = clamped.y;
  return Math.hypot(car.vx, car.vy);
}

/** Collide a car with the buildings: scrape, damage and a crash sound. */
function collideCarBuildings(state, car, dt) {
  const before = { x: car.x, y: car.y };
  const fixed = collideBuildings(state.city.buildings, car.x, car.y, car.radius);
  const pushX = fixed.x - before.x;
  const pushY = fixed.y - before.y;
  const push = Math.hypot(pushX, pushY);
  if (push < 0.5) return;
  car.x = fixed.x;
  car.y = fixed.y;
  const speed = Math.hypot(car.vx, car.vy);
  const nx = pushX / (push || 1);
  const ny = pushY / (push || 1);
  const into = car.vx * nx + car.vy * ny;
  if (into < 0) {
    car.vx -= into * nx * 1.4;
    car.vy -= into * ny * 1.4;
  }
  car.vx *= 0.55;
  car.vy *= 0.55;
  if (speed > 150) {
    car.hp -= (speed - 150) / 14;
    state.audio.crash(speed / 30);
    if (car.driver === 'player') {
      state.shake = Math.min(9, (speed - 150) / 26);
      damagePlayer(state, (speed - 150) / 22);
    }
    spawnParticles(state, car.x, car.y, 6, '#cfd4d8', 90, 0.4);
  }
}

/** Collide two cars: push apart, trade momentum, dent both. */
function collideCarPair(state, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDist = a.radius + b.radius - 6;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minDist * minDist || d2 === 0) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const overlap = (minDist - d) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const relVx = b.vx - a.vx;
  const relVy = b.vy - a.vy;
  const rel = relVx * nx + relVy * ny;
  if (rel < 0) {
    const impulse = -rel * 0.62;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
    const severity = -rel;
    if (severity > 120) {
      a.hp -= severity / 16;
      b.hp -= severity / 16;
      state.audio.crash(severity / 34);
      if (a.driver === 'player' || b.driver === 'player') state.shake = Math.min(8, severity / 40);
      if (a.kind === 'police' || b.kind === 'police') {
        if (a.driver === 'player' || b.driver === 'player') reportCrime(state, 'hitPolice', state.player.x, state.player.y);
      }
      spawnParticles(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 5, '#e8e8ec', 80, 0.35);
    }
  }
}

/** Hurt the player; at zero health the hospital event fires. */
export function damagePlayer(state, amount) {
  const player = state.player;
  if (player.dead || amount <= 0 || state.screen !== 'play') return;
  player.health -= amount;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    state.events.push({ type: 'wasted' });
  }
}

/** A burst of simple particles (sparks, smoke, dust). */
export function spawnParticles(state, x, y, count, color, speed, life) {
  for (let i = 0; i < count; i++) {
    const angle = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: state.rng.range(life * 0.5, life),
      maxLife: life,
      size: state.rng.range(2, 4.5),
      color,
    });
  }
}

/** Is there a car (or the player's car) blocking a traffic car's nose? */
function blockedAhead(state, car) {
  const fx = car.x + Math.cos(car.angle) * (car.radius + 34);
  const fy = car.y + Math.sin(car.angle) * (car.radius + 34);
  for (const other of state.cars) {
    if (other === car) continue;
    if (distance(fx, fy, other.x, other.y) < other.radius + 8) return other;
  }
  if (!state.player.car && distance(fx, fy, state.player.x, state.player.y) < 20) return 'player';
  return null;
}

/** Steer one AI car toward a point; returns throttle for driveCar. */
function steerToward(car, tx, ty, dt, arriveRadius = 56) {
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleWrap(desired - car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const dist = distance(car.x, car.y, tx, ty);
  return { steer, arrived: dist < arriveRadius, dist, diff };
}

/** Traffic behaviour: follow the lane to the next corner, then turn. */
function updateTrafficCar(state, car, dt) {
  if (!car.target) car.target = trafficTarget(car);
  const { steer, arrived } = steerToward(car, car.target.x, car.target.y, dt, 44);
  if (arrived) {
    // Choose the next heading: mostly straight or a turn, never a U-turn
    // unless the road ends.
    const options = [car.dirIndex, (car.dirIndex + 1) % 4, (car.dirIndex + 3) % 4];
    const legal = options.filter((d) => {
      const dir = DIRS[d];
      const ahead = dir.x !== 0 ? nextCentre(car.x, dir.x) : nextCentre(car.y, dir.y);
      return ahead !== null;
    });
    car.dirIndex = legal.length ? state.rng.pick(legal) : (car.dirIndex + 2) % 4;
    car.target = trafficTarget(car);
  }
  const blocker = blockedAhead(state, car);
  const speed = Math.hypot(car.vx, car.vy);
  let throttle = 0;
  if (!blocker && speed < car.cruise) throttle = 1;
  else if (blocker && speed > 30) throttle = -0.4;
  driveCar(state, car, throttle, steer, false, dt, car.cruise);
}

/** Police behaviour: hunt the player, ram the car, box in a runner. */
function updatePoliceCar(state, car, dt) {
  if (car.disabled) {
    driveCar(state, car, 0, 0, false, dt, 0);
    return;
  }
  const player = state.player;
  const target = player.car ?? player;
  const lead = 0.35;
  const tx = target.x + (target.vx ?? 0) * lead;
  const ty = target.y + (target.vy ?? 0) * lead;
  const { steer, dist } = steerToward(car, tx, ty, dt, 30);
  const speed = Math.hypot(car.vx, car.vy);
  let throttle = 1;
  if (!player.car && dist < 74 && speed > 66) throttle = -0.5; // Don't run him down; box him in.
  if (car.mode === 'leave') throttle = speed < 150 ? 1 : 0;
  const cap = car.mode === 'leave' ? 170 : CAR_TYPES.police.topSpeed;
  driveCar(state, car, throttle, steer, false, dt, cap);

  // Shooting: at three stars and up, officers fire on a fleeing suspect.
  car.hitCooldown -= dt;
  if (state.wanted >= 3 && !player.car && !player.dead && dist < 330 && dist > 46 && car.hitCooldown <= 0) {
    car.hitCooldown = state.rng.range(0.8, 1.3);
    state.audio.policeShoot();
    state.tracers.push({ x1: car.x, y1: car.y, x2: player.x, y2: player.y, life: 0.07, color: '#ffd94a' });
    if (state.rng.chance(0.55)) damagePlayer(state, state.rng.range(3, 7));
  }
}

/** Keep the police presence matched to the wanted level. */
function updatePolicePresence(state, dt) {
  const player = state.player;
  const police = state.cars.filter((c) => c.kind === 'police');
  const wantedCount = state.wanted === 0 ? 0 : Math.min(2 + state.wanted, 6);
  if (police.length < wantedCount) {
    state.policeSpawnTimer -= dt;
    if (state.policeSpawnTimer <= 0) {
      state.policeSpawnTimer = 1.6;
      // Spawn at an intersection a few blocks away, out of sight.
      const cx = ROAD_CENTERS[state.rng.int(0, ROAD_CENTERS.length - 1)];
      const cy = ROAD_CENTERS[state.rng.int(0, ROAD_CENTERS.length - 1)];
      if (distance(cx, cy, player.x, player.y) > 520) {
        const car = spawnCar(state, 'police', cx, cy, state.rng.range(0, Math.PI * 2), 'police');
        car.mode = 'chase';
      }
    }
  }
  for (const car of police) {
    if (state.wanted === 0 && car.mode !== 'leave') car.mode = 'leave';
    if (state.wanted > 0) car.mode = 'chase';
    if (car.mode === 'leave') {
      car.target = { x: player.x + (car.x - player.x) * 3, y: player.y + (car.y - player.y) * 3 };
      if (distance(car.x, car.y, player.x, player.y) > 820) car.removeMe = true;
    }
  }
  // The player is "seen" while any chasing officer is close.
  const seen = police.some((c) => c.mode === 'chase' && !c.disabled && distance(c.x, c.y, player.x, player.y) < 430);
  if (state.wanted > 0) {
    if (seen) state.wantedCalm = 0;
    else {
      state.wantedCalm += dt;
      if (state.wantedCalm >= WANTED_DECAY_SECONDS) {
        state.wantedCalm = 0;
        addWanted(state, -1);
        if (state.wanted === 0) state.events.push({ type: 'heatLost' });
      }
    }
  }
}

/** The nearest car the player could get into, or null. */
export function nearestEnterableCar(state) {
  let best = null;
  let bestDist = 66;
  for (const car of state.cars) {
    if (car.driver === 'police' || car.disabled) continue;
    const d = distance(state.player.x, state.player.y, car.x, car.y);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  return best;
}

/** Put the player into a car (stealing it if it was not his). */
export function enterCar(state, car) {
  const player = state.player;
  const wasTraffic = car.driver === 'traffic';
  const wasParked = car.driver === null;
  if (wasTraffic) {
    // The driver bails out and runs.
    const ped = spawnPed(state, car.x + 26, car.y + 10);
    if (ped) {
      ped.state = 'flee';
      ped.timer = 2.4;
      ped.fleeX = player.x;
      ped.fleeY = player.y;
    }
    reportCrime(state, 'steal', car.x, car.y);
    state.stats.stolen += 1;
  } else if (wasParked) {
    reportCrime(state, 'stealParked', car.x, car.y);
    state.stats.stolen += 1;
  }
  if (car.spot) {
    car.spot.taken = false;
    car.spot = null;
  }
  if (wasTraffic || wasParked) car.stolenValue = 60; // Rusty's standing offer.
  car.driver = 'player';
  player.car = car;
  player.bustMeter = 0;
  state.audio.doorSlam();
}

/** Put the player back on the pavement beside his car. */
export function exitCar(state) {
  const player = state.player;
  const car = player.car;
  if (!car) return;
  car.driver = null;
  car.vx = 0;
  car.vy = 0;
  const side = { x: Math.cos(car.angle - Math.PI / 2), y: Math.sin(car.angle - Math.PI / 2) };
  const spot = clampToWorld(car.x + side.x * 34, car.y + side.y * 34);
  const fixed = collideBuildings(state.city.buildings, spot.x, spot.y, PLAYER_RADIUS);
  player.x = fixed.x;
  player.y = fixed.y;
  player.car = null;
  state.audio.doorSlam();
  state.audio.engine(0, false);
}

/** Fire the player's pistol toward a world point. */
function playerShoot(state, wx, wy) {
  const player = state.player;
  player.fireCooldown = 0.16;
  state.audio.shoot();
  const base = Math.atan2(wy - player.y, wx - player.x);
  player.angle = base;
  const angle = base + state.rng.range(-0.028, 0.028);
  const range = 420;
  let endX = player.x + Math.cos(angle) * range;
  let endY = player.y + Math.sin(angle) * range;
  // Walk the ray: buildings stop it, then the nearest target along it wins.
  let bestT = 1;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const x = player.x + Math.cos(angle) * range * t;
    const y = player.y + Math.sin(angle) * range * t;
    if (hitsBuilding(state.city.buildings, x, y, 2)) {
      bestT = t;
      break;
    }
  }
  endX = player.x + Math.cos(angle) * range * bestT;
  endY = player.y + Math.sin(angle) * range * bestT;
  const hitDist = (x, y, r) => {
    // Distance from the point to the ray segment, and whether it is in range.
    const dx = x - player.x;
    const dy = y - player.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > range * bestT) return false;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    return perp < r;
  };
  let hitSomething = false;
  for (const ped of state.peds) {
    if (ped.state !== 'down' && hitDist(ped.x, ped.y, 15)) {
      hurtPed(state, ped, 60, angle);
      hitSomething = true;
      break;
    }
  }
  if (!hitSomething) {
    for (const car of state.cars) {
      if (car !== player.car && hitDist(car.x, car.y, car.radius + 5)) {
        car.hp -= 13;
        spawnParticles(state, car.x, car.y, 3, '#ffd94a', 70, 0.25);
        if (car.kind === 'police') reportCrime(state, 'hitPolice', car.x, car.y);
        hitSomething = true;
        break;
      }
    }
  }
  state.tracers.push({ x1: player.x, y1: player.y, x2: endX, y2: endY, life: 0.06, color: '#ffe9a8' });
  spawnParticles(state, player.x + Math.cos(angle) * 16, player.y + Math.sin(angle) * 16, 2, '#ffd94a', 40, 0.12);
  reportCrime(state, 'shoot', player.x, player.y);
  // Nearby pedestrians panic.
  for (const ped of state.peds) {
    if (ped.state === 'walk' && distance(ped.x, ped.y, player.x, player.y) < 260) {
      ped.state = 'flee';
      ped.timer = state.rng.range(1.4, 2.6);
      ped.fleeX = player.x;
      ped.fleeY = player.y;
    }
  }
}

/** Damage a pedestrian; only the player's own acts are crimes. */
export function hurtPed(state, ped, amount, angle, byPlayer = true) {
  if (ped.state === 'down') return;
  ped.hp -= amount;
  state.audio.thud();
  if (ped.hp <= 0) {
    ped.state = 'down';
    ped.downTime = 22;
    if (byPlayer) reportCrime(state, 'killPed', ped.x, ped.y);
    spawnParticles(state, ped.x, ped.y, 6, '#b03030', 60, 0.5);
  } else {
    ped.state = 'flee';
    ped.timer = 2.2;
    ped.fleeX = ped.x - Math.cos(angle) * 100;
    ped.fleeY = ped.y - Math.sin(angle) * 100;
    if (byPlayer) reportCrime(state, 'hitPed', ped.x, ped.y);
  }
}

/** A car meets a pedestrian: knockdown, panic and (witnessed) heat. */
function carHitsPed(state, car, ped, speed) {
  if (ped.state === 'down' || ped.hitCooldown > 0 || speed < 42) return;
  ped.hitCooldown = 1.2;
  const angle = Math.atan2(car.vy, car.vx);
  hurtPed(state, ped, speed * 0.42, angle, car.driver === 'player');
  ped.x += Math.cos(angle) * 14;
  ped.y += Math.sin(angle) * 14;
  if (car.driver === 'player') state.shake = Math.min(6, speed / 60);
}

/** Update one pedestrian: stroll the sidewalks, flee danger, stay down. */
function updatePed(state, ped, dt) {
  ped.hitCooldown = Math.max(0, ped.hitCooldown - dt);
  if (ped.state === 'down') {
    ped.downTime -= dt;
    if (ped.downTime <= 0) ped.removeMe = true;
    return;
  }
  let speed = ped.speed;
  let tx;
  let ty;
  if (ped.state === 'flee') {
    ped.timer -= dt;
    const away = Math.atan2(ped.y - (ped.fleeY ?? ped.y), ped.x - (ped.fleeX ?? ped.x));
    tx = ped.x + Math.cos(away) * 120;
    ty = ped.y + Math.sin(away) * 120;
    speed = 168;
    if (ped.timer <= 0) {
      ped.state = 'walk';
      ped.target = pickPedTarget(state, ped);
    }
  } else {
    if (!ped.target || distance(ped.x, ped.y, ped.target.x, ped.target.y) < 14) ped.target = pickPedTarget(state, ped);
    tx = ped.target.x;
    ty = ped.target.y;
    // A fast car close by is worth running from.
    for (const car of state.cars) {
      const carSpeed = Math.hypot(car.vx, car.vy);
      if (carSpeed > 120 && distance(ped.x, ped.y, car.x, car.y) < 74) {
        ped.state = 'flee';
        ped.timer = 1.1;
        ped.fleeX = car.x;
        ped.fleeY = car.y;
        break;
      }
    }
  }
  const desired = Math.atan2(ty - ped.y, tx - ped.x);
  ped.angle = desired;
  let nx = ped.x + Math.cos(desired) * speed * dt;
  let ny = ped.y + Math.sin(desired) * speed * dt;
  const fixed = collideBuildings(state.city.buildings, nx, ny, 9);
  ped.x = fixed.x;
  ped.y = fixed.y;
  const clamped = clampToWorld(ped.x, ped.y);
  ped.x = clamped.x;
  ped.y = clamped.y;
}

/** Update the player on foot: movement, aiming, firing, the bust meter. */
function updatePlayerOnFoot(state, input, mouseWorld, dt) {
  const player = state.player;
  const axis = input.axis();
  const moving = axis.x !== 0 || axis.y !== 0;
  const speed = input.sprint() ? PLAYER_SPRINT : PLAYER_WALK;
  if (moving) {
    const len = Math.hypot(axis.x, axis.y);
    player.vx = (axis.x / len) * speed;
    player.vy = (axis.y / len) * speed;
    if (!input.mouse.down) player.angle = Math.atan2(player.vy, player.vx);
  } else {
    player.vx = 0;
    player.vy = 0;
  }
  if (input.mouse.down) player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
  const fixed = collideBuildings(state.city.buildings, player.x + player.vx * dt, player.y + player.vy * dt, PLAYER_RADIUS);
  player.x = fixed.x;
  player.y = fixed.y;
  const clamped = clampToWorld(player.x, player.y);
  player.x = clamped.x;
  player.y = clamped.y;

  player.fireCooldown -= dt;
  if (input.mouse.down && player.fireCooldown <= 0) playerShoot(state, mouseWorld.x, mouseWorld.y);

  // Health creeps back while the city is calm.
  if (state.wanted === 0 && player.health < PLAYER_MAX_HEALTH) {
    player.health = Math.min(PLAYER_MAX_HEALTH, player.health + dt * 2.4);
  }

  // Busted: an officer's car pinning a slow runner fills the meter.
  let pinned = false;
  for (const car of state.cars) {
    if (car.kind === 'police' && car.mode === 'chase' && !car.disabled) {
      if (distance(car.x, car.y, player.x, player.y) < 50 && Math.hypot(car.vx, car.vy) < 78) pinned = true;
    }
  }
  player.bustMeter = pinned ? player.bustMeter + dt : Math.max(0, player.bustMeter - dt * 1.6);
  if (player.bustMeter > 1.15) {
    player.bustMeter = 0;
    state.events.push({ type: 'busted' });
  }
}

/** Update the player's car from driving input, plus its bust meter. */
function updatePlayerCar(state, input, dt) {
  const player = state.player;
  const car = player.car;
  const axis = input.axis();
  const throttle = -axis.y;
  const steer = axis.x;
  const speed = driveCar(state, car, throttle, steer, input.brake(), dt, CAR_TYPES[car.kind].topSpeed);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  state.audio.engine(Math.min(1, Math.abs(speed) / CAR_TYPES[car.kind].topSpeed), true);

  // Drifting and hard driving throw up dust and smoke.
  if (input.brake() && speed > 130 && state.rng.chance(0.5)) {
    spawnParticles(state, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 1, '#d8cfc0', 26, 0.6);
  }
  if (car.hp < 30 && state.rng.chance(0.3)) {
    spawnParticles(state, car.x, car.y - 6, 1, '#555b60', 18, 0.9);
  }

  let boxed = false;
  if (speed < 26) {
    for (const other of state.cars) {
      if (other.kind === 'police' && other.mode === 'chase' && distance(other.x, other.y, car.x, car.y) < 58) boxed = true;
    }
  }
  player.bustMeter = boxed ? player.bustMeter + dt * 0.7 : Math.max(0, player.bustMeter - dt * 1.6);
  if (player.bustMeter > 1.6) {
    player.bustMeter = 0;
    state.events.push({ type: 'busted' });
  }
}

/** Maintain ambient traffic and pedestrian counts around the player. */
function updateAmbientPopulation(state, dt) {
  state.ambientTimer -= dt;
  if (state.ambientTimer > 0) return;
  state.ambientTimer = 0.7;
  const traffic = state.cars.filter((c) => c.driver === 'traffic').length;
  if (traffic < 20) spawnTrafficCar(state);
  if (state.peds.length < 34) spawnPed(state);
  for (const car of state.cars) {
    if (car.driver === 'traffic' && distance(car.x, car.y, state.player.x, state.player.y) > 1250) car.removeMe = true;
  }
  for (const ped of state.peds) {
    if (distance(ped.x, ped.y, state.player.x, state.player.y) > 1150) ped.removeMe = true;
  }
}

/**
 * Advance every entity one tick: player, vehicles, pedestrians, police,
 * collisions, the wanted level and short-lived effects.
 */
export function updateEntities(state, input, mouseWorld, dt) {
  const player = state.player;
  for (const key of Object.keys(state.crimeCd)) state.crimeCd[key] = Math.max(0, state.crimeCd[key] - dt);

  if (player.car) updatePlayerCar(state, input, dt);
  else updatePlayerOnFoot(state, input, mouseWorld, dt);

  for (const car of state.cars) {
    if (car.driver === 'traffic') updateTrafficCar(state, car, dt);
    else if (car.driver === 'police') updatePoliceCar(state, car, dt);
    else if (car.driver === null) {
      // Parked: bleed off any leftover motion, then rest.
      car.vx *= 0.8;
      car.vy *= 0.8;
      car.x += car.vx * dt;
      car.y += car.vy * dt;
    }
    if (car.hp <= 0 && !car.disabled) {
      car.disabled = true;
      spawnParticles(state, car.x, car.y, 10, '#555b60', 40, 1.1);
    }
    if (car.disabled && state.rng.chance(0.12)) {
      spawnParticles(state, car.x, car.y - 4, 1, '#555b60', 16, 1);
    }
  }
  // Car-car and car-building collisions.
  for (let i = 0; i < state.cars.length; i++) {
    collideCarBuildings(state, state.cars[i], dt);
    for (let j = i + 1; j < state.cars.length; j++) collideCarPair(state, state.cars[i], state.cars[j]);
  }
  // Cars meet pedestrians and the player.
  for (const car of state.cars) {
    const speed = Math.hypot(car.vx, car.vy);
    if (speed < 42) continue;
    for (const ped of state.peds) {
      if (distance(car.x, car.y, ped.x, ped.y) < car.radius + 9) carHitsPed(state, car, ped, speed);
    }
    if (!player.car && car.driver !== 'player' && distance(car.x, car.y, player.x, player.y) < car.radius + 9) {
      if (speed > 90) {
        damagePlayer(state, (speed - 80) / 9);
        player.x += car.vx * 0.04;
        player.y += car.vy * 0.04;
        state.audio.thud();
      }
    }
  }

  for (const ped of state.peds) updatePed(state, ped, dt);
  updatePolicePresence(state, dt);
  updateAmbientPopulation(state, dt);

  // Siren loudness follows the nearest chasing officer.
  let nearest = Infinity;
  for (const car of state.cars) {
    if (car.kind === 'police' && car.mode === 'chase') nearest = Math.min(nearest, distance(car.x, car.y, player.x, player.y));
  }
  state.audio.siren(nearest === Infinity ? 0 : Math.max(0, 1 - nearest / 620));

  // Effects decay.
  for (const tracer of state.tracers) tracer.life -= dt;
  state.tracers = state.tracers.filter((t) => t.life > 0);
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const f of state.floaters) {
    f.life -= dt;
    f.y -= 26 * dt;
  }
  state.floaters = state.floaters.filter((f) => f.life > 0);

  // Remove the dead and the distant.
  state.cars = state.cars.filter((c) => !c.removeMe);
  state.peds = state.peds.filter((p) => !p.removeMe);
}
