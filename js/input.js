export function createInput(canvas, buttons, onReset) {
  const keys = {};
  addEventListener("keydown", (event) => {
    if (event.repeat && ["KeyP", "Escape", "KeyM", "KeyR"].includes(event.code)) return;
    if (event.code === "KeyX") {
      event.preventDefault();
      onReset();
      return;
    }
    keys[event.code] = true;
    if (["Space", "ArrowUp", "KeyT", "KeyP", "Escape", "KeyM", "KeyR", "KeyX"].includes(event.code)) {
      event.preventDefault();
    }
  });
  addEventListener("keyup", (event) => { keys[event.code] = false; });
  canvas.addEventListener("pointerdown", () => { keys.Pointer = true; });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  function bindPress(button, key) {
    if (!button) return;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("click", () => { keys[key] = true; });
  }

  bindPress(buttons.flap, "Pointer");
  bindPress(buttons.shout, "KeyT");
  bindPress(buttons.pause, "KeyP");
  bindPress(buttons.mute, "KeyM");
  bindPress(buttons.effects, "KeyR");
  bindPress(buttons.continue, "KeyC");
  if (buttons.reset) buttons.reset.addEventListener("click", onReset);

  return keys;
}
