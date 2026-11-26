# Ember Isle Run — Best Flight Game

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/bee6en9/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/bee6en9/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete 3D flight game for the [make.fun bounty: Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057). Fly the mail plane over a volcanic island: thread 8 gold rings through the valley, mind your fuel, then land on the lit coastal strip.

## Play

Open `game/index.html` in a desktop browser (Chrome recommended). No build step, no network request — all files live under `game/`, including the vendored three.js build.

- **W / S** — throttle up / down
- **Arrow keys** — pitch and bank (↑ nose down, ↓ nose up, ← → bank)
- **Q / E** — rudder
- **G** — landing gear up / down
- **P** — pause · **C** — camera · **M** — mute
- **Mouse drag** — look around from the chase camera

## The mission

1. Take off from the coastal strip.
2. Fly through all **8 gold rings** over Ember Isle — each one is worth 250 points, and the next ring is always pointed to on the HUD.
3. Come back and **land on the runway**: gear down, under 95 knots, gentle touchdown.
4. Fuel burns faster at full throttle, and hard landings or terrain scrapes damage the airframe. Land with fuel to spare for a bonus.

The HUD shows everything a pilot needs: **altitude (feet), airspeed (knots), heading (compass strip)**, a live artificial horizon, throttle, fuel, damage, rings, score and time.

## Layout

- `main.ts` — the entry program (Node 22): copies `game/` + `screenshots/` to `/output` and writes `dossier.json` via `vendor/makefun-game.ts`.
- `game/index.html` — the game page (import map points `three` at the vendored build).
- `game/src/` — the game's own source, one job per file: `config.js` (tuning + seed), `world.js` (island, sea, sky, runway), `plane.js` (aircraft + flight model), `rings.js` (mission course), `input.js`, `audio.js` (synthesized sound, no files), `hud.js` (instruments), `feedback.js` (shake + particles), `shots.js` (deterministic screenshot states), `main.js` (loop + camera).
- `game/vendor/` — three.js r187 (`three.module.min.js` + `three.core.js`), vendored unchanged.
- `screenshots/` — 4 real renders of the game's own code (`?shot=cover|rings|landing|menu`).

## License

MIT — see [LICENSE](LICENSE).
