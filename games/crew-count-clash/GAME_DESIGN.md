# Crew Count Clash - Game Design

## Intent

Build a polished 3D canvas crowd-runner inspired by Count Masters' core loop:

- Steer a growing crowd left and right through a 3D track.
- Choose math gates that add, subtract, multiply, divide, or split the crowd.
- Dodge traps, moving platforms, holes, and enemy squads.
- Preserve enough runners to win the final stairs, boss fight, and castle capture.
- Spend coins/gems in a useful shop with skins, upgrades, roulette, and meta rewards.

The visual hook is an original "space crew" runner: rounded body, small legs, backpack, and visor. It should feel close to the desired silhouette, but use original proportions, colors, names, meshes, sounds, UI, and level content.

## Confirmed Research Notes

Sources reviewed:

- App Store listing for Count Masters: Crowd Runner 3D: choose the best gate, bring warriors together, clash with opposing crowd, collect coins, upgrade levels, defeat a King-stickman, and take the castle.
- Google Play listings and browser game mirrors: crowd runner, gates, enemies, obstacles, coins, upgrades, power-ups, multiple levels, offline-style short sessions.
- Onga browser write-up: steer with mouse/touch/keyboard, grow followers, avoid traps, moving platforms, narrow paths, speed zones, optional jump, and quick replayable levels.
- App Store reviews: boss/bonus levels, post-level diamond multiplier dial, coins/gems, randomized level flow, skins, build/city section, sound effects/vibrations, and common pain points with ads and weak coin sinks.
- Walkthrough/video index pages and screenshot pages: repeated level formula, early tutorial gates, enemy crowds, castle/boss endings, and late-level variations.
- Third-party review pages: multiplier gate math, dangerous obstacle courses, boss finales, customization, and city-building meta-game.

Design decisions:

- No ads, no rewarded-ad mechanics, no third-party tracking.
- Keep the quick math tension: `x2` is better only once the crowd is big enough.
- Add the requested features as first-class systems, not one-off decorations: boss, roulette bonus, moving platforms, traps, final stairs, shop, sound.
- Improve source-game pain points: fair track widths, readable hazards, useful currency sinks, replayable rewards, and deterministic level QA.
- Use procedural/native 3D assets first, then add generated bitmap textures only where they materially improve the look.

## Target Platform

- Browser game.
- 3D canvas via Three.js/WebGL.
- Desktop mouse, keyboard, and mobile touch.
- Static build deployable to GitHub Pages.

Recommended stack:

- Vite + TypeScript + Three.js.
- HTML/CSS HUD over the canvas.
- Procedural 3D meshes for runners, gates, enemies, traps, boss, castle, and roulette.
- Web Audio procedural music/SFX first, with optional generated audio files later.
- Save data in `localStorage`.
- Build output to root `crew-count-clash/` so GitHub Pages serves `/crew-count-clash/`.

## Product Name

Working title: `Crew Count Clash`.

Reason:

- Signals crowd counting and combat.
- Avoids copying the Count Masters name.
- Supports the rounded space-crew art direction without using official Among Us naming.

## Audience And Feel

Fast, colorful, readable, tactile. The player should understand the screen instantly:

- Blue crew is yours.
- Red/purple squads are enemies.
- Green/blue gates help, orange/red gates hurt.
- Bigger crowd means bigger chance to survive fights and climb farther.
- Final stairs, boss damage, and roulette convert the run into rewards.

Target session length:

- Normal level: 45 to 75 seconds.
- Trap/moving-platform level: 60 to 90 seconds.
- Boss level: 80 to 120 seconds.
- Bonus roulette level: 30 to 60 seconds.
- Reward/shop loop: under 25 seconds.

## Core Loop

1. Start level with a small crew.
2. Auto-run forward while steering laterally.
3. Collect loose crew members and coins.
4. Choose gates to grow, multiply, or protect the crowd.
5. Avoid hazards that remove crew members or break the formation.
6. Fight enemy squads by count subtraction.
7. Reach the finale: stairs, boss, castle, or roulette.
8. Convert remaining count to coins, gems, score, stars, and unlock progress.
9. Spend rewards in shop/upgrades/base/cosmetics.
10. Continue to the next authored or procedural level.

## Input

Primary:

- Pointer/touch down: start and steer.
- Drag horizontally: set crowd center X.
- Release: keep running at normal speed, with optional low-friction assist on mobile.

Keyboard fallback:

