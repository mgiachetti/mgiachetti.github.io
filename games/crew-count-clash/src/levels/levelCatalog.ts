import type { LevelData, LevelEntity, TrackSegment } from "../game/types";

const lanes = [-2.35, 0, 2.35];

function track(id: string, zStart: number, zEnd: number, width = 7.2): TrackSegment {
  return { id, zStart, zEnd, width };
}

function movingTrack(id: string, zStart: number, zEnd: number, amplitude = 1.7, speed = 1.2): TrackSegment {
  return { id, zStart, zEnd, width: 6.8, kind: "moving", amplitude, speed };
}

function bridgeTrack(id: string, zStart: number, zEnd: number, amplitude = 2.4, speed = 1.1, width = 6.4): TrackSegment {
  return { id, zStart, zEnd, width, kind: "bridge", amplitude, speed };
}

function tiltingTrack(id: string, zStart: number, zEnd: number, speed = 1.35, width = 6.1): TrackSegment {
  return { id, zStart, zEnd, width, kind: "tilting", speed };
}

function liftTrack(id: string, zStart: number, zEnd: number, amplitude = 0.34, speed = 1.25, width = 6.2): TrackSegment {
  return { id, zStart, zEnd, width, kind: "lift", amplitude, speed };
}

function splitIslandTracks(prefix: string, zStart: number, zEnd: number, laneOffset = 2.15, amplitude = 0.45, speed = 1.35): TrackSegment[] {
  return [
    { id: `${prefix}-left`, zStart, zEnd, x: -laneOffset, width: 3.85, kind: "splitIsland", amplitude, speed },
    { id: `${prefix}-right`, zStart, zEnd, x: laneOffset, width: 3.85, kind: "splitIsland", amplitude, speed, phase: Math.PI }
  ];
}

function conveyorTrack(id: string, zStart: number, zEnd: number, direction: -1 | 1, width = 6.8): TrackSegment {
  return { id, zStart, zEnd, width, kind: "conveyor", direction };
}

function collapsingTrack(id: string, zStart: number, zEnd: number, width = 5.8): TrackSegment {
  return { id, zStart, zEnd, width, kind: "collapsing" };
}

function turntableTrack(id: string, zStart: number, zEnd: number, width = 6.2, speed = 1.35): TrackSegment {
  return { id, zStart, zEnd, width, kind: "turntable", speed };
}

function crewLine(prefix: string, zStart: number, lane: number, count: number, spacing = 2.5): LevelEntity[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-crew-${index}`,
    kind: index % 7 === 6 ? "crewCapsule" : "crew",
    x: lanes[lane],
    z: zStart + index * spacing,
    value: index % 7 === 6 ? 4 : 1
  }));
}

function coinArc(prefix: string, zStart: number, lane: number, count: number): LevelEntity[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-coin-${index}`,
    kind: index % 8 === 7 ? "gem" : "coin",
    x: lanes[lane] + Math.sin(index * 0.8) * 0.45,
    z: zStart + index * 1.7,
    value: index % 8 === 7 ? 1 : 3
  }));
}

function gatePair(prefix: string, z: number, left: [string, number], right: [string, number]): LevelEntity[] {
  return [
    {
      id: `${prefix}-left`,
      kind: "gate",
      x: -1.85,
      z,
      width: 2.6,
      depth: 1.2,
      op: left[0] as LevelEntity["op"],
      value: left[1],
      label: labelFor(left[0], left[1])
    },
    {
      id: `${prefix}-right`,
      kind: "gate",
      x: 1.85,
      z,
      width: 2.6,
      depth: 1.2,
      op: right[0] as LevelEntity["op"],
      value: right[1],
      label: labelFor(right[0], right[1])
    }
  ];
}

function movingGatePair(prefix: string, z: number, left: [string, number], right: [string, number], range = 0.55, speed = 1.35): LevelEntity[] {
  return gatePair(prefix, z, left, right).map((gate, index) => ({
    ...gate,
    range,
    speed,
    phase: index === 0 ? 0 : Math.PI
  }));
}

function splitPathGatePair(prefix: string, z: number, left: [string, number], right: [string, number], laneOffset = 2.15): LevelEntity[] {
  return [
    {
      id: `${prefix}-left`,
      kind: "gate",
      x: -laneOffset,
      z,
      width: 2.35,
      depth: 1.2,
      op: left[0] as LevelEntity["op"],
      value: left[1],
      label: labelFor(left[0], left[1])
    },
    {
      id: `${prefix}-right`,
      kind: "gate",
      x: laneOffset,
      z,
      width: 2.35,
      depth: 1.2,
      op: right[0] as LevelEntity["op"],
      value: right[1],
      label: labelFor(right[0], right[1])
    }
  ];
}

function timedGatePair(prefix: string, z: number, left: [string, number, string, number], right: [string, number, string, number]): LevelEntity[] {
  return [
    {
      id: `${prefix}-left`,
      kind: "gate",
      x: -1.85,
      z,
      width: 2.6,
      depth: 1.2,
      op: left[0] as LevelEntity["op"],
      value: left[1],
      altOp: left[2] as LevelEntity["op"],
      altValue: left[3],
      interval: 1.15,
      label: labelFor(left[0], left[1])
    },
    {
      id: `${prefix}-right`,
      kind: "gate",
      x: 1.85,
      z,
      width: 2.6,
      depth: 1.2,
      op: right[0] as LevelEntity["op"],
      value: right[1],
      altOp: right[2] as LevelEntity["op"],
      altValue: right[3],
      interval: 1.25,
      phase: 0.45,
      label: labelFor(right[0], right[1])
    }
  ];
}

