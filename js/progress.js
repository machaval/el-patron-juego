const SAVE_KEY = "el-patron-save-v1";

function defaults() {
  return { version: 1, bestVested: 0, highestUnlockedLevel: 0, muted: false, reducedEffects: null };
}

export function createProgressStore(levelCount) {
  let value = defaults();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1) {
        value = {
          version: 1,
          bestVested: Number.isFinite(parsed.bestVested) ? Math.max(0, Math.floor(parsed.bestVested)) : 0,
          highestUnlockedLevel: Number.isFinite(parsed.highestUnlockedLevel)
            ? Math.max(0, Math.min(levelCount - 1, Math.floor(parsed.highestUnlockedLevel)))
            : 0,
          muted: typeof parsed.muted === "boolean" ? parsed.muted : false,
          reducedEffects: typeof parsed.reducedEffects === "boolean" ? parsed.reducedEffects : null
        };
      }
    }
  } catch (error) {
    console.warn("Could not read saved progress; starting with defaults.", error);
  }

  function persist(patch) {
    value = { ...value, ...patch, version: 1 };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn("Could not save progress; gameplay will continue without persistence.", error);
    }
    return value;
  }

  function reset() {
    value = defaults();
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (error) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(value));
      } catch (writeError) {
        console.warn("Could not reset saved progress; storage is unavailable.", error, writeError);
      }
    }
    return value;
  }

  return {
    get value() { return value; },
    persist,
    reset
  };
}