- A/Left: steer left.
- D/Right: steer right.
- Space/Enter: start or confirm.
- R: retry after fail.
- P/Esc: pause.
- M: mute.

Optional late feature:

- Swipe up / Space during specific levels to jump small gaps or hop onto moving platforms.

## Game States

- `boot`: load assets, init renderer, load save data.
- `title`: start, continue, level map, shop, settings.
- `run`: active runner gameplay.
- `battle`: short lock-in when crowd clashes with enemies or boss minions.
- `stairs`: final ladder/stair multiplier sequence.
- `boss`: giant enemy/castle fight finale.
- `roulette`: bonus wheel sequence.
- `reward`: coins, gems, stars, chests, unlocks.
- `shop`: skins, upgrades, cosmetics, roulette tickets, base upgrades.
- `fail`: retry, continue to shop, or restart.
- `pause`: mute/settings/retry.

## Core Crowd System

Crowd count:

- Start count is driven by upgrades and level config.
- Each visible runner represents one crew member until performance cap.
- Above visual cap, extra count is represented with denser formation, billboards, or count badge.

Formation:

- Dynamic oval/grid formation around a steerable center.
- Front rows compress on narrow paths.
- Runners seek assigned slots with spring motion.
- Formation width grows with count but never exceeds safe track bounds unfairly.
- Individuals can be knocked out by local hazards; the group can also lose count globally.

Crew model:

- Rounded capsule body.
- Short two-step legs.
- Small backpack module.
- Glossy visor.
- Color variants by skin.
- Tiny animation loop: bob, leg swing, visor glint, panic wobble on hazards.

Performance:

- Full 3D meshes for first 80 to 120 visible runners.
- Instanced meshes for body/visor/backpack/legs.
- Crowd simulation uses lightweight positions, not physics bodies.
- Target mobile: 60 FPS on small crowds, graceful degradation on huge counts.

## Gate System

Gate types:

- Add: `+5`, `+10`, `+25`.
- Subtract: `-5`, `-20`.
- Multiply: `x2`, `x3`, `x5`.
- Divide: `/2`, `/3`.
- Percent: `+50%`, `-30%` for later levels.
- Convert: sacrifice count for shield/coins/boss damage.
- Choice pair: two or three side-by-side gates.
- Timed gates: value changes every few seconds.
- Rotating gates: swing left/right and force timing.
- Color/team gate: only opens for a matching crew color or switch.
- Split gate: divides the crowd into two lanes, then rejoins.

Gate feedback:

- Big readable text above each gate.
- Helpful gates use cool/green glass.
- Harmful gates use red/orange warning material.
- Preview number appears over the crowd before passing when possible.
- Passing a gate spawns count popups and audio pitch changes.

Gate math:

```
add(n): count += n
subtract(n): count = max(0, count - n)
multiply(n): count *= n
divide(n): count = ceil(count / n)
percent(p): count = round(count * (1 + p))
```

Fail rule:

- Count reaching zero during the run fails immediately unless a shield/revive is active.

## Collectables

- Loose crew: +1 each, often placed in curved lines.
- Crew capsule: +5 or +10, rare.
- Coins: normal currency.
- Gems: premium in-game currency, earned via boss/bonus/chests only.
- Shield battery: blocks one trap loss.
- Magnet drone: pulls coins and loose crew.
- Frenzy beacon: temporary speed and coin multiplier.
- Commander flag: improves formation compression for a short window.
- Boss bomb: adds bonus damage in boss finale.
- Roulette ticket: enters the roulette level without ads.

## Hazards And Traps

Minor hazards:

- Low bumpers: knock out front row.
- Side scrapers: remove runners on one side.
- Slow goo: spreads formation and reduces steering.
- Conveyor belts: push crowd sideways.
- Narrow bridge: forces compression and clean steering.

Major hazards:

- Rotating bars: sweep rows away.
- Saw lanes: remove any runner touching the blade strip.
- Crushers/hammers: timed vertical smash.
- Swinging axes: pendulum timing.
- Spike rollers: moving cylinder that trims a lane.
- Cannon balls: telegraphed projectiles.
- Laser gates: flicker on/off.
- Trap doors: open holes in the track.
- Falling platforms: collapse after the crowd steps on them.
- Fan blowers: push the formation toward edges.

Fairness rules:

- Every high-damage hazard gets a warning decal or shadow.
- Moving hazards have predictable rhythm.
- The player must see the next gate/hazard early enough to react.
- No level should become impossible only because the crowd got large.

## Moving Platforms

Platform types:

