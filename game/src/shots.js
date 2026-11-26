// Ember Isle Run — deterministic screenshot states (?shot=cover|rings|
// landing|menu). Each shot parks the plane in a composed, readable frame:
// chase view, ring or runway ahead, HUD complete — then steps the sim a
// fixed number of frames and freezes, so every screenshot is reproducible.

import { SHOTS, RUNWAY } from './config.js';

export const SHOT_NAMES = ['cover', 'rings', 'landing', 'menu'];
export const SHOT_FRAMES = 40; // fixed 1/60 s steps before the freeze
export const SHOT_DT = 1 / 60;

// Place the plane for a shot: on the approach to ring N (or on final for
// the landing shot, parked for the menu). Returns the scripted stick input
// the shot steps with, so the frame shows the plane flying, not hovering.
export function placeForShot(name, state, ringMeshes) {
  const cfg = SHOTS[name] || SHOTS.cover;
  state.crashed = false;
  state.landed = false;
  state.onGround = false;
  state.speedKts = cfg.speedKts;
  state.throttle = name === 'menu' ? 0 : 0.72;
  state.bank = (cfg.bankDeg * Math.PI) / 180;
  state.pitch = (cfg.pitchDeg * Math.PI) / 180;
  state.fuel = 78;
  state.damage = name === 'landing' ? 4 : 0;
  state.score = cfg.ring * 250;
  state.timeSec = cfg.ring * 26 + 14;
  state.ringsPassed = cfg.ring;
  state.gearDown = name === 'landing' || name === 'menu';

  if (name === 'menu') {
    state.x = RUNWAY.centerX + 6;
    state.y = RUNWAY.surfaceY + 1.9;
    state.z = RUNWAY.centerZ + 60;
    state.heading = 0.35;
    state.onGround = true;
    state.speedKts = 0;
    state.throttle = 0;
    return { pitch: 0, roll: 0, throttleDelta: 0, rudder: 0 };
  }

  if (name === 'landing') {
    // Final approach: 180 m south of the threshold, low, so the lit strip,
    // the beach and the island fill the frame behind the plane.
    state.x = RUNWAY.centerX + 6;
    state.y = RUNWAY.surfaceY + cfg.altitudeM;
    state.z = RUNWAY.centerZ + RUNWAY.lengthM / 2 + 180;
    state.heading = 0;
    return { pitch: -0.08, roll: 0, throttleDelta: 0, rudder: 0 };
  }

  // Ring shots: park the plane on the approach line to ring N, ~130 m out,
  // at the ring's height, heading straight at it.
  const ring = ringMeshes[Math.min(cfg.ring, ringMeshes.length - 1)];
  const prev = cfg.ring === 0
    ? { x: RUNWAY.centerX, z: RUNWAY.centerZ + 100 }
    : ringMeshes[cfg.ring - 1].position;
  const dx = ring.position.x - prev.x;
  const dz = ring.position.z - prev.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const dist = name === 'rings' ? 46 : 130; // rings shot: right at the gate
  state.x = ring.position.x - ux * dist;
  state.z = ring.position.z - uz * dist;
  state.y = ring.position.y + (name === 'rings' ? 1.5 : 4);
  state.heading = Math.atan2(ux, -uz);
  return { pitch: 0, roll: cfg.bankDeg / 60, throttleDelta: 0, rudder: 0 };
}

// Where the chase camera sits for each shot. The menu shot uses a low
// three-quarter front view of the parked plane with the volcano behind it.
export function shotCamera(name, state) {
  if (name === 'menu') {
    // Low three-quarter view; the look target sits left of the plane so the
    // plane lands right of centre, clear of the menu card.
    return {
      position: { x: state.x + 16, y: state.y + 4.5, z: state.z + 18 },
      lookAt: { x: state.x - 16, y: state.y + 2.5, z: state.z - 12 },
      fov: 62,
    };
  }
  return null; // chase camera for the flying shots
}
