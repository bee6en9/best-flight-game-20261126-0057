// Ember Isle Run — synthesized sound, no audio files: a prop-engine drone,
// wind that rises with speed, a two-note ring chime, a landing arpeggio and
// a crash thud. Everything is built with WebAudio oscillators, so the game
// stays fully offline. Audio starts only after a user gesture.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      ctx = null;
      return;
    }
    // Engine: two detuned saws through a lowpass, gain follows throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55 * 1.5;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();

    // Wind: looped noise buffer through a bandpass whose gain follows speed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
  }

  function tone(freq, t0, dur, type, vol) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    // Call from any user gesture (key, click) — browsers require it.
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (ctx) ctx.destination.gain = muted ? 0 : 1;
      return muted;
    },
    // Per-frame: engine pitch follows RPM, wind follows airspeed.
    update(throttle, speedKts, onGround) {
      if (!ctx || muted) return;
      const rpm = 42 + throttle * 58 + (onGround ? 0 : speedKts * 0.08);
      engineOsc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm * 1.5, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.14, (speedKts / 165) * 0.14), ctx.currentTime, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speedKts * 6, ctx.currentTime, 0.15);
    },
    ring() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      tone(880, t, 0.35, 'sine', 0.22);
      tone(1318.5, t + 0.09, 0.5, 'sine', 0.2);
    },
    landing() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.11, 0.5, 'triangle', 0.2));
    },
    crash() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      tone(70, t, 0.7, 'sawtooth', 0.3);
      tone(45, t + 0.05, 0.9, 'square', 0.22);
    },
    warning() {
      if (!ctx || muted) return;
      tone(660, ctx.currentTime, 0.16, 'square', 0.08);
    },
  };
}
