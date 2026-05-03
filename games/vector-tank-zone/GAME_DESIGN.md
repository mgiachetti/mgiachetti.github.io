# Vector Tank Zone - Game Design

## Intent

Build a polished 3D canvas tank arena inspired by classic vector tank combat:

- First/commander-view tank movement in a sparse 3D wireframe arena.
- Radar-driven target acquisition.
- Projectile combat with readable shells, reload timing, impact feedback, and arena positioning.
- Enemy tank archetypes, turret traps, wave escalation, scoring, levels, and boss encounters.
- Bosses with weak points that are actual collision targets, not decorative labels.
- Particles and explosions as core combat feedback from day one.

The game uses original title, UI, meshes, level content, sounds, and progression. It should feel like a vector-tank homage, not a direct asset/name copy.

## Target Platform

- Browser game deployable to GitHub Pages.
- Vite + TypeScript + Three.js.
- HTML/CSS HUD over WebGL canvas.
- Desktop keyboard and mouse/touch-friendly controls.
- Procedural geometry first; generated bitmap assets only if they materially improve production quality.

## Product

Working title: `Vector Tank Zone`.

Public slug: `/vector-tank-zone/`.

Visual direction:

- Dark battlefield with green, amber, cyan, and red vector signals.
- Wireframe tanks and terrain for readability.
- Solid low-poly shadow surfaces where mobile clarity needs mass.
- Radar and reticle are primary UI, not decorative overlays.

## Core Loop

1. Enter an arena.
2. Read radar and horizon to locate enemies.
3. Move, rotate, line up shots, and manage reload.
4. Destroy enemy armor while dodging shells.
5. Chain kills and preserve armor for score.
6. Break weak points during boss levels.
7. Complete the zone, earn medals, update high score, unlock the next level.
8. Continue into harder authored levels and procedural remixes.

## Game States

- `title`: start, install, mute, high score.
- `briefing`: tactical objective, threat count, target score, boss preview.
- `playing`: tank control, combat, radar, projectiles, particles.
- `levelClearing`: short victory sequence, projectile cleanup, boss explosion cadence.
- `paused`: hold simulation.
- `levelClear`: score, kills, accuracy, medals.
- `gameOver`: retry/home.

Planned later:

- `codex`: enemy and boss silhouettes.

## Input

Desktop:

- W/Up: forward.
- S/Down: reverse.
- A/Left: rotate left.
- D/Right: rotate right.
- Q/E: rotate turret independently from body.
- Space/Enter: fire.
- P/Escape: pause.
- R: retry after fail/clear.
- M: mute.

Touch:

- Drag lower screen to steer/throttle.
- Drag upper combat area to rotate turret; tap/hold there to fire.
- Keep HUD controls large and away from safe-area edges.

## Combat

Player tank:

- Armor starts at 100.
- Reload is visible in HUD.
- Shells are fast enough to feel direct but slow enough to dodge at range.
- Player shell damage starts at 42.

Enemy archetypes:

- Scout: fast, low HP, flanks and fires lighter shells.
- Tank: balanced main enemy.
- Heavy: slow, high HP, harder-hitting shell.
- Turret: stationary area control.
- Boss: large arena anchor with weak points and phase-like pressure.

Projectile rules:

- Shells have owner, position, velocity, damage, radius, and lifetime.
- Player shells collide with enemy hulls and weak points.
- Enemy shells collide with player armor.
- Misses expire at arena bounds.

## Particles And Explosions

Particles are a system, not polish:

- Muzzle flash on every shot.
- Impact sparks on non-kill hits.
- Weak-point cyan sparks.
- Destroyed enemies spawn debris and shock rings.
- Impacts can leave smoke plumes and scorch marks.
- Boss explosions use higher particle count, longer debris, and stronger audio.

Implementation rules:

- Particle meshes are pooled and capped to keep long sessions bounded.
- All major impact feedback must be visible in desktop and mobile smoke screenshots.
- Particle lifetime must be bounded to avoid leaking objects over long sessions.

## Boss Design

Boss level pattern:

- Guard wave establishes pressure.
- Boss enters as a large vector silhouette.
- Weak points are visible mesh children with their own HP.
- While weak points remain, hull damage is reduced.
- Destroying each weak point deals burst damage to the boss.
- Final explosion delays reward enough to read visually.

Bosses:

- Vector Citadel.
- Siege Warden.
- Rail Monarch.
- Prism Carrier.
- Crown Array.

Weak-point examples:

- Left reactor.
- Right reactor.
- Rear/upper core.
- Rail couplers.
- Prism nodes.
- Crown cores.

## Level System

Current implementation:

- 25 authored levels.
- Bosses on levels 5, 10, 15, 20, and 25.
- Objective variation: accuracy, armor reserve, streak, weak-point, and time goals.
- Procedural remix after level 25.

Target implementation:

- Keep at least 20 authored levels before remix.
- Every fifth level is a boss.
- Levels alternate open arenas, turret fields, heavy columns, scout swarms, night/radar pressure, and mixed boss guards.

Validation:

- Level IDs must match catalog positions.
- Spawns must stay inside arena bounds.
- Spawns must start far enough from the player.
- Target scores must stay inside an estimated score budget.
- Boss levels must define at least 3 weak points.

## Scoring

Score sources:

- Enemy damage and kills.
- Weak-point hits/destruction.
- Boss destruction.
- Accuracy medal.
- Target score medal.
- Time pressure bonus.
- No-damage bonus.
- Streak multiplier bonus.
- Objective bonus.

Medals:

- 1 for clear.
- +1 for target score.
- +1 for accuracy threshold.
- +1 for no-damage clears.
- +1 for objective completion.

Save data:

- Current level.
- High score.
- Total medals.
- Best score per level.
- Mute state.

## Technical Direction

Keep the structure modular:

- `Game.ts`: orchestration only.
- `SceneBuilder.ts`: renderer, camera, arena, mesh factories.
- `PlayerTank.ts`: player movement, camera anchor, reload/armor.
- `EnemySystem.ts`: runtime enemies, AI, weak points, radar data.
- `ProjectileSystem.ts`: shell lifecycle.
- `ParticleSystem.ts`: explosion/impact/muzzle effects.
- `Hud.ts`: DOM state and radar.
- `AudioManager.ts`: procedural music/SFX.
- `levelCatalog.ts`: authored and remix levels.

Avoid recreating the previous monolith. If a file grows past a clear responsibility boundary, split it before adding more features.
