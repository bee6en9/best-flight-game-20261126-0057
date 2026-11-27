// Ember Isle Run — bootstrap and game loop: renderer, sun + sky light,
// chase camera, the menu → flying → landed/crashed state machine, and the
// deterministic ?shot= mode that freezes a composed frame for screenshots.

import * as THREE from 'three';
import { FLIGHT, CAMERA, RUNWAY, SCORE, WORLD } from './config.js';
import { buildWorld, heightAt } from './world.js';
import { buildPlaneMesh, freshState, stepFlight, applyToMesh } from './plane.js';
import { buildRings, checkRings, nextRingTarget, animateRings } from './rings.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createFeedback } from './feedback.js';
import { SHOT_NAMES, SHOT_FRAMES, SHOT_DT, placeForShot, shotCamera } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const isShot = SHOT_NAMES.includes(shotName);

// --- Renderer / scene / camera ----------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fc3e2, 650, 3300); // linear fog: near/far haze for depth
const camera = new THREE.PerspectiveCamera(CAMERA.fovBase, window.innerWidth / window.innerHeight, 0.5, 9000);
camera.position.set(0, 40, 820);

// --- Lights: warm low sun + sky fill, one shadow caster that follows the plane
const sun = new THREE.DirectionalLight(0xffe8c0, 2.8);
sun.position.set(-900, 700, -1400);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 3200;
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun);
scene.add(sun.target);
// Warm fill from the south-east (camera side): lifts the shadowed flanks
// of the volcano and terrain out of blackness — the rim-light idea from
// the shader guide, as a light rather than a fresnel term. No shadows.
const fill = new THREE.DirectionalLight(0xffe0b0, 0.55);
fill.position.set(800, 500, 900);
scene.add(fill);
scene.add(fill.target);
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x4a5a3a, 0.9));

// --- World, plane, rings ------------------------------------------------------
const world = buildWorld(scene);
const plane = buildPlaneMesh();
scene.add(plane.group);
const rings = buildRings(scene);

// --- Systems ------------------------------------------------------------------
const input = createInput();
const audio = createAudio();
const hud = createHud(document.getElementById('ui'));
const feedback = createFeedback(scene);

let state = freshState();
let phase = 'menu'; // menu | flying | landed | crashed
let shotFramesLeft = isShot ? SHOT_FRAMES : 0;
let cameraSnapped = false; // shot mode: snap the chase camera on frame 1
let shotInput = { pitch: 0, roll: 0, throttleDelta: 0, rudder: 0 };
let elapsed = 0;
let lowFuelWarned = false;

function resetGame() {
  state = freshState();
  phase = 'flying';
  lowFuelWarned = false;
  for (const r of rings) {
    r.userData.passed = false;
    r.userData.torus.material.emissive.setHex(0x8a5a12);
    r.userData.torus.material.color.setHex(0xd9a441);
  }
  hud.hideOver();
  hud.hideMenu();
  hud.flashMessage('RING 1 — FOLLOW THE GOLD', 2200);
}

function startFlying() {
  audio.unlock();
  resetGame();
}

// --- Chase camera ---------------------------------------------------------------
const camPos = new THREE.Vector3(0, 40, 820);
const camLook = new THREE.Vector3(0, 10, 0);
const tmpV = new THREE.Vector3();

function updateCamera(dt, shake) {
  if (phase === 'menu' && !isShot) {
    // Slow orbit around the parked plane on the strip.
    const a = elapsed * 0.08;
    camPos.set(
      state.x + Math.sin(a) * 26,
      state.y + 7 + Math.sin(a * 0.7) * 2,
      state.z + Math.cos(a) * 26,
    );
    camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
    camera.lookAt(state.x, state.y + 2, state.z);
    camera.fov += (58 - camera.fov) * Math.min(1, dt * 2);
    camera.updateProjectionMatrix();
    return;
  }
  // Chase: behind and above the plane, in world space, with the plane's
  // heading; the camera banks a third as much as the plane so it never
  // fights the pilot, and the mouse drag adds a small look offset.
  const back = CAMERA.chaseDistanceM;
  const up = CAMERA.chaseHeightM;
  const hx = Math.sin(state.heading);
  const hz = -Math.cos(state.heading);
  const yaw = input.mouseYaw;
  const pitchOff = input.mousePitch;
  const bx = hx * Math.cos(yaw) - hz * Math.sin(yaw);
  const bz = hx * Math.sin(yaw) + hz * Math.cos(yaw);
  tmpV.set(
    state.x - bx * back,
    state.y + up + pitchOff * 14,
    state.z - bz * back,
  );
  // Keep the camera out of the terrain.
  tmpV.y = Math.max(tmpV.y, heightAt(tmpV.x, tmpV.z) + 3);
  // In shot mode the camera snaps to the chase position on the first frame:
  // software rendering is slow, so there is no time to lerp into place.
  if (isShot && !cameraSnapped) {
    camPos.copy(tmpV);
    cameraSnapped = true;
  } else {
    camPos.lerp(tmpV, 1 - Math.pow(0.0001, dt));
  }
  camera.position.copy(camPos);
  camera.position.x += shake.x;
  camera.position.y += shake.y;
  camLook.set(
    state.x + hx * CAMERA.lookAheadM,
    state.y + 1.5,
    state.z + hz * CAMERA.lookAheadM,
  );
  camera.lookAt(camLook);
  camera.rotateZ(state.bank * 0.33 + shake.roll);
  const targetFov = CAMERA.fovBase + ((CAMERA.fovFast - CAMERA.fovBase) * Math.min(1, state.speedKts / FLIGHT.maxSpeedKts));
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 2);
  camera.updateProjectionMatrix();
}

