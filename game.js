(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  const W = canvas.width;
  const H = canvas.height;

  const KEY = {};
  addEventListener("keydown", (e) => {
    KEY[e.code] = true;
    if (["Space", "ArrowUp", "KeyT"].includes(e.code)) e.preventDefault();
  });
  addEventListener("keyup", (e) => { KEY[e.code] = false; });
  canvas.addEventListener("pointerdown", () => { KEY.Pointer = true; });

  const audio = {
    ctx: null,
    ensure() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    beep(freq, dur, type, vol, slide) {
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
    const names = ["idle", "swim", "shout", "dive", "hurt", "thumbs", "ray"];
    let left = names.length;
    names.forEach((n) => {
      const img = new Image();
      img.onload = () => {
        SPR.hero[n] = img;
        if (--left === 0) SPR.hero.ready = true;
      };
      img.onerror = () => { left--; };
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
    pxBox(g, 18, 8, 28, 48, "#0d6b4a");
    pxBox(g, 22, 12, 20, 40, "#085c3e");
    disc(g, 32, 32, 10, "#f2a900");
    g.fillStyle = "#fff";
    g.font = "bold 11px sans-serif";
    g.fillText("SAP", 21, 36);
    pxBox(g, 4, 26, 16, 10, "#333");
    pxBox(g, 0, 28, 8, 6, "#666");
  }
  SPR.cannonL = makeCanvas(50, 64, sapCannon);
  SPR.cannonR = makeCanvas(50, 64, (g) => {
    g.translate(50, 0);
    g.scale(-1, 1);
    sapCannon(g);
  });

  SPR.bolt = makeCanvas(18, 8, (g) => {
    pxBox(g, 0, 2, 18, 4, "#f2a900");
    pxBox(g, 12, 0, 6, 8, "#ffe08a");
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
  SPR.shark = [makeCanvas(118, 50, (g) => drawShark(g, 0)), makeCanvas(118, 50, (g) => drawShark(g, 1))];

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

  SPR.bugs = BUGS.map((b) => makeCanvas(44, 36, (g) => {
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
    g.fillStyle = "#fff";
    g.font = "bold 8px sans-serif";
    g.fillText(b.short, 12, 28);
  }));

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
    disc(g, 18, 18, 16, "#0a2430");
    disc(g, 18, 18, 14, c.bg);
    disc(g, 13, 13, 4, "rgba(255,255,255,0.35)");
    g.fillStyle = "#fff";
    g.font = "bold 8px sans-serif";
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
      shouts: 6
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
      shouts: 6
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
      shouts: 6
    }
  ];

  const state = {
    mode: "title",
    level: 0,
    t: 0,
    dist: 0,
    score: 0,
    vested: 0,
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
    bubbles: [],
    links: [],
    linked: 0,
    needLink: 0,
    banner: null,
    bannerLife: 0,
    winTimer: 0,
    checkpoint: 0
  };

  function banner(text) {
    state.banner = text;
    state.bannerLife = 130;
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function burst(x, y, c, n) {
    for (let i = 0; i < n; i++) {
      state.parts.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 18 + Math.random() * 16,
        c, s: 2 + Math.random() * 3
      });
    }
  }

  function spawnLevel() {
    const L = LEVELS[state.level];
    state.ents = [];
    state.parts = [];
    state.bubbles = [];
    state.links = [];
    state.linked = 0;
    state.needLink = L.connectors;
    state.dist = 0;
    state.trabajeen = L.shouts || 3;
    state.shoutPulse = 0;
    state.shoutText = 0;
    state.invuln = 40;
    state.winTimer = 0;
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
        const gap = gapBase + Math.random() * 30;
        const gy = 90 + Math.random() * (H - 220 - gap);
        state.ents.push({
          type: "cannon", side: "top",
          x, y: 0, w: 46, h: gy, gy, gap, alive: true
        });
        state.ents.push({
          type: "cannon", side: "bot",
          x, y: gy + gap, w: 46, h: H - (gy + gap), gy, gap, alive: true
        });
        x += 300 + Math.random() * 90 - state.level * 8;
      }
    }

    if (L.sharks) {
      for (let i = 0; i < L.sharks; i++) {
        state.ents.push({
          type: "shark",
          x: 640 + i * 780 + Math.random() * 80,
          y: 90 + Math.random() * (H - 180),
          w: 100, h: 34,
          vy: (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.35),
          vx: 1.1 + Math.random() * 0.5,
          alive: true
        });
      }
    }

    if (L.bugs) {
      for (let i = 0; i < 8 + state.level * 2; i++) {
        const kind = i % 3;
        state.ents.push({
          type: "bug", kind,
          x: 500 + i * 280 + Math.random() * 80,
          y: 80 + Math.random() * (H - 160),
          w: 40, h: 30,
          vy: (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random()),
          alive: true
        });
      }
    }

    for (let i = 0; i < L.connectors; i++) {
      state.ents.push({
        type: "connector", kind: i % CONNECTORS.length,
        x: 520 + i * ((L.length - 900) / Math.max(1, L.connectors)),
        y: 90 + (i * 97) % (H - 180),
        w: 32, h: 32, linked: false, missed: false, alive: true
      });
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
    if (state.trabajeen <= 0 || L.squad <= 0) return;
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
      state.score += e.type === "cannon" ? 80 : 50;
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
    audio.hit();
    burst(state.player.x + 30, state.player.y + 16, "#ff6080", 12);
    if (state.health <= 0) state.mode = "dead";
  }

  function finishLevel() {
    const L = LEVELS[state.level];
    if (state.health <= 0) return;
    const gained = 200 + state.score + state.linked * 80 + state.health * 50;
    state.vested += gained;
    state.score = 0;
    audio.win();
    if (state.level >= LEVELS.length - 1) {
      state.mode = "win";
      return;
    }
    state.level++;
    state.checkpoint = state.level;
    state.health = Math.min(state.maxHealth, state.health + 1);
    spawnLevel();
  }

  function startGame(fromCheckpoint) {
    audio.ensure();
    state.mode = "play";
    state.score = 0;
    state.health = 3;
    if (!fromCheckpoint) {
      state.level = 0;
      state.vested = 0;
      state.checkpoint = 0;
    } else {
      state.level = state.checkpoint || 0;
    }
    spawnLevel();
  }

  function update() {
    state.t++;

    if (state.mode === "title") {
      if (KEY.Enter || KEY.Space || KEY.Pointer) {
        KEY.Enter = KEY.Space = KEY.Pointer = false;
        startGame(false);
      }
      return;
    }
    if (state.mode === "dead" || state.mode === "win") {
      if (KEY.Enter || KEY.Space || KEY.Pointer) {
        KEY.Enter = KEY.Space = KEY.Pointer = false;
        startGame(state.mode === "dead" && state.checkpoint > 0);
      }
      return;
    }

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
    if (state.kick > 0) state.kick--;
    if (state.shoutPulse > 0) state.shoutPulse--;
    if (state.shoutText > 0) state.shoutText--;
    if (state.invuln > 0) state.invuln--;
    if (state.bannerLife > 0) state.bannerLife--;

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
      if (e.side === "top") {
        ctx.fillStyle = "#0d6b4a";
        ctx.fillRect(e.x + 10, 0, 26, e.h - 20);
        ctx.drawImage(SPR.cannonL, e.x, e.h - 52);
      } else {
        ctx.fillStyle = "#0d6b4a";
        ctx.fillRect(e.x + 10, e.y + 40, 26, e.h);
        ctx.drawImage(SPR.cannonL, e.x, e.y);
      }
    } else if (e.type === "shark" && e.alive) {
      ctx.save();
      ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(SPR.shark[(state.t >> 3) % 2], -e.w / 2, -e.h / 2, e.w, e.h);
      ctx.restore();
    } else if (e.type === "bug" && e.alive) {
      ctx.drawImage(SPR.bugs[e.kind], e.x, e.y);
    } else if (e.type === "connector") {
      ctx.globalAlpha = e.missed ? 0.25 : (e.linked ? 0.45 : 1);
      ctx.drawImage(SPR.connectors[e.kind], e.x, e.y);
      if (e.linked) {
        ctx.strokeStyle = "#7fd7ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x + 18, e.y + 18, 17, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (e.type === "bolt" && e.alive) {
      ctx.drawImage(SPR.bolt, e.x, e.y);
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
    const img = SPR.hero.ready ? SPR.hero.swim : null;
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
    const maxT = L.shouts || 3;
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
    ctx.strokeStyle = "#e8d48a";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    let started = false;
    for (const n of nodes) {
      if (!started) { ctx.moveTo(n.x + 16, n.y + 16); started = true; }
      else ctx.lineTo(n.x + 16, n.y + 16);
    }
    if (started) ctx.lineTo(p.x + 8, p.y + p.h / 2 + 6);
    else if (state.needLink) ctx.moveTo(p.x + 8, p.y + p.h / 2 + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#d4a017";
    ctx.beginPath();
    ctx.arc(p.x + 6, p.y + p.h / 2 + 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0d060";
    ctx.beginPath();
    ctx.arc(p.x + 5, p.y + p.h / 2 + 7, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlay() {
    drawBg();

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
      ctx.fillStyle = pt.c;
      ctx.fillRect(pt.x, pt.y, pt.s, pt.s);
      ctx.globalAlpha = 1;
    }

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
    ctx.fillText("SPACE flap   ·   T Trabajeen! (3 per level, from L2)", W / 2, 348);
    ctx.fillStyle = "#f0d060";
    ctx.fillText("PRESS ENTER / SPACE TO DIVE", W / 2, 400);
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
    ctx.textAlign = "left";
  }

  function frame() {
    update();
    if (state.mode === "title") drawTitle();
    else if (state.mode === "dead") drawEnd(false);
    else if (state.mode === "win") drawEnd(true);
    else drawPlay();
    requestAnimationFrame(frame);
  }

  frame();
})();
