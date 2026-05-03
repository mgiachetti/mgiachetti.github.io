import type { EnemySpawn, LevelData, LevelObjective, WeakPointConfig } from "../game/types";
import { seededRandom } from "../utils/math";

const lanes = [-24, -12, 0, 12, 24];
const playerStart = { x: 0, z: -8 };
const scoreByKind: Record<EnemySpawn["kind"], number> = {
  scout: 140,
  tank: 210,
  heavy: 340,
  turret: 220,
  boss: 1200
};

function enemy(id: string, kind: EnemySpawn["kind"], x: number, z: number, delay = 0, hp?: number): EnemySpawn {
  return { id, kind, x, z, delay, hp };
}

function ring(prefix: string, count: number, radius: number, kind: EnemySpawn["kind"], delayStep = 0.18): EnemySpawn[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return enemy(`${prefix}-${index}`, kind, Math.sin(angle) * radius, Math.cos(angle) * radius, index * delayStep);
  });
}

function squad(prefix: string, z: number, kinds: EnemySpawn["kind"][]): EnemySpawn[] {
  return kinds.map((kind, index) => enemy(`${prefix}-${index}`, kind, lanes[index % lanes.length], z + Math.floor(index / lanes.length) * 8, index * 0.28));
}

const bossWeakPoints = [
  { id: "left-reactor", label: "L", x: -2.2, y: 1.8, z: 1.4, hp: 70 },
  { id: "right-reactor", label: "R", x: 2.2, y: 1.8, z: 1.4, hp: 70 },
  { id: "core", label: "CORE", x: 0, y: 2.25, z: -1.8, hp: 95 }
];

function bossWeakSet(boost = 0, spread = 1, extra = false): WeakPointConfig[] {
  const points = bossWeakPoints.map((point) => ({ ...point, x: point.x * spread, hp: point.hp + boost }));
  if (extra) {
    points.push({ id: "crown-node", label: "TOP", x: 0, y: 3.05, z: 0.6, hp: 80 + boost });
  }
  return points;
}

