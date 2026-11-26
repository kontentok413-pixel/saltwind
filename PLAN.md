# SALTWIND — Breakwater Air Wing — build plan

Bounty: Make the best flight game (best-flight-game-20261126-0057, $500 USDC).
Entries close 2026-11-28 07:57 WIB. Result due 2026-12-14. Blind rounds: 4.
Account: make.fun @zaki-alawi (verified connected 2026-11-26). GitHub owner kontentok413-pixel.

## Research notes (2026-11-26)
- What wins this judge: screenshots first (cover large on top of the contact sheet),
  then a short source outline. Criterion 1 is a complete flight game visible in the
  screenshots: chase or cockpit view over recognisable terrain, aircraft in frame with
  instruments lit, runway or target ring ahead, altitude/speed/heading on the HUD.
- Good browser flight games (DRIFTWING, Sky Patrol): mouse steers pitch/roll,
  W/S throttle, banking turns induce yaw, speed bleeds in climbs and builds in dives,
  soft stall (nose eases down, never a tumble), chase cam with lag that banks with the
  plane, FOV stretches with speed, seeded low-poly terrain, landmarks (lighthouse),
  time-of-day variety, working cockpit gauges.
- Rules that shape the build: game/ is static files, no build step, no network
  requests; any library vendored as *.min.js under a vendor/ dir; main.ts (Node 22,
  stdlib only) copies game/ + screenshots/ to /output and writes dossier.json with
  buildDossier from vendor/makefun-game.ts (kit copy, unchanged); screenshots 3-4,
  each <=256 KiB, long side <=1280, short side >=480, first by name is the cover;
  hosted top-10 sites block eval/new Function and data: scripts, so no eval anywhere.

## Original identity (invented here, never the reference's names)
- Title: SALTWIND — Breakwater Air Wing.
- Aircraft: S-11 "Shearwater" turboprop (white + teal + amber livery).
- Place: the Breakwater Isles, home field Gull Rock Airfield, runway RWY 09/27.
- Reference images (artifact*.webp) are style reference only: low-poly coastal
  archipelago, HUD, sortie select, debrief. No names/text/branding copied.

## Game design
- Arcade flight model: throttle 0-100% (W/S or Shift/Ctrl), pitch/roll on mouse
  (pointer) or arrows, bank-to-turn with yaw coupling, speed bleeds in climbs,
  soft stall below min speed, G load, fuel burn by throttle, hull damage on hard
  impacts. Crash = debrief with cause; landing = graded touchdown.
- Cameras: chase (default) and cockpit (C), both with lag/bank; FOV widens with speed.
- HUD: speed (kts), altitude (ft), heading compass tape, throttle %, fuel, hull,
  G, wind, next-gate distance, sortie objective. Cockpit view adds lit analog
  gauges (airspeed, altimeter, attitude, VSI, compass) drawn on canvas.
- Sector map: live minimap (canvas) + full map overlay (M) with route, gates,
  runway, aircraft marker.
- Weather/time per sortie: golden hour, clear noon, dawn mist, sunset squall
  (wind + gusts). Engine hum + wind via procedural WebAudio (no audio files).
- 4 sorties (select screen, Enter to fly):
  1. Ring Run — clear 6 rings over the bay (golden hour).
  2. Beacon Watch — 5 beacon gates along the ridge (clear noon).
  3. Harbour Drop — fly low over the buoy, press Space to drop the crate in the
     zone (dawn mist).
  4. Final Approach — land on RWY 09, graded on sink rate, centreline and
     touchdown zone (sunset squall, crosswind).
- Debrief screen after each sortie: grade (S/A/B/C), touchdown sink, fuel left,
  flight score, airframe %, sortie select to fly again.
- Pause (P), flight guide (H), mute, restart (R).

## World (all procedural, no external assets)
- Seeded value-noise heightmap terrain (256x256), vertex-coloured flat-shaded
  low-poly: grass hills, sandy beaches, rocky grey peaks with snow caps, sea plane.
- Landmarks: striped lighthouse on Gull Rock, stone arch bridge, harbour village
  (instanced houses), pine forests (instanced cones), hangars + control tower at
  the airfield, runway with markings + PAPI lights, drifting cloud puffs, gulls.

