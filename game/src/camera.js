// camera.js — chase and cockpit cameras. The chase camera trails with lag and
// banks with the aircraft; the cockpit camera sits at the pilot's eye. FOV
// stretches with speed, and a hard landing shakes the frame.

import * as THREE from 'three';
import { clamp, lerp } from './config.js';
import { forwardOf } from './flight.js';

export function createCameraRig(camera) {
  const chasePos = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let shake = 0;
  let fov = 62;

  return {
    mode: 'chase', // 'chase' | 'cockpit'
    toggle() { this.mode = this.mode === 'chase' ? 'cockpit' : 'chase'; },
    addShake(amount) { shake = Math.min(1.2, shake + amount); },
    update(plane, dt, t) {
      const fwd = forwardOf(plane);
      const targetFov = 62 + clamp(plane.speed / 96, 0, 1) * 13;
      fov = lerp(fov, targetFov, Math.min(1, dt * 2));
      camera.fov = fov;
      camera.updateProjectionMatrix();
      shake = Math.max(0, shake - dt * 1.4);

      if (this.mode === 'cockpit') {
        // Pilot's eye: ahead of the canopy and above the nose line, so the
        // nose is a sliver at the bottom and the runway stays in view.
        desired.copy(plane.pos).addScaledVector(fwd, 2.7);
        desired.y += 1.4;
        camera.position.lerp(desired, Math.min(1, dt * 18));
        lookAt.copy(plane.pos).addScaledVector(fwd, 60);
        lookAt.y += plane.pitch * 18 - 1.5;
        camera.up.copy(up);
        camera.lookAt(lookAt);
      } else {
        // Chase: behind and above, eased toward the desired spot.
        desired.copy(plane.pos).addScaledVector(fwd, -13.5);
        desired.y += 4.2;
        const k = 1 - Math.exp(-dt * 4.2);
        chasePos.lerp(desired, k);
        // Bank the camera a little with the aircraft so turns feel connected.
        const bankedUp = up.clone().applyAxisAngle(fwd, plane.bank * 0.35);
        camera.position.copy(chasePos);
        lookAt.copy(plane.pos).addScaledVector(fwd, 12);
        lookAt.y += 0.5;
        camera.up.copy(bankedUp);
        camera.lookAt(lookAt);
      }

      if (shake > 0.01) {
        camera.position.x += (Math.random() - 0.5) * shake * 0.5;
        camera.position.y += (Math.random() - 0.5) * shake * 0.5;
      }
    },
    snap(plane) {
      const fwd = forwardOf(plane);
      chasePos.copy(plane.pos).addScaledVector(fwd, -13.5);
      chasePos.y += 4.2;
      camera.position.copy(chasePos);
    },
  };
}
