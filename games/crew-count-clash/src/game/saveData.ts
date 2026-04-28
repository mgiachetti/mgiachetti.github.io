import type { CosmeticItem, CosmeticSlot, RewardData, RunStats, SaveData, UpgradeKey } from "./types";

const storageKey = "crew-count-clash-save-v1";
const saveVersion = 4;

const castleThresholds = [0, 6, 16, 31, 52, 80, 116, 160, 212];
const castleStages = [
  "Landing Pad",
  "Gate Frame",
  "Outer Walls",
  "Twin Towers",
  "Banner Hall",
  "Coin Vault",
  "Sky Bridge",
  "Royal Keep",
  "Victory City"
];

export const upgradeCosts = [180, 480, 980, 1850, 3200];
const shardUnlockCost = 12;

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
  { key: "no-hat", label: "No Hat", slot: "hat", primary: 0xffffff, cost: 0 },
  { key: "crew-cap", label: "Crew Cap", slot: "hat", primary: 0x146ef5, secondary: 0x00f5d4, cost: 0 },
  { key: "crown-hat", label: "Crown Hat", slot: "hat", primary: 0xffca3a, secondary: 0xff9f1c, cost: 900 },
  { key: "antenna-hat", label: "Antenna Hat", slot: "hat", primary: 0x00f5d4, secondary: 0x146ef5, cost: 1050 },
  { key: "party-hat", label: "Party Hat", slot: "hat", primary: 0xef476f, secondary: 0xffd166, cost: 1250 },
  { key: "plain-trail", label: "Plain Trail", slot: "trail", primary: 0xffffff, cost: 0 },
  { key: "spark-trail", label: "Spark Trail", slot: "trail", primary: 0xffd166, cost: 620 },
  { key: "neon-trail", label: "Neon Trail", slot: "trail", primary: 0x00f5d4, cost: 960 },
  { key: "medal-trail", label: "Medal Trail", slot: "trail", primary: 0xff9f1c, cost: 1400 },
  { key: "midnight-body", label: "Midnight Suit", slot: "body", primary: 0x243b53, secondary: 0x7dd3fc, cost: 1450 },
  { key: "ruby-body", label: "Ruby Suit", slot: "body", primary: 0xe11d48, secondary: 0x7f1d1d, cost: 1650 },
  { key: "rocket-pack", label: "Rocket Pack", slot: "backpack", primary: 0x334155, secondary: 0xff7a1a, cost: 1500 },
  { key: "vault-pack", label: "Vault Pack", slot: "backpack", primary: 0xffc857, secondary: 0x7c3aed, cost: 1750 },
  { key: "knight-helmet", label: "Knight Helmet", slot: "hat", primary: 0xcbd5e1, secondary: 0x64748b, cost: 1500 },
  { key: "comet-trail", label: "Comet Trail", slot: "trail", primary: 0x38bdf8, secondary: 0xffffff, cost: 1600 },
  { key: "royal-trail", label: "Royal Trail", slot: "trail", primary: 0xa855f7, secondary: 0xffd166, cost: 1850 }
];

const defaultCosmetics = ["cyan-body", "blue-visor", "standard-pack", "no-hat", "crew-cap", "plain-trail"];
const catalogKeys = new Set(cosmeticCatalog.map((item) => item.key));
const cosmeticSlots: CosmeticSlot[] = ["body", "visor", "backpack", "hat", "trail"];

export function createDefaultSave(): SaveData {
  return {
    saveVersion,
    currentLevel: 1,
    coins: 0,
    gems: 0,
    shards: 0,
    stars: 0,
    medals: 0,
    tickets: 1,
    castleXP: 0,
    highScores: {},
    bestCounts: {},
    bestStairs: {},
    levelStars: {},
    ownedCosmetics: [...defaultCosmetics],
    equippedCosmetics: {
      body: "cyan-body",
      visor: "blue-visor",
      backpack: "standard-pack",
      hat: "crew-cap",
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
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return createDefaultSave();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const migrated = migrateSave(parsed);
    if (parsed.saveVersion !== saveVersion) {
      saveGame(migrated);
    }
    return migrated;
  } catch {
    return createDefaultSave();
  }
}

export function migrateSave(parsed: Partial<SaveData>): SaveData {
  const fallback = createDefaultSave();
  const ownedCosmetics = Array.from(
    new Set([...defaultCosmetics, ...((Array.isArray(parsed.ownedCosmetics) ? parsed.ownedCosmetics : []) as string[])].filter((key) => catalogKeys.has(key)))
  );
  const ownedSet = new Set(ownedCosmetics);
  const equippedCosmetics = { ...fallback.equippedCosmetics, ...(parsed.equippedCosmetics ?? {}) };
  cosmeticSlots.forEach((slot) => {
    const equipped = cosmeticCatalog.find((item) => item.slot === slot && item.key === equippedCosmetics[slot]);
    if (!equipped || !ownedSet.has(equipped.key)) {
      equippedCosmetics[slot] = fallback.equippedCosmetics[slot];
    }
  });

  const upgrades = { ...fallback.upgrades };
  (Object.keys(upgrades) as UpgradeKey[]).forEach((key) => {
    upgrades[key] = readInt(parsed.upgrades?.[key], fallback.upgrades[key], 0, upgradeCosts.length);
  });

  return {
    ...fallback,
    saveVersion,
    currentLevel: readInt(parsed.currentLevel, fallback.currentLevel, 1, 999),
    coins: readInt(parsed.coins, fallback.coins),
    gems: readInt(parsed.gems, fallback.gems),
    shards: readInt(parsed.shards, fallback.shards),
    stars: readInt(parsed.stars, fallback.stars),
    medals: readInt(parsed.medals, fallback.medals),
    tickets: readInt(parsed.tickets, fallback.tickets),
    castleXP: readInt(parsed.castleXP, fallback.castleXP),
    highScores: cleanNumberRecord(parsed.highScores),
    bestCounts: cleanNumberRecord(parsed.bestCounts),
    bestStairs: cleanNumberRecord(parsed.bestStairs),
    levelStars: cleanNumberRecord(parsed.levelStars),
    ownedCosmetics,
    equippedCosmetics,
    upgrades,
    muted: typeof parsed.muted === "boolean" ? parsed.muted : fallback.muted
  };
}

function readInt(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function cleanNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, recordValue]) => [key, readInt(recordValue, 0)] as const)
      .filter(([, recordValue]) => recordValue > 0)
  );
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

