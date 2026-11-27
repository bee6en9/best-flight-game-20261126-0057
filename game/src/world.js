// Ember Isle Run — the island itself: terrain height, sea, sky, clouds,
// trees, the lit coastal runway and the volcano. One pure height function
// (heightAt) drives both the mesh and the flight collision, so what the
// player sees is exactly what the plane can hit.

import * as THREE from 'three';
import { WORLD, WORLD_SEED, RUNWAY, mulberry32 } from './config.js';

const rng = mulberry32(WORLD_SEED);

// --- Analytic height field --------------------------------------------------
// Sum of smooth gaussian bumps over a radial island falloff, plus a little
// value noise for ridges. Flat under the runway so landings are fair.
function bump(x, z, cx, cz, height, radius) {
  const dx = (x - cx) / radius;
  const dz = (z - cz) / radius;
  const d2 = dx * dx + dz * dz;
  return height * Math.exp(-d2 * 1.6);
}

// Tiny deterministic value noise, two octaves, for ground texture.
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}
function smoothNoise(x, z, cell) {
  const fx = x / cell;
  const fz = z / cell;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 0.5;
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  // Island: land inside ~980 m, shelf, then sea floor below the water.
  const falloff = 1 / (1 + Math.exp((r - WORLD.islandRadiusM) / 90));
  let h = 14 * falloff;
  h += bump(x, z, WORLD.volcano.x, WORLD.volcano.z, WORLD.volcano.heightM, WORLD.volcano.radiusM);
  h += bump(x, z, WORLD.ridgeWest.x, WORLD.ridgeWest.z, WORLD.ridgeWest.heightM, WORLD.ridgeWest.radiusM);
  h += bump(x, z, WORLD.ridgeEast.x, WORLD.ridgeEast.z, WORLD.ridgeEast.heightM, WORLD.ridgeEast.radiusM);
  h += bump(x, z, WORLD.hillNorth.x, WORLD.hillNorth.z, WORLD.hillNorth.heightM, WORLD.hillNorth.radiusM);
  h += smoothNoise(x, z, 170) * 22 * falloff;
  h += smoothNoise(x, z, 55) * 7 * falloff;
  h -= 26 * (1 - falloff); // sea floor
  // Flatten a pad under the runway strip.
  const rx = x - RUNWAY.centerX;
  const rz = z - RUNWAY.centerZ;
  const inStrip =
    Math.abs(rx) < RUNWAY.widthM * 2.2 && Math.abs(rz) < RUNWAY.lengthM * 0.62;
  if (inStrip) {
    const edge = Math.max(
      Math.abs(rx) / (RUNWAY.widthM * 2.2),
      Math.abs(rz) / (RUNWAY.lengthM * 0.62),
    );
    const t = Math.min(1, Math.max(0, (edge - 0.45) / 0.55));
    h = RUNWAY.surfaceY * (1 - t) + h * t;
  }
  return h;
}

function terrainColor(x, z, h, out) {
  // Sand at the waterline, green valley grass, dark volcanic rock high up,
  // pale ash near the crater. Slope darkens rock faces.
  const slope = Math.abs(heightAt(x + 6, z) - h) + Math.abs(heightAt(x, z + 6) - h);
  const crater = Math.hypot(x - WORLD.volcano.x, z - WORLD.volcano.z);
  if (h < 4.5) return out.setRGB(0.86, 0.78, 0.55); // beach sand
  if (crater < 120) return out.setRGB(0.23, 0.2, 0.19); // ash near the crater
  if (h > 150 || slope > 9) return out.setRGB(0.32, 0.29, 0.27); // bare rock
  if (h > 90) return out.setRGB(0.36, 0.5, 0.24); // high scrub
  const g = 0.42 + 0.1 * smoothNoise(x, z, 90);
  return out.setRGB(0.24, g, 0.2); // valley grass, gently varied
}

