// flight.js — arcade flight model for the S-11 Shearwater.
// Bank-to-turn with yaw coupling, speed that bleeds in climbs and builds in dives,
// a soft stall, fuel burn, G load, and landing / crash detection against the terrain.

import * as THREE from 'three';
import { FLIGHT, RUNWAY, clamp, lerp } from './config.js';
import { terrainHeight } from './world.js';

const UP = new THREE.Vector3(0, 1, 0);

// Compass heading: 0 = north (-Z), 90 = east (+X), 180 = south (+Z),
// 270 = west (-X). Forward = (sin h, 0, -cos h); three.js yaw is -heading.
export function createPlane(start) {
  const pos = new THREE.Vector3(...start.pos);
  const yaw = -THREE.MathUtils.degToRad(start.headingDeg);
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
  return {
    pos,
    quat,
    speed: start.speed,
    throttle: 0.55,
    fuel: start.fuel,
    hull: 100,
    gearDown: true,
    flaps: 0,
    onGround: false,
    crashed: false,
    landed: false,
    crashCause: '',
    verticalSpeed: 0,
    gLoad: 1,
    bank: 0,
    pitch: 0,
    headingDeg: start.headingDeg,
    wind: { dirRad: 0, kt: 0 },
    sinkAtTouchdown: 0,
    touchdownOffset: 0,
    touchdownSpeed: 0,
  };
}

// Forward vector of the aircraft (local -Z).
export function forwardOf(plane, out = new THREE.Vector3()) {
  return out.set(0, 0, -1).applyQuaternion(plane.quat);
}

