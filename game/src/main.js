// main.js — SALTWIND boot and game loop.
// States: menu (parked aircraft, orbiting camera) -> flying -> paused ->
// debrief (grade + stats + sortie select). HUD, gauges, map and audio are
// updated here every frame. Screenshot mode (?shot=...) is staged by shots.js.

import * as THREE from 'three';
import { GAME, SORTIES, WEATHER, RUNWAY, clamp } from './config.js';
import { buildWorld, terrainHeight } from './world.js';
import { buildAircraft } from './aircraft.js';
import { createPlane, stepFlight, stepRollout, forwardOf } from './flight.js';
import { createCameraRig } from './camera.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createGauges } from './gauges.js';
import { createSectorMap } from './map.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import { parseShot, createAutopilot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 2, 0.1, 6000);

const world = buildWorld(scene);
const aircraft = buildAircraft();
scene.add(aircraft.group);
const rig = createCameraRig(camera);
const input = createInput(canvas);
const hud = createHud();
const gauges = createGauges(document.getElementById('gauges-canvas'));
const sectorMap = createSectorMap(
  document.getElementById('minimap-canvas'),
  document.getElementById('bigmap-canvas'),
);
const missions = createMissions(scene);
const audio = createAudio();
const autopilot = createAutopilot();

let state = 'menu'; // menu | flying | paused | debrief
let plane = null;
let sortieIndex = 0;
let menuAngle = 0;
let debriefData = null;
let endTimer = 0;
let frames = 0;
let elapsed = 0;
let lowFuelAlarmed = false;

const shot = parseShot();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- Menu: aircraft parked on the apron, camera slowly orbiting it.
function parkAircraft() {
  plane = createPlane({
    pos: [30, RUNWAY.elevation + 0.6, RUNWAY.centerZ + 40],
    headingDeg: 115, speed: 0, fuel: 100,
  });
  plane.onGround = true;
  aircraft.group.position.copy(plane.pos);
  aircraft.group.quaternion.copy(plane.quat);
  aircraft.setGearDown(true);
}

function showMenu() {
  state = 'menu';
  missions.abort();
  parkAircraft();
  world.setWeather('golden');
  hud.setStatus('ON STATION');
  hud.setSortie(SORTIES[sortieIndex], sortieIndex + 1, SORTIES.length);
  document.getElementById('menu-screen').classList.remove('hidden');
  document.getElementById('debrief-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('guide-screen').classList.add('hidden');
  buildSortieList();
}

function buildSortieList() {
  for (const id of ['sortie-list', 'sortie-list-debrief']) {
    const list = document.getElementById(id);
    if (!list) continue;
    list.innerHTML = '';
    SORTIES.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'sortie-btn' + (i === sortieIndex ? ' selected' : '');
      b.innerHTML = `<span class="code">0${i + 1}</span><span class="sname">${s.name}</span><span class="sobj">${s.objective}</span>`;
      b.addEventListener('click', () => { sortieIndex = i; audio.unlock(); buildSortieList(); });
      list.appendChild(b);
    });
  }
}

