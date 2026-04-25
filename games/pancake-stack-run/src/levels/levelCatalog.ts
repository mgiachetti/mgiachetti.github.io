import type { LevelData, LevelEntity } from "../game/types";

const lanes = [-2.1, 0, 2.1];

function foodLine(prefix: string, zStart: number, lane: number, count: number, spacing = 3.1): LevelEntity[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-pancake-${index}`,
    kind: index % 5 === 4 ? "goldenPancake" : "pancake",
    x: lanes[lane],
    z: zStart - index * spacing
  }));
}

function toppings(prefix: string, zStart: number): LevelEntity[] {
  return [
    { id: `${prefix}-strawberry`, kind: "strawberry", x: lanes[0], z: zStart },
    { id: `${prefix}-banana`, kind: "banana", x: lanes[1], z: zStart - 4 },
    { id: `${prefix}-blueberry`, kind: "blueberry", x: lanes[2], z: zStart - 8 },
    { id: `${prefix}-chocolate`, kind: "chocolate", x: lanes[1], z: zStart - 12 }
  ];
}

function baseTrack(length: number, width = 6.6) {
  return [{ z: -length / 2, length, width }];
}

export const levelCatalog: LevelData[] = [
  {
    id: 1,
    kind: "normal",
    length: 132,
    targetScore: 1450,
    trackWidth: 6.6,
    track: baseTrack(132),
    entities: [
      ...foodLine("l1-a", -10, 1, 9),
      ...toppings("l1-t", -20),
      { id: "l1-pipe-1", kind: "lowPipe", x: 0, z: -48, width: 5.6, safeHeight: 9 },
      ...foodLine("l1-b", -56, 0, 6),
      ...foodLine("l1-c", -58, 2, 6),
      { id: "l1-jam", kind: "jam", x: -1.8, z: -78, width: 2.1, depth: 2 },
      { id: "l1-butter", kind: "butter", x: 2.1, z: -82 },
      { id: "l1-blade", kind: "blade", x: 0, z: -97, width: 2.2, depth: 1.2 },
      ...foodLine("l1-d", -104, 1, 7),
      { id: "l1-syrup", kind: "syrup", x: 0, z: -123 }
    ],
    finish: { kind: "mouth", targetFeed: 12, multiplierPads: [1, 2, 3] }
  },
  {
    id: 2,
    kind: "normal",
    length: 152,
    targetScore: 2100,
    trackWidth: 6.6,
    track: baseTrack(152),
    entities: [
      ...foodLine("l2-a", -8, 0, 6),
      ...foodLine("l2-b", -10, 2, 6),
      { id: "l2-roll", kind: "rollingPin", x: 0, z: -42, width: 2.4, range: 2.5, speed: 2.4 },
      ...toppings("l2-t", -53),
      { id: "l2-gate-button", kind: "colorGate", x: -2.1, z: -78, width: 1.7, requiredColor: "red" },
      ...foodLine("l2-c", -84, 1, 8),
      { id: "l2-glutton", kind: "glutton", x: 2.1, z: -112, width: 2, depth: 2.5 },
      { id: "l2-magnet", kind: "magnet", x: -2.1, z: -120 },
      ...foodLine("l2-d", -124, 0, 7)
    ],
    finish: { kind: "customers", targetFeed: 15, multiplierPads: [1, 2, 3, 5] }
  },
  {
    id: 3,
    kind: "challenge",
    length: 168,
    targetScore: 2600,
    trackWidth: 6.2,
    track: baseTrack(168, 6.2),
    entities: [
      ...foodLine("l3-a", -10, 1, 8),
      { id: "l3-hole-1", kind: "hole", x: -2.1, z: -42, width: 2.1, depth: 3 },
      { id: "l3-pipe-1", kind: "lowPipe", x: 0, z: -55, width: 5.4, safeHeight: 7 },
      ...toppings("l3-t", -64),
      { id: "l3-slam", kind: "slammer", x: 0, z: -88, width: 2.3, speed: 2.8 },
      ...foodLine("l3-b", -96, 0, 6),
      ...foodLine("l3-c", -98, 2, 6),
      { id: "l3-height", kind: "heightGate", x: 0, z: -126, width: 5.8, minStack: 12 },
      ...foodLine("l3-d", -132, 1, 8),
      { id: "l3-syrup", kind: "syrup", x: 0, z: -158 }
    ],
    finish: { kind: "mouth", targetFeed: 18, multiplierPads: [1, 2, 3, 5] }
  },
  {
    id: 4,
    kind: "bonus",
    length: 126,
    targetScore: 2400,
    trackWidth: 7,
    track: baseTrack(126, 7),
    entities: [
      ...foodLine("l4-a", -8, 0, 8, 2.4),
      ...foodLine("l4-b", -9, 1, 9, 2.4),
      ...foodLine("l4-c", -10, 2, 8, 2.4),
      ...toppings("l4-t1", -36),
      ...toppings("l4-t2", -62),
      { id: "l4-magnet", kind: "magnet", x: 0, z: -78 },
      { id: "l4-butter", kind: "butter", x: -2.1, z: -88 },
      { id: "l4-syrup", kind: "syrup", x: 2.1, z: -96 },
      ...foodLine("l4-d", -102, 1, 8, 2.2)
    ],
    finish: { kind: "customers", targetFeed: 20, multiplierPads: [2, 3, 5] }
  },
  {
    id: 5,
    kind: "boss",
    length: 188,
    targetScore: 3600,
    trackWidth: 6.8,
    track: baseTrack(188, 6.8),
    entities: [
      ...foodLine("l5-a", -9, 1, 10),
      { id: "l5-roll-1", kind: "rollingPin", x: 0, z: -45, width: 2.4, range: 2.8, speed: 2.2 },
      ...toppings("l5-t1", -58),
      { id: "l5-blade-1", kind: "blade", x: -1.5, z: -82, width: 2.2, depth: 1.2 },
      { id: "l5-blade-2", kind: "blade", x: 1.7, z: -96, width: 2.2, depth: 1.2 },
      ...foodLine("l5-b", -104, 0, 7),
      ...foodLine("l5-c", -106, 2, 7),
      { id: "l5-glutton", kind: "glutton", x: 0, z: -132, width: 2.3, depth: 2.8 },
      { id: "l5-butter", kind: "butter", x: -2.1, z: -143 },
      { id: "l5-syrup", kind: "syrup", x: 2.1, z: -151 },
      { id: "l5-tongue", kind: "tongue", x: 0, z: -168, width: 2.8, range: 2.6, speed: 3 },
      ...foodLine("l5-d", -172, 1, 4)
    ],
    finish: { kind: "boss", targetFeed: 22, multiplierPads: [2, 3, 5], bossHp: 24 }
  },
  {
    id: 6,
    kind: "normal",
    length: 166,
    targetScore: 3000,
    trackWidth: 6.6,
    track: baseTrack(166),
    entities: [
      ...foodLine("l6-a", -9, 0, 6),
      ...foodLine("l6-b", -10, 2, 6),
      { id: "l6-color-red", kind: "colorGate", x: -2.1, z: -42, requiredColor: "red", width: 1.7 },
      { id: "l6-color-yellow", kind: "colorGate", x: 2.1, z: -58, requiredColor: "yellow", width: 1.7 },
      ...toppings("l6-t1", -68),
      { id: "l6-hole-mid", kind: "hole", x: 0, z: -88, width: 2.1, depth: 3.2 },
      ...foodLine("l6-c", -98, 0, 7),
      ...foodLine("l6-d", -100, 2, 7),
      { id: "l6-pipe", kind: "lowPipe", x: 0, z: -126, width: 5.8, safeHeight: 11 },
      { id: "l6-butter", kind: "butter", x: 0, z: -136 },
      ...foodLine("l6-e", -142, 1, 7)
    ],
    finish: { kind: "mouth", targetFeed: 20, multiplierPads: [1, 2, 3, 5] }
  },
  {
    id: 7,
    kind: "challenge",
    length: 184,
    targetScore: 3500,
    trackWidth: 6.4,
    track: baseTrack(184, 6.4),
    entities: [
      ...foodLine("l7-a", -8, 1, 8),
      { id: "l7-roll-a", kind: "rollingPin", x: 0, z: -38, width: 2.5, range: 2.7, speed: 2.7 },
      { id: "l7-jam-left", kind: "jam", x: -2.1, z: -52, width: 1.3, depth: 2 },
      { id: "l7-jam-right", kind: "jam", x: 2.1, z: -60, width: 1.3, depth: 2 },
      ...toppings("l7-t1", -72),
      { id: "l7-slam-a", kind: "slammer", x: -1.6, z: -96, width: 2.1, speed: 2.5 },
      { id: "l7-slam-b", kind: "slammer", x: 1.6, z: -108, width: 2.1, speed: 3 },
      ...foodLine("l7-b", -116, 0, 6),
      ...foodLine("l7-c", -118, 2, 6),
      { id: "l7-height", kind: "heightGate", x: 0, z: -144, width: 5.6, minStack: 15 },
      { id: "l7-syrup", kind: "syrup", x: 0, z: -154 },
      ...foodLine("l7-d", -162, 1, 7)
    ],
    finish: { kind: "customers", targetFeed: 22, multiplierPads: [1, 2, 3, 5] }
  },
  {
    id: 8,
    kind: "bonus",
    length: 142,
    targetScore: 3300,
    trackWidth: 7,
    track: baseTrack(142, 7),
    entities: [
      ...foodLine("l8-a", -7, 0, 9, 2.2),
      ...foodLine("l8-b", -8, 1, 10, 2.2),
      ...foodLine("l8-c", -9, 2, 9, 2.2),
      { id: "l8-magnet-a", kind: "magnet", x: 0, z: -36 },
      ...toppings("l8-t1", -48),
      ...toppings("l8-t2", -72),
      { id: "l8-golden-a", kind: "goldenPancake", x: -2.1, z: -92 },
      { id: "l8-golden-b", kind: "goldenPancake", x: 0, z: -96 },
      { id: "l8-golden-c", kind: "goldenPancake", x: 2.1, z: -100 },
      { id: "l8-syrup", kind: "syrup", x: 0, z: -112 },
      ...foodLine("l8-d", -120, 1, 8, 2.1)
    ],
    finish: { kind: "mouth", targetFeed: 24, multiplierPads: [2, 3, 5] }
  },
  {
    id: 9,
    kind: "challenge",
    length: 196,
    targetScore: 4200,
    trackWidth: 6.2,
    track: baseTrack(196, 6.2),
    entities: [
      ...foodLine("l9-a", -9, 1, 8),
      { id: "l9-blade-a", kind: "blade", x: -2, z: -40, width: 2.1, depth: 1.2 },
      { id: "l9-blade-b", kind: "blade", x: 2, z: -52, width: 2.1, depth: 1.2 },
      ...toppings("l9-t1", -62),
      { id: "l9-color-blue", kind: "colorGate", x: 0, z: -84, requiredColor: "blue", width: 1.7 },
      { id: "l9-glutton-left", kind: "glutton", x: -2.1, z: -108, width: 2.1, depth: 2.8 },
      { id: "l9-roll", kind: "rollingPin", x: 0, z: -126, width: 2.4, range: 2.6, speed: 3.1 },
      ...foodLine("l9-b", -136, 0, 6),
      ...foodLine("l9-c", -138, 2, 6),
      { id: "l9-pipe", kind: "lowPipe", x: 0, z: -162, width: 5.5, safeHeight: 13 },
      { id: "l9-butter", kind: "butter", x: -2.1, z: -172 },
      { id: "l9-syrup", kind: "syrup", x: 2.1, z: -178 }
    ],
    finish: { kind: "customers", targetFeed: 25, multiplierPads: [1, 2, 3, 5] }
  },
  {
    id: 10,
    kind: "boss",
    length: 218,
    targetScore: 5200,
    trackWidth: 6.8,
    track: baseTrack(218, 6.8),
    entities: [
      ...foodLine("l10-a", -8, 1, 10),
      { id: "l10-roll-a", kind: "rollingPin", x: 0, z: -42, width: 2.6, range: 3, speed: 2.8 },
      ...toppings("l10-t1", -58),
      { id: "l10-hole-a", kind: "hole", x: -2.1, z: -78, width: 2, depth: 3.2 },
      { id: "l10-hole-b", kind: "hole", x: 2.1, z: -90, width: 2, depth: 3.2 },
      { id: "l10-slam", kind: "slammer", x: 0, z: -112, width: 2.4, speed: 3.2 },
      ...foodLine("l10-b", -122, 0, 7),
      ...foodLine("l10-c", -124, 2, 7),
      { id: "l10-glutton-a", kind: "glutton", x: -2.1, z: -152, width: 2.1, depth: 2.7 },
      { id: "l10-glutton-b", kind: "glutton", x: 2.1, z: -162, width: 2.1, depth: 2.7 },
      { id: "l10-butter", kind: "butter", x: 0, z: -174 },
      { id: "l10-syrup", kind: "syrup", x: 0, z: -184 },
      { id: "l10-tongue-a", kind: "tongue", x: 0, z: -196, width: 2.8, range: 2.9, speed: 3.4 },
      { id: "l10-tongue-b", kind: "tongue", x: 0, z: -207, width: 2.4, range: 2.4, speed: 4, phase: 1.8 },
      ...foodLine("l10-d", -210, 1, 4)
    ],
    finish: { kind: "boss", targetFeed: 30, multiplierPads: [2, 3, 5], bossHp: 34 }
  }
];

export function getLevel(levelNumber: number): LevelData {
  const index = (levelNumber - 1) % levelCatalog.length;
  const base = levelCatalog[index];
  if (levelNumber <= levelCatalog.length) {
    return base;
  }

  const loop = Math.floor((levelNumber - 1) / levelCatalog.length);
  return {
    ...base,
    id: levelNumber,
    targetScore: Math.round(base.targetScore * (1 + loop * 0.18)),
    finish: {
      ...base.finish,
      targetFeed: base.finish.targetFeed + loop * 2,
      bossHp: base.finish.bossHp ? base.finish.bossHp + loop * 4 : undefined
    }
  };
}