function colorPair(prefix: string, z: number, left: "cyan" | "lime" | "coral" | "violet", right: "cyan" | "lime" | "coral" | "violet"): LevelEntity[] {
  return [
    { id: `${prefix}-left`, kind: "colorGate", x: -1.85, z, width: 2.6, depth: 1.2, color: left, value: 10 },
    { id: `${prefix}-right`, kind: "colorGate", x: 1.85, z, width: 2.6, depth: 1.2, color: right, value: 10 }
  ];
}

function labelFor(op: string, value: number): string {
  if (op === "add") return `+${value}`;
  if (op === "subtract") return `-${value}`;
  if (op === "multiply") return `x${value}`;
  if (op === "divide") return `/${value}`;
  return `${value > 0 ? "+" : ""}${value}%`;
}

function bonusItems(prefix: string, zStart: number): LevelEntity[] {
  return [
    ...coinArc(`${prefix}-coins-a`, zStart, 0, 10),
    ...coinArc(`${prefix}-coins-b`, zStart + 2, 2, 10),
    { id: `${prefix}-magnet`, kind: "magnet", x: 0, z: zStart + 22 },
    ...crewLine(`${prefix}-crew-a`, zStart + 28, 1, 8, 1.8),
    { id: `${prefix}-ticket`, kind: "ticket", x: 0, z: zStart + 48 },
    ...coinArc(`${prefix}-coins-c`, zStart + 54, 1, 14)
  ];
}

