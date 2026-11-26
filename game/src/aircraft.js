// aircraft.js — the S-11 "Shearwater": a low-poly turboprop built from primitives.
// White fuselage, teal wings, amber tips, spinning prop, retractable gear, nav lights.

import * as THREE from 'three';

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'shearwater';

  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6f2, roughness: 0.45, metalness: 0.15, flatShading: true });
  const teal = new THREE.MeshStandardMaterial({ color: 0x1f7a72, roughness: 0.5, metalness: 0.2, flatShading: true });
  const amber = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.5, metalness: 0.2, flatShading: true });
  const glass = new THREE.MeshStandardMaterial({ color: 0x16324a, roughness: 0.15, metalness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3438, roughness: 0.6, metalness: 0.3 });
  const propMat = new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.4, metalness: 0.5 });

  // Fuselage: nose cone + body + tail cone (forward is -Z).
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 10), white);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -4.1);
  group.add(nose);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.62, 5.4, 10), white);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, -0.6);
  group.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.6, 10), white);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.15, 3.4);
  group.add(tail);

  // Belly stripe (teal) along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 5.2), teal);
  stripe.position.set(0, -0.55, -0.6);
  group.add(stripe);

  // Canopy (glasshouse over the cockpit).
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 8), glass);
  canopy.scale.set(0.82, 0.72, 1.9);
  canopy.position.set(0, 0.62, -1.6);
  group.add(canopy);

  // Main wings: teal, slight sweep and dihedral, amber tips.
  function wing(side) {
    const w = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 1.9), teal);
    panel.position.x = side * 2.9;
    panel.rotation.y = side * -0.12;
    panel.rotation.z = side * 0.06;
    w.add(panel);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 1.7), amber);
    tip.position.x = side * 5.5;
    tip.rotation.y = side * -0.12;
    tip.rotation.z = side * 0.06;
    w.add(tip);
    // Roundel: teal ring, amber centre.
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 20),
      new THREE.MeshStandardMaterial({ color: 0x0d2137, roughness: 0.5 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(side * 3.1, 0.1, -0.1);
    w.add(ring);
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 16),
      new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.5 }),
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(side * 3.1, 0.11, -0.1);
    w.add(dot);
    return w;
  }
  group.add(wing(1), wing(-1));

  // Tailplane + fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.1), teal);
  stab.position.set(0, 0.35, 4.2);
  stab.rotation.y = 0.1;
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 1.6), teal);
  fin.position.set(0, 1.15, 4.3);
  fin.rotation.x = -0.18;
  group.add(fin);
  const finTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 1.2), amber);
  finTip.position.set(0, 2.0, 4.45);
  finTip.rotation.x = -0.18;
  group.add(finTip);

  // Registration on the fin (canvas texture, generated at runtime).
  const regCanvas = document.createElement('canvas');
  regCanvas.width = 128; regCanvas.height = 64;
  const rg = regCanvas.getContext('2d');
  rg.fillStyle = '#f4f6f2'; rg.fillRect(0, 0, 128, 64);
  rg.fillStyle = '#0d2137'; rg.font = 'bold 34px system-ui, sans-serif';
  rg.textAlign = 'center'; rg.textBaseline = 'middle';
  rg.fillText('S-11', 64, 32);
  const regTex = new THREE.CanvasTexture(regCanvas);
  regTex.colorSpace = THREE.SRGBColorSpace;
  const reg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.75),
    new THREE.MeshStandardMaterial({ map: regTex, roughness: 0.5 }),
  );
  reg.position.set(0.09, 1.15, 4.3);
  reg.rotation.y = Math.PI / 2;
  group.add(reg);

  // Propeller: spinner + three blades, spins with throttle.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 10), amber);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.5;
  prop.add(spinner);
  const blades = [];
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.07), propMat);
    blade.position.y = 1.35;
    const holder = new THREE.Group();
    holder.rotation.z = (i / 3) * Math.PI * 2;
    holder.add(blade);
    prop.add(holder);
    blades.push(holder);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 24),
    new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
  );
  disc.position.z = -0.35;
  prop.add(disc);
  prop.position.set(0, 0, -5.3);
  group.add(prop);

  // Landing gear (retractable): two mains + nose wheel.
  const gear = new THREE.Group();
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1d1f, roughness: 0.9 });
  const strutMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.35, metalness: 0.7 });
  function wheel(x, z, r = 0.42) {
    const g = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), strutMat);
    strut.position.y = 0.55;
    g.add(strut);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 12), wheelMat);
    tyre.rotation.z = Math.PI / 2;
    g.add(tyre);
    g.position.set(x, -0.95, z);
    return g;
  }
  gear.add(wheel(1.5, -0.4), wheel(-1.5, -0.4), wheel(0, -3.4, 0.34));
  group.add(gear);

  // Nav lights: red port, green starboard, white tail + strobe.
  function navLight(color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.4 }),
    );
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }
  navLight(0xff2a1e, -5.9, 0.1, -0.2);
  navLight(0x2aff5a, 5.9, 0.1, -0.2);
  const tailLight = navLight(0xffffff, 0, 0.5, 4.75);
  const strobe = navLight(0xffffff, 0, 1.6, 4.3);

  // Soft shadow-catcher blob under the aircraft (helps it read over terrain).
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -1.2;
  group.add(blob);

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  blob.castShadow = false;

  let strobeT = 0;
  return {
    group, prop, gear, blob,
    setGearDown(down) { gear.visible = down; },
    // In cockpit view the individual blades read as black bars sweeping the
    // windscreen; hide them and keep only the translucent blur disc.
    setCockpit(on) { for (const b of blades) b.visible = !on; },
    update(dt, throttle, airborne, altAgl = 999) {
      prop.rotation.z -= dt * (4 + throttle * 46);
      disc.material.opacity = 0.03 + throttle * 0.06;
      strobeT += dt;
      const on = (strobeT % 1.2) < 0.12;
      strobe.material.emissiveIntensity = on ? 4 : 0.2;
      tailLight.material.emissiveIntensity = on ? 3 : 1.2;
      // The ground-shadow blob only reads when the aircraft is near the ground;
      // floating in the sky it looks like a stain.
      blob.visible = airborne && altAgl < 45;
      blob.material.opacity = 0.18 * (1 - altAgl / 45);
    },
  };
}
