import type { CosmeticItem, CosmeticSlot, RewardData, RunStats, SaveData, UpgradeKey } from "./types";

const storageKey = "crew-count-clash-save-v1";

export const upgradeCosts = [220, 620, 1350, 2600, 4600];

export const cosmeticCatalog: CosmeticItem[] = [
  { key: "cyan-body", label: "Cyan Suit", slot: "body", primary: 0x36c9f6, secondary: 0x1686b4, cost: 0 },
  { key: "lime-body", label: "Lime Suit", slot: "body", primary: 0x92e342, secondary: 0x4f9c29, cost: 450 },
  { key: "coral-body", label: "Coral Suit", slot: "body", primary: 0xff6b6b, secondary: 0xb33a43, cost: 650 },
  { key: "violet-body", label: "Violet Suit", slot: "body", primary: 0x9b5de5, secondary: 0x5e3ea1, cost: 900 },
  { key: "gold-body", label: "Gold Suit", slot: "body", primary: 0xffc857, secondary: 0xc27a1e, cost: 1200 },
  { key: "blue-visor", label: "Blue Visor", slot: "visor", primary: 0xbdefff, secondary: 0x4ba3c7, cost: 0 },
  { key: "ruby-visor", label: "Ruby Visor", slot: "visor", primary: 0xff5a8a, secondary: 0xa92754, cost: 520 },
  { key: "amber-visor", label: "Amber Visor", slot: "visor", primary: 0xffd166, secondary: 0xd18a19, cost: 760 },
  { key: "standard-pack", label: "Standard Pack", slot: "backpack", primary: 0x2087ad, secondary: 0x155b78, cost: 0 },
  { key: "jet-pack", label: "Jet Pack", slot: "backpack", primary: 0x4f5d75, secondary: 0xef8354, cost: 780 },
  { key: "star-pack", label: "Star Pack", slot: "backpack", primary: 0x363f72, secondary: 0xffd166, cost: 1150 },
  { key: "plain-trail", label: "Plain Trail", slot: "trail", primary: 0xffffff, cost: 0 },
  { key: "spark-trail", label: "Spark Trail", slot: "trail", primary: 0xffd166, cost: 620 },
  { key: "neon-trail", label: "Neon Trail", slot: "trail", primary: 0x00f5d4, cost: 960 },
  { key: "medal-trail", label: "Medal Trail", slot: "trail", primary: 0xff9f1c, cost: 1400 }
];

const defaultCosmetics = ["cyan-body", "blue-visor", "standard-pack", "plain-trail"];

export function createDefaultSave(): SaveData {
  return {
    currentLevel: 1,
    coins: 0,
    gems: 0,
    stars: 0,
    medals: 0,
    tickets: 1,
    highScores: {},
    bestCounts: {},
    bestStairs: {},
    levelStars: {},
    ownedCosmetics: [...defaultCosmetics],
    equippedCosmetics: {
      body: "cyan-body",
      visor: "blue-visor",
      backpack: "standard-pack",
      trail: "plain-trail"
    },
    upgrades: {
      startCrew: 0,
      gateBonus: 0,
      formation: 0,
      shield: 0,
      coinValue: 0,
      bossDamage: 0,
      magnet: 0,
      rouletteLuck: 0
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
    return {
      ...fallback,
      ...parsed,
      highScores: parsed.highScores ?? fallback.highScores,
      bestCounts: parsed.bestCounts ?? fallback.bestCounts,
      bestStairs: parsed.bestStairs ?? fallback.bestStairs,
      levelStars: parsed.levelStars ?? fallback.levelStars,
      ownedCosmetics,
      equippedCosmetics: { ...fallback.equippedCosmetics, ...(parsed.equippedCosmetics ?? {}) },
      upgrades: { ...fallback.upgrades, ...(parsed.upgrades ?? {}) }
    };
  } catch {
    return fallback;
  }
}

export function saveGame(data: SaveData): void {
  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

export function resetSave(): SaveData {
  const save = createDefaultSave();
  saveGame(save);
  return save;
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

export function buyOrEquipCosmetic(save: SaveData, key: string): "bought" | "equipped" | "blocked" {
  const item = cosmeticCatalog.find((candidate) => candidate.key === key);
  if (!item) {
    return "blocked";
  }
  if (!save.ownedCosmetics.includes(key)) {
    if (save.coins < item.cost) {
      return "blocked";
    }
    save.coins -= item.cost;
    save.ownedCosmetics.push(key);
    save.equippedCosmetics[item.slot] = key;
    saveGame(save);
    return "bought";
  }
  save.equippedCosmetics[item.slot] = key;
  saveGame(save);
  return "equipped";
}

export function getEquippedCosmetic(save: SaveData, slot: CosmeticSlot): CosmeticItem {
  const key = save.equippedCosmetics[slot];
  return (
    cosmeticCatalog.find((item) => item.slot === slot && item.key === key) ??
    cosmeticCatalog.find((item) => item.slot === slot) ??
    cosmeticCatalog[0]
  );
}

export function grantRunRewards(save: SaveData, levelId: number, stats: RunStats, targetScore: number, targetStair: number): RewardData {
  const levelKey = String(levelId);
  const previousStars = save.levelStars[levelKey] ?? 0;
  const stars =
    1 +
    (stats.score >= targetScore ? 1 : 0) +
    (stats.noHit && stats.finalStair >= targetStair ? 1 : 0);
  const starDelta = Math.max(0, stars - previousStars);
  save.levelStars[levelKey] = Math.max(previousStars, stars);
  save.stars += starDelta;

  const coinUpgrade = save.upgrades.coinValue;
  const earnedCoins = Math.max(0, stats.coins + Math.floor(stats.score / 130) + stats.finalStair * (4 + coinUpgrade));
  const earnedGems = Math.max(0, stats.gems + (stats.bossDefeated ? 4 : 0));
  save.coins += earnedCoins;
  save.gems += earnedGems;

  if (stats.bossDefeated) {
    save.medals += 1;
    save.tickets += 1;
  }

  save.highScores[levelKey] = Math.max(save.highScores[levelKey] ?? 0, stats.score);
  save.bestCounts[levelKey] = Math.max(save.bestCounts[levelKey] ?? 0, stats.maxCount);
  save.bestStairs[levelKey] = Math.max(save.bestStairs[levelKey] ?? 0, stats.finalStair);
  save.currentLevel = Math.max(save.currentLevel, levelId + 1);
  saveGame(save);

  return {
    title: stats.bossDefeated ? "Boss Defeated" : stats.rouletteLabel ? "Roulette Paid" : "Level Clear",
    kind: stats.bossDefeated ? "Boss Clear" : stats.rouletteLabel ? "Bonus Clear" : "Run Complete",
    score: stats.score,
    coins: earnedCoins,
    gems: earnedGems,
    stars,
    extra: stats.rouletteLabel || (stats.bossDefeated ? "Boss medal earned. Roulette ticket added." : `Reached stair ${stats.finalStair}.`)
  };
}
