// Generated sound, off until the visitor asks for it. No audio files to download.
export function createAudio() {
  let ctx = null;
  let master = null;
  let on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.connect(master);

    [55, 82.41, 110.3, 164.8].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.11;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + i * 0.023;
      const depth = ctx.createGain();
      depth.gain.value = 0.06;
      lfo.connect(depth).connect(g.gain);
      osc.connect(g).connect(filter);
      osc.start();
      lfo.start();
    });
  }

  return {
    get on() { return on; },
    toggle() {
      if (!ctx) build();
      on = !on;
      if (on) ctx.resume();
      master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.6);
      return on;
    },
    ping(freq = 880) {
      if (!on) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 1.2);
    },
    whoosh() {
      if (!on) return;
      const t = ctx.currentTime;
      const len = ctx.sampleRate * 1.6;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(180, t);
      f.frequency.exponentialRampToValueAtTime(1300, t + 0.8);
      f.frequency.exponentialRampToValueAtTime(160, t + 1.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      src.connect(f).connect(g).connect(master);
      src.start(t);
    },
  };
}
