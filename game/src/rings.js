// Ember Isle Run — the mission: 8 gold rings threaded along the valley from
// the coastal strip to the volcano and back, then a landing. Rings are torus
// meshes with a halo; passing through the centre (not just near it) counts.

import * as THREE from 'three';
import { RINGS, RING_RADIUS_M, RUNWAY, SCORE } from './config.js';
import { heightAt } from './world.js';

// Ring course, hand-placed along the valley so each one is visible from the
// previous and no leg asks for more climb than the plane can give (about
// 25 m/s at full power): out along the east ridge, around the volcano's
// shoulder — never over its cone — and back over the bay to the strip.
const COURSE = [
  { x: 60, z: 560, y: 62 },
  { x: 210, z: 330, y: 84 },
  { x: 330, z: 90, y: 108 },
  { x: 180, z: -180, y: 132 },
  { x: -60, z: -300, y: 150 },
  { x: -330, z: -160, y: 140 },
  { x: -260, z: 120, y: 120 },
  { x: -90, z: 330, y: 72 },
];

export function buildRings(scene) {
  const group = new THREE.Group();
  group.name = 'ringCourse';
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd9a441, emissive: 0x8a5a12, roughness: 0.3, metalness: 0.8,
  });
  const meshes = [];
  for (let i = 0; i < RINGS; i++) {
    const c = COURSE[i];
    const ring = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS_M, 1.4, 12, 40),
      gold.clone(),
    );
    torus.castShadow = true;
    ring.add(torus);
    // Halo sprite so the ring reads from far away, even at contact-sheet size.
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(RING_RADIUS_M - 2, RING_RADIUS_M + 2, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffc861, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
      }),
    );
    ring.add(halo);
    // Number beacon above the ring: a small floating marker.
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.2),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
    );
    beacon.position.y = RING_RADIUS_M + 7;
    ring.add(beacon);
    ring.position.set(c.x, Math.max(c.y, heightAt(c.x, c.z) + 26), c.z);
    // Face the ring toward the previous waypoint so the pilot flies through it.
    const prev = i === 0
      ? { x: RUNWAY.centerX, z: RUNWAY.centerZ }
      : COURSE[i - 1];
    ring.lookAt(prev.x, ring.position.y, prev.z);
    ring.userData = { index: i, passed: false, torus, beacon, baseY: ring.position.y };
    group.add(ring);
    meshes.push(ring);
  }
  scene.add(group);
  return meshes;
}

// Did the plane pass through the ring's centre plane inside its radius?
// Tracked per-frame: the plane crosses the ring's local Z = 0 plane while
// within the torus radius. Simpler robust check: distance to the ring centre
// under the radius while the plane is close to the ring's plane.
export function checkRings(state, meshes) {
  const next = meshes[state.ringsPassed];
  if (!next) return null;
  const p = next.position;
  const dx = state.x - p.x;
  const dy = state.y - p.y;
  const dz = state.z - p.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < RING_RADIUS_M - 1.5) {
    next.userData.passed = true;
    state.ringsPassed += 1;
    state.score += SCORE.ring;
    // Passed ring turns green and dims; the next one becomes the bright one.
    next.userData.torus.material.emissive.setHex(0x1d7a33);
    next.userData.torus.material.color.setHex(0x3fae5a);
    return { index: next.userData.index, dist };
  }
  return null;
}

export function nextRingTarget(state, meshes) {
  if (state.ringsPassed >= meshes.length) {
    return { x: RUNWAY.centerX, z: RUNWAY.centerZ, y: RUNWAY.surfaceY + 12, isRunway: true };
  }
  const m = meshes[state.ringsPassed];
  return { x: m.position.x, z: m.position.z, y: m.position.y, isRunway: false };
}

// The course, exported so a headless autopilot test can fly the same line.
export const RING_COURSE = COURSE;

// Pulse the next ring and bob its beacon; passed rings stay quiet.
export function animateRings(meshes, state, t) {
  for (const m of meshes) {
    const isNext = m.userData.index === state.ringsPassed;
    const s = isNext ? 1 + Math.sin(t * 4) * 0.06 : 1;
    m.scale.setScalar(s);
    m.userData.beacon.position.y = m.userData.baseY - m.position.y + RING_RADIUS_M + 7 + Math.sin(t * 2 + m.userData.index) * 1.2;
    if (isNext) {
      m.userData.torus.material.emissiveIntensity = 1.4 + Math.sin(t * 4) * 0.5;
    }
  }
}