function startSortie(index) {
  sortieIndex = index;
  const sortie = SORTIES[index];
  const preset = world.setWeather(sortie.weather);
  plane = createPlane(sortie.start);
  plane.wind = {
    dirRad: THREE.MathUtils.degToRad(preset.windDir),
    kt: preset.windKt,
  };
  plane.gearDown = sortie.id === 3; // gear down for the landing sortie
  missions.start(index);
  hud.setSortie(sortie, index + 1, SORTIES.length);
  hud.setWeather(WEATHER[sortie.weather].label, preset.windKt, preset.windDir);
  hud.setStatus('AIRBORNE');
  hud.setObjective(sortie.objective, 0);
  aircraft.group.position.copy(plane.pos);
  aircraft.group.quaternion.copy(plane.quat);
  aircraft.setGearDown(plane.gearDown);
  rig.snap(plane);
  rig.mode = 'chase';
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('debrief-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  state = 'flying';
  endTimer = 0;
  lowFuelAlarmed = false;
  audio.unlock();
}

function showDebrief(data) {
  state = 'debrief';
  debriefData = data;
  const d = document.getElementById('debrief-screen');
  d.classList.remove('hidden');
  document.getElementById('debrief-grade').textContent = data.grade;
  document.getElementById('debrief-title').textContent =
    data.outcome === 'landed' ? 'Touchdown' : data.outcome === 'complete' ? 'Sortie Complete' : 'Sortie Lost';
  document.getElementById('debrief-sub').textContent =
    data.outcome === 'landed'
      ? `RWY 09 — ${data.grade === 'S' ? 'FLARE GRADE' : 'FLARE GRADE'} · Sortie complete at Gull Rock`
      : data.outcome === 'complete'
        ? `All objectives cleared — ${data.sortie.name}`
        : data.crashCause || 'The Shearwater is down.';
  document.getElementById('stat-sink').textContent = data.outcome === 'landed' ? `${data.sink.toFixed(2)} M/S` : '—';
  document.getElementById('stat-fuel').textContent = `${data.fuel} %`;
  document.getElementById('stat-score').textContent = `${data.score.toLocaleString()} PTS`;
  document.getElementById('stat-hull').textContent = `${data.hull} %`;
  document.getElementById('stat-time').textContent = `${Math.floor(data.time / 60)}:${String(data.time % 60).padStart(2, '0')}`;
  buildSortieList();
  hud.setStatus(data.outcome === 'crash' ? 'DOWN' : 'ON STATION');
}

function handleMissionEvent(name, data) {
  if (name === 'gate') {
    audio.gate();
    const s = missions.current;
    hud.setObjective(s.gates.length > 1 ? `Clear gate ${String(data.index + 1).padStart(2, '0')} / ${String(s.gates.length).padStart(2, '0')}` : s.objective, data.index / data.total);
  } else if (name === 'drop-released') {
    audio.drop();
    hud.setObjective('Crate away — watch the buoy', 0.5);
  } else if (name === 'drop-hit') {
    audio.hit();
    hud.setObjective('Direct hit on the buoy — sortie complete', 1);
    setTimeout(() => { if (state === 'flying') showDebrief(missions.debrief(plane, 'complete')); }, 900);
  } else if (name === 'drop-miss') {
    hud.setObjective(`Missed by ${Math.round(data.distance)} m — fly the drop again (R)`, 0);
  } else if (name === 'drop-early') {
    hud.setObjective('Too high or too far — get low over the buoy', 0);
  } else if (name === 'sortie-complete') {
    audio.hit();
    hud.setObjective('All gates cleared — sortie complete', 1);
    setTimeout(() => { if (state === 'flying') showDebrief(missions.debrief(plane, 'complete')); }, 900);
  } else if (name === 'landed') {
    audio.thud();
    rig.addShake(0.5);
    hud.setObjective('On the ground — RWY 09', 1);
  }
}

// --- Input actions (edge-triggered).
function handleKeys() {
  const inp = input.state;
  if (input.consume('Enter')) {
    if (state === 'menu' || state === 'debrief') startSortie(sortieIndex);
  }
  if (input.consume('KeyC') && state === 'flying') {
    rig.toggle();
    document.getElementById('cam-ind').textContent = rig.mode === 'chase' ? 'Chase cam' : 'Cockpit';
  }
  if (input.consume('KeyM') && state === 'flying') {
    document.getElementById('bigmap-screen').classList.toggle('hidden');
  }
  if (input.consume('KeyH')) {
    document.getElementById('guide-screen').classList.toggle('hidden');
  }
  if (input.consume('KeyP')) {
    if (state === 'flying') {
      state = 'paused';
      document.getElementById('pause-screen').classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'flying';
      document.getElementById('pause-screen').classList.add('hidden');
    }
  }
  if (input.consume('KeyR') && (state === 'flying' || state === 'debrief' || state === 'paused')) {
    document.getElementById('pause-screen').classList.add('hidden');
    startSortie(sortieIndex);
  }
  if (input.consume('KeyG') && state === 'flying') {
    plane.gearDown = !plane.gearDown;
    aircraft.setGearDown(plane.gearDown);
  }
  if (input.consume('Space') && state === 'flying') {
    missions.tryDrop(plane, (n, d) => handleMissionEvent(n, d));
  }
  if (input.consume('KeyX') && state === 'flying') {
    audio.toggleMute();
  }
  for (let i = 0; i < 4; i++) {
    if (input.consume(`Digit${i + 1}`) && (state === 'menu' || state === 'debrief')) {
      sortieIndex = i;
      buildSortieList();
    }
  }
  if (input.consume('Escape')) {
    if (state === 'flying' || state === 'paused' || state === 'debrief') showMenu();
    document.getElementById('guide-screen').classList.add('hidden');
    document.getElementById('bigmap-screen').classList.add('hidden');
  }
}

// --- Screenshot staging.
function stageShot() {
  if (!shot) return;
  const s = SORTIES[shot.sortie];
  const preset = world.setWeather(s.weather);
  plane = createPlane({
    pos: [...shot.pos], headingDeg: shot.heading, speed: shot.speed, fuel: 100,
  });
  plane.wind = { dirRad: THREE.MathUtils.degToRad(preset.windDir), kt: preset.windKt };
  plane.gearDown = shot.gear;
  missions.start(shot.sortie);
  hud.setSortie(s, shot.sortie + 1, SORTIES.length);
  hud.setWeather(WEATHER[s.weather].label, preset.windKt, preset.windDir);
  hud.setStatus('AIRBORNE');
  hud.setObjective(s.objective, 0);
  aircraft.group.position.copy(plane.pos);
  aircraft.group.quaternion.copy(plane.quat);
  aircraft.setGearDown(plane.gearDown);
  rig.mode = shot.camera;
  rig.snap(plane);
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  state = 'flying';
  if (shot.autopilot) {
    autopilot.enable();
    // Pre-roll: step the game's own flight model, autopilot, landing
    // detection and debrief code synchronously (fixed 0.05 s steps, no
    // rendering) until the landing grades and the debrief opens. The
    // headless software renderer runs at ~1 fps, so reaching the runway
    // in wall time would take minutes; the pre-roll only skips waiting —
    // every number on the debrief screen is computed by the real game.
    let simT = 0;
    for (let i = 0; i < 600 && state === 'flying'; i++) {
      const dt = 0.05;
      simT += dt;
      const inp = input.poll();
      autopilot.steer(plane, inp);
      stepFlight(plane, inp, dt);
      stepRollout(plane, dt);
      missions.update(plane, dt, simT, handleMissionEvent);
      aircraft.group.position.copy(plane.pos);
      aircraft.group.quaternion.copy(plane.quat);
      aircraft.setGearDown(plane.gearDown);
      aircraft.update(dt, plane.throttle, !plane.onGround, plane.altAgl ?? 999);
      rig.update(plane, dt, simT);
      hud.update(plane, dt);
      if ((plane.landed || plane.crashed) && endTimer === 0) endTimer = simT;
      if (plane.landed && simT - endTimer > 1.6) { showDebrief(missions.debrief(plane, 'landed')); break; }
      if (plane.crashed && simT - endTimer > 1.8) { showDebrief(missions.debrief(plane, 'crash')); break; }
    }
  }
}

window.__saltwind = {
  get state() { return state; },
  get frames() { return frames; },
  get plane() { return plane; },
  get missions() { return missions; },
  get shot() { return shot; },
  terrainHeight,
  startSortie,
};

// --- Main loop.
const clock = new THREE.Clock();
let firstFrame = true;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  elapsed = t;
  frames++;

  handleKeys();

  if (state === 'menu') {
    menuAngle += dt * 0.12;
    const r = 26;
    camera.position.set(
      plane.pos.x + Math.cos(menuAngle) * r,
      plane.pos.y + 7 + Math.sin(menuAngle * 0.7) * 2,
      plane.pos.z + Math.sin(menuAngle) * r,
    );
    camera.lookAt(plane.pos.x, plane.pos.y + 1, plane.pos.z);
    camera.fov = 55;
    camera.updateProjectionMatrix();
    aircraft.group.rotation.y = THREE.MathUtils.degToRad(115) + Math.sin(t * 0.3) * 0.02;
  } else if (state === 'flying') {
    const inp = input.poll();
    if (autopilot.enabled) autopilot.steer(plane, inp);
    stepFlight(plane, inp, dt);
    stepRollout(plane, dt);
    missions.update(plane, dt, t, handleMissionEvent);
    aircraft.group.position.copy(plane.pos);
    aircraft.group.quaternion.copy(plane.quat);
    aircraft.setGearDown(plane.gearDown);
    aircraft.update(dt, plane.throttle, !plane.onGround, plane.altAgl ?? 999);
    rig.update(plane, dt, t);
    hud.update(plane, dt);
    const gc = document.getElementById('gauges-canvas');
    if (rig.mode === 'cockpit') {
      gc.classList.remove('hidden');
      document.body.classList.add('cockpit-mode');
      aircraft.setCockpit(true);
      gauges.draw(plane);
    } else {
      gc.classList.add('hidden');
      document.body.classList.remove('cockpit-mode');
      aircraft.setCockpit(false);
    }
    sectorMap.drawMinimap(plane, missions);
    if (!document.getElementById('bigmap-screen').classList.contains('hidden')) {
      sectorMap.drawFull(plane, missions);
    }
    audio.update(plane, dt);
    if (plane.fuel < 15 && !lowFuelAlarmed) { lowFuelAlarmed = true; audio.alarm(); }

    if ((plane.landed || plane.crashed) && endTimer === 0) {
      endTimer = t;
      if (plane.crashed) { audio.crash(); rig.addShake(1); }
    }
    if (plane.landed && t - endTimer > 1.6 && state === 'flying') {
      showDebrief(missions.debrief(plane, 'landed'));
    }
    if (plane.crashed && t - endTimer > 1.8 && state === 'flying') {
      showDebrief(missions.debrief(plane, 'crash'));
    }
  } else if (state === 'debrief') {
    // Gentle orbit around the parked/landed aircraft behind the panel.
    menuAngle += dt * 0.05;
    const r = 24;
    camera.position.set(
      plane.pos.x + Math.cos(menuAngle) * r,
      plane.pos.y + 6,
      plane.pos.z + Math.sin(menuAngle) * r,
    );
    camera.lookAt(plane.pos.x, plane.pos.y + 1, plane.pos.z);
  }

  world.update(t, plane ? plane.wind : { dirRad: 0, kt: 0 });
  renderer.render(scene, camera);
  if (firstFrame) { firstFrame = false; }
}

// --- Buttons.
document.getElementById('fly-btn').addEventListener('click', () => startSortie(sortieIndex));
document.getElementById('fly-again-btn').addEventListener('click', () => startSortie(sortieIndex));
document.getElementById('menu-btn').addEventListener('click', showMenu);
document.getElementById('resume-btn').addEventListener('click', () => {
  state = 'flying';
  document.getElementById('pause-screen').classList.add('hidden');
});
document.getElementById('guide-close').addEventListener('click', () => {
  document.getElementById('guide-screen').classList.add('hidden');
});
document.getElementById('mute-btn').addEventListener('click', (e) => {
  const m = audio.toggleMute();
  e.target.textContent = m ? '🔇' : '🔊';
});
canvas.addEventListener('click', () => audio.unlock());

showMenu();
if (shot) stageShot();
tick();
