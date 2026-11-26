// SALTWIND — Breakwater Air Wing
// config.js — every tunable number, palette, weather preset and sortie definition.
// Nothing here is loaded from the network; the game is fully self-contained.

export const GAME = {
  title: 'SALTWIND',
  subtitle: 'BREAKWATER AIR WING',
  aircraft: 'S-11 SHEARWATER',
  airfield: 'GULL ROCK AIRFIELD',
  runway: 'RWY 09 / 27',
  region: 'THE BREAKWATER ISLES',
};

// Display palette (dark navy panels, amber accents, sea teal).
export const PALETTE = {
  navy: '#0d2137',
  navySoft: '#123049',
  panel: 'rgba(10, 30, 50, 0.82)',
  panelLine: 'rgba(255, 255, 255, 0.14)',
  ink: '#eef6f8',
  dim: '#9db8c4',
  amber: '#f5a623',
  amberSoft: '#ffcf6e',
  teal: '#2fb3a6',
  red: '#ff5a4e',
  green: '#7ddc8a',
};

// Flight model constants (units are metres, metres/second, radians).
export const FLIGHT = {
  maxSpeed: 96, // m/s at full throttle, level flight (~187 kts)
  minSpeed: 20, // below this the wing stops flying and the nose drops
  stallSpeed: 24, // soft stall begins
  cruiseSpeed: 62,
  throttleAccel: 0.55, // how fast speed chases its throttle target (per second)
  climbBleed: 0.55, // speed lost per second per unit of climb slope
  diveGain: 0.45, // speed gained per second per unit of dive slope
  pitchRate: 0.85, // rad/s at full pitch input
  rollRate: 1.9, // rad/s at full roll input
  maxBank: 1.15, // rad, soft bank limit
  turnFromBank: 0.62, // yaw rate per radian of bank
  rudderRate: 0.35, // rad/s at full rudder input
  pitchDamping: 1.6, // nose returns toward level when no input
  rollDamping: 2.2, // wings level themselves when no input
  gravity: 9.81,
  fuelBurnCruise: 0.10, // % fuel per second at cruise throttle
  fuelBurnFull: 0.34, // % fuel per second at full throttle
  maxG: 4.5, // structural limit; beyond it the hull takes damage
  gearSpeedMax: 60, // m/s; gear must be down below this to land
};

// Weather and light presets, one per sortie.
export const WEATHER = {
  golden: {
    label: 'Golden Hour', windDir: 250, windKt: 4,
    skyTop: 0x6fa8d8, skyHorizon: 0xf9c57e, fog: 0xf0c48a, fogNear: 500, fogFar: 1600,
    sunColor: 0xffd9a0, sunIntensity: 2.4, sunPos: [380, 260, -620],
    hemiSky: 0xbfd9e8, hemiGround: 0x4a6b52, hemiIntensity: 1.05,
  },
  noon: {
    label: 'Clear Noon', windDir: 180, windKt: 3,
    skyTop: 0x3f8fd2, skyHorizon: 0xbfe3f2, fog: 0xcfe8f2, fogNear: 600, fogFar: 1800,
    sunColor: 0xfff2d8, sunIntensity: 2.8, sunPos: [200, 700, 100],
    hemiSky: 0xcfe6f2, hemiGround: 0x55704e, hemiIntensity: 1.0,
  },
  mist: {
    label: 'Dawn Mist', windDir: 90, windKt: 7,
    skyTop: 0x8fa9b8, skyHorizon: 0xe6ddd0, fog: 0xd9dee0, fogNear: 260, fogFar: 950,
    sunColor: 0xffe9c4, sunIntensity: 1.9, sunPos: [550, 120, -250],
    hemiSky: 0xd6e2e8, hemiGround: 0x5c6b58, hemiIntensity: 0.85,
  },
  squall: {
    label: 'Sunset Squall', windDir: 140, windKt: 9,
    skyTop: 0x55677c, skyHorizon: 0xe8a86a, fog: 0xd8b28e, fogNear: 420, fogFar: 1300,
    sunColor: 0xffb36b, sunIntensity: 2.1, sunPos: [-500, 110, 420],
    hemiSky: 0xc9b8a4, hemiGround: 0x4e5c4c, hemiIntensity: 0.8,
  },
};

// Runway geometry (metres). RWY 09 points east (+X); heading 090.
export const RUNWAY = {
  centerX: 0, centerZ: 185, length: 300, width: 26, headingDeg: 90,
  elevation: 4, // terrain is flattened to this height on the airfield
};

// The four sorties. Positions are [x, y, z] in world metres; headings in degrees.
export const SORTIES = [
  {
    id: 0, name: 'Ring Run', code: '01',
    objective: 'Clear gate 01 / 06',
    brief: 'Six rings over the bay. Keep the speed up, bank clean through each ring.',
    weather: 'golden',
    start: { pos: [-430, 95, -120], headingDeg: 133, speed: 58, fuel: 100 },
    gates: [
      [-260, 80, 40], [-80, 95, 130], [90, 70, 30], [230, 90, -90],
      [330, 75, -230], [180, 105, -330],
    ],
    gateRadius: 11,
  },
  {
    id: 1, name: 'Beacon Watch', code: '02',
    objective: 'Clear gate 01 / 05',
    brief: 'Five beacon gates along the north ridge. Watch the rock on your left.',
    weather: 'noon',
    start: { pos: [-480, 130, 320], headingDeg: 47, speed: 60, fuel: 100 },
    gates: [
      [-330, 120, 180], [-160, 140, 60], [10, 125, -40], [190, 140, -120],
      [360, 115, -180],
    ],
    gateRadius: 11,
  },
  {
    id: 2, name: 'Harbour Drop', code: '03',
    objective: 'Drop the crate on the buoy',
    brief: 'Fly low over the harbour buoy and press SPACE to release the crate.',
    weather: 'mist',
    start: { pos: [-420, 75, -260], headingDeg: 115, speed: 52, fuel: 100 },
    gates: [[-120, 60, -120]],
    gateRadius: 14,
    drop: { buoy: [190, 0, -70], zoneRadius: 55, successRadius: 26, maxAlt: 130 },
  },
  {
    id: 3, name: 'Final Approach', code: '04',
    objective: 'Recover at Runway 09',
    brief: 'Land on RWY 09. Gear down below 60 m/s, flare gently, keep the sink low.',
    weather: 'squall',
    start: { pos: [-720, 170, 185], headingDeg: 90, speed: 50, fuel: 100 },
    gates: [],
    gateRadius: 11,
    landing: { runway: '09', maxSink: 5.0, maxOffset: 11, maxSpeed: 58 },
  },
];

// Landing grade bands by touchdown sink rate (m/s).
export const LANDING_GRADES = [
  { maxSink: 1.2, grade: 'S', label: 'Silk' },
  { maxSink: 2.4, grade: 'A', label: 'Clean' },
  { maxSink: 3.6, grade: 'B', label: 'Firm' },
  { maxSink: 5.0, grade: 'C', label: 'Rough' },
];

export function knots(ms) { return ms * 1.94384; }
export function feet(m) { return m * 3.28084; }
export function fpm(ms) { return ms * 196.85; }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