- Lateral shuttle platform.
- Forward/back elevator bridge.
- Rotating turntable.
- Tilting plank.
- Rising/falling step bridge.
- Conveyor platform.
- Collapsing tiles.
- Split-path moving islands.

Design goals:

- They should test timing and crowd compression.
- They must support large crowds by widening, grouping, or allowing partial losses.
- Hazard and platform motion should sync with readable camera distance.

## Enemy Squads

Enemy behavior:

- Static red squads placed after gates.
- Patrolling squads crossing lanes.
- Armored squads that remove extra count per enemy.
- Mini-boss guards before boss gate.
- Enemy gates that spawn extra enemies if hit.

Battle formula:

```
remaining = playerCount - enemyCount * enemyStrength
if remaining > 0:
  playerCount = remaining
  score += enemyCount * battleScore
else:
  fail or trigger last-stand animation
```

Visual:

- Player crew and enemy crew collide in a short swirl.
- Knocked-out runners fly off with soft toy-like impacts.
- Result number pops above the clash.

## Final Stairs

Purpose:

- Convert remaining crowd into visible reward.
- Preserve the Count Masters-style "how far can my count climb" payoff.

Rules:

- Each runner spends one unit to climb one stair, or groups climb as rows for high counts.
- Every stair has a multiplier/reward band: `x1`, `x2`, `x3`, `x5`, `x10`, chest, gem vault.
- Higher stairs require more runners per step in later levels.
- Perfect/no-hit runs add a final stair boost.

Visual:

- Tall staircase into a castle/ship gate.
- Crowd streams upward.
- Remaining count drains as a big number.
- Camera tilts up to reveal the best reached multiplier.

## Boss System

Boss archetypes:

- Castle King: giant crowned enemy guarding the gate.
- Mecha Guard: stomps lanes and spawns drones.
- Chef Crusher: giant mallet and conveyor traps.
- Neon Titan: laser sweeps and shield phases.
- Space Captain: final boss with minions and moving platforms.

Core boss loop:

1. Crowd reaches arena.
2. Boss HP is shown as a large bar.
3. Crowd automatically attacks when in range.
4. Each runner contributes damage, then can be knocked out by boss attacks.
5. Player still steers to dodge stomp lanes, collect reinforcements, and hit weak points.
6. Defeating boss opens castle and grants medals/gems.

Boss mechanics:

- HP scales by level.
- Stomp attack telegraphs red lane.
- Sweep attack pushes rows away.
- Minion waves subtract count.
- Weak-point gate multiplies damage if hit.
- Last 20% HP enters faster phase.

Outcomes:

- Defeat boss: full reward, boss medal, castle capture.
- Survive but fail to defeat: partial reward and replay prompt.
- Count reaches zero: fail state.

## Bonus Roulette

Bonus level trigger:

- Every 4 to 5 normal levels.
- Boss victory can grant a roulette ticket.
- Shop can sell tickets for coins/gems.

Gameplay:

- Short coin/crew collection runway.
- No lethal fail unless the player falls off.
- Ends at a big physical roulette wheel.

Roulette rewards:

- Coin multiplier: `x2`, `x3`, `x5`.
- Gems.
- Skin shard.
- Upgrade discount.
- Boss damage token.
- Mystery chest.
- Rare jackpot: unique visor/trail.

No-ad policy:

- The wheel spins once per earned ticket.
- Extra spins cost tickets/gems only, never ads.
- Reward odds are visible enough for trust.

## Progression

Currencies:

- Coins: common, from levels and stairs.
- Gems: boss, roulette, milestone, chests.
- Medals: boss-specific trophies.
- Skin shards: unlock cosmetics.
- Stars: performance progression per level.

Save data:

- Current level.
- Best score per level.
- Best final stair per level.
- Best remaining count per level.
- Total coins/gems/stars/medals.
- Owned/equipped cosmetics.
- Upgrade levels.
- Roulette tickets.
- Base/castle build progress.

Level progression:

- 20 authored levels for strong variety.
- Procedural remix after level 20 using safe templates.
- Every fifth level is boss or special.
- Bonus roulette appears as separate interlude.

## Shop

Gameplay upgrades:

- Start Crew: begin with more runners.
- Gate Bonus: positive gates add a small extra percent.
- Formation Control: tighter crowd and less edge loss.
- Shield Charge: start with one shield every N levels.
- Coin Value: more coin payout.
- Boss Damage: runners deal more boss damage.
- Magnet Range: larger pickup radius.
- Roulette Luck: slightly improves wheel weights.