// Soft radial gradient texture (hot core → orange → transparent) for the
// lava glow sprite. Drawn once per load; identical every time.
function makeRadialTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 220, 150, 1)');
  grad.addColorStop(0.35, 'rgba(255, 140, 50, 0.55)');
  grad.addColorStop(1, 'rgba(255, 90, 20, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function buildWorld(scene) {
  const group = new THREE.Group();
  group.name = 'island';

  // --- Terrain mesh with vertex colours ------------------------------------
  const size = WORLD.terrainSizeM;
  const seg = WORLD.terrainSegments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    terrainColor(x, z, h, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  group.add(terrain);

  // --- Sea -------------------------------------------------------------------
  // Roughness 0.5 (was 0.18): the Blinn-Phong specular lobe is tight and
  // mirror-bright on a near-flat sea, so the low sun painted a blown white
  // column across the landing approach. A rougher sea spreads the same
  // light into a soft sheen — the water still reads as water.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 2.4, size * 2.4),
    new THREE.MeshStandardMaterial({
      color: 0x1d6f8e, roughness: 0.5, metalness: 0.0,
      transparent: true, opacity: 0.94,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = WORLD.seaLevelM;
  sea.name = 'sea';
  group.add(sea);

  // --- Sky dome: gradient shader, warm horizon, deep blue top ---------------
  const skyGeo = new THREE.SphereGeometry(4200, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6fc4) },
      mid: { value: new THREE.Color(0x7fb4e2) },
      low: { value: new THREE.Color(0xf6c98a) },
    },
    vertexShader: `varying vec3 vPos;
      void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float h = normalize(vPos).y;
        vec3 col = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h))
                            : mix(low, mid, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'skyDome';
  group.add(sky);

  // --- Sun disc + glow --------------------------------------------------------
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sun.position.set(-1500, 620, -2600);
  sun.lookAt(0, 0, 0);
  sun.name = 'sunDisc';
  group.add(sun);

  // --- Clouds: flattened white puffs, drifting slowly ------------------------
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.82, fog: false,
  });
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  for (let i = 0; i < WORLD.cloudCount; i++) {
    const puff = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) {
      const r = 14 + rng() * 22;
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), cloudMat);
      s.position.set((j - n / 2) * r * 1.1, (rng() - 0.5) * 6, (rng() - 0.5) * 14);
      s.scale.y = 0.42;
      puff.add(s);
    }
    const angle = rng() * Math.PI * 2;
    const dist = 350 + rng() * 1100;
    puff.position.set(Math.cos(angle) * dist, 210 + rng() * 130, Math.sin(angle) * dist);
    puff.userData.drift = 1.5 + rng() * 2.5;
    clouds.add(puff);
  }
  group.add(clouds);

  // --- Trees: two instanced meshes (trunk + canopy) on grassy ground ---------
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
  const canopyGeo = new THREE.ConeGeometry(4.2, 11, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2d6b2a, roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, WORLD.treeCount);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, WORLD.treeCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let guard = 0;
  while (placed < WORLD.treeCount && guard++ < 8000) {
    const angle = rng() * Math.PI * 2;
    const dist = 60 + rng() * 880;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const h = heightAt(x, z);
    // Grass only: not on beach, rock, ash, the runway pad or the ring line.
    if (h < 6 || h > 95) continue;
    if (Math.abs(x - RUNWAY.centerX) < 60 && Math.abs(z - RUNWAY.centerZ) < 220) continue;
    const s = 0.8 + rng() * 0.9;
    dummy.position.set(x, h + 2.2 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = rng() * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = h + (5 + 5) * s;
    dummy.updateMatrix();
    canopies.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunks.count = placed;
  canopies.count = placed;
  trunks.castShadow = true;
  canopies.castShadow = true;
  group.add(trunks, canopies);

  // --- Volcano: frustum cone, glowing crater, smoke -------------------------
  // The terrain bump alone reads as a green hill, so the cone is built as a
  // separate steep frustum (flat crater top, faceted basalt flanks) with a
  // lava disc, a glowing rim and a smoke plume — the three things that say
  // "volcano" at contact-sheet size. The glow is the cheap half of the
  // guide's bloom (bright-pass + blur + add): the lava disc is the bright
  // source, the additive radial sprite is the blur + add. Every position
  // derives from heightAt + constants, so the assembly is deterministic
  // and never touches the flight collision (heightAt is unchanged).
  const peakY = heightAt(WORLD.volcano.x, WORLD.volcano.z);
  const coneH = 150;
  const coneTopY = peakY + 70; // tip stands ~70 m above the broad bump —
  // low enough that the crater sits below the top-centre HUD panel in the
  // cover/rings chase shots, so the glowing crater is actually visible.
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 140, coneH, 24, 1),
    // Warm mid-brown basalt (the terrain's bare-rock family), not near-black:
    // the sun sits behind the cone from the usual chase angles, so the
    // camera-facing flank is lit only by sky fill and must not crush to black.
    new THREE.MeshStandardMaterial({ color: 0x55483f, roughness: 1, metalness: 0, flatShading: true }),
  );
  cone.position.set(WORLD.volcano.x, coneTopY - coneH / 2, WORLD.volcano.z);
  cone.name = 'volcanoCone';
  group.add(cone);
  // Lava disc on the flat crater top (fog off: it must stay hot at distance).
  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xff5a1e, fog: false }),
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(WORLD.volcano.x, coneTopY + 0.6, WORLD.volcano.z);
  lava.name = 'lavaPool';
  group.add(lava);
  // Glowing crater rim.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(25, 4, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8c2e, fog: false }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(WORLD.volcano.x, coneTopY + 1, WORLD.volcano.z);
  rim.name = 'craterRim';
  group.add(rim);
  // Soft additive glow above the crater.
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeRadialTexture(), color: 0xff7a2a, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glow.scale.set(240, 240, 1);
  glow.position.set(WORLD.volcano.x, coneTopY + 28, WORLD.volcano.z);
  glow.name = 'lavaGlow';
  group.add(glow);
  // Smoke plume: stacked flattened puffs, rising and drifting east. Static
  // (deterministic by construction); fog on, so it hazes naturally far away.
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(13 + i * 4.5, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0x8f9599, transparent: true, opacity: 0.3 - i * 0.035, fog: true,
      }),
    );
    puff.position.set(
      WORLD.volcano.x + 10 + i * 9,
      coneTopY + 30 + i * 26,
      WORLD.volcano.z - 4 - i * 2,
    );
    puff.scale.y = 0.55;
    puff.name = 'smokePuff';
    group.add(puff);
  }
  const lavaLight = new THREE.PointLight(0xff6a2a, 60, 260, 1.6);
  lavaLight.position.set(WORLD.volcano.x, coneTopY + 20, WORLD.volcano.z);
  group.add(lavaLight);

  // --- Runway: asphalt strip, dashes, threshold, edge lights, windsock -------
  const runway = new THREE.Group();
  runway.name = 'runway';
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.widthM, RUNWAY.lengthM),
    new THREE.MeshStandardMaterial({ color: 0x2e2f33, roughness: 0.9 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(RUNWAY.centerX, RUNWAY.surfaceY + 0.15, RUNWAY.centerZ);
  strip.receiveShadow = true;
  runway.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  for (let i = -4; i <= 4; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 14), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(RUNWAY.centerX, RUNWAY.surfaceY + 0.3, RUNWAY.centerZ + i * 34);
    runway.add(dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 10), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(
        RUNWAY.centerX + k * 4.4,
        RUNWAY.surfaceY + 0.3,
        RUNWAY.centerZ + end * (RUNWAY.lengthM / 2 - 14),
      );
      runway.add(bar);
    }
  }
  // Edge lights: warm emissive beads down both sides.
  const lightGeo = new THREE.SphereGeometry(0.7, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
  for (let i = -8; i <= 8; i++) {
    for (const side of [-1, 1]) {
      const bead = new THREE.Mesh(lightGeo, lightMat);
      bead.position.set(
        RUNWAY.centerX + side * (RUNWAY.widthM / 2 + 1.5),
        RUNWAY.surfaceY + 0.9,
        RUNWAY.centerZ + i * 20,
      );
      runway.add(bead);
    }
  }
  // Windsock beside the strip.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 }),
  );
  pole.position.set(RUNWAY.centerX + 22, RUNWAY.surfaceY + 4.5, RUNWAY.centerZ + 120);
  runway.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.5, 8, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.8, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(RUNWAY.centerX + 19.4, RUNWAY.surfaceY + 8.6, RUNWAY.centerZ + 120);
  runway.add(sock);
  group.add(runway);

  scene.add(group);
  return { group, clouds, lava };
}