## Tech / files (one clear job each)
- game/index.html — page, HUD DOM, import map (three -> ./vendor/three.module.min.js)
- game/style.css — HUD/menu/debrief styling (dark navy + amber, original)
- game/vendor/three.module.min.js — vendored three.js (min build, not our source)
- game/src/config.js — constants, sortie definitions, palette
- game/src/random.js — seeded RNG + value noise (deterministic terrain)
- game/src/world.js — terrain, sea, islands, buildings, runway, clouds, landmarks
- game/src/aircraft.js — Shearwater model from primitives + prop + nav lights
- game/src/flight.js — arcade flight model, stall, landing/crash detection
- game/src/camera.js — chase + cockpit cameras, FOV kick, shake
- game/src/hud.js — HUD DOM updates, compass tape, warnings
- game/src/gauges.js — cockpit analog gauges (canvas)
- game/src/map.js — minimap + full sector map (canvas)
- game/src/missions.js — sortie logic, gates, drop, landing grading, debrief data
- game/src/audio.js — procedural WebAudio engine/wind/chime (no files)
- game/src/input.js — keyboard + mouse + touch buttons
- game/src/shots.js — deterministic screenshot setups (?shot=...&sortie=N)
- game/src/main.js — boot, game loop, state machine (menu/fly/pause/debrief)
- main.ts — hand-written entrypoint: copy game/ + screenshots/, write dossier.json
- vendor/makefun-game.ts — kit copy, unchanged
- serve.ts — tiny dev static server (local testing only)
- LICENSE (MIT), README.md (badges + run instructions), PLAN.md (this file)

## Screenshots (4, 1280x720 JPEG, real renders via headless Chrome)
1. 1-cover.jpg — chase view, Ring Run, golden hour, gate ring ahead, HUD.
2. 2-cockpit.jpg — cockpit view, Final Approach, runway ahead, gauges lit.
3. 3-debrief.jpg — debrief screen after a graded landing (grade A).
4. 4-drop.jpg — chase view, Harbour Drop, harbour + bridge + village, ring ahead.

## Play-test log (2026-11-26, headless Chrome, SwiftShader ~1-5 fps)
- Menu, HUD, minimap, compass tape all render; 0 console errors (4 warnings are
  SwiftShader "GPU stall due to ReadPixels" performance notices, not app errors).
- Zero network requests: 17 local files only (test 1).
- Heading convention fixed: compass 0 = north (-Z), 90 = east (+X); forward =
  (sin h, 0, -cos h); three.js yaw = -heading. Before the fix, heading 90 flew west.
- Sky-dome sun glow fixed: the shader now takes the direction from the camera
  (vWorld - cameraPosition), not from the dome's centre at the world origin,
  which had painted a giant pale circle in the sky.
- Cockpit view fixed: camera moved up/forward (eye +2.7 fwd, +1.4 up) so the nose
  is a sliver; prop blades hidden in cockpit mode (they read as black bars);
  gauges rewritten as true clock-position dials with the digital readout clear
  of the tick labels; HUD airframe/map/bottom bar hidden in cockpit mode.
- Approach corridor graded in world.js: the 29 m hill 350 m west of RWY 09 is
  cut to field level along the extended centreline (only where the ground is
  already above water, so the coastline is unchanged); a 3-degree final from
  the sea is now possible. Terrain probe confirmed flat 4 m from x=-550 to the
  runway, sea untouched west of x=-600.
- Debrief autopilot (shots.js) flies a 3-degree glidepath to the runway centre
  with a feedforward crab angle that cancels the squall crosswind (a pure
  proportional loop left a 27-38 m steady offset and crashed off the strip).
  No flare: measured flares (+0.15, +0.2) both landed harder than the clean
  glidepath. Result: touchdown sink 2.02 m/s, grade A, on centreline (z=188).
- Debrief shot uses a synchronous pre-roll in main.js: it steps the game's own
  flight model, autopilot, landing detection and debrief code (fixed 0.05 s
  steps, no rendering) until the landing grades. It only skips wall-clock
  waiting under the ~1 fps software renderer; every number on the debrief
  screen is computed by the real game. Mission elapsed time accumulates
  simulated seconds (missions.js) so the pre-roll reports the time flown
  (0:10), and the stall warning is suppressed on the ground (hud.js).
- Screenshots are taken with chrome-headless-shell --screenshot (the Playwright
  MCP screenshot call times out at 5 s while the page renders at ~1 fps);
  converted to JPEG quality 88, all 105-130 KB, under the 256 KiB cap.

## Verification checklist
- [x] Serves offline, zero network requests (17 local files, test 1).
- [x] Loads with no console errors; HUD values update live (SPD/ALT/HDG verified).
- [x] Sortie completable end to end: autopilot landing grades A, debrief shows
      grade + stats + sortie select; crash path verified (hill impact, then fixed).
- [x] Screenshots are real renders (headless Chrome, 1280x720), each <=256 KiB.
- [x] MAKEFUN_OUTPUT_DIR=out node main.ts writes out/{game,screenshots,dossier.json};
      dossier byte-matches a rebuild (verified 2026-11-26); dossier text 114,969
      bytes under the 160 KiB cap; game/ 17 files, 796 KB under caps.
- [x] No eval/new Function, no data: scripts, no cookies/service worker.
- [x] 2-cockpit.jpg captured via Playwright MCP 2026-11-26 13:49 WIB (the CLI
      --screenshot run hung twice on the cockpit view; MCP worked on retry).
- [x] Real key-press control test 2026-11-26 13:52 WIB: menu -> Enter -> flying
      (sortie active) -> C -> cockpit gauges visible -> P -> paused with pause
      screen; 0 console errors.
