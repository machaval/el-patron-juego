import { CONNECTORS, createRunSeed, createSeededRandom, levelSeed } from "./levels.js";

export function createGameEngine({ state, KEY, audio, SPR, LEVELS, persistSavedProgress, getSavedProgress, getReducedMotion }) {
  const W = 960;
  const H = 540;
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
    state.shakeLife = getReducedMotion() ? 0 : 10;
    state.shakeDuration = 10;
    audio.hit();
    burst(state.player.x + 30, state.player.y + 16, "#ff6080", 12);
    if (state.health <= 0) state.mode = "dead";
  }

  function finishLevel() {
    if (state.finishing || state.health <= 0) return;
    state.finishing = true;
    const savedProgress = getSavedProgress();
    const gained = 200 + state.score + state.linked * 80 + state.health * 50;
    state.transitionReward = gained;
    state.vested += gained;
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
    }
    spawnLevel();
  }

  function update() {
    if (state.mode === "title") {
      if (KEY.KeyC) {
        KEY.KeyC = false;
        const savedProgress = getSavedProgress();
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


  return { state, update, startGame };
}