export function stepFlight(plane, input, dt) {
  if (plane.crashed || plane.landed) return;

  const fwd = forwardOf(plane);
  const prevY = plane.pos.y;

  // --- Throttle and speed.
  plane.throttle = clamp(plane.throttle + input.throttleDelta * dt * 0.9, 0, 1);
  const targetSpeed = plane.throttle * FLIGHT.maxSpeed;
  let speed = plane.speed + (targetSpeed - plane.speed) * Math.min(1, FLIGHT.throttleAccel * dt);
  // Climb bleeds speed, dives build it.
  speed -= fwd.y * FLIGHT.climbBleed * speed * dt * 0.9;
  speed += (fwd.y < 0 ? -fwd.y : 0) * FLIGHT.diveGain * speed * dt * 0.6;
  speed = clamp(speed, 0, FLIGHT.maxSpeed * 1.08);
  plane.speed = speed;

  // --- Attitude: pitch / roll from input, with damping back toward level.
  const stalled = speed < FLIGHT.stallSpeed;
  const authority = stalled ? 0.45 : 1;
  const pitchInput = clamp(input.pitch, -1, 1) * authority;
  const rollInput = clamp(input.roll, -1, 1) * authority;
  const e = new THREE.Euler().setFromQuaternion(plane.quat, 'YXZ');
  let pitch = e.x, yaw = e.y, roll = e.z;
  pitch += pitchInput * FLIGHT.pitchRate * dt;
  pitch -= pitch * FLIGHT.pitchDamping * 0.35 * dt * (input.pitch === 0 ? 1 : 0.25);
  if (stalled) pitch -= 0.35 * dt; // soft stall: the nose eases down
  pitch = clamp(pitch, -0.9, 0.9);
  roll += rollInput * FLIGHT.rollRate * dt;
  roll -= roll * FLIGHT.rollDamping * 0.5 * dt * (input.roll === 0 ? 1 : 0.2);
  roll = clamp(roll, -FLIGHT.maxBank, FLIGHT.maxBank);
  // Banking turns the aircraft; rudder adds a little direct yaw.
  yaw -= Math.sin(roll) * FLIGHT.turnFromBank * (speed / FLIGHT.cruiseSpeed) * dt;
  yaw -= input.rudder * FLIGHT.rudderRate * dt;
  plane.quat.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  plane.pitch = pitch; plane.bank = roll;

  // --- Wind drift. wind.dirRad is where the wind blows FROM; the push goes
  // toward dir + 180: push = (-sin d, cos d) in (x, z).
  const windPush = plane.wind.kt * 0.514;
  const wx = -Math.sin(plane.wind.dirRad) * windPush;
  const wz = Math.cos(plane.wind.dirRad) * windPush;

  // --- Move.
  const nfwd = forwardOf(plane);
  plane.pos.addScaledVector(nfwd, speed * dt);
  plane.pos.x += wx * dt;
  plane.pos.z += wz * dt;
  plane.verticalSpeed = (plane.pos.y - prevY) / Math.max(dt, 1e-4);

  // --- G load: 1 in level flight, more in banked turns and pulls.
  const pull = Math.abs(pitchInput) * 0.9 + Math.abs(Math.sin(roll)) * 1.4;
  plane.gLoad = 1 + pull * (speed / FLIGHT.cruiseSpeed);
  if (plane.gLoad > FLIGHT.maxG) {
    plane.hull = Math.max(0, plane.hull - (plane.gLoad - FLIGHT.maxG) * 12 * dt);
  }

  // --- Fuel.
  const burn = lerp(FLIGHT.fuelBurnCruise, FLIGHT.fuelBurnFull, plane.throttle);
  plane.fuel = Math.max(0, plane.fuel - burn * dt);
  if (plane.fuel <= 0 && plane.throttle > 0.12) plane.throttle = 0.12; // flame-out glide

  // --- Ground contact.
  const ground = terrainHeight(plane.pos.x, plane.pos.z);
  const altAgl = plane.pos.y - ground;
  plane.altAgl = altAgl;
  plane.headingDeg = ((-THREE.MathUtils.radToDeg(yaw)) % 360 + 360) % 360;

  const onRunway = Math.abs(plane.pos.x - RUNWAY.centerX) < RUNWAY.length / 2
    && Math.abs(plane.pos.z - RUNWAY.centerZ) < RUNWAY.width / 2;
  const aligned = Math.abs(((plane.headingDeg - RUNWAY.headingDeg + 540) % 360) - 180) < 18;

  if (altAgl <= 0.6 && plane.verticalSpeed < -0.5) {
    const sink = -plane.verticalSpeed;
    if (onRunway && aligned && sink <= 5.0 && speed <= 62 && plane.gearDown) {
      // Touchdown.
      plane.landed = true;
      plane.onGround = true;
      plane.sinkAtTouchdown = sink;
      plane.touchdownOffset = Math.abs(plane.pos.z - RUNWAY.centerZ);
      plane.touchdownSpeed = speed;
      plane.pos.y = ground + 0.6;
      if (sink > 3.6) plane.hull = Math.max(40, plane.hull - (sink - 3.6) * 8);
    } else if (onRunway && sink <= 5.0 && speed <= 62 && !plane.gearDown) {
      plane.crashed = true;
      plane.crashCause = 'Belly landing — the gear was up.';
    } else if (altAgl <= 0.2) {
      plane.crashed = true;
      plane.crashCause = sink > 8
        ? 'Terrain impact — the descent was too steep.'
        : 'Terrain impact — the Shearwater met the ground.';
      plane.pos.y = ground + 0.4;
    }
  }

  // Keep the aircraft inside the world.
  const R = 1150;
  const r = Math.hypot(plane.pos.x, plane.pos.z);
  if (r > R) {
    const s = R / r;
    plane.pos.x *= s; plane.pos.z *= s;
  }
  plane.pos.y = clamp(plane.pos.y, 0.5, 900);
}

// Roll-out after a landing: bleed speed on the runway.
export function stepRollout(plane, dt) {
  if (!plane.landed) return;
  plane.speed = Math.max(0, plane.speed - 14 * dt);
  const fwd = forwardOf(plane);
  plane.pos.addScaledVector(fwd, plane.speed * dt);
  plane.verticalSpeed = 0;
  const ground = terrainHeight(plane.pos.x, plane.pos.z);
  plane.pos.y = ground + 0.6;
}
