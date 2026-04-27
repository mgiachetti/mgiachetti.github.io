# Crew Count Clash - Research Notes

Research target: Count Masters: Crowd Runner 3D and adjacent browser clones/reviews.

Goal: identify the feature set worth reproducing as original mechanics in `Crew Count Clash`, then expand it with the requested boss, bonus roulette, moving platforms, traps, final stairs, shop, and sound.

## Sources

- App Store, Count Masters: Crowd Runner 3D: https://apps.apple.com/us/app/count-masters-crowd-runner-3d/id1568245971
- Onga browser write-up: https://onga.io/play/count-masters-crowd-runner-3d-xn7E
- TopGames summary and walkthrough hub: https://www.topgames.com/Count-Masters-Crowd-Runner-3d
- IOFreeOnline review/screenshot page: https://www.iofreeonline.com/IOS/game/Count-Masters-Crowd-Runner-3D.html
- App Store reviews page: https://apps.apple.com/us/app/count-masters-crowd-runner-3d/id1568245971?see-all=reviews
- YAD browser game page: https://www.yad.com/Count-Masters-Crowd-Runner-3d
- PuzzleGame browser game page: https://www.puzzlegame.com/Count-Masters-Crowd-Runner-3d
- MWM app analysis page: https://mwm.ai/apps/count-masters-crowd-runner-3d/1568245971

## High-Confidence Features

These are directly supported by multiple sources:

- One-touch or drag steering.
- Auto-runner on a narrow 3D platform track.
- Start with a tiny group, often one runner.
- Collect or recruit additional runners.
- Choose math gates under pressure.
- Green/helpful and red/harmful gate language.
- Fight opposing crowds.
- Obstacles/traps reduce the group.
- Collect coins.
- Upgrade between levels.
- Defeat a king/boss-like final enemy.
- Capture/take a castle at the end.
- Short replayable levels.
- Bright, simple 3D visuals.
- Skins/customization exist or are expected by players.
- Ads and weak late-game currency sinks are common complaints.

## Medium-Confidence Features

These appear in browser descriptions, review pages, walkthrough references, or player reviews:

- Moving platforms.
- Narrow paths.
- Speed zones.
- Optional jump in some web descriptions.
- Bonus/boss level cadence.
- Diamond/gem reward multiplier dial after bonus/boss levels.
- Randomized or infinite-feeling level flow.
- City/building meta section.
- More skins added over time.
- Sound effects and vibration feedback.
- Large-count performance and fairness problems in later levels.

## Design Additions For Our Version

The requested game should be more complete than a straight first-pass clone:

- Original rounded space-crew runners with visor/backpack.
- No ads and no rewarded-ad gates.
- Full boss system with HP, phases, attacks, minions, medals, and castle capture.
- Bonus roulette as a physical 3D wheel, powered by tickets/gems.
- Moving platforms as real gameplay modules, not background props.
- Final stairs with multipliers, chests, gem vaults, and camera reveal.
- Useful shop with gameplay upgrades, cosmetics, roulette luck, and base/castle build.
- Save progression with migrations.
- Procedural levels after authored content.
- Automated smoke tests and visual checks like the Pancake project.

## Feature Matrix

| Feature | Count Masters Signal | Crew Count Clash Plan |
| --- | --- | --- |
| Steering | One-touch/drag, mouse/touch | Pointer, touch, keyboard fallback |
| Crowd growth | Collect/gates | Loose crew, capsules, math gates |
| Gate math | Add/multiply central mechanic | Add, subtract, multiply, divide, percent, timed, split, color |
| Enemy crowds | Clash with opposing crowd | Static, patrol, armored, mini-boss squads |
| Obstacles | Crash/avoid traps | Full trap library with telegraphs |
| Moving platforms | Mentioned in web write-ups | Dedicated platform system |
| Final fight | King-stickman/castle | Multi-boss system with HP and phases |
| Final payoff | Castle/finale | Final stairs, multiplier bands, castle capture |
| Bonus | Player reviews mention dial/diamonds | 3D roulette level with visible rewards |
| Shop | Coins/upgrades/skins | Upgrades, cosmetics, base, shards, tickets |
| Currency | Coins/diamonds | Coins, gems, medals, stars, shards |
| Meta | City/building references | Castle/space-base build screen |
| Audio | Reviews mention sound/vibration | Web Audio music and SFX suite |
| Fairness | Reviews complain about impossible large crowds | Formation compression, safe-route validation |

## Mechanics To Copy In Spirit, Not Literally

- Math gate tension: fast decision between `+N` and `xN`.
- Crowd subtraction battle: bigger group survives enemies.
- Big final reveal: surviving count converts to reward.
- Bright toy-like readable track style.
- Short level cadence.

## Mechanics To Improve

- Remove ad-dependent reward doubling.
- Make currencies useful after early upgrades.
- Avoid impossible late levels caused by crowd width.
- Better readability for moving hazards.
- Make bonus/boss optional or at least fairly rewarded.
- Add deterministic authored levels before procedural remix.

## Implementation Implications

- Instancing is mandatory for many visible runners.
- Gate text needs stable, readable rendering.
- Crowd simulation should be deterministic enough for tests.
- Platform/hazard timing should be data-driven.
- Economy must be delayed until core run and finale are playable.
- Save system needs versioning because this game has more progression than Pancake Stack Run.

## Visual Polish Findings From Original-Like References

- The end of a boss/castle level should read as a takeover, not only a reward trigger: gate opening, flag change, boss defeat pose, crowd push-in, confetti, and delayed reward.
- The meta layer should show a city/base/castle being built over time. Progress needs to be visible from the home loop, not hidden in currency totals.
- The track feels closer when it has more readable world dressing: side buildings, towers, banners, castle doors, warning decals, and chunkier gate posts.
- Gates benefit from extra "juice": brighter glass, glow, posts, number badges, impact particles, and clear positive/negative color language.
- Traps should have stronger identity: sparks on saw/laser areas, smoke or dust on crushers/hammers, warning stripes, and active telegraphs.
- Boss arenas can look less repetitive by giving each boss a distinct arena dressing, door, weapon silhouette, and victory banner.
- Reward moments should be theatrical: chests, gem piles, ticket cards, roulette spotlight, longer prize reveal, and larger prize typography.
- Cosmetics should be more visible during play: hats/helmets, trails, backpacks, and victory poses are stronger than tiny palette changes.
