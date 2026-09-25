export function createRenderer({ ctx, W, H, state, SPR, LEVELS, isReducedMotion, getSavedProgress }) {
  function drawBg() {
    const L = LEVELS[state.level] || LEVELS[0];
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, L.sky[0]);
    gradient.addColorStop(0.55, L.sky[1]);
    gradient.addColorStop(1, L.sky[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 200 - state.dist * 0.15) % (W + 220)) - 40;
      ctx.fillStyle = "#b8e8ff";
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 110, H); ctx.lineTo(x + 20, H); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = L.accent;
    const parallax = state.dist * 0.35;
    for (let x = -((parallax | 0) % 70); x < W; x += 70) {
      ctx.strokeRect(x + 8, 70 + Math.sin((x + parallax) / 80) * 18, 36, 16);
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

  function drawEntity(entity) {
    if (entity.type === "cannon" && entity.alive) {
      if (entity.side === "top") {
        ctx.fillStyle = "#0d6b4a";
        ctx.fillRect(entity.x + 10, 0, 26, entity.h - 20);
        ctx.drawImage(SPR.cannonL, entity.x, entity.h - 52);
      } else {
        ctx.fillStyle = "#0d6b4a";
        ctx.fillRect(entity.x + 10, entity.y + 40, 26, entity.h);
        ctx.drawImage(SPR.cannonL, entity.x, entity.y);
      }
    } else if (entity.type === "shark" && entity.alive) {
      ctx.save();
      ctx.translate(entity.x + entity.w / 2, entity.y + entity.h / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(SPR.shark[(state.t >> 3) % 2], -entity.w / 2, -entity.h / 2, entity.w, entity.h);
      ctx.restore();
    } else if (entity.type === "bug" && entity.alive) {
      ctx.drawImage(SPR.bugs[entity.kind], entity.x, entity.y);
    } else if (entity.type === "connector") {
      ctx.globalAlpha = entity.missed ? 0.25 : (entity.linked ? 0.45 : 1);
      ctx.drawImage(SPR.connectors[entity.kind], entity.x, entity.y);
      if (entity.linked) {
        ctx.strokeStyle = "#7fd7ff";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(entity.x + 18, entity.y + 18, 17, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (entity.type === "bolt" && entity.alive) {
      ctx.drawImage(SPR.bolt, entity.x, entity.y);
    } else if (entity.type === "rocket" && entity.alive) {
      ctx.drawImage(SPR.rocket, entity.x, entity.y);
    } else if (entity.type === "goal" && entity.alive) {
      ctx.drawImage(SPR.flag, entity.x, entity.y);
      ctx.fillStyle = "#f0d060";
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.fillText("END", entity.x - 4, entity.y - 6);
    }
  }

  function drawHero() {
    const player = state.player;
    if (state.invuln > 0 && state.t % 6 < 2) return;
    const swimCycle = [SPR.hero.swim, SPR.hero.swim_3, SPR.hero.swim_2, SPR.hero.swim_3];
    let image = null;
    if (SPR.hero.ready) {
      if (state.hurtTimer > 0) image = SPR.hero.hurt || SPR.hero.swim;
      else if (state.shoutPulse > 0) image = SPR.hero.shout || SPR.hero.swim;
      else if (player.vy > 4.2) image = SPR.hero.dive || SPR.hero.swim;
      else image = swimCycle[Math.floor(state.t / 6) % swimCycle.length] || SPR.hero.swim;
    }
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    ctx.rotate(Math.max(-0.35, Math.min(0.4, player.vy * 0.045)));
    if (image) ctx.drawImage(image, -image.width / 2, -image.height / 2);
    else { ctx.fillStyle = "#143848"; ctx.fillRect(-24, -12, 48, 24); }
    ctx.restore();
  }

  function drawSquad() {
    for (const squadmate of state.squad) {
      const frame = squadmate.fire > 0 ? SPR.side.fire : (squadmate.kick ? SPR.side.kickA : SPR.side.kickB);
      ctx.drawImage(frame, squadmate.x, squadmate.y);
    }
  }

  function drawHud() {
    const level = LEVELS[state.level];
    ctx.fillStyle = "rgba(4,16,24,0.75)";
    ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = "#f0d060";
    ctx.font = "11px 'Press Start 2P', monospace";
    ctx.fillText("VESTED  $" + String(state.vested).padStart(6, "0"), 10, 24);
    ctx.fillStyle = "#7fd7ff";
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillText("L" + (state.level + 1) + " " + level.name, 250, 23);
    ctx.fillStyle = "#cde8f5";
    const maxShouts = level.shouts ?? 3;
    ctx.fillText("T x" + state.trabajeen, 600, 23);
    for (let i = 0; i < maxShouts; i++) {
      ctx.fillStyle = i < state.trabajeen ? "#00a1e0" : "#1a3038";
      ctx.fillRect(668 + i * 12, 10, 10, 16);
    }
    for (let i = 0; i < state.maxHealth; i++) {
      ctx.fillStyle = i < state.health ? "#3ecf8e" : "#1a3030";
      ctx.fillRect(W - 22 - i * 18, 10, 14, 16);
    }
    if (level.connectors) {
      ctx.fillStyle = "#7fd7ff";
      ctx.font = "16px 'VT323', monospace";
      ctx.fillText("LINKS " + state.linked + "/" + state.needLink, 10, H - 12);
    }
    const progress = Math.min(1, state.dist / level.length);
    ctx.fillStyle = "#123040";
    ctx.fillRect(W - 180, H - 16, 160, 6);
    ctx.fillStyle = "#f0d060";
    ctx.fillRect(W - 180, H - 16, 160 * progress, 6);
  }

  function drawString() {
    const nodes = state.ents.filter((entity) => entity.type === "connector" && entity.linked);
    if (!nodes.length && !state.needLink) return;
    const player = state.player;
    ctx.save();
    ctx.strokeStyle = "#e8d48a";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    let started = false;
    for (const node of nodes) {
      if (!started) { ctx.moveTo(node.x + 16, node.y + 16); started = true; }
      else ctx.lineTo(node.x + 16, node.y + 16);
    }
    if (started) ctx.lineTo(player.x + 8, player.y + player.h / 2 + 6);
    else if (state.needLink) ctx.moveTo(player.x + 8, player.y + player.h / 2 + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#d4a017";
    ctx.beginPath(); ctx.arc(player.x + 6, player.y + player.h / 2 + 8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f0d060";
    ctx.beginPath(); ctx.arc(player.x + 5, player.y + player.h / 2 + 7, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPlay() {
    drawBg();
    ctx.save();
    if (!isReducedMotion() && state.shakeLife > 0) {
      const strength = 4 * (state.shakeLife / state.shakeDuration);
      ctx.translate(Math.sin(state.t * 2.7) * strength, Math.cos(state.t * 3.1) * strength);
    }
    drawString();
    for (const entity of state.ents) drawEntity(entity);
    drawSquad();
    drawHero();
    if (state.shoutText > 0) {
      const player = state.player;
      ctx.fillStyle = "#f4f7fb";
      ctx.beginPath(); ctx.roundRect(player.x + 40, player.y - 28, 168, 26, 8); ctx.fill();
      ctx.fillStyle = "#102028";
      ctx.font = "bold 16px 'VT323', monospace";
      ctx.fillText("Trabaaaajeen!", player.x + 50, player.y - 10);
    }
    for (const bubble of state.bubbles) {
      ctx.globalAlpha = Math.min(1, bubble.life / 24);
      ctx.drawImage(SPR.bubble, bubble.x, bubble.y);
      ctx.globalAlpha = 1;
    }
    for (const particle of state.parts) {
      ctx.globalAlpha = Math.min(1, particle.life / 14);
      ctx.fillStyle = particle.c;
      ctx.fillRect(particle.x, particle.y, particle.s, particle.s);
      ctx.globalAlpha = 1;
    }
    for (const effect of state.effects) {
      const progress = 1 - effect.life / effect.duration;
      const alpha = Math.min(1, effect.life / 12);
      if (effect.type === "ring") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, isReducedMotion() ? 16 : 8 + progress * 30, 0, Math.PI * 2);
        ctx.stroke();
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
    const progress = getSavedProgress();
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
    if (progress.highestUnlockedLevel > 0) {
      ctx.fillText("C: CONTINUE FROM L" + (progress.highestUnlockedLevel + 1), W / 2, 420);
    }
    ctx.fillStyle = "#7fb4c8";
    ctx.font = "20px 'VT323', monospace";
    ctx.fillText("BEST VESTED: $" + progress.bestVested + "   ·   X: RESET SAVED DATA", W / 2, 454);
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

  return { drawPlay, drawTitle, drawEnd, drawPauseOverlay, drawLevelTransition };
}
