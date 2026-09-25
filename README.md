# El Patrón · The Vesting Horizon

Run the game from the repository root with a static HTTP server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The game uses native browser modules and has no build step.

## Code layout

- `game.js` loads the application entry point.
- `js/main.js` connects the game, input, renderer, storage, and animation loop.
- `js/entities.js` owns game state transitions, level spawning, physics, and collisions.
- `js/renderer.js` draws the game and its screens.
- `js/levels.js` contains level configuration and seeded random helpers.
- `js/sprites.js` loads image assets and creates canvas sprites.
- `js/audio.js`, `js/input.js`, `js/progress.js`, and `js/state.js` own their named systems.
