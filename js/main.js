import { createAudio } from "./audio.js";
import { createGameEngine } from "./entities.js";
import { createInput } from "./input.js";
import { LEVELS } from "./levels.js";
import { createProgressStore } from "./progress.js";
import { createRenderer } from "./renderer.js";
import { createInitialState } from "./state.js";
import { createSprites } from "./sprites.js";

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

const progress = createProgressStore(LEVELS.length);
const audio = createAudio();
audio.muted = progress.value.muted;
const SPR = createSprites();
const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
let reducedMotion = progress.value.reducedEffects ?? Boolean(motionPreference?.matches);
const state = createInitialState(progress.value.highestUnlockedLevel);

function updateControlLabels() {
  buttons.flap.textContent = state.mode === "title" ? "START" : "FLAP";
  buttons.flap.setAttribute("aria-label", state.mode === "title" ? "Start a new run" : "Flap");
  buttons.shout.hidden = state.mode === "title";
  buttons.pause.hidden = state.mode === "title";
  buttons.pause.textContent = state.mode === "paused" ? "RESUME" : "PAUSE";
  buttons.pause.setAttribute("aria-label", state.mode === "paused" ? "Resume game" : "Pause game");
  buttons.mute.textContent = audio.muted ? "UNMUTE" : "MUTE";
  buttons.mute.setAttribute("aria-label", audio.muted ? "Unmute sound" : "Mute sound");
  buttons.effects.textContent = reducedMotion ? "FULL FX" : "LESS FX";
  buttons.effects.setAttribute("aria-label", reducedMotion ? "Enable full visual effects" : "Reduce visual effects");
  buttons.continue.textContent = "CONTINUE L" + (progress.value.highestUnlockedLevel + 1);
  buttons.continue.hidden = state.mode !== "title" || progress.value.highestUnlockedLevel === 0;
  buttons.reset.hidden = state.mode !== "title";
  document.getElementById("controls")?.classList.toggle("title-mode", state.mode === "title");
}

function resetSavedProgress() {
  if (state.mode !== "title") return;
  if (!window.confirm("Reset the best score, unlocked levels, mute, and effects settings?")) return;
  const saved = progress.reset();
  state.checkpoint = 0;
  state.vested = 0;
  audio.muted = saved.muted;
  reducedMotion = saved.reducedEffects ?? Boolean(motionPreference?.matches);
  updateControlLabels();
}

const KEY = createInput(canvas, buttons, resetSavedProgress);
const engine = createGameEngine({
  state,
  KEY,
  audio,
  SPR,
  LEVELS,
  persistSavedProgress: (patch) => progress.persist(patch),
  getSavedProgress: () => progress.value,
  getReducedMotion: () => reducedMotion
});
const renderer = createRenderer({
  ctx, W, H, state, SPR, LEVELS,
  isReducedMotion: () => reducedMotion,
  getSavedProgress: () => progress.value
});

if (motionPreference?.addEventListener) {
  motionPreference.addEventListener("change", (event) => {
    if (progress.value.reducedEffects === null) {
      reducedMotion = event.matches;
      updateControlLabels();
    }
  });
} else if (motionPreference?.addListener) {
  motionPreference.addListener((event) => {
    if (progress.value.reducedEffects === null) {
      reducedMotion = event.matches;
      updateControlLabels();
    }
  });
}

const STEP_MS = 1000 / 60;
let previousFrameTime = null;
let accumulator = 0;

document.addEventListener("visibilitychange", () => {
  previousFrameTime = null;
  accumulator = 0;
  if (document.hidden) KEY.Space = KEY.ArrowUp = KEY.Pointer = KEY.KeyT = false;
});

function handleSettingsInput() {
  if (KEY.KeyM) {
    audio.muted = !audio.muted;
    KEY.KeyM = false;
    progress.persist({ muted: audio.muted });
  }
  if (KEY.KeyR) {
    reducedMotion = !reducedMotion;
    KEY.KeyR = false;
    progress.persist({ reducedEffects: reducedMotion });
  }
}

function frame(now) {
  if (previousFrameTime === null) previousFrameTime = now;
  accumulator += Math.min(now - previousFrameTime, 100);
  previousFrameTime = now;
  let steps = 0;
  while (accumulator >= STEP_MS && steps < 6) {
    handleSettingsInput();
    engine.update();
    updateControlLabels();
    accumulator -= STEP_MS;
    steps++;
    if (state.mode === "paused") {
      accumulator = 0;
      break;
    }
  }
  if (steps === 6) accumulator = 0;

  if (state.mode === "title") renderer.drawTitle();
  else if (state.mode === "dead") renderer.drawEnd(false);
  else if (state.mode === "win") renderer.drawEnd(true);
  else if (state.mode === "level-transition") renderer.drawLevelTransition();
  else {
    renderer.drawPlay();
    if (state.mode === "paused") renderer.drawPauseOverlay();
  }
  requestAnimationFrame(frame);
}

updateControlLabels();
requestAnimationFrame(frame);
