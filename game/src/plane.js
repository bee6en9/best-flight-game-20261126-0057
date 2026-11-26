// Ember Isle Run — the mail plane: a low-poly build from primitives
// (fuselage, wings, tail, spinning prop, gear, nav lights) plus the arcade
// flight model. State lives in plain numbers; the mesh is only a view of it,
// so the model can be stepped without a GPU.

import * as THREE from 'three';
import { FLIGHT, FUEL, DAMAGE, RUNWAY, WORLD, SCORE } from './config.js';
import { heightAt } from './world.js';

const KTS_TO_MS = 0.514444;

// Build the aircraft from primitives so it reads as "built", not drawn:
// cream fuselage, orange cheatline, glass cabin, red wingtips.
export function buildPlaneMesh() {
  const plane = new THREE.Group();
  plane.name = 'mailPlane';
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.45, metalness: 0.25 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8590c, roughness: 0.5, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2f45, roughness: 0.1, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.7, metalness: 0.3 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 12), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  plane.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 12), orange);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.5;
  nose.castShadow = true;
  plane.add(nose);

  const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 10), glass);
  cabin.scale.set(1, 0.72, 1.7);
  cabin.position.set(0, 0.55, -0.6);
  plane.add(cabin);

  // Cheatline stripe down both flanks.
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 5.2), orange);
    stripe.position.set(side * 0.82, -0.08, 0.2);
    plane.add(stripe);
  }

  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.18, 1.9), cream);
  wing.position.set(0, -0.15, -0.3);
  wing.castShadow = true;
  plane.add(wing);
  // Red wingtips with nav lights: red port, green starboard.
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 1.9), orange);
    tip.position.set(side * 5.5, -0.15, -0.3);
    plane.add(tip);
    const nav = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff2222 : 0x22ff66 }),
    );
    nav.position.set(side * 5.9, -0.15, -0.3);
    plane.add(nav);
  }

  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 1.1), cream);
  tailplane.position.set(0, 0.15, 2.6);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.3), orange);
  fin.position.set(0, 0.85, 2.6);
  fin.castShadow = true;
  plane.add(fin);

  // Propeller group (spins around Z, the nose axis).
  const prop = new THREE.Group();
  prop.name = 'propeller';
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.08), dark);
    blade.rotation.z = a;
    blade.position.y = 0;
    prop.add(blade);
  }
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 10), orange);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.4;
  prop.add(spinner);
  prop.position.z = -4.35;
  plane.add(prop);

  // Fixed gear: two mains + tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    leg.position.set(side * 0.9, -1.15, -0.6);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.9, -1.7, -0.6);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 8), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -1.15, 2.7);
  plane.add(tailWheel);

  plane.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { group: plane, prop };
}

// --- Flight state ------------------------------------------------------------
export function freshState() {
  return {
    // Position in metres; heading 0 = north (-Z), like the runway.
    x: RUNWAY.centerX,
    y: RUNWAY.surfaceY + 1.9,
    z: RUNWAY.centerZ + RUNWAY.lengthM / 2 - 24,
    heading: 0, // radians, 0 = north
    pitch: 0,
    bank: 0,
    speedKts: 0,
    throttle: 0,
    verticalSpeedMs: 0,
    fuel: FUEL.capacity,
    damage: 0,
    gearDown: true,
    onGround: true,
    crashed: false,
    landed: false,
    ringsPassed: 0,
    score: 0,
    timeSec: 0,
    propAngle: 0,
    message: '',
    messageUntil: 0,
  };
}

