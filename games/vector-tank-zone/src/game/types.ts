import type * as THREE from "three";

export type GameMode = "title" | "briefing" | "playing" | "levelClearing" | "paused" | "levelClear" | "gameOver";

export type EnemyKind = "scout" | "tank" | "heavy" | "turret" | "boss";

export type ProjectileOwner = "player" | "enemy";

export type ObjectiveKind = "accuracy" | "armor" | "streak" | "weakPoints" | "time";

export type LevelObjective = {
  kind: ObjectiveKind;
  label: string;
  detail: string;
  target: number;
  bonus: number;
};

export type EnemySpawn = {
  id: string;
  kind: EnemyKind;
  x: number;
  z: number;
  hp?: number;
  delay?: number;
  patrolRadius?: number;
};

export type WeakPointConfig = {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  hp: number;
};

export type BossConfig = {
  name: string;
  hp: number;
  attackInterval: number;
  score: number;
  weakPoints: WeakPointConfig[];
};

export type LevelData = {
  id: number;
  name: string;
  arenaSize: number;
  targetScore: number;
  objective?: LevelObjective;
  enemySpawns: EnemySpawn[];
  boss?: BossConfig;
};

export type RuntimeWeakPoint = WeakPointConfig & {
  hp: number;
  maxHp: number;
  mesh: THREE.Object3D;
  destroyed: boolean;
};

export type RuntimeEnemy = {
  id: string;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  yaw: number;
  reload: number;
  spawnDelay: number;
  radius: number;
  speed: number;
  attackInterval: number;
  scoreValue: number;
  alive: boolean;
  weakPoints: RuntimeWeakPoint[];
  spawnTelegraph?: THREE.Object3D;
  strafeSeed: number;
  attackIndex: number;
};

export type Projectile = {
  id: number;
  owner: ProjectileOwner;
  mesh: THREE.Object3D;
  trail: THREE.Object3D;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  radius: number;
  life: number;
};

export type ObstacleCollider = {
  id: string;
  position: THREE.Vector3;
  radius: number;
};

export type RunStats = {
  score: number;
  kills: number;
  shots: number;
  hits: number;
  streak: number;
  maxStreak: number;
  weakPoints: number;
  damageTaken: number;
  timeBonus: number;
  noDamageBonus: number;
  streakBonus: number;
  objectiveBonus: number;
  medals: number;
  levelStartedAt: number;
};

export type SaveData = {
  saveVersion: number;
  currentLevel: number;
  highScore: number;
  medals: number;
  muted: boolean;
  bestScores: Record<string, number>;
};

export type RadarBlip = {
  x: number;
  z: number;
  boss: boolean;
};
