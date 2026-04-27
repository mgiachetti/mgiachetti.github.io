import * as THREE from "three";
import { AudioManager } from "../audio/AudioManager";
import { getLevel } from "../levels/levelCatalog";
import { Hud } from "../ui/Hud";
import { clamp, damp, seededRandom } from "../utils/math";
import { buyOrEquipCosmetic, buyUpgrade, cosmeticCatalog, getEquippedCosmetic, grantRunRewards, loadSave, resetSave, saveGame } from "./saveData";
import type { GameMode, LevelData, LevelEntity, RunStats, SaveData, TrackSegment } from "./types";

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
  kind: "coins" | "gems" | "ticket" | "skin";
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
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  private save: SaveData = loadSave();
  private mode: GameMode = "title";
  private level: LevelData = getLevel(1);
  private world = new THREE.Group();
  private crowd = new THREE.Group();
  private decorGroup = new THREE.Group();
  private bodyInstances: THREE.InstancedMesh;
  private visorInstances: THREE.InstancedMesh;
  private packInstances: THREE.InstancedMesh;
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
  private stairScoreMarker: THREE.Object3D | null = null;
  private stairVault: THREE.Group | null = null;
  private stairFinaleStarted = false;
  private stairFinaleTimer = 0;
  private rouletteGroup = new THREE.Group();
  private rouletteWheel: THREE.Group | null = null;
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
  private rouletteTimer = 0;
  private rouletteTick = 0;
  private rouletteSpinStart = 0;
  private rouletteSpinEnd = 0;
  private rouletteRevealTimer = 0;
  private rouletteResolved = false;
  private stairTimer = 0;
  private count = 1;
  private centerX = 0;
  private targetX = 0;
  private distance = 0;
  private speed = 0;
  private shield = 0;
  private magnetTimer = 0;
  private frenzyTimer = 0;
  private gooTimer = 0;
  private cameraShake = 0;
  private crowdImpactPulse = 0;
  private lastTime = 0;
  private pointerDown = false;
  private keyboardX = 0;
  private activeTeamColor: "cyan" | "lime" | "coral" | "violet" = "cyan";

  private stats: RunStats = this.createStats();

  private readonly maxVisibleCrew = 150;
  private readonly rouletteRewards: RouletteReward[] = [
    { kind: "coins", label: "Coins +150", shortLabel: "+150", amount: 150, color: 0xffd166, tone: "coin", weight: 1.8 },
    { kind: "gems", label: "Gems +3", shortLabel: "+3G", amount: 3, color: 0x7bdff2, tone: "good", weight: 1.25 },
    { kind: "coins", label: "Coins +300", shortLabel: "+300", amount: 300, color: 0xff9f1c, tone: "coin", weight: 1.05 },
    { kind: "ticket", label: "Ticket +1", shortLabel: "TK", amount: 1, color: 0x9b5de5, tone: "boss", weight: 0.78 },
    { kind: "coins", label: "Coins +500", shortLabel: "+500", amount: 500, color: 0xffca3a, tone: "coin", weight: 0.55 },
    { kind: "gems", label: "Gems +8", shortLabel: "+8G", amount: 8, color: 0x00f5d4, tone: "good", weight: 0.45 },
    { kind: "skin", label: "Jackpot Skin", shortLabel: "SKIN", amount: 1, color: 0xef476f, tone: "boss", weight: 0.18 },
    { kind: "gems", label: "Gems +12", shortLabel: "+12G", amount: 12, color: 0x5eead4, tone: "good", weight: 0.22 }
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
    visor: new THREE.MeshStandardMaterial({ color: 0xbdefff, roughness: 0.18, metalness: 0.2 }),
    pack: new THREE.MeshStandardMaterial({ color: 0x2087ad, roughness: 0.58, metalness: 0.05 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x7dd6f6, roughness: 0.82 }),
    enemy: new THREE.MeshStandardMaterial({ color: 0xf05252, roughness: 0.62, metalness: 0.04 }),
    enemyVisor: new THREE.MeshStandardMaterial({ color: 0x231942, roughness: 0.3, metalness: 0.1 }),
    track: new THREE.MeshStandardMaterial({ color: 0x67d7e5, roughness: 0.7, metalness: 0.03 }),
    trackDark: new THREE.MeshStandardMaterial({ color: 0x2b9bb6, roughness: 0.76, metalness: 0.03 }),
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
    trail: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, transparent: true, opacity: 0.62 })
  };

  private readonly teamColors = {
    cyan: 0x36c9f6,
    lime: 0x92e342,
    coral: 0xff6b6b,
    violet: 0x9b5de5
  };

  private readonly geometries = {
    body: new THREE.CapsuleGeometry(0.3, 0.54, 8, 18),
    visor: new THREE.BoxGeometry(0.46, 0.22, 0.08),
    pack: new THREE.BoxGeometry(0.24, 0.48, 0.16),
    leg: new THREE.CapsuleGeometry(0.1, 0.18, 6, 10),
    cube: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(0.5, 24, 16),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
    cone: new THREE.ConeGeometry(0.34, 0.62, 5),
    torus: new THREE.TorusGeometry(0.42, 0.08, 12, 28)
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.audio = new AudioManager(this.save.muted);
    const params = new URLSearchParams(window.location.search);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: params.has("pixel") || params.has("autostart")
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.bodyInstances = new THREE.InstancedMesh(this.geometries.body, this.materials.body, this.maxVisibleCrew);
    this.visorInstances = new THREE.InstancedMesh(this.geometries.visor, this.materials.visor, this.maxVisibleCrew);
    this.packInstances = new THREE.InstancedMesh(this.geometries.pack, this.materials.pack, this.maxVisibleCrew);
    this.leftLegInstances = new THREE.InstancedMesh(this.geometries.leg, this.materials.body, this.maxVisibleCrew);
    this.rightLegInstances = new THREE.InstancedMesh(this.geometries.leg, this.materials.body, this.maxVisibleCrew);
    this.bodyInstances.castShadow = true;
    this.visorInstances.castShadow = true;
    this.packInstances.castShadow = true;
    this.leftLegInstances.castShadow = true;
    this.rightLegInstances.castShadow = true;
    [this.bodyInstances, this.visorInstances, this.packInstances, this.leftLegInstances, this.rightLegInstances].forEach((mesh) => {
      mesh.frustumCulled = false;
    });
    this.crowd.add(this.leftLegInstances, this.rightLegInstances, this.bodyInstances, this.visorInstances, this.packInstances);

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

  async quickStart(levelNumber = this.save.currentLevel): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    await this.beginLevel(levelNumber, true);
    if (params.has("boss")) {
      const count = Number(params.get("count") ?? "80");
      this.count = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 80;
      this.stats.maxCount = Math.max(this.stats.maxCount, this.count);
      this.startBoss();
    } else if (params.has("stairs")) {
      const count = Number(params.get("count") ?? "60");
      this.count = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 60;
      this.stats.maxCount = Math.max(this.stats.maxCount, this.count);
      this.startStairs();
    } else if (params.has("roulette")) {
      this.startRoulette();
    }
  }

  private bindUi(): void {
    this.hud.onStart = () => void this.beginLevel(this.save.currentLevel);
    this.hud.onNext = () => void this.beginLevel(this.save.currentLevel);
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

    this.scene.add(this.world, this.crowd);
    this.camera.position.set(0, 8.5, -12);
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
    this.count = this.level.startCount + this.save.upgrades.startCrew * 2;
    this.shield = this.save.upgrades.shield > 0 ? 1 : 0;
    this.magnetTimer = 0;
    this.frenzyTimer = 0;
    this.gooTimer = 0;
    this.activeTeamColor = "cyan";
    this.materials.body.color.setHex(this.teamColors.cyan);
    this.cameraShake = 0;
    this.crowdImpactPulse = 0;
    this.bossBombs = 0;
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
    this.crowdImpactPulse = 0;
    this.stairsGroup.clear();
    this.bossGroup.clear();
    this.bossTelegraph = null;
    this.bossWeapon = null;
    this.bossRightArm = null;
    this.bossLeftArm = null;
    this.bossRightHand = null;
    this.bossBody = null;
    this.bossCrown = null;
    this.bossGate = null;
    this.stairScoreMarker = null;
    this.stairVault = null;
    this.stairFinaleStarted = false;
    this.stairFinaleTimer = 0;
    this.rouletteWheel = null;
    this.roulettePrizeSprite = null;
    this.rouletteGroup.clear();
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
    }

    const finishLabel = this.makeTextSprite(this.level.kind === "boss" ? "KING" : this.level.kind === "bonus" ? "SPIN" : "STAIRS", "#13223a", "#ffffff");
    finishLabel.position.set(0, 1.55, this.level.length - 2);
    finishLabel.scale.set(1.5, 0.38, 1);
    this.decorGroup.add(finishLabel);
    this.world.add(this.decorGroup);
  }

  private createTrackMesh(segment: TrackSegment): THREE.Mesh {
    const length = segment.zEnd - segment.zStart;
    const material =
      segment.kind === "moving"
        ? this.materials.movingTrack
        : segment.kind === "conveyor"
          ? this.materials.frenzy
          : segment.kind === "collapsing"
            ? this.materials.warning
            : segment.kind === "turntable"
              ? this.materials.gem
              : this.materials.track;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(segment.width, 0.32, length), material);
    mesh.position.set(segment.x ?? 0, -0.12, (segment.zStart + segment.zEnd) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.12, segment.width - 0.9), 0.04, 0.18), this.materials.trackDark);
    stripe.position.set(0, 0.19, 0);
    mesh.add(stripe);
    return mesh;
  }

  private createEntityMesh(entity: LevelEntity): THREE.Object3D {
    if (entity.kind === "gate" || entity.kind === "colorGate") {
      return this.createGateMesh(entity);
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
      entity.kind === "ticket" ||
      entity.kind === "bossBomb" ||
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
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width, 2.15, 0.18), helpful ? this.materials.gateGood : this.materials.gateBad);
    panel.position.y = 1.25;
    panel.castShadow = true;
    group.add(panel);
    [-width / 2, width / 2].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.5, 0.24), this.materials.gatePost);
      post.position.set(x, 1.15, 0);
      post.castShadow = true;
      group.add(post);
    });
    const label = this.makeTextSprite(entity.kind === "colorGate" ? `${(entity.color ?? "cyan").toUpperCase()}` : gate.label, helpful ? "#0d8f52" : "#b82032", "#ffffff");
    label.position.set(0, 2.75, -0.08);
    label.scale.set(2.4, 0.86, 1);
    group.userData.label = label;
    group.userData.labelText = entity.kind === "colorGate" ? `${(entity.color ?? "cyan").toUpperCase()}` : gate.label;
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
    return group;
  }

  private createPowerupMesh(entity: LevelEntity): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(entity.x, 0.72, entity.z);
    const materialByKind = {
      shield: this.materials.shield,
      magnet: this.materials.magnet,
      frenzy: this.materials.frenzy,
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
    const labelMap: Record<string, string> = { shield: "SH", magnet: "MG", frenzy: "FR", ticket: "TK", bossBomb: "B", colorPad: (entity.color ?? "cyan").slice(0, 2).toUpperCase() };
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

    if (entity.kind === "sideScraper") {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.35, entity.depth ?? 4), this.materials.hazard);
      wall.position.set(Math.sign(entity.x || 1) * 0.18, 0.72, 0);
      wall.castShadow = true;
      group.add(wall);
    } else if (entity.kind === "bumper") {
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 2.2, 0.38, entity.depth ?? 1.1), this.materials.hazard);
      bumper.position.y = 0.3;
      bumper.castShadow = true;
      group.add(bumper);
    } else if (entity.kind === "rotatingBar") {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 5.6, 0.22, 0.36), this.materials.hazard);
      bar.position.y = 0.7;
      bar.castShadow = true;
      group.add(bar);
    } else if (entity.kind === "sawLane") {
      const saw = new THREE.Mesh(this.geometries.cylinder, this.materials.hazard);
      saw.rotation.z = Math.PI / 2;
      saw.position.y = 0.28;
      saw.scale.set(0.72, 0.16, 0.72);
      saw.castShadow = true;
      group.add(saw);
    } else if (entity.kind === "crusher") {
      const hammer = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 2, 0.45, entity.depth ?? 2), this.materials.hazard);
      hammer.position.y = 2.15;
      hammer.castShadow = true;
      group.add(hammer);
    } else if (entity.kind === "swingingAxe") {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 0.15), this.materials.hazardDark);
      arm.position.y = 1.42;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 1.15, 0.46, 0.16), this.materials.hazard);
      blade.position.y = 0.48;
      blade.castShadow = true;
      arm.add(blade);
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
    } else if (entity.kind === "laser") {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 5.8, 0.18, 0.18), this.materials.hazard);
      beam.position.y = 0.85;
      group.add(beam);
    } else if (entity.kind === "hole") {
      const hole = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 2.2, 0.05, entity.depth ?? 3), this.materials.hazardDark);
      hole.position.y = 0.06;
      group.add(hole);
    } else if (entity.kind === "fan") {
      const fan = new THREE.Mesh(this.geometries.cylinder, this.materials.hazardDark);
      fan.rotation.z = Math.PI / 2;
      fan.position.y = 0.75;
      fan.scale.set(0.6, 0.22, 0.6);
      group.add(fan);
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
    this.bossWeapon.position.set(0.1, -0.82, -0.78);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.75, 12), this.materials.hazardDark);
    handle.position.y = -0.52;
    handle.castShadow = true;
    this.bossWeapon.add(handle);
    const head =
      this.level.boss?.attackKind === "sweep"
        ? new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.58, 1.55), this.materials.hazard)
        : this.level.boss?.attackKind === "minions"
          ? new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.9, 6), this.materials.hazard)
          : new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.48, 0.62), this.materials.hazard);
    head.position.y = 0.46;
    head.castShadow = true;
    this.bossWeapon.add(head);
    this.bossWeapon.rotation.z = -0.24;
    this.bossRightHand.add(this.bossWeapon);

    this.bossCrown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.9, 5), this.materials.bossGold);
    this.bossCrown.position.set(0, 3, 4.5);
    this.bossCrown.rotation.y = Math.PI / 5;
    this.bossCrown.castShadow = true;
    this.bossGroup.add(this.bossCrown);

    this.bossGate = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.4, 0.6), this.materials.castle);
    this.bossGate.position.set(0, 1.45, 8);
    this.bossGate.castShadow = true;
    this.bossGroup.add(this.bossGate);
    const label = this.makeTextSprite(this.level.boss?.name ?? "BOSS", "#3c1642", "#ffffff");
    label.position.set(0, 3.75, 3.7);
    label.scale.set(2.3, 0.52, 1);
    this.bossGroup.add(label);
    this.world.add(this.bossGroup);
  }

  private createRouletteWheel(z: number): void {
    this.rouletteGroup.clear();
    this.rouletteWheel = new THREE.Group();
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
      this.rouletteWheel.add(bulb);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.28, 40), this.materials.bossGold);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = -0.4;
    hub.castShadow = true;
    this.rouletteWheel.add(hub);
    const hubGem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), this.materials.gem);
    hubGem.position.z = -0.6;
    this.rouletteWheel.add(hubGem);
    this.rouletteGroup.add(this.rouletteWheel);

    const pointerBase = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.28, 0.18), this.materials.hazardDark);
    pointerBase.position.set(0, 2.52, -0.72);
    pointerBase.castShadow = true;
    this.rouletteGroup.add(pointerBase);
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.74, 3), this.materials.hazard);
    pointer.position.set(0, 2.23, -0.82);
    pointer.rotation.z = Math.PI;
    pointer.castShadow = true;
    this.rouletteGroup.add(pointer);

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
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateRun(time: number, dt: number): void {
    const keyboardSpeed = this.gooTimer > 0 ? 2.6 : 3.9;
    this.targetX += this.keyboardX * keyboardSpeed * dt;

    const targetSpeed = this.frenzyTimer > 0 ? 14.5 : this.gooTimer > 0 ? 7.2 : 10.6;
    this.speed = damp(this.speed, targetSpeed, 3.5, dt);
    this.distance += this.speed * dt;
    this.centerX = damp(this.centerX, this.targetX, this.gooTimer > 0 ? 5 : 8.4, dt);

    this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    this.frenzyTimer = Math.max(0, this.frenzyTimer - dt);
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
    if (track.data.kind === "collapsing" && !track.mesh.userData.triggered) {
      const progress = (this.distance - track.data.zStart) / Math.max(1, track.data.zEnd - track.data.zStart);
      if (progress > 0.48) {
        track.mesh.userData.triggered = true;
        this.loseCrew(2 + Math.floor(this.count * 0.05), "Collapse");
      }
    }
  }

  private getTrackAt(z: number): RuntimeTrack | null {
    const candidates = this.tracks.filter((track) => z >= track.data.zStart && z <= track.data.zEnd);
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
    if (segment.kind === "moving") {
      return base + Math.sin(time * (segment.speed ?? 1.2) + (segment.phase ?? 0)) * (segment.amplitude ?? 1.4);
    }
    return base;
  }

  private checkEntities(time: number, dt: number): void {
    const pickupRadius = this.magnetTimer > 0 ? 4.2 + this.save.upgrades.magnet * 0.6 : 0.95;
    for (const entity of this.entities) {
      if (entity.consumed) {
        continue;
      }
      entity.cooldown = Math.max(0, entity.cooldown - dt);
      const dz = Math.abs(this.distance - entity.data.z);
      if (dz > 8 && entity.data.kind !== "gate") {
        continue;
      }
      if (this.isCollectable(entity.data.kind)) {
        const dx = this.centerX - entity.data.x;
        if (Math.hypot(dx, this.distance - entity.data.z) < pickupRadius) {
          this.collectEntity(entity);
        }
      } else if (entity.data.kind === "gate" || entity.data.kind === "colorGate") {
        if (dz < 1.1 && Math.abs(this.centerX - entity.data.x) < (entity.data.width ?? 2.4) / 2) {
          this.applyGate(entity.data);
          this.consumeGateRow(entity.data.z);
          break;
        }
      } else if (entity.data.kind === "enemy") {
        const enemyX = this.getEnemyX(entity.data, time);
        if (dz < 1.4 && Math.abs(this.centerX - enemyX) < (entity.data.width ?? 3.4) / 2) {
          this.battleEnemy(entity);
        }
      } else {
        this.checkHazard(entity, time);
      }
    }
  }

  private isCollectable(kind: string): boolean {
    return ["crew", "crewCapsule", "coin", "gem", "shield", "magnet", "frenzy", "ticket", "bossBomb", "colorPad"].includes(kind);
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
      this.audio.collect();
    } else if (entity.data.kind === "magnet") {
      this.magnetTimer = 6 + this.save.upgrades.magnet;
      this.hud.popText("Magnet", "good");
      this.audio.collect();
    } else if (entity.data.kind === "frenzy") {
      this.frenzyTimer = 4.5;
      this.hud.popText("Frenzy", "good");
      this.audio.collect();
    } else if (entity.data.kind === "ticket") {
      this.save.tickets += 1;
      saveGame(this.save);
      this.hud.popText("Ticket", "coin");
      this.audio.reward();
    } else if (entity.data.kind === "bossBomb") {
      this.bossBombs += 1;
      this.hud.popText("Boss Bomb", "boss");
      this.audio.collect();
    } else if (entity.data.kind === "colorPad") {
      this.activeTeamColor = entity.data.color ?? "cyan";
      this.materials.body.color.setHex(this.teamColors[this.activeTeamColor]);
      this.hud.popText(this.activeTeamColor.toUpperCase(), "good");
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
    if (gate.op === "add") {
      this.count += value + Math.floor(bonus * 2);
    } else if (gate.op === "subtract") {
      this.count = Math.max(0, this.count - value);
    } else if (gate.op === "multiply") {
      this.count = Math.max(0, Math.floor(this.count * value + bonus));
    } else if (gate.op === "divide") {
      this.count = Math.max(0, Math.ceil(this.count / Math.max(1, value)));
    } else if (gate.op === "percent") {
      this.count = Math.max(0, Math.round(this.count * (1 + value / 100 + bonus * 0.03)));
    }

    const delta = this.count - before;
    this.crowdImpactPulse = delta >= 0 ? 0.36 : 0.78;
    this.stats.gates += 1;
    this.stats.score += Math.max(0, delta) * 18 + 70;
    this.stats.combo = delta >= 0 ? this.stats.combo + 0.3 : 1;
    this.hud.popText(`${delta >= 0 ? "+" : ""}${delta}`, delta >= 0 ? "good" : "bad");
    this.audio.gate(delta >= 0);
    if (this.count <= 0) {
      this.failRun("Gate zeroed crew");
    }
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
      if ((entity.data.kind === "gate" || entity.data.kind === "colorGate") && Math.abs(entity.data.z - z) < 0.2) {
        entity.consumed = true;
        entity.mesh.visible = false;
      }
    });
  }

  private battleEnemy(entity: RuntimeEntity): void {
    entity.consumed = true;
    entity.mesh.visible = false;
    const enemyCount = entity.data.count ?? 8;
    const loss = Math.ceil(enemyCount * (entity.data.strength ?? 1));
    const enemyX = entity.mesh.position.x;
    this.count -= loss;
    this.stats.score += enemyCount * 34;
    this.stats.enemiesDefeated += enemyCount;
    this.stats.combo = 1;
    this.cameraShake = 0.7;
    this.crowdImpactPulse = 0.9;
    this.hud.popText(`Battle -${loss}`, this.count > 0 ? "boss" : "bad");
    this.audio.battle();
    this.spawnBurst(enemyX, entity.data.z, 0xef476f);
    this.spawnBattleClash(enemyX, entity.data.z, loss);
    if (this.count <= 0) {
      this.failRun("Lost battle");
    }
  }

  private checkHazard(entity: RuntimeEntity, time: number): void {
    if (entity.cooldown > 0) {
      return;
    }
    const data = entity.data;
    const dz = Math.abs(this.distance - data.z);
    const hazardX = this.getHazardX(data, time);
    const inX = Math.abs(this.centerX - hazardX) < (data.width ?? 2.1) / 2 + this.formationRadius() * 0.22;
    const inZ = dz < (data.depth ?? 2.2) / 2;
    if (!inX || !inZ) {
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

  private getHazardX(data: LevelEntity, time: number): number {
    if (data.kind === "spikeRoller" || data.kind === "cannon" || data.kind === "swingingAxe") {
      return data.x + Math.sin(time * (data.speed ?? 2.1) + (data.phase ?? 0)) * (data.range ?? 2.3);
    }
    return data.x;
  }

  private getEnemyX(data: LevelEntity, time: number): number {
    if (data.kind === "enemy" && data.range && data.speed) {
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
    this.audio.switchMusic("boss");
    this.hud.popText(this.level.boss?.name ?? "Boss", "boss");
  }

  private updateBoss(dt: number): void {
    this.centerX = damp(this.centerX, this.targetX, 8, dt);
    this.targetX += this.keyboardX * 3.8 * dt;
    this.targetX = clamp(this.targetX, -3.2, 3.2);
    this.centerX = clamp(this.centerX, -3.5, 3.5);

    const damage = (this.count * 0.24 + this.save.upgrades.bossDamage * 1.6 + this.bossBombs * 2.2) * dt;
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
      this.bossWeapon.position.y = -0.82 + Math.sin(this.lastTime * 3) * 0.025 + warningArc * 0.06 - impactArc * 0.08;
      this.bossWeapon.position.z = -0.78 - warningArc * 0.08 - impactArc * 0.12;
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
    this.stats.score += 1000;
    if (this.bossTelegraph) {
      this.bossTelegraph.visible = false;
    }
    this.cameraShake = 1.25;
    this.hud.popText("Castle Taken", "boss");
    this.audio.stomp();
    this.audio.reward();
    this.spawnBossConfetti();
  }

  private updateBossVictory(dt: number): void {
    this.bossVictoryTimer += dt;
    this.bossHitPulse = Math.max(0, this.bossHitPulse - dt * 1.5);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.6);
    this.targetX = damp(this.targetX, 0, 5, dt);
    this.centerX = damp(this.centerX, 0, 5, dt);
    this.distance = damp(this.distance, this.level.length + 9.2, 1.9, dt);

    const progress = clamp(this.bossVictoryTimer / 1.35, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    const crownLift = Math.sin(clamp(this.bossVictoryTimer / 0.78, 0, 1) * Math.PI) * 0.9;

    if (this.bossBody) {
      this.bossBody.position.y = 1.65 - eased * 0.72 + Math.sin(this.lastTime * 36) * (1 - eased) * 0.025;
      this.bossBody.position.z = 4.5 + eased * 0.34;
      this.bossBody.rotation.x = eased * 0.72;
      this.bossBody.rotation.z = -eased * 0.68;
      this.bossBody.scale.setScalar(1 - eased * 0.08);
    }
    if (this.bossWeapon) {
      this.bossWeapon.position.y = -0.82 - eased * 0.26;
      this.bossWeapon.position.x = 0.1 + eased * 0.2;
      this.bossWeapon.position.z = -0.78 + eased * 0.18;
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
      this.bossGate.position.y = 1.45 + eased * 2.2;
      this.bossGate.scale.x = 1 + eased * 0.08;
    }

    this.bossGroup.rotation.y = Math.sin(this.lastTime * 24) * (1 - progress) * 0.025;
    this.bossGroup.position.x = Math.sin(this.lastTime * 31) * (1 - progress) * 0.04;
    this.hud.updateRun(this.level.id, 1, this.save, this.stats, this.count, this.shield);

    if (this.bossVictoryTimer >= 2.35) {
      this.finishLevel(true, false);
    }
  }

  private startRoulette(): void {
    this.mode = "roulette";
    this.speed = 0;
    this.distance = this.level.length + 10;
    this.rouletteTimer = 0;
    this.rouletteTick = 0;
    this.rouletteRevealTimer = 0;
    this.rouletteResolved = false;
    this.hud.hideRoulettePrize();
    this.pickRouletteReward();
    if (this.rouletteWheel) {
      this.rouletteWheel.rotation.z = this.rouletteSpinStart;
    }
    this.audio.switchMusic("roulette");
    this.hud.popText("Spin", "coin");
  }

  private updateRoulette(dt: number): void {
    if (this.rouletteResolved) {
      this.rouletteRevealTimer -= dt;
      if (this.rouletteWheel) {
        const pulse = 1 + Math.sin(this.lastTime * 10) * 0.012;
        this.rouletteWheel.scale.set(pulse, pulse, 1);
      }
      this.hud.updateRun(this.level.id, 1, this.save, this.stats, this.count, this.shield);
      if (this.rouletteRevealTimer <= 0) {
        this.finishLevel(false, false);
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
    if (this.rouletteTick <= 0 && progress < 0.98) {
      this.audio.rouletteTick();
      this.rouletteTick = 0.045 + progress * 0.16;
    }
    this.hud.updateRun(this.level.id, progress, this.save, this.stats, this.count, this.shield);
    if (progress >= 1) {
      this.resolveRoulette();
    }
  }

  private pickRouletteReward(): void {
    const luck = this.save.upgrades.rouletteLuck;
    const weighted = this.rouletteRewards.map((reward) => ({
      reward,
      weight:
        reward.weight +
        (reward.kind === "skin" ? luck * 0.09 : 0) +
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
    const prizeLabel = this.applyRouletteReward(reward);
    this.rouletteResolved = true;
    this.rouletteRevealTimer = 3.2;
    this.hud.showRoulettePrize(prizeLabel);
    this.hud.popText(prizeLabel, reward.tone);
    this.showRoulettePrizeSprite(prizeLabel, reward.color);
    this.spawnBurst(0, this.level.length + 18, reward.color);
    this.audio.reward();
    this.stats.score += 650;
    this.hud.updateRun(this.level.id, 1, this.save, this.stats, this.count, this.shield);
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
    if (reward.kind === "ticket") {
      this.save.tickets += reward.amount;
      saveGame(this.save);
      this.stats.rouletteLabel = `Wheel: ticket +${reward.amount}`;
      return `Ticket +${reward.amount}`;
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
    this.stats.gems += 10;
    this.stats.rouletteLabel = "Jackpot converted: gems +10";
    return "Gems +10";
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
    const reward = grantRunRewards(this.save, this.level.id, this.stats, this.level.targetScore, this.level.targetStair);
    this.hud.showReward(reward);
  }

  private failRun(_reason: string): void {
    if (this.mode === "fail" || this.mode === "reward") {
      return;
    }
    this.mode = "fail";
    this.speed = 0;
    this.audio.fail();
    this.hud.showFail(this.stats);
  }

  private updatePlatforms(time: number): void {
    this.tracks.forEach((track) => {
      track.mesh.position.x = this.getTrackCenter(track.data, time);
      if (track.data.kind === "turntable") {
        track.mesh.rotation.y = Math.sin(time * (track.data.speed ?? 1.2) + (track.data.phase ?? 0)) * 0.12;
      }
      if (track.data.kind === "collapsing") {
        track.mesh.position.y = track.mesh.userData.triggered ? -0.46 : -0.12;
      }
    });
  }

  private updateDecorations(time: number, dt: number): void {
    this.decorGroup.children.forEach((item) => {
      if (typeof item.userData.floatBaseY === "number") {
        item.position.y = item.userData.floatBaseY + Math.sin(time * 2.5 + (item.userData.floatPhase ?? 0)) * 0.08;
      }
      if (typeof item.userData.spin === "number") {
        item.rotation.y += item.userData.spin * dt;
      }
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
      if (entity.data.kind === "coin" || entity.data.kind === "gem") {
        entity.mesh.rotation.y += dt * 4;
        entity.mesh.position.y = 0.68 + Math.sin(time * 4 + entity.data.z) * 0.08;
      } else if (this.isCollectable(entity.data.kind)) {
        entity.mesh.rotation.y += dt * 2.2;
        entity.mesh.position.y = 0.7 + Math.sin(time * 3 + entity.data.z) * 0.08;
      } else if (entity.data.kind === "enemy") {
        entity.mesh.position.x = this.getEnemyX(entity.data, time);
        const models = entity.mesh.userData.enemyModels as THREE.Object3D[] | undefined;
        const ring = entity.mesh.userData.enemyRing as THREE.Object3D | undefined;
        const variant = entity.mesh.userData.enemyVariant as string | undefined;
        if (ring) {
          ring.rotation.z += dt * (variant === "armored" ? -0.9 : 0.7);
          ring.scale.setScalar(1 + Math.sin(time * 4 + entity.data.z) * 0.035);
        }
        models?.forEach((model, index) => {
          const phase = model.userData.phase ?? index;
          const baseX = model.userData.baseX ?? model.position.x;
          const baseZ = model.userData.baseZ ?? model.position.z;
          const march = Math.sin(time * (variant === "armored" ? 4.4 : 5.7) + phase);
          model.position.x = baseX + Math.sin(time * 2.2 + phase) * 0.035;
          model.position.y = 0.38 + Math.max(0, march) * (variant === "armored" ? 0.035 : 0.07);
          model.position.z = baseZ + Math.cos(time * 3.1 + phase) * 0.026;
          model.rotation.y = Math.sin(time * 4.2 + phase) * (variant === "armored" ? 0.08 : 0.16);
          model.scale.set(1 + Math.max(0, march) * 0.025, 1 - Math.max(0, march) * 0.018, 1 + Math.max(0, march) * 0.025);
        });
      } else if (entity.data.kind === "rotatingBar") {
        entity.mesh.rotation.y += dt * (entity.data.speed ?? 2.4);
      } else if (entity.data.kind === "sawLane") {
        entity.mesh.rotation.y += dt * 6;
      } else if (entity.data.kind === "crusher") {
        const active = Math.sin(time * (entity.data.speed ?? 2.4) + (entity.data.phase ?? 0));
        entity.mesh.children.forEach((child, index) => {
          if (index === 1) {
            child.position.y = active > 0.2 ? 0.6 : 2.15;
          }
        });
      } else if (entity.data.kind === "laser") {
        const active = Math.sin(time * (entity.data.speed ?? 2.4) + (entity.data.phase ?? 0)) > 0.15;
        entity.mesh.visible = active;
      } else if (entity.data.kind === "fan") {
        entity.mesh.rotation.z += dt * 8;
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
    this.visorInstances.count = visible;
    this.packInstances.count = visible;
    this.leftLegInstances.count = visible;
    this.rightLegInstances.count = visible;
    const spacing = clamp(0.52 - this.save.upgrades.formation * 0.025, 0.38, 0.52);
    const perRow = Math.max(3, Math.ceil(Math.sqrt(Math.max(visible, 1)) * 1.42));
    const track = this.getTrackAt(this.distance);
    const trackWidth = track?.data.width ?? 7;
    const maxRowWidth = Math.max(3, Math.floor(trackWidth / spacing) - 1);
    const rowLimit = Math.min(perRow, maxRowWidth);

    for (let index = 0; index < this.maxVisibleCrew; index += 1) {
      if (index >= visible) {
        this.bodyInstances.setMatrixAt(index, this.hiddenMatrix);
        this.visorInstances.setMatrixAt(index, this.hiddenMatrix);
        this.packInstances.setMatrixAt(index, this.hiddenMatrix);
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
      let y = 0.55 + bob;
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
      } else if (this.mode === "boss" || this.mode === "bossVictory") {
        const attackWave = Math.max(0, Math.sin(time * 5.8 - row * 0.85));
        const victoryPush = this.mode === "bossVictory" ? clamp(this.bossVictoryTimer / 1.3, 0, 1) : 0;
        x = this.centerX + offsetX + Math.sin(time * 9 + index) * 0.07;
        z = this.distance + offsetZ + attackWave * (row < 5 ? 0.78 : 0.32) + victoryPush * (1.65 + row * 0.035);
        y = 0.55 + bob + attackWave * 0.07 + Math.sin(time * 13 + index) * 0.05 * victoryPush;
        yaw = Math.sin(time * 8 + index * 0.5) * (0.16 + victoryPush * 0.08);
      }

      this.tmpQuaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
      const impact = this.crowdImpactPulse * clamp(1 - row * 0.07, 0.28, 1);
      this.tmpScale.set(1 + impact * 0.18, 1 - impact * 0.16, 1 + impact * 0.12);
      this.tmpMatrix.compose(new THREE.Vector3(x, y, z), this.tmpQuaternion, this.tmpScale);
      this.bodyInstances.setMatrixAt(index, this.tmpMatrix);

      this.tmpMatrix.compose(new THREE.Vector3(x, y + 0.17, z + 0.29), this.tmpQuaternion, this.tmpScale);
      this.visorInstances.setMatrixAt(index, this.tmpMatrix);

      this.tmpMatrix.compose(new THREE.Vector3(x, y + 0.01, z - 0.33), this.tmpQuaternion, this.tmpScale);
      this.packInstances.setMatrixAt(index, this.tmpMatrix);

      const stride = Math.sin(time * 12 + index * 0.7) * 0.05;
      this.tmpMatrix.compose(new THREE.Vector3(x - 0.13, y - 0.39 + bob * 0.3, z + stride), this.tmpQuaternion, this.tmpScale);
      this.leftLegInstances.setMatrixAt(index, this.tmpMatrix);
      this.tmpMatrix.compose(new THREE.Vector3(x + 0.13, y - 0.39 + bob * 0.3, z - stride), this.tmpQuaternion, this.tmpScale);
      this.rightLegInstances.setMatrixAt(index, this.tmpMatrix);
    }
    this.bodyInstances.instanceMatrix.needsUpdate = true;
    this.visorInstances.instanceMatrix.needsUpdate = true;
    this.packInstances.instanceMatrix.needsUpdate = true;
    this.leftLegInstances.instanceMatrix.needsUpdate = true;
    this.rightLegInstances.instanceMatrix.needsUpdate = true;
  }

  private updateCamera(dt: number): void {
    const isBossScene = this.mode === "boss" || this.mode === "bossVictory";
    const isStairFinale = this.mode === "stairs" && this.stairFinaleStarted;
    const targetZ =
      this.mode === "roulette"
        ? this.level.length + 18
        : isBossScene
          ? this.level.length + 15.5
          : isStairFinale
            ? this.level.length + 28
          : this.mode === "stairs"
            ? this.level.length + 18.2
            : this.distance + 8;
    const targetY = this.mode === "roulette" ? 5.4 : isBossScene ? 7.5 : isStairFinale ? 6.9 : this.mode === "stairs" ? 6.15 : 8.5;
    const cameraZ =
      this.mode === "roulette"
        ? this.level.length + 9
        : isBossScene
          ? this.distance - 9.5
          : isStairFinale
            ? this.level.length + 15.5
          : this.mode === "stairs"
            ? this.level.length + 5.8
            : this.distance - 10.5;
    const shake = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.6 : 0;
    const lookY = isStairFinale ? 3.1 : this.mode === "stairs" ? 1.35 : 0.75;
    this.camera.position.x = damp(this.camera.position.x, this.centerX * 0.42 + shake, 5, dt);
    this.camera.position.y = damp(this.camera.position.y, targetY + Math.abs(shake), 4.5, dt);
    this.camera.position.z = damp(this.camera.position.z, cameraZ, 5.2, dt);
    this.camera.lookAt(this.centerX * 0.35, lookY, targetZ);
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
    return clamp(0.45 + Math.sqrt(Math.max(1, this.count)) * 0.11 - this.save.upgrades.formation * 0.04, 0.45, 2.3);
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
    this.spawnCrewKnockouts(Math.min(loss, 10), x, z);
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
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
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
    const trail = getEquippedCosmetic(this.save, "trail");
    this.materials.body.color.setHex(body.primary);
    this.materials.pack.color.setHex(pack.primary);
    this.materials.visor.color.setHex(visor.primary);
    this.materials.trail.color.setHex(trail.primary);
  }

  private createStats(): RunStats {
    return {
      score: 0,
      coins: 0,
      gems: 0,
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
