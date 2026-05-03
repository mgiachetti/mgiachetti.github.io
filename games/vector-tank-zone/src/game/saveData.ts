import type { RunStats, SaveData } from "./types";

const storageKey = "vector-tank-zone-save-v1";
const saveVersion = 1;

export function createDefaultSave(): SaveData {
  return {
    saveVersion,
    currentLevel: 1,
    highScore: 0,
    medals: 0,
    muted: false,
    bestScores: {}
  };
}

export function loadSave(): SaveData {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return createDefaultSave();
  }
  try {
    return migrateSave(JSON.parse(raw) as Partial<SaveData>);
  } catch {
    return createDefaultSave();
  }
}

export function saveGame(save: SaveData): void {
  window.localStorage.setItem(storageKey, JSON.stringify(save));
}

export function resetSave(): SaveData {
  const save = createDefaultSave();
  saveGame(save);
  return save;
}

export function grantLevelRewards(save: SaveData, levelId: number, stats: RunStats, targetScore: number): { medals: number; best: boolean } {
  const key = String(levelId);
  const previousBest = save.bestScores[key] ?? 0;
  const score = Math.round(stats.score);
  const medals =
    1 +
    (score >= targetScore ? 1 : 0) +
    (stats.hits > 0 && stats.hits / Math.max(1, stats.shots) >= 0.62 ? 1 : 0) +
    (stats.damageTaken <= 0 ? 1 : 0) +
    (stats.objectiveBonus > 0 ? 1 : 0);
  save.bestScores[key] = Math.max(previousBest, score);
  save.highScore = Math.max(save.highScore, score);
  save.medals += medals;
  save.currentLevel = Math.max(save.currentLevel, levelId + 1);
  saveGame(save);
  return { medals, best: score > previousBest };
}

function migrateSave(parsed: Partial<SaveData>): SaveData {
  const fallback = createDefaultSave();
  const bestScores = parsed.bestScores && typeof parsed.bestScores === "object" ? cleanNumberRecord(parsed.bestScores) : {};
  return {
    ...fallback,
    saveVersion,
    currentLevel: readInt(parsed.currentLevel, fallback.currentLevel, 1, 999),
    highScore: readInt(parsed.highScore, fallback.highScore),
    medals: readInt(parsed.medals, fallback.medals),
    muted: typeof parsed.muted === "boolean" ? parsed.muted : fallback.muted,
    bestScores
  };
}

function readInt(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function cleanNumberRecord(value: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, recordValue]) => [key, readInt(recordValue, 0)] as const)
      .filter(([, recordValue]) => recordValue > 0)
  );
}
