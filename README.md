# Snakes & Ladders 3D

A browser game in Three.js. It has a 3D board, snakes that move, wooden ladders, shiny pawns, a dice that rolls and lands on the rolled number, confetti, and sound effects and music made in code with the Web Audio API.

## Play

**▶ Play online: https://buddhika75.github.io/snakes-ladders-3d/**

Or run it locally:

```
python -m http.server 8765
```

Open http://localhost:8765. The game needs internet to load Three.js and the font from a CDN.

- Modes: You vs Computer, 2–4 players, or watch a CPU battle.
- Rules: land exactly on 100 to win. A 6 gives another turn.
- Controls: **Roll** or Space. Drag to orbit, scroll to zoom. The toolbar has sound, music, speed (1×/2×/4×) and new game.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout, start and win screens |
| `style.css` | Glass-style screen panels and the phone layout |
| `game.js` | 3D scene, board, snakes, ladders, dice, game rules, animations |
| `audio.js` | Sounds for dice, steps, ladder, snake, six, win, plus background music |

## Test hooks

`window.__game` exposes `start(mode)`, `roll(value)`, `state()`, `setSpeed(n)`, `setPos(i, n)` and `diceUp()`. The Playwright check uses these hooks.
