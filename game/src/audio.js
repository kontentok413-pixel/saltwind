// audio.js — procedural sound for SALTWIND. No audio files: engine hum and
// wind are synthesised with WebAudio, and chimes/thuds are short oscillators.

export function createAudio() {
  let ctx = null;
  let engineOsc1 = null, engineOsc2 = null, engineGain = null;
  let windGain = null, windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch (e) {
      return false;
    }
    // Engine: two detuned saws through a low-pass, gain follows throttle.
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = 'sawtooth';
    engineOsc1.frequency.value = 52;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 78;
    engineOsc1.connect(filter); engineOsc2.connect(filter);
    filter.connect(engineGain); engineGain.connect(ctx.destination);
    engineOsc1.start(); engineOsc2.start();
    // Wind: looped noise buffer through a band-pass, gain follows airspeed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter); windFilter.connect(windGain); windGain.connect(ctx.destination);
    noise.start();
    return true;
  }

  function blip(freq, dur, type = 'sine', vol = 0.16, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
      started = true;
    },
    get muted() { return muted; },
    toggleMute() { muted = !muted; if (engineGain) engineGain.gain.value = muted ? 0 : engineGain.gain.value; return muted; },
    update(plane, dt) {
      if (!ctx || !started || muted) return;
      const thr = plane.throttle;
      const rpm = 46 + thr * 58 + plane.speed * 0.12;
      engineOsc1.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.1);
      engineOsc2.frequency.setTargetAtTime(rpm * 1.494, ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(0.05 + thr * 0.075, ctx.currentTime, 0.15);
      windGain.gain.setTargetAtTime(Math.min(0.16, (plane.speed / 96) * 0.16), ctx.currentTime, 0.2);
      windFilter.frequency.setTargetAtTime(500 + plane.speed * 9, ctx.currentTime, 0.2);
    },
    gate() { blip(880, 0.14, 'sine', 0.18); blip(1318, 0.22, 'sine', 0.14, 0.08); },
    drop() { blip(520, 0.2, 'triangle', 0.16); },
    hit() { blip(1046, 0.3, 'sine', 0.2); blip(1568, 0.4, 'sine', 0.14, 0.1); },
    thud() { blip(70, 0.35, 'sine', 0.3); blip(48, 0.5, 'triangle', 0.22, 0.05); },
    crash() { blip(110, 0.7, 'sawtooth', 0.22); blip(55, 0.9, 'sine', 0.25, 0.1); },
    alarm() { blip(660, 0.12, 'square', 0.08); blip(660, 0.12, 'square', 0.08, 0.18); },
  };
}
