# SALTWIND — Breakwater Air Wing

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/kontentok413-pixel/saltwind/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/kontentok413-pixel/saltwind/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Entry for the make.fun bounty **"Make the best flight game"**
([best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057)).

Fly the S-11 "Shearwater" turboprop over the Breakwater Isles: four sorties,
chase and cockpit cameras, a live sector map, fuel and hull to manage, and a
graded landing on Gull Rock's RWY 09. The whole game is static files under
`game/` — three.js is vendored as `game/vendor/three.module.min.js`, the
terrain, aircraft, sky and landmarks are all procedural, and the sounds are
synthesised with WebAudio. No network requests, no build step.

## The four sorties

1. **Ring Run** (golden hour) — clear 6 rings over the bay.
2. **Beacon Watch** (clear noon) — 5 beacon gates along the north ridge.
3. **Harbour Drop** (dawn mist) — fly low over the buoy, press SPACE to drop
   the crate on it.
4. **Final Approach** (sunset squall) — land on RWY 09 in a crosswind; the
   touchdown is graded on sink rate, centreline and touchdown zone.

## Controls

- **W / S** — throttle up / down
- **Mouse / ← →** — roll (bank to turn)
- **Mouse / ↑ ↓** — pitch (climb / dive)
- **Q / E** — rudder
- **SPACE** — drop the crate (Harbour Drop)
- **C** — chase / cockpit camera
- **G** — landing gear
- **M** — sector map
- **H** — flight guide
- **P** — pause, **R** — restart sortie, **1–4** — pick a sortie, **ESC** — menu

## Run it

```sh
node serve.ts
# open http://localhost:8080/ — or serve game/ with any static server
```

Or open `game/index.html` through a static server of your choice; the game
loads no network resources.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# out/ holds game/, screenshots/ and dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=x941ctam&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
