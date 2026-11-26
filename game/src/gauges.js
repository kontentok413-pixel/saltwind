// gauges.js — lit analog cockpit instruments, drawn on one canvas:
// airspeed, attitude (artificial horizon), altimeter, vertical speed and compass.
// Shown only in cockpit view, over the lower half of the screen.
// Angles are clock positions: 0 degrees is 12 o'clock, clockwise positive.

import { knots, feet, fpm, clamp } from './config.js';

export function createGauges(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  function polar(cx, cy, r, deg) {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
  }

  // Linear dial: value maps to -120..+120 degrees. Ticks at the five cardinals
  // only, labels outside the face; the digital readout sits below the hub,
  // clear of every tick.
  function dial(cx, cy, r, label, valueText, min, max, value, tickLabels, unit) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1a28'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#3a5a74'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(238,246,248,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    // Ticks + labels.
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [deg, text] of tickLabels) {
      const [x1, y1] = polar(0, 0, r - 7, deg);
      const [x2, y2] = polar(0, 0, r - 15, deg);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#cfe0e8'; ctx.lineWidth = 1.5; ctx.stroke();
      if (text !== '') {
        const [lx, ly] = polar(0, 0, r - 27, deg);
        ctx.fillStyle = '#cfe0e8';
        ctx.fillText(text, lx, ly);
      }
    }
    // Needle.
    const f = clamp((value - min) / (max - min), 0, 1);
    const na = -120 + f * 240;
    const [nx, ny] = polar(0, 0, r - 18, na);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f5a623'; ctx.fill();
    // Digital readout below the hub, unit beneath it.
    ctx.fillStyle = '#eef6f8';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(valueText, 0, r * 0.48);
    if (unit) {
      ctx.fillStyle = '#9db8c4';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillText(unit, 0, r * 0.72);
    }
    // Label above the dial face.
    ctx.fillStyle = '#9db8c4';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillText(label, 0, -r - 11);
    ctx.restore();
  }

  // True compass dial: N at 12 o'clock, needle at the heading.
  function compassDial(cx, cy, r, headingDeg) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1a28'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#3a5a74'; ctx.stroke();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cards = [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']];
    for (const [deg, text] of cards) {
      const [x1, y1] = polar(0, 0, r - 7, deg);
      const [x2, y2] = polar(0, 0, r - 15, deg);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#cfe0e8'; ctx.lineWidth = 1.5; ctx.stroke();
      const [lx, ly] = polar(0, 0, r - 27, deg);
      ctx.fillStyle = deg === 0 ? '#f5a623' : '#cfe0e8';
      ctx.fillText(text, lx, ly);
    }
    const [nx, ny] = polar(0, 0, r - 18, headingDeg);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f5a623'; ctx.fill();
    ctx.fillStyle = '#eef6f8';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, 0, r * 0.48);
    ctx.fillStyle = '#9db8c4';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillText('HEADING', 0, -r - 11);
    ctx.restore();
  }

  function attitude(cx, cy, r, pitch, bank, headingDeg) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    ctx.rotate(-bank);
    const py = clamp(pitch, -0.6, 0.6) * r * 1.4;
    ctx.fillStyle = '#3f8fd2'; ctx.fillRect(-r, -r - py, r * 2, r + py);
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(-r, -py, r * 2, r + py + 1);
    ctx.strokeStyle = '#eef6f8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r, -py); ctx.lineTo(r, -py); ctx.stroke();
    ctx.lineWidth = 1;
    for (const off of [-0.35, -0.18, 0.18, 0.35]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, -py + off * r);
      ctx.lineTo(r * 0.35, -py + off * r);
      ctx.stroke();
    }
    ctx.restore();
    // Fixed aircraft symbol.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0); ctx.lineTo(-r * 0.12, 0);
    ctx.moveTo(r * 0.12, 0); ctx.lineTo(r * 0.5, 0);
    ctx.moveTo(0, -4); ctx.lineTo(0, 4);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#3a5a74'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#9db8c4';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATT', 0, -r - 11);
    ctx.fillStyle = '#eef6f8';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, 0, r * 0.62);
    ctx.restore();
  }

  return {
    draw(plane) {
      ctx.clearRect(0, 0, W, H);
      // Panel backing, opaque so the HUD beneath never shows through.
      ctx.fillStyle = 'rgba(8, 22, 36, 0.97)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 0, W, 2);
      const r = 52;
      const ys = H / 2 + 8;
      dial(W * 0.10, ys, r, 'AIRSPEED', String(Math.round(knots(plane.speed))), 0, 200, knots(plane.speed),
        [[-120, '0'], [-60, '50'], [0, '100'], [60, '150'], [120, '200']], 'KTS');
      attitude(W * 0.30, ys, r, plane.pitch, plane.bank, plane.headingDeg);
      dial(W * 0.50, ys, r, 'ALTITUDE', String(Math.round(feet(plane.pos.y))), 0, 5000, feet(plane.pos.y),
        [[-120, '0'], [-60, '1250'], [0, '2500'], [60, '3750'], [120, '5000']], 'FT');
      dial(W * 0.68, ys, r, 'VERT SPEED', String(Math.round(fpm(plane.verticalSpeed))), -2000, 2000, fpm(plane.verticalSpeed),
        [[-120, '-2k'], [-60, '-1k'], [0, '0'], [60, '+1k'], [120, '+2k']], 'FPM');
      compassDial(W * 0.86, ys, r, plane.headingDeg);
      // RPM / fuel / hull bars on the right edge.
      const bx = W - 108;
      const rows = [
        ['RPM', plane.throttle * 100],
        ['FUEL', plane.fuel],
        ['HULL', plane.hull],
      ];
      rows.forEach(([label, pct], i) => {
        const y = 22 + i * 26;
        ctx.fillStyle = '#9db8c4';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, bx, y);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(bx, y + 5, 88, 7);
        ctx.fillStyle = pct < 25 ? '#ff5a4e' : (label === 'RPM' ? '#f5a623' : '#2fb3a6');
        ctx.fillRect(bx, y + 5, 88 * clamp(pct, 0, 100) / 100, 7);
        ctx.fillStyle = '#eef6f8';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(pct)}%`, bx + 88, y);
        ctx.textAlign = 'left';
      });
    },
  };
}