// --- Shot mode ------------------------------------------------------------------
if (isShot) {
  shotInput = placeForShot(shotName, state, rings);
  phase = shotName === 'menu' ? 'menu' : 'flying';
  hud.hideMenu();
  if (shotName === 'menu') {
    hud.showMenu();
    // Card to the left so the parked plane stays visible on the right.
    document.getElementById('ui').classList.add('shot-menu');
  }
  const fixed = shotCamera(shotName, state);
  if (fixed) {
    camera.position.set(fixed.position.x, fixed.position.y, fixed.position.z);
    camera.lookAt(fixed.lookAt.x, fixed.lookAt.y, fixed.lookAt.z);
    camera.fov = fixed.fov;
    camera.updateProjectionMatrix();
  }
} else {
  hud.showMenu();
}

// --- Main loop --------------------------------------------------------------------
const clock = new THREE.Clock();
let lastTs = performance.now();

function frame() {
  const now = performance.now();
  const realDt = Math.min(0.1, Math.max(0, (now - lastTs) / 1000));
  lastTs = now;
  const dt = isShot ? SHOT_DT : Math.min(0.05, clock.getDelta() || 0.016);
  elapsed += dt;

  // One-shot actions.
  if (input.consume('start') && phase === 'menu') startFlying();
  if (input.consume('restart') && (phase === 'landed' || phase === 'crashed')) startFlying();
  if (input.consume('restart') && phase === 'flying') startFlying();
  if (input.consume('gear') && phase === 'flying') {
    state.gearDown = !state.gearDown;
    hud.flashMessage(state.gearDown ? 'GEAR DOWN' : 'GEAR UP', 900);
  }
  if (input.consume('mute')) {
    const m = audio.toggleMute();
    hud.flashMessage(m ? 'SOUND OFF' : 'SOUND ON', 900);
  }
  if (input.consume('camera')) {
    hud.flashMessage('CAMERA: CHASE', 900);
  }
  if (!isShot && input.consume('pause') && phase === 'flying') {
    hud.flashMessage(input.paused ? 'PAUSED — P TO RESUME' : '', 900);
  }

  // Simulation.
  if (phase === 'flying' && !input.paused) {
    const stick = isShot ? shotInput : input.readStick();
    const ev = stepFlight(state, stick, dt);
    const ringHit = checkRings(state, rings);
    if (ringHit) {
      const at = rings[ringHit.index].position;
      feedback.ringBurst({ x: at.x, y: at.y, z: at.z });
      audio.ring();
      hud.flashMessage(
        state.ringsPassed >= 8 ? 'ALL RINGS! NOW LAND ON THE STRIP 🛬' : `RING ${ringHit.index + 1} CLEARED  +${SCORE.ring}`,
        1600,
      );
    }
    if (ev === 'landed') {
      phase = 'landed';
      audio.landing();
      hud.showOver('🛬 LANDED — MAIL DELIVERED', [
        `SCORE ${state.score}  ·  RINGS ${state.ringsPassed}/8`,
        `TIME ${Math.floor(state.timeSec / 60)}:${String(Math.floor(state.timeSec % 60)).padStart(2, '0')}  ·  FUEL LEFT ${Math.round(state.fuel)}%`,
        'Press R to fly again',
      ]);
    } else if (ev === 'crash') {
      phase = 'crashed';
      audio.crash();
      feedback.crashShake();
      hud.showOver('💥 CRASHED', [
        `SCORE ${state.score}  ·  RINGS ${state.ringsPassed}/8`,
        state.damage >= 100 ? 'The island wins this time.' : 'Too hard on the airframe.',
        'Press R to fly again',
      ]);
    }
    if (state.fuel < 25 && state.fuel > 0 && !lowFuelWarned) {
      lowFuelWarned = true;
      audio.warning();
    }
    audio.update(state.throttle, state.speedKts, state.onGround);
  }

  // Visuals.
  applyToMesh(plane, plane.prop, state);
  animateRings(rings, state, elapsed);
  feedback.update(dt);
  world.clouds.children.forEach((c) => {
    c.position.x += c.userData.drift * dt;
    if (c.position.x > 1400) c.position.x = -1400;
  });
  // The shadow frustum follows the plane so shadows stay crisp.
  sun.position.set(state.x - 900, 700, state.z - 1400);
  sun.target.position.set(state.x, 0, state.z);
  fill.position.set(state.x + 800, 500, state.z + 900);
  fill.target.position.set(state.x, 0, state.z);
  const shake = feedback.shakeOffset(realDt);
  if (isShot) {
    const fixed = shotCamera(shotName, state);
    if (fixed) {
      camera.position.set(fixed.position.x, fixed.position.y, fixed.position.z);
      camera.lookAt(fixed.lookAt.x, fixed.lookAt.y, fixed.lookAt.z);
    } else {
      updateCamera(dt, { x: 0, y: 0, roll: 0 });
    }
  } else {
    updateCamera(dt, shake);
  }
  hud.update(state, phase === 'flying' ? nextRingTarget(state, rings) : null, now);

  renderer.render(scene, camera);

  // Shot mode: freeze after the fixed steps so the screenshot is stable.
  if (isShot) {
    shotFramesLeft -= 1;
    if (shotFramesLeft <= 0) {
      renderer.setAnimationLoop(null);
      document.title = `shot-ready:${shotName}`;
      return;
    }
  }
}

renderer.setAnimationLoop(frame);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Expose for smoke checks and console debugging.
Object.assign(window, { renderer, scene, camera, getState: () => state });