export const levelCatalog: LevelData[] = [
  {
    id: 1,
    name: "Rangefinder",
    arenaSize: 74,
    targetScore: 900,
    enemySpawns: [
      enemy("scout-a", "scout", -14, 18),
      enemy("tank-a", "tank", 16, 26, 0.7),
      enemy("turret-a", "turret", 0, 34, 1.1)
    ]
  },
  {
    id: 2,
    name: "Crossfire Basin",
    arenaSize: 82,
    targetScore: 1500,
    enemySpawns: [...squad("wave-a", 22, ["scout", "tank", "scout"]), enemy("heavy-a", "heavy", 24, 34, 1.6)]
  },
  {
    id: 3,
    name: "Radar Trap",
    arenaSize: 88,
    targetScore: 2200,
    enemySpawns: [...ring("outer-scout", 5, 30, "scout", 0.24), enemy("turret-center", "turret", 0, 22, 0.8)]
  },
  {
    id: 4,
    name: "Iron Lattice",
    arenaSize: 92,
    targetScore: 2900,
    enemySpawns: [...squad("iron-a", 26, ["tank", "tank", "heavy"]), ...ring("iron-scout", 4, 34, "scout", 0.2)]
  },
  {
    id: 5,
    name: "Citadel Core",
    arenaSize: 96,
    targetScore: 4300,
    enemySpawns: [...squad("guard", 24, ["tank", "scout", "tank"]), enemy("rear-turret", "turret", -28, 18, 0.6)],
    boss: {
      name: "Vector Citadel",
      hp: 360,
      attackInterval: 1.15,
      score: 1500,
      weakPoints: bossWeakPoints
    }
  },
  {
    id: 6,
    name: "Minefield Run",
    arenaSize: 100,
    targetScore: 3800,
    enemySpawns: [...ring("minefield", 6, 36, "scout", 0.16), enemy("heavy-anchor", "heavy", 0, 38, 1.2)]
  },
  {
    id: 7,
    name: "Heavy Column",
    arenaSize: 104,
    targetScore: 4700,
    enemySpawns: [...squad("column", 25, ["heavy", "tank", "heavy", "tank"]), ...ring("screen", 4, 40, "scout", 0.2)]
  },
  {
    id: 8,
    name: "Turret Crown",
    arenaSize: 106,
    targetScore: 5200,
    enemySpawns: [...ring("turret", 6, 34, "turret", 0.12), ...squad("rush", 18, ["scout", "scout", "tank"])]
  },
  {
    id: 9,
    name: "Night Sweep",
    arenaSize: 112,
    targetScore: 6100,
    enemySpawns: [...ring("night", 8, 42, "scout", 0.13), ...squad("night-armor", 28, ["tank", "heavy", "tank"])]
  },
  {
    id: 10,
    name: "Warden Platform",
    arenaSize: 116,
    targetScore: 7200,
    enemySpawns: [...squad("warden-guard", 24, ["heavy", "tank", "tank", "heavy"]), ...ring("warden-screen", 4, 44, "turret", 0.18)],
    boss: {
      name: "Siege Warden",
      hp: 480,
      attackInterval: 0.98,
      score: 2100,
      weakPoints: bossWeakSet(24, 1.1)
    }
  },
  {
    id: 11,
    name: "Prism Ambush",
    arenaSize: 118,
    targetScore: 6900,
    enemySpawns: [...ring("prism-scout", 8, 43, "scout", 0.12), ...squad("prism-armor", 30, ["tank", "heavy", "tank"])]
  },
  {
    id: 12,
    name: "Ridge Hunters",
    arenaSize: 120,
    targetScore: 7500,
    enemySpawns: [...squad("ridge-a", 24, ["scout", "scout", "heavy", "tank"]), enemy("ridge-turret-a", "turret", -36, 18, 0.6), enemy("ridge-turret-b", "turret", 36, 18, 0.9)]
  },
  {
    id: 13,
    name: "Split Horizon",
    arenaSize: 124,
    targetScore: 8200,
    enemySpawns: [...ring("split-tanks", 6, 44, "tank", 0.14), ...squad("split-rush", 20, ["scout", "scout", "scout", "heavy"])]
  },
  {
    id: 14,
    name: "Rail Nest",
    arenaSize: 126,
    targetScore: 8800,
    enemySpawns: [...ring("rail-turret", 7, 42, "turret", 0.12), ...squad("rail-guards", 28, ["tank", "heavy", "tank", "heavy"])]
  },
  {
    id: 15,
    name: "Carrier Prism",
    arenaSize: 130,
    targetScore: 10800,
    enemySpawns: [...squad("carrier-guard", 28, ["heavy", "tank", "scout", "tank", "heavy"]), ...ring("carrier-screen", 5, 48, "scout", 0.12)],
    boss: {
      name: "Prism Carrier",
      hp: 560,
      attackInterval: 0.9,
      score: 2800,
      weakPoints: bossWeakSet(38, 1.18, true)
    }
  },
  {
    id: 16,
    name: "Scatter Field",
    arenaSize: 132,
    targetScore: 9800,
    enemySpawns: [...ring("scatter-scout", 10, 50, "scout", 0.1), enemy("scatter-heavy-a", "heavy", -26, 32, 1.2), enemy("scatter-heavy-b", "heavy", 26, 32, 1.45)]
  },
  {
    id: 17,
    name: "Heavy Rain",
    arenaSize: 134,
    targetScore: 10400,
    enemySpawns: [...squad("rain-column", 30, ["heavy", "heavy", "tank", "heavy", "heavy"]), ...ring("rain-turrets", 4, 48, "turret", 0.18)]
  },
  {
    id: 18,
    name: "Turret Maze",
    arenaSize: 136,
    targetScore: 11000,
    enemySpawns: [...ring("maze-turrets", 8, 46, "turret", 0.08), ...ring("maze-scouts", 6, 56, "scout", 0.16)]
  },
  {
    id: 19,
    name: "Crown Approach",
    arenaSize: 138,
    targetScore: 11800,
    enemySpawns: [...squad("crown-a", 30, ["tank", "heavy", "tank", "heavy", "tank"]), ...ring("crown-screen", 7, 54, "scout", 0.11)]
  },
  {
    id: 20,
    name: "Rail Monarch",
    arenaSize: 142,
    targetScore: 13800,
    enemySpawns: [...squad("monarch-guard", 32, ["heavy", "tank", "tank", "heavy", "turret"]), ...ring("monarch-screen", 6, 55, "scout", 0.12)],
    boss: {
      name: "Rail Monarch",
      hp: 690,
      attackInterval: 0.82,
      score: 3500,
      weakPoints: bossWeakSet(58, 1.28, true)
    }
  },
  {
    id: 21,
    name: "Drone Net",
    arenaSize: 144,
    targetScore: 12800,
    enemySpawns: [...ring("net-scouts", 12, 58, "scout", 0.08), ...squad("net-anchors", 32, ["turret", "tank", "turret"])]
  },
  {
    id: 22,
    name: "Kingmaker Lane",
    arenaSize: 146,
    targetScore: 13600,
    enemySpawns: [...squad("kingmaker-a", 34, ["heavy", "tank", "heavy", "tank", "heavy"]), ...ring("kingmaker-screen", 6, 58, "turret", 0.1)]
  },
  {
    id: 23,
    name: "Eclipse Armor",
    arenaSize: 148,
    targetScore: 14200,
    enemySpawns: [...ring("eclipse-heavy", 6, 52, "heavy", 0.16), ...ring("eclipse-scout", 8, 62, "scout", 0.09)]
  },
  {
    id: 24,
    name: "Last Ring",
    arenaSize: 150,
    targetScore: 15200,
    enemySpawns: [...ring("last-turret", 8, 54, "turret", 0.08), ...squad("last-column", 34, ["heavy", "heavy", "tank", "tank", "heavy"])]
  },
  {
    id: 25,
    name: "Crown Array",
    arenaSize: 154,
    targetScore: 17500,
    enemySpawns: [...squad("array-guard", 36, ["heavy", "tank", "heavy", "turret", "tank"]), ...ring("array-screen", 8, 62, "scout", 0.09)],
    boss: {
      name: "Crown Array",
      hp: 860,
      attackInterval: 0.72,
      score: 4600,
      weakPoints: [
        ...bossWeakSet(82, 1.36, true),
        { id: "rear-array", label: "BACK", x: 0, y: 1.55, z: -3.1, hp: 150 }
      ]
    }
  }
];

