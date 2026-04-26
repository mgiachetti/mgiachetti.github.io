# Crew Count Clash

3D canvas crowd-runner inspired by Count Masters, with original rounded space-crew characters, boss fights, bonus roulette, moving platforms, traps, final stairs, shop, progression, and sound.

## Commands

```sh
npm install
npm run dev
npm run build
npm run preview
npm run smoke
```

Local dev URL:

```txt
http://127.0.0.1:5173/crew-count-clash/
```

Current debug URL if the dev server is still running:

```txt
http://127.0.0.1:5202/crew-count-clash/
```

GitHub Pages URL after push:

```txt
https://mgiachetti.github.io/crew-count-clash/
```

## QA URLs

Autostart current saved level:

```txt
http://127.0.0.1:5173/crew-count-clash/?autostart=1
```

Jump to a level:

```txt
http://127.0.0.1:5173/crew-count-clash/?autostart=1&level=5
```

Preserve WebGL drawing buffer for pixel smoke tests:

```txt
http://127.0.0.1:5173/crew-count-clash/?autostart=1&level=5&pixel=1
```

## Deploy

`npm run build` writes the static output to:

```txt
../../crew-count-clash
```

That maps to `/crew-count-clash/` on GitHub Pages.

## Current Status

- Research and game design are documented.
- Vite + TypeScript + Three.js project is implemented.
- Playable build includes crowd steering, instanced crew, normal/timed/color gates, pickups, enemies, traps, moving platforms, final stairs, 3 boss configs, roulette, shop, save data, and procedural Web Audio.
- Authored level catalog currently covers levels 1-12, including two bonus roulette stages and three boss stages.
- Production build and smoke test pass.
