(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  const W = canvas.width;
  const H = canvas.height;
  const buttons = {
    flap: document.getElementById("flap-button"),
    shout: document.getElementById("shout-button"),
    pause: document.getElementById("pause-button"),
    mute: document.getElementById("mute-button"),
    effects: document.getElementById("effects-button"),
    continue: document.getElementById("continue-button"),
    reset: document.getElementById("reset-button")
  };

  const KEY = {};
  let showHitboxes = false;
  addEventListener("keydown", (e) => {
    if (e.repeat && ["KeyP", "Escape", "KeyM", "KeyR", "KeyH"].includes(e.code)) return;
    if (e.code === "KeyX" && state.mode === "title") {
      e.preventDefault();
      resetSavedProgress();
      return;
    }
    KEY[e.code] = true;
    if (["Space", "ArrowUp", "KeyT", "KeyP", "Escape", "KeyM", "KeyR", "KeyH"].includes(e.code)) e.preventDefault();
  });
  addEventListener("keyup", (e) => { KEY[e.code] = false; });
  canvas.addEventListener("pointerdown", () => { KEY.Pointer = true; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function bindPressButton(button, key) {
    if (!button) return;
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
    });
    button.addEventListener("click", () => { KEY[key] = true; });
  }
  bindPressButton(buttons.flap, "Pointer");
  bindPressButton(buttons.shout, "KeyT");
  bindPressButton(buttons.pause, "KeyP");
  bindPressButton(buttons.mute, "KeyM");
  bindPressButton(buttons.effects, "KeyR");
  bindPressButton(buttons.continue, "KeyC");
  if (buttons.reset) buttons.reset.addEventListener("click", resetSavedProgress);

  function updateControlLabels() {
    if (buttons.flap) {
      buttons.flap.textContent = state.mode === "title" ? "START" : "FLAP";
      buttons.flap.setAttribute("aria-label", state.mode === "title" ? "Start a new run" : "Flap");
    }
    if (buttons.pause) {
      buttons.pause.hidden = state.mode === "title";
      buttons.pause.textContent = state.mode === "paused" ? "RESUME" : "PAUSE";
      buttons.pause.setAttribute("aria-label", state.mode === "paused" ? "Resume game" : "Pause game");
    }
    if (buttons.shout) buttons.shout.hidden = state.mode === "title";
    if (buttons.mute) {
      buttons.mute.textContent = audio.muted ? "UNMUTE" : "MUTE";
      buttons.mute.setAttribute("aria-label", audio.muted ? "Unmute sound" : "Mute sound");
    }
    if (buttons.effects) {
      buttons.effects.textContent = reducedMotion ? "FULL FX" : "LESS FX";
      buttons.effects.setAttribute("aria-label", reducedMotion ? "Enable full visual effects" : "Reduce visual effects");
    }
    if (buttons.continue) {
      buttons.continue.textContent = "CONTINUE L" + (savedProgress.highestUnlockedLevel + 1);
      buttons.continue.hidden = state.mode !== "title" || savedProgress.highestUnlockedLevel === 0;
    }
    if (buttons.reset) buttons.reset.hidden = state.mode !== "title";
    document.getElementById("controls")?.classList.toggle("title-mode", state.mode === "title");
  }

  const audio = {
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

  function makeCanvas(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    draw(g, w, h);
    return c;
  }

  function loadEnemyImage(path, onload) {
    const image = new Image();
    image.onload = () => onload(image);
    image.onerror = () => console.warn("Could not load optional enemy sprite: " + path);
    image.src = path;
  }

  function disc(g, x, y, r, c) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  function oval(g, x, y, rx, ry, c) {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }

  const SPR = { hero: { ready: false }, side: {} };

  function loadHero() {
    const names = ["idle", "swim", "swim_2", "swim_3", "shout", "dive", "hurt", "thumbs", "ray"];
    let left = names.length;
    const settled = new Set();
    function settle(name) {
      if (settled.has(name)) return;
      settled.add(name);
      left--;
      if (left === 0) {
        SPR.hero.ready = Boolean(SPR.hero.swim);
        if (!SPR.hero.ready) console.warn("Hero swim sprite failed to load; using the fallback shape.");
      }
    }
    names.forEach((n) => {
      const img = new Image();
      img.onload = () => {
        SPR.hero[n] = img;
        settle(n);
      };
      img.onerror = () => {
        console.warn("Could not load optional hero sprite: assets/" + n + ".png");
        settle(n);
      };
      img.src = "assets/" + n + ".png";
    });
  }
  loadHero();

  function drawSidekick(g, kick, fire) {
    oval(g, 22, 26, 11, 14, "#143848");
    oval(g, 22, 24, 7, 6, "#00a1e0");
    disc(g, 22, 24, 2.4, "#0c2c3c");
    disc(g, 22, 13, 7, "#2a1c12");
    disc(g, 22, 14.5, 6.2, "#e8b898");
    oval(g, 22, 10.5, 6.4, 2.8, "#3a2818");
    disc(g, 20, 14.2, 1, "#1a1410");
    disc(g, 25, 14.2, 1, "#1a1410");
    oval(g, 8, 28, 5, 2.2, "#0a2430");
    oval(g, 8 + kick, 29, 6, 2.2, "#00a1e0");
    oval(g, 10, 36, 5, 2.2, "#0a2430");
    oval(g, 10 - kick, 37, 6, 2.2, "#00a1e0");
    oval(g, 34, 26, 3, 2, "#e8b898");
    if (fire) {
      pxBox(g, 32, 22, 18, 7, "#3a3a3a");
      pxBox(g, 48, 23, 8, 5, "#6a6a6a");
      pxBox(g, 54, 24, 8, 3, "#c04020");
    } else {
      pxBox(g, 32, 23, 14, 6, "#3a3a3a");
      pxBox(g, 44, 24, 6, 4, "#6a6a6a");
    }
  }

  function pxBox(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  }

  SPR.side.idle = makeCanvas(64, 46, (g) => drawSidekick(g, 0, false));
  SPR.side.kickA = makeCanvas(64, 46, (g) => drawSidekick(g, 4, false));
  SPR.side.kickB = makeCanvas(64, 46, (g) => drawSidekick(g, -4, false));
  SPR.side.fire = makeCanvas(70, 46, (g) => drawSidekick(g, 2, true));

  function sapCannon(g) {
    pxBox(g, 14, 4, 34, 56, "#082a2b");
    pxBox(g, 18, 8, 26, 48, "#176756");
    pxBox(g, 22, 10, 4, 44, "#3b9b78");
    pxBox(g, 40, 10, 4, 44, "#0b423e");
    pxBox(g, 16, 4, 30, 5, "#77bd91");
    pxBox(g, 16, 54, 30, 5, "#07252d");
    pxBox(g, 22, 22, 20, 20, "#092c36");
    pxBox(g, 25, 25, 14, 14, "#f2a900");
    pxBox(g, 28, 28, 8, 8, "#ffe2a0");
    pxBox(g, 2, 25, 18, 14, "#071e29");
    pxBox(g, 0, 28, 8, 8, "#78b8aa");
    pxBox(g, 4, 30, 4, 4, "#fff0b0");
  }
  SPR.cannonL = makeCanvas(50, 64, sapCannon);
  SPR.cannonR = makeCanvas(50, 64, (g) => {
    g.translate(50, 0);
    g.scale(-1, 1);
    sapCannon(g);
  });

  SPR.bolt = makeCanvas(18, 8, (g) => {
    pxBox(g, 0, 3, 5, 2, "#e68143");
    pxBox(g, 4, 2, 7, 4, "#f2a900");
    pxBox(g, 10, 1, 5, 6, "#ffe08a");
    pxBox(g, 14, 2, 4, 4, "#fff5cb");
  });

  function drawShark(g, frame) {
    const wag = frame ? 10 : -10;
    g.fillStyle = "#5a6e7c";
    g.beginPath();
    g.moveTo(18, 28);
    g.quadraticCurveTo(48, 4, 108, 24);
    g.quadraticCurveTo(48, 46, 18, 30);
    g.closePath();
    g.fill();
    g.fillStyle = "#7a90a0";
    g.beginPath();
    g.moveTo(28, 24);
    g.quadraticCurveTo(56, 10, 100, 22);
    g.quadraticCurveTo(56, 28, 28, 26);
    g.closePath();
    g.fill();
    g.fillStyle = "#3a4c58";
    g.beginPath();
    g.moveTo(58, 12);
    g.lineTo(72, -2);
    g.lineTo(74, 16);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(18, 26);
    g.lineTo(0, 16 + wag * 0.3);
    g.lineTo(6, 28);
    g.lineTo(0, 38 - wag * 0.3);
    g.lineTo(18, 30);
    g.closePath();
    g.fill();
    g.fillStyle = "#4a6070";
    g.beginPath();
    g.moveTo(70, 34);
    g.lineTo(92, 46);
    g.lineTo(62, 36);
    g.closePath();
    g.fill();
    g.fillStyle = "#d8e4ea";
    g.beginPath();
    g.moveTo(30, 30);
    g.quadraticCurveTo(60, 36, 96, 26);
    g.quadraticCurveTo(60, 32, 30, 30);
    g.fill();
    g.strokeStyle = "#2a343c";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(88, 28);
    g.quadraticCurveTo(104, 26, 112, 24);
    g.stroke();
    g.fillStyle = "#e8eef2";
    g.beginPath();
    g.moveTo(100, 24);
    g.lineTo(114, 20);
    g.lineTo(114, 28);
    g.closePath();
    g.fill();
    disc(g, 96, 20, 3.2, "#111");
    disc(g, 97, 19, 1.1, "#fff");
    g.strokeStyle = "#c8d0d4";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(104, 26);
    g.lineTo(112, 23);
    g.moveTo(104, 27);
    g.lineTo(112, 28);
    g.stroke();
    g.strokeStyle = "rgba(20,30,36,0.45)";
    g.beginPath();
    g.moveTo(40, 32);
    g.quadraticCurveTo(62, 36, 84, 30);
    g.stroke();
  }
  SPR.shark = [0, 1, 2, 3].map((frame) => ({
    image: makeCanvas(118, 50, (g) => drawShark(g, frame % 2)),
    sx: 0, sy: 0, sw: 118, sh: 50
  }));
  loadEnemyImage("assets/enemies/shark-strip.png", (image) => {
    const frameWidth = image.width / 4;
    SPR.shark = [0, 1, 2, 3].map((frame) => ({
      image, sx: frame * frameWidth, sy: 190, sw: frameWidth, sh: 310
    }));
  });

  SPR.rocket = makeCanvas(22, 10, (g) => {
    pxBox(g, 6, 2, 14, 6, "#c04020");
    pxBox(g, 0, 3, 8, 4, "#888");
    pxBox(g, 18, 1, 4, 8, "#f0d060");
  });

  const BUGS = [
    { name: "NPE", color: "#c04050", short: "NPE" },
    { name: "StackOverflow", color: "#c47828", short: "SO" },
    { name: "Classloader", color: "#7a4bb8", short: "CL" }
  ];

  SPR.bugs = BUGS.map((b, index) => {
    const fallback = makeCanvas(44, 36, (g) => {
      oval(g, 22, 20, 16, 12, b.color);
      oval(g, 22, 18, 13, 9, "#1a1014");
      disc(g, 16, 16, 3, "#fff");
      disc(g, 28, 16, 3, "#fff");
      disc(g, 16, 16, 1.4, "#111");
      disc(g, 28, 16, 1.4, "#111");
      g.strokeStyle = b.color;
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(8, 22 + i * 3);
        g.lineTo(2, 18 + i * 4);
        g.stroke();
        g.beginPath();
        g.moveTo(36, 22 + i * 3);
        g.lineTo(42, 18 + i * 4);
        g.stroke();
      }
    });
    loadEnemyImage("assets/enemies/" + ["bug-npe.png", "bug-stack.png", "bug-classloader.png"][index], (image) => {
      SPR.bugs[index] = { image, sx: 100, sy: 300, sw: 1100, sh: 700 };
    });
    return { image: fallback, sx: 0, sy: 0, sw: 44, sh: 36 };
  });

  const CONNECTORS = [
    { name: "HTTP", bg: "#00a1e0" },
    { name: "DB", bg: "#2d8a4e" },
    { name: "SFDC", bg: "#00a1e0" },
    { name: "JMS", bg: "#c45c26" },
    { name: "FTP", bg: "#7a4bb8" },
    { name: "S3", bg: "#c47828" },
    { name: "SAP", bg: "#0d6b4a" },
    { name: "DW", bg: "#00a1e0" }
  ];

  SPR.connectors = CONNECTORS.map((c) => makeCanvas(36, 36, (g) => {
    pxBox(g, 9, 0, 18, 3, "#c4f3e7");
    pxBox(g, 3, 3, 30, 4, "#163b46");
    pxBox(g, 0, 9, 36, 18, "#163b46");
    pxBox(g, 3, 29, 30, 4, "#163b46");
    pxBox(g, 9, 33, 18, 3, "#c4f3e7");
    pxBox(g, 4, 10, 28, 16, c.bg);
    pxBox(g, 8, 5, 20, 4, c.bg);
    pxBox(g, 8, 27, 20, 4, c.bg);
    pxBox(g, 6, 11, 24, 3, "rgba(255,255,255,0.42)");
    pxBox(g, 6, 24, 24, 2, "rgba(2,20,30,0.45)");
    pxBox(g, 8, 15, 20, 9, "#092631");
    g.fillStyle = "#eafff8";
    g.font = "bold 8px monospace";
    const tw = g.measureText(c.name).width;
    g.fillText(c.name, 18 - tw / 2, 21);
  }));

  SPR.flag = makeCanvas(40, 48, (g) => {
    pxBox(g, 6, 4, 4, 44, "#ddd");
    g.fillStyle = "#0d6b4a";
    g.beginPath();
    g.moveTo(10, 6);
    g.lineTo(38, 16);
    g.lineTo(10, 26);
    g.fill();
    g.fillStyle = "#f2a900";
    g.font = "bold 8px sans-serif";
    g.fillText("SAP", 12, 18);
  });

  SPR.bubble = makeCanvas(8, 8, (g) => {
    disc(g, 4, 4, 3, "rgba(180,230,255,0.5)");
    disc(g, 3, 3, 1, "#fff");
  });

  const FISH_PALETTES = [
    { body: "#78b9bd", light: "#c5efea", fin: "#4d929b" },
    { body: "#afc693", light: "#e6efb8", fin: "#75946d" },
    { body: "#8eaed6", light: "#d2e6f3", fin: "#5d7fae" }
  ];

  function drawPixelFish(g, kind, frame) {
    const palette = FISH_PALETTES[kind];
    g.imageSmoothingEnabled = false;
    if (kind === 0) {
      pxBox(g, 2, frame ? 2 : 4, 4, 3, "#07141c");
      pxBox(g, 3, frame ? 3 : 5, 2, 1, palette.fin);
      pxBox(g, 6, 3, 13, 1, "#07141c");
      pxBox(g, 5, 4, 16, 5, "#07141c");
      pxBox(g, 7, 5, 12, 3, palette.body);
      pxBox(g, 9, 5, 8, 1, palette.light);
      pxBox(g, 11, 8, 5, 2, "#07141c");
      pxBox(g, 12, 8, 3, 1, palette.fin);
    } else if (kind === 1) {
      pxBox(g, 2, frame ? 3 : 4, 4, 3, "#07141c");
      pxBox(g, 3, frame ? 4 : 5, 2, 1, palette.fin);
      pxBox(g, 6, 2, 11, 1, "#07141c");
      pxBox(g, 5, 3, 14, 6, "#07141c");
      pxBox(g, 7, 4, 10, 4, palette.body);
      pxBox(g, 9, 4, 6, 1, palette.light);
      pxBox(g, 10, 9, 5, 2, "#07141c");
      pxBox(g, 11, 9, 3, 1, palette.fin);
    } else {
      pxBox(g, 1, frame ? 2 : 4, 5, 3, "#07141c");
      pxBox(g, 2, frame ? 3 : 5, 3, 1, palette.fin);
      pxBox(g, 6, 4, 15, 1, "#07141c");
      pxBox(g, 5, 4, 17, 5, "#07141c");
      pxBox(g, 7, 5, 13, 3, palette.body);
      pxBox(g, 10, 5, 8, 1, palette.light);
      pxBox(g, 13, 8, 5, 2, "#07141c");
      pxBox(g, 14, 8, 3, 1, palette.fin);
    }
    pxBox(g, kind === 1 ? 16 : 18, kind === 1 ? 4 : 5, 1, 1, "#eaf7f4");
    pxBox(g, kind === 1 ? 17 : 19, kind === 1 ? 4 : 5, 1, 1, "#07141c");
  }

  SPR.fish = FISH_PALETTES.map((_, kind) => [
    makeCanvas(24, 12, (g) => drawPixelFish(g, kind, 0)),
    makeCanvas(24, 12, (g) => drawPixelFish(g, kind, 1))
  ]);

  const LEVELS = [
    {
      name: "SAP TERRITORY",
      sub: "El Patrón alone. Dodge cannons and sharks.",
      sky: ["#08362c", "#0a4a3a", "#041814"],
      accent: "#f2a900",
      length: 4200,
      speed: 3.15,
      gravity: 0.28,
      flap: -5.6,
      cannons: true,
      fire: false,
      sharks: 4,
      bugs: false,
      connectors: 0,
      squad: 0,
      killN: 0,
      shouts: 0
    },
    {
      name: "ANYPOINT STUDIO",
      sub: "Hit every ball. Miss = damage. T kills a shark.",
      sky: ["#102030", "#1a3850", "#081018"],
      accent: "#00a1e0",
      length: 4600,
      speed: 3.35,
      gravity: 0.3,
      flap: -5.7,
      cannons: false,
      fire: false,
      sharks: 5,
      bugs: false,
      connectors: 6,
      squad: 1,
      killN: 1,
      shouts: 3
    },
    {
      name: "DATAWEAVE CHASM",
      sub: "Squad of 2. Trabajeen clears 6.",
      sky: ["#061828", "#123050", "#081018"],
      accent: "#c4b070",
      length: 5000,
      speed: 3.5,
      gravity: 0.32,
      flap: -5.8,
      cannons: true,
      fire: true,
      sharks: 3,
      bugs: true,
      connectors: 7,
      squad: 2,
      killN: 6,
      shouts: 9
    },
    {
      name: "API PLATFORM",
      sub: "Squad of 3. Route and survive.",
      sky: ["#102838", "#1a4860", "#0a1820"],
      accent: "#7fd7ff",
      length: 5200,
      speed: 3.65,
      gravity: 0.33,
      flap: -5.9,
      cannons: true,
      bugs: true,
      connectors: 8,
      squad: 3,
      killN: 9,
      shouts: 6,
      fire: true
    },
    {
      name: "MULE 4 ABYSS",
      sub: "High pressure. Squad of 4.",
      sky: ["#020810", "#061828", "#010408"],
      accent: "#204060",
      length: 5400,
      speed: 3.8,
      gravity: 0.36,
      flap: -6.1,
      cannons: true,
      bugs: true,
      connectors: 8,
      squad: 4,
      killN: 12,
      shouts: 6,
      fire: true
    },
    {
      name: "IPO CONTROL PLANE",
      sub: "Full squad. Cash the vault.",
      sky: ["#101018", "#2a1840", "#080810"],
      accent: "#d4a017",
      length: 5600,
      speed: 3.9,
      gravity: 0.34,
      flap: -6.0,
      cannons: true,
      bugs: true,
      connectors: 8,
      squad: 5,
      killN: 15,
      shouts: 6,
      fire: true
    }
  ];

  const SAVE_KEY = "el-patron-save-v1";
  const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  function defaultSavedProgress() {
    return { version: 1, bestVested: 0, highestUnlockedLevel: 0, muted: false, reducedEffects: null };
  }

  function readSavedProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSavedProgress();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return defaultSavedProgress();
      return {
        version: 1,
        bestVested: Number.isFinite(parsed.bestVested) ? Math.max(0, Math.floor(parsed.bestVested)) : 0,
        highestUnlockedLevel: Number.isFinite(parsed.highestUnlockedLevel)
          ? Math.max(0, Math.min(LEVELS.length - 1, Math.floor(parsed.highestUnlockedLevel)))
          : 0,
        muted: typeof parsed.muted === "boolean" ? parsed.muted : false,
        reducedEffects: typeof parsed.reducedEffects === "boolean" ? parsed.reducedEffects : null
      };
    } catch (error) {
      console.warn("Could not read saved progress; starting with defaults.", error);
      return defaultSavedProgress();
    }
  }

  let savedProgress = readSavedProgress();
  let reducedMotion = savedProgress.reducedEffects ?? Boolean(motionPreference?.matches);

  function persistSavedProgress(patch) {
    savedProgress = { ...savedProgress, ...patch, version: 1 };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(savedProgress));
    } catch (error) {
      console.warn("Could not save progress; gameplay will continue without persistence.", error);
    }
  }

  function resetSavedProgress() {
    if (state.mode !== "title") return;
    const confirmed = window.confirm("Reset the best score, unlocked levels, mute, and effects settings?");
    if (!confirmed) return;
    savedProgress = defaultSavedProgress();
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (error) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(savedProgress));
      } catch (writeError) {
        console.warn("Could not reset saved progress; storage is unavailable.", error, writeError);
      }
    }
    state.checkpoint = 0;
    state.vested = 0;
    audio.muted = false;
    reducedMotion = Boolean(motionPreference?.matches);
    updateControlLabels();
  }

  if (motionPreference?.addEventListener) {
    motionPreference.addEventListener("change", (e) => {
      if (savedProgress.reducedEffects === null) {
        reducedMotion = e.matches;
        updateControlLabels();
      }
    });
  } else if (motionPreference?.addListener) {
    motionPreference.addListener((e) => {
      if (savedProgress.reducedEffects === null) {
        reducedMotion = e.matches;
        updateControlLabels();
      }
    });
  }

  function createRunSeed() {
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] || 1;
    } catch {
      return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
    }
  }

  function createSeededRandom(seed) {
    let value = seed >>> 0;
    return function random() {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function levelSeed(runSeed, level) {
    return (runSeed ^ Math.imul(level + 1, 0x9e3779b9)) >>> 0;
  }

  const VESTING_DISTANCE_STEP = 24;

  const state = {
    mode: "title",
    level: 0,
    t: 0,
    dist: 0,
    distanceVested: 0,
    score: 0,
    vested: 0,
    levelStartVested: 0,
    health: 3,
    maxHealth: 3,
    trabajeen: 3,
    shoutPulse: 0,
    shoutText: 0,
    invuln: 0,
    kick: 0,
    player: { x: 170, y: 240, vy: 0, w: 70, h: 38 },
    squad: [],
    ents: [],
    parts: [],
    effects: [],
    shakeLife: 0,
    shakeDuration: 1,
    damageFlash: 0,
    transitionTimer: 0,
    transitionReward: 0,
    bubbles: [],
    links: [],
    linked: 0,
    needLink: 0,
    banner: null,
    bannerLife: 0,
    winTimer: 0,
    checkpoint: 0,
    runSeed: 0
  };

  state.checkpoint = savedProgress.highestUnlockedLevel;
  audio.muted = savedProgress.muted;

  function banner(text) {
    state.banner = text;
    state.bannerLife = 130;
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function burst(x, y, c, n) {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const speed = 1.5 + Math.random() * 2.7;
      state.parts.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 18 + Math.random() * 14,
        c: i % 4 === 0 ? "#fff4bd" : i % 4 === 1 ? "#71d5c5" : c,
        s: i % 3 === 0 ? 5 : 3
      });
    }
  }

  function addEffect(effect) {
    state.effects.push(effect);
    if (state.effects.length > 80) state.effects.splice(0, state.effects.length - 80);
  }

  function addScoreEffect(x, y, text, color) {
    addEffect({ type: "text", x, y, text, color, vy: -0.45, life: 48, duration: 48 });
  }

  function spawnLevel() {
    const L = LEVELS[state.level];
    const random = createSeededRandom(levelSeed(state.runSeed, state.level));
    state.levelStartVested = state.vested;
    state.ents = [];
    state.parts = [];
    state.effects = [];
    state.shakeLife = 0;
    state.damageFlash = 0;
    state.bubbles = [];
    state.links = [];
    state.linked = 0;
    state.needLink = L.connectors;
    state.dist = 0;
    state.distanceVested = 0;
    state.trabajeen = L.shouts ?? 3;
    state.shoutPulse = 0;
    state.shoutText = 0;
    state.invuln = 40;
    state.winTimer = 0;
    state.finishing = false;
    state.hurtTimer = 0;
    state.player.x = 170;
    state.player.y = H / 2;
    state.player.vy = 0;
    state.squad = [];
    for (let i = 0; i < L.squad; i++) {
      state.squad.push({
        x: 90 - i * 36,
        y: state.player.y + (i % 2 ? 28 : -28),
        kick: 0,
        fire: 0
      });
    }

    if (L.cannons) {
      const gapBase = 168 - state.level * 8;
      let x = 420;
      while (x < L.length - 380) {
        const gap = gapBase + random() * 30;
        const gy = 90 + random() * (H - 220 - gap);
        state.ents.push({
          type: "cannon", side: "top",
          x, y: 0, w: 46, h: gy, gy, gap, alive: true
        });
        state.ents.push({
          type: "cannon", side: "bot",
          x, y: gy + gap, w: 46, h: H - (gy + gap), gy, gap, alive: true
        });
        x += 300 + random() * 90 - state.level * 8;
      }
    }

    if (L.sharks) {
      for (let i = 0; i < L.sharks; i++) {
        state.ents.push({
          type: "shark",
          x: 640 + i * 780 + random() * 80,
          y: 90 + random() * (H - 180),
          w: 100, h: 34,
          vy: (random() < 0.5 ? -1 : 1) * (0.55 + random() * 0.35),
          vx: 1.1 + random() * 0.5,
          alive: true
        });
      }
    }

    if (L.bugs) {
      for (let i = 0; i < 8 + state.level * 2; i++) {
        const kind = i % 3;
        state.ents.push({
          type: "bug", kind,
          x: 500 + i * 280 + random() * 80,
          y: 80 + random() * (H - 160),
          w: 40, h: 30,
          vy: (random() < 0.5 ? -1 : 1) * (0.8 + random()),
          alive: true
        });
      }
    }

    let previousConnectorY = H / 2;
    let previousConnectorX = 0;
    for (let i = 0; i < L.connectors; i++) {
      const baseX = 520 + i * ((L.length - 900) / Math.max(1, L.connectors));
      const candidateOffsets = [0];
      for (let offset = 30; offset <= 300; offset += 30) {
        candidateOffsets.push(-offset, offset);
      }
      let chosen = null;
      for (const offset of candidateOffsets) {
        const x = baseX + offset;
        if (x <= previousConnectorX + 170 || x >= L.length - 190) continue;

        let minY = Math.max(82, previousConnectorY - 150);
        let maxY = Math.min(H - 112, previousConnectorY + 150);
        for (const cannon of state.ents) {
          if (cannon.type !== "cannon" || cannon.side !== "top") continue;
          if (x + 32 <= cannon.x || x >= cannon.x + cannon.w) continue;
          minY = Math.max(minY, cannon.gy + 8);
          maxY = Math.min(maxY, cannon.gy + cannon.gap - 40);
        }
        if (minY <= maxY) {
          chosen = { x, y: minY + random() * (maxY - minY) };
          break;
        }
      }

      if (!chosen) {
        throw new Error("Could not find a cannon-clear connector lane for level " + (state.level + 1) + ".");
      }
      state.ents.push({
        type: "connector", kind: i % CONNECTORS.length,
        x: chosen.x,
        y: chosen.y,
        w: 32, h: 32, linked: false, missed: false, alive: true
      });
      previousConnectorX = chosen.x;
      previousConnectorY = chosen.y;
    }

    state.ents.push({
      type: "goal",
      x: L.length - 120,
      y: H / 2 - 40,
      w: 40, h: 80, alive: true
    });

    banner(L.name);
  }

  function flap() {
    if (state.mode !== "play") return;
    state.player.vy = LEVELS[state.level].flap;
    state.kick = 8;
    audio.flap();
    state.bubbles.push({
      x: state.player.x - 10,
      y: state.player.y + 20,
      vy: -0.8, life: 40
    });
  }

  function trabajeen() {
    if (state.mode !== "play") return;
    const L = LEVELS[state.level];
    if (state.trabajeen <= 0 || L.squad <= 0) {
      addScoreEffect(state.player.x + 26, state.player.y - 12, "NO CHARGES", "#cde8f5");
      return;
    }
    state.trabajeen--;
    state.shoutPulse = 24;
    state.shoutText = 50;
    audio.shout();
    banner("TRABAAAJEEN!");

    state.squad.forEach((s) => { s.fire = 22; });

    const px = state.player.x + state.player.w / 2;
    const py = state.player.y + state.player.h / 2;
    const foes = state.ents.filter((e) => {
      if (!e.alive) return false;
      if (state.level === 1) return e.type === "shark";
      return e.type === "bug" || e.type === "cannon" || e.type === "bolt" || e.type === "shark";
    });
    foes.sort((a, b) => {
      const da = (a.x - px) ** 2 + (a.y - py) ** 2;
      const db = (b.x - px) ** 2 + (b.y - py) ** 2;
      return da - db;
    });
    const n = Math.min(L.killN, foes.length);
    for (let i = 0; i < n; i++) {
      const e = foes[i];
      e.alive = false;
      const points = e.type === "cannon" ? 80 : 50;
      state.score += points;
      addScoreEffect(e.x + 8, e.y + 4, "+" + points, "#ffd86b");
      burst(e.x + 8, e.y + 4, "#ff8040", 12);
      state.ents.push({
        type: "rocket",
        x: state.player.x + 20,
        y: state.player.y + 10,
        tx: e.x + 8,
        ty: e.y + 4,
        life: 18,
        alive: true
      });
    }
    if (n) audio.boom();
  }

  function damage() {
    if (state.invuln > 0) return;
    state.health--;
    state.invuln = 70;
    state.hurtTimer = 18;
    state.damageFlash = 10;
    state.shakeLife = reducedMotion ? 0 : 10;
    state.shakeDuration = 10;
    audio.hit();
    burst(state.player.x + 30, state.player.y + 16, "#ff6080", 12);
    if (state.health <= 0) {
      state.mode = "dead";
      persistSavedProgress({ bestVested: Math.max(savedProgress.bestVested, state.vested) });
    }
  }

  function finishLevel() {
    if (state.finishing || state.health <= 0) return;
    state.finishing = true;
    const completionBonus = 200 + state.score + state.linked * 80 + state.health * 50;
    state.transitionReward = state.distanceVested + completionBonus;
    state.vested += completionBonus;
    persistSavedProgress({
      bestVested: Math.max(savedProgress.bestVested, state.vested),
      highestUnlockedLevel: Math.max(savedProgress.highestUnlockedLevel, Math.min(state.level + 1, LEVELS.length - 1))
    });
    state.score = 0;
    audio.win();
    if (state.level >= LEVELS.length - 1) {
      state.mode = "win";
      return;
    }
    state.transitionTimer = 90;
    state.mode = "level-transition";
  }

  function startGame(fromCheckpoint, checkpointLevel, runSeed) {
    const retryingAfterDeath = state.mode === "dead";
    audio.ensure();
    state.mode = "play";
    state.runSeed = runSeed ?? createRunSeed();
    state.score = 0;
    state.health = 3;
    if (!fromCheckpoint) {
      state.level = 0;
      state.vested = 0;
      state.checkpoint = 0;
    } else {
      state.level = Math.max(0, Math.min(LEVELS.length - 1, checkpointLevel ?? state.checkpoint ?? 0));
      state.checkpoint = state.level;
      if (retryingAfterDeath) state.vested = state.levelStartVested;
    }
    spawnLevel();
    updateControlLabels();
  }

  function update() {
    if (KEY.KeyM) {
      audio.muted = !audio.muted;
      KEY.KeyM = false;
      persistSavedProgress({ muted: audio.muted });
      updateControlLabels();
    }
    if (KEY.KeyR) {
      reducedMotion = !reducedMotion;
      KEY.KeyR = false;
      persistSavedProgress({ reducedEffects: reducedMotion });
      updateControlLabels();
    }
    if (KEY.KeyH) {
      showHitboxes = !showHitboxes;
      KEY.KeyH = false;
    }

    if (state.mode === "title") {
      if (KEY.KeyC) {
        KEY.KeyC = false;
        if (savedProgress.highestUnlockedLevel <= 0) return;
        KEY.Enter = KEY.Space = KEY.Pointer = false;
        startGame(true, savedProgress.highestUnlockedLevel);
        return;
      }
      if (KEY.Enter || KEY.Space || KEY.Pointer) {
        KEY.Enter = KEY.Space = KEY.Pointer = KEY.KeyC = false;
        startGame(false);
      }
      return;
    }
    if (state.mode === "dead" || state.mode === "win") {
      if (KEY.Enter || KEY.Space || KEY.Pointer) {
        KEY.Enter = KEY.Space = KEY.Pointer = false;
        startGame(state.mode === "dead" && state.checkpoint > 0, state.checkpoint, state.runSeed);
      }
      return;
    }

    if (state.mode === "level-transition") {
      KEY.KeyP = KEY.Escape = false;
      state.transitionTimer--;
      if (state.transitionTimer <= 0) {
        state.level++;
        state.checkpoint = state.level;
        state.health = Math.min(state.maxHealth, state.health + 1);
        state.mode = "play";
        spawnLevel();
      }
      return;
    }

    if ((KEY.KeyP || KEY.Escape) && ["play", "paused"].includes(state.mode)) {
      state.mode = state.mode === "paused" ? "play" : "paused";
      KEY.KeyP = KEY.Escape = false;
      updateControlLabels();
      return;
    }
    if (state.mode === "paused") return;

    state.t++;

    const L = LEVELS[state.level];
    const p = state.player;

    if (KEY.Space || KEY.ArrowUp || KEY.Pointer) {
      flap();
      KEY.Space = KEY.ArrowUp = KEY.Pointer = false;
    }
    if (KEY.KeyT) {
      trabajeen();
      KEY.KeyT = false;
    }

    p.vy += L.gravity;
    p.y += p.vy;
    if (p.y < 36) { p.y = 36; p.vy = 0; }
    if (p.y > H - 56) { p.y = H - 56; damage(); p.vy = -3; }

    state.dist += L.speed;
    const distanceVested = Math.min(Math.floor(state.dist / VESTING_DISTANCE_STEP), Math.floor(L.length / VESTING_DISTANCE_STEP));
    if (distanceVested > state.distanceVested) {
      state.vested += distanceVested - state.distanceVested;
      state.distanceVested = distanceVested;
    }
    if (state.kick > 0) state.kick--;
    if (state.shoutPulse > 0) state.shoutPulse--;
    if (state.shoutText > 0) state.shoutText--;
    if (state.invuln > 0) state.invuln--;
    if (state.hurtTimer > 0) state.hurtTimer--;
    if (state.bannerLife > 0) state.bannerLife--;
    if (state.shakeLife > 0) state.shakeLife--;
    if (state.damageFlash > 0) state.damageFlash--;
    for (const effect of state.effects) {
      effect.life--;
      if (effect.type === "text") effect.y += effect.vy;
    }
    state.effects = state.effects.filter((effect) => effect.life > 0);

    state.squad.forEach((s, i) => {
      const tx = p.x - 70 - i * 34;
      const ty = p.y + (i % 2 ? 32 : -30);
      s.x += (tx - s.x) * 0.12;
      s.y += (ty - s.y) * 0.12;
      s.kick = (state.t + i * 4) % 12 < 6 ? 1 : 0;
      if (s.fire > 0) s.fire--;
    });

    if (state.t % 16 === 0) {
      state.bubbles.push({
        x: p.x + 8,
        y: p.y + 18,
        vy: -0.7 - Math.random(),
        life: 50
      });
    }
    for (const b of state.bubbles) { b.y += b.vy; b.x -= L.speed * 0.3; b.life--; }
    state.bubbles = state.bubbles.filter((b) => b.life > 0);
    for (const pt of state.parts) { pt.x += pt.vx - L.speed * 0.4; pt.y += pt.vy; pt.life--; }
    state.parts = state.parts.filter((pt) => pt.life > 0);

    const scroll = L.speed;
    const hitbox = { x: p.x + 12, y: p.y + 8, w: p.w - 24, h: p.h - 14 };

    for (const e of state.ents) {
      if (!e.alive && e.type !== "connector") continue;
      if (e.type !== "rocket") e.x -= scroll;

      if (L.fire && e.type === "cannon" && e.alive && e.side === "top" && state.t % (48 - state.level * 3) === 0 && e.x > 80 && e.x < W - 40) {
        state.ents.push({
          type: "bolt",
          x: e.x - 8,
          y: e.h - 8,
          w: 16, h: 8,
          vx: -4.2,
          vy: 1.6,
          alive: true
        });
      }

      if (e.type === "shark" && e.alive) {
        e.x -= e.vx;
        e.y += e.vy;
        if (e.y < 50 || e.y > H - 70) e.vy *= -1;
        if (aabb(hitbox, e)) damage();
      }

      if (e.type === "bug" && e.alive) {
        e.y += e.vy;
        if (e.y < 50 || e.y > H - 70) e.vy *= -1;
        if (aabb(hitbox, e)) damage();
      }

      if (e.type === "cannon" && e.alive && aabb(hitbox, e)) damage();

      if (e.type === "bolt" && e.alive) {
        e.x += e.vx;
        e.y += e.vy;
        if (aabb(hitbox, e)) { e.alive = false; damage(); }
        if (e.x < -20 || e.y > H) e.alive = false;
      }

      if (e.type === "connector" && !e.linked && !e.missed && aabb(hitbox, e)) {
        e.linked = true;
        state.linked++;
        state.score += 120;
        addEffect({ type: "ring", x: e.x + 16, y: e.y + 16, color: "#7fd7ff", life: 24, duration: 24 });
        addScoreEffect(e.x + 16, e.y + 4, "+120", "#7fd7ff");
        audio.link();
        burst(e.x + 16, e.y + 16, "#7fd7ff", 10);
        const prev = state.ents.filter((o) => o.type === "connector" && o.linked);
        if (prev.length > 1) {
          const a = prev[prev.length - 2];
          state.links.push({
            ax: a.x + 16, ay: a.y + 16,
            bx: e.x + 16, by: e.y + 16
          });
        }
        banner("LINKED " + state.linked + "/" + state.needLink);
      }

      if (e.type === "connector" && !e.linked && !e.missed && e.x + e.w < hitbox.x) {
        e.missed = true;
        damage();
        burst(e.x + 16, e.y + 16, "#ff6080", 8);
        banner("MISSED CONNECTOR");
      }

      if (e.type === "rocket") {
        e.life--;
        e.x += (e.tx - e.x) * 0.25;
        e.y += (e.ty - e.y) * 0.25;
        if (e.life <= 0) e.alive = false;
      }

      if (e.type === "goal" && aabb(hitbox, e)) finishLevel();
    }

    for (const ln of state.links) {
      ln.ax -= scroll;
      ln.bx -= scroll;
    }

    if (state.dist > L.length + 40) finishLevel();
  }

  function drawBg() {
    const L = LEVELS[state.level] || LEVELS[0];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, L.sky[0]);
    g.addColorStop(0.55, L.sky[1]);
    g.addColorStop(1, L.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 200 - state.dist * 0.15) % (W + 220)) - 40;
      ctx.fillStyle = "#b8e8ff";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 40, 0);
      ctx.lineTo(x + 110, H);
      ctx.lineTo(x + 20, H);
      ctx.fill();
    }
    ctx.restore();

    const farOffset = ((state.dist * 0.09) % 240 + 240) % 240;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#17404a";
    for (let x = -240 - farOffset; x < W + 240; x += 240) {
      ctx.beginPath();
      ctx.moveTo(x, H - 16);
      ctx.lineTo(x + 12, H - 66);
      ctx.lineTo(x + 44, H - 84);
      ctx.lineTo(x + 82, H - 58);
      ctx.lineTo(x + 126, H - 112);
      ctx.lineTo(x + 166, H - 70);
      ctx.lineTo(x + 210, H - 92);
      ctx.lineTo(x + 240, H - 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Decorative fish stay in the background and never enter entity or collision state.
    const fishTrack = W + 220;
    const fishParallax = state.dist * 0.18;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let school = 0; school < 5; school++) {
      const wrappedX = ((school * 217 + 42 - fishParallax) % fishTrack + fishTrack) % fishTrack;
      const schoolX = wrappedX - 110;
      const schoolY = 82 + (school * 71) % 330;
      const kind = school % FISH_PALETTES.length;
      const count = 2 + school % 2;
      const size = 0.75 + (school % 2) * 0.1;
      ctx.globalAlpha = 0.72 + (school % 2) * 0.04;
      for (let fish = 0; fish < count; fish++) {
        const sprite = SPR.fish[kind][reducedMotion ? 0 : (Math.floor(state.t / 8) + fish + school) % 2];
        const fishW = sprite.width * size;
        const fishH = sprite.height * size;
        const fishX = schoolX + fish * (fishW * 0.72);
        const swim = reducedMotion ? 0 : Math.sin(state.t * 0.055 + school + fish) * 2;
        ctx.save();
        ctx.translate(fishX + fishW / 2, schoolY + swim + fishH / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -fishW / 2, -fishH / 2, fishW, fishH);
        ctx.restore();
      }
    }
    ctx.restore();

    const kelpTrack = W + 180;
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#1a5654";
    ctx.lineWidth = 3;
    ctx.lineCap = "square";
    for (let kelp = 0; kelp < 9; kelp++) {
      const wrappedX = ((kelp * 137 + 28 - state.dist * 0.42) % kelpTrack + kelpTrack) % kelpTrack;
      const x = wrappedX - 90;
      const height = 28 + (kelp * 17) % 38;
      const sway = reducedMotion ? 0 : Math.sin(state.t * 0.025 + kelp) * 3;
      ctx.beginPath();
      ctx.moveTo(x, H - 16);
      ctx.lineTo(x + 3, H - 16 - height * 0.5);
      ctx.lineTo(x + sway, H - 16 - height);
      ctx.moveTo(x + 3, H - 16 - height * 0.5);
      ctx.lineTo(x - 10 + sway, H - 20 - height * 0.7);
      ctx.moveTo(x + 2, H - 18 - height * 0.7);
      ctx.lineTo(x + 12 + sway, H - 18 - height * 0.85);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = L.accent;
    const par = state.dist * 0.35;
    for (let x = -((par | 0) % 70); x < W; x += 70) {
      ctx.strokeRect(x + 8, 70 + Math.sin((x + par) / 80) * 18, 36, 16);
    }
    ctx.restore();

    ctx.fillStyle = "#07141c";
    ctx.fillRect(0, H - 16, W, 16);
    ctx.fillStyle = L.accent;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 20; i++) {
      const x = ((i * 90 - state.dist * 0.8) % (W + 90));
      ctx.fillRect(x, H - 16, 40, 6);
    }
    ctx.globalAlpha = 1;
  }

  function drawEntity(e) {
    if (e.type === "cannon" && e.alive) {
      const bodyY = e.side === "top" ? 0 : e.y + 40;
      const bodyH = e.side === "top" ? Math.max(0, e.h - 20) : Math.max(0, e.h - 40);
      ctx.fillStyle = "#061e28";
      ctx.fillRect(e.x + 7, bodyY, 38, bodyH);
      ctx.fillStyle = "#155348";
      ctx.fillRect(e.x + 11, bodyY, 29, bodyH);
      ctx.fillStyle = "#2b8067";
      ctx.fillRect(e.x + 13, bodyY, 4, bodyH);
      ctx.fillStyle = "#0c3838";
      ctx.fillRect(e.x + 34, bodyY, 5, bodyH);
      for (let y = Math.ceil(bodyY / 38) * 38; y < bodyY + bodyH; y += 38) {
        ctx.fillStyle = "#092b32";
        ctx.fillRect(e.x + 9, y, 33, 5);
        ctx.fillStyle = "#6ba889";
        ctx.fillRect(e.x + 11, y, 31, 2);
        ctx.fillStyle = "#e9b957";
        ctx.fillRect(e.x + 20, y + 12, 9, 3);
        ctx.fillStyle = "#0a2933";
        ctx.fillRect(e.x + 20, y + 16, 9, 3);
      }
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      for (let y = bodyY + 22; y + 12 < bodyY + bodyH; y += 92) {
        ctx.fillStyle = "#08272f";
        ctx.fillRect(e.x + 16, y, 25, 12);
        ctx.fillStyle = "#c4e6c5";
        ctx.fillText("SAP", e.x + 28.5, y + 9);
        ctx.fillStyle = "#e3b34f";
        ctx.fillRect(e.x + 15, y + 2, 2, 8);
      }
      ctx.textAlign = "left";
      if (e.side === "top") {
        ctx.drawImage(SPR.cannonL, e.x, e.h - 52);
      } else {
        ctx.drawImage(SPR.cannonL, e.x, e.y);
      }
    } else if (e.type === "shark" && e.alive) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
      ctx.scale(-1, 1);
      const sprite = SPR.shark[(state.t >> 3) % SPR.shark.length];
      ctx.drawImage(sprite.image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, -e.w / 2, -e.h / 2, e.w, e.h);
      ctx.restore();
    } else if (e.type === "bug" && e.alive) {
      const sprite = SPR.bugs[e.kind];
      const frame = (state.t >> 4) % 2;
      const fit = Math.min((e.w + 4) / sprite.sw, (e.h + 4) / sprite.sh);
      const drawW = sprite.sw * fit * (frame ? 0.98 : 1);
      const drawH = sprite.sh * fit * (frame ? 1 : 0.98);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(e.x + e.w / 2, e.y + e.h / 2 + (frame ? 1 : -1));
      ctx.scale(-1, 1);
      ctx.drawImage(sprite.image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
      const label = BUGS[e.kind].short;
      ctx.font = "bold 7px monospace";
      const labelWidth = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(7, 15, 28, 0.82)";
      ctx.fillRect(e.x + (e.w - labelWidth - 4) / 2, e.y + e.h - 9, labelWidth + 4, 9);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(label, e.x + e.w / 2, e.y + e.h - 2);
      ctx.textAlign = "left";
    } else if (e.type === "connector") {
      ctx.save();
      ctx.globalAlpha = e.missed ? 0.25 : (e.linked ? 0.5 : 1);
      if (!e.linked && !e.missed) {
        const pulse = reducedMotion ? 0 : (state.t >> 3) % 2;
        ctx.fillStyle = pulse ? "#b8f9ec" : "#67cabd";
        ctx.fillRect(e.x + 12, e.y - 5, 12, 3);
        ctx.fillRect(e.x + 12, e.y + 34, 12, 3);
        ctx.fillRect(e.x - 5, e.y + 12, 3, 12);
        ctx.fillRect(e.x + 34, e.y + 12, 3, 12);
      }
      ctx.drawImage(SPR.connectors[e.kind], e.x - 2, e.y - 2);
      if (e.linked) {
        ctx.fillStyle = "#b8f9ec";
        ctx.fillRect(e.x + 2, e.y + 2, 5, 3);
        ctx.fillRect(e.x + 27, e.y + 27, 5, 3);
      }
      ctx.restore();
    } else if (e.type === "bolt" && e.alive) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#f2a900";
      ctx.fillRect(e.x + 13, e.y + 3, 13, 2);
      ctx.restore();
      ctx.drawImage(SPR.bolt, e.x, e.y, e.w, e.h);
    } else if (e.type === "rocket" && e.alive) {
      ctx.drawImage(SPR.rocket, e.x, e.y);
    } else if (e.type === "goal" && e.alive) {
      ctx.drawImage(SPR.flag, e.x, e.y);
      ctx.fillStyle = "#f0d060";
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.fillText("END", e.x - 4, e.y - 6);
    }
  }

  function drawHero() {
    const p = state.player;
    if (state.invuln > 0 && state.t % 6 < 2) return;
    const swimCycle = [SPR.hero.swim, SPR.hero.swim_3, SPR.hero.swim_2, SPR.hero.swim_3];
    let img = null;
    if (SPR.hero.ready) {
      if (state.hurtTimer > 0) img = SPR.hero.hurt || SPR.hero.swim;
      else if (state.shoutPulse > 0) img = SPR.hero.shout || SPR.hero.swim;
      else if (p.vy > 4.2) img = SPR.hero.dive || SPR.hero.swim;
      else img = swimCycle[Math.floor(state.t / 6) % swimCycle.length] || SPR.hero.swim;
    }
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    const tilt = Math.max(-0.35, Math.min(0.4, p.vy * 0.045));
    ctx.rotate(tilt);
    if (img) ctx.drawImage(img, -img.width / 2, -img.height / 2);
    else {
      ctx.fillStyle = "#143848";
      ctx.fillRect(-24, -12, 48, 24);
    }
    ctx.restore();
  }

  function drawSquad() {
    for (const s of state.squad) {
      const frame = s.fire > 0 ? SPR.side.fire : (s.kick ? SPR.side.kickA : SPR.side.kickB);
      ctx.drawImage(frame, s.x, s.y);
    }
  }

  function drawDebugHitboxes() {
    const p = state.player;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ff5577";
    ctx.strokeRect(p.x + 12 + 0.5, p.y + 8 + 0.5, p.w - 24, p.h - 14);
    for (const e of state.ents) {
      if (!e.alive || !["shark", "bug", "connector", "cannon", "bolt"].includes(e.type)) continue;
      ctx.strokeStyle = e.type === "connector" ? "#7fd7ff" : "#ffe680";
      ctx.strokeRect(e.x + 0.5, e.y + 0.5, e.w, e.h);
    }
    ctx.fillStyle = "rgba(4, 16, 24, 0.85)";
    ctx.fillRect(8, 42, 112, 18);
    ctx.fillStyle = "#ff9aae";
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.fillText("HITBOX DEBUG [H]", 12, 55);
    ctx.restore();
  }

  function drawHud() {
    const L = LEVELS[state.level];
    ctx.fillStyle = "rgba(4,16,24,0.75)";
    ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = "#f0d060";
    ctx.font = "11px 'Press Start 2P', monospace";
    ctx.fillText("VESTED  $" + String(state.vested).padStart(6, "0"), 10, 24);
    ctx.fillStyle = "#7fd7ff";
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillText("L" + (state.level + 1) + " " + L.name, 250, 23);

    ctx.fillStyle = "#cde8f5";
    const maxT = L.shouts ?? 3;
    ctx.fillText("T x" + state.trabajeen, 600, 23);
    for (let i = 0; i < maxT; i++) {
      ctx.fillStyle = i < state.trabajeen ? "#00a1e0" : "#1a3038";
      ctx.fillRect(668 + i * 12, 10, 10, 16);
    }

    for (let i = 0; i < state.maxHealth; i++) {
      ctx.fillStyle = i < state.health ? "#3ecf8e" : "#1a3030";
      ctx.fillRect(W - 22 - i * 18, 10, 14, 16);
    }

    if (L.connectors) {
      ctx.fillStyle = "#7fd7ff";
      ctx.font = "16px 'VT323', monospace";
      ctx.fillText("LINKS " + state.linked + "/" + state.needLink, 10, H - 12);
    }

    const prog = Math.min(1, state.dist / L.length);
    ctx.fillStyle = "#123040";
    ctx.fillRect(W - 180, H - 16, 160, 6);
    ctx.fillStyle = "#f0d060";
    ctx.fillRect(W - 180, H - 16, 160 * prog, 6);
  }

  function drawString() {
    const nodes = state.ents.filter((e) => e.type === "connector" && e.linked);
    if (!nodes.length && !state.needLink) return;
    const p = state.player;
    ctx.save();
    const points = nodes.map((n) => ({ x: n.x + 16, y: n.y + 16 }));
    points.push({ x: p.x + 8, y: p.y + p.h / 2 + 6 });
    ctx.strokeStyle = "#092832";
    ctx.lineWidth = 7;
    ctx.lineJoin = "bevel";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.strokeStyle = "#64c6b4";
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 5]);
    ctx.lineDashOffset = reducedMotion ? 0 : -(state.t % 14);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const node of points.slice(0, -1)) {
      ctx.fillStyle = "#092832";
      ctx.fillRect(node.x - 5, node.y - 5, 10, 10);
      ctx.fillStyle = "#b5f5d7";
      ctx.fillRect(node.x - 2, node.y - 2, 4, 4);
    }
    ctx.fillStyle = "#092832";
    ctx.fillRect(p.x + 1, p.y + p.h / 2 + 1, 12, 12);
    ctx.fillStyle = "#f0d060";
    ctx.fillRect(p.x + 4, p.y + p.h / 2 + 4, 6, 6);
    ctx.restore();
  }

  function drawPlay() {
    drawBg();
    ctx.save();
    if (!reducedMotion && state.shakeLife > 0) {
      const strength = 4 * (state.shakeLife / state.shakeDuration);
      ctx.translate(
        Math.sin(state.t * 2.7) * strength,
        Math.cos(state.t * 3.1) * strength
      );
    }

    drawString();
    for (const e of state.ents) drawEntity(e);
    drawSquad();
    drawHero();

    if (state.shoutText > 0) {
      const p = state.player;
      ctx.fillStyle = "#f4f7fb";
      ctx.beginPath();
      ctx.roundRect(p.x + 40, p.y - 28, 168, 26, 8);
      ctx.fill();
      ctx.fillStyle = "#102028";
      ctx.font = "bold 16px 'VT323', monospace";
      ctx.fillText("Trabaaaajeen!", p.x + 50, p.y - 10);
    }

    for (const b of state.bubbles) {
      ctx.globalAlpha = Math.min(1, b.life / 24);
      ctx.drawImage(SPR.bubble, b.x, b.y);
      ctx.globalAlpha = 1;
    }
    for (const pt of state.parts) {
      ctx.globalAlpha = Math.min(1, pt.life / 14);
      ctx.fillStyle = "#082b34";
      ctx.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, pt.s + 2, pt.s + 2);
      ctx.fillStyle = pt.c;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.s, pt.s);
      ctx.globalAlpha = 1;
    }

    for (const effect of state.effects) {
      const progress = 1 - effect.life / effect.duration;
      const alpha = Math.min(1, effect.life / 12);
      if (effect.type === "ring") {
        ctx.globalAlpha = alpha;
        const radius = reducedMotion ? 16 : 8 + progress * 30;
        const size = Math.round(radius * 2);
        const left = Math.round(effect.x - radius);
        const top = Math.round(effect.y - radius);
        ctx.fillStyle = "#092b34";
        ctx.fillRect(left - 2, top - 2, size + 4, 4);
        ctx.fillRect(left - 2, top + size - 2, size + 4, 4);
        ctx.fillRect(left - 2, top, 4, size);
        ctx.fillRect(left + size - 2, top, 4, size);
        ctx.fillStyle = effect.color;
        ctx.fillRect(left, top, size, 2);
        ctx.fillRect(left, top + size - 2, size, 2);
        ctx.fillRect(left, top, 2, size);
        ctx.fillRect(left + size - 2, top, 2, size);
        ctx.globalAlpha = 1;
      } else if (effect.type === "text") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = effect.color;
        ctx.font = "bold 24px 'VT323', monospace";
        ctx.textAlign = "center";
        ctx.fillText(effect.text, effect.x, effect.y);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }
    }

    if (showHitboxes) drawDebugHitboxes();

    if (state.banner && state.bannerLife > 0) {
      ctx.globalAlpha = Math.min(1, state.bannerLife / 18);
      ctx.fillStyle = "#ffe680";
      ctx.font = "12px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText(state.banner, W / 2, 64);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }

    drawHud();
    ctx.restore();

    if (state.damageFlash > 0) {
      ctx.globalAlpha = (state.damageFlash / 10) * 0.22;
      ctx.fillStyle = "#ff3048";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function drawLevelTransition() {
    drawPlay();
    ctx.fillStyle = "rgba(0, 8, 14, 0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0d060";
    ctx.font = "16px 'Press Start 2P', monospace";
    ctx.fillText("LEVEL COMPLETE", W / 2, H / 2 - 32);
    ctx.fillStyle = "#cde8f5";
    ctx.font = "30px 'VT323', monospace";
    ctx.fillText("Vested +$" + state.transitionReward, W / 2, H / 2 + 8);
    ctx.font = "22px 'VT323', monospace";
    ctx.fillText("Next: " + LEVELS[state.level + 1].name, W / 2, H / 2 + 40);
    ctx.textAlign = "left";
  }

  function drawPauseOverlay() {
    ctx.fillStyle = "rgba(0, 8, 14, 0.68)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0d060";
    ctx.font = "20px 'Press Start 2P', monospace";
    ctx.fillText("PAUSED", W / 2, H / 2 - 8);
    ctx.fillStyle = "#cde8f5";
    ctx.font = "24px 'VT323', monospace";
    ctx.fillText("Press P / ESC or tap RESUME", W / 2, H / 2 + 28);
    ctx.textAlign = "left";
  }

  function drawTitle() {
    drawBg();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0d060";
    ctx.font = "20px 'Press Start 2P', monospace";
    ctx.fillText("EL PATRON", W / 2, 120);
    ctx.fillStyle = "#7fd7ff";
    ctx.font = "12px 'Press Start 2P', monospace";
    ctx.fillText("THE VESTING HORIZON", W / 2, 150);
    const hero = SPR.hero.ready ? SPR.hero.thumbs : null;
    if (hero) ctx.drawImage(hero, W / 2 - hero.width / 2, 168);
    ctx.fillStyle = "#cde8f5";
    ctx.font = "26px 'VT323', monospace";
    ctx.fillText("Dodge SAP cannons and sharks. Link Anypoint connectors.", W / 2, 320);
    ctx.fillText("SPACE flap   ·   T Trabajeen!   ·   P pause   ·   M mute   ·   R effects", W / 2, 348);
    ctx.fillStyle = "#f0d060";
    ctx.fillText("ENTER / SPACE: NEW RUN", W / 2, 390);
    if (savedProgress.highestUnlockedLevel > 0) {
      ctx.fillText("C: CONTINUE FROM L" + (savedProgress.highestUnlockedLevel + 1), W / 2, 420);
    }
    ctx.fillStyle = "#7fb4c8";
    ctx.font = "20px 'VT323', monospace";
    ctx.fillText("BEST VESTED: $" + savedProgress.bestVested + "   ·   X: RESET SAVED DATA", W / 2, 454);
    ctx.textAlign = "left";
  }

  function drawEnd(win) {
    drawPlay();
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0d060";
    ctx.font = "16px 'Press Start 2P', monospace";
    ctx.fillText(win ? "SAP CONQUERED · IPO" : "RUNTIME CRASH", W / 2, 220);
    ctx.fillStyle = "#cde8f5";
    ctx.font = "28px 'VT323', monospace";
    ctx.fillText("Vested options: $" + state.vested, W / 2, 270);
    ctx.fillText(state.checkpoint > 0 && !win ? "ENTER resume from L" + (state.checkpoint + 1) : "ENTER to dive again", W / 2, 314);
    ctx.font = "22px 'VT323', monospace";
    ctx.fillText("Run seed: " + state.runSeed, W / 2, 348);
    ctx.textAlign = "left";
  }

  const STEP_MS = 1000 / 60;
  let previousFrameTime = null;
  let accumulator = 0;
  document.addEventListener("visibilitychange", () => {
    previousFrameTime = null;
    accumulator = 0;
    if (document.hidden) {
      KEY.Space = KEY.ArrowUp = KEY.Pointer = KEY.KeyT = false;
    }
  });

  function frame(now) {
    if (previousFrameTime === null) previousFrameTime = now;
    accumulator += Math.min(now - previousFrameTime, 100);
    previousFrameTime = now;
    let steps = 0;
    while (accumulator >= STEP_MS && steps < 6) {
      update();
      accumulator -= STEP_MS;
      steps++;
      if (state.mode === "paused") {
        accumulator = 0;
        break;
      }
    }
    if (steps === 6) accumulator = 0;

    if (state.mode === "title") drawTitle();
    else if (state.mode === "dead") drawEnd(false);
    else if (state.mode === "win") drawEnd(true);
    else if (state.mode === "level-transition") drawLevelTransition();
    else {
      drawPlay();
      if (state.mode === "paused") drawPauseOverlay();
    }
    requestAnimationFrame(frame);
  }

  updateControlLabels();
  requestAnimationFrame(frame);
})();