validateLevelCatalog();

export function getLevel(levelNumber: number): LevelData {
  const base = levelCatalog[(levelNumber - 1) % levelCatalog.length];
  if (levelNumber <= levelCatalog.length) {
    return { ...base, objective: objectiveForLevel(levelNumber, base) };
  }
  const loop = Math.floor((levelNumber - 1) / levelCatalog.length);
  const seed = levelNumber * 29 + loop * 17;
  return {
    ...base,
    id: levelNumber,
    name: `${base.name} Remix`,
    arenaSize: base.arenaSize + Math.min(36, loop * 6),
    targetScore: Math.round(base.targetScore * (1 + loop * 0.22)),
    objective: objectiveForLevel(levelNumber, base, loop),
    enemySpawns: base.enemySpawns.map((spawn, index) => ({
      ...spawn,
      id: `${spawn.id}-r${levelNumber}`,
      x: spawn.x + (seededRandom(seed + index) - 0.5) * 9,
      z: spawn.z + (seededRandom(seed + index * 3) - 0.5) * 9,
      hp: spawn.hp === undefined ? undefined : Math.round(spawn.hp * (1 + loop * 0.18)),
      delay: (spawn.delay ?? 0) + index * Math.min(0.08, loop * 0.012)
    })),
    boss: base.boss
      ? {
          ...base.boss,
          hp: Math.round(base.boss.hp * (1 + loop * 0.24)),
          attackInterval: Math.max(0.72, base.boss.attackInterval - loop * 0.04),
          score: Math.round(base.boss.score * (1 + loop * 0.2)),
          weakPoints: base.boss.weakPoints.map((point) => ({ ...point, hp: Math.round(point.hp * (1 + loop * 0.18)) }))
        }
      : undefined
  };
}

