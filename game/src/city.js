// Port Azura itself: a sun-soaked coastal grid generated once from a fixed seed.
// Blocks between the roads become pastel buildings, palm parks or parking lots;
// nine named landmarks anchor the story. Everything the other systems need —
// collision rectangles, parked-car spots, road tests — comes from here.
import {
  BEACH_Y, BLOCK_ORIGIN, BLOCK_SIZE, BLOCKS, BUILDING_COLORS, PITCH,
  ROAD_CENTERS, ROAD_HALF, SIDEWALK_OUT, WORLD,
} from './config.js';

/** The named places the story and the side jobs send the player to. */
const LANDMARK_BLOCKS = {
  diner: { bx: 1, by: 1, name: 'Coral Diner', color: '#e86a5e', sign: 'CORAL DINER' },
  motel: { bx: 3, by: 0, name: "Milo's Motel", color: '#f2b01e', sign: 'PALMS MOTEL' },
  rusty: { bx: 6, by: 0, name: "Rusty's Yard", color: '#8a97a5', sign: "RUSTY'S YARD" },
  garage: { bx: 4, by: 2, name: 'Sunset Garage', color: '#4a7fb5', sign: 'SUNSET GARAGE' },
  station: { bx: 3, by: 3, name: 'Port Azura PD', color: '#dfe6ee', sign: 'POLICE' },
  hotel: { bx: 5, by: 3, name: 'Azura Grand Hotel', color: '#f6cfa8', sign: 'AZURA GRAND' },
  hospital: { bx: 0, by: 4, name: 'Azura General', color: '#f2efdf', sign: 'HOSPITAL' },
  marina: { bx: 5, by: 6, name: 'Marina Azul', color: '#9fd4c5', sign: 'MARINA AZUL' },
};

/** Extra story points that are not buildings: the pier and the beach bar. */
const EXTRA_POINTS = {
  pier: { x: 1900, y: 3745, name: 'The Old Pier' },
  beachbar: { x: 820, y: 3735, name: 'Tiki Torch Bar' },
};

/** Distance from a point to the nearest road centre line on one axis. */
function axisDistance(value) {
  let best = Infinity;
  for (const centre of ROAD_CENTERS) best = Math.min(best, Math.abs(value - centre));
  return best;
}

/** True when (x, y) is on asphalt. */
export function isOnRoad(x, y) {
  return axisDistance(x) <= ROAD_HALF || axisDistance(y) <= ROAD_HALF;
}

/** True when (x, y) is on a sidewalk (beside a road, off the asphalt). */
export function isOnSidewalk(x, y) {
  const dx = axisDistance(x);
  const dy = axisDistance(y);
  return (dx > ROAD_HALF && dx <= SIDEWALK_OUT && dy <= SIDEWALK_OUT + PITCH / 2) ||
    (dy > ROAD_HALF && dy <= SIDEWALK_OUT && dx <= SIDEWALK_OUT + PITCH / 2);
}

/** Clamp a point into the playable world, off the sea. */
export function clampToWorld(x, y) {
  return {
    x: Math.min(WORLD - 24, Math.max(24, x)),
    y: Math.min(BEACH_Y + 60, Math.max(24, y)),
  };
}

/** The centre of block (bx, by). */
export function blockCentre(bx, by) {
  return {
    x: BLOCK_ORIGIN + bx * PITCH + BLOCK_SIZE / 2,
    y: BLOCK_ORIGIN + by * PITCH + BLOCK_SIZE / 2,
  };
}

/** Push a circle out of every building rectangle; returns the corrected point. */
export function collideBuildings(buildings, x, y, radius) {
  let px = x;
  let py = y;
  for (const b of buildings) {
    const nearX = Math.min(b.x + b.w, Math.max(b.x, px));
    const nearY = Math.min(b.y + b.h, Math.max(b.y, py));
    const dx = px - nearX;
    const dy = py - nearY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      px = nearX + (dx / d) * radius;
      py = nearY + (dy / d) * radius;
    } else {
      // Centre inside the rect: leave by the shallowest side.
      const left = px - b.x;
      const right = b.x + b.w - px;
      const top = py - b.y;
      const bottom = b.y + b.h - py;
      const min = Math.min(left, right, top, bottom);
      if (min === left) px = b.x - radius;
      else if (min === right) px = b.x + b.w + radius;
      else if (min === top) py = b.y - radius;
      else py = b.y + b.h + radius;
    }
  }
  return { x: px, y: py };
}

