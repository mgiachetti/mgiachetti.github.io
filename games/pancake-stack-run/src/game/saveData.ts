import type { CosmeticItem, CosmeticSlot, SaveData, UpgradeKey } from "./types";

const storageKey = "pancake-stack-run-save-v1";

export const upgradeCosts = [300, 800, 1600];

export const cosmeticCatalog: CosmeticItem[] = [
  { key: "Classic Plate", label: "Classic Plate", slot: "plate", primary: 0xffffff, secondary: 0x59b8de },
  { key: "Ceramic Blue Plate", label: "Ceramic Blue", slot: "plate", primary: 0xeaf8ff, secondary: 0x38a3d1 },
  { key: "Golden Griddle", label: "Golden Griddle", slot: "plate", primary: 0xffd166, secondary: 0xc28f2c },
  { key: "Chef Hat Plate", label: "Chef Hat", slot: "plate", primary: 0xffffff, secondary: 0xef476f },
  { key: "Classic Stack", label: "Classic Stack", slot: "stack", primary: 0xf1b96f, secondary: 0xd18a40 },
  { key: "Chocolate Stack", label: "Chocolate Stack", slot: "stack", primary: 0x8b5a3c, secondary: 0x55321f },
  { key: "Red Velvet Stack", label: "Red Velvet", slot: "stack", primary: 0xb83a4b, secondary: 0x7a2430 },
  { key: "Plain Trail", label: "Plain Trail", slot: "trail", primary: 0xffffff },
  { key: "Berry Trail", label: "Berry Trail", slot: "trail", primary: 0xef476f },
  { key: "Maple Sparkle", label: "Maple Sparkle", slot: "trail", primary: 0xffb703 },
  { key: "Star Syrup Trail", label: "Star Syrup", slot: "trail", primary: 0xffd166 }
];

const defaultCosmetics = ["Classic Plate", "Classic Stack", "Plain Trail"];

export function createDefaultSave(): SaveData {
  return {
    currentLevel: 1,
    coins: 0,
    stars: 0,
    unlockXP: 0,
    bossMedals: 0,
    highScores: {},
    bestStacks: {},
    levelStars: {},
    ownedCosmetics: [...defaultCosmetics],
    equippedCosmetics: {
      plate: "Classic Plate",
      stack: "Classic Stack",
      trail: "Plain Trail"
    },
    upgrades: {
      startStack: 0,
      magnet: 0,
      stability: 0,
      coinValue: 0
    },
    muted: false
  };
}

export function loadSave(): SaveData {
  const fallback = createDefaultSave();
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const ownedCosmetics = Array.from(new Set([...defaultCosmetics, ...(parsed.ownedCosmetics ?? [])]));
    const equippedCosmetics = {
      ...fallback.equippedCosmetics,
      ...(parsed.equippedCosmetics ?? {})
    };
    return {
      ...fallback,
      ...parsed,
      highScores: parsed.highScores ?? fallback.highScores,
      bestStacks: parsed.bestStacks ?? fallback.bestStacks,
      levelStars: parsed.levelStars ?? fallback.levelStars,
      ownedCosmetics,
      equippedCosmetics,
      upgrades: { ...fallback.upgrades, ...(parsed.upgrades ?? {}) }
    };
  } catch {
    return fallback;
  }
}

export function equipCosmetic(save: SaveData, key: string): boolean {
  const item = cosmeticCatalog.find((candidate) => candidate.key === key);
  if (!item || !save.ownedCosmetics.includes(key)) {
    return false;
  }
  save.equippedCosmetics[item.slot] = key;
  saveGame(save);
  return true;
}

export function getEquippedCosmetic(save: SaveData, slot: CosmeticSlot): CosmeticItem {
  const key = save.equippedCosmetics[slot];
  return (
    cosmeticCatalog.find((item) => item.slot === slot && item.key === key) ??
    cosmeticCatalog.find((item) => item.slot === slot) ??
    cosmeticCatalog[0]
  );
}

export function saveGame(data: SaveData): void {
  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

export function resetSave(): SaveData {
  const next = createDefaultSave();
  saveGame(next);
  return next;
}

export function buyUpgrade(save: SaveData, key: UpgradeKey): boolean {
  const tier = save.upgrades[key];
  const cost = upgradeCosts[tier];
  if (cost === undefined || save.coins < cost) {
    return false;
  }
  save.coins -= cost;
  save.upgrades[key] = tier + 1;
  saveGame(save);
  return true;
}

export type ChestReward = {
  label: string;
  coins: number;
  cosmetic?: string;
  duplicate: boolean;
};

const cosmeticRewards = cosmeticCatalog.filter((item) => !defaultCosmetics.includes(item.key)).map((item) => item.key);

export function grantLevelRewards(save: SaveData, levelId: number, starsEarned: number, score: number, bossDefeated: boolean): ChestReward {
  const key = String(levelId);
  const previousStars = save.levelStars[key] ?? 0;
  const starDelta = Math.max(0, starsEarned - previousStars);
  save.levelStars[key] = Math.max(previousStars, starsEarned);
  save.stars += starDelta;
  save.unlockXP += 20 + starDelta * 15 + (bossDefeated ? 60 : 0);

  if (bossDefeated) {
    save.bossMedals += 1;
  }

  const roll = Math.abs(Math.sin(levelId * 12.9898 + score * 0.002) * 43758.5453) % 1;
  const coinBase = bossDefeated ? 120 : 45;

  if (bossDefeated || roll > 0.72) {
    const cosmetic = cosmeticRewards[(levelId + Math.floor(score)) % cosmeticRewards.length];
    const duplicate = save.ownedCosmetics.includes(cosmetic);
    if (duplicate) {
      const coins = coinBase + 80;
      save.coins += coins;
      return { label: `Duplicate ${cosmetic} converted`, coins, cosmetic, duplicate };
    }

    save.ownedCosmetics.push(cosmetic);
    return { label: `Unlocked ${cosmetic}`, coins: 0, cosmetic, duplicate: false };
  }

  const coins = coinBase + Math.floor(roll * 90);
  save.coins += coins;
  return { label: `Chest coins +${coins}`, coins, duplicate: false };
}
