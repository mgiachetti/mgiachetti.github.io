# Crew Count Clash - Implementation Tasks

Status markers:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

## Phase 0 - Product Lock

- [x] Research Count Masters gameplay, progression, boss/bonus loop, shop, and player complaints.
- [x] Decide no ads and no rewarded-ad economy.
- [x] Decide original title/assets while preserving crowd-runner rules.
- [x] Create separate project folder: `games/crew-count-clash`.
- [x] Define full design in `GAME_DESIGN.md`.
- [x] Confirm public URL slug, default: `/crew-count-clash/`.
- [ ] Confirm whether root redirect stays `/robot`.

## Phase 1 - Project Foundation

- [x] Add Vite + TypeScript project files.
- [x] Add Three.js dependency.
- [x] Add scripts: `dev`, `build`, `preview`, `smoke`.
- [x] Add base HTML, canvas, and CSS HUD shell.
- [x] Create source folder structure.
- [x] Add GitHub Pages build output to root `crew-count-clash/`.
- [x] Verify dev server starts.
- [x] Verify production build succeeds.

## Phase 2 - 3D Scene Foundation

- [x] Create Three.js renderer attached to canvas.
- [x] Add responsive resize handling.
- [x] Add scene, camera, lights, fog/background.
- [x] Add third-person follow camera.
- [x] Add basic track module system.
- [x] Add theme/material palette.
- [x] Add animation loop.
- [x] Add debug route/level jump query params.

## Phase 3 - Input And Movement

- [x] Implement pointer/touch drag steering.
- [x] Implement keyboard fallback.
- [x] Smooth crowd center movement.
- [x] Clamp crowd center to track width.
- [x] Add edge/fall detection.
- [ ] Add optional jump hook for specific levels.
- [~] Tune speeds for desktop and mobile.

## Phase 4 - Crew Model And Crowd Simulation

- [x] Build original rounded crew mesh with visor/backpack/legs.
- [x] Convert crew pieces to instanced meshes.
- [x] Implement dynamic oval/grid formation.
- [x] Implement runner slot seeking and bob animation.
- [x] Implement add/remove count operations.
- [x] Implement visible cap and high-count badge.
- [x] Add knocked-out runner fly-away animation.
- [x] Add count HUD binding.

## Phase 5 - Gates

- [x] Define gate data model.
- [x] Implement `+N` gates.
- [x] Implement `-N` gates.
- [x] Implement `xN` gates.
- [x] Implement `/N` gates.
- [x] Implement percent gates.
- [x] Implement timed value gates.
- [x] Implement rotating/moving gates.
- [x] Implement split-path gates.
- [x] Implement color/team gates and switch pads.
- [x] Add gate text/signage and preview feedback.
- [x] Add gate pass particles/audio.

## Phase 6 - Collectables And Powerups

- [x] Implement loose crew pickups.
- [x] Implement crew capsule pickups.
- [x] Implement coins.
- [x] Implement gems.
- [x] Implement shield battery.
- [x] Implement magnet drone.
- [x] Implement frenzy beacon.
- [x] Implement commander flag.
- [x] Implement boss bomb.
- [x] Implement roulette ticket.
- [x] Add collection particles and score popups.

## Phase 7 - Hazards And Traps

- [x] Define hazard data model.
- [x] Implement side scrapers.
- [x] Implement low bumpers.
- [x] Implement rotating bars.
- [x] Implement saw lanes.
- [x] Implement crushers/hammers.
- [x] Implement swinging axes.
- [x] Implement spike rollers.
- [x] Implement cannon balls.
- [x] Implement laser gates.
- [x] Implement slow goo.
- [x] Implement conveyor belts.
- [x] Implement trap doors/holes.
- [x] Implement fan blowers.
- [x] Add warning decals/shadows/telegraphs.
- [~] Tune fair hitboxes.

## Phase 8 - Moving Platforms

- [x] Implement lateral shuttle platform.
- [x] Implement forward/back bridge platform.
- [x] Implement rotating turntable.
- [x] Implement tilting plank.
- [x] Implement rising/falling bridge.
- [x] Implement conveyor platform.
- [x] Implement collapsing tiles.
- [x] Implement split-path moving islands.
- [~] Verify large crowds remain playable on platform segments.

## Phase 9 - Enemy Squads And Battles

- [x] Define enemy squad data.
- [x] Implement static enemy squads.
- [x] Implement patrolling enemy squads.
- [x] Implement armored squads.
- [x] Implement mini-boss guards.
- [x] Implement enemy gate/spawner.
- [x] Implement battle subtraction formula.
- [x] Add battle animation swirl.
- [x] Add battle result feedback.

## Phase 10 - Level System

- [x] Define `LevelData` types.
- [x] Build segment/template placement helpers.
- [x] Build Level 1 tutorial.
- [x] Build Levels 2-4 normal progression.
- [x] Build Level 5 boss.
- [x] Build Level 6 bonus roulette.
- [x] Build Levels 7-10 with timed gates, platforms, traps.
- [x] Build Levels 11-15 with advanced hazards and second boss.
- [x] Build Levels 16-20 with final boss and mixed gauntlets.
- [~] Add procedural remix generator after level 20.
- [x] Add safe-route validation checks.

## Phase 11 - Final Stairs

- [x] Create final staircase mesh system.
- [x] Implement count-drain climb sequence.
- [x] Add reward multiplier bands.
- [x] Add chest/gem vault milestones.
- [x] Add camera tilt/reveal.
- [x] Convert reached stair to score/coins.
- [x] Add perfect-run stair boost.

