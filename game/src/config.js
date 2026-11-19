// Port Azura: Heatwave — tuning constants shared by every system.
// The world is a square coastal city measured in pixels; roads sit on a regular
// grid so traffic, pedestrians and the minimap all agree on where streets are.

/** The fixed simulation step: the world advances in 1/60 s ticks. */
export const STEP = 1 / 60;

/** World size in pixels (the city is WORLD x WORLD, beach along the south edge). */
export const WORLD = 3840;

/** Distance between neighbouring road centre lines. */
export const PITCH = 480;

/** Road centre lines: 240, 720, ..., 3600 on both axes. */
export const ROAD_CENTERS = [240, 720, 1200, 1680, 2160, 2640, 3120, 3600];

/** Half the road width: asphalt spans this far either side of a centre line. */
export const ROAD_HALF = 64;

/** Sidewalks run from ROAD_HALF to SIDEWALK_OUT either side of a centre line. */
export const SIDEWALK_OUT = 86;

/** Blocks (the buildable squares between roads) start this far into the pitch. */
export const BLOCK_ORIGIN = 324;
/** Block size: pitch minus road and sidewalks on both sides. */
export const BLOCK_SIZE = 312;
/** Blocks per axis (between the 8 road lines there are 7 gaps). */
export const BLOCKS = 7;

/** The beach: sand from BEACH_Y to the waterline at WATER_Y, then the sea. */
export const BEACH_Y = 3690;
export const WATER_Y = 3780;

/** Player tuning. */
export const PLAYER_RADIUS = 11;
export const PLAYER_WALK = 138;
export const PLAYER_SPRINT = 218;
export const PLAYER_MAX_HEALTH = 100;

/** Vehicle tuning by kind: top speed, acceleration, grip and paint jobs. */
export const CAR_TYPES = {
  sedan: { topSpeed: 302, accel: 250, radius: 21, colors: ['#c94f42', '#4a7fb5', '#e0e3e6', '#5d8a66', '#d9a441', '#7a6fa0', '#3f3f46'] },
  taxi: { topSpeed: 298, accel: 245, radius: 21, colors: ['#f2b01e'] },
  coupe: { topSpeed: 388, accel: 330, radius: 21, colors: ['#e8e8ec', '#b02040', '#204060', '#f27030'] },
  van: { topSpeed: 262, accel: 215, radius: 23, colors: ['#d8d5cc', '#8a97a5', '#6b7f5e'] },
  police: { topSpeed: 348, accel: 305, radius: 21, colors: ['#f4f6f8'] },
};

/** Sun-soaked building paints: creams, corals, turquoise and peach pastels. */
export const BUILDING_COLORS = ['#f2e3c6', '#f6cfa8', '#efa08a', '#9fd4c5', '#a8c8e8', '#f2efdf', '#e8b4c8', '#cde0b0', '#f7d774', '#d9c8ee'];

/** The debt Milo Vane owes Dalia Reyes when the story opens. */
export const START_DEBT = 2000;

/** localStorage keys for the save game and the mute flag. */
export const SAVE_KEY = 'port-azura-heatwave-save-v1';
export const MUTE_KEY = 'port-azura-heatwave-muted-v1';

/** Crime tuning: how fast heat fades when nobody is watching. */
export const WANTED_DECAY_SECONDS = 11;
export const GARAGE_FEE = 150;
