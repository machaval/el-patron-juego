export function createAudio() {
  return {
    ctx: null,
    muted: false,
    ensure() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    beep(freq, dur, type, vol, slide) {
      if (this.muted) return;
      const ac = this.ensure();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, ac.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, ac.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.07, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + dur);
    },
    flap() { this.beep(420, 0.08, "square", 0.05, 720); },
    shout() {
      if (this.muted) return;
      const ac = this.ensure();
      const now = ac.currentTime;
      [196, 294, 392, 523].forEach((f, i) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(f, now + i * 0.04);
        o.frequency.linearRampToValueAtTime(f * 1.5, now + 0.3);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.06, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        o.connect(g).connect(ac.destination);
        o.start(now);
        o.stop(now + 0.45);
      });
    },
    boom() { this.beep(90, 0.35, "sawtooth", 0.09, 40); },
    hit() { this.beep(130, 0.2, "sawtooth", 0.08, 50); },
    link() { this.beep(660, 0.1, "square", 0.06, 1100); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.2, "square", 0.06), i * 130)); }
  };
}
