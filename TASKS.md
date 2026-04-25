# Pancake Stack Run - Implementation Tasks

Status markers:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

## Phase 0 - Product Lock

- [x] Research Pancake Run gameplay, progression, scoring, hazards, and player complaints.
- [x] Decide no ads.
- [x] Decide original name/assets while preserving the gameplay loop.
- [x] Define full design in `GAME_DESIGN.md`.
- [ ] Confirm final project path and public URL slug.
- [ ] Confirm whether the root redirect should keep pointing to `/robot` or later point to the game.

## Phase 1 - Project Foundation

- [x] Add Vite + TypeScript project files.
- [x] Add Three.js dependency.
- [x] Add scripts: `dev`, `build`, `preview`.
- [x] Add base HTML and CSS.
- [x] Create source folder structure.
- [x] Add GitHub Pages compatible build settings.
- [x] Verify dev server starts.
- [x] Verify production build succeeds.

## Phase 2 - 3D Scene Foundation

- [x] Create Three.js renderer attached to canvas.
- [x] Add responsive resize handling.
- [x] Add scene, camera, lights, fog/background.
- [x] Add camera rig for third-person runner view.
- [x] Add basic track mesh with side/open-edge support.
- [x] Add plate/player mesh.
- [x] Add animation loop with fixed-step-ish game update.
- [ ] Add debug stats toggle for development.

## Phase 3 - Input And Player Movement

- [x] Implement pointer/touch drag control.
- [x] Implement keyboard fallback.
- [x] Add press-to-run/release-to-slow behavior.
- [x] Clamp player inside safe track areas.
- [x] Implement fall-off detection where edges are open.
- [x] Smooth lateral movement.
- [ ] Tune movement speeds for desktop/mobile.

## Phase 4 - Stack System

- [x] Create pancake mesh factory.
- [x] Implement stack add/remove operations.
- [x] Render visible stack layers.
- [x] Add stack wobble based on movement and height.
- [x] Add pancake fly-away animation when removed.
- [x] Add crumbs/particles on impact.
- [x] Add stack count HUD binding.
- [x] Add high-stack performance cap/simplification.

## Phase 5 - Collectables

- [x] Define collectable entity data.
- [x] Implement pancake pickup.
- [x] Implement golden pancake pickup.
- [x] Implement strawberry pickup.
- [x] Implement banana pickup.
- [x] Implement blueberry pickup.
- [x] Implement chocolate chip pickup.
- [x] Implement butter shield pickup.
- [x] Implement maple syrup multiplier pickup.
- [x] Add collect particles and score popups.
- [x] Add combo tracking.

## Phase 6 - Hazards And Gates

- [x] Define hazard entity data.
- [x] Implement low pipe stack trimmer.
- [x] Implement blade gate.
- [x] Implement moving rolling pin.
- [x] Implement jam puddle slow.
- [x] Implement glutton eater.
- [x] Implement slammer hazard.
- [x] Implement holes/open edge fail.
- [x] Implement color gates and buttons.
- [x] Implement height gates.
- [x] Add hazard warning/readability visuals.
- [ ] Tune fair hitboxes.

## Phase 7 - Level System

- [x] Define `LevelData` types.
- [x] Create level catalog.
- [x] Build Level 1 as tutorial-quality normal level.
- [x] Build Levels 2-4 normal progression.
- [x] Build Level 5 boss level.
- [x] Build Levels 6-10 with new hazards.
- [x] Build bonus level type.
- [x] Add procedural helper for later levels.
- [x] Add level select/debug jump in dev mode.

## Phase 8 - Scoring And Finish

- [x] Implement score system.
- [x] Implement coins formula.
- [x] Implement star ratings.
- [x] Implement high score persistence.
- [x] Create finish line trigger.
- [x] Create customer finish sequence.
- [x] Create big mouth finish sequence.
- [x] Animate pancakes being fed one by one.
- [x] Add finish multiplier pads.
- [x] Add reward screen count-up animation.

## Phase 9 - Boss System

- [x] Define boss config.
- [x] Create original boss mouth model.
- [x] Implement boss hunger HP.
- [x] Implement boss chomp timing.
- [x] Implement tongue sweep hazard.
- [x] Convert toppings to boss damage modifiers.
- [x] Add boss win/escape outcomes.
- [x] Add boss medal reward.
- [x] Add boss chest reward.

## Phase 10 - Progression And Shop

- [x] Implement save/load in `localStorage`.
- [x] Track coins, stars, unlock XP, cosmetics, upgrades.
- [x] Implement unlock XP that never decreases.
- [x] Implement reward chest table.
- [x] Implement duplicate reward conversion.
- [x] Implement plate skins.
- [x] Implement pancake skins.
- [ ] Implement topping packs.
- [x] Implement trails.
- [x] Implement gameplay upgrades.
- [x] Build shop UI.
- [ ] Balance costs/rewards.

## Phase 11 - Audio

- [x] Create AudioManager.
- [x] Add user-gesture audio unlock.
- [x] Add mute and volume persistence.
- [x] Add music loop placeholder.
- [x] Add collect SFX.
- [x] Add topping SFX variants.
- [x] Add hit/fall SFX.
- [x] Add glutton/eating/chomp SFX.
- [x] Add reward/coin/chest SFX.
- [ ] Mix levels for mobile speakers.

## Phase 12 - UI And Menus

- [x] Build HUD.
- [x] Build title screen.
- [x] Build pause/settings overlay.
- [x] Build fail screen.
- [x] Build level complete screen.
- [x] Build reward/chest screen.
- [x] Build shop screen.
- [x] Add responsive mobile layout.
- [x] Add accessible labels for buttons.
- [x] Verify text never overlaps controls.

## Phase 13 - Assets And Visual Polish

- [x] Create procedural pancake/plate/fruit assets.
- [x] Create track themes.
- [x] Create customer models.
- [x] Create boss model.
- [x] Add particles for crumbs, syrup, coins, stars.
- [x] Add impact squash/stretch.
- [x] Add camera shake for major hits.
- [x] Add confetti/fanfare on boss defeat.
- [ ] Add loading screen.
- [ ] Add app icon/preview image.

## Phase 14 - QA And Shipping

- [x] Add Playwright or equivalent visual smoke checks.
- [x] Verify desktop screenshot: canvas nonblank and framed.
- [x] Verify mobile screenshot: canvas nonblank and HUD readable.
- [ ] Test all game states.
- [ ] Test save reset/dev tools.
- [x] Test build output locally.
- [ ] Fix performance hotspots.
- [ ] Deploy to GitHub Pages path.
- [x] Document run/build commands.

## Iteration Rules

- Keep each phase playable at the end.
- Do not add shop/progression before the core run feels good.
- Do not tune economy until scoring and finish are stable.
- Prefer procedural assets first, then replace with richer models/textures.
- Every boss or reward system must work without ads.
- Save data bugs are high priority because progression is central.