function objectiveForLevel(levelNumber: number, level: LevelData, remixLoop = 0): LevelObjective {
  const bonus = 420 + levelNumber * 30 + remixLoop * 180;
  if (level.boss) {
    return {
      kind: "weakPoints",
      label: "Core Break",
      detail: `Destroy ${Math.min(3, level.boss.weakPoints.length)} boss weak points before the final hull kill.`,
      target: Math.min(3, level.boss.weakPoints.length),
      bonus: bonus + 520
    };
  }
  const pattern = levelNumber % 4;
  if (pattern === 1) {
    return {
      kind: "accuracy",
      label: "Clean Gunnery",
      detail: "Finish with at least 62% accuracy.",
      target: 0.62,
      bonus
    };
  }
  if (pattern === 2) {
    return {
      kind: "armor",
      label: "Armor Reserve",
      detail: "Clear while taking 24 or less armor damage.",
      target: 24,
      bonus
    };
  }
  if (pattern === 3) {
    return {
      kind: "streak",
      label: "Chain Fire",
      detail: "Reach a kill streak of 4.",
      target: 4,
      bonus
    };
  }
  return {
    kind: "time",
    label: "Fast Sweep",
    detail: "Beat the par-time bonus window.",
    target: 1,
    bonus
  };
}

function validateLevelCatalog(): void {
  const bossNames = new Set<string>();
  levelCatalog.forEach((level, index) => {
    if (level.id !== index + 1) {
      throw new Error(`Level id mismatch at ${index + 1}`);
    }
    if (level.enemySpawns.length === 0 && !level.boss) {
      throw new Error(`Level ${level.id} has no enemies`);
    }
    level.enemySpawns.forEach((spawn) => {
      const half = level.arenaSize / 2 - 2;
      if (Math.abs(spawn.x) > half || Math.abs(spawn.z) > half) {
        throw new Error(`Level ${level.id} spawn ${spawn.id} outside arena`);
      }
      const startDistance = Math.hypot(spawn.x - playerStart.x, spawn.z - playerStart.z);
      if (startDistance < 18) {
        throw new Error(`Level ${level.id} spawn ${spawn.id} starts too close to player`);
      }
    });
    if (level.boss && level.boss.weakPoints.length < 3) {
      throw new Error(`Boss level ${level.id} needs at least 3 weak points`);
    }
    if (level.boss) {
      bossNames.add(level.boss.name);
    }
    const budget = estimateScoreBudget(level);
    if (level.targetScore > budget * 1.5) {
      throw new Error(`Level ${level.id} target score ${level.targetScore} exceeds estimated budget ${budget}`);
    }
  });
  if (levelCatalog.length < 20) {
    throw new Error(`Expected at least 20 authored levels, got ${levelCatalog.length}`);
  }
  if (bossNames.size < 5) {
    throw new Error(`Expected at least 5 boss archetypes, got ${bossNames.size}`);
  }
}

function estimateScoreBudget(level: LevelData): number {
  const enemyBudget = level.enemySpawns.reduce((total, spawn) => total + scoreByKind[spawn.kind] + 130, 0);
  const bossBudget = level.boss ? level.boss.score + level.boss.hp * 1.15 + level.boss.weakPoints.reduce((total, point) => total + point.hp * 1.8 + 250, 0) : 0;
  const streakBudget = level.enemySpawns.length * 58;
  const completionBudget = 900 + level.id * 42;
  const objectiveBudget = objectiveForLevel(level.id, level).bonus;
  const timeBudget = 900 + level.enemySpawns.length * 180 + (level.boss ? 1200 : 0);
  return Math.round(enemyBudget + bossBudget + streakBudget + completionBudget + objectiveBudget + timeBudget);
}
