// All sound is synthesized with WebAudio: there are no audio files to load.
// A lazy AudioContext wakes on the first user gesture; until then — and while
// muted — every call is a no-op. Engine, siren and the beachside music loop are
// continuous nodes whose parameters the game steers each frame.

/** Create the audio engine. `setMuted` silences the master gain. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = 0;
  let musicStep = 0;

  /** Wake the context (call from a click or key press). Safe to call often. */
  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    startEngine();
    startSiren();
  }

  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
  }

  function startSiren() {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 800;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'square';
    sirenLfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    sirenLfo.start();
  }

  /** Steer the engine note: `load` 0..1 (speed), `on` while the player drives. */
  function engine(load, on) {
    if (!ctx) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on ? 0.05 + load * 0.05 : 0, t, 0.09);
    engineOsc.frequency.setTargetAtTime(52 + load * 165, t, 0.06);
    engineFilter.frequency.setTargetAtTime(280 + load * 900, t, 0.1);
  }

  /** Steer the police siren: `level` 0..1 by the nearest police car's distance. */
  function siren(level) {
    if (!ctx) return;
    sirenGain.gain.setTargetAtTime(level * 0.028, ctx.currentTime, 0.2);
  }

  /** A short noise burst through a band filter: gunshots, crashes, thuds. */
  function noiseBurst(duration, filterFreq, gainValue, type = 'lowpass') {
    if (!ctx) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  /** A simple tone blip with an envelope. */
  function tone(freq, duration, gainValue, type = 'sine', slideTo = null) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  /** The beachside pad loop: a slow I–vi–IV–V in a warm major key, very quiet. */
  function music(dt) {
    if (!ctx || muted) return;
    musicTimer -= dt;
    if (musicTimer > 0) return;
    musicTimer = 4.2;
    const chords = [
      [261.6, 329.6, 392.0],
      [220.0, 261.6, 329.6],
      [174.6, 220.0, 261.6],
      [196.0, 246.9, 293.7],
    ];
    const chord = chords[musicStep % chords.length];
    musicStep += 1;
    for (const freq of chord) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq / 2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.016, ctx.currentTime + 1.4);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 4.1);
      osc.connect(gain).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 4.2);
    }
  }

  return {
    unlock,
    engine,
    siren,
    music,
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.55, ctx.currentTime, 0.03);
    },
    isMuted: () => muted,
    horn() {
      tone(349, 0.42, 0.12, 'square');
      tone(440, 0.42, 0.1, 'square');
    },
    shoot() {
      noiseBurst(0.11, 1800, 0.22, 'bandpass');
      tone(150, 0.08, 0.1, 'square', 60);
    },
    policeShoot() {
      noiseBurst(0.09, 2400, 0.1, 'bandpass');
    },
    crash(strength) {
      noiseBurst(0.22, 500, Math.min(0.3, 0.08 + strength * 0.02));
      tone(70, 0.2, 0.12, 'sine', 40);
    },
    thud() {
      noiseBurst(0.08, 300, 0.14);
    },
    doorSlam() {
      noiseBurst(0.07, 700, 0.12);
      tone(110, 0.07, 0.06, 'sine');
    },
    pickup() {
      tone(660, 0.09, 0.09, 'sine');
      setTimeout(() => tone(880, 0.12, 0.09, 'sine'), 70);
    },
    cash() {
      tone(988, 0.08, 0.08, 'square');
      setTimeout(() => tone(1319, 0.14, 0.08, 'square'), 60);
    },
    complete() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.09, 'triangle'), i * 95));
    },
    fail() {
      tone(220, 0.3, 0.1, 'sawtooth', 110);
    },
    click() {
      tone(1200, 0.04, 0.05, 'square');
    },
    star() {
      tone(1568, 0.1, 0.07, 'square');
      setTimeout(() => tone(1568, 0.1, 0.07, 'square'), 110);
    },
  };
}
