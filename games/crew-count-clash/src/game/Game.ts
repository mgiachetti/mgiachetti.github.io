import * as THREE from "three";
import { AudioManager } from "../audio/AudioManager";
import { getLevel } from "../levels/levelCatalog";
import { Hud } from "../ui/Hud";
import { clamp, damp, seededRandom } from "../utils/math";
import { calculateGateCount } from "./gateMath";
import { buyOrEquipCosmetic, buyUpgrade, cosmeticCatalog, getEquippedCosmetic, grantRunRewards, loadSave, resetSave, saveGame, upgradeCosts } from "./saveData";
import type { GameMode, LevelData, LevelEntity, RewardData, RunStats, SaveData, TrackSegment } from "./types";

type RuntimeEntity = {
  data: LevelEntity;
  mesh: THREE.Object3D;
  consumed: boolean;
  cooldown: number;
};

type RuntimeTrack = {
  data: TrackSegment;
  mesh: THREE.Mesh;
};

type FloatingItem = {
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  angularVelocity?: THREE.Vector3;
  life: number;
};

type RouletteReward = {
  kind: "coins" | "gems" | "shards" | "ticket" | "skin" | "upgrade";
  label: string;
  shortLabel: string;
  amount: number;
  color: number;
  tone: "good" | "coin" | "boss";
  weight: number;
};