/** True when a circle at (x, y) overlaps any building. */
export function hitsBuilding(buildings, x, y, radius) {
  for (const b of buildings) {
    const nearX = Math.min(b.x + b.w, Math.max(b.x, x));
    const nearY = Math.min(b.y + b.h, Math.max(b.y, y));
    const dx = x - nearX;
    const dy = y - nearY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/** Build one ordinary block: 2-4 pastel buildings with roof clutter. */
function buildOrdinaryBlock(rng, bx, by, buildings, palms) {
  const ox = BLOCK_ORIGIN + bx * PITCH;
  const oy = BLOCK_ORIGIN + by * PITCH;
  const layout = rng.int(1, 3);
  const rects = [];
  if (layout === 1) {
    rects.push({ x: ox + 26, y: oy + 26, w: BLOCK_SIZE - 52, h: BLOCK_SIZE - 52 });
  } else if (layout === 2) {
    const half = BLOCK_SIZE / 2;
    rects.push({ x: ox + 20, y: oy + 20, w: half - 32, h: BLOCK_SIZE - 40 });
    rects.push({ x: ox + half + 12, y: oy + 20, w: half - 32, h: BLOCK_SIZE - 40 });
  } else {
    const half = BLOCK_SIZE / 2;
    rects.push({ x: ox + 18, y: oy + 18, w: half - 30, h: half - 30 });
    rects.push({ x: ox + half + 12, y: oy + 18, w: half - 30, h: half - 30 });
    rects.push({ x: ox + 18, y: oy + half + 12, w: half - 30, h: half - 30 });
    rects.push({ x: ox + half + 12, y: oy + half + 12, w: half - 30, h: half - 30 });
  }
  for (const r of rects) {
    buildings.push({
      ...r,
      color: rng.pick(BUILDING_COLORS),
      floors: rng.int(2, 9),
      landmark: null,
      sign: null,
      clutter: rng.int(1, 4),
    });
  }
  // A palm or two on the block's corners softens the street.
  if (rng.chance(0.7)) palms.push({ x: ox + 8, y: oy + 8, s: rng.range(0.85, 1.2) });
  if (rng.chance(0.5)) palms.push({ x: ox + BLOCK_SIZE - 8, y: oy + BLOCK_SIZE - 8, s: rng.range(0.85, 1.2) });
}

/** Build a park block: grass, palms and a winding pale path (drawn as ground). */
function buildParkBlock(rng, bx, by, grounds, palms) {
  const ox = BLOCK_ORIGIN + bx * PITCH;
  const oy = BLOCK_ORIGIN + by * PITCH;
  grounds.push({ x: ox, y: oy, w: BLOCK_SIZE, h: BLOCK_SIZE, kind: 'park' });
  const count = rng.int(7, 12);
  for (let i = 0; i < count; i++) {
    palms.push({ x: ox + rng.range(24, BLOCK_SIZE - 24), y: oy + rng.range(24, BLOCK_SIZE - 24), s: rng.range(0.8, 1.35) });
  }
}

/** Build a parking block: asphalt with rows of parked-car spots. */
function buildParkingBlock(rng, bx, by, grounds, spots) {
  const ox = BLOCK_ORIGIN + bx * PITCH;
  const oy = BLOCK_ORIGIN + by * PITCH;
  grounds.push({ x: ox, y: oy, w: BLOCK_SIZE, h: BLOCK_SIZE, kind: 'parking' });
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      if (rng.chance(0.3)) continue;
      spots.push({
        x: ox + 44 + col * 74,
        y: oy + 52 + row * 104,
        angle: Math.PI / 2,
        taken: false,
      });
    }
  }
}

/** Build a landmark block: one signed building plus a forecourt with parking. */
function buildLandmarkBlock(key, spec, buildings, grounds, spots, landmarks) {
  const ox = BLOCK_ORIGIN + spec.bx * PITCH;
  const oy = BLOCK_ORIGIN + spec.by * PITCH;
  grounds.push({ x: ox, y: oy, w: BLOCK_SIZE, h: BLOCK_SIZE, kind: 'plaza' });
  const building = {
    x: ox + 36, y: oy + 30, w: BLOCK_SIZE - 72, h: 148,
    color: spec.color, floors: 4, landmark: key, sign: spec.sign, clutter: 2,
  };
  buildings.push(building);
  for (let i = 0; i < 3; i++) {
    spots.push({ x: ox + 62 + i * 84, y: oy + 248, angle: 0, taken: false });
  }
  landmarks[key] = {
    id: key,
    name: spec.name,
    sign: spec.sign,
    x: ox + BLOCK_SIZE / 2,
    y: oy + 216,
    doorX: ox + BLOCK_SIZE / 2,
    doorY: oy + 190,
  };
}

/**
 * Generate the whole city from a seeded generator. Returns buildings (also the
 * collision set), decorative ground patches, palms, parking spots and the
 * landmark table the missions read.
 */
export function generateCity(rng) {
  const buildings = [];
  const grounds = [];
  const palms = [];
  const spots = [];
  const landmarks = {};
  const landmarkAt = new Map();
  for (const [key, spec] of Object.entries(LANDMARK_BLOCKS)) landmarkAt.set(`${spec.bx},${spec.by}`, [key, spec]);

  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      const landmark = landmarkAt.get(`${bx},${by}`);
      if (landmark) {
        buildLandmarkBlock(landmark[0], landmark[1], buildings, grounds, spots, landmarks);
        continue;
      }
      const roll = rng.next();
      if (roll < 0.16) buildParkBlock(rng, bx, by, grounds, palms);
      else if (roll < 0.4) buildParkingBlock(rng, bx, by, grounds, spots);
      else buildOrdinaryBlock(rng, bx, by, buildings, palms);
    }
  }

  // Palms line the beach and the promenade road above it.
  for (let x = 120; x < WORLD - 80; x += 150) {
    palms.push({ x: x + rng.range(-16, 16), y: BEACH_Y - 26 + rng.range(-6, 6), s: rng.range(0.95, 1.4) });
  }
  for (const [key, point] of Object.entries(EXTRA_POINTS)) {
    landmarks[key] = { id: key, name: point.name, sign: null, x: point.x, y: point.y, doorX: point.x, doorY: point.y };
  }
  return { buildings, grounds, palms, spots, landmarks };
}
