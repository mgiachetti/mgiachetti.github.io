# Pancake Stack Run - Game Design

## Intent

Build a polished 3D canvas runner inspired by Pancake Run's core loop:

- Drag a plate left and right on a narrow track.
- Collect pancakes and toppings to build a tall stack.
- Avoid hazards that remove pancakes, reset the stack, or cause a fall.
- Reach a final eating sequence where stack height becomes score, coins, and rewards.

The game uses original name, art, audio, UI, and level content. It should feel close in rules and pacing, but not copy branded assets, logos, exact screens, or store metadata.

## Confirmed Research Notes

Sources reviewed:

- App Store: Pancake Run by Voodoo, action category, simple controls, "Can reach to the big mouth?", levels, in-app purchases, remove ads.
- Google Play: 10M+ downloads, contains ads/in-app purchases, action category, simple controls.
- YAD web version: drag the plate, make pancakes, add fruits, satisfy customers, stack high, traps/gluttons remove progress, reach goal.
- Gamezebo guide: collect pancakes/toppings, avoid falling off track edges, most obstacles clear the whole stack, pipes remove the top, lifting finger can stop, color gates require matching buttons.
- Reviews: repeated complaints about ads, maple syrup unlock bug, unlocked toppings not appearing, weak coin sink after skins, easy difficulty.

Design decisions:

- No ads.
- Unlocks always progress forward.
- Coins have multiple useful sinks.
- Obstacles remove fair amounts unless marked as instant fail.
- More readable difficulty ramp than the source game.
- Add boss rounds as an expanded final-mouth system.

## Target Platform

- Browser game.
- 3D canvas via Three.js/WebGL.
- Desktop mouse and mobile touch.
- Static build deployable on GitHub Pages.

Recommended stack:

- Vite + TypeScript + Three.js.
- HUD and menus in HTML/CSS over the canvas.
- Game simulation in TypeScript modules.
- Assets in `public/assets`.
- Save data in `localStorage`.

Vite is not required for Three.js, but it is useful here because the project will grow: many assets, audio, level JSON, modular code, production build, cache-busted files, and local dev server.

## Audience And Feel

Fast, snackable, tactile, colorful. The player should understand everything in one second:

- Bigger stack is better.
- Food is good.
- Blades, bars, holes, and hungry enemies are bad.
- The end mouth/customer sequence converts effort into reward.

Sessions should be short:

- Normal level: 45 to 75 seconds.
- Boss level: 75 to 100 seconds.
- Reward/shop loop: under 20 seconds.

## Core Loop

1. Start level.
2. Plate auto-runs forward while player steers laterally.
3. Player collects pancakes and toppings.
4. Obstacles test timing, path choice, stack height, and color matching.
5. Finish sequence consumes pancakes for score.
6. Rewards are granted.
7. Unlock/shop/progression screen.
8. Next level.

## Input

Primary:

- Pointer/touch down: engage control and resume forward motion.
- Drag horizontally: set target lane or continuous X position.
- Release: slow down to a near stop, useful for timing moving hazards.

Keyboard fallback:

- A/Left: steer left.
- D/Right: steer right.
- Space: hold to run, release to slow.
- R: restart after fail.
- M: mute.

Movement model:

- Forward speed ramps from 0 to target speed.
- Lateral motion follows a smoothed target X.
- Track limits clamp X unless track edge is open; open edge allows fall fail.

## Game States

- `boot`: load assets and init audio.
- `title`: start, continue, shop, settings.
- `run`: active level.
- `finish`: scripted eating/multiplier sequence.
- `reward`: score, coins, unlock progress, chest.
- `shop`: cosmetics/upgrades.
- `fail`: retry/continue.
- `pause`: optional simple pause.

## Scoring

Per level:

- Pancake collected: +10 score.
- Topping collected: +15 to +40 based on rarity.
- Combo bonus: consecutive collections without hazard.
- Finish feed bonus: +25 per pancake eaten.
- Boss bonus: +500 for boss defeated.
- Perfect route: +300 if no hazard hit and no fall.
- Stack max bonus: +5 per max stack height reached.

Coins:

```
baseCoins = floor(score / 100)
finishCoins = pancakesFed * finishMultiplier
perfectBonus = perfect ? 50 : 0
bossBonus = bossDefeated ? 150 : 0
coinsEarned = baseCoins + finishCoins + perfectBonus + bossBonus
```

Stars:

- 1 star: finish level.
- 2 stars: finish with score >= targetScore.
- 3 stars: finish with no major hazard hit and feed target reached.

High scores:

- Store best score per level.
- Store best max stack per level.
- Store total stars.
- Store highest boss streak.