type LevelTheme = {
  sky: number;
  fog: number;
  ground: number;
  track: number;
  trackDark: number;
  moving: number;
  castle: number;
  sideA: number;
  sideB: number;
  accent: number;
};

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 280);
  private readonly hud = new Hud();
  private readonly audio: AudioManager;
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
  private readonly pointerHit = new THREE.Vector3();
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpQuaternion = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3(1, 1, 1);
  private readonly tmpPosition = new THREE.Vector3();
  private readonly tmpEuler = new THREE.Euler();
  private readonly cameraLookTarget = new THREE.Vector3(0, 0.75, 8);
  private readonly tmpCameraLookTarget = new THREE.Vector3(0, 0.75, 8);
  private readonly flatQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly textTextureCache = new Map<string, THREE.CanvasTexture>();

  private save: SaveData = loadSave();
  private mode: GameMode = "title";
  private level: LevelData = getLevel(1);
  private world = new THREE.Group();
  private crowd = new THREE.Group();
  private decorGroup = new THREE.Group();
  private statusGroup = new THREE.Group();
  private shieldAura: THREE.Mesh | null = null;
  private magnetAura: THREE.Mesh | null = null;
  private frenzyAura: THREE.Mesh | null = null;
  private commanderAura: THREE.Mesh | null = null;
  private bodyInstances: THREE.InstancedMesh;
  private bodyHighlightInstances: THREE.InstancedMesh;
  private visorInstances: THREE.InstancedMesh;
  private packInstances: THREE.InstancedMesh;
  private hatInstances: THREE.InstancedMesh;
  private trailInstances: THREE.InstancedMesh;
  private shadowInstances: THREE.InstancedMesh;
  private leftLegInstances: THREE.InstancedMesh;
  private rightLegInstances: THREE.InstancedMesh;
  private tracks: RuntimeTrack[] = [];
  private entities: RuntimeEntity[] = [];
  private floating: FloatingItem[] = [];
  private stairsGroup = new THREE.Group();
  private bossGroup = new THREE.Group();
  private bossTelegraph: THREE.Mesh | null = null;
  private bossWeapon: THREE.Group | null = null;
  private bossRightArm: THREE.Object3D | null = null;
  private bossLeftArm: THREE.Object3D | null = null;
  private bossRightHand: THREE.Object3D | null = null;
  private bossBody: THREE.Object3D | null = null;
  private bossCrown: THREE.Object3D | null = null;
  private bossGate: THREE.Object3D | null = null;
  private bossWeakCore: THREE.Object3D | null = null;
  private stairScoreMarker: THREE.Object3D | null = null;
  private stairVault: THREE.Group | null = null;
  private stairFinaleStarted = false;
  private stairFinaleTimer = 0;
  private rouletteGroup = new THREE.Group();
  private rouletteWheel: THREE.Group | null = null;
  private roulettePointer: THREE.Group | null = null;
  private rouletteHubGem: THREE.Object3D | null = null;
  private rouletteGlow: THREE.Mesh | null = null;
  private rouletteBulbs: THREE.Object3D[] = [];
  private roulettePrizeSprite: THREE.Sprite | null = null;
  private rouletteSelectedReward: RouletteReward | null = null;
  private bossHp = 0;
  private bossMaxHp = 1;
  private bossAttackTimer = 0;
  private bossAttackWarn = 0;
  private bossAttackImpact = 0;
  private bossAttackX = 0;
  private bossHitPulse = 0;
  private bossVictoryTimer = 0;
  private bossBombs = 0;
  private bossWeakPoints = 0;
  private rouletteTimer = 0;
  private rouletteTick = 0;
  private rouletteSpinStart = 0;
  private rouletteSpinEnd = 0;
  private rouletteRevealTimer = 0;
  private rouletteResolved = false;
  private rouletteDirectPayout = false;
  private extraSpinReward: RewardData | null = null;
  private stairTimer = 0;
  private count = 1;
  private centerX = 0;
  private targetX = 0;
  private distance = 0;
  private speed = 0;
  private currentBattle: RuntimeEntity | null = null;
  private battleTimer = 0;
  private battleDuration = 1.5;
  private battleEnemyCount = 0;
  private battleLoss = 0;
  private battleAppliedLoss = 0;
  private battleAppliedDefeats = 0;
  private battleX = 0;
  private battleZ = 0;
  private battleBeat = 0;
  private shield = 0;
  private magnetTimer = 0;
  private frenzyTimer = 0;
  private commanderTimer = 0;
  private jumpTimer = 0;
  private readonly jumpDuration = 0.86;
  private gooTimer = 0;
  private cameraShake = 0;
  private cameraBlendTimer = 0;
  private cameraRigKey = "title";
  private crowdImpactPulse = 0;
  private lastHapticTime = 0;
  private lastTime = 0;
  private pointerDown = false;
  private keyboardX = 0;
  private isTouchDevice = false;
  private activeTeamColor: "cyan" | "lime" | "coral" | "violet" = "cyan";
  private hatEquipped = false;
  private trailEquipped = false;
  private packOffsetY = 0.01;
  private packOffsetZ = -0.33;
  private packScaleX = 1;
  private packScaleY = 1;
  private packScaleZ = 1;
  private hatOffsetY = 0.7;
  private hatOffsetZ = 0.03;
  private hatScaleX = 0.78;
  private hatScaleY = 0.72;
  private hatScaleZ = 0.78;
  private trailOffsetY = 0.105;
  private trailOffsetZ = -0.74;
  private trailWidthScale = 1;
  private trailLengthScale = 1;

  private stats: RunStats = this.createStats();

  private readonly maxVisibleCrew = 150;
  private readonly rouletteRewards: RouletteReward[] = [
    { kind: "coins", label: "Coins +150", shortLabel: "+150", amount: 150, color: 0xffd166, tone: "coin", weight: 1.55 },
    { kind: "gems", label: "Gems +3", shortLabel: "+3G", amount: 3, color: 0x7bdff2, tone: "good", weight: 1.15 },
    { kind: "coins", label: "Coins +300", shortLabel: "+300", amount: 300, color: 0xff9f1c, tone: "coin", weight: 1.05 },
    { kind: "ticket", label: "Ticket +1", shortLabel: "TK", amount: 1, color: 0x9b5de5, tone: "boss", weight: 0.74 },
    { kind: "shards", label: "Shards +4", shortLabel: "+4S", amount: 4, color: 0x38bdf8, tone: "good", weight: 0.72 },
    { kind: "coins", label: "Coins +500", shortLabel: "+500", amount: 500, color: 0xffca3a, tone: "coin", weight: 0.62 },
    { kind: "upgrade", label: "Free Upgrade", shortLabel: "UP", amount: 1, color: 0x58f29a, tone: "good", weight: 0.42 },
    { kind: "gems", label: "Gems +8", shortLabel: "+8G", amount: 8, color: 0x00f5d4, tone: "good", weight: 0.4 },
    { kind: "skin", label: "Jackpot Skin", shortLabel: "SKIN", amount: 1, color: 0xef476f, tone: "boss", weight: 0.2 },
    { kind: "gems", label: "Gems +12", shortLabel: "+12G", amount: 12, color: 0x5eead4, tone: "good", weight: 0.24 }
  ];
  private readonly levelThemes: LevelTheme[] = [
    {
      sky: 0xaee8ff,
      fog: 0xaee8ff,
      ground: 0x7dd6f6,
      track: 0x67d7e5,
      trackDark: 0x2b9bb6,
      moving: 0xa7f25b,
      castle: 0x9aa7b2,
      sideA: 0xffd166,
      sideB: 0x58f29a,
      accent: 0x146ef5
    },
    {
      sky: 0xc9dbff,
      fog: 0xc9dbff,
      ground: 0x8bb4d9,
      track: 0x8ee3d0,
      trackDark: 0x355c7d,
      moving: 0xffd166,
      castle: 0x6b7280,
      sideA: 0xef476f,
      sideB: 0xff9f1c,
      accent: 0x7c3aed
    },
    {
      sky: 0xffe4f1,
      fog: 0xffe4f1,
      ground: 0x9bd0f5,
      track: 0xf9c74f,
      trackDark: 0xf8961e,
      moving: 0x00f5d4,
      castle: 0xc084fc,
      sideA: 0x00f5d4,
      sideB: 0xef476f,
      accent: 0xffca3a
    },
    {
      sky: 0xd8d3ff,
      fog: 0xd8d3ff,
      ground: 0x8fd3ff,
      track: 0x64dfdf,
      trackDark: 0x4f5d75,
      moving: 0xffca3a,
      castle: 0x6d6875,
      sideA: 0xff477e,
      sideB: 0x7bdff2,
      accent: 0xffc857
    }
  ];

  private readonly materials = {
    body: new THREE.MeshStandardMaterial({ color: 0x36c9f6, roughness: 0.58, metalness: 0.05 }),
    bodyHighlight: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24, depthWrite: false }),
    visor: new THREE.MeshStandardMaterial({ color: 0xbdefff, roughness: 0.18, metalness: 0.2 }),
    pack: new THREE.MeshStandardMaterial({ color: 0x2087ad, roughness: 0.58, metalness: 0.05 }),
    hat: new THREE.MeshStandardMaterial({ color: 0xffca3a, roughness: 0.42, metalness: 0.12 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x7dd6f6, roughness: 0.82 }),
    enemy: new THREE.MeshStandardMaterial({ color: 0xf05252, roughness: 0.62, metalness: 0.04 }),
    enemyVisor: new THREE.MeshStandardMaterial({ color: 0x231942, roughness: 0.3, metalness: 0.1 }),
    track: new THREE.MeshStandardMaterial({ color: 0x67d7e5, roughness: 0.7, metalness: 0.03 }),
    trackDark: new THREE.MeshStandardMaterial({ color: 0x2b9bb6, roughness: 0.76, metalness: 0.03 }),
    trackEdge: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.58, metalness: 0.02 }),
    trackLane: new THREE.MeshStandardMaterial({ color: 0xeafcff, roughness: 0.5, metalness: 0.03 }),
    movingTrack: new THREE.MeshStandardMaterial({ color: 0xa7f25b, roughness: 0.6, metalness: 0.05 }),
    gateGood: new THREE.MeshStandardMaterial({ color: 0x58f29a, roughness: 0.22, transparent: true, opacity: 0.74 }),
    gateBad: new THREE.MeshStandardMaterial({ color: 0xff5a5f, roughness: 0.28, transparent: true, opacity: 0.72 }),
    gatePost: new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.44, metalness: 0.12 }),
    coin: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.28, metalness: 0.2 }),
    gem: new THREE.MeshStandardMaterial({ color: 0x7bdff2, roughness: 0.25, metalness: 0.15 }),
    shield: new THREE.MeshStandardMaterial({ color: 0x94f1ff, roughness: 0.28, metalness: 0.2, transparent: true, opacity: 0.82 }),
    magnet: new THREE.MeshStandardMaterial({ color: 0x9d4edd, roughness: 0.42, metalness: 0.08 }),
    frenzy: new THREE.MeshStandardMaterial({ color: 0xff9f1c, roughness: 0.42, metalness: 0.08 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xef476f, roughness: 0.46, metalness: 0.18 }),
    hazardDark: new THREE.MeshStandardMaterial({ color: 0x3c1642, roughness: 0.72, metalness: 0.08 }),
    warning: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.35, transparent: true, opacity: 0.62 }),
    boss: new THREE.MeshStandardMaterial({ color: 0x673ab7, roughness: 0.6, metalness: 0.04 }),
    bossGold: new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: 0.36, metalness: 0.18 }),
    castle: new THREE.MeshStandardMaterial({ color: 0xc7d1da, roughness: 0.75, metalness: 0.03 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0xffca3a, roughness: 0.42, metalness: 0.08 }),
    trail: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.44, transparent: true, opacity: 0.5, emissive: 0xffffff, emissiveIntensity: 0.1 }),
    contactShadow: new THREE.MeshBasicMaterial({ color: 0x102033, transparent: true, opacity: 0.16, depthWrite: false }),
    statusShield: new THREE.MeshBasicMaterial({ color: 0xbdefff, transparent: true, opacity: 0.18, depthWrite: false }),
    statusMagnet: new THREE.MeshBasicMaterial({ color: 0x9d4edd, transparent: true, opacity: 0.48, depthWrite: false }),
    statusFrenzy: new THREE.MeshBasicMaterial({ color: 0xff9f1c, transparent: true, opacity: 0.42, depthWrite: false }),
    statusCommander: new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.5, depthWrite: false }),
    rouletteGlow: new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0, depthWrite: false })
  };

  private readonly teamColors = {
    cyan: 0x36c9f6,
    lime: 0x92e342,
    coral: 0xff6b6b,
    violet: 0x9b5de5
  };

  private readonly geometries = {
    body: new THREE.CapsuleGeometry(0.3, 0.54, 8, 18),
    bodyHighlight: new THREE.BoxGeometry(0.075, 0.34, 0.035),
    visor: new THREE.BoxGeometry(0.46, 0.22, 0.08),
    pack: new THREE.BoxGeometry(0.24, 0.48, 0.16),
    packJet: new THREE.CylinderGeometry(0.16, 0.2, 0.56, 14),
    packVault: new THREE.TorusGeometry(0.21, 0.055, 8, 20),
    hat: new THREE.CylinderGeometry(0.2, 0.24, 0.13, 10),
    hatCrown: new THREE.ConeGeometry(0.3, 0.38, 5),
    hatAntenna: new THREE.CylinderGeometry(0.065, 0.105, 0.48, 8),
    hatHelmet: new THREE.SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hatParty: new THREE.ConeGeometry(0.28, 0.54, 16),
    trail: new THREE.BoxGeometry(0.26, 0.035, 0.66),
    leg: new THREE.CapsuleGeometry(0.1, 0.18, 6, 10),
    cube: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(0.5, 24, 16),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
    cone: new THREE.ConeGeometry(0.34, 0.62, 5),
    torus: new THREE.TorusGeometry(0.42, 0.08, 12, 28),
    shadow: new THREE.CircleGeometry(0.46, 24)
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.audio = new AudioManager(this.save.muted);
    this.applyDebugSaveParams();
    const params = new URLSearchParams(window.location.search);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: params.has("pixel") || params.has("autostart")
    });
    this.isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    const pixelRatioCap = this.isTouchDevice ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.shadowInstances = new THREE.InstancedMesh(this.geometries.shadow, this.materials.contactShadow, this.maxVisibleCrew);
    this.bodyInstances = new THREE.InstancedMesh(this.geometries.body, this.materials.body, this.maxVisibleCrew);
    this.bodyHighlightInstances = new THREE.InstancedMesh(this.geometries.bodyHighlight, this.materials.bodyHighlight, this.maxVisibleCrew);
    this.visorInstances = new THREE.InstancedMesh(this.geometries.visor, this.materials.visor, this.maxVisibleCrew);
    this.packInstances = new THREE.InstancedMesh(this.geometries.pack, this.materials.pack, this.maxVisibleCrew);
    this.hatInstances = new THREE.InstancedMesh(this.geometries.hat, this.materials.hat, this.maxVisibleCrew);
    this.trailInstances = new THREE.InstancedMesh(this.geometries.trail, this.materials.trail, this.maxVisibleCrew);
    this.leftLegInstances = new THREE.InstancedMesh(this.geometries.leg, this.materials.body, this.maxVisibleCrew);
    this.rightLegInstances = new THREE.InstancedMesh(this.geometries.leg, this.materials.body, this.maxVisibleCrew);
    this.bodyInstances.castShadow = true;
    this.bodyHighlightInstances.renderOrder = 2;
    this.visorInstances.castShadow = true;
    this.packInstances.castShadow = true;
    this.hatInstances.castShadow = true;
    this.leftLegInstances.castShadow = true;
    this.rightLegInstances.castShadow = true;
    [this.shadowInstances, this.bodyInstances, this.bodyHighlightInstances, this.visorInstances, this.packInstances, this.hatInstances, this.trailInstances, this.leftLegInstances, this.rightLegInstances].forEach((mesh) => {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    this.crowd.add(this.shadowInstances, this.trailInstances, this.leftLegInstances, this.rightLegInstances, this.bodyInstances, this.bodyHighlightInstances, this.visorInstances, this.packInstances, this.hatInstances);
    this.createStatusAuras();

    this.bindUi();
    this.bindInput();
    this.setupScene();
    this.applyCosmetics();
    this.resize();
    this.hud.updateMute(this.save.muted);
    this.hud.showTitle(this.save);
  }

  start(): void {
    window.addEventListener("resize", () => this.resize());
    this.renderer.setAnimationLoop((time: number) => this.tick(time));
  }

  private applyDebugSaveParams(): void {
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (params.has("reset")) {
      this.save = resetSave();
      changed = true;
    }
    if (params.has("unlock")) {
      this.save.currentLevel = Math.max(this.save.currentLevel, 20);
      this.save.coins = Math.max(this.save.coins, 25000);
      this.save.gems = Math.max(this.save.gems, 500);
      this.save.tickets = Math.max(this.save.tickets, 12);
      this.save.medals = Math.max(this.save.medals, 12);
      this.save.castleXP = Math.max(this.save.castleXP, 212);
      this.save.ownedCosmetics = Array.from(new Set([...this.save.ownedCosmetics, ...cosmeticCatalog.map((item) => item.key)]));
      (Object.keys(this.save.upgrades) as Array<keyof typeof this.save.upgrades>).forEach((key) => {
        this.save.upgrades[key] = upgradeCosts.length;
      });
      changed = true;
    }
    if (changed) {
      saveGame(this.save);
      this.audio.setMuted(this.save.muted);
    }
  }

  async quickStart(levelNumber = this.save.currentLevel): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    await this.beginLevel(levelNumber, true);
    if (params.has("boss")) {
      const count = Number(params.get("count") ?? "80");
      this.count = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 80;
      this.stats.maxCount = Math.max(this.stats.maxCount, this.count);
      const weak = Number(params.get("weak") ?? "0");
      this.bossWeakPoints = Number.isFinite(weak) ? clamp(Math.floor(weak), 0, 6) : 0;
      this.startBoss();
    } else if (params.has("stairs")) {
      const count = Number(params.get("count") ?? "60");
      this.count = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 60;
      this.stats.maxCount = Math.max(this.stats.maxCount, this.count);
      this.startStairs();
    } else if (params.has("roulette")) {
      this.startRoulette();
    } else if (params.has("battle")) {
      const count = Number(params.get("count") ?? "48");
      this.count = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 48;
      this.stats.maxCount = Math.max(this.stats.maxCount, this.count);
      const enemy = this.level.entities.find((entity) => entity.kind === "enemy");
      if (enemy) {
        this.targetX = enemy.x;
        this.centerX = enemy.x;
        this.distance = enemy.z - 1.2;
      }
    } else if (params.has("count")) {
      const count = Number(params.get("count") ?? String(this.count));
      this.count = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : this.count;
      this.stats.maxCount = Math.max(this.stats.maxCount, this.count);
    }
  }

  private bindUi(): void {
    this.hud.onStart = () => void this.beginLevel(this.save.currentLevel);
    this.hud.onNext = () => void this.beginLevel(this.save.currentLevel);
    this.hud.onExtraSpin = () => this.startExtraSpin();
    this.hud.onRetry = () => void this.beginLevel(this.level.id);
    this.hud.onHome = () => {
      this.mode = "title";
      this.audio.stopMusic();
      this.hud.showTitle(this.save);
    };
    this.hud.onPause = () => {
      if (this.mode === "run" || this.mode === "boss" || this.mode === "stairs" || this.mode === "roulette") {
        this.mode = "pause";
        this.hud.showPause();
      }
    };
    this.hud.onResume = () => {
      if (this.mode === "pause") {
        this.mode = this.level.kind === "boss" && this.distance >= this.level.length ? "boss" : "run";
        this.hud.showRun();
      }
    };
    this.hud.onOpenShop = () => {
      this.mode = "shop";
      void this.audio.unlock().then(() => this.audio.switchMusic("shop"));
      this.hud.showShop(this.save);
    };
    this.hud.onCloseShop = () => {
      this.mode = "title";
      this.hud.showTitle(this.save);
    };
    this.hud.onOpenMap = () => {
      this.mode = "map";
      void this.audio.unlock().then(() => this.audio.switchMusic("run"));
      this.hud.showMap(this.save);
    };
    this.hud.onCloseMap = () => {
      this.mode = "title";
      this.hud.showTitle(this.save);
    };
    this.hud.onOpenBase = () => {
      this.mode = "base";
      void this.audio.unlock().then(() => this.audio.switchMusic("shop"));
      this.hud.showBase(this.save);
    };
    this.hud.onCloseBase = () => {
      this.mode = "title";
      this.hud.showTitle(this.save);
    };
    this.hud.onSelectLevel = (levelNumber) => {
      if (levelNumber <= this.save.currentLevel) {
        void this.beginLevel(levelNumber);
      }
    };
    this.hud.onResetSave = () => {
      this.save = resetSave();
      this.applyCosmetics();
      this.hud.updateMute(this.save.muted);
      this.hud.showShop(this.save);
    };
    this.hud.onMute = () => {
      this.save.muted = this.audio.toggleMuted();
      saveGame(this.save);
      this.hud.updateMute(this.save.muted);
    };
    this.hud.onBuy = (key) => {
      if (buyUpgrade(this.save, key)) {
        this.audio.coin();
      } else {
        this.audio.hit();
      }
      this.hud.updateShop(this.save);
    };
    this.hud.onCosmetic = (key) => {
      const result = buyOrEquipCosmetic(this.save, key);
      if (result === "blocked") {
        this.audio.hit();
      } else {
        this.audio.coin();
        this.applyCosmetics();
      }
      this.hud.updateShop(this.save);
    };
  }

  private bindInput(): void {
    const onPointer = (event: PointerEvent, down: boolean) => {
      this.pointerDown = down;
      if (down) {
        this.canvas.setPointerCapture(event.pointerId);
        void this.audio.unlock().then(() => this.audio.startMusic("run"));
      }
      this.updatePointerTarget(event);
    };

    this.canvas.addEventListener("pointerdown", (event) => onPointer(event, true));
    this.canvas.addEventListener("pointermove", (event) => {
      if (this.pointerDown) {
        this.updatePointerTarget(event);
      }
    });
    this.canvas.addEventListener("pointerup", (event) => onPointer(event, false));
    this.canvas.addEventListener("pointercancel", () => {
      this.pointerDown = false;
    });

    window.addEventListener("keydown", (event) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        this.keyboardX = 1;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        this.keyboardX = -1;
      }
      if (event.code === "Space" || event.code === "Enter") {
        void this.audio.unlock().then(() => this.audio.startMusic("run"));
        if (this.mode === "title") {
          void this.beginLevel(this.save.currentLevel);
        }
      }
      if (event.code === "KeyR" && (this.mode === "fail" || this.mode === "reward")) {
        void this.beginLevel(this.level.id);
      }
      if (event.code === "Escape" || event.code === "KeyP") {
        if (this.mode === "pause") {
          this.mode = this.level.kind === "boss" && this.distance >= this.level.length ? "boss" : "run";
          this.hud.showRun();
        } else if (this.mode === "run" || this.mode === "boss" || this.mode === "stairs" || this.mode === "roulette") {
          this.mode = "pause";
          this.hud.showPause();
        }
      }
      if (event.code === "KeyM") {
        this.save.muted = this.audio.toggleMuted();
        saveGame(this.save);
        this.hud.updateMute(this.save.muted);
      }
    });
    window.addEventListener("keyup", (event) => {
      if ((event.code === "ArrowLeft" || event.code === "KeyA") && this.keyboardX > 0) {
        this.keyboardX = 0;
      }
      if ((event.code === "ArrowRight" || event.code === "KeyD") && this.keyboardX < 0) {
        this.keyboardX = 0;
      }
    });
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0xaee8ff);
    this.scene.fog = new THREE.Fog(0xaee8ff, 56, 210);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x78a5b8, 1.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-12, 22, -8);
    sun.castShadow = true;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -34;
    sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 34;
    sun.shadow.camera.bottom = -34;
    this.scene.add(sun);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(280, 300), this.materials.ground);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.35, 78);
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.scene.add(this.world, this.crowd, this.statusGroup);
    this.camera.position.set(0, 8.5, -12);
  }

  private createStatusAuras(): void {
    this.statusGroup.visible = false;
    this.statusGroup.frustumCulled = false;

    this.shieldAura = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.materials.statusShield);
    this.shieldAura.position.y = 0.72;
    this.shieldAura.scale.set(1.4, 0.62, 1.4);
    this.shieldAura.renderOrder = 1;
    this.statusGroup.add(this.shieldAura);

    this.magnetAura = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 72), this.materials.statusMagnet);
    this.magnetAura.position.y = 0.09;
    this.magnetAura.rotation.x = Math.PI / 2;
    this.magnetAura.renderOrder = 2;
    this.statusGroup.add(this.magnetAura);

    this.frenzyAura = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 8, 72), this.materials.statusFrenzy);
    this.frenzyAura.position.y = 0.12;
    this.frenzyAura.rotation.x = Math.PI / 2;
    this.frenzyAura.renderOrder = 2;
    this.statusGroup.add(this.frenzyAura);

    this.commanderAura = new THREE.Mesh(new THREE.TorusGeometry(1, 0.028, 8, 72), this.materials.statusCommander);
    this.commanderAura.position.y = 0.16;
    this.commanderAura.rotation.x = Math.PI / 2;
    this.commanderAura.renderOrder = 2;
    this.statusGroup.add(this.commanderAura);
  }

  private resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  private async beginLevel(levelNumber: number, skipAudio = false): Promise<void> {
    if (!skipAudio) {
      await this.audio.unlock();
      this.audio.switchMusic("run");
    }
    this.mode = "run";
    this.level = getLevel(levelNumber);
    this.stats = this.createStats();
    this.applyLevelTheme();
    this.clearWorld();
    this.distance = 0;
    this.centerX = 0;
    this.targetX = 0;
    this.speed = 0;
    this.currentBattle = null;
    this.battleTimer = 0;
    this.battleDuration = 1.5;
    this.battleEnemyCount = 0;
    this.battleLoss = 0;
    this.battleAppliedLoss = 0;
    this.battleAppliedDefeats = 0;
    this.battleX = 0;
    this.battleZ = 0;
    this.battleBeat = 0;
    this.count = this.level.startCount + this.save.upgrades.startCrew * 2;
    this.shield = this.save.upgrades.shield > 0 ? 1 : 0;
    this.magnetTimer = 0;
    this.frenzyTimer = 0;
    this.commanderTimer = 0;
    this.jumpTimer = 0;
    this.gooTimer = 0;
    this.activeTeamColor = "cyan";
    this.materials.body.color.setHex(this.teamColors.cyan);
    this.cameraShake = 0;
    this.crowdImpactPulse = 0;
    this.bossBombs = 0;
    this.bossWeakPoints = 0;
    this.bossHp = 0;
    this.bossMaxHp = 1;
    this.bossAttackTimer = 0;
    this.bossAttackWarn = 0;
    this.bossAttackImpact = 0;
    this.bossHitPulse = 0;
    this.bossVictoryTimer = 0;
    this.rouletteTimer = 0;
    this.rouletteTick = 0;
    this.rouletteSpinStart = 0;
    this.rouletteSpinEnd = 0;
    this.rouletteRevealTimer = 0;
    this.rouletteResolved = false;
    this.rouletteDirectPayout = false;
    this.extraSpinReward = null;
    this.rouletteSelectedReward = null;
    this.stairTimer = 0;
    this.stairFinaleStarted = false;
    this.stairFinaleTimer = 0;
    this.stats.maxCount = this.count;
    this.buildLevel();
    this.hud.showRun();
    this.updateCrowdInstances(0);
  }

  private clearWorld(): void {
    this.world.clear();
    this.decorGroup.clear();
    this.tracks = [];
    this.entities = [];
    this.floating.forEach((item) => this.scene.remove(item.mesh));
    this.floating = [];
    this.currentBattle = null;
    this.battleTimer = 0;
    this.battleAppliedLoss = 0;
    this.battleAppliedDefeats = 0;
    this.crowdImpactPulse = 0;
    this.stairsGroup.clear();
    this.stairsGroup.visible = true;
    this.bossGroup.clear();
    this.bossGroup.visible = true;
    this.bossTelegraph = null;
    this.bossWeapon = null;
    this.bossRightArm = null;
    this.bossLeftArm = null;
    this.bossRightHand = null;
    this.bossBody = null;
    this.bossCrown = null;
    this.bossGate = null;
    this.bossWeakCore = null;
    this.bossWeakCore = null;
    this.stairScoreMarker = null;
    this.stairVault = null;
    this.stairFinaleStarted = false;
    this.stairFinaleTimer = 0;
    this.rouletteWheel = null;
    this.roulettePointer = null;
    this.rouletteHubGem = null;
    this.rouletteGlow = null;
    this.rouletteBulbs = [];
    this.roulettePrizeSprite = null;
    this.rouletteDirectPayout = false;
    this.extraSpinReward = null;
    this.rouletteGroup.clear();
    this.rouletteGroup.visible = true;
  }

  private buildLevel(): void {
    this.level.track.forEach((segment) => {
      const mesh = this.createTrackMesh(segment);
      this.tracks.push({ data: segment, mesh });
      this.world.add(mesh);
    });
    this.createTrackDecorations();

    this.level.entities.forEach((entity) => {
      const mesh = this.createEntityMesh(entity);
      this.entities.push({ data: entity, mesh, consumed: false, cooldown: 0 });
      this.world.add(mesh);
    });

    if (this.level.kind === "boss") {
      this.createBossArena();
    } else if (this.level.kind === "bonus") {
      this.createRouletteWheel(this.level.length + 18);
    } else {
      this.createStairs(this.level.length + 8);
    }
  }

  private getLevelTheme(): LevelTheme {
    if (this.level.kind === "boss") {
      return this.levelThemes[3];
    }
    if (this.level.kind === "bonus") {
      return this.levelThemes[2];
    }
    if (this.level.kind === "challenge") {
      return this.levelThemes[1];
    }
    return this.level.id % 2 === 0 ? this.levelThemes[1] : this.levelThemes[0];
  }

  private applyLevelTheme(): void {
    const theme = this.getLevelTheme();
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.Fog(theme.fog, 50, 215);
    this.materials.ground.color.setHex(theme.ground);
    this.materials.track.color.setHex(theme.track);
    this.materials.trackDark.color.setHex(theme.trackDark);
    this.materials.movingTrack.color.setHex(theme.moving);
    this.materials.castle.color.setHex(theme.castle);
  }

  private createTrackDecorations(): void {
    const theme = this.getLevelTheme();
    this.decorGroup.clear();
    const postMaterial = new THREE.MeshStandardMaterial({ color: theme.accent, roughness: 0.48, metalness: 0.08 });
    const flagA = new THREE.MeshStandardMaterial({ color: theme.sideA, roughness: 0.5, metalness: 0.04 });
    const flagB = new THREE.MeshStandardMaterial({ color: theme.sideB, roughness: 0.5, metalness: 0.04 });
    const gemMaterial = new THREE.MeshStandardMaterial({ color: theme.sideB, roughness: 0.24, metalness: 0.18 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: theme.castle, roughness: 0.72, metalness: 0.02 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: theme.sideA, roughness: 0.48, metalness: 0.05 });
    const windowMaterial = new THREE.MeshStandardMaterial({ color: theme.sideB, roughness: 0.24, metalness: 0.15, emissive: theme.sideB, emissiveIntensity: 0.08 });
    const shadowMaterial = new THREE.MeshStandardMaterial({ color: 0x203047, roughness: 0.82, transparent: true, opacity: 0.22 });
    const label = this.makeTextSprite(this.level.kind === "bonus" ? "BONUS" : this.level.kind === "boss" ? "BOSS RUN" : `LEVEL ${this.level.id}`, "#ffffff", "#102033");
    label.position.set(0, 1.45, 4);
    label.scale.set(1.75, 0.42, 1);
    this.decorGroup.add(label);

    for (let z = 10, index = 0; z < this.level.length - 8; z += 24, index += 1) {
      const track = this.getTrackAt(z);
      if (!track) {
        continue;
      }
      const center = this.getTrackCenter(track.data, 0);
      const sideX = track.data.width / 2 + 0.9;
      [-1, 1].forEach((side) => {
        const x = center + side * sideX;
        const curb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 4.4), wallMaterial);
        curb.position.set(center + side * (track.data.width / 2 + 0.24), 0.1, z);
        curb.castShadow = true;
        curb.receiveShadow = true;
        this.decorGroup.add(curb);

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.45, 10), postMaterial);
        post.position.set(x, 0.38, z);
        post.castShadow = true;
        this.decorGroup.add(post);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.06), (index + side > 0 ? flagA : flagB));
        flag.position.set(x + side * 0.24, 1.08, z);
        flag.rotation.y = side > 0 ? -0.18 : 0.18;
        flag.userData.floatBaseY = flag.position.y;
        flag.userData.floatPhase = index * 0.8 + side;
        this.decorGroup.add(flag);

        const buildingHeight = 0.9 + ((index + (side > 0 ? 1 : 2)) % 3) * 0.42;
        const building = new THREE.Mesh(new THREE.BoxGeometry(0.86, buildingHeight, 0.95), wallMaterial);
        building.position.set(center + side * (sideX + 1.35 + (index % 2) * 0.2), buildingHeight / 2 - 0.28, z + 2.8);
        building.castShadow = true;
        building.receiveShadow = true;
        this.decorGroup.add(building);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.48, 4), roofMaterial);
        roof.position.set(building.position.x, building.position.y + buildingHeight / 2 + 0.2, building.position.z);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        this.decorGroup.add(roof);
        for (let floor = 0; floor < Math.min(3, Math.ceil(buildingHeight)); floor += 1) {
          const window = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.28), windowMaterial);
          window.position.set(building.position.x - side * 0.44, 0.42 + floor * 0.32, building.position.z);
          window.castShadow = false;
          this.setPulse(window, 0.08, 2.4, index + floor + side);
          this.decorGroup.add(window);
        }

        if (index % 3 === 1) {
          const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.85, 8), wallMaterial);
          tower.position.set(center + side * (sideX + 2.05), 0.62, z - 5);
          tower.castShadow = true;
          tower.receiveShadow = true;
          this.decorGroup.add(tower);
          const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.54, 6), side > 0 ? flagB : flagA);
          towerRoof.position.set(tower.position.x, 1.78, tower.position.z);
          towerRoof.castShadow = true;
          this.decorGroup.add(towerRoof);
        }
      });

      if (index % 2 === 0) {
        [-1, 1].forEach((side) => {
          const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), gemMaterial);
          orb.position.set(center + side * (sideX + 0.6), 1.42, z + 6);
          orb.castShadow = true;
          orb.userData.spin = side * 1.8;
          orb.userData.floatBaseY = orb.position.y;
          orb.userData.floatPhase = z * 0.07;
          this.decorGroup.add(orb);
        });
      }

      if (index % 2 === 1) {
        const routeShadow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.035, 0.7), shadowMaterial);
        routeShadow.position.set(center, 0.095, z - 7);
        routeShadow.rotation.y = 0.08;
        this.decorGroup.add(routeShadow);
        const routeSign = this.makeTextSprite(this.level.kind === "boss" ? "CASTLE" : this.level.kind === "bonus" ? "LUCKY" : "CLASH", "#ffffff", "#102033");
        routeSign.position.set(center - 2.15, 1.05, z - 7.4);
        routeSign.scale.set(1.05, 0.28, 1);
        routeSign.rotation.y = 0.26;
        this.decorGroup.add(routeSign);
      }
    }

    const finishLabel = this.makeTextSprite(this.level.kind === "boss" ? "KING" : this.level.kind === "bonus" ? "SPIN" : "STAIRS", "#13223a", "#ffffff");
    finishLabel.position.set(0, 1.55, this.level.length - 2);
    finishLabel.scale.set(1.5, 0.38, 1);
    this.decorGroup.add(finishLabel);
    this.world.add(this.decorGroup);
  }

  private setPulse(object: THREE.Object3D, amount: number, speed: number, phase = 0): void {
    object.userData.pulseAmount = amount;
    object.userData.pulseSpeed = speed;
    object.userData.pulsePhase = phase;
    object.userData.baseScaleX = object.scale.x;
    object.userData.baseScaleY = object.scale.y;
    object.userData.baseScaleZ = object.scale.z;
  }

  private animateTaggedObject(root: THREE.Object3D, time: number, dt: number): void {
    root.traverse((item) => {
      if (typeof item.userData.floatBaseY === "number") {
        item.position.y = item.userData.floatBaseY + Math.sin(time * 2.5 + (item.userData.floatPhase ?? 0)) * 0.08;
      }
      if (typeof item.userData.spin === "number") {
        item.rotation.y += item.userData.spin * dt;
      }
      if (typeof item.userData.spinZ === "number") {
        item.rotation.z += item.userData.spinZ * dt;
      }
      const pulseAmount = Number(item.userData.pulseAmount);
      if (Number.isFinite(pulseAmount)) {
        const pulse = 1 + Math.sin(time * (item.userData.pulseSpeed ?? 3) + (item.userData.pulsePhase ?? 0)) * pulseAmount;
        item.scale.set(
          (item.userData.baseScaleX ?? 1) * pulse,
          (item.userData.baseScaleY ?? 1) * pulse,
          (item.userData.baseScaleZ ?? 1) * pulse
        );
      }
      if (typeof item.userData.blinkSpeed === "number") {
        item.visible = Math.sin(time * item.userData.blinkSpeed + (item.userData.blinkPhase ?? 0)) > -0.45;
      }
    });
  }

  private createTrackMesh(segment: TrackSegment): THREE.Mesh {
    const length = segment.zEnd - segment.zStart;
    const material =
      segment.kind === "moving" || segment.kind === "bridge" || segment.kind === "splitIsland"
        ? this.materials.movingTrack
        : segment.kind === "conveyor"
          ? this.materials.frenzy
          : segment.kind === "collapsing"
            ? this.materials.warning
            : segment.kind === "turntable" || segment.kind === "lift"
              ? this.materials.gem
              : segment.kind === "tilting"
                ? this.materials.coin
              : this.materials.track;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(segment.width, 0.32, length), material);
    mesh.position.set(segment.x ?? 0, -0.12, (segment.zStart + segment.zEnd) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    [-1, 1].forEach((side) => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, Math.max(0.4, length - 0.28)), this.materials.trackEdge);
      edge.position.set(side * (segment.width / 2 - 0.08), 0.23, 0);
      edge.castShadow = true;
      edge.receiveShadow = true;
      mesh.add(edge);
    });

    [-1, 1].forEach((side) => {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.4, segment.width - 0.36), 0.06, 0.16), this.materials.trackEdge);
      cap.position.set(0, 0.24, side * (length / 2 - 0.08));
      cap.receiveShadow = true;
      mesh.add(cap);
    });

    const laneXs = segment.width >= 6.2 ? [-segment.width * 0.18, segment.width * 0.18] : [0];
    const dashSpacing = 5.2;
    const dashCount = Math.min(28, Math.max(2, Math.floor(length / dashSpacing)));
    for (let index = 0; index < dashCount; index += 1) {
      const z = -length / 2 + 2.2 + index * dashSpacing;
      if (z > length / 2 - 1.4) {
        continue;
      }
      laneXs.forEach((x) => {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.052, 0.82), this.materials.trackLane);
        dash.position.set(x, 0.255, z);
        dash.receiveShadow = true;
        mesh.add(dash);
      });
    }

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.12, segment.width - 0.9), 0.04, 0.18), this.materials.trackDark);
    stripe.position.set(0, 0.19, 0);
    mesh.add(stripe);

    if (segment.kind === "bridge") {
      [-0.26, 0, 0.26].forEach((offset) => {
        const arrow = new THREE.Mesh(new THREE.BoxGeometry(segment.width * 0.3, 0.045, 0.2), this.materials.warning);
        arrow.position.set(0, 0.22, length * offset);
        arrow.rotation.y = Math.PI / 4;
        mesh.add(arrow);
      });
    } else if (segment.kind === "tilting") {
      [-1, 1].forEach((side) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, Math.max(0.4, length - 0.8)), this.materials.hazardDark);
        rail.position.set(side * (segment.width / 2 - 0.18), 0.26, 0);
        rail.castShadow = true;
        mesh.add(rail);
      });
    } else if (segment.kind === "lift") {
      [-1, 1].forEach((sideX) => {
        [-1, 1].forEach((sideZ) => {
          const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.34, 10), this.materials.hazard);
          beacon.position.set(sideX * (segment.width / 2 - 0.38), 0.34, sideZ * (length / 2 - 0.52));
          beacon.userData.blinkSpeed = 5.8;
          beacon.userData.blinkPhase = segment.zStart + sideX + sideZ;
          mesh.add(beacon);
        });
      });
    } else if (segment.kind === "splitIsland") {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, segment.width - 0.45), 0.05, 0.22), this.materials.warning);
      edge.position.set(0, 0.23, -length * 0.38);
      mesh.add(edge);
    }
    return mesh;
  }

  private createEntityMesh(entity: LevelEntity): THREE.Object3D {
    if (entity.kind === "weakPointGate") {
      return this.createWeakPointGateMesh(entity);
    }
    if (entity.kind === "gate" || entity.kind === "colorGate") {
      return this.createGateMesh(entity);
    }
    if (entity.kind === "enemyGate") {
      return this.createEnemyGateMesh(entity);
    }
    if (entity.kind === "enemy") {
      return this.createEnemyMesh(entity);
    }
    if (entity.kind === "crew" || entity.kind === "crewCapsule") {
      const crew = this.createCrewModel(this.materials.body, this.materials.visor, this.materials.pack, entity.kind === "crewCapsule" ? 1.12 : 0.82);
      crew.position.set(entity.x, 0.48, entity.z);
      return crew;
    }
    if (entity.kind === "coin" || entity.kind === "gem") {
      const material = entity.kind === "gem" ? this.materials.gem : this.materials.coin;
      const mesh = new THREE.Mesh(entity.kind === "gem" ? this.geometries.cone : this.geometries.cylinder, material);
      mesh.position.set(entity.x, 0.65, entity.z);
      mesh.scale.set(entity.kind === "gem" ? 0.48 : 0.36, entity.kind === "gem" ? 0.58 : 0.1, entity.kind === "gem" ? 0.48 : 0.36);
      mesh.rotation.z = entity.kind === "gem" ? Math.PI : Math.PI / 2;
      mesh.castShadow = true;
      return mesh;
    }
    if (
      entity.kind === "shield" ||
      entity.kind === "magnet" ||
      entity.kind === "frenzy" ||
      entity.kind === "commander" ||
      entity.kind === "ticket" ||
      entity.kind === "bossBomb" ||
      entity.kind === "jumpPad" ||
      entity.kind === "colorPad"
    ) {
      return this.createPowerupMesh(entity);
    }
    return this.createHazardMesh(entity);
  }

  private createGateMesh(entity: LevelEntity): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(entity.x, 0, entity.z);
    const gate = this.getGateState(entity);
    const helpful = entity.kind === "colorGate" || gate.helpful;
    const width = entity.width ?? 2.5;
    const gateColor = helpful ? 0x58f29a : 0xff5a5f;
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: gateColor,
      roughness: 0.2,
      transparent: true,
      opacity: 0.28,
      emissive: gateColor,
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(width + 0.54, 2.42, 0.08), glowMaterial);
    glow.position.set(0, 1.28, 0.06);
    this.setPulse(glow, 0.035, 3.8, entity.z * 0.1);
    group.add(glow);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width, 2.15, 0.18), helpful ? this.materials.gateGood : this.materials.gateBad);
    panel.position.y = 1.25;
    panel.castShadow = true;
    group.add(panel);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.24, 0.32), this.materials.gatePost);
    topBar.position.set(0, 2.38, 0);
    topBar.castShadow = true;
    group.add(topBar);
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.08, 28), this.materials.gatePost);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0, 2.78, 0.02);
    badge.castShadow = true;
    group.add(badge);
    [-width / 2, width / 2].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.55, 0.3), this.materials.gatePost);
      post.position.set(x, 1.15, 0);
      post.castShadow = true;
      group.add(post);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), helpful ? this.materials.gateGood : this.materials.gateBad);
      bulb.position.set(x, 2.56, -0.02);
      bulb.castShadow = true;
      this.setPulse(bulb, 0.18, 4.3, entity.z + x);
      group.add(bulb);
    });
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color: gateColor,
      roughness: 0.42,
      transparent: true,
      opacity: 0.52,
      emissive: gateColor,
      emissiveIntensity: 0.1
    });
    for (let index = -1; index <= 1; index += 1) {
      const chevron = new THREE.Mesh(new THREE.BoxGeometry(width * 0.22, 0.035, 0.12), arrowMaterial);
      chevron.position.set(index * width * 0.18, 0.095, -0.7 - Math.abs(index) * 0.08);
      chevron.rotation.y = index * 0.24;
      this.setPulse(chevron, 0.08, 5.5, entity.z + index);
      group.add(chevron);
    }
    const label = this.makeTextSprite(entity.kind === "colorGate" ? `${(entity.color ?? "cyan").toUpperCase()}` : gate.label, helpful ? "#0d8f52" : "#b82032", "#ffffff");
    label.position.set(0, 2.75, -0.08);
    label.scale.set(2.4, 0.86, 1);
    group.userData.label = label;
    group.userData.labelText = entity.kind === "colorGate" ? `${(entity.color ?? "cyan").toUpperCase()}` : gate.label;
    group.add(label);
    return group;
  }

  private createWeakPointGateMesh(entity: LevelEntity): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(entity.x, 0, entity.z);
    const width = entity.width ?? 2.55;
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc857,
      roughness: 0.22,
      transparent: true,
      opacity: 0.34,
      emissive: 0xffc857,
      emissiveIntensity: 0.32,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(width + 0.44, 2.34, 0.08), glowMaterial);
    glow.position.set(0, 1.24, 0.05);
    this.setPulse(glow, 0.045, 4.6, entity.z * 0.12);
    group.add(glow);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width, 2.05, 0.16), this.materials.hazard);
    frame.position.y = 1.18;
    frame.castShadow = true;
    group.add(frame);
    const core = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.055, 10, 36), this.materials.bossGold);
    core.position.set(0, 1.32, -0.12);
    core.userData.spinZ = 1.4;
    group.add(core);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10), this.materials.bossGold);
    dot.position.set(0, 1.32, -0.12);
    this.setPulse(dot, 0.16, 5.2, entity.z);
    group.add(dot);
    [-width / 2, width / 2].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.46, 0.28), this.materials.hazardDark);
      post.position.set(x, 1.1, 0);
      post.castShadow = true;
      group.add(post);
    });
    const label = this.makeTextSprite(`WEAK +${entity.value ?? 1}`, "#3c1642", "#ffffff");
    label.position.set(0, 2.62, -0.1);
    label.scale.set(1.62, 0.45, 1);
    group.add(label);
    return group;
  }

  private createEnemyMesh(entity: LevelEntity): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(entity.x, 0, entity.z);
    const count = Math.min(entity.count ?? 8, 28);
    const strength = entity.strength ?? 1;
    const variant = strength >= 2 ? "armored" : (entity.count ?? count) >= 36 ? "guard" : "scout";
    const bodyColor = variant === "armored" ? 0x5b21b6 : variant === "guard" ? 0xf97316 : 0xf05252;
    const packColor = variant === "armored" ? 0x111827 : variant === "guard" ? 0x7f1d1d : 0x3c1642;
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.58, metalness: variant === "armored" ? 0.1 : 0.04 });
    const visorMaterial = new THREE.MeshStandardMaterial({ color: variant === "armored" ? 0xfef08a : 0x231942, roughness: 0.24, metalness: 0.12 });
    const packMaterial = new THREE.MeshStandardMaterial({ color: packColor, roughness: 0.56, metalness: 0.08 });
    const armorMaterial = new THREE.MeshStandardMaterial({ color: variant === "armored" ? 0xd1d5db : 0xffd166, roughness: 0.36, metalness: 0.28 });
    const battleRing = new THREE.Mesh(new THREE.TorusGeometry((entity.width ?? 3.4) * 0.46, 0.028, 8, 44), variant === "scout" ? this.materials.warning : armorMaterial);
    battleRing.rotation.x = Math.PI / 2;
    battleRing.position.y = 0.08;
    battleRing.position.z = -0.3;
    battleRing.userData.spin = variant === "armored" ? -0.75 : 0.55;
    group.add(battleRing);
    const models: THREE.Object3D[] = [];
    const perRow = Math.ceil(Math.sqrt(count) * 1.35);
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const rowCount = Math.min(perRow, count - row * perRow);
      const model = this.createCrewModel(bodyMaterial, visorMaterial, packMaterial, variant === "scout" ? 0.64 : 0.69);
      model.position.set((col - (rowCount - 1) / 2) * 0.46, 0.38, -row * 0.42);
      model.userData.baseX = model.position.x;
      model.userData.baseZ = model.position.z;
      model.userData.phase = index * 0.73;
      if (variant !== "scout") {
        const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.36), armorMaterial);
        helmet.position.set(0, 0.84, 0.02);
        helmet.castShadow = true;
        model.add(helmet);
      }
      if (variant === "armored" && index % 3 === 0) {
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 18), armorMaterial);
        shield.rotation.x = Math.PI / 2;
        shield.position.set(index % 2 ? -0.28 : 0.28, 0.49, 0.38);
        shield.castShadow = true;
        model.add(shield);
      }
      if (index === 0 && variant !== "scout") {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), armorMaterial);
        pole.position.set(0.38, 0.9, -0.1);
        pole.castShadow = true;
        model.add(pole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.04), variant === "armored" ? this.materials.hazardDark : this.materials.bossGold);
        flag.position.set(0.58, 1.18, -0.1);
        flag.castShadow = true;
        model.add(flag);
      }
      models.push(model);
      group.add(model);
    }
    const label = this.makeTextSprite(`${entity.count ?? count}`, variant === "armored" ? "#111827" : "#3c1642", "#ffffff");
    label.position.set(0, 1.9, -0.6);
    label.scale.set(1.5, 0.55, 1);
    group.add(label);
    if (variant !== "scout") {
      const badge = this.makeTextSprite(variant === "armored" ? "ARMOR" : "GUARD", "#ffffff", variant === "armored" ? "#111827" : "#7f1d1d");
      badge.position.set(0, 2.34, -0.58);
      badge.scale.set(1.08, 0.32, 1);
      group.add(badge);
    }
    group.userData.enemyVariant = variant;
    group.userData.enemyModels = models;
    group.userData.enemyRing = battleRing;
    group.userData.enemyLabel = label;
    return group;
  }

  private createEnemyGateMesh(entity: LevelEntity): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(entity.x, 0, entity.z);
    const width = entity.width ?? 3.1;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width, 2.2, 0.2), this.materials.gateBad);
    frame.position.y = 1.18;
    frame.castShadow = true;
    group.add(frame);
    const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.45, 0.32, 0.34), this.materials.hazardDark);
    top.position.y = 2.42;
    top.castShadow = true;
    group.add(top);
    [-width / 2, width / 2].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.58, 0.34), this.materials.hazardDark);
      post.position.set(x, 1.16, 0);
      post.castShadow = true;
      group.add(post);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), this.materials.hazard);
      light.position.set(x, 2.66, -0.02);
      light.userData.blinkSpeed = 7;
      light.userData.blinkPhase = entity.z + x;
      group.add(light);
    });
    const label = this.makeTextSprite(`ENEMY ${entity.count ?? 18}`, "#7f1d1d", "#ffffff");
    label.position.set(0, 2.86, -0.08);
    label.scale.set(1.8, 0.45, 1);
    group.userData.enemyLabel = label;
    group.add(label);
    const spawnLabel = this.makeTextSprite("SPAWN", "#ffffff", "#7f1d1d");
    spawnLabel.position.set(0, 0.64, -0.18);
    spawnLabel.scale.set(1.18, 0.34, 1);
    group.add(spawnLabel);

    const models: THREE.Object3D[] = [];
    const count = Math.min(entity.count ?? 18, 22);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xf05252, roughness: 0.58, metalness: 0.04 });
    const visorMaterial = new THREE.MeshStandardMaterial({ color: 0x231942, roughness: 0.24, metalness: 0.12 });
    const packMaterial = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.56, metalness: 0.08 });
    const perRow = Math.ceil(Math.sqrt(count) * 1.25);
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const rowCount = Math.min(perRow, count - row * perRow);
      const model = this.createCrewModel(bodyMaterial, visorMaterial, packMaterial, 0.58);
      model.position.set((col - (rowCount - 1) / 2) * 0.4, 0.36, 0.65 + row * 0.34);
      model.userData.baseX = model.position.x;
      model.userData.baseZ = model.position.z;
      model.userData.phase = index * 0.61;
      models.push(model);
      group.add(model);
    }
    const battleRing = new THREE.Mesh(new THREE.TorusGeometry(width * 0.42, 0.028, 8, 44), this.materials.hazard);
    battleRing.rotation.x = Math.PI / 2;
    battleRing.position.set(0, 0.1, 0.42);
    battleRing.userData.spin = 0.9;
    group.userData.enemyRing = battleRing;
    group.userData.enemyVariant = "spawner";
    group.userData.enemyModels = models;
    group.add(battleRing);
    return group;
  }

  private createPowerupMesh(entity: LevelEntity): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(entity.x, 0.72, entity.z);
    if (entity.kind === "jumpPad") {
      group.position.y = 0.18;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.16, 0.9), this.materials.warning);
      base.castShadow = true;
      group.add(base);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.08, 0.16), this.materials.gatePost);
      lip.position.set(0, 0.13, -0.32);
      lip.castShadow = true;
      group.add(lip);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 3), this.materials.trackDark);
      arrow.rotation.x = Math.PI / 2;
      arrow.position.set(0, 0.13, 0.08);
      group.add(arrow);
      const label = this.makeTextSprite("JUMP", "#ffca3a", "#102033");
      label.position.y = 0.82;
      label.scale.set(0.88, 0.3, 1);
      group.add(label);
      return group;
    }
    const materialByKind = {
      shield: this.materials.shield,
      magnet: this.materials.magnet,
      frenzy: this.materials.frenzy,
      commander: this.materials.bossGold,
      ticket: this.materials.gem,
      bossBomb: this.materials.hazard,
      colorPad: new THREE.MeshStandardMaterial({ color: this.teamColors[entity.color ?? "cyan"], roughness: 0.42, metalness: 0.08 })
    };
    const material = materialByKind[entity.kind as keyof typeof materialByKind] ?? this.materials.gem;
    const mesh =
      entity.kind === "shield"
        ? new THREE.Mesh(this.geometries.torus, material)
        : entity.kind === "bossBomb"
          ? new THREE.Mesh(this.geometries.sphere, material)
          : new THREE.Mesh(this.geometries.cube, material);
    mesh.scale.setScalar(entity.kind === "bossBomb" ? 0.6 : 0.52);
    mesh.castShadow = true;
    group.add(mesh);
    if (entity.kind === "commander") {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), this.materials.gatePost);
      pole.position.set(0, 0.16, -0.28);
      pole.castShadow = true;
      group.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.32, 0.05), this.materials.bossGold);
      flag.position.set(0.28, 0.44, -0.28);
      flag.castShadow = true;
      flag.userData.floatBaseY = flag.position.y;
      flag.userData.floatPhase = entity.z * 0.1;
      group.add(flag);
    }
    const labelMap: Record<string, string> = { shield: "SH", magnet: "MG", frenzy: "FR", commander: "CMD", ticket: "TK", bossBomb: "B", colorPad: (entity.color ?? "cyan").slice(0, 2).toUpperCase() };
    const label = this.makeTextSprite(labelMap[entity.kind] ?? "?", "#1f2937", "#ffffff");
    label.position.y = 0.72;
    label.scale.set(0.9, 0.34, 1);
    group.add(label);
    return group;
  }

  private createHazardMesh(entity: LevelEntity): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(entity.x, 0, entity.z);
    const warning = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 2.2, 0.04, entity.depth ?? 2), this.materials.warning);
    warning.position.y = 0.08;
    group.add(warning);
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.74, transparent: true, opacity: 0.5 });
    const sparkMaterial = new THREE.MeshStandardMaterial({ color: 0xffca3a, roughness: 0.34, metalness: 0.12, emissive: 0xff9f1c, emissiveIntensity: 0.25 });
    const dustMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, opacity: 0.38 });
    const stripeCount = Math.min(6, Math.max(2, Math.ceil((entity.width ?? 2.2) * 1.2)));
    for (let index = 0; index < stripeCount; index += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, (entity.depth ?? 2) * 0.86), stripeMaterial);
      stripe.position.set((-0.5 + (index + 0.5) / stripeCount) * (entity.width ?? 2.2), 0.115, 0);
      stripe.rotation.y = 0.42;
      group.add(stripe);
    }

    if (entity.kind === "sideScraper") {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.35, entity.depth ?? 4), this.materials.hazard);
      wall.position.set(Math.sign(entity.x || 1) * 0.18, 0.72, 0);
      wall.castShadow = true;
      group.add(wall);
      for (let index = 0; index < 5; index += 1) {
        const spark = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), sparkMaterial);
        spark.position.set(Math.sign(entity.x || 1) * 0.38, 0.34 + index * 0.2, -1.4 + index * 0.7);
        spark.rotation.z = Math.PI / 2;
        spark.userData.blinkSpeed = 7 + index;
        spark.userData.blinkPhase = index * 0.8;
        this.setPulse(spark, 0.18, 5.2, index);
        group.add(spark);
      }
    } else if (entity.kind === "bumper") {
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 2.2, 0.38, entity.depth ?? 1.1), this.materials.hazard);
      bumper.position.y = 0.3;
      bumper.castShadow = true;
      group.add(bumper);
      [-1, 1].forEach((side) => {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, entity.depth ?? 1.1), this.materials.gatePost);
        cap.position.set(side * ((entity.width ?? 2.2) / 2 + 0.05), 0.32, 0);
        cap.castShadow = true;
        group.add(cap);
      });
    } else if (entity.kind === "rotatingBar") {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 5.6, 0.22, 0.36), this.materials.hazard);
      bar.position.y = 0.7;
      bar.castShadow = true;
      group.add(bar);
      [-1, 1].forEach((side) => {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), this.materials.hazardDark);
        cap.position.set(side * ((entity.width ?? 5.6) / 2 + 0.02), 0.7, 0);
        cap.castShadow = true;
        group.add(cap);
      });
    } else if (entity.kind === "sawLane") {
      const saw = new THREE.Mesh(this.geometries.cylinder, this.materials.hazard);
      saw.rotation.z = Math.PI / 2;
      saw.position.y = 0.28;
      saw.scale.set(0.72, 0.16, 0.72);
      saw.castShadow = true;
      group.userData.saw = saw;
      group.add(saw);
      const teeth = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.055, 8, 18), this.materials.hazardDark);
      teeth.rotation.z = Math.PI / 2;
      saw.add(teeth);
      for (let index = 0; index < 10; index += 1) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 4), this.materials.hazardDark);
        const angle = (index / 10) * Math.PI * 2;
        tooth.position.set(Math.cos(angle) * 0.52, Math.sin(angle) * 0.52, 0);
        tooth.rotation.z = angle - Math.PI / 2;
        tooth.castShadow = true;
        saw.add(tooth);
      }
    } else if (entity.kind === "crusher") {
      const hammer = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 2, 0.45, entity.depth ?? 2), this.materials.hazard);
      hammer.position.y = 2.15;
      hammer.castShadow = true;
      group.userData.crusherHammer = hammer;
      group.add(hammer);
      [-1, 1].forEach((side) => {
        const guide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), this.materials.hazardDark);
        guide.position.set(side * ((entity.width ?? 2) / 2 + 0.26), 1.12, 0);
        guide.castShadow = true;
        group.add(guide);
      });
      for (let index = 0; index < 4; index += 1) {
        const dust = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), dustMaterial);
        dust.position.set(-0.48 + index * 0.32, 0.16, (index % 2 ? 0.34 : -0.34));
        this.setPulse(dust, 0.28, 8, index);
        group.add(dust);
      }
    } else if (entity.kind === "swingingAxe") {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 0.15), this.materials.hazardDark);
      arm.position.y = 1.42;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 1.15, 0.46, 0.16), this.materials.hazard);
      blade.position.y = 0.48;
      blade.castShadow = true;
      arm.add(blade);
      const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), this.materials.bossGold);
      pivot.position.y = 2.34;
      group.add(pivot);
      group.add(arm);
    } else if (entity.kind === "spikeRoller") {
      const roller = new THREE.Mesh(this.geometries.cylinder, this.materials.hazard);
      roller.rotation.z = Math.PI / 2;
      roller.position.y = 0.42;
      roller.scale.set(0.58, entity.width ?? 1.9, 0.58);
      roller.castShadow = true;
      group.add(roller);
      for (let index = 0; index < 8; index += 1) {
        const spike = new THREE.Mesh(this.geometries.cone, this.materials.hazardDark);
        spike.position.set(Math.sin(index) * 0.42, 0.42 + Math.cos(index) * 0.42, 0);
        spike.scale.setScalar(0.28);
        roller.add(spike);
      }
    } else if (entity.kind === "cannon") {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.8), this.materials.hazardDark);
      base.position.set(Math.sign(entity.x || 1) * 0.2, 0.48, 0);
      group.add(base);
      const barrel = new THREE.Mesh(this.geometries.cylinder, this.materials.hazard);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(Math.sign(entity.x || 1) * 0.62, 0.62, 0);
      barrel.scale.set(0.22, 0.72, 0.22);
      group.add(barrel);
      const ball = new THREE.Mesh(this.geometries.sphere, this.materials.hazard);
      ball.position.set(0, 0.56, 0);
      ball.scale.setScalar(0.34);
      group.userData.ball = ball;
      group.add(ball);
      const flash = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.38, 8), sparkMaterial);
      flash.rotation.z = -Math.sign(entity.x || 1) * Math.PI / 2;
      flash.position.set(Math.sign(entity.x || 1) * 1.06, 0.62, 0);
      flash.userData.blinkSpeed = 9;
      flash.userData.blinkPhase = entity.z;
      group.add(flash);
    } else if (entity.kind === "laser") {
      const beamGlow = new THREE.Mesh(
        new THREE.BoxGeometry(entity.width ?? 5.8, 0.34, 0.34),
        new THREE.MeshStandardMaterial({ color: 0xef476f, roughness: 0.2, transparent: true, opacity: 0.28, emissive: 0xef476f, emissiveIntensity: 0.4 })
      );
      beamGlow.position.y = 0.85;
      group.userData.laserGlow = beamGlow;
      group.add(beamGlow);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 5.8, 0.18, 0.18), this.materials.hazard);
      beam.position.y = 0.85;
      group.userData.laserBeam = beam;
      group.add(beam);
      [-1, 1].forEach((side) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.36, 0.28), this.materials.hazardDark);
        post.position.set(side * ((entity.width ?? 5.8) / 2 + 0.16), 0.65, 0);
        post.castShadow = true;
        group.add(post);
      });
    } else if (entity.kind === "hole") {
      const hole = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 2.2, 0.05, entity.depth ?? 3), this.materials.hazardDark);
      hole.position.y = 0.06;
      group.add(hole);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.055, 8, 34), this.materials.warning);
      rim.scale.set((entity.width ?? 2.2) * 0.65, 1, (entity.depth ?? 3) * 0.42);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.13;
      group.add(rim);
    } else if (entity.kind === "fan") {
      const fan = new THREE.Mesh(this.geometries.cylinder, this.materials.hazardDark);
      fan.rotation.z = Math.PI / 2;
      fan.position.y = 0.75;
      fan.scale.set(0.6, 0.22, 0.6);
      group.userData.fan = fan;
      group.add(fan);
      for (let index = 0; index < 4; index += 1) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.07, 0.14), this.materials.gatePost);
        blade.rotation.z = (index / 4) * Math.PI * 2;
        blade.position.y = 0.01;
        fan.add(blade);
      }
    } else {
      const block = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 2, 0.18, entity.depth ?? 2), this.materials.hazard);
      block.position.y = 0.14;
      group.add(block);
    }
    return group;
  }

  private createCrewModel(
    bodyMaterial: THREE.Material,
    visorMaterial: THREE.Material,
    packMaterial: THREE.Material,
    scale = 1
  ): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.geometries.body, bodyMaterial);
    body.position.y = 0.48 * scale;
    body.scale.setScalar(scale);
    body.castShadow = true;
    group.add(body);

    const highlight = new THREE.Mesh(this.geometries.bodyHighlight, this.materials.bodyHighlight);
    highlight.position.set(-0.12 * scale, 0.56 * scale, 0.28 * scale);
    highlight.scale.setScalar(scale);
    group.add(highlight);

    const visor = new THREE.Mesh(this.geometries.visor, visorMaterial);
    visor.position.set(0, 0.62 * scale, 0.27 * scale);
    visor.scale.setScalar(scale);
    visor.castShadow = true;
    group.add(visor);

    const pack = new THREE.Mesh(this.geometries.pack, packMaterial);
    pack.position.set(0, 0.46 * scale, -0.33 * scale);
    pack.scale.setScalar(scale);
    pack.castShadow = true;
    group.add(pack);

    [-0.13, 0.13].forEach((x) => {
      const leg = new THREE.Mesh(this.geometries.leg, bodyMaterial);
      leg.position.set(x * scale, 0.14 * scale, 0);
      leg.scale.setScalar(scale);
      leg.castShadow = true;
      group.add(leg);
    });
    return group;
  }

  private createStairs(zStart: number): void {
    this.stairsGroup.clear();
    this.stairScoreMarker = null;
    this.stairsGroup.position.set(0, 0, zStart);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.8, 1.3), this.materials.castle);
    tower.position.set(0, 1.3, 23);
    tower.castShadow = true;
    this.stairsGroup.add(tower);
    this.stairVault = new THREE.Group();
    const vaultBase = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.88, 1.2), this.materials.bossGold);
    vaultBase.position.y = 0.12;
    vaultBase.castShadow = true;
    this.stairVault.add(vaultBase);
    const vaultLid = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.34, 1.28), this.materials.hazard);
    vaultLid.position.set(0, 0.68, -0.04);
    vaultLid.castShadow = true;
    this.stairVault.add(vaultLid);
    this.stairVault.userData.lid = vaultLid;
    for (let index = 0; index < 7; index += 1) {
      const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), index % 2 ? this.materials.gem : this.materials.coin);
      gem.position.set((index - 3) * 0.25, 0.98 + Math.sin(index) * 0.08, 0.12 + Math.cos(index) * 0.18);
      gem.castShadow = true;
      this.stairVault.add(gem);
    }
    const vaultLabel = this.makeTextSprite("VAULT", "#ffffff", "#102033");
    vaultLabel.position.set(0, 1.28, -0.08);
    vaultLabel.scale.set(1.05, 0.3, 1);
    this.stairVault.add(vaultLabel);
    this.stairVault.position.set(0, 3.0, 22.85);
    this.stairsGroup.add(this.stairVault);
    const stairColors = [0x58f29a, 0x7bdff2, 0xffd166, 0xff9f1c, 0xef476f, 0x9b5de5];
    for (let index = 0; index < 24; index += 1) {
      const multiplier = 1 + Math.floor(index / 4);
      const width = 4.8 - Math.min(index * 0.08, 1.2);
      const material = new THREE.MeshStandardMaterial({
        color: stairColors[Math.min(multiplier - 1, stairColors.length - 1)],
        roughness: 0.56,
        metalness: 0.05
      });
      const step = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.72), material);
      step.position.set(0, index * 0.16, index * 0.76);
      step.receiveShadow = true;
      step.castShadow = true;
      this.stairsGroup.add(step);
      if (index % 2 === 0 || index >= 18) {
        const label = this.makeTextSprite(`x${multiplier}`, "#ffffff", "#102033");
        label.position.set(0, index * 0.16 + 0.31, index * 0.76 - 0.08);
        label.scale.set(0.94, 0.34, 1);
        this.stairsGroup.add(label);
      }
      if (index % 4 === 3) {
        const banner = this.makeTextSprite(`SCORE x${multiplier}`, "#13223a", "#ffffff");
        banner.position.set(2.78, index * 0.16 + 0.72, index * 0.76);
        banner.scale.set(1.42, 0.4, 1);
        this.stairsGroup.add(banner);
      }
    }
    [-2.72, 2.72].forEach((x) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 18.5), this.materials.gatePost);
      rail.position.set(x, 2.12, 8.7);
      rail.rotation.x = -0.22;
      rail.castShadow = true;
      this.stairsGroup.add(rail);
    });
    this.stairScoreMarker = new THREE.Group();
    const markerBase = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 4), this.materials.bossGold);
    markerBase.rotation.y = Math.PI / 4;
    markerBase.castShadow = true;
    this.stairScoreMarker.add(markerBase);
    const markerLabel = this.makeTextSprite("SCORE", "#ffca3a", "#102033");
    markerLabel.position.set(0, 0.62, 0);
    markerLabel.scale.set(0.88, 0.26, 1);
    this.stairScoreMarker.add(markerLabel);
    this.stairScoreMarker.position.set(-2.95, 0.6, 0);
    this.stairsGroup.add(this.stairScoreMarker);
    this.world.add(this.stairsGroup);
  }

  private createBossArena(): void {
    this.bossGroup.clear();
    this.bossTelegraph = null;
    this.bossWeapon = null;
    this.bossRightArm = null;
    this.bossLeftArm = null;
    this.bossRightHand = null;
    this.bossBody = null;
    this.bossCrown = null;
    this.bossGate = null;
    const z = this.level.length + 12;
    this.bossGroup.position.set(0, 0, z);
    this.bossGroup.rotation.set(0, 0, 0);
    this.bossGroup.scale.setScalar(1);
    const arenaMaterial = this.level.boss?.arenaColor
      ? new THREE.MeshStandardMaterial({ color: this.level.boss.arenaColor, roughness: 0.76, metalness: 0.03 })
      : this.materials.trackDark;
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.34, 48), arenaMaterial);
    arena.position.y = -0.04;
    arena.receiveShadow = true;
    this.bossGroup.add(arena);
    this.createBossArenaDressing();

    this.bossTelegraph = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 6.4), this.materials.warning);
    this.bossTelegraph.position.set(0, 0.16, -3.4);
    this.bossTelegraph.visible = false;
    this.bossGroup.add(this.bossTelegraph);

    const bossMaterial = this.level.boss?.bodyColor
      ? new THREE.MeshStandardMaterial({ color: this.level.boss.bodyColor, roughness: 0.6, metalness: 0.04 })
      : this.materials.boss;
    this.bossBody = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 1.45, 12, 28), bossMaterial);
    this.bossBody.position.set(0, 1.65, 4.5);
    this.bossBody.castShadow = true;
    this.bossGroup.add(this.bossBody);
    const bossShadow = new THREE.Mesh(this.geometries.shadow, this.materials.contactShadow);
    bossShadow.position.set(0, 0.15, 4.42);
    bossShadow.rotation.x = -Math.PI / 2;
    bossShadow.scale.set(2.9, 1.85, 1);
    this.bossGroup.add(bossShadow);
    const bossHighlight = new THREE.Mesh(this.geometries.bodyHighlight, this.materials.bodyHighlight);
    bossHighlight.position.set(-0.42, 1.92, 3.43);
    bossHighlight.scale.set(2.35, 2.3, 1.3);
    this.bossGroup.add(bossHighlight);
    [-1, 1].forEach((side) => {
      const shoulder = new THREE.Mesh(this.geometries.sphere, this.materials.bossGold);
      shoulder.position.set(side * 0.86, 2.18, 4.1);
      shoulder.scale.set(0.42, 0.2, 0.34);
      shoulder.castShadow = true;
      this.bossGroup.add(shoulder);
    });
    this.bossWeakCore = new THREE.Group();
    this.bossWeakCore.visible = false;
    this.bossWeakCore.position.set(0, 0.04, -1.02);
    const weakRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 10, 32), this.materials.bossGold);
    weakRing.userData.spinZ = 1.6;
    this.bossWeakCore.add(weakRing);
    const weakDot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), this.materials.hazard);
    weakDot.position.z = -0.02;
    this.setPulse(weakDot, 0.16, 5.2, this.level.id);
    this.bossWeakCore.add(weakDot);
    this.bossBody.add(this.bossWeakCore);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.42, 0.12), this.materials.visor);
    visor.position.set(0, 1.95, 3.42);
    this.bossGroup.add(visor);

    this.bossLeftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.72, 8, 14), bossMaterial);
    this.bossLeftArm.position.set(-0.98, 1.62, 4.05);
    this.bossLeftArm.rotation.z = 0.62;
    this.bossLeftArm.castShadow = true;
    this.bossGroup.add(this.bossLeftArm);

    this.bossRightArm = new THREE.Group();
    this.bossRightArm.position.set(0.78, 2.02, 4.08);
    this.bossRightArm.rotation.z = -0.32;
    const rightUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.68, 8, 14), bossMaterial);
    rightUpperArm.position.y = -0.34;
    rightUpperArm.rotation.z = -0.14;
    rightUpperArm.castShadow = true;
    this.bossRightArm.add(rightUpperArm);
    this.bossRightHand = new THREE.Group();
    this.bossRightHand.position.set(0.24, -0.78, -0.34);
    this.bossRightHand.rotation.z = -0.42;
    const rightForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.58, 8, 14), bossMaterial);
    rightForearm.position.y = -0.24;
    rightForearm.rotation.z = -0.12;
    rightForearm.castShadow = true;
    this.bossRightHand.add(rightForearm);
    const rightFist = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), bossMaterial);
    rightFist.position.set(0.03, -0.62, -0.08);
    rightFist.castShadow = true;
    this.bossRightHand.add(rightFist);
    this.bossRightArm.add(this.bossRightHand);
    this.bossGroup.add(this.bossRightArm);

    this.bossWeapon = new THREE.Group();
    this.bossWeapon.position.set(0.1, -0.62, -0.36);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.75, 12), this.materials.hazardDark);
    handle.rotation.x = Math.PI / 2;
    handle.position.z = -0.86;
    handle.castShadow = true;
    this.bossWeapon.add(handle);
    let head: THREE.Object3D;
    if (this.level.boss?.attackKind === "sweep") {
      head = new THREE.Group();
      const mace = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), this.materials.hazard);
      mace.castShadow = true;
      head.add(mace);
      [-1, 1].forEach((side) => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 8), this.materials.hazard);
        spike.rotation.z = side * Math.PI / 2;
        spike.position.x = side * 0.44;
        spike.castShadow = true;
        head.add(spike);
      });
    } else {
      head =
        this.level.boss?.attackKind === "minions"
          ? new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.9, 6), this.materials.hazard)
          : new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.56, 0.62), this.materials.hazard);
    }
    head.position.z = -1.72;
    if (this.level.boss?.attackKind === "minions") {
      head.rotation.x = -Math.PI / 2;
    }
    if (head instanceof THREE.Mesh) {
      head.castShadow = true;
    }
    this.bossWeapon.add(head);
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 18), bossMaterial);
    grip.position.z = -0.08;
    grip.castShadow = true;
    this.bossWeapon.add(grip);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), this.materials.bossGold);
    pommel.position.z = 0.14;
    pommel.castShadow = true;
    this.bossWeapon.add(pommel);
    this.bossWeapon.rotation.z = -0.24;
    this.bossRightHand.add(this.bossWeapon);

    this.bossCrown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.9, 5), this.materials.bossGold);
    this.bossCrown.position.set(0, 3, 4.5);
    this.bossCrown.rotation.y = Math.PI / 5;
    this.bossCrown.castShadow = true;
    this.bossGroup.add(this.bossCrown);

    const castleGate = new THREE.Group();
    castleGate.position.set(0, 0, 8);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.2, 0.5), this.materials.castle);
    backWall.position.set(0, 1.42, 0.16);
    backWall.castShadow = true;
    castleGate.add(backWall);
    const archShadow = new THREE.Mesh(new THREE.BoxGeometry(2.38, 2.56, 0.16), this.materials.hazardDark);
    archShadow.position.set(0, 1.14, -0.18);
    castleGate.add(archShadow);
    const leftDoorGroup = new THREE.Group();
    leftDoorGroup.position.set(-0.04, 0, -0.36);
    const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.34, 0.18), this.materials.trackDark);
    leftDoor.position.set(-0.56, 1.14, 0);
    leftDoor.castShadow = true;
    leftDoorGroup.add(leftDoor);
    const rightDoorGroup = new THREE.Group();
    rightDoorGroup.position.set(0.04, 0, -0.36);
    const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.34, 0.18), this.materials.trackDark);
    rightDoor.position.set(0.56, 1.14, 0);
    rightDoor.castShadow = true;
    rightDoorGroup.add(rightDoor);
    castleGate.add(leftDoorGroup, rightDoorGroup);
    const portcullis = new THREE.Group();
    portcullis.position.set(0, 1.18, -0.48);
    for (let index = -2; index <= 2; index += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.42, 0.08), this.materials.bossGold);
      bar.position.x = index * 0.44;
      bar.castShadow = true;
      portcullis.add(bar);
    }
    const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.08, 0.08), this.materials.bossGold);
    bottomRail.position.y = -1.12;
    portcullis.add(bottomRail);
    castleGate.add(portcullis);
    for (let index = -2; index <= 2; index += 1) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.58), this.materials.castle);
      block.position.set(index * 1.08, 3.22, 0.12);
      block.castShadow = true;
      castleGate.add(block);
    }
    [-1, 1].forEach((side) => {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.64, 3.82, 12), this.materials.castle);
      tower.position.set(side * 3.05, 1.72, 0.08);
      tower.castShadow = true;
      castleGate.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.74, 0.78, 6), this.materials.bossGold);
      roof.position.set(side * 3.05, 3.98, 0.08);
      roof.castShadow = true;
      castleGate.add(roof);
      const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.28, 0.05), side > 0 ? this.materials.hazard : this.materials.hazardDark);
      pennant.position.set(side * 3.28, 4.36, -0.18);
      pennant.userData.floatBaseY = pennant.position.y;
      pennant.userData.floatPhase = side * 1.4;
      castleGate.add(pennant);
    });
    const enemyBanner = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.5, 0.08), this.materials.hazard);
    enemyBanner.position.set(0, 2.94, -0.42);
    enemyBanner.castShadow = true;
    castleGate.add(enemyBanner);
    const victoryFlag = new THREE.Group();
    victoryFlag.visible = false;
    victoryFlag.position.set(-0.28, 3.05, -0.52);
    victoryFlag.scale.set(1, 0.01, 1);
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.38, 8), this.materials.gatePost);
    flagPole.position.y = 0.58;
    flagPole.castShadow = true;
    victoryFlag.add(flagPole);
    const flagBanner = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.44, 0.06), this.materials.gateGood);
    flagBanner.position.set(0.45, 1.02, 0);
    flagBanner.castShadow = true;
    victoryFlag.add(flagBanner);
    castleGate.add(victoryFlag);
    castleGate.userData.leftDoorGroup = leftDoorGroup;
    castleGate.userData.rightDoorGroup = rightDoorGroup;
    castleGate.userData.portcullis = portcullis;
    castleGate.userData.enemyBanner = enemyBanner;
    castleGate.userData.victoryFlag = victoryFlag;
    castleGate.userData.flagBanner = flagBanner;
    this.bossGate = castleGate;
    this.bossGroup.add(castleGate);
    const label = this.makeTextSprite(this.level.boss?.name ?? "BOSS", "#3c1642", "#ffffff");
    label.position.set(0, 3.75, 3.7);
    label.scale.set(2.3, 0.52, 1);
    this.bossGroup.add(label);
    this.world.add(this.bossGroup);
  }

  private createBossArenaDressing(): void {
    const attackKind = this.level.boss?.attackKind ?? "stomp";
    const accentColor = this.level.boss?.arenaColor ?? this.getLevelTheme().accent;
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.38,
      metalness: 0.08,
      emissive: accentColor,
      emissiveIntensity: 0.08
    });
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.3,
      transparent: true,
      opacity: 0.36,
      emissive: accentColor,
      emissiveIntensity: 0.22
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.78, metalness: 0.06 });

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(4.62, 0.055, 10, 96), accentMaterial);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = 0.18;
    outerRing.userData.spin = attackKind === "sweep" ? 0.35 : 0.12;
    this.setPulse(outerRing, 0.018, 2.4, this.level.id);
    this.bossGroup.add(outerRing);

    const centerSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.92, 0.055, 36), this.materials.bossGold);
    centerSeal.position.y = 0.18;
    centerSeal.castShadow = true;
    this.setPulse(centerSeal, 0.03, 2.8, this.level.id * 0.3);
    this.bossGroup.add(centerSeal);

    if (attackKind === "sweep") {
      for (let index = 0; index < 4; index += 1) {
        const lane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 7.2), glowMaterial);
        lane.position.y = 0.2;
        lane.rotation.y = (index / 4) * Math.PI;
        lane.userData.spin = 0.25;
        this.bossGroup.add(lane);
      }
      [-1, 1].forEach((side) => {
        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.36, 10), darkMaterial);
        pylon.position.set(side * 4.15, 0.62, 0.45);
        pylon.castShadow = true;
        this.bossGroup.add(pylon);
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 26), accentMaterial);
        coil.position.set(side * 4.15, 1.28, 0.45);
        coil.rotation.x = Math.PI / 2;
        coil.userData.spin = side * 1.6;
        this.setPulse(coil, 0.08, 4.2, side);
        this.bossGroup.add(coil);
      });
    } else if (attackKind === "minions") {
      [-1, 1].forEach((side) => {
        for (let index = 0; index < 2; index += 1) {
          const door = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.05, 0.2), darkMaterial);
          door.position.set(side * 4.1, 0.68, -1.35 + index * 2.2);
          door.rotation.y = -side * 0.72;
          door.castShadow = true;
          this.bossGroup.add(door);
          const signal = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.08), this.materials.hazard);
          signal.position.set(side * 4.0, 1.34, -1.35 + index * 2.2);
          signal.rotation.y = -side * 0.72;
          signal.userData.blinkSpeed = 5 + index;
          signal.userData.blinkPhase = side;
          this.bossGroup.add(signal);
        }
      });
      for (let index = 0; index < 7; index += 1) {
        const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.25, 5, 8), this.materials.hazard);
        const angle = (index / 7) * Math.PI * 2;
        pod.position.set(Math.cos(angle) * 3.25, 0.34, Math.sin(angle) * 2.2);
        pod.rotation.y = -angle;
        pod.castShadow = true;
        pod.userData.floatBaseY = pod.position.y;
        pod.userData.floatPhase = index * 0.6;
        this.bossGroup.add(pod);
      }
    } else {
      for (let index = 0; index < 7; index += 1) {
        const crack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 1.25 + (index % 3) * 0.32), darkMaterial);
        crack.position.set(-2.7 + index * 0.9, 0.19, -0.6 + Math.sin(index) * 1.4);
        crack.rotation.y = -0.65 + index * 0.22;
        this.bossGroup.add(crack);
      }
      [-1, 1].forEach((side) => {
        const statue = new THREE.Group();
        statue.position.set(side * 4.05, 0, 1.55);
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.34, 0.55), darkMaterial);
        base.position.y = 0.16;
        base.castShadow = true;
        statue.add(base);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.58, 5), this.materials.bossGold);
        crown.position.y = 0.74;
        crown.rotation.y = side * 0.4;
        crown.castShadow = true;
        statue.add(crown);
        statue.userData.floatBaseY = statue.position.y;
        statue.userData.floatPhase = side;
        this.bossGroup.add(statue);
      });
    }
  }

  private createRouletteWheel(z: number): void {
    this.rouletteGroup.clear();
    this.rouletteWheel = new THREE.Group();
    this.roulettePointer = null;
    this.rouletteHubGem = null;
    this.rouletteGlow = null;
    this.rouletteBulbs = [];
    this.roulettePrizeSprite = null;
    this.rouletteGroup.position.set(0, 1.48, z);

    const backing = new THREE.Mesh(new THREE.CylinderGeometry(2.36, 2.36, 0.18, 72), this.materials.gatePost);
    backing.rotation.x = Math.PI / 2;
    backing.position.z = 0.18;
    backing.castShadow = true;
    this.rouletteWheel.add(backing);

    const segmentAngle = (Math.PI * 2) / this.rouletteRewards.length;
    this.rouletteRewards.forEach((reward, index) => {
      const start = Math.PI / 2 - segmentAngle / 2 + index * segmentAngle;
      const end = start + segmentAngle;
      const segmentMaterial = new THREE.MeshStandardMaterial({
        color: reward.color,
        roughness: 0.48,
        metalness: 0.08,
        side: THREE.DoubleSide
      });
      const segment = new THREE.Mesh(this.makeWheelSegment(0.52, 2.14, start, end), segmentMaterial);
      segment.position.z = -0.08 - index * 0.001;
      segment.castShadow = true;
      this.rouletteWheel?.add(segment);

      const mid = start + segmentAngle / 2;
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.6, 0.08), this.materials.gatePost);
      divider.position.set(Math.cos(start) * 1.32, Math.sin(start) * 1.32, -0.16);
      divider.rotation.z = start - Math.PI / 2;
      this.rouletteWheel?.add(divider);

      const text = this.makeTextSprite(reward.shortLabel, "#ffffff", "#102033");
      text.position.set(Math.cos(mid) * 1.36, Math.sin(mid) * 1.36, -0.28);
      text.scale.set(reward.kind === "skin" ? 0.86 : 0.68, 0.25, 1);
      this.rouletteWheel?.add(text);
    });

    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.07, 10, 96), this.materials.bossGold);
    rim.position.z = -0.3;
    rim.castShadow = true;
    this.rouletteWheel.add(rim);
    for (let index = 0; index < 24; index += 1) {
      const angle = (index / 24) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), index % 2 ? this.materials.gem : this.materials.bossGold);
      bulb.position.set(Math.cos(angle) * 2.32, Math.sin(angle) * 2.32, -0.38);
      this.rouletteBulbs.push(bulb);
      this.rouletteWheel.add(bulb);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.28, 40), this.materials.bossGold);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = -0.4;
    hub.castShadow = true;
    this.rouletteWheel.add(hub);
    const hubGem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), this.materials.gem);
    hubGem.position.z = -0.6;
    this.rouletteHubGem = hubGem;
    this.rouletteWheel.add(hubGem);
    this.rouletteGroup.add(this.rouletteWheel);

    this.rouletteGlow = new THREE.Mesh(new THREE.TorusGeometry(2.34, 0.055, 10, 112), this.materials.rouletteGlow);
    this.rouletteGlow.position.z = -0.68;
    this.rouletteGlow.visible = false;
    this.rouletteGlow.renderOrder = 3;
    this.rouletteGroup.add(this.rouletteGlow);

    this.roulettePointer = new THREE.Group();
    this.roulettePointer.position.set(0, 2.38, -0.72);
    const pointerBase = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.28, 0.18), this.materials.hazardDark);
    pointerBase.position.set(0, 0.14, 0);
    pointerBase.castShadow = true;
    this.roulettePointer.add(pointerBase);
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.74, 3), this.materials.hazard);
    pointer.position.set(0, -0.15, -0.1);
    pointer.rotation.z = Math.PI;
    pointer.castShadow = true;
    this.roulettePointer.add(pointer);
    this.rouletteGroup.add(this.roulettePointer);

    const label = this.makeTextSprite("BONUS WHEEL", "#111827", "#ffffff");
    label.position.set(0, -2.66, -0.34);
    label.scale.set(2.1, 0.48, 1);
    this.rouletteGroup.add(label);
    this.world.add(this.rouletteGroup);
  }

  private tick(timeMs: number): void {
    const time = timeMs / 1000;
    const dt = Math.min(0.05, this.lastTime ? time - this.lastTime : 0.016);
    this.lastTime = time;

    this.updatePlatforms(time);
    this.updateDecorations(time, dt);
    this.animateEntities(time, dt);
    this.updateFloating(dt);
    this.crowdImpactPulse = Math.max(0, this.crowdImpactPulse - dt * 2.5);

    if (this.mode === "run") {
      this.updateRun(time, dt);
    } else if (this.mode === "battle") {
      this.updateBattle(time, dt);
    } else if (this.mode === "stairs") {
      this.updateStairs(dt);
    } else if (this.mode === "boss") {
      this.updateBoss(dt);
    } else if (this.mode === "bossVictory") {
      this.updateBossVictory(dt);
    } else if (this.mode === "roulette") {
      this.updateRoulette(dt);
    }

    this.updateCrowdInstances(time);
    this.updateStatusAuras(time);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateRun(time: number, dt: number): void {
    const keyboardSpeed = this.gooTimer > 0 ? (this.isTouchDevice ? 2.45 : 2.75) : this.isTouchDevice ? 3.65 : 4.15;
    this.targetX += this.keyboardX * keyboardSpeed * dt;

    const normalSpeed = this.isTouchDevice ? 10.05 : 10.85;
    const gooSpeed = this.isTouchDevice ? 6.85 : 7.35;
    const frenzySpeed = this.isTouchDevice ? 13.7 : 14.8;
    const targetSpeed = this.frenzyTimer > 0 ? frenzySpeed : this.gooTimer > 0 ? gooSpeed : normalSpeed;
    this.speed = damp(this.speed, targetSpeed, this.isTouchDevice ? 3.2 : 3.7, dt);
    this.distance += this.speed * dt;
    this.centerX = damp(this.centerX, this.targetX, this.gooTimer > 0 ? 5 : 8.4, dt);

    this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    this.frenzyTimer = Math.max(0, this.frenzyTimer - dt);
    this.commanderTimer = Math.max(0, this.commanderTimer - dt);
    this.jumpTimer = Math.max(0, this.jumpTimer - dt);
    this.gooTimer = Math.max(0, this.gooTimer - dt);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);

    this.applyTrackBounds(dt);
    this.checkEntities(time, dt);
    this.stats.score += dt * 22 + this.count * dt * 1.3;
    this.stats.maxCount = Math.max(this.stats.maxCount, this.count);
    this.hud.updateRun(this.level.id, clamp(this.distance / this.level.length, 0, 1), this.save, this.stats, this.count, this.shield);

    if (this.distance >= this.level.length) {
      if (this.level.kind === "boss") {
        this.startBoss();
      } else if (this.level.kind === "bonus") {
        this.startRoulette();
      } else {
        this.startStairs();
      }
    }
  }

  private applyTrackBounds(dt: number): void {
    const track = this.getTrackAt(this.distance);
    if (!track) {
      this.failRun("Fell");
      return;
    }
    const center = this.getTrackCenter(track.data, this.lastTime);
    const formation = this.formationRadius();
    const half = track.data.width / 2 - Math.min(formation, track.data.width * 0.38);
    this.targetX = clamp(this.targetX, center - half, center + half);
    this.centerX = clamp(this.centerX, center - half - 0.35, center + half + 0.35);
    if (Math.abs(this.centerX - center) > track.data.width / 2 + 0.2) {
      this.failRun("Fell");
    }
    if (track.data.kind === "conveyor") {
      this.targetX += (track.data.direction ?? 1) * 1.4 * dt;
    }
    if (track.data.kind === "turntable") {
      this.targetX += Math.sin(this.lastTime * (track.data.speed ?? 1.5) + (track.data.phase ?? 0)) * 0.9 * dt;
    }
    if (track.data.kind === "tilting") {
      const tilt = Math.sin(this.lastTime * (track.data.speed ?? 1.4) + (track.data.phase ?? 0));
      this.targetX += tilt * 0.92 * dt;
    }
    if (track.data.kind === "lift") {
      const drop = Math.max(0, -this.getTrackVerticalOffset(track.data, this.lastTime));
      this.speed = Math.max(6.5, this.speed - drop * 0.55 * dt);
    }
    if (track.data.kind === "collapsing" && !track.mesh.userData.triggered) {
      const progress = (this.distance - track.data.zStart) / Math.max(1, track.data.zEnd - track.data.zStart);
      if (progress > 0.48) {
        track.mesh.userData.triggered = true;
        this.loseCrew(2 + Math.floor(this.count * 0.05), "Collapse");
      }
    }
  }

  private getTrackAt(z: number): RuntimeTrack | null {
    const candidates = this.tracks.filter((track) => {
      const [zStart, zEnd] = this.getTrackZRange(track.data, this.lastTime);
      const zPadding = track.data.kind === "bridge" ? 0.85 : 0;
      return z >= zStart - zPadding && z <= zEnd + zPadding;
    });
    if (candidates.length === 0) {
      return null;
    }
    return candidates
      .map((track) => {
        const center = this.getTrackCenter(track.data, this.lastTime);
        const inside = Math.abs(this.centerX - center) <= track.data.width / 2 + 0.35;
        return { track, score: (inside ? 0 : 100) + Math.abs(this.centerX - center) };
      })
      .sort((a, b) => a.score - b.score)[0].track;
  }

  private getTrackCenter(segment: TrackSegment, time: number): number {
    const base = segment.x ?? 0;
    if (segment.kind === "moving" || segment.kind === "splitIsland") {
      return base + Math.sin(time * (segment.speed ?? 1.2) + (segment.phase ?? 0)) * (segment.amplitude ?? 1.4);
    }
    return base;
  }

  private getTrackZCenter(segment: TrackSegment, time: number): number {
    const base = (segment.zStart + segment.zEnd) / 2;
    if (segment.kind === "bridge") {
      return base + Math.sin(time * (segment.speed ?? 1.1) + (segment.phase ?? 0)) * (segment.amplitude ?? 2.4);
    }
    return base;
  }

  private getTrackZRange(segment: TrackSegment, time: number): [number, number] {
    const halfLength = (segment.zEnd - segment.zStart) / 2;
    const center = this.getTrackZCenter(segment, time);
    return [center - halfLength, center + halfLength];
  }

  private getTrackVerticalOffset(segment: TrackSegment, time: number): number {
    if (segment.kind === "lift") {
      return Math.sin(time * (segment.speed ?? 1.25) + (segment.phase ?? 0)) * (segment.amplitude ?? 0.34);
    }
    return 0;
  }

  private checkEntities(time: number, dt: number): void {
    const pickupRadius = this.magnetTimer > 0 ? 4.2 + this.save.upgrades.magnet * 0.6 : 0.95;
    for (const entity of this.entities) {
      if (entity.consumed) {
        continue;
      }
      entity.cooldown = Math.max(0, entity.cooldown - dt);
      const dz = Math.abs(this.distance - entity.data.z);
      if (dz > 8 && entity.data.kind !== "gate" && entity.data.kind !== "colorGate") {
        continue;
      }
      if (this.isCollectable(entity.data.kind)) {
        const dx = this.centerX - entity.data.x;
        if (Math.hypot(dx, this.distance - entity.data.z) < pickupRadius) {
          this.collectEntity(entity);
        }
      } else if (entity.data.kind === "gate" || entity.data.kind === "colorGate" || entity.data.kind === "weakPointGate") {
        const gateX = this.getGateX(entity.data, time);
        if (dz < 1.1 && Math.abs(this.centerX - gateX) < (entity.data.width ?? 2.4) / 2) {
          if (entity.data.kind === "weakPointGate") {
            this.applyWeakPointGate(entity.data, gateX);
          } else {
            this.applyGate(entity.data);
          }
          this.consumeGateRow(entity.data.z);
          break;
        }
      } else if (entity.data.kind === "enemy" || entity.data.kind === "enemyGate") {
        const enemyX = this.getEnemyX(entity.data, time);
        if (dz < 1.4 && Math.abs(this.centerX - enemyX) < (entity.data.width ?? 3.4) / 2) {
          this.startEnemyBattle(entity, enemyX);
        }
      } else {
        this.checkHazard(entity, time);
      }
    }
  }

  private isCollectable(kind: string): boolean {
    return ["crew", "crewCapsule", "coin", "gem", "shield", "magnet", "frenzy", "commander", "ticket", "bossBomb", "jumpPad", "colorPad"].includes(kind);
  }

  private collectEntity(entity: RuntimeEntity): void {
    entity.consumed = true;
    entity.mesh.visible = false;
    const value = entity.data.value ?? 1;
    if (entity.data.kind === "crew" || entity.data.kind === "crewCapsule") {
      this.addCrew(value);
      this.stats.score += 25 * value * this.stats.combo;
      this.stats.combo += 0.1;
      this.hud.popText(`+${value}`, "good");
      this.pulseHaptic(8, 90);
      this.audio.collect();
    } else if (entity.data.kind === "coin") {
      this.stats.coins += value;
      this.stats.score += 18;
      this.hud.popText(`+${value}`, "coin");
      this.audio.coin();
    } else if (entity.data.kind === "gem") {
      this.stats.gems += value;
      this.stats.score += 65;
      this.hud.popText(`Gem +${value}`, "coin");
      this.audio.coin();
    } else if (entity.data.kind === "shield") {
      this.shield += 1;
      this.hud.popText("Shield", "good");
      this.pulseHaptic(10, 90);
      this.audio.collect();
    } else if (entity.data.kind === "magnet") {
      this.magnetTimer = 6 + this.save.upgrades.magnet;
      this.hud.popText("Magnet", "good");
      this.pulseHaptic(10, 90);
      this.audio.collect();
    } else if (entity.data.kind === "frenzy") {
      this.frenzyTimer = 4.5;
      this.hud.popText("Frenzy", "good");
      this.pulseHaptic(10, 90);
      this.audio.collect();
    } else if (entity.data.kind === "commander") {
      this.commanderTimer = 7;
      this.hud.popText("Tight Crew", "good");
      this.pulseHaptic(10, 90);
      this.audio.collect();
    } else if (entity.data.kind === "ticket") {
      this.save.tickets += 1;
      saveGame(this.save);
      this.hud.popText("Ticket", "coin");
      this.pulseHaptic([12, 28, 12], 120);
      this.audio.reward();
    } else if (entity.data.kind === "bossBomb") {
      this.bossBombs += 1;
      this.hud.popText("Boss Bomb", "boss");
      this.pulseHaptic(14, 90);
      this.audio.collect();
    } else if (entity.data.kind === "jumpPad") {
      this.jumpTimer = this.jumpDuration;
      this.stats.score += 90;
      this.hud.popText("Jump", "good");
      this.pulseHaptic(12, 90);
      this.audio.collect();
    } else if (entity.data.kind === "colorPad") {
      this.activeTeamColor = entity.data.color ?? "cyan";
      this.materials.body.color.setHex(this.teamColors[this.activeTeamColor]);
      this.hud.popText(this.activeTeamColor.toUpperCase(), "good");
      this.pulseHaptic(10, 90);
      this.audio.collect();
    }
    this.spawnBurst(entity.data.x, entity.data.z, entity.data.kind === "coin" ? 0xffd166 : 0x58f29a);
  }

  private addCrew(amount: number): void {
    this.count = Math.max(0, Math.floor(this.count + amount));
    this.stats.maxCount = Math.max(this.stats.maxCount, this.count);
  }

  private applyGate(data: LevelEntity): void {
    const before = this.count;
    if (data.kind === "colorGate") {
      if ((data.color ?? "cyan") === this.activeTeamColor) {
        this.addCrew(data.value ?? 10);
        this.stats.score += 120;
        this.hud.popText("Color match", "good");
        this.pulseHaptic(12, 100);
        this.audio.gate(true);
      } else {
        this.loseCrew(data.value ?? 10, "Wrong color");
        this.audio.gate(false);
      }
      return;
    }

    const gate = this.getGateState(data, this.lastTime);
    const value = gate.value;
    const bonus = this.save.upgrades.gateBonus;
    this.count = calculateGateCount(this.count, gate.op, value, bonus);

    const delta = this.count - before;
    this.crowdImpactPulse = delta >= 0 ? 0.36 : 0.78;
    this.stats.gates += 1;
    this.stats.score += Math.max(0, delta) * 18 + 70;
    this.stats.combo = delta >= 0 ? this.stats.combo + 0.3 : 1;
    this.hud.popText(`${delta >= 0 ? "+" : ""}${delta}`, delta >= 0 ? "good" : "bad");
    this.pulseHaptic(delta >= 0 ? 12 : [20, 36, 20], 110);
    this.audio.gate(delta >= 0);
    if (this.count <= 0) {
      this.failRun("Gate zeroed crew");
    }
  }

  private applyWeakPointGate(data: LevelEntity, gateX: number): void {
    const value = Math.max(1, Math.floor(data.value ?? 1));
    this.bossWeakPoints += value;
    this.stats.gates += 1;
    this.stats.score += 140 * value;
    this.stats.combo += 0.2;
    this.crowdImpactPulse = 0.34;
    this.hud.popText(`Weak Point +${value}`, "boss");
    this.pulseHaptic(12, 100);
    this.audio.collect();
    this.spawnBurst(gateX, data.z, 0xffc857);
  }

  private getGateState(data: LevelEntity, time = 0): { op: NonNullable<LevelEntity["op"]>; value: number; label: string; helpful: boolean } {
    let op: NonNullable<LevelEntity["op"]> = data.op ?? "add";
    let value = data.value ?? 0;
    if (data.altOp && data.altValue !== undefined) {
      const interval = Math.max(0.55, data.interval ?? 1.25);
      const useAlt = Math.floor((time + (data.phase ?? 0)) / interval) % 2 === 1;
      if (useAlt) {
        op = data.altOp;
        value = data.altValue;
      }
    }
    const helpful = op === "add" || op === "multiply" || (op === "percent" && value > 0);
    return { op, value, label: this.formatGateLabel(op, value), helpful };
  }

  private formatGateLabel(op: NonNullable<LevelEntity["op"]>, value: number): string {
    if (op === "add") return `+${value}`;
    if (op === "subtract") return `-${value}`;
    if (op === "multiply") return `x${value}`;
    if (op === "divide") return `/${value}`;
    return `${value > 0 ? "+" : ""}${value}%`;
  }

  private updateTimedGateLabel(entity: RuntimeEntity): void {
    const gate = this.getGateState(entity.data, this.lastTime);
    if (entity.mesh.userData.labelText === gate.label) {
      return;
    }
    const old = entity.mesh.userData.label as THREE.Object3D | undefined;
    if (old) {
      entity.mesh.remove(old);
    }
    const label = this.makeTextSprite(gate.label, gate.helpful ? "#0d8f52" : "#b82032", "#ffffff");
    label.position.set(0, 2.75, -0.08);
    label.scale.set(2.4, 0.86, 1);
    entity.mesh.userData.label = label;
    entity.mesh.userData.labelText = gate.label;
    entity.mesh.add(label);
  }

  private consumeGateRow(z: number): void {
    this.entities.forEach((entity) => {
      if ((entity.data.kind === "gate" || entity.data.kind === "colorGate" || entity.data.kind === "weakPointGate") && Math.abs(entity.data.z - z) < 0.2) {
        entity.consumed = true;
        entity.mesh.visible = false;
      }
    });
  }

  private startEnemyBattle(entity: RuntimeEntity, enemyX: number): void {
    if (this.currentBattle) {
      return;
    }
    const enemyCount = entity.data.count ?? 8;
    this.mode = "battle";
    this.speed = 0;
    this.currentBattle = entity;
    this.battleTimer = 0;
    this.battleDuration = clamp(1.32 + enemyCount / 120 + (entity.data.strength ?? 1) * 0.18, 1.35, 2.25);
    this.battleEnemyCount = enemyCount;
    this.battleLoss = Math.max(1, Math.ceil(enemyCount * (entity.data.strength ?? 1)));
    this.battleAppliedLoss = 0;
    this.battleAppliedDefeats = 0;
    this.battleX = enemyX;
    this.battleZ = entity.data.z;
    this.battleBeat = 0;
    this.targetX = enemyX;
    this.centerX = damp(this.centerX, enemyX, 12, 0.08);
    this.distance = entity.data.z - 0.45;
    entity.cooldown = this.battleDuration + 0.5;
    entity.mesh.position.x = enemyX;
    entity.mesh.userData.battleProgress = 0;
    this.cameraShake = 0.35;
    this.crowdImpactPulse = 0.45;
    this.hud.popText("Battle", "boss");
    this.pulseHaptic(18);
    this.audio.battle();
  }

  private updateBattle(time: number, dt: number): void {
    const entity = this.currentBattle;
    if (!entity || entity.consumed) {
      this.mode = "run";
      this.currentBattle = null;
      return;
    }

    this.battleTimer += dt;
    const progress = clamp(this.battleTimer / this.battleDuration, 0, 1);
    const eased = 1 - (1 - progress) ** 2;
    this.speed = 0;
    this.targetX = this.battleX;
    this.centerX = damp(this.centerX, this.battleX, 10, dt);
    this.distance = damp(this.distance, this.battleZ - 0.35, 7, dt);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.7);

    const targetLoss = Math.min(this.battleLoss, Math.floor(this.battleLoss * eased));
    if (targetLoss > this.battleAppliedLoss) {
      const delta = targetLoss - this.battleAppliedLoss;
      this.battleAppliedLoss = targetLoss;
      const applied = Math.min(this.count, delta);
      this.count -= applied;
      this.stats.losses += applied;
      this.stats.noHit = false;
      this.stats.combo = 1;
      this.crowdImpactPulse = 0.9;
      this.cameraShake = Math.max(this.cameraShake, 0.42);
      this.pulseHaptic(16, 120);
      this.spawnCrewKnockouts(applied, this.centerX, this.distance + 0.35);
      if (this.count <= 0) {
        this.finishEnemyBattle(false);
        return;
      }
    }

    const targetDefeats = Math.min(this.battleEnemyCount, Math.floor(this.battleEnemyCount * eased));
    if (targetDefeats > this.battleAppliedDefeats) {
      const delta = targetDefeats - this.battleAppliedDefeats;
      this.battleAppliedDefeats = targetDefeats;
      this.stats.enemiesDefeated += delta;
      this.stats.score += delta * 34;
      if (targetDefeats >= this.battleBeat) {
        this.battleBeat = targetDefeats + Math.max(4, Math.floor(this.battleEnemyCount / 5));
        this.spawnBattleClash(this.battleX, this.battleZ, Math.max(delta, 4));
        this.audio.battle();
      }
    }

    this.updateEnemyBattleVisual(entity, progress, time);
    this.hud.updateRun(this.level.id, clamp(this.distance / this.level.length, 0, 1), this.save, this.stats, this.count, this.shield);

    if (progress >= 1) {
      this.finishEnemyBattle(true);
    }
  }

  private finishEnemyBattle(won: boolean): void {
    const entity = this.currentBattle;
    if (!entity) {
      return;
    }
    entity.consumed = true;
    entity.mesh.visible = false;
    this.currentBattle = null;
    this.crowdImpactPulse = won ? 0.45 : 0.9;
    this.cameraShake = Math.max(this.cameraShake, won ? 0.35 : 0.75);
    this.spawnBurst(this.battleX, this.battleZ, won ? 0xffd166 : 0xef476f);
    this.hud.popText(won ? `Battle -${this.battleAppliedLoss}` : "Crew Lost", won ? "boss" : "bad");
    this.pulseHaptic(won ? [12, 28, 18] : [36, 56, 34], 160);
    if (!won || this.count <= 0) {
      this.failRun("Lost battle");
      return;
    }
    this.mode = "run";
    this.distance = Math.max(this.distance, this.battleZ + 0.65);
  }

  private updateEnemyBattleVisual(entity: RuntimeEntity, progress: number, time: number): void {
    entity.mesh.position.x = this.battleX + Math.sin(time * 28) * (1 - progress) * 0.035;
    entity.mesh.position.z = entity.data.z + 0.62 + progress * 0.35;
    entity.mesh.scale.setScalar(1 + Math.sin(time * 18) * 0.025 * (1 - progress));
    entity.mesh.userData.battleProgress = progress;
    const models = entity.mesh.userData.enemyModels as THREE.Object3D[] | undefined;
    const label = entity.mesh.userData.enemyLabel as THREE.Object3D | undefined;
    if (models) {
      const visibleCount = Math.ceil(models.length * (1 - progress));
      models.forEach((model, index) => {
        model.visible = index < visibleCount;
        if (model.visible) {
          const phase = model.userData.phase ?? index;
          model.position.y += Math.max(0, Math.sin(time * 16 + phase)) * 0.012;
          model.rotation.z = Math.sin(time * 10 + phase) * 0.08 * progress;
        }
      });
    }
    if (label) {
      label.visible = progress < 0.72;
    }
  }

  private checkHazard(entity: RuntimeEntity, time: number): void {
    if (entity.cooldown > 0) {
      return;
    }
    const data = entity.data;
    const dz = Math.abs(this.distance - data.z);
    const hazardX = this.getHazardX(data, time);
    const hitbox = this.getHazardHitbox(data, time);
    const inX = Math.abs(this.centerX - hazardX) < hitbox.halfWidth + this.formationRadius() * hitbox.formationPadding;
    const inZ = dz < hitbox.halfDepth + hitbox.zPadding;
    if (!inX || !inZ) {
      return;
    }
    if (this.getJumpHeight() > 0.38 && ["hole", "bumper", "sawLane", "spikeRoller"].includes(data.kind)) {
      return;
    }

    if (data.kind === "goo") {
      this.gooTimer = 2.2;
      entity.cooldown = 1.1;
      this.hud.popText("Slow", "bad");
      return;
    }
    if (data.kind === "fan") {
      this.targetX += (data.value ?? 1) * 0.75;
      entity.cooldown = 0.25;
      return;
    }
    if (data.kind === "swingingAxe" && Math.abs(hazardX - data.x) < 0.45) {
      return;
    }
    if (data.kind === "laser" && Math.sin(time * (data.speed ?? 2.4) + (data.phase ?? 0)) < 0.15) {
      return;
    }
    if (data.kind === "crusher" && Math.sin(time * (data.speed ?? 2.4) + (data.phase ?? 0)) < 0.2) {
      return;
    }
    const severe = data.kind === "hole";
    const baseLoss =
      data.kind === "sideScraper"
        ? 5 + Math.floor(this.count * 0.16)
        : data.kind === "bumper"
          ? 3 + Math.floor(this.count * 0.08)
          : severe
            ? Math.max(12, Math.floor(this.count * 0.45))
            : 4 + Math.floor(this.count * 0.12);
    this.loseCrew(baseLoss, severe ? "Hole" : data.kind === "sideScraper" ? "Scraper" : data.kind === "bumper" ? "Bumper" : "Trap");
    entity.cooldown = severe ? 1.1 : 0.8;
  }

  private getHazardHitbox(data: LevelEntity, time: number): { halfWidth: number; halfDepth: number; formationPadding: number; zPadding: number } {
    const width = data.width ?? 2.1;
    const depth = data.depth ?? 2.2;
    if (data.kind === "rotatingBar") {
      const angle = time * (data.speed ?? 2.4) + (data.phase ?? 0);
      return {
        halfWidth: Math.max(0.48, Math.abs(Math.cos(angle)) * width * 0.46 + 0.16),
        halfDepth: Math.max(0.36, Math.abs(Math.sin(angle)) * width * 0.27 + depth * 0.2),
        formationPadding: 0.15,
        zPadding: 0.05
      };
    }
    if (data.kind === "hole") {
      return { halfWidth: width * 0.36, halfDepth: depth * 0.38, formationPadding: 0.12, zPadding: 0.02 };
    }
    if (data.kind === "sideScraper") {
      return { halfWidth: width * 0.43, halfDepth: depth * 0.42, formationPadding: 0.12, zPadding: 0.04 };
    }
    if (data.kind === "bumper") {
      return { halfWidth: width * 0.42, halfDepth: depth * 0.42, formationPadding: 0.14, zPadding: 0.04 };
    }
    if (data.kind === "sawLane") {
      return { halfWidth: width * 0.38, halfDepth: depth * 0.4, formationPadding: 0.13, zPadding: 0.04 };
    }
    if (data.kind === "crusher") {
      return { halfWidth: width * 0.42, halfDepth: depth * 0.42, formationPadding: 0.14, zPadding: 0.04 };
    }
    if (data.kind === "swingingAxe") {
      return { halfWidth: width * 0.36, halfDepth: depth * 0.34, formationPadding: 0.12, zPadding: 0.03 };
    }
    if (data.kind === "spikeRoller" || data.kind === "cannon") {
      return { halfWidth: width * 0.38, halfDepth: depth * 0.38, formationPadding: 0.13, zPadding: 0.04 };
    }
    if (data.kind === "laser") {
      return { halfWidth: width * 0.48, halfDepth: Math.max(0.2, depth * 0.22), formationPadding: 0.12, zPadding: 0.03 };
    }
    if (data.kind === "goo") {
      return { halfWidth: width * 0.46, halfDepth: depth * 0.46, formationPadding: 0.2, zPadding: 0.08 };
    }
    if (data.kind === "fan") {
      return { halfWidth: width * 0.5, halfDepth: depth * 0.5, formationPadding: 0.18, zPadding: 0.08 };
    }
    return { halfWidth: width * 0.45, halfDepth: depth * 0.42, formationPadding: 0.16, zPadding: 0.04 };
  }

  private getHazardX(data: LevelEntity, time: number): number {
    if (data.kind === "spikeRoller" || data.kind === "cannon" || data.kind === "swingingAxe") {
      return data.x + Math.sin(time * (data.speed ?? 2.1) + (data.phase ?? 0)) * (data.range ?? 2.3);
    }
    return data.x;
  }

  private getGateX(data: LevelEntity, time: number): number {
    if ((data.kind === "gate" || data.kind === "colorGate" || data.kind === "weakPointGate") && data.range && data.speed) {
      return data.x + Math.sin(time * data.speed + (data.phase ?? 0)) * data.range;
    }
    return data.x;
  }

  private getEnemyX(data: LevelEntity, time: number): number {
    if ((data.kind === "enemy" || data.kind === "enemyGate") && data.range && data.speed) {
      return data.x + Math.sin(time * data.speed + (data.phase ?? 0)) * data.range;
    }
    return data.x;
  }

  private loseCrew(amount: number, reason: string): void {
    if (this.shield > 0) {
      this.shield -= 1;
      this.hud.popText("Shield saved", "good");
      this.audio.hit();
      this.cameraShake = 0.4;
      this.pulseHaptic(12, 120);
      return;
    }
    const loss = Math.min(this.count, Math.max(1, Math.floor(amount)));
    this.count -= loss;
    this.stats.losses += loss;
    this.stats.combo = 1;
    this.stats.noHit = false;
    this.cameraShake = 0.7;
    this.crowdImpactPulse = 0.86;
    this.hud.popText(`${reason} -${loss}`, "bad");
    this.audio.hit();
    this.pulseHaptic(reason === "Hole" ? [36, 54, 36] : [22, 42, 22], 150);
    this.spawnBurst(this.centerX, this.distance, 0xef476f);
    this.spawnCrewKnockouts(loss);
    if (this.count <= 0) {
      this.failRun(reason);
    }
  }

  private loseCrewForBoss(amount: number, reason: string): void {
    if (this.shield > 0) {
      this.shield -= 1;
      this.hud.popText("Shield saved", "good");
      this.audio.hit();
      this.cameraShake = 0.4;
      this.pulseHaptic(12, 120);
      return;
    }
    const reserve = this.bossHp > 0 ? 1 : 0;
    const loss = Math.min(Math.max(0, this.count - reserve), Math.max(1, Math.floor(amount)));
    if (loss <= 0) {
      this.failRun(reason);
      return;
    }
    this.count -= loss;
    this.stats.losses += loss;
    this.stats.combo = 1;
    this.stats.noHit = false;
    this.cameraShake = 0.7;
    this.crowdImpactPulse = 0.86;
    this.hud.popText(`${reason} -${loss}`, "bad");
    this.audio.hit();
    this.pulseHaptic([24, 46, 24], 150);
    this.spawnBurst(this.centerX, this.distance, 0xef476f);
    this.spawnCrewKnockouts(loss);
  }

  private startStairs(): void {
    this.mode = "stairs";
    this.speed = 0;
    this.distance = this.level.length + 6;
    this.stairTimer = 0;
    this.stairFinaleStarted = false;
    this.stairFinaleTimer = 0;
    this.hud.popText("Final stairs", "boss");
    if (this.stats.noHit && this.stats.losses === 0 && this.count > 0) {
      const boost = Math.min(6, Math.max(3, Math.floor(this.count * 0.06)));
      this.stats.finalStair = Math.min(24, this.stats.finalStair + boost);
      this.stats.score += boost * 125;
      this.stats.coins += boost * 6;
      this.hud.popText(`Perfect +${boost}`, "good");
      this.spawnBurst(0, this.level.length + 9, 0xffd166);
      this.audio.reward();
    }
  }

  private updateStairs(dt: number): void {
    if (this.stairFinaleStarted) {
      this.updateStairFinale(dt);
      return;
    }
    this.stairTimer += dt;
    const markerStep = clamp(this.stats.finalStair, 0, 23);
    if (this.stairScoreMarker) {
      const markerTargetY = 0.62 + markerStep * 0.16;
      const markerTargetZ = markerStep * 0.76;
      this.stairScoreMarker.position.y = damp(this.stairScoreMarker.position.y, markerTargetY, 8, dt);
      this.stairScoreMarker.position.z = damp(this.stairScoreMarker.position.z, markerTargetZ, 8, dt);
      this.stairScoreMarker.rotation.y += dt * 3.5;
    }
    this.hud.updateRun(this.level.id, clamp(this.stats.finalStair / 24, 0, 1), this.save, this.stats, this.count, this.shield);
    if (this.stairTimer < 0.11) {
      return;
    }
    this.stairTimer = 0;
    if (this.count > 0 && this.stats.finalStair < 24) {
      this.count -= 1;
      this.stats.finalStair += 1;
      const multiplier = Math.min(6, 1 + Math.floor((this.stats.finalStair - 1) / 4));
      this.stats.score += 95 * multiplier;
      this.stats.coins += 4 * multiplier;
      if (this.stats.finalStair % 4 === 0 || this.stats.finalStair >= 20) {
        this.hud.popText(`x${multiplier}`, "coin");
      }
      this.audio.coin();
      return;
    }
    this.startStairFinale();
  }

  private startStairFinale(): void {
    if (this.stairFinaleStarted) {
      return;
    }
    this.stairFinaleStarted = true;
    this.stairFinaleTimer = 0;
    this.stats.finalStair = clamp(this.stats.finalStair, 0, 24);
    const multiplier = Math.min(6, Math.max(1, 1 + Math.floor((this.stats.finalStair - 1) / 4)));
    this.stats.score += 260 * multiplier;
    this.stats.coins += 16 * multiplier;
    this.cameraShake = 0.55;
    this.hud.popText(`Vault x${multiplier}`, "coin");
    this.spawnStairConfetti();
    this.pulseHaptic([22, 38, 22], 160);
    this.audio.reward();
  }

  private updateStairFinale(dt: number): void {
    this.stairFinaleTimer += dt;
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.7);
    if (this.stairScoreMarker) {
      this.stairScoreMarker.position.y = damp(this.stairScoreMarker.position.y, 4.5, 6, dt);
      this.stairScoreMarker.position.z = damp(this.stairScoreMarker.position.z, 18.2, 6, dt);
      this.stairScoreMarker.rotation.y += dt * 6;
    }
    this.hud.updateRun(this.level.id, 1, this.save, this.stats, this.count, this.shield);
    if (this.stairFinaleTimer >= 2.15) {
      this.finishLevel(false);
    }
  }

  private getBossWeakMultiplier(): number {
    return clamp(1 + this.bossWeakPoints * 0.14, 1, 1.7);
  }

  private startBoss(): void {
    this.mode = "boss";
    this.speed = 0;
    this.distance = this.level.length + 6.8;
    this.bossHp = this.level.boss?.hp ?? 100;
    this.bossMaxHp = this.bossHp;
    this.bossAttackTimer = this.level.boss?.attackInterval ?? 1.8;
    this.bossAttackWarn = 0;
    this.bossAttackImpact = 0;
    this.bossHitPulse = 0;
    this.bossVictoryTimer = 0;
    if (this.bossWeakCore) {
      this.bossWeakCore.visible = this.bossWeakPoints > 0;
    }
    this.audio.switchMusic("boss");
    this.hud.popText(this.bossWeakPoints > 0 ? `Weak x${this.getBossWeakMultiplier().toFixed(1)}` : (this.level.boss?.name ?? "Boss"), "boss");
  }

  private updateBoss(dt: number): void {
    this.animateTaggedObject(this.bossGroup, this.lastTime, dt);
    this.centerX = damp(this.centerX, this.targetX, 8, dt);
    this.targetX += this.keyboardX * 3.8 * dt;
    this.targetX = clamp(this.targetX, -3.2, 3.2);
    this.centerX = clamp(this.centerX, -3.5, 3.5);

    const damage = (this.count * 0.24 + this.save.upgrades.bossDamage * 1.6 + this.bossBombs * 2.2) * this.getBossWeakMultiplier() * dt;
    this.bossHp = Math.max(0, this.bossHp - damage);
    this.bossHitPulse = Math.min(1, this.bossHitPulse + damage * 0.008);
    this.bossHitPulse = Math.max(0, this.bossHitPulse - dt * 1.8);
    this.stats.score += damage * 14;
    this.bossAttackTimer -= dt;
    this.bossAttackImpact = Math.max(0, this.bossAttackImpact - dt);

    if (this.bossAttackTimer <= 0 && this.bossAttackWarn <= 0) {
      this.bossAttackWarn = 0.8;
      const attackKind = this.level.boss?.attackKind ?? "stomp";
      this.bossAttackX =
        attackKind === "sweep" ? 0 : [-2.2, 0, 2.2][Math.floor(seededRandom(this.level.id + this.stats.score) * 3)];
      this.hud.popText(attackKind === "minions" ? "Minions" : attackKind === "sweep" ? "Sweep" : "Stomp", "bad");
    }

    if (this.bossAttackWarn > 0) {
      this.bossAttackWarn -= dt;
      const attackKind = this.level.boss?.attackKind ?? "stomp";
      if (attackKind === "sweep") {
        this.bossAttackX = Math.sin((0.8 - this.bossAttackWarn) * 7.5) * 2.8;
      }
      if (this.bossTelegraph) {
        this.bossTelegraph.visible = true;
        this.bossTelegraph.position.x = this.bossAttackX;
        this.bossTelegraph.scale.set(
          attackKind === "minions" ? 3.4 : attackKind === "sweep" ? 1.4 : 1,
          1,
          attackKind === "minions" ? 0.92 : 1
        );
      }
      if (this.bossAttackWarn <= 0) {
        const hit =
          attackKind === "minions"
            ? true
            : Math.abs(this.centerX - this.bossAttackX) < 1.35 + this.formationRadius() * 0.15;
        if (hit) {
          this.loseCrewForBoss(
            attackKind === "minions" ? 7 + Math.floor(this.count * 0.12) : 8 + Math.floor(this.count * 0.18),
            attackKind === "minions" ? "Minions" : "Boss"
          );
        } else {
          this.stats.score += 120;
          this.hud.popText("Dodged", "good");
          this.pulseHaptic(10, 120);
        }
        this.audio.stomp();
        this.cameraShake = 0.9;
        this.bossAttackImpact = 0.24;
        this.bossAttackTimer = Math.max(0.85, (this.level.boss?.attackInterval ?? 1.8) - (1 - this.bossHp / this.bossMaxHp) * 0.55);
      }
    } else if (this.bossTelegraph) {
      this.bossTelegraph.visible = false;
    }

    const bossAttackKind = this.level.boss?.attackKind ?? "stomp";
    const warningProgress = this.bossAttackWarn > 0 ? 1 - clamp(this.bossAttackWarn / 0.8, 0, 1) : 0;
    const warningArc = Math.sin(warningProgress * Math.PI);
    const impactArc = this.bossAttackImpact > 0 ? Math.sin((this.bossAttackImpact / 0.24) * Math.PI * 0.5) : 0;
    const bossIdle = Math.sin(this.lastTime * 2.4) * 0.08;

    if (this.bossWeapon) {
      const stompWindup = bossAttackKind === "stomp" ? warningArc * 1.45 : warningArc * 0.65;
      const sweepSwing = bossAttackKind === "sweep" ? Math.sin(warningProgress * Math.PI * 1.25) * 1.25 + impactArc * 1.1 : 0;
      const minionShake = bossAttackKind === "minions" ? Math.sin(this.lastTime * 9) * 0.22 + warningArc * 0.55 + impactArc * 0.35 : 0;
      const slamImpact = bossAttackKind === "stomp" ? impactArc * 1.25 : impactArc * 0.35;
      this.bossWeapon.rotation.z = -0.24 - stompWindup * 0.38 - slamImpact * 0.3 + sweepSwing * 0.32 + minionShake + bossIdle * 0.55;
      this.bossWeapon.rotation.x = bossAttackKind === "sweep" ? warningArc * 0.45 + impactArc * 0.18 : impactArc * 0.22;
      this.bossWeapon.position.x = 0.1 + this.bossAttackX * 0.025 + (bossAttackKind === "sweep" ? impactArc * Math.sign(this.bossAttackX || 1) * 0.1 : 0);
      this.bossWeapon.position.y = -0.62 + Math.sin(this.lastTime * 3) * 0.025 + warningArc * 0.04 - impactArc * 0.08;
      this.bossWeapon.position.z = -0.36 - warningArc * 0.18 - impactArc * 0.22;
    }
    if (this.bossRightArm) {
      const sweepShoulder = bossAttackKind === "sweep" ? Math.sin(warningProgress * Math.PI * 1.2) * 0.7 + impactArc * 0.55 : 0;
      this.bossRightArm.rotation.z = -0.32 + bossIdle * 0.6 - warningArc * 0.58 - impactArc * 0.72 + sweepShoulder;
      this.bossRightArm.rotation.x = -warningArc * 0.28 + impactArc * 0.24;
      this.bossRightArm.rotation.y = bossAttackKind === "sweep" ? warningArc * 0.28 - impactArc * 0.18 : -impactArc * 0.12;
    }
    if (this.bossRightHand) {
      this.bossRightHand.rotation.z = -0.42 - warningArc * 0.62 - impactArc * 0.8 + (bossAttackKind === "sweep" ? warningArc * 0.42 : 0);
      this.bossRightHand.rotation.x = -warningArc * 0.25 + impactArc * 0.2;
    }
    if (this.bossLeftArm) {
      this.bossLeftArm.rotation.z = 0.62 + Math.sin(this.lastTime * 3.2) * 0.08 + this.bossHitPulse * 0.08;
    }
    if (this.bossWeakCore) {
      this.bossWeakCore.visible = this.bossWeakPoints > 0;
      if (this.bossWeakCore.visible) {
        const pulse = 1 + Math.sin(this.lastTime * 7.2) * 0.08 + this.bossHitPulse * 0.12;
        this.bossWeakCore.scale.setScalar(pulse * (1 + Math.min(0.18, this.bossWeakPoints * 0.035)));
        this.bossWeakCore.rotation.z += dt * (1.7 + this.bossWeakPoints * 0.25);
      }
    }

    this.bossGroup.rotation.y = Math.sin(this.lastTime * 2.4) * 0.04 + Math.sin(this.lastTime * 48) * this.bossHitPulse * 0.025;
    this.bossGroup.position.x = Math.sin(this.lastTime * 34) * this.bossHitPulse * 0.05;
    this.bossGroup.scale.setScalar(1 + this.bossHitPulse * 0.018);
    this.hud.updateRun(this.level.id, 1 - this.bossHp / this.bossMaxHp, this.save, this.stats, this.count, this.shield);
    if (this.bossHp <= 0) {
      this.startBossVictory();
    }
  }

  private startBossVictory(): void {
    if (this.mode === "bossVictory" || this.mode === "reward") {
      return;
    }
    this.mode = "bossVictory";
    this.speed = 0;
    this.bossHp = 0;
    this.bossAttackWarn = 0;
    this.bossAttackTimer = 999;
    this.bossAttackImpact = 0.28;
    this.bossHitPulse = 1;
    this.bossVictoryTimer = 0;
    this.stats.bossDefeated = true;
    this.stats.gems += this.level.boss?.gemReward ?? 4;
    this.stats.medals += this.level.boss?.medalReward ?? 1;
    this.stats.score += 1000;
    if (this.bossTelegraph) {
      this.bossTelegraph.visible = false;
    }
    this.cameraShake = 1.25;
    this.hud.popText("Castle Taken", "boss");
    this.pulseHaptic([34, 58, 42], 180);
    this.audio.stomp();
    this.audio.reward();
    this.spawnBossConfetti();
  }

  private updateBossVictory(dt: number): void {
    this.animateTaggedObject(this.bossGroup, this.lastTime, dt);
    this.bossVictoryTimer += dt;
    this.bossHitPulse = Math.max(0, this.bossHitPulse - dt * 1.5);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.6);
    this.targetX = damp(this.targetX, 0, 5, dt);
    this.centerX = damp(this.centerX, 0, 5, dt);
    this.distance = damp(this.distance, this.level.length + 10.8, 1.9, dt);

    const progress = clamp(this.bossVictoryTimer / 1.35, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    const gateProgress = clamp((this.bossVictoryTimer - 0.38) / 1.45, 0, 1);
    const gateEased = 1 - (1 - gateProgress) ** 3;
    const flagProgress = clamp((this.bossVictoryTimer - 1.08) / 1.12, 0, 1);
    const flagEased = Math.sin(flagProgress * Math.PI * 0.5);
    const crownLift = Math.sin(clamp(this.bossVictoryTimer / 0.78, 0, 1) * Math.PI) * 0.9;

    if (this.bossBody) {
      this.bossBody.position.y = 1.65 - eased * 0.72 + Math.sin(this.lastTime * 36) * (1 - eased) * 0.025;
      this.bossBody.position.z = 4.5 + eased * 0.34;
      this.bossBody.rotation.x = eased * 0.72;
      this.bossBody.rotation.z = -eased * 0.68;
      this.bossBody.scale.setScalar(1 - eased * 0.08);
    }
    if (this.bossWeapon) {
      this.bossWeapon.position.y = -0.62 - eased * 0.26;
      this.bossWeapon.position.x = 0.1 + eased * 0.2;
      this.bossWeapon.position.z = -0.36 + eased * 0.18;
      this.bossWeapon.rotation.x = eased * 1.1;
      this.bossWeapon.rotation.z = -0.24 - eased * 1.6;
    }
    if (this.bossRightArm) {
      this.bossRightArm.rotation.z = -0.32 - eased * 1.28;
      this.bossRightArm.rotation.x = eased * 0.32;
      this.bossRightArm.rotation.y = -eased * 0.18;
    }
    if (this.bossRightHand) {
      this.bossRightHand.rotation.z = -0.42 - eased * 1.4;
      this.bossRightHand.rotation.x = eased * 0.38;
    }
    if (this.bossLeftArm) {
      this.bossLeftArm.rotation.z = 0.62 + eased * 1.08;
      this.bossLeftArm.rotation.x = -eased * 0.22;
    }
    if (this.bossCrown) {
      this.bossCrown.position.y = 3 + crownLift - eased * 0.28;
      this.bossCrown.rotation.y += dt * 8;
      this.bossCrown.rotation.z = Math.sin(this.lastTime * 9) * (1 - progress) * 0.45;
    }
    if (this.bossGate) {
      this.bossGate.position.y = Math.sin(this.lastTime * 18) * (1 - gateProgress) * 0.035;
      this.bossGate.scale.x = 1 + gateEased * 0.035;
      const leftDoorGroup = this.bossGate.userData.leftDoorGroup as THREE.Object3D | undefined;
      const rightDoorGroup = this.bossGate.userData.rightDoorGroup as THREE.Object3D | undefined;
      const portcullis = this.bossGate.userData.portcullis as THREE.Object3D | undefined;
      const enemyBanner = this.bossGate.userData.enemyBanner as THREE.Object3D | undefined;
      const victoryFlag = this.bossGate.userData.victoryFlag as THREE.Object3D | undefined;
      const flagBanner = this.bossGate.userData.flagBanner as THREE.Object3D | undefined;
      if (leftDoorGroup) {
        leftDoorGroup.position.x = -0.04 - gateEased * 0.2;
        leftDoorGroup.rotation.y = -gateEased * 1.22;
      }
      if (rightDoorGroup) {
        rightDoorGroup.position.x = 0.04 + gateEased * 0.2;
        rightDoorGroup.rotation.y = gateEased * 1.22;
      }
      if (portcullis) {
        portcullis.position.y = 1.18 + gateEased * 2.05;
      }
      if (enemyBanner) {
        const bannerDrop = clamp(this.bossVictoryTimer / 0.72, 0, 1);
        enemyBanner.position.y = 2.94 - bannerDrop * 0.48;
        enemyBanner.rotation.z = bannerDrop * 0.42;
        enemyBanner.scale.setScalar(Math.max(0.05, 1 - flagProgress * 0.92));
        enemyBanner.visible = flagProgress < 0.98;
      }
      if (victoryFlag) {
        victoryFlag.visible = flagProgress > 0;
        victoryFlag.position.y = 3.05 + flagEased * 0.78;
        victoryFlag.scale.set(1, Math.max(0.01, flagEased), 1);
        victoryFlag.rotation.z = Math.sin(this.lastTime * 7) * 0.035 * flagEased;
      }
      if (flagBanner) {
        flagBanner.scale.x = 0.35 + flagEased * 0.65;
        flagBanner.rotation.z = Math.sin(this.lastTime * 9) * 0.04 * flagEased;
      }
    }

    this.bossGroup.rotation.y = Math.sin(this.lastTime * 24) * (1 - progress) * 0.025;
    this.bossGroup.position.x = Math.sin(this.lastTime * 31) * (1 - progress) * 0.04;
    this.hud.updateRun(this.level.id, 1, this.save, this.stats, this.count, this.shield);

    if (this.bossVictoryTimer >= 3.65) {
      this.finishLevel(true, false);
    }
  }

  private startExtraSpin(): void {
    if (this.mode !== "reward" || this.save.tickets <= 0) {
      this.audio.hit();
      return;
    }
    this.save.tickets -= 1;
    saveGame(this.save);
    if (!this.rouletteWheel) {
      this.createRouletteWheel(this.level.length + 18);
    }
    this.startRoulette(true);
  }

  private startRoulette(directPayout = false): void {
    this.mode = "roulette";
    this.speed = 0;
    this.distance = this.level.length + 10;
    this.rouletteTimer = 0;
    this.rouletteTick = 0;
    this.rouletteRevealTimer = 0;
    this.rouletteResolved = false;
    this.rouletteDirectPayout = directPayout;
    this.extraSpinReward = null;
    if (directPayout) {
      this.stairsGroup.visible = false;
      this.bossGroup.visible = false;
    }
    this.rouletteGroup.visible = true;
    this.hud.hideRoulettePrize();
    this.hud.showRun();
    this.pickRouletteReward();
    if (this.rouletteWheel) {
      this.rouletteWheel.rotation.z = this.rouletteSpinStart;
    }
    this.audio.switchMusic("roulette");
    this.hud.popText("Spin", "coin");
    this.pulseHaptic(12, 120);
  }

  private updateRoulette(dt: number): void {
    if (this.rouletteResolved) {
      this.rouletteRevealTimer -= dt;
      if (this.rouletteWheel) {
        const pulse = 1 + Math.sin(this.lastTime * 10) * 0.012;
        this.rouletteWheel.scale.set(pulse, pulse, 1);
      }
      this.animateRouletteDetails(1, true);
      this.hud.updateRun(this.level.id, 1, this.save, this.stats, this.count, this.shield);
      if (this.rouletteRevealTimer <= 0) {
        if (this.rouletteDirectPayout && this.extraSpinReward) {
          this.mode = "reward";
          this.hud.showReward(this.extraSpinReward, this.save);
        } else {
          this.finishLevel(false, false);
        }
      }
      return;
    }

    this.rouletteTimer += dt;
    this.rouletteTick -= dt;
    const spinDuration = 4.15;
    const progress = clamp(this.rouletteTimer / spinDuration, 0, 1);
    const eased = 1 - (1 - progress) ** 4;
    if (this.rouletteWheel) {
      this.rouletteWheel.rotation.z = this.rouletteSpinStart + (this.rouletteSpinEnd - this.rouletteSpinStart) * eased;
    }
    this.animateRouletteDetails(progress, false);
    if (this.rouletteTick <= 0 && progress < 0.98) {
      this.audio.rouletteTick();
      this.rouletteTick = 0.045 + progress * 0.16;
    }
    this.hud.updateRun(this.level.id, progress, this.save, this.stats, this.count, this.shield);
    if (progress >= 1) {
      this.resolveRoulette();
    }
  }

  private animateRouletteDetails(progress: number, reveal: boolean): void {
    const speed = reveal ? 18 : 10 + progress * 18;
    if (this.roulettePointer) {
      const tap = Math.abs(Math.sin(this.lastTime * speed)) * (reveal ? 0.025 : 0.08 * (1 - progress * 0.35));
      this.roulettePointer.position.y = 2.38 - tap;
      const scale = reveal ? 1.04 + Math.sin(this.lastTime * 9) * 0.025 : 1 + tap * 0.8;
      this.roulettePointer.scale.set(scale, scale, 1);
    }
    if (this.rouletteHubGem) {
      this.rouletteHubGem.rotation.z += reveal ? 0.08 : 0.045 + progress * 0.035;
      const hubPulse = reveal ? 1.12 + Math.sin(this.lastTime * 12) * 0.07 : 1 + Math.sin(this.lastTime * 5) * 0.025;
      this.rouletteHubGem.scale.setScalar(hubPulse);
    }
    this.rouletteBulbs.forEach((bulb, index) => {
      const chase = reveal ? Math.sin(this.lastTime * 16 + index * 0.55) : Math.sin(this.lastTime * speed - index * 0.52);
      const scale = reveal ? 1.1 + Math.max(0, chase) * 0.58 : 0.88 + Math.max(0, chase) * 0.52;
      bulb.scale.setScalar(scale);
    });
    if (this.rouletteGlow) {
      this.rouletteGlow.visible = reveal;
      if (reveal) {
        const pulse = 1 + Math.sin(this.lastTime * 8) * 0.035;
        this.rouletteGlow.scale.set(pulse, pulse, 1);
        this.rouletteGlow.rotation.z += 0.035;
        this.materials.rouletteGlow.opacity = 0.34 + Math.sin(this.lastTime * 10) * 0.08;
      } else {
        this.materials.rouletteGlow.opacity = 0;
      }
    }
  }

  private pickRouletteReward(): void {
    const luck = this.save.upgrades.rouletteLuck;
    const weighted = this.rouletteRewards.map((reward) => ({
      reward,
      weight:
        reward.weight +
        (reward.kind === "skin" ? luck * 0.09 : 0) +
        (reward.kind === "upgrade" ? luck * 0.06 : 0) +
        (reward.kind === "shards" ? luck * 0.05 : 0) +
        (reward.kind === "gems" && reward.amount >= 8 ? luck * 0.055 : 0) +
        (reward.kind === "coins" && reward.amount >= 500 ? luck * 0.045 : 0)
    }));
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cursor = seededRandom(this.stats.score + this.level.id * 91 + this.save.tickets * 17) * totalWeight;
    let selectedIndex = 0;
    for (let index = 0; index < weighted.length; index += 1) {
      cursor -= weighted[index].weight;
      if (cursor <= 0) {
        selectedIndex = index;
        break;
      }
    }
    this.rouletteSelectedReward = this.rouletteRewards[selectedIndex];
    this.rouletteSpinStart = 0;
    const segmentAngle = (Math.PI * 2) / this.rouletteRewards.length;
    const selectedMid = Math.PI / 2 + selectedIndex * segmentAngle;
    this.rouletteSpinEnd = Math.PI * 2 * 6 + (Math.PI / 2 - selectedMid);
  }

  private resolveRoulette(): void {
    if (this.rouletteResolved) {
      return;
    }
    const reward = this.rouletteSelectedReward ?? this.rouletteRewards[0];
    const prizeLabel = this.rouletteDirectPayout ? this.applyDirectRouletteReward(reward) : this.applyRouletteReward(reward);
    this.rouletteResolved = true;
    this.rouletteRevealTimer = 3.2;
    this.materials.rouletteGlow.color.setHex(reward.color);
    this.materials.rouletteGlow.opacity = 0.34;
    if (this.rouletteGlow) {
      this.rouletteGlow.visible = true;
    }
    this.hud.showRoulettePrize(prizeLabel);
    this.hud.popText(prizeLabel, reward.tone);
    this.showRoulettePrizeSprite(prizeLabel, reward.color);
    this.spawnBurst(0, this.level.length + 18, reward.color);
    this.pulseHaptic([18, 44, 26], 180);
    this.audio.reward();
    if (!this.rouletteDirectPayout) {
      this.stats.score += 650;
    }
    this.hud.updateRun(this.level.id, 1, this.save, this.stats, this.count, this.shield);
  }

  private grantRouletteUpgrade(): string | null {
    const labels: Record<keyof SaveData["upgrades"], string> = {
      startCrew: "Start Crew",
      gateBonus: "Gate Bonus",
      formation: "Formation",
      shield: "Shield",
      coinValue: "Coin Value",
      bossDamage: "Boss Damage",
      magnet: "Magnet",
      rouletteLuck: "Roulette Luck"
    };
    const keys = (Object.keys(this.save.upgrades) as Array<keyof SaveData["upgrades"]>).filter((key) => this.save.upgrades[key] < upgradeCosts.length);
    if (keys.length === 0) {
      return null;
    }
    const index = Math.floor(seededRandom(this.stats.score + this.level.id * 37 + this.save.gems * 11) * keys.length);
    const key = keys[index] ?? keys[0];
    this.save.upgrades[key] = Math.min(upgradeCosts.length, this.save.upgrades[key] + 1);
    saveGame(this.save);
    return `${labels[key]} +1`;
  }

  private applyRouletteReward(reward: RouletteReward): string {
    if (reward.kind === "coins") {
      this.stats.coins += reward.amount;
      this.stats.rouletteLabel = `Wheel: coins +${reward.amount}`;
      return `Coins +${reward.amount}`;
    }
    if (reward.kind === "gems") {
      this.stats.gems += reward.amount;
      this.stats.rouletteLabel = reward.amount >= 8 ? `Jackpot: gems +${reward.amount}` : `Wheel: gems +${reward.amount}`;
      return `Gems +${reward.amount}`;
    }
    if (reward.kind === "shards") {
      this.stats.shards += reward.amount;
      this.stats.rouletteLabel = `Wheel: shards +${reward.amount}`;
      return `Shards +${reward.amount}`;
    }
    if (reward.kind === "ticket") {
      this.save.tickets += reward.amount;
      saveGame(this.save);
      this.stats.rouletteLabel = `Wheel: ticket +${reward.amount}`;
      return `Ticket +${reward.amount}`;
    }
    if (reward.kind === "upgrade") {
      const label = this.grantRouletteUpgrade();
      if (label) {
        this.stats.rouletteLabel = `Wheel upgrade: ${label}`;
        return label;
      }
      this.stats.shards += 4;
      this.stats.rouletteLabel = "Upgrade converted: shards +4";
      return "Shards +4";
    }

    const skin = cosmeticCatalog.find((item) => item.cost > 0 && !this.save.ownedCosmetics.includes(item.key));
    if (skin) {
      this.save.ownedCosmetics.push(skin.key);
      this.save.equippedCosmetics[skin.slot] = skin.key;
      saveGame(this.save);
      this.applyCosmetics();
      this.stats.rouletteLabel = `Jackpot skin: ${skin.label}`;
      return skin.label;
    }
    this.stats.shards += 6;
    this.stats.rouletteLabel = "Jackpot converted: shards +6";
    return "Shards +6";
  }

  private applyDirectRouletteReward(reward: RouletteReward): string {
    let prizeLabel = "";
    let coins = 0;
    let gems = 0;
    let shards = 0;
    if (reward.kind === "coins") {
      coins = reward.amount;
      this.save.coins += coins;
      prizeLabel = `Coins +${coins}`;
    } else if (reward.kind === "gems") {
      gems = reward.amount;
      this.save.gems += gems;
      prizeLabel = `Gems +${gems}`;
    } else if (reward.kind === "shards") {
      shards = reward.amount;
      this.save.shards += shards;
      prizeLabel = `Shards +${shards}`;
    } else if (reward.kind === "ticket") {
      this.save.tickets += reward.amount;
      prizeLabel = `Ticket +${reward.amount}`;
    } else if (reward.kind === "upgrade") {
      const label = this.grantRouletteUpgrade();
      if (label) {
        prizeLabel = label;
      } else {
        shards = 4;
        this.save.shards += shards;
        prizeLabel = `Shards +${shards}`;
      }
    } else {
      const skin = cosmeticCatalog.find((item) => item.cost > 0 && !this.save.ownedCosmetics.includes(item.key));
      if (skin) {
        this.save.ownedCosmetics.push(skin.key);
        this.save.equippedCosmetics[skin.slot] = skin.key;
        this.applyCosmetics();
        prizeLabel = skin.label;
      } else {
        shards = 6;
        this.save.shards += shards;
        prizeLabel = `Shards +${shards}`;
      }
    }
    saveGame(this.save);
    this.extraSpinReward = {
      title: "Extra Spin Paid",
      kind: "Ticket Spin",
      score: 0,
      coins,
      gems,
      shards,
      medals: 0,
      stars: 0,
      castleXP: 0,
      castleLeveledUp: false,
      castleStage: "",
      extra: `No-ad ticket spin: ${prizeLabel}.`
    };
    return prizeLabel;
  }

  private showRoulettePrizeSprite(label: string, color: number): void {
    if (this.roulettePrizeSprite) {
      this.rouletteGroup.remove(this.roulettePrizeSprite);
    }
    const background = `#${color.toString(16).padStart(6, "0")}`;
    this.roulettePrizeSprite = this.makeTextSprite(label.toUpperCase(), background, "#ffffff");
    this.roulettePrizeSprite.position.set(0, -3.12, -0.38);
    this.roulettePrizeSprite.scale.set(2.2, 0.52, 1);
    this.rouletteGroup.add(this.roulettePrizeSprite);
  }

  private finishLevel(_bossDefeated: boolean, playRewardSound = true): void {
    this.mode = "reward";
    if (playRewardSound) {
      this.audio.reward();
    }
    this.pulseHaptic([16, 34, 24], 180);
    const reward = grantRunRewards(this.save, this.level.id, this.stats, this.level.targetScore, this.level.targetStair);
    this.hud.showReward(reward, this.save);
  }

  private failRun(_reason: string): void {
    if (this.mode === "fail" || this.mode === "reward") {
      return;
    }
    this.mode = "fail";
    this.speed = 0;
    this.pulseHaptic([42, 72, 42], 220);
    this.audio.fail();
    this.hud.showFail(this.stats);
  }

  private updatePlatforms(time: number): void {
    this.tracks.forEach((track) => {
      track.mesh.position.x = this.getTrackCenter(track.data, time);
      track.mesh.position.z = this.getTrackZCenter(track.data, time);
      track.mesh.position.y = -0.12 + this.getTrackVerticalOffset(track.data, time);
      if (track.data.kind === "turntable") {
        track.mesh.rotation.y = Math.sin(time * (track.data.speed ?? 1.2) + (track.data.phase ?? 0)) * 0.12;
      }
      if (track.data.kind === "tilting") {
        track.mesh.rotation.z = Math.sin(time * (track.data.speed ?? 1.4) + (track.data.phase ?? 0)) * 0.16;
      }
      if (track.data.kind === "collapsing") {
        track.mesh.position.y = track.mesh.userData.triggered ? -0.46 : -0.12;
      }
    });
  }

  private updateDecorations(time: number, dt: number): void {
    this.decorGroup.children.forEach((item) => {
      this.animateTaggedObject(item, time, dt);
    });
    if (this.stairVault) {
      const lid = this.stairVault.userData.lid as THREE.Object3D | undefined;
      const pulse = this.stairFinaleStarted ? 1 + Math.sin(time * 8) * 0.035 : 1;
      this.stairVault.scale.set(pulse, pulse, pulse);
      this.stairVault.rotation.y = Math.sin(time * 1.5) * 0.05;
      if (lid) {
        lid.rotation.x = this.stairFinaleStarted ? -Math.min(1, this.stairFinaleTimer / 0.8) * 0.95 : 0;
      }
    }
  }

  private animateEntities(time: number, dt: number): void {
    this.entities.forEach((entity) => {
      if (entity.consumed) {
        return;
      }
      if (entity.data.kind === "gate" && entity.data.altOp && entity.data.altValue !== undefined) {
        this.updateTimedGateLabel(entity);
      }
      this.animateTaggedObject(entity.mesh, time, dt);
      if (entity.data.kind === "gate" || entity.data.kind === "colorGate" || entity.data.kind === "weakPointGate") {
        entity.mesh.position.x = this.getGateX(entity.data, time);
        if (entity.data.range && entity.data.speed) {
          entity.mesh.rotation.y = Math.sin(time * entity.data.speed + (entity.data.phase ?? 0)) * 0.14;
        }
      } else if (entity.data.kind === "coin" || entity.data.kind === "gem") {
        entity.mesh.rotation.y += dt * 4;
        entity.mesh.position.y = 0.68 + Math.sin(time * 4 + entity.data.z) * 0.08;
      } else if (entity.data.kind === "jumpPad") {
        entity.mesh.position.y = 0.18 + Math.sin(time * 6 + entity.data.z) * 0.018;
      } else if (this.isCollectable(entity.data.kind)) {
        entity.mesh.rotation.y += dt * 2.2;
        entity.mesh.position.y = 0.7 + Math.sin(time * 3 + entity.data.z) * 0.08;
      } else if (entity.data.kind === "enemy" || entity.data.kind === "enemyGate") {
        entity.mesh.position.x = this.currentBattle === entity ? this.battleX : this.getEnemyX(entity.data, time);
        if (entity.data.kind === "enemyGate") {
          entity.mesh.rotation.y = Math.sin(time * 2.4 + entity.data.z) * 0.035;
        }
        const models = entity.mesh.userData.enemyModels as THREE.Object3D[] | undefined;
        const ring = entity.mesh.userData.enemyRing as THREE.Object3D | undefined;
        const variant = entity.mesh.userData.enemyVariant as string | undefined;
        const battleProgress = Number(entity.mesh.userData.battleProgress ?? 0);
        if (ring) {
          ring.rotation.z += dt * (variant === "armored" ? -0.9 : 0.7);
          ring.scale.setScalar(1 + Math.sin(time * (battleProgress > 0 ? 11 : 4) + entity.data.z) * (battleProgress > 0 ? 0.08 : 0.035));
        }
        models?.forEach((model, index) => {
          if (!model.visible) {
            return;
          }
          const phase = model.userData.phase ?? index;
          const baseX = model.userData.baseX ?? model.position.x;
          const baseZ = model.userData.baseZ ?? model.position.z;
          const battleLean = battleProgress > 0 ? Math.sin(time * 13 + phase) * 0.12 : 0;
          const march = Math.sin(time * (variant === "armored" ? 4.4 : 5.7) + phase);
          model.position.x = baseX + Math.sin(time * 2.2 + phase) * (battleProgress > 0 ? 0.07 : 0.035);
          model.position.y = 0.38 + Math.max(0, march) * (variant === "armored" ? 0.035 : 0.07);
          model.position.z = baseZ + Math.cos(time * 3.1 + phase) * 0.026 + battleProgress * 0.22;
          model.rotation.y = Math.sin(time * 4.2 + phase) * (variant === "armored" ? 0.08 : 0.16) + battleLean;
          model.scale.set(1 + Math.max(0, march) * 0.025, 1 - Math.max(0, march) * 0.018, 1 + Math.max(0, march) * 0.025);
        });
      } else if (entity.data.kind === "rotatingBar") {
        entity.mesh.rotation.y += dt * (entity.data.speed ?? 2.4);
      } else if (entity.data.kind === "sawLane") {
        const saw = entity.mesh.userData.saw as THREE.Object3D | undefined;
        if (saw) {
          saw.rotation.y += dt * 9;
        }
      } else if (entity.data.kind === "crusher") {
        const active = Math.sin(time * (entity.data.speed ?? 2.4) + (entity.data.phase ?? 0));
        const hammer = entity.mesh.userData.crusherHammer as THREE.Object3D | undefined;
        if (hammer) {
          hammer.position.y = active > 0.2 ? 0.6 : 2.15;
        }
      } else if (entity.data.kind === "laser") {
        const active = Math.sin(time * (entity.data.speed ?? 2.4) + (entity.data.phase ?? 0)) > 0.15;
        const beam = entity.mesh.userData.laserBeam as THREE.Object3D | undefined;
        const beamGlow = entity.mesh.userData.laserGlow as THREE.Object3D | undefined;
        if (beam) {
          beam.visible = active;
        }
        if (beamGlow) {
          beamGlow.visible = active;
          beamGlow.scale.y = 1 + Math.sin(time * 12) * 0.18;
        }
      } else if (entity.data.kind === "fan") {
        const fan = entity.mesh.userData.fan as THREE.Object3D | undefined;
        if (fan) {
          fan.rotation.x += dt * 9;
        }
      } else if (entity.data.kind === "swingingAxe") {
        entity.mesh.rotation.z = Math.sin(time * (entity.data.speed ?? 1.9) + (entity.data.phase ?? 0)) * 0.95;
      } else if (entity.data.kind === "spikeRoller") {
        entity.mesh.position.x = this.getHazardX(entity.data, time);
        entity.mesh.rotation.z += dt * 7;
      } else if (entity.data.kind === "cannon") {
        const ball = entity.mesh.userData.ball as THREE.Object3D | undefined;
        if (ball) {
          ball.position.x = this.getHazardX(entity.data, time) - entity.data.x;
        }
      }
    });
  }

  private updateFloating(dt: number): void {
    this.floating = this.floating.filter((item) => {
      item.life -= dt;
      item.velocity.y -= 2.2 * dt;
      item.mesh.position.addScaledVector(item.velocity, dt);
      if (item.angularVelocity) {
        item.mesh.rotation.x += item.angularVelocity.x * dt;
        item.mesh.rotation.y += item.angularVelocity.y * dt;
        item.mesh.rotation.z += item.angularVelocity.z * dt;
      }
      item.mesh.scale.multiplyScalar(0.985);
      if (item.life <= 0) {
        this.scene.remove(item.mesh);
        return false;
      }
      return true;
    });
  }

  private updateCrowdInstances(time: number): void {
    let visible = Math.min(this.maxVisibleCrew, Math.max(0, Math.floor(this.count)));
    if (this.mode === "stairs" && this.stairFinaleStarted) {
      visible = Math.max(visible, Math.min(this.maxVisibleCrew, Math.max(10, Math.floor(this.stats.finalStair * 1.5))));
    }
    this.bodyInstances.count = visible;
    this.bodyHighlightInstances.count = visible;
    this.visorInstances.count = visible;
    this.packInstances.count = visible;
    this.hatInstances.count = visible;
    this.trailInstances.count = visible;
    this.shadowInstances.count = visible;
    this.leftLegInstances.count = visible;
    this.rightLegInstances.count = visible;
    const spacing = clamp(0.52 - this.save.upgrades.formation * 0.025 - (this.commanderTimer > 0 ? 0.08 : 0), 0.34, 0.52);
    const perRow = Math.max(3, Math.ceil(Math.sqrt(Math.max(visible, 1)) * 1.42));
    const track = this.getTrackAt(this.distance);
    const trackWidth = track?.data.width ?? 7;
    const maxRowWidth = Math.max(3, Math.floor(trackWidth / spacing) - 1);
    const rowLimit = Math.min(perRow, maxRowWidth);
    const jumpHeight = this.mode === "run" ? this.getJumpHeight() : 0;

    for (let index = 0; index < this.maxVisibleCrew; index += 1) {
      if (index >= visible) {
        this.shadowInstances.setMatrixAt(index, this.hiddenMatrix);
        this.bodyInstances.setMatrixAt(index, this.hiddenMatrix);
        this.bodyHighlightInstances.setMatrixAt(index, this.hiddenMatrix);
        this.visorInstances.setMatrixAt(index, this.hiddenMatrix);
        this.packInstances.setMatrixAt(index, this.hiddenMatrix);
        this.hatInstances.setMatrixAt(index, this.hiddenMatrix);
        this.trailInstances.setMatrixAt(index, this.hiddenMatrix);
        this.leftLegInstances.setMatrixAt(index, this.hiddenMatrix);
        this.rightLegInstances.setMatrixAt(index, this.hiddenMatrix);
        continue;
      }
      const row = Math.floor(index / rowLimit);
      const col = index % rowLimit;
      const rowCount = Math.min(rowLimit, visible - row * rowLimit);
      const offsetX = (col - (rowCount - 1) / 2) * spacing;
      const offsetZ = -row * 0.43 + Math.sin(index * 1.7) * 0.035;
      let bob = Math.sin(time * 9 + index * 0.9) * 0.045;
      let y = 0.55 + bob + jumpHeight;
      let z = this.distance + offsetZ;
      let x = this.centerX + offsetX + Math.sin(time * 5 + index) * 0.035;
      let yaw = Math.sin(time * 4 + index) * 0.05;

      if (this.mode === "stairs") {
        if (this.stairFinaleStarted) {
          const lane = (index % 8) - 3.5;
          const partyRow = Math.floor(index / 8);
          const jump = Math.max(0, Math.sin(time * 12 + index * 0.62)) * 0.24;
          x = lane * 0.31 + Math.sin(time * 4 + index) * 0.07;
          z = this.level.length + 25.2 - partyRow * 0.28 + Math.sin(index * 1.3) * 0.08;
          y = 4.32 + jump;
          bob = jump * 0.4;
          yaw = Math.sin(time * 10 + index) * 0.34;
        } else {
          const lane = (index % 6) - 2.5;
          const stride = (time * 7.5 + index * 0.31) % 1;
          const progress = clamp((this.stats.finalStair + index * 0.22 + stride * 0.7) / 24, 0, 1);
          const stepHop = Math.sin(stride * Math.PI) * 0.12;
          x = lane * 0.28 + Math.sin(time * 9 + index) * 0.035;
          z = this.level.length + 8 + progress * 18.2;
          y = 0.5 + progress * 3.78 + stepHop;
          bob = Math.sin(time * 16 + index * 0.8) * 0.055;
          yaw = Math.sin(time * 7 + index) * 0.1;
        }
      } else if (this.mode === "battle") {
        const battleProgress = clamp(this.battleTimer / Math.max(0.1, this.battleDuration), 0, 1);
        const attackWave = Math.max(0, Math.sin(time * 13.5 - row * 0.72));
        const frontPush = row < 6 ? attackWave * (0.42 + battleProgress * 0.18) : attackWave * 0.18;
        x = this.battleX + offsetX * 0.82 + Math.sin(time * 10 + index) * 0.07;
        z = this.battleZ - 0.55 - row * 0.34 + frontPush;
        y = 0.55 + bob + attackWave * 0.12;
        yaw = Math.sin(time * 12 + index * 0.45) * 0.32;
      } else if (this.mode === "boss" || this.mode === "bossVictory") {
        const attackWave = Math.max(0, Math.sin(time * 5.8 - row * 0.85));
        const victoryPush = this.mode === "bossVictory" ? clamp(this.bossVictoryTimer / 1.3, 0, 1) : 0;
        const gateRush = this.mode === "bossVictory" ? clamp((this.bossVictoryTimer - 0.72) / 1.65, 0, 1) : 0;
        x = this.centerX + offsetX + Math.sin(time * 9 + index) * 0.07;
        z =
          this.distance +
          offsetZ +
          attackWave * (row < 5 ? 0.78 : 0.32) +
          victoryPush * (1.65 + row * 0.035) +
          gateRush * (2.15 + row * 0.05);
        y = 0.55 + bob + attackWave * 0.07 + Math.sin(time * 13 + index) * 0.05 * victoryPush + Math.sin(time * 14 + index * 0.7) * 0.1 * gateRush;
        yaw = Math.sin(time * 8 + index * 0.5) * (0.16 + victoryPush * 0.08 + gateRush * 0.12);
      }

      this.tmpEuler.set(0, yaw, 0);
      this.tmpQuaternion.setFromEuler(this.tmpEuler);
      const impact = this.crowdImpactPulse * clamp(1 - row * 0.07, 0.28, 1);
      const shadowWidth = clamp(0.82 + row * 0.012 - jumpHeight * 0.26, 0.58, 1.12);
      const shadowLength = clamp(0.62 + row * 0.008 - jumpHeight * 0.18, 0.44, 0.88);
      const shadowY = this.mode === "stairs" ? Math.max(0.035, y - 0.52 - Math.max(0, bob) * 0.45) : 0.026;
      this.tmpScale.set(shadowWidth, shadowLength, 1);
      this.tmpPosition.set(x, shadowY, z - 0.04);
      this.tmpMatrix.compose(this.tmpPosition, this.flatQuaternion, this.tmpScale);
      this.shadowInstances.setMatrixAt(index, this.tmpMatrix);

      this.tmpScale.set(1 + impact * 0.18, 1 - impact * 0.16, 1 + impact * 0.12);
      this.tmpPosition.set(x, y, z);
      this.tmpMatrix.compose(this.tmpPosition, this.tmpQuaternion, this.tmpScale);
      this.bodyInstances.setMatrixAt(index, this.tmpMatrix);

      this.tmpScale.set(1 + impact * 0.05, 1 + impact * 0.04, 1);
      this.tmpPosition.set(x - 0.12, y + 0.08, z + 0.285);
      this.tmpMatrix.compose(this.tmpPosition, this.tmpQuaternion, this.tmpScale);
      this.bodyHighlightInstances.setMatrixAt(index, this.tmpMatrix);

      this.tmpScale.set(1 + impact * 0.18, 1 - impact * 0.16, 1 + impact * 0.12);
      this.tmpPosition.set(x, y + 0.17, z + 0.29);
      this.tmpMatrix.compose(this.tmpPosition, this.tmpQuaternion, this.tmpScale);
      this.visorInstances.setMatrixAt(index, this.tmpMatrix);

      this.tmpScale.set((1 + impact * 0.18) * this.packScaleX, (1 - impact * 0.16) * this.packScaleY, (1 + impact * 0.12) * this.packScaleZ);
      this.tmpPosition.set(x, y + this.packOffsetY, z + this.packOffsetZ);
      this.tmpMatrix.compose(this.tmpPosition, this.tmpQuaternion, this.tmpScale);
      this.packInstances.setMatrixAt(index, this.tmpMatrix);

      if (this.hatEquipped) {
        const hatBob = Math.sin(time * 8 + index * 0.73) * 0.018;
        this.tmpScale.set(this.hatScaleX + impact * 0.08, this.hatScaleY + impact * 0.06, this.hatScaleZ + impact * 0.08);
        this.tmpPosition.set(x, y + this.hatOffsetY + hatBob, z + this.hatOffsetZ);
        this.tmpMatrix.compose(this.tmpPosition, this.tmpQuaternion, this.tmpScale);
        this.hatInstances.setMatrixAt(index, this.tmpMatrix);
      } else {
        this.hatInstances.setMatrixAt(index, this.hiddenMatrix);
      }

      if (this.trailEquipped) {
        const trailScale = clamp(0.75 + Math.abs(bob) * 4 + (this.frenzyTimer > 0 ? 0.35 : 0), 0.72, 1.24);
        this.tmpScale.set((0.65 + impact * 0.08) * this.trailWidthScale, 1, trailScale * this.trailLengthScale);
        this.tmpPosition.set(x, this.trailOffsetY, z + this.trailOffsetZ);
        this.tmpMatrix.compose(this.tmpPosition, this.tmpQuaternion, this.tmpScale);
        this.trailInstances.setMatrixAt(index, this.tmpMatrix);
      } else {
        this.trailInstances.setMatrixAt(index, this.hiddenMatrix);
      }

      this.tmpScale.set(1 + impact * 0.18, 1 - impact * 0.16, 1 + impact * 0.12);
      const stride = Math.sin(time * 12 + index * 0.7) * 0.05;
      this.tmpPosition.set(x - 0.13, y - 0.39 + bob * 0.3, z + stride);
      this.tmpMatrix.compose(this.tmpPosition, this.tmpQuaternion, this.tmpScale);
      this.leftLegInstances.setMatrixAt(index, this.tmpMatrix);
      this.tmpPosition.set(x + 0.13, y - 0.39 + bob * 0.3, z - stride);
      this.tmpMatrix.compose(this.tmpPosition, this.tmpQuaternion, this.tmpScale);
      this.rightLegInstances.setMatrixAt(index, this.tmpMatrix);
    }
    this.shadowInstances.instanceMatrix.needsUpdate = true;
    this.bodyInstances.instanceMatrix.needsUpdate = true;
    this.bodyHighlightInstances.instanceMatrix.needsUpdate = true;
    this.visorInstances.instanceMatrix.needsUpdate = true;
    this.packInstances.instanceMatrix.needsUpdate = true;
    this.hatInstances.instanceMatrix.needsUpdate = true;
    this.trailInstances.instanceMatrix.needsUpdate = true;
    this.leftLegInstances.instanceMatrix.needsUpdate = true;
    this.rightLegInstances.instanceMatrix.needsUpdate = true;
  }

  private updateStatusAuras(time: number): void {
    const canShow =
      this.count > 0 &&
      (this.mode === "run" || this.mode === "battle" || this.mode === "boss" || this.mode === "bossVictory" || this.mode === "stairs");
    const hasStatus = this.shield > 0 || this.magnetTimer > 0 || this.frenzyTimer > 0 || this.commanderTimer > 0;
    this.statusGroup.visible = canShow && hasStatus;
    if (!this.statusGroup.visible) {
      return;
    }

    const focusX = this.mode === "battle" ? this.battleX : this.centerX;
    const focusZ =
      this.mode === "battle"
        ? this.battleZ - 0.82
        : this.mode === "stairs"
          ? this.level.length + 8 + clamp(this.stats.finalStair / 24, 0, 1) * 18.2
          : this.distance - 0.28;
    const radius = clamp(this.formationRadius() + 0.62, 1.15, 3.1);
    this.statusGroup.position.set(focusX, 0, focusZ);

    if (this.shieldAura) {
      this.shieldAura.visible = this.shield > 0;
      const pulse = 1 + Math.sin(time * 4.2) * 0.035;
      this.shieldAura.scale.set(radius * pulse, 0.58 + Math.sin(time * 3.8) * 0.035, radius * pulse);
      this.shieldAura.rotation.y += 0.018;
      this.materials.statusShield.opacity = 0.13 + Math.sin(time * 5.4) * 0.035;
    }
    if (this.magnetAura) {
      this.magnetAura.visible = this.magnetTimer > 0;
      const pulse = 1 + Math.sin(time * 7.2) * 0.045;
      this.magnetAura.scale.set(radius * 1.24 * pulse, radius * 1.24 * pulse, 1);
      this.magnetAura.rotation.z -= 0.08;
      this.materials.statusMagnet.opacity = 0.34 + Math.sin(time * 8.5) * 0.08;
    }
    if (this.frenzyAura) {
      this.frenzyAura.visible = this.frenzyTimer > 0;
      const pulse = 1 + Math.sin(time * 11.5) * 0.06;
      this.frenzyAura.scale.set(radius * 1.08 * pulse, radius * 1.08 * pulse, 1);
      this.frenzyAura.rotation.z += 0.12;
      this.materials.statusFrenzy.opacity = 0.28 + Math.sin(time * 12) * 0.08;
    }
    if (this.commanderAura) {
      this.commanderAura.visible = this.commanderTimer > 0;
      const pulse = 1 + Math.sin(time * 5.8) * 0.035;
      this.commanderAura.scale.set(radius * 0.82 * pulse, radius * 0.82 * pulse, 1);
      this.commanderAura.rotation.z += 0.045;
      this.materials.statusCommander.opacity = 0.36 + Math.sin(time * 6.6) * 0.07;
    }
  }

  private updateCamera(dt: number): void {
    const isBossScene = this.mode === "boss" || this.mode === "bossVictory";
    const isBossVictory = this.mode === "bossVictory";
    const isStairFinale = this.mode === "stairs" && this.stairFinaleStarted;
    const isBattleScene = this.mode === "battle";
    const rigKey =
      this.mode === "roulette"
        ? "roulette"
        : isBossVictory
          ? "bossVictory"
          : isBossScene
            ? "boss"
            : isBattleScene
              ? "battle"
              : isStairFinale
                ? "stairFinale"
                : this.mode === "stairs"
                  ? "stairs"
                  : "run";
    if (rigKey !== this.cameraRigKey) {
      this.cameraRigKey = rigKey;
      this.cameraBlendTimer = 0.82;
    }
    this.cameraBlendTimer = Math.max(0, this.cameraBlendTimer - dt);
    const targetZ =
      this.mode === "roulette"
        ? this.level.length + 18
        : isBossVictory
          ? this.level.length + 19
          : isBossScene
          ? this.level.length + 15.5
          : isBattleScene
            ? this.battleZ + 2.8
          : isStairFinale
            ? this.level.length + 28
          : this.mode === "stairs"
            ? this.level.length + 18.2
            : this.distance + 8;
    const targetY = this.mode === "roulette" ? 5.4 : isBossVictory ? 7.9 : isBossScene ? 7.5 : isBattleScene ? 5.9 : isStairFinale ? 6.9 : this.mode === "stairs" ? 6.15 : 8.5;
    const cameraZ =
      this.mode === "roulette"
        ? this.level.length + 9
        : isBossVictory
          ? this.distance - 8.2
          : isBossScene
          ? this.distance - 9.5
          : isBattleScene
            ? this.battleZ - 6.2
          : isStairFinale
            ? this.level.length + 15.5
          : this.mode === "stairs"
            ? this.level.length + 5.8
            : this.distance - 10.5;
    const shake = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.6 : 0;
    const lookY = isBossVictory ? 1.9 : isStairFinale ? 3.1 : this.mode === "stairs" ? 1.35 : 0.75;
    const lookX = isBattleScene ? this.battleX * 0.35 : this.centerX * 0.35;
    const transition = this.cameraBlendTimer > 0;
    const positionDamp = transition ? 2.6 : 5.2;
    const lookDamp = transition ? 3.1 : 8.5;
    this.camera.position.x = damp(this.camera.position.x, (isBattleScene ? this.battleX : this.centerX) * 0.42 + shake, positionDamp, dt);
    this.camera.position.y = damp(this.camera.position.y, targetY + Math.abs(shake), transition ? 2.4 : 4.5, dt);
    this.camera.position.z = damp(this.camera.position.z, cameraZ, transition ? 2.7 : 5.2, dt);
    this.tmpCameraLookTarget.set(lookX, lookY, targetZ);
    this.cameraLookTarget.lerp(this.tmpCameraLookTarget, 1 - Math.exp(-lookDamp * dt));
    this.camera.lookAt(this.cameraLookTarget);
  }

  private pulseHaptic(pattern: number | number[], minGap = 80): void {
    if (!("vibrate" in navigator) || document.visibilityState !== "visible") {
      return;
    }
    const now = performance.now();
    if (now - this.lastHapticTime < minGap) {
      return;
    }
    this.lastHapticTime = now;
    navigator.vibrate(pattern);
  }

  private updatePointerTarget(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (this.raycaster.ray.intersectPlane(this.pointerPlane, this.pointerHit)) {
      this.targetX = clamp(this.pointerHit.x, -4, 4);
    }
  }

  private formationRadius(): number {
    const commanderBoost = this.commanderTimer > 0 ? 0.32 : 0;
    return clamp(0.45 + Math.sqrt(Math.max(1, this.count)) * 0.11 - this.save.upgrades.formation * 0.04 - commanderBoost, 0.38, 2.3);
  }

  private getJumpHeight(): number {
    if (this.jumpTimer <= 0) {
      return 0;
    }
    const progress = 1 - this.jumpTimer / this.jumpDuration;
    return Math.sin(clamp(progress, 0, 1) * Math.PI) * 0.92;
  }

  private spawnBurst(x: number, z: number, color: number): void {
    for (let index = 0; index < 8; index += 1) {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), material);
      mesh.position.set(x, 0.6, z);
      this.scene.add(mesh);
      this.floating.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 2.6, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 2.6),
        life: 0.8
      });
    }
  }

  private spawnBattleClash(x: number, z: number, loss: number): void {
    const colors = [0xef476f, 0xffd166, 0xffffff, 0x7c3aed];
    const count = Math.min(20, 8 + Math.floor(loss / 4));
    for (let index = 0; index < count; index += 1) {
      const material = new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.42, metalness: 0.08, transparent: true, opacity: 0.92 });
      const slash = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.12), material);
      const side = index % 2 === 0 ? -1 : 1;
      slash.position.set(x + (Math.random() - 0.5) * 1.2, 0.78 + Math.random() * 0.7, z + (Math.random() - 0.5) * 1.2);
      slash.rotation.set(Math.random() * 0.8, side * 0.55, Math.random() * Math.PI);
      this.scene.add(slash);
      this.floating.push({
        mesh: slash,
        velocity: new THREE.Vector3(side * (0.8 + Math.random() * 1.7), 0.85 + Math.random() * 1.2, (Math.random() - 0.5) * 2.2),
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 10, side * 8, (Math.random() - 0.5) * 16),
        life: 0.95 + Math.random() * 0.45
      });
    }
    this.spawnEnemyKnockouts(Math.min(loss, 12), x, z + 0.25);
  }

  private spawnEnemyKnockouts(loss: number, x: number, z: number): void {
    const count = Math.min(8, Math.max(1, Math.floor(loss / 2)));
    for (let index = 0; index < count; index += 1) {
      const model = this.createCrewModel(this.materials.enemy, this.materials.enemyVisor, this.materials.hazardDark, 0.48);
      const side = index % 2 === 0 ? -1 : 1;
      model.position.set(x + (Math.random() - 0.5) * 1.15, 0.48 + Math.random() * 0.34, z + (Math.random() - 0.5) * 0.9);
      model.rotation.set((Math.random() - 0.5) * 0.9, Math.random() * Math.PI, (Math.random() - 0.5) * 0.9);
      this.scene.add(model);
      this.floating.push({
        mesh: model,
        velocity: new THREE.Vector3(side * (1.05 + Math.random() * 1.8), 1.25 + Math.random() * 1.45, 0.75 + Math.random() * 1.45),
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10, side * (4.5 + Math.random() * 5.5)),
        life: 1.1 + Math.random() * 0.5
      });
    }
  }

  private spawnCrewKnockouts(loss: number, x = this.centerX, z = this.distance): void {
    const count = Math.min(8, Math.max(1, Math.floor(loss / 3)));
    for (let index = 0; index < count; index += 1) {
      const model = this.createCrewModel(this.materials.body, this.materials.visor, this.materials.pack, 0.5);
      const side = index % 2 === 0 ? -1 : 1;
      model.position.set(x + (Math.random() - 0.5) * 0.9, 0.45 + Math.random() * 0.25, z - 0.35 + Math.random() * 0.7);
      model.rotation.set((Math.random() - 0.5) * 0.8, Math.random() * Math.PI, (Math.random() - 0.5) * 0.8);
      this.scene.add(model);
      this.floating.push({
        mesh: model,
        velocity: new THREE.Vector3(side * (0.85 + Math.random() * 1.6), 1.35 + Math.random() * 1.35, -0.5 - Math.random() * 1.35),
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 9, side * (4 + Math.random() * 5)),
        life: 1.15 + Math.random() * 0.45
      });
    }
  }

  private spawnBossConfetti(): void {
    const colors = [0xffd166, 0x58f29a, 0x36c9f6, 0xef476f, 0x9b5de5, 0xffffff];
    for (let index = 0; index < 72; index += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: colors[index % colors.length],
        roughness: 0.52,
        metalness: 0.03,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.18), material);
      const side = index % 2 === 0 ? -1 : 1;
      mesh.position.set(side * (1.2 + Math.random() * 1.4), 2.15 + Math.random() * 1.2, this.level.length + 16.2 + (Math.random() - 0.5) * 3.6);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(mesh);
      this.floating.push({
        mesh,
        velocity: new THREE.Vector3(side * (0.9 + Math.random() * 2.1), 1.35 + Math.random() * 1.8, (Math.random() - 0.5) * 2.8),
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 16),
        life: 1.9 + Math.random() * 0.8
      });
    }
  }

  private spawnStairConfetti(): void {
    const colors = [0xffd166, 0x58f29a, 0x36c9f6, 0xef476f, 0x9b5de5, 0xffffff];
    for (let index = 0; index < 56; index += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: colors[index % colors.length],
        roughness: 0.48,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.2), material);
      mesh.position.set((Math.random() - 0.5) * 5.2, 4.8 + Math.random() * 1.1, this.level.length + 28 + (Math.random() - 0.5) * 3.2);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(mesh);
      this.floating.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 3.1, 1.2 + Math.random() * 1.7, (Math.random() - 0.5) * 2.6),
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 16),
        life: 2.1 + Math.random() * 0.55
      });
    }
  }

  private makeWheelSegment(innerRadius: number, outerRadius: number, startAngle: number, endAngle: number): THREE.ShapeGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(startAngle) * innerRadius, Math.sin(startAngle) * innerRadius);
    shape.lineTo(Math.cos(startAngle) * outerRadius, Math.sin(startAngle) * outerRadius);
    shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);
    shape.lineTo(Math.cos(endAngle) * innerRadius, Math.sin(endAngle) * innerRadius);
    shape.absarc(0, 0, innerRadius, endAngle, startAngle, true);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 24);
  }

  private makeTextSprite(text: string, background: string, foreground: string): THREE.Sprite {
    const cacheKey = `${background}|${foreground}|${text}`;
    let texture = this.textTextureCache.get(cacheKey);
    if (!texture) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 160;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas 2D unavailable");
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = background;
      this.roundRect(context, 24, 20, 464, 120, 30);
      context.fillStyle = foreground;
      context.font = "900 72px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 256, 82);
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textTextureCache.set(cacheKey, texture);
    }
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(material);
  }

  private roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fill();
  }

  private applyCosmetics(): void {
    const body = getEquippedCosmetic(this.save, "body");
    const visor = getEquippedCosmetic(this.save, "visor");
    const pack = getEquippedCosmetic(this.save, "backpack");
    const hat = getEquippedCosmetic(this.save, "hat");
    const trail = getEquippedCosmetic(this.save, "trail");
    this.materials.body.color.setHex(body.primary);
    this.materials.pack.color.setHex(pack.primary);
    this.materials.pack.emissive.setHex(pack.secondary ?? 0x000000);
    this.materials.pack.emissiveIntensity = pack.secondary ? 0.12 : 0.02;
    this.materials.visor.color.setHex(visor.primary);
    this.materials.hat.color.setHex(hat.primary);
    this.materials.hat.emissive.setHex(hat.secondary ?? 0x000000);
    this.materials.hat.emissiveIntensity = hat.secondary ? 0.08 : 0;
    this.hatEquipped = hat.key !== "no-hat";
    this.materials.trail.color.setHex(trail.primary);
    this.materials.trail.emissive.setHex(trail.secondary ?? trail.primary);
    this.trailEquipped = trail.key !== "plain-trail";
    this.materials.trail.opacity = this.trailEquipped ? 0.64 : 0.5;
    this.materials.trail.emissiveIntensity = this.trailEquipped ? 0.35 : 0.1;

    this.packInstances.geometry =
      pack.key === "jet-pack" || pack.key === "rocket-pack"
        ? this.geometries.packJet
        : pack.key === "star-pack" || pack.key === "vault-pack"
          ? this.geometries.packVault
          : this.geometries.pack;
    this.packOffsetY = pack.key === "star-pack" || pack.key === "vault-pack" ? 0.05 : pack.key === "jet-pack" || pack.key === "rocket-pack" ? 0.02 : 0.01;
    this.packOffsetZ = pack.key === "star-pack" || pack.key === "vault-pack" ? -0.35 : -0.33;
    this.packScaleX = pack.key === "star-pack" || pack.key === "vault-pack" ? 1.16 : pack.key === "jet-pack" || pack.key === "rocket-pack" ? 0.9 : 1;
    this.packScaleY = pack.key === "jet-pack" || pack.key === "rocket-pack" ? 1.08 : 1;
    this.packScaleZ = pack.key === "star-pack" || pack.key === "vault-pack" ? 0.78 : 1;

    if (hat.key === "crown-hat") {
      this.hatInstances.geometry = this.geometries.hatCrown;
      this.hatOffsetY = 0.82;
      this.hatOffsetZ = 0.02;
      this.hatScaleX = 0.92;
      this.hatScaleY = 0.88;
      this.hatScaleZ = 0.92;
    } else if (hat.key === "antenna-hat") {
      this.hatInstances.geometry = this.geometries.hatAntenna;
      this.hatOffsetY = 0.92;
      this.hatOffsetZ = 0.02;
      this.hatScaleX = 0.64;
      this.hatScaleY = 1.1;
      this.hatScaleZ = 0.64;
    } else if (hat.key === "party-hat") {
      this.hatInstances.geometry = this.geometries.hatParty;
      this.hatOffsetY = 0.86;
      this.hatOffsetZ = 0.02;
      this.hatScaleX = 0.9;
      this.hatScaleY = 0.95;
      this.hatScaleZ = 0.9;
    } else if (hat.key === "knight-helmet") {
      this.hatInstances.geometry = this.geometries.hatHelmet;
      this.hatOffsetY = 0.72;
      this.hatOffsetZ = 0.01;
      this.hatScaleX = 1.04;
      this.hatScaleY = 0.74;
      this.hatScaleZ = 1.04;
    } else {
      this.hatInstances.geometry = this.geometries.hat;
      this.hatOffsetY = 0.7;
      this.hatOffsetZ = 0.03;
      this.hatScaleX = 0.78;
      this.hatScaleY = 0.72;
      this.hatScaleZ = 0.78;
    }

    this.trailWidthScale = trail.key === "comet-trail" || trail.key === "royal-trail" ? 1.22 : trail.key === "medal-trail" ? 1.1 : 1;
    this.trailLengthScale = trail.key === "comet-trail" || trail.key === "royal-trail" ? 1.42 : trail.key === "neon-trail" ? 1.25 : 1;
    this.trailOffsetY = trail.key === "medal-trail" || trail.key === "royal-trail" ? 0.13 : 0.105;
    this.trailOffsetZ = trail.key === "comet-trail" || trail.key === "royal-trail" ? -0.82 : -0.74;
  }

  private createStats(): RunStats {
    return {
      score: 0,
      coins: 0,
      gems: 0,
      shards: 0,
      medals: 0,
      maxCount: 0,
      losses: 0,
      gates: 0,
      enemiesDefeated: 0,
      combo: 1,
      finalStair: 0,
      bossDefeated: false,
      rouletteLabel: "",
      noHit: true
    };
  }
}