export function getCastleProgress(save: SaveData): {
  tier: number;
  maxTier: number;
  xp: number;
  currentXP: number;
  nextXP: number;
  neededXP: number;
  percent: number;
  stage: string;
  nextStage: string;
  milestones: Array<{ tier: number; label: string; xp: number; unlocked: boolean }>;
} {
  const xp = Math.max(0, Math.floor(save.castleXP));
  let tier = 0;
  for (let index = 0; index < castleThresholds.length; index += 1) {
    if (xp >= castleThresholds[index]) {
      tier = index;
    }
  }
  const maxTier = castleThresholds.length - 1;
  const currentXP = castleThresholds[tier];
  const nextXP = castleThresholds[Math.min(maxTier, tier + 1)];
  const span = Math.max(1, nextXP - currentXP);
  return {
    tier,
    maxTier,
    xp,
    currentXP,
    nextXP,
    neededXP: Math.max(0, nextXP - xp),
    percent: tier >= maxTier ? 1 : Math.min(1, (xp - currentXP) / span),
    stage: castleStages[tier] ?? castleStages[0],
    nextStage: castleStages[Math.min(maxTier, tier + 1)] ?? castleStages[maxTier],
    milestones: castleStages.map((label, index) => ({
      tier: index,
      label,
      xp: castleThresholds[index],
      unlocked: xp >= castleThresholds[index]
    }))
  };
}

function unlockCosmeticWithShards(save: SaveData): string | null {
  if (save.shards < shardUnlockCost) {
    return null;
  }
  const item = cosmeticCatalog.find((candidate) => candidate.cost > 0 && !save.ownedCosmetics.includes(candidate.key));
  if (!item) {
    return null;
  }
  save.shards -= shardUnlockCost;
  save.ownedCosmetics.push(item.key);
  save.equippedCosmetics[item.slot] = item.key;
  return item.label;
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
  const earnedGems = Math.max(0, stats.gems);
  const earnedMedals = Math.max(0, stats.medals);
  const earnedShards = Math.max(0, stats.shards + (stats.bossDefeated ? 3 : 0) + (stars >= 3 ? 1 : 0));
  save.coins += earnedCoins;
  save.gems += earnedGems;
  save.medals += earnedMedals;
  save.shards += earnedShards;
  const shardUnlock = unlockCosmeticWithShards(save);

  if (stats.bossDefeated) {
    save.tickets += 1;
  }
  const oldCastleTier = getCastleProgress(save).tier;
  const castleXP =
    Math.max(1, stars) +
    Math.floor(Math.max(0, stats.finalStair) / 4) +
    (stats.bossDefeated ? 7 + earnedMedals : 0) +
    (stats.rouletteLabel ? 2 : 0);
  save.castleXP += castleXP;
  const castleProgress = getCastleProgress(save);

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
    shards: earnedShards,
    medals: earnedMedals,
    stars,
    castleXP,
    castleLeveledUp: castleProgress.tier > oldCastleTier,
    castleStage: castleProgress.stage,
    extra: [
      stats.rouletteLabel || (stats.bossDefeated ? `Boss medals +${earnedMedals}. Ticket +1.` : `Reached stair ${stats.finalStair}.`),
      earnedShards > 0 ? `Shards +${earnedShards}` : "",
      shardUnlock ? `Shard unlock: ${shardUnlock}` : ""
    ].filter(Boolean).join(" ")
  };
}
