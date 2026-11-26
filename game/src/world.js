// world.js — the Breakwater Isles: seeded terrain, sea, sky, landmarks and airfield.
// Every shape is procedural (no external assets). terrainHeight(x, z) is the single
// source of truth for the ground, shared by the renderer and the flight model.

import * as THREE from 'three';
import { makeNoise2D, makeRng } from './random.js';
import { RUNWAY, WEATHER, clamp, smoothstep } from './config.js';

const WORLD_SEED = 20261126;
const SIZE = 1400; // terrain plane, metres, centred on (0, 0)

// Island bumps: [x, z, radius, height].
const ISLANDS = [
  [-40, -60, 430, 62], // main island
  [-150, -270, 260, 96], // north ridge, snow-capped
  [390, -250, 190, 42], // east isle
  [-390, 260, 210, 38], // west isle (lighthouse rock)
  [300, 340, 150, 18], // south islet
  [-180, 430, 110, 12], // far south islet
];

// A sea inlet carved from the east coast toward the airfield bay, crossed by a bridge.
function channelDepth(x, z) {
  // Distance to the segment from (520, 40) to (170, -50).
  const ax = 520, az = 40, bx = 170, bz = -50;
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = ((x - ax) * dx + (z - az) * dz) / len2;
  t = clamp(t, 0, 1);
  const px = ax + dx * t, pz = az + dz * t;
  const d = Math.hypot(x - px, z - pz);
  return 17 * (1 - smoothstep(30, 75, d));
}

const fbm = makeNoise2D(WORLD_SEED);

export function terrainHeight(x, z) {
  let h = -6; // sea floor
  for (const [cx, cz, r, peak] of ISLANDS) {
    const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    h += peak * Math.exp(-(d2 / (r * r)) * 2.2);
  }
  // Rolling detail, stronger where the land is high.
  const mask = clamp((h + 6) / 40, 0, 1);
  h += fbm(x * 0.008, z * 0.008, 4) * 5 * mask;
  h += fbm(x * 0.03 + 7, z * 0.03 - 3, 3) * 1.2 * mask;
  h -= channelDepth(x, z);
  // Flatten the airfield plateau around the runway.
  const ax0 = RUNWAY.centerX - RUNWAY.length / 2 - 70;
  const ax1 = RUNWAY.centerX + RUNWAY.length / 2 + 70;
  const az0 = RUNWAY.centerZ - 90, az1 = RUNWAY.centerZ + 90;
  const ex = smoothstep(ax0 - 60, ax0, x) * (1 - smoothstep(ax1, ax1 + 60, x));
  const ez = smoothstep(az0 - 60, az0, z) * (1 - smoothstep(az1, az1 + 60, z));
  // Graded approach corridor west of the runway: a pilot on final from the
  // sea must not meet a 29 m hill 350 m out. Extend the plateau west along
  // the extended centreline, but only where the ground is already above
  // the water, so the coastline stays where it is.
  const cex = smoothstep(-760, -700, x) * (1 - smoothstep(ax1, ax1 + 60, x));
  const cez = smoothstep(RUNWAY.centerZ - 55, RUNWAY.centerZ - 30, z)
    * (1 - smoothstep(RUNWAY.centerZ + 30, RUNWAY.centerZ + 55, z));
  const corridor = cex * cez * smoothstep(0, 2, h);
  const flat = Math.max(ex * ez, corridor);
  return h + (RUNWAY.elevation - h) * flat;
}

function groundColor(h, slope, x, z, out) {
  const n = fbm(x * 0.05, z * 0.05, 2) * 0.5 + 0.5;
  if (h < 1.4) { out.setRGB(0.85, 0.76, 0.55); } // sand
  else if (h > 74) { out.setRGB(0.93, 0.95, 0.97); } // snow
  else if (h > 46 || slope > 0.55) { out.setRGB(0.52, 0.49, 0.44); } // rock
  else { // grass, two tones mixed by noise
    out.setRGB(0.32 + 0.12 * n, 0.55 + 0.10 * n, 0.26 + 0.06 * n);
  }
  return out;
}

function makeSkyDome(preset) {
  const uniforms = {
    topColor: { value: new THREE.Color(preset.skyTop) },
    horizonColor: { value: new THREE.Color(preset.skyHorizon) },
    sunDir: { value: new THREE.Vector3(...preset.sunPos).normalize() },
    sunColor: { value: new THREE.Color(preset.sunColor) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 topColor, horizonColor, sunColor;
      uniform vec3 sunDir;
      varying vec3 vWorld;
      void main() {
        // Direction from the camera, not from the dome's centre: the dome
        // sits at the world origin while the camera flies, and the sun glow
        // must sit where the sun is from the pilot's eye.
        vec3 vDir = normalize(vWorld - cameraPosition);
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = mix(horizonColor, topColor, pow(max(h, 0.0), 0.62));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 220.0) * 0.9 + pow(s, 10.0) * 0.10);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2600, 24, 14), mat);
  dome.name = 'skyDome';
  return { dome, uniforms };
}

function makeRunwayTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4e54'; g.fillRect(0, 0, 1024, 96);
  g.fillStyle = '#54585e'; g.fillRect(0, 0, 1024, 6); g.fillRect(0, 90, 1024, 6);
  g.fillStyle = '#f2f2e8';
  // Edge lines.
  g.fillRect(0, 10, 1024, 3); g.fillRect(0, 83, 1024, 3);
  // Centreline dashes.
  for (let x = 20; x < 1024; x += 64) g.fillRect(x, 46, 34, 4);
  // Threshold bars.
  for (let i = 0; i < 4; i++) {
    g.fillRect(28, 20 + i * 16, 46, 8);
    g.fillRect(950, 20 + i * 16, 46, 8);
  }
  // Runway numbers.
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('09', 130, 48);
  g.fillText('27', 894, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildWorld(scene) {
  const rng = makeRng(WORLD_SEED + 7);
  const group = new THREE.Group();
  group.name = 'world';
  const updaters = [];

  // --- Sky dome, sun, lights, fog.
  const weatherName = 'golden';
  const { dome, uniforms } = makeSkyDome(WEATHER[weatherName]);
  group.add(dome);
  const sun = new THREE.DirectionalLight(WEATHER.golden.sunColor, WEATHER.golden.sunIntensity);
  sun.position.set(...WEATHER.golden.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 2200;
  group.add(sun);
  const hemi = new THREE.HemisphereLight(WEATHER.golden.hemiSky, WEATHER.golden.hemiGround, WEATHER.golden.hemiIntensity);
  group.add(hemi);
  scene.fog = new THREE.Fog(WEATHER.golden.fog, WEATHER.golden.fogNear, WEATHER.golden.fogFar);

  // --- Sea, with a procedural wave-streak texture so it reads as water.
  function makeSeaTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#2a7d9c'; g.fillRect(0, 0, 256, 256);
    const rng = makeRng(WORLD_SEED + 21);
    for (let i = 0; i < 260; i++) {
      const x = rng() * 256, y = rng() * 256, len = 12 + rng() * 42;
      g.strokeStyle = rng() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(8,40,60,0.12)';
      g.lineWidth = 1 + rng() * 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y + (rng() - 0.5) * 6);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(28, 28);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(5200, 5200),
    new THREE.MeshStandardMaterial({ map: makeSeaTexture(), roughness: 0.55, metalness: 0.15 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  sea.receiveShadow = true;
  sea.name = 'sea';
  group.add(sea);

  // --- Terrain with vertex colours.
  const segs = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // Slope from a small forward sample.
    const slope = Math.abs(terrainHeight(x + 4, z) - h) / 4 + Math.abs(terrainHeight(x, z + 4) - h) / 4;
    groundColor(h, slope, x, z, col);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0,
  }));
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  group.add(terrain);

  // --- Pine forests (instanced trunks + cones).
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 650 && guard++ < 20000) {
    const x = (rng() - 0.5) * 1250, z = (rng() - 0.5) * 1250;
    const h = terrainHeight(x, z);
    if (h < 3 || h > 44) continue;
    if (Math.abs(x - RUNWAY.centerX) < 230 && Math.abs(z - RUNWAY.centerZ) < 120) continue;
    treeSpots.push([x, h, z, 0.7 + rng() * 0.9]);
  }
  const dummy = new THREE.Object3D();
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.4, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const coneGeo = new THREE.ConeGeometry(2.6, 8, 6);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x2e5d3a, roughness: 1, flatShading: true });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, treeSpots.length);
  const tint = new THREE.Color();
  treeSpots.forEach(([x, h, z, s], i) => {
    dummy.position.set(x, h + 1.1 * s, z);
    dummy.scale.setScalar(s); dummy.rotation.y = rng() * Math.PI * 2; dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, h + (2.2 + 4) * s, z);
    dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.33 + rng() * 0.03, 0.45, 0.3 + rng() * 0.12);
    cones.setColorAt(i, tint);
  });
  trunks.castShadow = true; cones.castShadow = true;
  group.add(trunks, cones);

  // --- Harbour villages (instanced bodies + pitched roofs).
  const houseSpots = [];
  const villages = [[150, 60, 60], [-300, 190, 42]];
  for (const [vx, vz, r] of villages) {
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, d = rng() * r;
      const x = vx + Math.cos(a) * d, z = vz + Math.sin(a) * d;
      const h = terrainHeight(x, z);
      if (h < 2 || h > 34) continue;
      houseSpots.push([x, h, z, 0.8 + rng() * 0.7, rng() * Math.PI]);
    }
  }
  const bodyGeo = new THREE.BoxGeometry(7, 4.5, 6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.9, flatShading: true });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, houseSpots.length);
  const roofGeo = new THREE.ConeGeometry(5.4, 3.2, 4);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb4502e, roughness: 0.9, flatShading: true });
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, houseSpots.length);
  houseSpots.forEach(([x, h, z, s, rot], i) => {
    dummy.position.set(x, h + 2.2 * s, z);
    dummy.scale.setScalar(s); dummy.rotation.set(0, rot, 0); dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.08 + rng() * 0.04, 0.25, 0.82 + rng() * 0.08);
    bodies.setColorAt(i, tint);
    dummy.position.set(x, h + (4.5 + 1.6) * s, z);
    dummy.rotation.set(0, rot + Math.PI / 4, 0); dummy.updateMatrix();
    roofs.setMatrixAt(i, dummy.matrix);
  });
  bodies.castShadow = true; roofs.castShadow = true;
  group.add(bodies, roofs);

  // --- Lighthouse on the west rock.
  const lh = new THREE.Group();
  const lhBase = terrainHeight(-470, 330);
  const stripeWhite = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.8 });
  const stripeRed = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6 - i * 0.28, 3.0 - i * 0.28, 4.4, 12),
      i % 2 === 0 ? stripeWhite : stripeRed,
    );
    seg.position.y = 2.2 + i * 4.4;
    seg.castShadow = true;
    lh.add(seg);
  }
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.0, 2.6, 12),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 }),
  );
  lamp.position.y = 20.2;
  lh.add(lamp);
  const lampGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc94d, emissiveIntensity: 2.2 }),
  );
  lampGlow.position.y = 20.2;
  lh.add(lampGlow);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 2.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x8c2f26, roughness: 0.8 }),
  );
  cap.position.y = 22.6;
  lh.add(cap);
  lh.position.set(-470, lhBase, 330);
  group.add(lh);

  // --- Stone arch bridge over the inlet channel.
  const bridge = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xb9a98c, roughness: 0.95, flatShading: true });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 96), stone);
  deck.position.y = 11;
  deck.castShadow = true;
  bridge.add(deck);
  for (const dz of [-32, 0, 32]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(13, 2.4, 8, 14, Math.PI), stone);
    arch.position.set(0, 11, dz);
    arch.rotation.y = Math.PI / 2;
    arch.rotation.z = 0;
    arch.castShadow = true;
    bridge.add(arch);
  }
  for (const dx of [-6.4, 6.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 96), stone);
    rail.position.set(dx, 13, 0);
    bridge.add(rail);
  }
  bridge.position.set(330, 0, 0);
  group.add(bridge);

  // --- Airfield: runway, apron, hangars, control tower, windsock, PAPI.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 120),
    new THREE.MeshStandardMaterial({ color: 0x7a7e80, roughness: 0.95 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, RUNWAY.elevation + 0.05, RUNWAY.centerZ);
  apron.receiveShadow = true;
  group.add(apron);

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.length, RUNWAY.width),
    new THREE.MeshStandardMaterial({ map: makeRunwayTexture(), roughness: 0.9 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(RUNWAY.centerX, RUNWAY.elevation + 0.12, RUNWAY.centerZ);
  runway.receiveShadow = true;
  runway.name = 'runway';
  group.add(runway);

  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x7d8a94, roughness: 0.7, metalness: 0.3 });
  const hangarRoofMat = new THREE.MeshStandardMaterial({ color: 0x3c5a74, roughness: 0.7, metalness: 0.2 });
  for (const hx of [-90, -40]) {
    const hall = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 26), hangarMat);
    box.position.y = 5; box.castShadow = true;
    hall.add(box);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 34, 12, 1, false, 0, Math.PI), hangarRoofMat);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 10;
    roof.castShadow = true;
    hall.add(roof);
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b3a48, roughness: 0.6, metalness: 0.4 }),
    );
    door.position.set(0, 4, 13.1);
    hall.add(door);
    hall.position.set(hx, RUNWAY.elevation, 128);
    group.add(hall);
  }

  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.2, 22, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.85 }),
  );
  shaft.position.y = 11; shaft.castShadow = true;
  tower.add(shaft);
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 4.4, 4.4, 10),
    new THREE.MeshStandardMaterial({ color: 0x1d3a52, roughness: 0.25, metalness: 0.55 }),
  );
  cab.position.y = 24;
  tower.add(cab);
  tower.position.set(120, RUNWAY.elevation, 130);
  group.add(tower);

  // Windsock (animated by the wind).
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 9, 6),
    new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6, metalness: 0.4 }),
  );
  sockPole.position.set(60, RUNWAY.elevation + 4.5, 150);
  group.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.2, 8, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf07a1e, roughness: 0.8, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(60, RUNWAY.elevation + 8.6, 150);
  group.add(sock);
  updaters.push((t, wind) => {
    sock.rotation.y = -wind.dirRad + Math.sin(t * 0.7) * 0.08;
    sock.rotation.z = Math.PI / 2 - 0.35 - wind.kt * 0.02;
  });

  // PAPI lights beside the RWY 09 threshold.
  const papi = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: i < 2 ? 0xff2a1e : 0xffffff, emissiveIntensity: 1.6 }),
    );
    lamp.position.set(-RUNWAY.length / 2 + 18, RUNWAY.elevation + 0.5, RUNWAY.centerZ - RUNWAY.width / 2 - 6 - i * 2.2);
    papi.add(lamp);
  }
  group.add(papi);

  // --- Clouds (instanced puffs, drifting with the wind).
  // Unlit white puffs: backlit standard material read as grey rocks, so the
  // clouds stay bright against any sky.
  const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const cloudData = [];
  for (let i = 0; i < 26; i++) {
    const cx = (rng() - 0.5) * 2200, cz = (rng() - 0.5) * 2200, cy = 130 + rng() * 110;
    const n = 5 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) {
      cloudData.push({
        x: cx + (rng() - 0.5) * 40, y: cy + (rng() - 0.5) * 7, z: cz + (rng() - 0.5) * 20,
        s: 8 + rng() * 10,
      });
    }
  }
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudData.length);
  cloudData.forEach((c, i) => {
    dummy.position.set(c.x, c.y, c.z);
    dummy.scale.set(c.s, c.s * 0.42, c.s * 0.7);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    clouds.setMatrixAt(i, dummy.matrix);
  });
  clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(clouds);
  updaters.push((t, wind) => {
    const dx = Math.sin(wind.dirRad) * wind.kt * 0.35;
    const dz = Math.cos(wind.dirRad) * wind.kt * 0.35;
    for (let i = 0; i < cloudData.length; i++) {
      const c = cloudData[i];
      let x = c.x + dx * t * 0.1;
      let z = c.z + dz * t * 0.1;
      x = ((x + 1200) % 2400 + 2400) % 2400 - 1200;
      z = ((z + 1200) % 2400 + 2400) % 2400 - 1200;
      dummy.position.set(x, c.y, z);
      dummy.scale.set(c.s, c.s * 0.42, c.s * 0.7);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
  });

  // --- Gulls circling the coast.
  const gulls = [];
  const gullMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const wgeo = new THREE.PlaneGeometry(2.2, 0.5);
    const wl = new THREE.Mesh(wgeo, gullMat);
    wl.position.x = -1.1;
    const wr = new THREE.Mesh(wgeo, gullMat);
    wr.position.x = 1.1;
    g.add(wl, wr);
    g.userData = { wl, wr, cx: -200 + rng() * 500, cz: -100 + rng() * 300, r: 30 + rng() * 50, h: 45 + rng() * 30, ph: rng() * Math.PI * 2, sp: 0.25 + rng() * 0.2 };
    gulls.push(g);
    group.add(g);
  }
  updaters.push((t) => {
    for (const g of gulls) {
      const u = g.userData;
      const a = u.ph + t * u.sp;
      g.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 0.8 + u.ph) * 2, u.cz + Math.sin(a) * u.r);
      g.rotation.y = -a;
      const flap = Math.sin(t * 7 + u.ph) * 0.55;
      u.wl.rotation.z = flap;
      u.wr.rotation.z = -flap;
    }
  });

  scene.add(group);

  function setWeather(name) {
    const p = WEATHER[name];
    uniforms.topColor.value.setHex(p.skyTop);
    uniforms.horizonColor.value.setHex(p.skyHorizon);
    uniforms.sunDir.value.set(...p.sunPos).normalize();
    uniforms.sunColor.value.setHex(p.sunColor);
    sun.color.setHex(p.sunColor);
    sun.intensity = p.sunIntensity;
    sun.position.set(...p.sunPos);
    hemi.color.setHex(p.hemiSky);
    hemi.groundColor.setHex(p.hemiGround);
    hemi.intensity = p.hemiIntensity;
    scene.fog.color.setHex(p.fog);
    scene.fog.near = p.fogNear;
    scene.fog.far = p.fogFar;
    return p;
  }

  return { group, setWeather, update: (t, wind) => { for (const u of updaters) u(t, wind); } };
}
