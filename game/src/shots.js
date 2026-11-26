// shots.js — deterministic screenshot setups for the maker's own screenshots.
// A shot starts a real sortie of the real game (or flies it with a small
// autopilot for the debrief shot) and exposes window.__saltwind so the
// screenshot script knows when the frame is ready. Nothing here edits the
// game: every screenshot is a render of the game's own code.

import { clamp, RUNWAY } from './config.js';

// Per-shot staging: which sortie, where the aircraft starts, which camera.
// Staged close to the action: the headless renderer runs at a few frames a
// second, so the sim advances slowly in wall time and the aircraft must start
// near its subject.
const SHOTS = {
  cover: { sortie: 0, camera: 'chase', pos: [-330, 85, -30], heading: 133, speed: 58, gear: false, waitMs: 2600 },
  cockpit: { sortie: 3, camera: 'cockpit', pos: [-420, 92, 185], heading: 90, speed: 50, gear: true, waitMs: 3000 },
  debrief: { sortie: 3, camera: 'chase', pos: [-350, 22, 185], heading: 90, speed: 50, gear: true, autopilot: true, waitMs: 0 },
  drop: { sortie: 2, camera: 'chase', pos: [-160, 70, -210], heading: 115, speed: 54, gear: false, waitMs: 2400 },
};

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const name = q.get('shot');
  if (!name || !SHOTS[name]) return null;
  return { name, ...SHOTS[name], sortie: Number(q.get('sortie') ?? SHOTS[name].sortie) };
}

// Tiny glidepath autopilot used only for the debrief screenshot: it holds the
// approach to RWY 09 and flares, so the game's own landing detection grades
// the touchdown and opens the real debrief screen.
export function createAutopilot() {
  let active = false;
  return {
    enable() { active = true; },
    get enabled() { return active; },
    steer(plane, input) {
      if (!active) return;
      // Desired altitude on a gentle 3-degree glidepath aimed at the runway
      // centre (0, 4), so the touchdown falls well inside the strip.
      // Staged on the path at (-350, 22), so the sink stays near 2.5 m/s.
      const distToThreshold = Math.max(0, 0 - plane.pos.x);
      const desiredAlt = 4 + distToThreshold * 0.052;
      const altErr = desiredAlt - plane.pos.y;
      const vs = plane.verticalSpeed;
      // Pitch to track the glidepath; throttle to hold 44 m/s.
      input.pitch = clamp(altErr * 0.045 - vs * 0.02, -0.6, 0.6);
      // Lateral guidance: the squall crosswind pushes the aircraft off the
      // centreline, so bank toward a heading that re-intercepts it. A pure
      // proportional loop leaves a steady offset against a constant wind,
      // so add a feedforward crab angle that cancels the wind's cross-track
      // push outright (same vector the flight model applies).
      const windPush = (plane.wind?.kt ?? 0) * 0.514;
      const wz = Math.cos(plane.wind?.dirRad ?? 0) * windPush;
      const crab = (Math.asin(clamp(-wz / Math.max(20, plane.speed), -0.5, 0.5)) * 180) / Math.PI;
      const zErr = RUNWAY.centerZ - plane.pos.z;
      const wantHeading = 90 + crab + clamp(zErr * 0.2, -12, 12);
      const hdgErr = ((wantHeading - plane.headingDeg + 540) % 360) - 180;
      input.roll = clamp(hdgErr * 0.04 - plane.bank * 1.2, -0.5, 0.5);
      input.rudder = 0;
      const speedErr = 44 - plane.speed;
      input.throttleDelta = clamp(speedErr * 0.06, -1, 1);
      // No flare: the 3-degree glidepath already brings the sink to about
      // 2.3 m/s, inside the A band. A pitch-up flare only balloons the
      // aircraft and drops it harder once the window ends (measured: the
      // +0.15 and +0.2 flares both landed worse than the clean glidepath).
      plane.gearDown = true;
    },
  };
}
