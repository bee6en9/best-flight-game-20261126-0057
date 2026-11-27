// Ember Isle Run — tuning constants and the seeded random source.
// One place for every number a playtest would retune: speeds, fuel, rings,
// terrain shape and the shot camera. Nothing here touches the DOM or WebGL.

export const GAME_NAME = 'EMBER ISLE RUN';
export const GAME_TAGLINE = 'Mail run over a volcano island — thread 8 gold rings, then land before the fuel runs out.';

// Deterministic world seed: the same island, rings and trees on every load,
// so screenshots are reproducible and two runs of the program stay identical.
export const WORLD_SEED = 20261126;

// --- Flight model (arcade, knots / feet, dt in seconds) -------------------
export const FLIGHT = {
  maxSpeedKts: 165, // full throttle, level flight
  cruiseSpeedKts: 110,
  stallSpeedKts: 48, // below this the wing stops flying and the nose drops
  minSpeedKts: 0,
  throttleRate: 0.55, // throttle 0..1 per second of held key
  pitchRate: 0.9, // rad/s of pitch authority at full deflection
  rollRate: 1.9, // rad/s of roll authority
  maxBankRad: 1.15, // ~66 deg, hard bank limit
  maxPitchRad: 0.55,
  turnRatePerBank: 0.55, // heading change per second per radian of bank
  climbRate: 9.5, // m/s gained at full power, level pitch
  sinkRate: 6.0, // m/s lost at idle, level pitch
  dragKts: 6.0, // speed bled per second when throttle is idle
  groundEffectM: 6, // extra lift cushion just above the runway
};

// --- Fuel, damage, scoring -------------------------------------------------
export const FUEL = {
  capacity: 100,
  burnPerSecFull: 0.55, // at full throttle
  burnPerSecIdle: 0.12,
  lowWarning: 25,
  empty: 0,
};
export const DAMAGE = {
  max: 100,
  hardLandingVs: 7, // touchdown vertical speed (m/s) above which the gear complains
  hardLandingPerMs: 8, // damage per m/s beyond the threshold (a firm bounce, not a crash)
  roughTouchdown: 25, // touching down off the strip at speed
  roughRollPerSec: 6, // grinding across rough ground, per second
  scrapePerSec: 40, // clipping terrain or a tree in the air, per second
  water: 100,
};
export const SCORE = {
  ring: 250,
  landing: 1000,
  timeBonusPerSec: 4, // left over from a 240 s par time
  fuelBonusPerUnit: 6,
  parTimeSec: 240,
};

// --- Mission: 8 gold rings along the valley, then the coastal strip --------
export const RINGS = 8;
export const RING_RADIUS_M = 15;
export const RUNWAY = {
  // Flat coastal strip on the south beach; the plane starts parked here.
  centerX: 0,
  centerZ: 760,
  headingDeg: 0, // runway points north (-Z is north in world space)
  lengthM: 340,
  widthM: 26,
  surfaceY: 3.2, // terrain is flattened to this height under the strip
};

// --- World shape ------------------------------------------------------------
export const WORLD = {
  islandRadiusM: 980, // land fades into sea beyond this
  seaLevelM: 0,
  volcano: { x: -380, z: -520, heightM: 265, radiusM: 420 },
  ridgeWest: { x: -560, z: 120, heightM: 150, radiusM: 380 },
  ridgeEast: { x: 520, z: -80, heightM: 170, radiusM: 400 },
  hillNorth: { x: 80, z: -760, heightM: 120, radiusM: 300 },
  terrainSizeM: 2600,
  terrainSegments: 160,
  treeCount: 320,
  cloudCount: 26,
};

// --- Camera -----------------------------------------------------------------
export const CAMERA = {
  chaseDistanceM: 26,
  chaseHeightM: 7.5,
  fovBase: 68,
  fovFast: 82, // widens with speed, sells velocity
  lookAheadM: 40,
};

// --- Deterministic screenshot states (?shot=cover|rings|landing|menu) -------
export const SHOTS = {
  cover: { ring: 4, speedKts: 118, altitudeM: 96, bankDeg: -14, pitchDeg: -2 },
  rings: { ring: 4, speedKts: 132, altitudeM: 88, bankDeg: 8, pitchDeg: 0 },
  landing: { ring: 8, speedKts: 62, altitudeM: 20, bankDeg: 0, pitchDeg: -4 },
  menu: { ring: 0, speedKts: 0, altitudeM: 3.2, bankDeg: 0, pitchDeg: 0 },
};

// --- Small seeded RNG (mulberry32) ------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
