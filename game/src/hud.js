// hud.js — the SALTWIND heads-up display: speed, altitude, heading tape,
// throttle, fuel, hull, G, wind, objective and warnings. All DOM + one canvas
// for the compass tape; values update every frame from the flight state.

import { knots, feet, fpm, clamp } from './config.js';

function el(id) { return document.getElementById(id); }

function setBar(id, pct, warnAt = 25) {
  const bar = el(id);
  if (!bar) return;
  bar.style.width = `${clamp(pct, 0, 100).toFixed(1)}%`;
  bar.classList.toggle('low', pct <= warnAt);
}

export function createHud() {
  const compass = el('compass-tape');
  const ctx = compass ? compass.getContext('2d') : null;

  function drawCompass(headingDeg) {
    if (!ctx) return;
    const w = compass.width, h = compass.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10, 30, 50, 0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pxPerDeg = 3.2;
    const centre = w / 2;
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round(((headingDeg + d) % 360 + 360) % 360);
      const x = centre + d * pxPerDeg;
      const major = deg % 30 === 0;
      ctx.strokeStyle = major ? '#eef6f8' : 'rgba(238,246,248,0.45)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, h - 8);
      ctx.lineTo(x, h - (major ? 22 : 15));
      ctx.stroke();
      if (major) {
        const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
        ctx.fillStyle = '#eef6f8';
        ctx.fillText(label, x, 10);
      }
    }
    // Centre caret.
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(centre - 7, 0); ctx.lineTo(centre + 7, 0); ctx.lineTo(centre, 9);
    ctx.closePath(); ctx.fill();
  }

  let lastWarn = '';
  return {
    setSortie(sortie, index, total) {
      const code = el('sortie-code'); if (code) code.textContent = `SORTIE ${sortie.code} / 0${total}`;
      const name = el('sortie-name'); if (name) name.textContent = sortie.name;
      const obj = el('sortie-objective'); if (obj) obj.textContent = '◇ ' + sortie.objective;
    },
    setObjective(text, pct) {
      const obj = el('sortie-objective'); if (obj) obj.textContent = '◇ ' + text;
      const fill = el('objective-fill'); if (fill) fill.style.width = `${clamp(pct * 100, 0, 100)}%`;
    },
    setWeather(label, windKt, windDirDeg) {
      const w = el('weather-label'); if (w) w.textContent = label;
      const wn = el('wind-label'); if (wn) wn.textContent = `↗ ${windKt} KT`;
    },
    setStatus(text) { const s = el('status-pill'); if (s) s.textContent = text; },
    setGear(down) { const g = el('gear-ind'); if (g) g.textContent = down ? 'GEAR DN' : 'GEAR UP'; },
    setFlaps(pct) { const f = el('flaps-ind'); if (f) f.textContent = `FLP ${pct}°`; },
    warn(text) {
      const w = el('warn-banner');
      if (!w) return;
      if (text !== lastWarn) {
        lastWarn = text;
        w.textContent = text;
        w.style.opacity = text ? '1' : '0';
      }
    },
    update(plane, dt) {
      const spd = el('hud-spd'); if (spd) spd.textContent = String(Math.round(knots(plane.speed)));
      const thr = el('hud-thr'); if (thr) thr.textContent = `THR ${Math.round(plane.throttle * 100)}%`;
      const alt = el('hud-alt'); if (alt) alt.textContent = String(Math.round(feet(plane.pos.y)));
      const vsi = el('hud-vsi');
      if (vsi) {
        const v = Math.round(fpm(plane.verticalSpeed));
        vsi.textContent = `${v >= 0 ? '▲' : '▼'} ${Math.abs(v)} FPM`;
      }
      const hdg = el('hud-hdg'); if (hdg) hdg.textContent = `${String(Math.round(plane.headingDeg)).padStart(3, '0')}°`;
      drawCompass(plane.headingDeg);
      setBar('fuel-fill', plane.fuel, 20);
      const fuelTxt = el('fuel-val'); if (fuelTxt) fuelTxt.textContent = `${Math.round(plane.fuel)}%`;
      setBar('hull-fill', plane.hull, 40);
      const hullTxt = el('hull-val'); if (hullTxt) hullTxt.textContent = `${Math.round(plane.hull)}%`;
      const g = el('g-val'); if (g) g.textContent = `${plane.gLoad.toFixed(1)} G`;
      this.setGear(plane.gearDown);
      // Warnings.
      if (plane.fuel <= 0) this.warn('⚠ FUEL EMPTY — GLIDING');
      else if (plane.fuel < 20) this.warn('⚠ LOW FUEL');
      else if (plane.speed < 24 && !plane.onGround && !plane.landed) this.warn('⚠ STALL — NOSE DOWN, ADD THROTTLE');
      else if (plane.hull < 40) this.warn('⚠ AIRFRAME DAMAGE');
      else this.warn('');
    },
  };
}
