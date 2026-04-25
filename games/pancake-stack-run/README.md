# Pancake Stack Run

3D canvas runner built with Vite, TypeScript, and Three.js.

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
http://127.0.0.1:5173/pancake-stack-run/
```

## QA URLs

Autostart current saved level:

```txt
http://127.0.0.1:5173/pancake-stack-run/?autostart=1
```

Jump to a specific level for testing:

```txt
http://127.0.0.1:5173/pancake-stack-run/?autostart=1&level=10
```

Preserve WebGL drawing buffer for pixel smoke tests:

```txt
http://127.0.0.1:5173/pancake-stack-run/?autostart=1&pixel=1
```

Run the automated smoke check:

```sh
npm run smoke
```

It starts Vite on `127.0.0.1:5197`, opens headless Chrome with software WebGL, validates the shop/cosmetics UI, validates a mobile level-10 canvas pixel sample, and writes screenshots to `/tmp`.

## Deploy

`npm run build` writes the static output to:

```txt
../../pancake-stack-run
```

That maps to `/pancake-stack-run/` on GitHub Pages.
