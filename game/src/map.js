// map.js — the sector map: a live top-down canvas showing sea, land, the runway,
// gates, the drop buoy and the aircraft. Used as the HUD minimap and as a full
// overlay when M is held. The land shape is a coarse stamp of the real terrain.

import { RUNWAY } from './config.js';
import { terrainHeight } from './world.js';

const RANGE = 700; // metres shown from centre to edge

export function createSectorMap(miniCanvas, fullCanvas) {
  const mini = miniCanvas.getContext('2d');
  const full = fullCanvas ? fullCanvas.getContext('2d') : null;
  // Pre-render the land mask once (96x96 samples of the real height function).
  const N = 96;
  const land = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * RANGE * 2;
      const z = (j / (N - 1) - 0.5) * RANGE * 2;
      land[j * N + i] = terrainHeight(x, z) > 1.2 ? 1 : 0;
    }
  }

  function draw(ctx, w, h, plane, mission, showLabels) {
    // Sea.
    ctx.fillStyle = '#17394f';
    ctx.fillRect(0, 0, w, h);
    // Land.
    ctx.fillStyle = '#3d6b46';
    const cell = w / N;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (land[j * N + i]) ctx.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
      }
    }
    const toX = (x) => (x / RANGE + 1) * 0.5 * w;
    const toY = (z) => (z / RANGE + 1) * 0.5 * h;
    // Runway.
    ctx.strokeStyle = '#eef6f8';
    ctx.lineWidth = Math.max(2, w / 160);
    ctx.beginPath();
    ctx.moveTo(toX(RUNWAY.centerX - RUNWAY.length / 2), toY(RUNWAY.centerZ));
    ctx.lineTo(toX(RUNWAY.centerX + RUNWAY.length / 2), toY(RUNWAY.centerZ));
    ctx.stroke();
    ctx.fillStyle = '#eef6f8';
    ctx.font = `600 ${Math.max(9, w / 40)}px system-ui, sans-serif`;
    ctx.fillText('RWY 09', toX(RUNWAY.centerX + RUNWAY.length / 2) + 4, toY(RUNWAY.centerZ) + 3);
    // Gates.
    if (mission && mission.gates) {
      mission.gates.forEach((g, i) => {
        const done = i < mission.gateIndex;
        ctx.beginPath();
        ctx.arc(toX(g[0]), toY(g[2]), Math.max(4, w / 90), 0, Math.PI * 2);
        ctx.strokeStyle = done ? '#7ddc8a' : '#f5a623';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (!done && i === mission.gateIndex) {
          ctx.fillStyle = '#f5a623';
          ctx.font = `700 ${Math.max(9, w / 36)}px system-ui, sans-serif`;
          ctx.fillText(`G${i + 1}`, toX(g[0]) + 6, toY(g[2]) - 6);
        }
      });
    }
    // Drop buoy.
    if (mission && mission.dropBuoy) {
      ctx.beginPath();
      ctx.arc(toX(mission.dropBuoy[0]), toY(mission.dropBuoy[2]), Math.max(4, w / 80), 0, Math.PI * 2);
      ctx.fillStyle = '#ff5a4e';
      ctx.fill();
    }
    // Aircraft marker (white triangle, rotated to heading). Map x = east,
    // map y = south; forward = (sin h, cos h) in those axes, and the triangle
    // points up (-y) at rest, so rotate by atan2(cos h, sin h) + 90 degrees.
    const px = toX(plane.pos.x), py = toY(plane.pos.z);
    const hr = (plane.headingDeg * Math.PI) / 180;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.cos(hr), Math.sin(hr)) + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    if (showLabels) {
      ctx.fillStyle = 'rgba(238,246,248,0.85)';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillText('SECTOR MAP — THE BREAKWATER ISLES', 10, 18);
      ctx.fillText(`1 : ${Math.round(RANGE * 2 / 1000)} KM`, 10, h - 10);
    }
  }

  return {
    drawMinimap(plane, mission) {
      draw(mini, miniCanvas.width, miniCanvas.height, plane, mission, false);
    },
    drawFull(plane, mission) {
      if (full) draw(full, fullCanvas.width, fullCanvas.height, plane, mission, true);
    },
  };
}
