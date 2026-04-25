export type GameMode = "title" | "run" | "finish" | "reward" | "fail" | "shop" | "pause";

export type CollectableKind =
  | "pancake"
  | "goldenPancake"
  | "strawberry"
  | "banana"
  | "blueberry"
  | "chocolate"
  | "butter"
  | "syrup"
  | "magnet";

export type HazardKind =
  | "lowPipe"
  | "blade"
  | "rollingPin"
  | "jam"
  | "glutton"
  | "slammer"
  | "hole"
  | "colorGate"
  | "heightGate"
  | "tongue";

export type EntityKind = CollectableKind | HazardKind;

export type TrackSegment = {
  z: number;
  length: number;
  width: number;
  openEdges?: boolean;
};

export type LevelEntity = {
  id: string;
  kind: EntityKind;
  x: number;
  z: number;
  lane?: number;
  width?: number;
  depth?: number;
  amount?: number;
  color?: "red" | "blue" | "yellow";
  requiredColor?: "red" | "blue" | "yellow";
  safeHeight?: number;
  minStack?: number;
  speed?: number;
  range?: number;
  phase?: number;
};

export type LevelKind = "normal" | "challenge" | "boss" | "bonus";

export type FinishConfig = {
  kind: "customers" | "mouth" | "boss";
  targetFeed: number;
  multiplierPads: number[];
  bossHp?: number;
};

export type LevelData = {
  id: number;
  kind: LevelKind;
  length: number;
  targetScore: number;
  trackWidth: number;
  track: TrackSegment[];
  entities: LevelEntity[];
  finish: FinishConfig;
};

export type UpgradeKey = "startStack" | "magnet" | "stability" | "coinValue";

export type CosmeticSlot = "plate" | "stack" | "trail";

export type CosmeticItem = {
  key: string;
  label: string;
  slot: CosmeticSlot;
  primary: number;
  secondary?: number;
};

export type SaveData = {
  currentLevel: number;
  coins: number;
  stars: number;
  unlockXP: number;
  bossMedals: number;
  highScores: Record<string, number>;
  bestStacks: Record<string, number>;
  levelStars: Record<string, number>;
  ownedCosmetics: string[];
  equippedCosmetics: Record<CosmeticSlot, string>;
  upgrades: Record<UpgradeKey, number>;
  muted: boolean;
};

export type RunStats = {
  score: number;
  coinsEarned: number;
  starsEarned: number;
  stackMax: number;
  combo: number;
  perfect: boolean;
  bossDefeated: boolean;
  pancakesFed: number;
  chestReward: string;
};