## Stack System

Stack contents:

- Pancakes are base height units.
- Toppings attach to pancakes or sit between layers.
- Syrups coat the visible stack and add multiplier while active.

Visual:

- Pancakes are shallow cylinders with rounded, slightly irregular edges.
- Stack has sinusoidal wobble based on height, speed, and recent impacts.
- Top layers lag behind plate movement for satisfying motion.
- When pancakes are removed, they fly away with small arc animations and crumbs.

Gameplay:

- Minimum stack: 0 pancakes on plate.
- Soft fail: obstacles can remove partial stack.
- Hard fail: falling off track, getting crushed with zero stack, or hitting marked instant-fail hazards.
- Stack height changes collision with low bars and cutters.

Stack height formula:

```
visualHeight = pancakes * 0.16 + toppings * 0.04
stabilityPenalty = max(0, pancakes - stabilityUpgrade) * 0.01
wobble = baseWobble + stabilityPenalty + recentImpact
```

## Collectables

Food:

- Plain pancake: +1 stack.
- Golden pancake: +2 stack and coin burst.
- Mini pancake line: small path reward.
- Pancake tower pickup: +3 to +5, rare.

Toppings:

- Strawberry: score bonus, red visual.
- Banana: score bonus, yellow visual.
- Blueberry: combo helper.
- Chocolate chips: coin bonus.
- Butter: stack protection for one hit.
- Maple syrup: temporary finish multiplier.
- Whipped cream: adds a bonus layer and visual flair.

Power pickups:

- Magnet: pulls nearby food.
- Shield cloche: blocks one hazard.
- Stable plate: reduces wobble and prevents edge slip for a short time.
- Fever syrup: score multiplier and faster collection sounds.

## Obstacles

Minor hazards:

- Low pipe: removes top N pancakes based on height.
- Side scraper: removes pancakes on one side path.
- Rolling pin: moving horizontal hazard, partial stack loss.
- Jam puddle: slows lateral steering, leaves sticky trail.

Major hazards:

- Blade gate: removes most stack unless timed.
- Glutton: eats pancakes while overlapping, can empty stack if player stays.
- Slammer: vertical press, instant fail if stack/player under it at wrong time.
- Open edge: fall fail.

Choice gates:

- Color gate: hit the matching button or lane to open.
- Bonus/loss gate: choose between high-risk high-reward paths.
- Height gate: stack above/below threshold opens different reward lanes.

Boss hazards:

- Tongue sweep: lateral moving obstacle before mouth.
- Chomp timing: final mouth opens/closes; entering while closed loses stack.
- Hunger meter: boss requires enough fed pancakes.

## Level Types

Normal:

- Main collect/avoid loop.
- Finish with customers or medium mouth.

Challenge:

- Narrow track, moving hazards, higher score target.
- Optional daily-style seed later.

Boss:

- Every 5th level.
- Final big mouth has hunger HP.
- Enough pancakes defeats boss and grants chest.
- Not enough pancakes still completes the run if minimum target is met, but no boss chest.

Bonus:

- Low-risk reward level.
- Dense food paths, coin lane, no instant-fail hazards.

## Finish Sequence

Normal finish:

1. Player crosses finish line.
2. Camera swings to front/side.
3. Customers or a giant mouth appear.
4. Pancakes fly/eat one by one.
5. Meter fills: customer satisfaction or hunger.
6. Score/coins count up.
7. Chest/unlock progress appears.

Multiplier finish:

- Final path has pads: x1, x2, x3, x5.
- Stack height and path determine reached multiplier.
- Multipliers affect finishCoins, not all score, to keep balance stable.

Boss finish:

- Boss HP = hunger.
- Each pancake fed deals 1 damage.
- Toppings add damage modifiers.
- If HP reaches 0: boss defeated, chest opens.
- If HP remains: normal clear but "Boss Escaped" result.

## Progression

Permanent resources:

- Coins.
- Stars.
- Unlock XP.
- Boss medals.

Shop categories:

- Plate skins: ceramic, metal tray, golden plate, waffle tray.
- Pancake skins: classic, chocolate, matcha, red velvet.
- Topping packs: fruit, dessert, candy.
- Trails: syrup trail, sparkle crumbs, steam.
- Gameplay upgrades:
  - Start stack +1/+2/+3.
  - Magnet radius.
  - Shield duration.
  - Stability.
  - Coin value.

Unlock policy:

- Every level grants unlock XP.
- Boss chest grants one guaranteed cosmetic shard.
- No unlock progress ever decreases.
- Already-owned rewards convert to coins.

## Economy

Coin costs:

- Cosmetic common: 250.
- Cosmetic rare: 600.
- Cosmetic epic: 1200.
- Upgrade tier 1: 300.
- Upgrade tier 2: 800.
- Upgrade tier 3: 1600.

Chest rewards:

- 60% coins.
- 25% cosmetic shard.
- 10% powerup bundle.
- 5% rare cosmetic.

No ads:

- No ad multipliers.
- Multipliers are earned in gameplay.
- Optional debug/dev reward controls only in development.

## Assets

Procedural first, replaceable later:

- Pancake mesh: cylinder + bevel approximation.
- Plate mesh: cylinder/ring.
- Fruits: simple low-poly shapes.
- Syrup: translucent ribbons/drops.
- Obstacles: simple primitives with strong silhouettes.
- Customers: simple stylized low-poly heads/bodies.
- Boss mouth: original cartoon mouth/face, not Voodoo asset.

Asset folders:

```
public/assets/models
public/assets/textures
public/assets/audio/music
public/assets/audio/sfx
public/assets/ui
```

Texture style:

- Bright but not one-note.
- Pancakes warm beige, fruit colors, mint/cyan track, red hazard accents.
- Avoid copying screenshot layouts exactly.

## Audio

Browser note:

- Audio starts after first user gesture.
- Include mute and volume settings.

Music:

- Short looping upbeat track.
- Lower volume during reward count-up if needed.

SFX:

- UI click.
- Start run.
- Pancake collect.
- Topping collect variants.
- Combo tick.
- Stack wobble/creak.
- Hit pipe.
- Blade hit.
- Pancake fall.
- Glutton eat.
- Gate success/fail.
- Finish line.
- Eating/chomp.
- Coins count.
- Chest open.
- Boss defeated.
- Fail.

Implementation:

- Use Web Audio API or HTMLAudioElement wrapper.
- Procedural placeholder sounds can be generated first.
- Later replace with authored `.mp3`/`.ogg` assets.

## UI

HUD:

- Current level.
- Progress bar.
- Coins total.
- Score.
- Stack count.
- Combo/multiplier.
- Mute/settings button.

Menus:

- Title with playable first viewport feel, not marketing copy.
- Level complete.
- Reward chest.
- Shop.
- Settings.

Mobile:

- Full-screen canvas.
- Large tap targets.
- HUD safe-area padding.
- No text overlap with notch/home indicator.

## Technical Architecture

Modules:

```
src/main.ts
src/game/Game.ts
src/game/GameState.ts
src/game/PlayerController.ts
src/game/PlayerStack.ts
src/game/LevelRunner.ts
src/game/CollisionSystem.ts
src/game/ScoringSystem.ts
src/game/ProgressionSystem.ts
src/render/SceneFactory.ts
src/render/CameraRig.ts
src/render/Materials.ts
src/render/Effects.ts
src/levels/LevelData.ts
src/levels/levelCatalog.ts
src/audio/AudioManager.ts
src/ui/Hud.ts
src/ui/Menus.ts
src/utils/math.ts
```

Data-driven entities:

- Collectables.
- Hazards.
- Gates.
- Finish config.
- Boss config.

Level data example:

```ts
type LevelData = {
  id: number;
  kind: "normal" | "challenge" | "boss" | "bonus";
  length: number;
  targetScore: number;
  track: TrackSegment[];
  entities: LevelEntity[];
  finish: FinishConfig;
};
```

Performance:

- Reuse geometries/materials.
- Pool collectables and pancake meshes.
- Cap visible stack details at very high heights with simplified layers.
- Use simple bounding boxes/spheres for collision.
- Avoid full physics until needed.

## QA Criteria

Functional:

- Game starts after tap/click.
- Canvas renders on desktop and mobile sizes.
- Pointer and keyboard controls work.
- Collecting increases stack and score.
- Hazards remove correct stack amount.
- Falling fails.
- Finish converts stack to score/coins.
- Boss levels can be won/lost fairly.
- Save data persists after refresh.
- Mute persists.

Visual:

- No blank canvas.
- Camera frames the plate and track.
- Stack visible at all heights.
- HUD text does not overlap.
- Buttons fit on mobile.
- Hazards are readable before impact.

Audio:

- No autoplay errors.
- Mute works.
- SFX do not stack into distortion.

Build:

- `npm run build` succeeds.
- Static build can be served locally.

## Milestones

1. Project foundation.
2. Playable runner.
3. Stack and collectables.
4. Obstacles and collisions.
5. Finish scoring.
6. Boss and rewards.
7. Progression/shop.
8. Audio and effects.
9. Level content.
10. Polish and QA.