export const levelCatalog: LevelData[] = [
  {
    id: 1,
    kind: "normal",
    name: "First Shift",
    length: 132,
    targetScore: 1800,
    targetStair: 10,
    startCount: 4,
    track: [track("l1-a", -10, 68), movingTrack("l1-moving", 68, 92, 1.35, 1.25), track("l1-b", 92, 156)],
    entities: [
      ...crewLine("l1-a", 10, 1, 8),
      ...coinArc("l1-a", 14, 0, 7),
      ...gatePair("l1-g1", 31, ["add", 8], ["multiply", 2]),
      { id: "l1-bar", kind: "rotatingBar", x: 0, z: 48, width: 5.8, depth: 1.2, speed: 2.6 },
      ...crewLine("l1-b", 55, 2, 5),
      { id: "l1-enemy", kind: "enemy", x: 0, z: 66, count: 14, strength: 1, width: 3.5 },
      ...gatePair("l1-g2", 82, ["add", 12], ["divide", 2]),
      { id: "l1-shield", kind: "shield", x: -2.3, z: 95 },
      { id: "l1-saw", kind: "sawLane", x: 2.2, z: 108, width: 1.7, depth: 3 },
      ...crewLine("l1-c", 116, 1, 6, 2)
    ]
  },
  {
    id: 2,
    kind: "challenge",
    name: "Factory Lanes",
    length: 158,
    targetScore: 2600,
    targetStair: 14,
    startCount: 5,
    track: [track("l2-a", -10, 74, 7), track("l2-narrow", 74, 100, 4.9), track("l2-b", 100, 182, 7.2)],
    entities: [
      ...crewLine("l2-a", 8, 0, 7),
      ...crewLine("l2-b", 10, 2, 7),
      ...gatePair("l2-g1", 28, ["add", 10], ["multiply", 3]),
      { id: "l2-goo", kind: "goo", x: 0, z: 45, width: 3.2, depth: 4 },
      { id: "l2-crusher-a", kind: "crusher", x: -1.9, z: 61, width: 2, depth: 2, speed: 2.4 },
      { id: "l2-crusher-b", kind: "crusher", x: 1.9, z: 72, width: 2, depth: 2, speed: 2.9, phase: 1.4 },
      ...gatePair("l2-g2", 91, ["subtract", 12], ["multiply", 2]),
      ...coinArc("l2-coins", 100, 1, 10),
      { id: "l2-enemy-a", kind: "enemy", x: -1.8, z: 118, count: 20, strength: 1, width: 2.8 },
      { id: "l2-enemy-b", kind: "enemy", x: 1.8, z: 130, count: 12, strength: 2, width: 2.8 },
      { id: "l2-magnet", kind: "magnet", x: 0, z: 142 },
      ...crewLine("l2-c", 148, 1, 5, 1.9)
    ]
  },
  {
    id: 3,
    kind: "bonus",
    name: "Lucky Wheel",
    length: 108,
    targetScore: 1600,
    targetStair: 0,
    startCount: 8,
    track: [track("l3-bonus", -10, 132, 8.2)],
    entities: [...bonusItems("l3", 8)]
  },
  {
    id: 4,
    kind: "challenge",
    name: "Sky Bridges",
    length: 174,
    targetScore: 3300,
    targetStair: 16,
    startCount: 6,
    track: [
      track("l4-a", -10, 52, 7.2),
      movingTrack("l4-moving-a", 52, 78, 1.9, 1.6),
      track("l4-b", 78, 118, 6),
      movingTrack("l4-moving-b", 118, 144, 1.6, 1.95),
      track("l4-c", 144, 198, 7.2)
    ],
    entities: [
      ...crewLine("l4-a", 8, 1, 8),
      ...gatePair("l4-g1", 30, ["multiply", 2], ["add", 18]),
      { id: "l4-hole-a", kind: "hole", x: -2.2, z: 46, width: 2.1, depth: 4 },
      { id: "l4-fan-a", kind: "fan", x: -3, z: 86, width: 2, depth: 7, value: 1 },
      { id: "l4-laser", kind: "laser", x: 0, z: 103, width: 6.2, depth: 1.2, speed: 2.6 },
      { id: "l4-commander", kind: "commander", x: 0, z: 114 },
      ...gatePair("l4-g2", 130, ["percent", 50], ["divide", 3]),
      { id: "l4-bomb", kind: "bossBomb", x: 0, z: 147 },
      { id: "l4-enemy", kind: "enemy", x: 0, z: 158, count: 32, strength: 1, width: 4.4 },
      ...crewLine("l4-c", 164, 1, 7, 1.8)
    ]
  },
  {
    id: 5,
    kind: "boss",
    name: "Castle King",
    length: 168,
    targetScore: 4200,
    targetStair: 0,
    startCount: 8,
    track: [track("l5-a", -10, 190, 7.4)],
    boss: { name: "Castle King", hp: 140, attackInterval: 1.8, gemReward: 5, medalReward: 1 },
    entities: [
      ...crewLine("l5-a", 8, 1, 10),
      ...gatePair("l5-g1", 28, ["multiply", 3], ["add", 20]),
      { id: "l5-bar-a", kind: "rotatingBar", x: 0, z: 48, width: 6, depth: 1.2, speed: 3.1 },
      ...coinArc("l5-coins-a", 56, 0, 7),
      ...gatePair("l5-g2", 78, ["subtract", 18], ["multiply", 2]),
      { id: "l5-crusher", kind: "crusher", x: 0, z: 96, width: 2.8, depth: 2, speed: 2.6 },
      { id: "l5-enemy-a", kind: "enemy", x: -1.7, z: 116, count: 24, strength: 1, width: 3 },
      { id: "l5-enemy-b", kind: "enemy", x: 1.7, z: 126, count: 18, strength: 2, width: 3 },
      { id: "l5-shield", kind: "shield", x: 0, z: 137 },
      { id: "l5-bomb", kind: "bossBomb", x: -2.2, z: 148 },
      ...crewLine("l5-b", 150, 2, 6, 1.8)
    ]
  },
  {
    id: 6,
    kind: "bonus",
    name: "Gem Wheel",
    length: 118,
    targetScore: 1800,
    targetStair: 0,
    startCount: 10,
    track: [track("l6-bonus", -10, 142, 8.2)],
    entities: [...bonusItems("l6", 8), ...crewLine("l6-extra", 78, 1, 8, 1.8)]
  },
  {
    id: 7,
    kind: "challenge",
    name: "Switchyard",
    length: 196,
    targetScore: 4400,
    targetStair: 18,
    startCount: 7,
    track: [
      track("l7-a", -10, 56, 7.2),
      conveyorTrack("l7-conveyor-a", 56, 92, 1, 6.6),
      track("l7-b", 92, 132, 6.4),
      conveyorTrack("l7-conveyor-b", 132, 164, -1, 6.6),
      track("l7-c", 164, 220, 7.2)
    ],
    entities: [
      ...crewLine("l7-a", 8, 1, 9, 2),
      ...timedGatePair("l7-tg1", 32, ["multiply", 2, "subtract", 18], ["add", 22, "divide", 2]),
      { id: "l7-scraper-left", kind: "sideScraper", x: -3.1, z: 52, width: 1.2, depth: 5 },
      { id: "l7-scraper-right", kind: "sideScraper", x: 3.1, z: 67, width: 1.2, depth: 5 },
      { id: "l7-roller", kind: "spikeRoller", x: 0, z: 86, width: 1.8, depth: 2.2, range: 2.4, speed: 2.8 },
      ...crewLine("l7-b", 96, 0, 6, 1.9),
      ...coinArc("l7-coins", 102, 2, 9),
      ...timedGatePair("l7-tg2", 126, ["percent", 60, "divide", 3], ["multiply", 3, "subtract", 24]),
      { id: "l7-cannon-a", kind: "cannon", x: -3.1, z: 148, width: 1.4, depth: 3.2, range: 3.2, speed: 3.4 },
      { id: "l7-enemy", kind: "enemy", x: 0, z: 166, count: 44, strength: 1, width: 4.4 },
      { id: "l7-shield", kind: "shield", x: 2.3, z: 178 },
      ...crewLine("l7-c", 181, 1, 7, 1.8)
    ]
  },
  {
    id: 8,
    kind: "normal",
    name: "Color Comms",
    length: 184,
    targetScore: 3900,
    targetStair: 17,
    startCount: 8,
    track: [track("l8-a", -10, 208, 7.4)],
    entities: [
      ...crewLine("l8-a", 8, 1, 8, 2),
      { id: "l8-lime-pad", kind: "colorPad", x: -2.35, z: 28, color: "lime" },
      { id: "l8-coral-pad", kind: "colorPad", x: 2.35, z: 28, color: "coral" },
      ...colorPair("l8-cg1", 44, "lime", "coral"),
      { id: "l8-axe-a", kind: "swingingAxe", x: 0, z: 62, width: 1.4, depth: 2.2, range: 2.7, speed: 2.1 },
      ...movingGatePair("l8-g1", 82, ["add", 18], ["multiply", 2], 0.55, 1.35),
      { id: "l8-cyan-pad", kind: "colorPad", x: 0, z: 98, color: "cyan" },
      ...colorPair("l8-cg2", 116, "cyan", "violet"),
      { id: "l8-cannon-a", kind: "cannon", x: 3.2, z: 134, width: 1.3, depth: 3.1, range: 3, speed: 3.2 },
      { id: "l8-bumper-a", kind: "bumper", x: -2, z: 150, width: 2, depth: 1.3 },
      { id: "l8-bumper-b", kind: "bumper", x: 2, z: 158, width: 2, depth: 1.3 },
      { id: "l8-enemy", kind: "enemy", x: 0, z: 170, count: 34, strength: 1, width: 4.2 },
      ...crewLine("l8-b", 174, 1, 6, 1.7)
    ]
  },
  {
    id: 9,
    kind: "challenge",
    name: "Breakaway Deck",
    length: 204,
    targetScore: 5000,
    targetStair: 20,
    startCount: 9,
    track: [
      track("l9-a", -10, 48, 7.2),
      collapsingTrack("l9-collapse-a", 48, 76, 5.2),
      turntableTrack("l9-turn", 76, 112, 6, 1.8),
      collapsingTrack("l9-collapse-b", 112, 150, 5),
      bridgeTrack("l9-bridge", 142, 180, 2.6, 1.05),
      track("l9-b", 172, 230, 7.2)
    ],
    entities: [
      ...crewLine("l9-a", 8, 0, 7, 2),
      ...crewLine("l9-b", 10, 2, 7, 2),
      ...gatePair("l9-g1", 34, ["multiply", 2], ["add", 28]),
      { id: "l9-hole-a", kind: "hole", x: 0, z: 58, width: 1.8, depth: 3.2 },
      { id: "l9-roller-a", kind: "spikeRoller", x: 0, z: 86, width: 1.7, depth: 2.4, range: 2.2, speed: 3 },
      ...timedGatePair("l9-tg", 108, ["add", 34, "subtract", 28], ["multiply", 2, "divide", 3]),
      { id: "l9-laser-a", kind: "laser", x: 0, z: 130, width: 5.8, depth: 1.2, speed: 3.2 },
      { id: "l9-bomb", kind: "bossBomb", x: 2.2, z: 150 },
      { id: "l9-enemy-a", kind: "enemy", x: -1.7, z: 168, count: 28, strength: 2, width: 3.2 },
      { id: "l9-enemy-b", kind: "enemy", x: 1.7, z: 178, count: 42, strength: 1, width: 3.2 },
      { id: "l9-magnet", kind: "magnet", x: 0, z: 190 },
      ...coinArc("l9-coins", 192, 1, 9)
    ]
  },
  {
    id: 10,
    kind: "boss",
    name: "Mecha Guard",
    length: 190,
    targetScore: 5400,
    targetStair: 0,
    startCount: 10,
    track: [track("l10-a", -10, 214, 7.4)],
    boss: { name: "Mecha Guard", hp: 190, attackInterval: 1.65, gemReward: 7, medalReward: 1, bodyColor: 0x4f5d75, arenaColor: 0x9bd0f5, attackKind: "sweep" },
    entities: [
      ...crewLine("l10-a", 8, 1, 10, 1.9),
      ...timedGatePair("l10-tg1", 30, ["multiply", 3, "divide", 2], ["add", 26, "subtract", 20]),
      { id: "l10-cannon-a", kind: "cannon", x: -3.2, z: 52, width: 1.4, depth: 3.4, range: 3.2, speed: 3.6 },
      { id: "l10-axe-a", kind: "swingingAxe", x: 0, z: 72, width: 1.4, depth: 2.4, range: 2.6, speed: 2.4 },
      ...gatePair("l10-g2", 92, ["add", 30], ["multiply", 2]),
      { id: "l10-scraper-a", kind: "sideScraper", x: -3.2, z: 112, width: 1.1, depth: 5 },
      { id: "l10-scraper-b", kind: "sideScraper", x: 3.2, z: 124, width: 1.1, depth: 5 },
      { id: "l10-enemy-a", kind: "enemy", x: 0, z: 142, count: 54, strength: 1, width: 4.8 },
      { id: "l10-bomb-a", kind: "bossBomb", x: -2.2, z: 156 },
      { id: "l10-bomb-b", kind: "bossBomb", x: 2.2, z: 164 },
      ...crewLine("l10-b", 166, 1, 8, 1.6)
    ]
  },
  {
    id: 11,
    kind: "bonus",
    name: "Jackpot Wheel",
    length: 126,
    targetScore: 2200,
    targetStair: 0,
    startCount: 12,
    track: [track("l11-bonus", -10, 150, 8.4)],
    entities: [
      ...bonusItems("l11", 8),
      { id: "l11-frenzy", kind: "frenzy", x: 0, z: 76 },
      ...coinArc("l11-coins-d", 82, 1, 18),
      { id: "l11-ticket-b", kind: "ticket", x: 2.35, z: 116 }
    ]
  },
  {
    id: 12,
    kind: "boss",
    name: "Neon Titan",
    length: 214,
    targetScore: 6500,
    targetStair: 0,
    startCount: 12,
    track: [
      track("l12-a", -10, 74, 7.4),
      conveyorTrack("l12-conveyor", 74, 112, -1, 6.8),
      turntableTrack("l12-turn", 112, 148, 6.2, 2),
      track("l12-b", 148, 238, 7.4)
    ],
    boss: { name: "Neon Titan", hp: 235, attackInterval: 1.45, gemReward: 9, medalReward: 1, bodyColor: 0x9b5de5, arenaColor: 0x00f5d4, attackKind: "minions" },
    entities: [
      ...crewLine("l12-a", 8, 1, 10, 1.8),
      { id: "l12-violet-pad", kind: "colorPad", x: 0, z: 28, color: "violet" },
      ...colorPair("l12-cg1", 44, "violet", "coral"),
      { id: "l12-laser-a", kind: "laser", x: 0, z: 64, width: 6.2, depth: 1.2, speed: 3.6 },
      ...timedGatePair("l12-tg1", 88, ["multiply", 3, "subtract", 35], ["percent", 80, "divide", 3]),
      { id: "l12-roller-a", kind: "spikeRoller", x: 0, z: 112, width: 1.8, depth: 2.4, range: 2.5, speed: 3.4 },
      { id: "l12-cannon-a", kind: "cannon", x: 3.2, z: 134, width: 1.3, depth: 3.4, range: 3.2, speed: 3.8 },
      { id: "l12-enemy-a", kind: "enemy", x: -1.8, z: 154, count: 42, strength: 2, width: 3.2 },
      { id: "l12-enemy-b", kind: "enemy", x: 1.8, z: 166, count: 62, strength: 1, width: 3.2 },
      { id: "l12-shield", kind: "shield", x: 0, z: 180 },
      { id: "l12-bomb-a", kind: "bossBomb", x: -2.2, z: 190 },
      { id: "l12-bomb-b", kind: "bossBomb", x: 2.2, z: 198 },
      ...crewLine("l12-b", 198, 1, 8, 1.5)
    ]
  },
  {
    id: 13,
    kind: "normal",
    name: "Prism Run",
    length: 218,
    targetScore: 6900,
    targetStair: 21,
    startCount: 13,
    track: [
      track("l13-a", -10, 54, 7.4),
      movingTrack("l13-moving-a", 54, 88, 1.8, 1.7),
      track("l13-b", 88, 138, 6.4),
      conveyorTrack("l13-conveyor", 138, 174, 1, 6.8),
      track("l13-c", 174, 242, 7.4)
    ],
    entities: [
      ...crewLine("l13-a", 8, 1, 10, 1.8),
      { id: "l13-lime-pad", kind: "colorPad", x: -2.35, z: 30, color: "lime" },
      { id: "l13-violet-pad", kind: "colorPad", x: 2.35, z: 30, color: "violet" },
      ...colorPair("l13-cg1", 48, "lime", "violet"),
      { id: "l13-axe-a", kind: "swingingAxe", x: 0, z: 68, width: 1.45, depth: 2.3, range: 2.8, speed: 2.7 },
      ...timedGatePair("l13-tg1", 92, ["multiply", 2, "subtract", 30], ["percent", 70, "divide", 3]),
      { id: "l13-saw-a", kind: "sawLane", x: -2.2, z: 116, width: 1.7, depth: 3 },
      { id: "l13-saw-b", kind: "sawLane", x: 2.2, z: 124, width: 1.7, depth: 3 },
      ...coinArc("l13-coins", 132, 1, 12),
      { id: "l13-coral-pad", kind: "colorPad", x: 0, z: 154, color: "coral" },
      ...colorPair("l13-cg2", 174, "cyan", "coral"),
      { id: "l13-enemy-gate", kind: "enemyGate", x: 0, z: 186, count: 30, strength: 1, width: 3.2 },
      { id: "l13-enemy-a", kind: "enemy", x: -1.8, z: 194, count: 46, strength: 1, width: 3.2, range: 0.9, speed: 1.8 },
      { id: "l13-enemy-b", kind: "enemy", x: 1.8, z: 202, count: 24, strength: 2, width: 3.2, range: 0.9, speed: 2, phase: 1.2 },
      ...crewLine("l13-b", 208, 1, 8, 1.4)
    ]
  },
  {
    id: 14,
    kind: "challenge",
    name: "Crush Corridor",
    length: 226,
    targetScore: 7600,
    targetStair: 22,
    startCount: 14,
    track: [
      track("l14-a", -10, 62, 7.2),
      collapsingTrack("l14-collapse-a", 62, 92, 5.3),
      tiltingTrack("l14-tilt-a", 92, 128, 1.55, 6),
      collapsingTrack("l14-collapse-b", 128, 158, 5.2),
      movingTrack("l14-moving", 158, 194, 1.9, 2),
      track("l14-b", 194, 250, 7.2)
    ],
    entities: [
      ...crewLine("l14-a", 8, 0, 8, 1.8),
      ...crewLine("l14-b", 10, 2, 8, 1.8),
      ...timedGatePair("l14-tg1", 34, ["add", 40, "divide", 2], ["multiply", 3, "subtract", 38]),
      { id: "l14-hole-a", kind: "hole", x: -1.9, z: 72, width: 1.9, depth: 3.3 },
      { id: "l14-hole-b", kind: "hole", x: 1.9, z: 88, width: 1.9, depth: 3.3 },
      { id: "l14-crusher-a", kind: "crusher", x: -1.9, z: 108, width: 2, depth: 2, speed: 3.1 },
      { id: "l14-crusher-b", kind: "crusher", x: 1.9, z: 122, width: 2, depth: 2, speed: 3.3, phase: 1.1 },
      { id: "l14-commander", kind: "commander", x: 0, z: 136 },
      ...movingGatePair("l14-g2", 146, ["multiply", 2], ["percent", 90], 0.65, 1.5),
      { id: "l14-roller-a", kind: "spikeRoller", x: 0, z: 166, width: 1.9, depth: 2.4, range: 2.6, speed: 3.7 },
      { id: "l14-shield", kind: "shield", x: -2.3, z: 184 },
      { id: "l14-enemy-a", kind: "enemy", x: 0, z: 204, count: 58, strength: 2, width: 4.8, range: 1.2, speed: 1.9 },
      ...coinArc("l14-coins", 210, 1, 10)
    ]
  },
  {
    id: 15,
    kind: "boss",
    name: "Crusher Queen",
    length: 230,
    targetScore: 8200,
    targetStair: 0,
    startCount: 15,
    track: [
      track("l15-a", -10, 76, 7.4),
      conveyorTrack("l15-conveyor-a", 76, 116, 1, 6.8),
      movingTrack("l15-moving", 116, 154, 1.7, 1.95),
      track("l15-b", 154, 254, 7.4)
    ],
    boss: { name: "Crusher Queen", hp: 280, attackInterval: 1.38, gemReward: 10, medalReward: 1, bodyColor: 0xef476f, arenaColor: 0xffd166, attackKind: "stomp" },
    entities: [
      ...crewLine("l15-a", 8, 1, 12, 1.7),
      ...timedGatePair("l15-tg1", 32, ["multiply", 3, "subtract", 45], ["add", 42, "divide", 2]),
      { id: "l15-crusher-a", kind: "crusher", x: -2.1, z: 56, width: 2, depth: 2.2, speed: 3.2 },
      { id: "l15-crusher-b", kind: "crusher", x: 2.1, z: 70, width: 2, depth: 2.2, speed: 3.45, phase: 1.3 },
      { id: "l15-frenzy", kind: "frenzy", x: 0, z: 88 },
      { id: "l15-axe-a", kind: "swingingAxe", x: 0, z: 108, width: 1.5, depth: 2.4, range: 2.8, speed: 2.8 },
      ...gatePair("l15-g2", 132, ["percent", 100], ["subtract", 50]),
      { id: "l15-enemy-a", kind: "enemy", x: -1.8, z: 156, count: 48, strength: 2, width: 3.2, range: 0.85, speed: 2.1 },
      { id: "l15-enemy-b", kind: "enemy", x: 1.8, z: 168, count: 64, strength: 1, width: 3.2, range: 0.85, speed: 2.25, phase: 1.4 },
      { id: "l15-shield", kind: "shield", x: 0, z: 184 },
      { id: "l15-bomb-a", kind: "bossBomb", x: -2.2, z: 198 },
      { id: "l15-bomb-b", kind: "bossBomb", x: 2.2, z: 208 },
      ...crewLine("l15-b", 210, 1, 9, 1.4)
    ]
  },
  {
    id: 16,
    kind: "challenge",
    name: "Twin Islands",
    length: 238,
    targetScore: 9000,
    targetStair: 23,
    startCount: 15,
    track: [
      track("l16-a", -10, 56, 7.4),
      ...splitIslandTracks("l16-islands", 56, 126, 2.15, 0.5, 1.55),
      track("l16-mid", 122, 166, 5.8),
      conveyorTrack("l16-conveyor", 166, 204, -1, 6.8),
      track("l16-b", 204, 262, 7.4)
    ],
    entities: [
      ...crewLine("l16-a", 8, 1, 10, 1.7),
      ...gatePair("l16-g1", 30, ["multiply", 3], ["add", 46]),
      { id: "l16-fan-a", kind: "fan", x: -3, z: 62, width: 2, depth: 7, value: 1 },
      ...splitPathGatePair("l16-split-g1", 82, ["add", 36], ["multiply", 2]),
      { id: "l16-fan-b", kind: "fan", x: 3, z: 96, width: 2, depth: 7, value: -1 },
      { id: "l16-cannon-a", kind: "cannon", x: -3.2, z: 118, width: 1.3, depth: 3.4, range: 3.2, speed: 4 },
      ...timedGatePair("l16-tg1", 146, ["percent", 120, "divide", 4], ["multiply", 2, "subtract", 46]),
      { id: "l16-laser-a", kind: "laser", x: 0, z: 166, width: 6.2, depth: 1.2, speed: 3.8 },
      { id: "l16-roller-a", kind: "spikeRoller", x: 0, z: 188, width: 1.9, depth: 2.4, range: 2.8, speed: 3.8 },
      { id: "l16-enemy-a", kind: "enemy", x: -1.8, z: 210, count: 36, strength: 2, width: 3.2, range: 1.1, speed: 2.15 },
      { id: "l16-enemy-b", kind: "enemy", x: 1.8, z: 220, count: 68, strength: 1, width: 3.2, range: 1.1, speed: 2.35, phase: 1.6 },
      ...crewLine("l16-b", 226, 1, 8, 1.4)
    ]
  },
  {
    id: 17,
    kind: "boss",
    name: "Storm Warden",
    length: 242,
    targetScore: 9800,
    targetStair: 0,
    startCount: 16,
    track: [
      track("l17-a", -10, 70, 7.4),
      turntableTrack("l17-turn-a", 70, 112, 6.1, 2.1),
      conveyorTrack("l17-conveyor", 112, 152, -1, 6.8),
      liftTrack("l17-lift", 152, 190, 0.36, 1.35),
      track("l17-b", 190, 266, 7.4)
    ],
    boss: { name: "Storm Warden", hp: 330, attackInterval: 1.32, gemReward: 11, medalReward: 1, bodyColor: 0x146ef5, arenaColor: 0x7bdff2, attackKind: "sweep" },
    entities: [
      ...crewLine("l17-a", 8, 1, 12, 1.65),
      ...timedGatePair("l17-tg1", 34, ["add", 50, "subtract", 52], ["multiply", 3, "divide", 3]),
      { id: "l17-scraper-a", kind: "sideScraper", x: -3.2, z: 58, width: 1.1, depth: 5.4 },
      { id: "l17-scraper-b", kind: "sideScraper", x: 3.2, z: 76, width: 1.1, depth: 5.4 },
      { id: "l17-laser-a", kind: "laser", x: 0, z: 100, width: 6.3, depth: 1.2, speed: 4 },
      { id: "l17-violet-pad", kind: "colorPad", x: 0, z: 118, color: "violet" },
      ...colorPair("l17-cg1", 138, "violet", "lime"),
      { id: "l17-cannon-a", kind: "cannon", x: 3.2, z: 160, width: 1.3, depth: 3.4, range: 3.3, speed: 4 },
      { id: "l17-enemy-gate", kind: "enemyGate", x: -1.7, z: 174, count: 38, strength: 1, width: 2.8, range: 0.85, speed: 1.7 },
      { id: "l17-enemy-a", kind: "enemy", x: 0, z: 184, count: 72, strength: 2, width: 4.8, range: 1.35, speed: 2.25 },
      { id: "l17-bomb-a", kind: "bossBomb", x: -2.2, z: 202 },
      { id: "l17-bomb-b", kind: "bossBomb", x: 2.2, z: 214 },
      ...coinArc("l17-coins", 216, 1, 12)
    ]
  },
  {
    id: 18,
    kind: "bonus",
    name: "Vault Wheel",
    length: 142,
    targetScore: 2600,
    targetStair: 0,
    startCount: 18,
    track: [track("l18-bonus", -10, 168, 8.4)],
    entities: [
      ...bonusItems("l18", 8),
      { id: "l18-magnet-b", kind: "magnet", x: -2.35, z: 74 },
      { id: "l18-frenzy", kind: "frenzy", x: 2.35, z: 82 },
      ...coinArc("l18-coins-d", 90, 0, 16),
      ...coinArc("l18-coins-e", 94, 2, 16),
      { id: "l18-ticket-b", kind: "ticket", x: 0, z: 126 }
    ]
  },
  {
    id: 19,
    kind: "challenge",
    name: "Final Gauntlet",
    length: 256,
    targetScore: 10800,
    targetStair: 24,
    startCount: 17,
    track: [
      track("l19-a", -10, 58, 7.4),
      collapsingTrack("l19-collapse-a", 58, 90, 5.4),
      tiltingTrack("l19-tilt-a", 90, 126, 1.75, 6.1),
      turntableTrack("l19-turn", 126, 164, 6, 2.35),
      conveyorTrack("l19-conveyor", 164, 204, 1, 6.8),
      liftTrack("l19-lift", 204, 232, 0.38, 1.55, 5.4),
      track("l19-b", 232, 280, 7.4)
    ],
    entities: [
      ...crewLine("l19-a", 8, 0, 9, 1.65),
      ...crewLine("l19-b", 10, 2, 9, 1.65),
      ...timedGatePair("l19-tg1", 34, ["multiply", 3, "subtract", 60], ["percent", 130, "divide", 4]),
      { id: "l19-hole-a", kind: "hole", x: 0, z: 68, width: 1.9, depth: 3.3 },
      { id: "l19-axe-a", kind: "swingingAxe", x: 0, z: 96, width: 1.5, depth: 2.4, range: 3, speed: 3 },
      { id: "l19-crusher-a", kind: "crusher", x: -2.1, z: 120, width: 2, depth: 2.2, speed: 3.4 },
      { id: "l19-crusher-b", kind: "crusher", x: 2.1, z: 134, width: 2, depth: 2.2, speed: 3.55, phase: 1.2 },
      { id: "l19-commander", kind: "commander", x: 0, z: 144 },
      ...movingGatePair("l19-g2", 154, ["add", 60], ["multiply", 2], 0.72, 1.65),
      { id: "l19-roller-a", kind: "spikeRoller", x: 0, z: 178, width: 1.9, depth: 2.4, range: 2.9, speed: 4.2 },
      { id: "l19-cannon-a", kind: "cannon", x: -3.2, z: 198, width: 1.3, depth: 3.5, range: 3.4, speed: 4.2 },
      { id: "l19-enemy-a", kind: "enemy", x: -1.8, z: 222, count: 54, strength: 2, width: 3.2, range: 1.05, speed: 2.4 },
      { id: "l19-enemy-b", kind: "enemy", x: 1.8, z: 232, count: 78, strength: 1, width: 3.2, range: 1.05, speed: 2.65, phase: 1.5 },
      { id: "l19-shield", kind: "shield", x: 0, z: 240 },
      ...crewLine("l19-c", 244, 1, 8, 1.3)
    ]
  },
  {
    id: 20,
    kind: "boss",
    name: "Crown Core",
    length: 268,
    targetScore: 12200,
    targetStair: 0,
    startCount: 18,
    track: [
      track("l20-a", -10, 70, 7.6),
      conveyorTrack("l20-conveyor-a", 70, 110, 1, 6.9),
      movingTrack("l20-moving-a", 110, 150, 2.2, 2.05),
      turntableTrack("l20-turn", 150, 190, 6.2, 2.4),
      collapsingTrack("l20-collapse", 190, 220, 5.4),
      track("l20-b", 220, 292, 7.6)
    ],
    boss: { name: "Crown Core", hp: 410, attackInterval: 1.22, gemReward: 14, medalReward: 2, bodyColor: 0xffc857, arenaColor: 0xd8d3ff, attackKind: "minions" },
    entities: [
      ...crewLine("l20-a", 8, 1, 14, 1.55),
      { id: "l20-lime-pad", kind: "colorPad", x: -2.35, z: 28, color: "lime" },
      { id: "l20-violet-pad", kind: "colorPad", x: 2.35, z: 28, color: "violet" },
      ...colorPair("l20-cg1", 46, "lime", "violet"),
      ...timedGatePair("l20-tg1", 68, ["multiply", 3, "subtract", 70], ["percent", 140, "divide", 4]),
      { id: "l20-laser-a", kind: "laser", x: 0, z: 92, width: 6.4, depth: 1.2, speed: 4.4 },
      { id: "l20-axe-a", kind: "swingingAxe", x: 0, z: 118, width: 1.55, depth: 2.5, range: 3, speed: 3.1 },
      { id: "l20-coral-pad", kind: "colorPad", x: 0, z: 138, color: "coral" },
      ...colorPair("l20-cg2", 160, "coral", "cyan"),
      { id: "l20-crusher-a", kind: "crusher", x: -2.1, z: 182, width: 2, depth: 2.2, speed: 3.6 },
      { id: "l20-crusher-b", kind: "crusher", x: 2.1, z: 194, width: 2, depth: 2.2, speed: 3.8, phase: 1.2 },
      { id: "l20-enemy-a", kind: "enemy", x: -1.8, z: 218, count: 70, strength: 2, width: 3.2, range: 1.1, speed: 2.5 },
      { id: "l20-enemy-b", kind: "enemy", x: 1.8, z: 228, count: 86, strength: 1, width: 3.2, range: 1.1, speed: 2.7, phase: 1.7 },
      { id: "l20-frenzy", kind: "frenzy", x: 0, z: 238 },
      { id: "l20-bomb-a", kind: "bossBomb", x: -2.2, z: 248 },
      { id: "l20-bomb-b", kind: "bossBomb", x: 0, z: 256 },
      { id: "l20-bomb-c", kind: "bossBomb", x: 2.2, z: 264 },
      ...crewLine("l20-b", 252, 1, 10, 1.35)
    ]
  }
];