Cosmetics:

- Crew body colors.
- Visor colors.
- Backpack variants.
- Hats/helmets.
- Trails.
- Victory dances.
- Formation shapes.
- Enemy themes.

Meta/base:

- Castle rooms or space base modules.
- Decorative build pieces purchased with gems.
- Build milestones unlock skins, music layers, and bonus tickets.

Shop rules:

- No upgrade should fully trivialize hazards.
- All currencies must have long-term sinks.
- Duplicates convert to shards/coins.
- Cosmetics do not affect hitboxes.

## Scoring

During run:

- Gate bonus: based on count gained.
- Coin pickup: fixed score.
- Enemy defeated: enemy count and strength.
- Hazard survival: small bonus for close dodges.
- No-hit combo: grows reward multiplier.

Final:

```
score =
  runDistance * 2
  + maxCrowd * 15
  + enemiesDefeated * 25
  + finalStair * 100
  + bossDefeated ? 1000 : 0
  + noHit ? 500 : 0
```

Coins:

```
coins =
  floor(score / 120)
  + stairMultiplierReward
  + collectedCoins * coinValueUpgrade
  + bossBonus
```

Stars:

- 1 star: finish.
- 2 stars: reach target final count or stair.
- 3 stars: no major trap hit and beat target score.

## Audio

Music:

- Bright hyper-casual loop for normal levels.
- Percussive boss variation.
- Bonus roulette carnival/electro loop.
- Shop/base softer loop.

SFX:

- Gate pass: rising/falling pitch based on math result.
- Runner added: pop/boop cluster.
- Runner lost: soft thud/whoosh.
- Enemy clash: toy percussion and crowd chatter.
- Trap warning: subtle beep or mechanical cue.
- Boss stomp/sweep/defeat.
- Stair climb tick.
- Roulette spin, slowdown ticks, jackpot.
- Coin/gem/chest rewards.

Rules:

- Audio unlocks on user gesture.
- Mute persists.
- Keep mobile speakers in mind: short, clean sounds, limited low-end.

## Visual Direction

World:

- Floating city/space-platform tracks.
- Bright sky gradients, clean shadows, readable materials.
- Track color changes by biome: city, candy, neon, factory, castle, space dock.

Objects:

- Gates as translucent glass panels.
- Numbers as 3D text or HTML labels anchored in world.
- Traps are chunky and toy-like, not realistic gore.
- Bosses are oversized original characters with clear attack telegraphs.

UI:

- HUD: count, coins, level, progress, shield/magnet timers.
- Big readable gate numbers.
- Reward panels with count-up animation.
- Shop grid with owned/equipped/locked states.
- Roulette wheel with physical pointer and clear reward labels.

## Level Catalog Plan

Initial authored set:

1. Tutorial: `+` gates, loose crew, final stairs.
2. First enemy squads and `x2` gates.
3. Negative gates and side scrapers.
4. Moving shuttle platforms and narrow bridges.
5. Boss: Castle King.
6. Bonus roulette unlock.
7. Timed gates and rotating bars.
8. Split paths and conveyors.
9. Cannons, lasers, shield pickup.
10. Boss: Mecha Guard.
11. Collapsing platforms.
12. Color/team gates and switch pads.
13. Trap doors and fan blowers.
14. High-value risky `x5` gates.
15. Boss: Chef Crusher.
16. Bonus roulette with jackpot skin.
17. Percent gates and armored enemies.
18. Tilting bridges and enemy patrols.
19. Full mixed obstacle gauntlet.
20. Boss: Space Captain and long final staircase.

Procedural remix:

- Generate levels from safe segment templates.
- Always validate minimum possible success route.
- Keep one primary mechanic per segment and one secondary mechanic per level.

## QA Requirements

- Production build must pass.
- Desktop screenshot: nonblank canvas, readable HUD, no text overlap.
- Mobile screenshot: nonblank canvas, thumb-friendly controls, no clipped text.
- Smoke checks for:
  - Start level.
  - Gate math.
  - Enemy battle.
  - Trap loss.
  - Final stairs.
  - Boss level.
  - Roulette level.
  - Shop purchase/equip.
  - Save/load persistence.

## Open Decisions

- Final public slug: suggested `/crew-count-clash/`.
- Whether the first release ships with all 20 authored levels or 10 authored + procedural remix.
- Whether to generate bitmap textures for crew visors/floor decals after core gameplay is stable.
- Whether to add a simple level editor/debug timeline for faster tuning.
