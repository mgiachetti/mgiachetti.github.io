# Vector Tank Zone - Implementation Tasks

Status markers:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

## Phase 0 - Product Lock

- [x] Review previous Three.js game structure and recent commits.
- [x] Pick original title and URL slug.
- [x] Decide Battlezone-inspired, original assets/names.
- [x] Define design in `GAME_DESIGN.md`.
- [x] Create separate project folder: `games/vector-tank-zone`.

## Phase 1 - Foundation

- [x] Add Vite + TypeScript project files.
- [x] Add Three.js dependency declaration.
- [x] Add base HTML, canvas, HUD, and panels.
- [x] Add GitHub Pages build output path.
- [x] Add PWA manifest, icon, preview, and service worker shell.
- [x] Add package lock after dependency install.

## Phase 2 - Scene

- [x] Create renderer, scene, camera, lights, fog.
- [x] Create vector-grid arena.
- [x] Add horizon ridge line.
- [x] Add procedural obstacles.
- [x] Add resize handling.
- [x] Add terrain themes per level group.
- [x] Add arena boundary warning feedback.

## Phase 3 - Player Tank

- [x] Build procedural tank mesh.
- [x] Implement forward/reverse movement.
- [x] Implement tank rotation.
- [x] Implement reload timing.
- [x] Add commander-view camera.
- [x] Add desktop keyboard controls.
- [x] Add touch drag/fire controls.
- [x] Add turret/body independent aim mode.
- [x] Add tank damage animation and low-armor warning.

## Phase 4 - Projectiles

- [x] Define projectile model.
- [x] Implement player shells.
- [x] Implement enemy shells.
- [x] Add bounds/lifetime cleanup.
- [x] Add player/enemy collision resolution.
- [x] Add shell trails.
- [x] Add obstacle collision.
- [x] Add line-of-sight checks for enemy firing.

## Phase 5 - Particles And Explosions

- [x] Create `ParticleSystem`.
- [x] Add muzzle flash.
- [x] Add impact sparks.
- [x] Add weak-point hit color.
- [x] Add enemy explosions.
- [x] Add boss-scale explosion mode.
- [x] Convert high-volume particles to instanced/pool approach.
- [x] Add smoke plumes and scorch marks.

## Phase 6 - Enemies

- [x] Define enemy archetypes.
- [x] Implement scout.
- [x] Implement tank.
- [x] Implement heavy.
- [x] Implement turret.
- [x] Implement basic AI: face, move, fire.
- [x] Add radar blips.
- [x] Add flanking and retreat behavior.
- [x] Add spawn telegraph.
- [x] Add enemy-specific silhouettes and animation.

## Phase 7 - Boss System

- [x] Define boss config and weak-point config.
- [x] Build boss mesh factory.
- [x] Attach weak-point meshes.
- [x] Give weak points separate HP.
- [x] Reduce hull damage while weak points remain.
- [x] Add boss HP HUD.
- [x] Add boss attack phases.
- [x] Add weak-point shield animation.
- [x] Add boss death sequence timing before reward.
- [x] Add at least 5 boss archetypes.

## Phase 8 - Levels

- [x] Add authored level catalog.
- [x] Add level validation.
- [x] Add procedural remix after catalog.
- [x] Add two boss levels.
- [x] Expand authored catalog to 20 levels.
- [x] Add objective variations.
- [x] Add difficulty balance pass.

## Phase 9 - Scoring And Save

- [x] Track score.
- [x] Track kills.
- [x] Track shots/hits/accuracy.
- [x] Track weak-point hits.
- [x] Track medals.
- [x] Save current level, high score, medals, best scores, mute.
- [x] Add time bonus.
- [x] Add no-damage bonus.
- [x] Add streak multiplier.

## Phase 10 - UI

- [x] Build HUD.
- [x] Build radar.
- [x] Build reticle.
- [x] Build boss HP bar.
- [x] Build title, pause, fail, clear panels.
- [x] Add responsive mobile layout.
- [x] Add briefing panel.
- [x] Add garage/progression panel.
- [x] Add level map.

## Phase 11 - Audio

- [x] Add audio unlock.
- [x] Add procedural combat/menu/boss music.
- [x] Add shoot SFX.
- [x] Add enemy shoot SFX.
- [x] Add hit SFX.
- [x] Add explosion SFX.
- [x] Add reward/fail SFX.
- [x] Persist mute.
- [x] Add engine loop.
- [x] Add radar ping.
- [x] Mix mobile speaker levels after more effects land.

## Phase 12 - QA And Shipping

- [x] Add smoke test script.
- [x] Run TypeScript build.
- [x] Run visual smoke test.
- [x] Verify desktop screenshot.
- [x] Verify mobile screenshot.
- [x] Verify boss weak-point screenshot.
- [x] Deploy static build to `/vector-tank-zone/`.

## Iteration Rules

- Keep each phase playable at the end.
- Keep systems modular; do not grow a second monolithic `Game.ts`.
- Boss weak points must remain real collision objects.
- Particles must be verified visually, not assumed.
- Use procedural assets first.
- Every level needs fair radar readability and enough room to dodge.
