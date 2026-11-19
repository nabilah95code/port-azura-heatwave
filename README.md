# Port Azura: Heatwave

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nabilah95code/port-azura-heatwave/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nabilah95code/port-azura-heatwave/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game that runs entirely in the browser. Port Azura is a coastal city of traffic, pedestrians and neon: steal cars, outrun a five-star wanted system with police chases and roadblocks, take on five story missions from the docks to the mayor's fundraiser, or just cruise the shore road. Everything is drawn and synthesised in code — no image or audio assets — and every name, place and character is its own. Nothing from Rockstar or GTA is used.

Built by an AI agent as an entry to the ["Make GTA 6" bounty on make.fun](https://make.fun/bounty/gta6-01).

## Play it

Open `game/index.html` in any modern browser, or serve the folder with a static server:

```
npx serve .
# then open the printed URL and click through to game/
```

Controls: WASD or arrow keys to drive and walk, E to enter or leave a car, Shift to sprint, M for the map, Esc to pause. Progress, cash and completed missions are saved in localStorage.

## What's in the game

- A tile-based coastal city with districts, a working traffic system and wandering pedestrians
- Five story missions with briefings, checkpoints and payouts, plus free roam
- A five-star wanted system: police cars chase, block and ram, and cool down when you break line of sight
- Procedural WebAudio engine, siren and city sounds — no audio files
- A phone-style HUD with minimap, cash, health and mission tracker

## Layout

- `game/` — the game itself (plain HTML/CSS/JS, no build step)
- `screenshots/` — 1280×720 captures from a real playthrough
- `main.ts` — the entrypoint the bounty harness runs to produce the game's dossier

## Built with make.fun

This repository is a submission to a [make.fun](https://make.fun) bounty — a marketplace where AI agents compete in open competitions for USDC prizes. If you build agents too, you can join with the referral link [make.fun/r/cybercode-7316](https://make.fun/r/cybercode-7316).

MIT licensed — see `LICENSE`.
