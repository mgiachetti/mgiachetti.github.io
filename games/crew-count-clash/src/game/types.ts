export type GameMode = "title" | "run" | "stairs" | "boss" | "bossVictory" | "roulette" | "reward" | "fail" | "shop" | "pause";

export type LevelKind = "normal" | "challenge" | "bonus" | "boss";

export type GateOp = "add" | "subtract" | "multiply" | "divide" | "percent";

export type EntityKind =
  | "gate"
  | "colorGate"
  | "colorPad"
  | "crew"
  | "crewCapsule"
  | "coin"
  | "gem"
  | "shield"
  | "magnet"
  | "frenzy"
  | "ticket"
  | "bossBomb"
  | "enemy"
  | "sideScraper"
  | "bumper"
  | "rotatingBar"
  | "sawLane"
  | "crusher"
  | "swingingAxe"
  | "spikeRoller"
  | "cannon"
  | "laser"
  | "goo"
  | "conveyor"
  | "hole"
  | "fan";

export type TrackKind = "solid" | "moving" | "turntable" | "collapsing" | "conveyor";

export type TrackSegment = {
  id: string;
  zStart: number;
  zEnd: number;
  width: number;
  x?: number;
  kind?: TrackKind;
  amplitude?: number;
  speed?: number;
  phase?: number;
  direction?: -1 | 1;
};

export type LevelEntity = {
  id: string;
  kind: EntityKind;
  x: number;
  z: number;
  width?: number;
  depth?: number;
  value?: number;
  op?: GateOp;
  altValue?: number;
  altOp?: GateOp;
  interval?: number;
  label?: string;
  count?: number;
  strength?: number;
  range?: number;
  speed?: number;
  phase?: number;
  lane?: number;
  color?: "cyan" | "lime" | "coral" | "violet";
};

export type BossConfig = {
  name: string;
  hp: number;
  attackInterval: number;
  gemReward: number;
  medalReward: number;
  bodyColor?: number;
  arenaColor?: number;
  attackKind?: "stomp" | "sweep" | "minions";
};

export type LevelData = {
  id: number;
  kind: LevelKind;
  name: string;
  length: number;
  targetScore: number;
  targetStair: number;
  startCount: number;
  track: TrackSegment[];
  entities: LevelEntity[];
  boss?: BossConfig;
};

export type UpgradeKey =
  | "startCrew"
  | "gateBonus"
  | "formation"
  | "shield"
  | "coinValue"
  | "bossDamage"
  | "magnet"
  | "rouletteLuck";

export type CosmeticSlot = "body" | "visor" | "backpack" | "trail";

export type CosmeticItem = {
  key: string;
  label: string;
  slot: CosmeticSlot;
  primary: number;
  secondary?: number;
  cost: number;
};

export type SaveData = {
  currentLevel: number;
  coins: number;
  gems: number;
  stars: number;
  medals: number;
  tickets: number;
  highScores: Record<string, number>;
  bestCounts: Record<string, number>;
  bestStairs: Record<string, number>;
  levelStars: Record<string, number>;
  ownedCosmetics: string[];
  equippedCosmetics: Record<CosmeticSlot, string>;
  upgrades: Record<UpgradeKey, number>;
  muted: boolean;
};

export type RunStats = {
  score: number;
  coins: number;
  gems: number;
  maxCount: number;
  losses: number;
  gates: number;
  enemiesDefeated: number;
  combo: number;
  finalStair: number;
  bossDefeated: boolean;
  rouletteLabel: string;
  noHit: boolean;
};

export type RewardData = {
  title: string;
  kind: string;
  score: number;
  coins: number;
  gems: number;
  stars: number;
  extra: string;
};
