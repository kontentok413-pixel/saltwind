// missions.js — sortie logic: gate rings, the harbour supply drop, landing
// grading and the debrief. One sortie at a time; the main loop owns the plane.

import * as THREE from 'three';
import { SORTIES, WEATHER, LANDING_GRADES, RUNWAY, clamp } from './config.js';
import { terrainHeight } from './world.js';

function ringMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xf5a623, emissive: 0xf5a623, emissiveIntensity: 0.85,
    roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0.95,
    side: THREE.DoubleSide,
  });
}

export function createMissions(scene) {
  const group = new THREE.Group();
  group.name = 'mission';
  scene.add(group);
  let ringMeshes = [];
  let buoy = null;
  let crate = null;
  let crateState = null; // { vel, chute }
  let current = null;
  let gateIndex = 0;
  let startTime = 0;
  let elapsedSec = 0;
  let score = 0;
  let dropDone = false;
  let landingGraded = false;

  function clearVisuals() {
    for (const m of ringMeshes) { group.remove(m); m.geometry.dispose(); m.material.dispose(); }
    ringMeshes = [];
    if (buoy) { group.remove(buoy); buoy = null; }
    if (crate) { group.remove(crate); crate = null; }
    crateState = null;
  }

  function makeRing(x, y, z, radius, headingDeg) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.55, 10, 40), ringMaterial());
    ring.position.set(x, y, z);
    // Face the incoming aircraft: ring plane perpendicular to the sortie heading.
    ring.rotation.y = THREE.MathUtils.degToRad(headingDeg) + Math.PI / 2;
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(radius - 0.8, 32),
      new THREE.MeshBasicMaterial({ color: 0xf5a623, transparent: true, opacity: 0.07, side: THREE.DoubleSide }),
    );
    ring.add(inner);
    group.add(ring);
    return ring;
  }

  function makeBuoy(x, z) {
    const b = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.8, 1.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.6 }),
    );
    base.position.y = 0.4;
    b.add(base);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 4.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }),
    );
    mast.position.y = 3;
    b.add(mast);
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc94d, emissiveIntensity: 2 }),
    );
    light.position.y = 5.4;
    b.add(light);
    b.position.set(x, 0, z);
    group.add(b);
    return b;
  }

  function dropCrate(plane) {
    const c = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 }),
    );
    c.add(box);
    const chute = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1.6, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.8, side: THREE.DoubleSide }),
    );
    chute.position.y = 2.6;
    c.add(chute);
    c.position.copy(plane.pos);
    group.add(c);
    crate = c;
    crateState = { vel: new THREE.Vector3(0, -2, 0), landed: false };
    return c;
  }

  return {
    get current() { return current; },
    get gateIndex() { return gateIndex; },
    get gates() { return current ? current.gates : []; },
    get dropBuoy() { return current && current.drop ? current.drop.buoy : null; },
    get score() { return score; },
    // Sortie time accumulates simulated seconds, not wall time, so a
    // pre-rolled autopilot landing still reports the time it actually flew.
    get elapsed() { return current ? elapsedSec : 0; },

    start(sortieId) {
      clearVisuals();
      current = SORTIES[sortieId];
      gateIndex = 0;
      score = 0;
      dropDone = false;
      landingGraded = false;
      elapsedSec = 0;
      startTime = performance.now();
      const heading = current.start.headingDeg;
      current.gates.forEach(([x, y, z]) => {
        ringMeshes.push(makeRing(x, y, z, current.gateRadius, heading));
      });
      if (current.drop) buoy = makeBuoy(current.drop.buoy[0], current.drop.buoy[2]);
      return current;
    },

    abort() {
      clearVisuals();
      current = null;
    },

    // Called every frame while flying. Returns an event string or ''.
    update(plane, dt, t, onEvent) {
      if (!current) return '';
      elapsedSec += dt;
      // Animate the next ring (pulse) and the buoy light.
      if (ringMeshes[gateIndex]) {
        const s = 1 + Math.sin(t * 4) * 0.05;
        ringMeshes[gateIndex].scale.setScalar(s);
      }
      if (buoy) buoy.position.y = Math.sin(t * 1.4) * 0.25;
      if (crate && crateState && !crateState.landed) {
        crateState.vel.y = Math.max(-6, crateState.vel.y - 3 * dt);
        crate.position.addScaledVector(crateState.vel, dt);
        crate.position.x += Math.sin(t * 2) * 0.1 * dt;
        if (crate.position.y <= 0.8) {
          crateState.landed = true;
          crate.position.y = 0.8;
          const d = Math.hypot(crate.position.x - current.drop.buoy[0], crate.position.z - current.drop.buoy[2]);
          if (d <= current.drop.successRadius) {
            score += 600;
            dropDone = true;
            onEvent('drop-hit', { distance: d });
            return 'drop-hit';
          }
          onEvent('drop-miss', { distance: d });
          return 'drop-miss';
        }
      }
      // Gate passing.
      if (gateIndex < current.gates.length) {
        const [gx, gy, gz] = current.gates[gateIndex];
        const d = Math.hypot(plane.pos.x - gx, plane.pos.y - gy, plane.pos.z - gz);
        if (d < current.gateRadius * 0.85) {
          score += 200;
          const ring = ringMeshes[gateIndex];
          if (ring) {
            ring.material = ring.material.clone();
            ring.material.color.setHex(0x7ddc8a);
            ring.material.emissive.setHex(0x7ddc8a);
          }
          gateIndex++;
          onEvent('gate', { index: gateIndex, total: current.gates.length });
          if (gateIndex >= current.gates.length && !current.drop && !current.landing) {
            onEvent('sortie-complete', {});
            return 'sortie-complete';
          }
          return 'gate';
        }
      }
      // Landing sortie: grade on touchdown.
      if (current.landing && plane.landed && !landingGraded) {
        landingGraded = true;
        const sink = plane.sinkAtTouchdown;
        const band = LANDING_GRADES.find((b) => sink <= b.maxSink) || LANDING_GRADES[LANDING_GRADES.length - 1];
        const offsetPenalty = Math.min(200, plane.touchdownOffset * 8);
        const fuelBonus = Math.round(plane.fuel * 2);
        const gained = 400 + (band.grade === 'S' ? 500 : band.grade === 'A' ? 350 : band.grade === 'B' ? 200 : 80)
          + fuelBonus - Math.round(offsetPenalty);
        score += Math.max(100, gained);
        onEvent('landed', { grade: band.grade, label: band.label, sink, offset: plane.touchdownOffset, gained: Math.max(100, gained) });
        return 'landed';
      }
      return '';
    },

    tryDrop(plane, onEvent) {
      if (!current || !current.drop || dropDone || crate) return false;
      const d = Math.hypot(plane.pos.x - current.drop.buoy[0], plane.pos.z - current.drop.buoy[2]);
      if (d > current.drop.zoneRadius || plane.pos.y > current.drop.maxAlt) {
        onEvent('drop-early', { distance: d });
        return false;
      }
      dropCrate(plane);
      onEvent('drop-released', {});
      return true;
    },

    // Debrief data for the end-of-sortie screen.
    debrief(plane, outcome) {
      const time = this.elapsed;
      const fuelBonus = Math.round(plane.fuel * 2);
      const hullBonus = Math.round(plane.hull * 1.5);
      let grade = 'B';
      if (outcome === 'landed') {
        const sink = plane.sinkAtTouchdown;
        grade = (LANDING_GRADES.find((b) => sink <= b.maxSink) || { grade: 'C' }).grade;
      } else if (outcome === 'complete') {
        grade = plane.hull >= 95 && plane.fuel >= 40 ? 'A' : 'B';
        if (plane.hull >= 99 && plane.fuel >= 60 && time < 150) grade = 'S';
      } else if (outcome === 'crash') {
        grade = '—';
      }
      return {
        sortie: current,
        outcome, // 'landed' | 'complete' | 'crash' | 'quit'
        grade,
        score: score + (outcome === 'complete' ? fuelBonus + hullBonus : 0),
        sink: plane.sinkAtTouchdown,
        fuel: Math.round(plane.fuel),
        hull: Math.round(plane.hull),
        time: Math.round(time),
        crashCause: plane.crashCause,
      };
    },
  };
}