validateLevelCatalog();

export function getLevel(levelNumber: number): LevelData {
  const base = levelCatalog[(levelNumber - 1) % levelCatalog.length];
  if (levelNumber <= levelCatalog.length) {
    return base;
  }
  const loop = Math.floor((levelNumber - 1) / levelCatalog.length);
  return {
    ...base,
    id: levelNumber,
    targetScore: Math.round(base.targetScore * (1 + loop * 0.2)),
    targetStair: base.targetStair + loop * 2,
    startCount: base.startCount + loop,
    boss: base.boss
      ? {
          ...base.boss,
          hp: Math.round(base.boss.hp * (1 + loop * 0.22)),
          gemReward: base.boss.gemReward + loop
        }
      : undefined
  };
}

function validateLevelCatalog(): void {
  const bossNames = new Set<string>();
  levelCatalog.forEach((level, index) => {
    if (level.id !== index + 1) {
      throw new Error(`Level catalog id mismatch at slot ${index + 1}: got ${level.id}`);
    }
    if (level.track.length === 0) {
      throw new Error(`Level ${level.id} has no track segments`);
    }
    if (!level.track.some((segment) => segment.zStart <= -5)) {
      throw new Error(`Level ${level.id} does not cover the start line`);
    }
    if (!level.track.some((segment) => segment.zEnd >= level.length)) {
      throw new Error(`Level ${level.id} track ends before level length ${level.length}`);
    }
    if (level.kind === "boss") {
      if (!level.boss) {
        throw new Error(`Boss level ${level.id} is missing boss config`);
      }
      bossNames.add(level.boss.name);
    }
    if (level.kind !== "boss" && level.boss) {
      throw new Error(`Non-boss level ${level.id} has boss config`);
    }
    if (level.kind !== "bonus" && !level.entities.some((entity) => entity.kind === "gate" || entity.kind === "colorGate")) {
      throw new Error(`Run level ${level.id} has no gates`);
    }

    const ids = new Set<string>();
    level.entities.forEach((entity) => {
      if (ids.has(entity.id)) {
        throw new Error(`Level ${level.id} has duplicate entity id ${entity.id}`);
      }
      ids.add(entity.id);
      if (entity.z < -12 || entity.z > level.length + 4) {
        throw new Error(`Level ${level.id} entity ${entity.id} is outside playable z bounds`);
      }
      const segment = level.track.find((candidate) => {
        const center = candidate.x ?? 0;
        const margin = entity.kind === "sideScraper" || entity.kind === "fan" || entity.kind === "cannon" ? 1.1 : 0.65;
        return entity.z >= candidate.zStart && entity.z <= candidate.zEnd && Math.abs(entity.x - center) <= candidate.width / 2 + margin;
      });
      if (!segment) {
        throw new Error(`Level ${level.id} entity ${entity.id} is not on a track segment`);
      }
      const center = segment.x ?? 0;
      const margin = entity.kind === "sideScraper" || entity.kind === "fan" || entity.kind === "cannon" ? 1.1 : 0.65;
      if (Math.abs(entity.x - center) > segment.width / 2 + margin) {
        throw new Error(`Level ${level.id} entity ${entity.id} is outside track width`);
      }
    });
  });
  if (bossNames.size < 5) {
    throw new Error(`Expected at least 5 boss archetypes, got ${bossNames.size}`);
  }
}