## Phase 12 - Boss System

- [x] Define boss config.
- [x] Create Castle King boss model.
- [x] Implement boss HP and damage formula.
- [x] Implement stomp telegraph/attack.
- [x] Implement sweep attack.
- [x] Implement minion waves.
- [x] Implement weak-point gates.
- [x] Implement defeat/castle capture sequence.
- [x] Add boss medals and gems.
- [x] Add at least 5 boss archetypes/configs.

## Phase 13 - Bonus Roulette

- [x] Create roulette wheel model.
- [x] Add physical spin/pointer animation.
- [x] Define reward table.
- [x] Implement earned tickets.
- [~] Implement coin/gem/skin/upgrades rewards.
- [x] Implement jackpot skin reward.
- [x] Add no-ad extra spin rules using tickets/gems.
- [x] Add roulette SFX and reward fanfare.

## Phase 14 - Scoring And Economy

- [x] Implement run score.
- [x] Implement coins formula.
- [~] Implement gems/medals/shards.
- [x] Implement stars.
- [x] Track best score/count/stair per level.
- [x] Add no-hit/combo rewards.
- [ ] Balance upgrade costs.
- [ ] Balance roulette odds and boss rewards.

## Phase 15 - Progression And Save Data

- [x] Implement `localStorage` save/load.
- [x] Track level progression.
- [x] Track currencies.
- [x] Track best stats.
- [x] Track cosmetics.
- [x] Track upgrade levels.
- [x] Track base/castle build progress.
- [x] Add save migration/versioning.
- [x] Add dev reset/debug tools.

## Phase 16 - Shop And Meta

- [x] Build shop UI.
- [x] Implement Start Crew upgrade.
- [x] Implement Gate Bonus upgrade.
- [x] Implement Formation Control upgrade.
- [x] Implement Shield Charge upgrade.
- [x] Implement Coin Value upgrade.
- [x] Implement Boss Damage upgrade.
- [x] Implement Magnet Range upgrade.
- [x] Implement Roulette Luck upgrade.
- [x] Implement body/visor/backpack/hat/trail cosmetics.
- [x] Implement equip/owned/locked states.
- [x] Implement duplicate conversion.
- [x] Implement base/castle build screen.

## Phase 17 - Audio

- [x] Create AudioManager.
- [x] Add user-gesture audio unlock.
- [x] Add mute and volume persistence.
- [x] Add normal run music loop.
- [x] Add boss music loop.
- [x] Add roulette music loop.
- [x] Add shop/base music loop.
- [x] Add gate SFX.
- [x] Add collect SFX.
- [x] Add loss/trap SFX.
- [x] Add battle SFX.
- [x] Add boss SFX.
- [x] Add final stairs ticks.
- [x] Add roulette SFX.
- [ ] Mix levels for mobile speakers.

## Phase 18 - UI And Menus

- [x] Build HUD.
- [x] Build title screen.
- [x] Build pause/settings overlay.
- [x] Build fail screen.
- [x] Build level complete screen.
- [x] Build reward/chest screen.
- [x] Build shop screen.
- [x] Build level map/progression screen.
- [x] Build roulette reward screen.
- [x] Add responsive mobile layout.
- [x] Add accessible button labels.
- [x] Verify text never overlaps controls.

## Phase 19 - Visual Polish And Assets

- [x] Add procedural crew skin variants.
- [x] Add enemy variants.
- [x] Add gate material polish.
- [x] Add trap animations.
- [x] Add particles for count gain/loss.
- [x] Add coin/gem bursts.
- [x] Add impact squash/stretch.
- [x] Add camera shake for major hits.
- [x] Add boss defeat confetti.
- [x] Add themed track biomes.
- [x] Add loading screen.
- [x] Add app icon/preview image.

### Original-Like Visual Polish Backlog

- [x] Add visible city/castle/base progression to the main loop.
- [x] Make boss victory read as a castle takeover with gate animation, flag change, crowd push-in, and delayed reward.
- [x] Add denser track set dressing: buildings, towers, walls, banners, and route signs.
- [x] Give gates stronger glow, post silhouettes, number badges, and pass-through impact particles.
- [x] Add trap-specific visual identity: sparks, smoke, dust, warning stripes, and stronger telegraphs.
- [x] Add distinct boss arena dressing per boss archetype.
- [~] Add more visible cosmetics: hats/helmets, stronger trails, backpack silhouettes, and victory poses.
- [x] Add reward set pieces: gem piles, ticket cards, jackpot spotlight, and chest variants.
- [x] Add level-end castle/city build celebration after major milestones.

## Phase 20 - QA And Shipping

- [x] Add automated smoke checks.
- [x] Verify desktop screenshot: canvas nonblank and framed.
- [x] Verify mobile screenshot: canvas nonblank and HUD readable.
- [x] Test all game states.
- [x] Test all gate math.
- [x] Test boss and roulette flows.
- [x] Test save reset/dev tools.
- [x] Test production build locally.
- [ ] Fix performance hotspots.
- [~] Deploy to GitHub Pages path.
- [x] Document run/build commands.

## Iteration Rules

- Keep each phase playable at the end.
- Do not tune economy until scoring, stairs, boss, and roulette are stable.
- Do not overinvest in cosmetics before the crowd movement feels good.
- Every reward path must work without ads.
- Every level must have at least one fair success route.
- Use procedural assets first, then improve visuals where the game benefits most.
- Save/progression bugs are high priority because the shop and rewards are central.