// --- One fixed step of the arcade model ---------------------------------------
// input: { pitch: -1..1 (stick back = +), roll: -1..1, throttleDelta, gearToggle }
// Returns an event string: 'ring' handled elsewhere; 'crash' | 'landed' | '' here.
export function stepFlight(s, input, dt) {
  if (s.crashed || s.landed) return '';
  s.timeSec += dt;

  // Throttle and fuel.
  s.throttle = Math.min(1, Math.max(0, s.throttle + input.throttleDelta * dt));
  const burn = FUEL.burnPerSecIdle + (FUEL.burnPerSecFull - FUEL.burnPerSecIdle) * s.throttle;
  s.fuel = Math.max(0, s.fuel - burn * dt);

  // Speed: throttle pulls toward max, drag pulls down, pitch trades speed.
  const targetSpeed = FLIGHT.maxSpeedKts * (0.25 + 0.75 * s.throttle);
  const accel = (targetSpeed - s.speedKts) * 0.35 - Math.sin(s.pitch) * 26;
  s.speedKts = Math.min(
    FLIGHT.maxSpeedKts,
    Math.max(FLIGHT.minSpeedKts, s.speedKts + accel * dt),
  );
  if (s.fuel <= 0 && s.speedKts > 0) s.speedKts = Math.max(0, s.speedKts - FLIGHT.dragKts * dt);

  // Attitude: stick moves pitch/bank toward targets with smoothing.
  const pitchTarget = Math.max(-FLIGHT.maxPitchRad, Math.min(FLIGHT.maxPitchRad, input.pitch * FLIGHT.maxPitchRad));
  const bankTarget = Math.max(-FLIGHT.maxBankRad, Math.min(FLIGHT.maxBankRad, input.roll * FLIGHT.maxBankRad));
  const authority = s.onGround ? 0.25 : 1; // sluggish on the ground roll
  s.pitch += (pitchTarget - s.pitch) * Math.min(1, FLIGHT.pitchRate * 2.2 * authority * dt);
  s.bank += (bankTarget - s.bank) * Math.min(1, FLIGHT.rollRate * 1.6 * authority * dt);
  if (Math.abs(input.roll) < 0.05) s.bank *= Math.max(0, 1 - 1.4 * dt); // wings level themselves
  s.heading += Math.sin(s.bank) * FLIGHT.turnRatePerBank * dt * Math.min(1, s.speedKts / 60);
  s.heading = (s.heading + Math.PI * 3) % (Math.PI * 2) - Math.PI;

  // Vertical speed: pitch + power - sink; stall drops the nose.
  const stalled = s.speedKts < FLIGHT.stallSpeedKts && !s.onGround;
  let vs = Math.sin(s.pitch) * s.speedKts * KTS_TO_MS;
  vs += (s.throttle - 0.45) * FLIGHT.climbRate * 0.55;
  vs -= (1 - s.throttle) * FLIGHT.sinkRate * 0.4;
  if (stalled) vs -= 5;
  const groundH = heightAt(s.x, s.z);
  if (s.y - groundH < FLIGHT.groundEffectM && s.speedKts > 60 && s.pitch > -0.05) {
    vs += 1.6; // ground effect cushion
  }
  s.verticalSpeedMs = vs;
  s.y += vs * dt;

  // Horizontal motion along the heading: heading 0 = north (-Z),
  // heading +90 deg = east (+X). Forward vector is (sin h, 0, -cos h).
  const v = s.speedKts * KTS_TO_MS;
  s.x += Math.sin(s.heading) * v * dt;
  s.z += -Math.cos(s.heading) * v * dt;
  s.propAngle += (2 + s.throttle * 38) * dt * Math.min(1, 0.2 + s.speedKts / 40);

  // Ground contact. Touchdown damage applies ONLY on the air-to-ground
  // transition — a plane rolling on its gear is not crashing every frame.
  const ground = heightAt(s.x, s.z);
  const overRunway =
    Math.abs(s.x - RUNWAY.centerX) < RUNWAY.widthM / 2 + 2 &&
    Math.abs(s.z - RUNWAY.centerZ) < RUNWAY.lengthM / 2 + 2;
  const gearY = ground + 1.9;
  const wasAirborne = !s.onGround;
  if (s.y <= gearY + 0.05) {
    s.y = gearY;
    s.onGround = true;
    if (wasAirborne) {
      if (Math.abs(vs) > DAMAGE.hardLandingVs) {
        // Firm touchdown: damage scales with how hard it was.
        s.damage += Math.min(60, (Math.abs(vs) - DAMAGE.hardLandingVs) * DAMAGE.hardLandingPerMs);
        if (s.damage >= DAMAGE.max) {
          s.crashed = true;
          return 'crash';
        }
      }
      if (overRunway && s.gearDown && s.speedKts < 95 && s.ringsPassed >= 8) {
        s.landed = true;
        s.score += SCORE.landing;
        s.score += Math.round(s.fuel * SCORE.fuelBonusPerUnit);
        s.score += Math.max(0, Math.round((SCORE.parTimeSec - s.timeSec) * SCORE.timeBonusPerSec));
        return 'landed';
      }
      if (!overRunway && s.speedKts > 25) {
        // Rough-field touchdown: survivable once, costly twice.
        s.damage += DAMAGE.roughTouchdown;
        if (s.damage >= DAMAGE.max) {
          s.crashed = true;
          return 'crash';
        }
      }
    } else if (!overRunway && s.speedKts > 25) {
      // Grinding across rough ground while rolling.
      s.damage += DAMAGE.roughRollPerSec * dt;
      if (s.damage >= DAMAGE.max) {
        s.crashed = true;
        return 'crash';
      }
    }
    // Rolling on the ground bleeds speed fast.
    s.speedKts = Math.max(0, s.speedKts - 26 * dt);
    s.pitch *= Math.max(0, 1 - 3 * dt);
    s.bank *= Math.max(0, 1 - 3 * dt);
  } else {
    s.onGround = false;
  }

  // Terrain / sea collision in the air: scrape damage is per second, not
  // per frame, and the impact scrubs speed.
  if (!s.onGround) {
    if (s.y < ground + 1.2) {
      if (ground <= WORLD.seaLevelM + 0.6) {
        s.damage = DAMAGE.max;
        s.crashed = true;
        return 'crash';
      }
      s.damage += DAMAGE.scrapePerSec * dt;
      s.y = ground + 1.2;
      s.speedKts = Math.max(0, s.speedKts - 40 * dt);
      if (s.damage >= DAMAGE.max) {
        s.crashed = true;
        return 'crash';
      }
    }
  }
  return '';
}

// Copy the numeric state onto the visible mesh each frame.
export function applyToMesh(mesh, prop, s) {
  mesh.group.position.set(s.x, s.y, s.z);
  mesh.group.rotation.set(0, 0, 0);
  mesh.group.rotateY(-s.heading); // model nose is local -Z; -heading faces (sin h, 0, -cos h)
  mesh.group.rotateX(s.pitch); // positive pitch = nose up
  mesh.group.rotateZ(-s.bank); // positive bank = right wing down
  prop.rotation.z = s.propAngle;
}
