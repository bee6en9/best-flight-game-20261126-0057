// Ember Isle Run — game feel: trauma-based camera shake (summed sines, never
// per-frame random), ring-burst particles and a short speed flash. Juice is
// visual only: it moves the camera and spawns particles, never the plane.

import * as THREE from 'three';

export function createFeedback(scene) {
  let trauma = 0;
  let t = 0;
  const maxOffset = 0.9; // metres of camera offset at full trauma
  const maxRoll = 0.045; // radians

  // One reusable particle pool: golden sparks for ring passes. The sprite is
  // a runtime-generated radial gradient, so sparks read as soft round
  // glints, not squares — and no image file is needed.
  const MAXP = 240;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3);
  const pCol = new Float32Array(MAXP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 64;
  spriteCanvas.height = 64;
  const sctx = spriteCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,230,160,0.9)');
  grad.addColorStop(1, 'rgba(255,200,80,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  const spriteTex = new THREE.CanvasTexture(spriteCanvas);
  const pMat = new THREE.PointsMaterial({
    size: 2.4, map: spriteTex, vertexColors: true, transparent: true,
    opacity: 0.95, sizeAttenuation: true, depthWrite: false,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  points.name = 'ringSparks';
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAXP; i++) {
    parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
    pPos[i * 3 + 1] = -9999;
  }

  function burst(at, n) {
    let spawned = 0;
    for (const p of parts) {
      if (spawned >= n) break;
      if (p.alive) continue;
      p.alive = true;
      p.x = at.x; p.y = at.y; p.z = at.z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const sp = 8 + Math.random() * 18;
      p.vx = Math.cos(a) * Math.cos(b) * sp;
      p.vy = Math.sin(b) * sp + 4;
      p.vz = Math.sin(a) * Math.cos(b) * sp;
      p.life = 0.9 + Math.random() * 0.5;
      spawned++;
    }
  }

  return {
    addTrauma(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    ringBurst(at) {
      burst(at, 90);
      this.addTrauma(0.22);
    },
    crashShake() {
      this.addTrauma(1);
    },
    // Returns the camera-space shake offset for this frame (real dt: shake
    // keeps decaying even while the game is slowed or paused).
    shakeOffset(realDt) {
      t += realDt * 30;
      trauma = Math.max(0, trauma - 1.3 * realDt);
      const sh = trauma * trauma;
      return {
        x: maxOffset * sh * Math.sin(t * 1.7),
        y: maxOffset * sh * Math.sin(t * 2.3),
        roll: maxRoll * sh * Math.sin(t * 1.1),
        trauma,
      };
    },
    update(dt) {
      for (let i = 0; i < MAXP; i++) {
        const p = parts[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          pPos[i * 3 + 1] = -9999;
          continue;
        }
        p.vy -= 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        pPos[i * 3] = p.x;
        pPos[i * 3 + 1] = p.y;
        pPos[i * 3 + 2] = p.z;
        const fade = Math.min(1, p.life / 0.5);
        pCol[i * 3] = 1.0 * fade;
        pCol[i * 3 + 1] = 0.78 * fade;
        pCol[i * 3 + 2] = 0.25 * fade;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
    },
  };
}
