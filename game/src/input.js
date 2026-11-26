// input.js — keyboard + mouse + touch controls for SALTWIND.
// Mouse steers (position relative to screen centre), arrows work too;
// W/S throttle, Q/E rudder, Space drops the crate, C camera, M map, H guide,
// P pause, R restart, Enter flies the selected sortie, 1-4 pick a sortie.

import { clamp } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0, roll: 0, rudder: 0, throttleDelta: 0,
    mouseX: 0, mouseY: 0, mouseActive: false,
    touch: { left: false, right: false, up: false, down: false, thrUp: false, thrDown: false },
    pressed: new Set(), // keys pressed since last consume (edge-triggered actions)
  };

  const KEYMAP = {
    ArrowUp: 'pitchUp', KeyW: 'thrUp', ArrowDown: 'pitchDown', KeyS: 'thrDown',
    ArrowLeft: 'rollLeft', KeyA: 'rollLeft', ArrowRight: 'rollRight', KeyD: 'rollRight',
    KeyQ: 'rudderLeft', KeyE: 'rudderRight',
  };

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys.add(e.code);
    state.pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
    state.mouseY = ((e.clientY - r.top) / r.height) * 2 - 1;
    state.mouseActive = true;
  });
  canvas.addEventListener('mouseleave', () => { state.mouseActive = false; });

  function touchButton(id, on, off) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = (e) => { e.preventDefault(); on(); };
    const end = (e) => { e.preventDefault(); off(); };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
  }
  touchButton('t-left', () => { state.touch.left = true; }, () => { state.touch.left = false; });
  touchButton('t-right', () => { state.touch.right = true; }, () => { state.touch.right = false; });
  touchButton('t-up', () => { state.touch.up = true; }, () => { state.touch.up = false; });
  touchButton('t-down', () => { state.touch.down = true; }, () => { state.touch.down = false; });
  touchButton('t-thr-up', () => { state.touch.thrUp = true; }, () => { state.touch.thrUp = false; });
  touchButton('t-thr-down', () => { state.touch.thrDown = true; }, () => { state.touch.thrDown = false; });

  return {
    state,
    consume(code) {
      if (state.pressed.has(code)) { state.pressed.delete(code); return true; }
      return false;
    },
    // Recompute the analog axes each frame from whatever is held.
    poll() {
      const k = keys;
      let pitch = 0, roll = 0, rudder = 0, thr = 0;
      // Up climbs, down dives (arcade convention: point where you want to go).
      if (k.has('ArrowUp')) pitch += 1;
      if (k.has('ArrowDown')) pitch -= 1;
      if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
      if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
      if (k.has('KeyQ')) rudder -= 1;
      if (k.has('KeyE')) rudder += 1;
      if (k.has('KeyW')) thr += 1;
      if (k.has('KeyS')) thr -= 1;
      if (state.touch.up) pitch += 1;
      if (state.touch.down) pitch -= 1;
      if (state.touch.left) roll -= 1;
      if (state.touch.right) roll += 1;
      if (state.touch.thrUp) thr += 1;
      if (state.touch.thrDown) thr -= 1;
      // Mouse steering blends in gently (it never overrides a hard key input).
      // Mouse up climbs, mouse down dives: point where you want to go.
      if (state.mouseActive) {
        const mx = clamp(state.mouseX, -1, 1);
        const my = clamp(state.mouseY, -1, 1);
        if (Math.abs(mx) > 0.08) roll += mx * 0.85;
        if (Math.abs(my) > 0.08) pitch += -my * 0.7;
      }
      state.pitch = clamp(pitch, -1, 1);
      state.roll = clamp(roll, -1, 1);
      state.rudder = clamp(rudder, -1, 1);
      state.throttleDelta = thr;
      return state;
    },
  };
}
