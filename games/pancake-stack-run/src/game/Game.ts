import * as THREE from "three";
import { AudioManager } from "../audio/AudioManager";
import { getLevel } from "../levels/levelCatalog";
import { Hud } from "../ui/Hud";
import { clamp, smoothDamp } from "../utils/math";
import { buyUpgrade, equipCosmetic, getEquippedCosmetic, grantLevelRewards, loadSave, resetSave, saveGame } from "./saveData";
import type { CollectableKind, GameMode, HazardKind, LevelData, LevelEntity, RunStats, SaveData } from "./types";

type RuntimeEntity = {
  data: LevelEntity;
  mesh: THREE.Object3D;
  consumed: boolean;
  cooldown: number;
};

type FloatingItem = {
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  life: number;
};

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
  private readonly hud = new Hud();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.35);
  private readonly pointer = new THREE.Vector2();
  private readonly pointerHit = new THREE.Vector3();
  private readonly audio: AudioManager;

  private save: SaveData = loadSave();
  private mode: GameMode = "title";
  private level: LevelData = getLevel(1);
  private entities: RuntimeEntity[] = [];
  private floating: FloatingItem[] = [];

  private world = new THREE.Group();
  private player = new THREE.Group();
  private plate = new THREE.Mesh();
  private stackGroup = new THREE.Group();
  private bossGroup = new THREE.Group();
  private finishGroup = new THREE.Group();

  private stack = 0;
  private toppings = 0;
  private butterShield = 0;
  private magnetTimer = 0;
  private syrupTimer = 0;
  private jamTimer = 0;
  private finishTimer = 0;
  private finishMultiplier = 1;
  private bossHp = 0;
  private feedAccumulator = 0;
  private chompOpen = true;

  private positionX = 0;
  private targetX = 0;
  private distance = 0;
  private speed = 0;
  private isPointerDown = false;
  private keyboardX = 0;
  private keyboardRun = false;
  private lastTime = 0;
  private hitFlash = 0;
  private cameraShake = 0;
  private trailTimer = 0;

  private stats: RunStats = this.createStats();

  private readonly materials = {
    pancake: new THREE.MeshStandardMaterial({ color: 0xf1b96f, roughness: 0.8, metalness: 0.02 }),
    pancakeEdge: new THREE.MeshStandardMaterial({ color: 0xd18a40, roughness: 0.9 }),
    plate: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.08 }),
    plateRim: new THREE.MeshStandardMaterial({ color: 0x59b8de, roughness: 0.35, metalness: 0.1 }),
    track: new THREE.MeshStandardMaterial({ color: 0x78d9d2, roughness: 0.7 }),
    trackSide: new THREE.MeshStandardMaterial({ color: 0x4fb1b2, roughness: 0.75 }),
    water: new THREE.MeshStandardMaterial({ color: 0x74c7e3, roughness: 0.75, metalness: 0.02 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xf25757, roughness: 0.5 }),
    warning: new THREE.MeshStandardMaterial({ color: 0xff5a5f, roughness: 0.5, transparent: true, opacity: 0.72 }),
    warningSoft: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5, transparent: true, opacity: 0.68 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xa7b7c7, roughness: 0.32, metalness: 0.55 }),
    coin: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.35, metalness: 0.15 }),
    strawberry: new THREE.MeshStandardMaterial({ color: 0xef476f, roughness: 0.55 }),
    banana: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.65 }),
    blueberry: new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.55 }),
    chocolate: new THREE.MeshStandardMaterial({ color: 0x6a3d2f, roughness: 0.7 }),
    butter: new THREE.MeshStandardMaterial({ color: 0xfff0a3, roughness: 0.45 }),
    syrup: new THREE.MeshStandardMaterial({ color: 0x9b4d1f, roughness: 0.4, transparent: true, opacity: 0.86 }),
    magnet: new THREE.MeshStandardMaterial({ color: 0x9d4edd, roughness: 0.45 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0xf28482, roughness: 0.55 }),
    mouthDark: new THREE.MeshStandardMaterial({ color: 0x4a1f2a, roughness: 0.8 }),
    trail: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.45, transparent: true, opacity: 0.74 }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 }),
    black: new THREE.MeshStandardMaterial({ color: 0x202333, roughness: 0.55 })
  };

  private readonly geometries = {
    pancake: new THREE.CylinderGeometry(0.72, 0.78, 0.16, 36),
    pancakeSmall: new THREE.CylinderGeometry(0.46, 0.5, 0.13, 28),
    plate: new THREE.CylinderGeometry(1.05, 1.15, 0.16, 48),
    plateRim: new THREE.TorusGeometry(0.98, 0.06, 10, 48),
    cube: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(0.5, 24, 16),
    berry: new THREE.SphereGeometry(0.25, 16, 12),
    banana: new THREE.TorusGeometry(0.25, 0.07, 10, 22, Math.PI * 1.25),
    cone: new THREE.ConeGeometry(0.2, 0.32, 16),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 28)
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
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0xbfeef2);
    this.scene.fog = new THREE.Fog(0xbfeef2, 35, 150);

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
    await this.beginLevel(levelNumber, true);
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
    this.hud.onOpenShop = () => {
      this.mode = "shop";
      this.hud.showShop(this.save);
    };
    this.hud.onCloseShop = () => {
      this.mode = "title";
      this.hud.showTitle(this.save);
    };
    this.hud.onResetSave = () => {
      this.save = resetSave();
      this.applyCosmetics();
      this.rebuildStack();
      this.hud.showShop(this.save);
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
    this.hud.onEquip = (key) => {
      if (equipCosmetic(this.save, key)) {
        this.applyCosmetics();
        this.rebuildStack();
        this.audio.coin();
      } else {
        this.audio.hit();
      }
      this.hud.updateShop(this.save);
    };
    this.hud.onPause = () => {
      if (this.mode === "run") {
        this.mode = "pause";
        this.hud.showPause();
      }
    };
    this.hud.onResume = () => {
      if (this.mode === "pause") {
        this.mode = "run";
        this.hud.showRun();
      }
    };
    this.hud.onMute = () => {
      this.save.muted = this.audio.toggleMuted();
      saveGame(this.save);
      this.hud.updateMute(this.save.muted);
    };
  }

  private bindInput(): void {
    const onPointer = (event: PointerEvent, down: boolean) => {
      this.isPointerDown = down;
      if (down) {
        this.canvas.setPointerCapture(event.pointerId);
        void this.audio.unlock().then(() => this.audio.startMusic());
      }
      this.updatePointerTarget(event);
    };

    this.canvas.addEventListener("pointerdown", (event) => onPointer(event, true));
    this.canvas.addEventListener("pointermove", (event) => {
      if (this.isPointerDown) {
        this.updatePointerTarget(event);
      }
    });
    this.canvas.addEventListener("pointerup", (event) => onPointer(event, false));
    this.canvas.addEventListener("pointercancel", () => {
      this.isPointerDown = false;
    });

    window.addEventListener("keydown", (event) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        this.keyboardX = -1;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        this.keyboardX = 1;
      }
      if (event.code === "Space") {
        this.keyboardRun = true;
        void this.audio.unlock().then(() => this.audio.startMusic());
      }
      if (event.code === "KeyR" && (this.mode === "fail" || this.mode === "reward")) {
        void this.beginLevel(this.level.id);
      }
      if (event.code === "Escape" || event.code === "KeyP") {
        if (this.mode === "run") {
          this.mode = "pause";
          this.hud.showPause();
        } else if (this.mode === "pause") {
          this.mode = "run";
          this.hud.showRun();
        }
      }
      if (event.code === "KeyM") {
        this.save.muted = this.audio.toggleMuted();
        saveGame(this.save);
        this.hud.updateMute(this.save.muted);
      }
    });
    window.addEventListener("keyup", (event) => {
      if ((event.code === "ArrowLeft" || event.code === "KeyA") && this.keyboardX < 0) {
        this.keyboardX = 0;
      }
      if ((event.code === "ArrowRight" || event.code === "KeyD") && this.keyboardX > 0) {
        this.keyboardX = 0;
      }
      if (event.code === "Space") {
        this.keyboardRun = false;
      }
    });
  }

  private updatePointerTarget(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.pointerPlane, this.pointerHit);
    this.targetX = clamp(this.pointerHit.x, -this.level.trackWidth / 2 + 0.5, this.level.trackWidth / 2 - 0.5);
  }

  private setupScene(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x62a8aa, 2.4);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-5, 10, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    this.scene.add(sun);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 320, 1, 1),
      this.materials.water
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.08;
    water.position.z = -70;
    water.receiveShadow = true;
    this.scene.add(water);

    this.scene.add(this.world);
    this.world.add(this.player);
    this.player.add(this.stackGroup);
    this.createPlayerModel();
  }

  private createPlayerModel(): void {
    this.plate = new THREE.Mesh(this.geometries.plate, this.materials.plate);
    this.plate.castShadow = true;
    this.plate.receiveShadow = true;
    this.plate.position.y = 0.35;
    this.player.add(this.plate);

    const rim = new THREE.Mesh(this.geometries.plateRim, this.materials.plateRim);
    rim.position.y = 0.45;
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    this.player.add(rim);

    this.stackGroup.position.y = 0.55;
  }

  private applyCosmetics(): void {
    const plate = getEquippedCosmetic(this.save, "plate");
    const stack = getEquippedCosmetic(this.save, "stack");
    const trail = getEquippedCosmetic(this.save, "trail");
    this.materials.plate.color.setHex(plate.primary);
    this.materials.plateRim.color.setHex(plate.secondary ?? plate.primary);
    this.materials.pancake.color.setHex(stack.primary);
    this.materials.pancakeEdge.color.setHex(stack.secondary ?? stack.primary);
    this.materials.trail.color.setHex(trail.primary);
  }

  private async beginLevel(levelNumber: number, skipAudio = false): Promise<void> {
    if (!skipAudio) {
      await this.audio.unlock();
      this.audio.startMusic();
    }

    this.level = getLevel(levelNumber);
    this.applyLevelTheme();
    this.mode = "run";
    this.stats = this.createStats();
    this.stack = this.save.upgrades.startStack;
    this.toppings = 0;
    this.butterShield = 0;
    this.magnetTimer = 0;
    this.syrupTimer = 0;
    this.jamTimer = 0;
    this.finishTimer = 0;
    this.finishMultiplier = 1;
    this.bossHp = this.level.finish.bossHp ?? 0;
    this.feedAccumulator = 0;
    this.chompOpen = true;
    this.positionX = 0;
    this.targetX = 0;
    this.distance = 0;
    this.speed = 0;
    this.hitFlash = 0;
    this.cameraShake = 0;
    this.trailTimer = 0;
    this.entities = [];
    this.floating = [];

    this.clearWorld();
    this.buildTrack();
    this.buildLevelEntities();
    this.buildFinish();
    this.rebuildStack();

    this.player.position.set(0, 0, 0);
    this.hud.showRun();
  }

  private clearWorld(): void {
    [...this.world.children].forEach((child) => {
      if (child !== this.player) {
        this.world.remove(child);
      }
    });
    this.entities = [];
    this.floating = [];
    this.finishGroup.clear();
    this.bossGroup.clear();
    this.stackGroup.clear();
  }

  private buildTrack(): void {
    this.level.track.forEach((segment) => {
      const track = new THREE.Mesh(
        new THREE.BoxGeometry(segment.width, 0.26, segment.length),
        this.materials.track
      );
      track.position.set(0, 0.08, segment.z);
      track.receiveShadow = true;
      this.world.add(track);

      const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, segment.length), this.materials.trackSide);
      const rightRail = leftRail.clone();
      leftRail.position.set(-segment.width / 2, 0.32, segment.z);
      rightRail.position.set(segment.width / 2, 0.32, segment.z);
      if (!segment.openEdges) {
        this.world.add(leftRail, rightRail);
      }
    });

    for (let z = -8; z > -this.level.length; z -= 12) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(this.level.trackWidth * 0.86, 0.018, 0.14), this.materials.white);
      stripe.position.set(0, 0.225, z);
      stripe.receiveShadow = true;
      this.world.add(stripe);
    }
  }

  private buildLevelEntities(): void {
    this.level.entities.forEach((entity) => {
      if (!this.isCollectable(entity.kind)) {
        this.world.add(this.createHazardWarning(entity));
      }
      const mesh = this.createEntityMesh(entity);
      mesh.position.set(entity.x, 0.55, entity.z);
      mesh.userData.entityId = entity.id;
      this.world.add(mesh);
      this.entities.push({ data: entity, mesh, consumed: false, cooldown: 0 });
    });
  }

  private applyLevelTheme(): void {
    const themes = {
      normal: {
        background: 0xbfeef2,
        fog: 0xbfeef2,
        track: 0x78d9d2,
        side: 0x4fb1b2,
        water: 0x74c7e3
      },
      challenge: {
        background: 0xd7eef8,
        fog: 0xd7eef8,
        track: 0x9fe3b5,
        side: 0x4f9f78,
        water: 0x8ed3ef
      },
      boss: {
        background: 0xdad6ff,
        fog: 0xdad6ff,
        track: 0x8ee6d5,
        side: 0x426d85,
        water: 0x8fb5f0
      },
      bonus: {
        background: 0xfff1bf,
        fog: 0xfff1bf,
        track: 0xa7ead7,
        side: 0x6db39f,
        water: 0x90d7f2
      }
    } satisfies Record<LevelData["kind"], Record<string, number>>;
    const theme = themes[this.level.kind];
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(theme.fog, 35, 150);
    this.materials.track.color.setHex(theme.track);
    this.materials.trackSide.color.setHex(theme.side);
    this.materials.water.color.setHex(theme.water);
  }

  private createHazardWarning(entity: LevelEntity): THREE.Object3D {
    const group = new THREE.Group();
    const isSevere = ["blade", "slammer", "hole", "tongue"].includes(entity.kind);
    const warningWidth = entity.kind === "hole" ? (entity.width ?? 2) : Math.max(entity.width ?? 1.7, entity.kind === "rollingPin" || entity.kind === "tongue" ? 2.8 : 1.4);
    const mat = entity.kind === "heightGate" || entity.kind === "colorGate" || entity.kind === "lowPipe" ? this.materials.warningSoft : this.materials.warning;

    const marker = new THREE.Mesh(new THREE.BoxGeometry(warningWidth, 0.025, 0.34), mat);
    marker.position.set(entity.x, 0.36, entity.z + 4.2);
    marker.receiveShadow = true;
    group.add(marker);

    for (let i = 0; i < 3; i += 1) {
      const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.75), mat);
      chevron.position.set(entity.x + (i - 1) * 0.34, 0.38, entity.z + 3.58 - i * 0.18);
      chevron.rotation.y = (i - 1) * 0.45;
      group.add(chevron);
    }

    if (isSevere) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), this.materials.warning);
      post.position.set(entity.x, 0.75, entity.z + 4.2);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 3), this.materials.warning);
      cap.position.set(entity.x, 1.3, entity.z + 4.2);
      cap.rotation.y = Math.PI / 6;
      group.add(post, cap);
    }

    return group;
  }

  private buildFinish(): void {
    this.finishGroup = new THREE.Group();
    this.finishGroup.position.z = -this.level.length - 8;
    this.world.add(this.finishGroup);

    const line = new THREE.Mesh(new THREE.BoxGeometry(this.level.trackWidth, 0.08, 0.5), this.materials.coin);
    line.position.y = 0.32;
    line.receiveShadow = true;
    this.finishGroup.add(line);

    if (this.level.finish.kind === "customers") {
      [-2.1, 0, 2.1].forEach((x, index) => {
        const customer = this.createCustomer(index);
        customer.position.set(x, 0.72, -4);
        this.finishGroup.add(customer);
      });
    } else {
      this.bossGroup = this.createMouth(this.level.finish.kind === "boss");
      this.bossGroup.position.set(0, 1.2, -4.8);
      this.finishGroup.add(this.bossGroup);
    }

    this.level.finish.multiplierPads.forEach((multiplier, index) => {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.08, 1.2),
        new THREE.MeshStandardMaterial({
          color: multiplier >= 5 ? 0xffd166 : multiplier >= 3 ? 0x95d5b2 : 0xffffff,
          roughness: 0.4
        })
      );
      pad.position.set((index - (this.level.finish.multiplierPads.length - 1) / 2) * 1.55, 0.34, 2.2);
      this.finishGroup.add(pad);
    });
  }

  private createEntityMesh(entity: LevelEntity): THREE.Object3D {
    if (this.isCollectable(entity.kind)) {
      return this.createCollectableMesh(entity.kind);
    }

    const group = new THREE.Group();
    switch (entity.kind as HazardKind) {
      case "lowPipe": {
        const pipe = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 5, 0.34, 0.34), this.materials.metal);
        pipe.position.y = 1.7;
        pipe.castShadow = true;
        group.add(pipe);
        const left = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.3, 0.22), this.materials.metal);
        const right = left.clone();
        left.position.set(-(entity.width ?? 5) / 2, 0.8, 0);
        right.position.set((entity.width ?? 5) / 2, 0.8, 0);
        group.add(left, right);
        break;
      }
      case "blade": {
        const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 6), this.materials.hazard);
        blade.rotation.x = Math.PI / 2;
        blade.position.y = 0.75;
        blade.castShadow = true;
        group.add(blade);
        break;
      }
      case "rollingPin":
      case "tongue": {
        const mat = entity.kind === "tongue" ? this.materials.mouth : this.materials.hazard;
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, entity.width ?? 2.6, 24), mat);
        roller.rotation.z = Math.PI / 2;
        roller.position.y = 0.75;
        roller.castShadow = true;
        group.add(roller);
        break;
      }
      case "jam": {
        const jam = new THREE.Mesh(new THREE.CylinderGeometry(entity.width ?? 1.2, entity.width ?? 1.2, 0.05, 32), this.materials.syrup);
        jam.scale.z = 0.55;
        jam.position.y = 0.28;
        group.add(jam);
        break;
      }
      case "glutton": {
        const body = new THREE.Mesh(this.geometries.sphere, this.materials.mouth);
        body.scale.set(1.1, 1.1, 1.1);
        body.position.y = 0.82;
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 0.18), this.materials.mouthDark);
        mouth.position.set(0, 0.78, 0.45);
        const eyeL = new THREE.Mesh(this.geometries.berry, this.materials.black);
        const eyeR = eyeL.clone();
        eyeL.position.set(-0.28, 1.1, 0.38);
        eyeR.position.set(0.28, 1.1, 0.38);
        group.add(body, mouth, eyeL, eyeR);
        break;
      }
      case "slammer": {
        const block = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 2, 0.7, 1), this.materials.hazard);
        block.position.y = 2.25;
        block.castShadow = true;
        group.add(block);
        break;
      }
      case "hole": {
        const hole = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 1.8, 0.06, entity.depth ?? 2.4), this.materials.black);
        hole.position.y = 0.27;
        group.add(hole);
        break;
      }
      case "colorGate": {
        const buttonColor = entity.requiredColor === "red" ? 0xef476f : entity.requiredColor === "blue" ? 0x3a86ff : 0xffd166;
        const button = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.7, 0.18, 28),
          new THREE.MeshStandardMaterial({ color: buttonColor, roughness: 0.45 })
        );
        button.position.y = 0.32;
        group.add(button);
        const gate = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 0.18), this.materials.metal);
        gate.position.set(0, 1.35, -0.5);
        group.add(gate);
        break;
      }
      case "heightGate": {
        const gate = new THREE.Mesh(new THREE.BoxGeometry(entity.width ?? 5, 0.26, 0.2), this.materials.coin);
        gate.position.y = 1.05;
        group.add(gate);
        break;
      }
    }
    return group;
  }

  private createCollectableMesh(kind: CollectableKind): THREE.Object3D {
    const group = new THREE.Group();
    if (kind === "pancake" || kind === "goldenPancake") {
      const pancake = new THREE.Mesh(
        this.geometries.pancakeSmall,
        kind === "goldenPancake" ? this.materials.coin : this.materials.pancake
      );
      pancake.castShadow = true;
      group.add(pancake);
      return group;
    }

    if (kind === "strawberry") {
      const berry = new THREE.Mesh(this.geometries.berry, this.materials.strawberry);
      berry.scale.set(1, 1.25, 1);
      const leaf = new THREE.Mesh(this.geometries.cone, new THREE.MeshStandardMaterial({ color: 0x4caf50 }));
      leaf.position.y = 0.28;
      leaf.rotation.x = Math.PI;
      group.add(berry, leaf);
      return group;
    }

    if (kind === "banana") {
      const banana = new THREE.Mesh(this.geometries.banana, this.materials.banana);
      banana.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.15);
      group.add(banana);
      return group;
    }

    if (kind === "blueberry") {
      const berry = new THREE.Mesh(this.geometries.berry, this.materials.blueberry);
      group.add(berry);
      return group;
    }

    if (kind === "chocolate") {
      const chip = new THREE.Mesh(this.geometries.cone, this.materials.chocolate);
      chip.rotation.x = Math.PI;
      group.add(chip);
      return group;
    }

    if (kind === "butter") {
      const butter = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.4), this.materials.butter);
      butter.castShadow = true;
      group.add(butter);
      return group;
    }

    if (kind === "syrup") {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.72, 18), this.materials.syrup);
      bottle.rotation.z = 0.25;
      group.add(bottle);
      return group;
    }

    const magnet = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.09, 12, 24, Math.PI * 1.4), this.materials.magnet);
    magnet.rotation.z = Math.PI * 0.82;
    group.add(magnet);
    return group;
  }

  private createCustomer(index: number): THREE.Object3D {
    const group = new THREE.Group();
    const colors = [0xf4a261, 0xe9c46a, 0x8ecae6];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.8, 16), new THREE.MeshStandardMaterial({ color: colors[index] }));
    const head = new THREE.Mesh(this.geometries.sphere, new THREE.MeshStandardMaterial({ color: 0xffc8a2, roughness: 0.65 }));
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.08), this.materials.mouthDark);
    body.position.y = 0.3;
    head.position.y = 0.9;
    head.scale.set(0.48, 0.52, 0.48);
    mouth.position.set(0, 0.84, 0.42);
    group.add(body, head, mouth);
    return group;
  }

  private createMouth(isBoss: boolean): THREE.Group {
    const group = new THREE.Group();
    const face = new THREE.Mesh(this.geometries.sphere, this.materials.mouth);
    face.scale.set(isBoss ? 2.2 : 1.55, isBoss ? 1.65 : 1.2, 0.8);
    face.castShadow = true;

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(isBoss ? 2.4 : 1.7, isBoss ? 0.8 : 0.55, 0.22), this.materials.mouthDark);
    mouth.position.set(0, -0.1, 0.68);

    const eyeL = new THREE.Mesh(this.geometries.berry, this.materials.black);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.55, 0.52, 0.55);
    eyeR.position.set(0.55, 0.52, 0.55);
    if (isBoss) {
      eyeL.position.x = -0.8;
      eyeR.position.x = 0.8;
      eyeL.scale.setScalar(1.25);
      eyeR.scale.setScalar(1.25);
    }

    const toothL = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 4), this.materials.white);
    const toothR = toothL.clone();
    toothL.position.set(-0.4, 0.23, 0.82);
    toothR.position.set(0.4, 0.23, 0.82);
    toothL.rotation.x = Math.PI;
    toothR.rotation.x = Math.PI;
    group.add(face, mouth, eyeL, eyeR, toothL, toothR);
    return group;
  }

  private tick(time: number): void {
    const dt = this.lastTime > 0 ? Math.min(0.033, (time - this.lastTime) / 1000) : 0.016;
    this.lastTime = time;

    if (this.mode === "run") {
      this.updateRun(dt, time / 1000);
    } else if (this.mode === "finish") {
      this.updateFinish(dt, time / 1000);
    }

    this.updateFloating(dt);
    this.updateVisuals(dt, time / 1000);
    this.renderer.render(this.scene, this.camera);
  }

  private updateRun(dt: number, elapsed: number): void {
    const activeInput = this.isPointerDown || this.keyboardRun || Math.abs(this.keyboardX) > 0.1;
    const targetSpeed = activeInput ? 10.8 : 1.8;
    const jamFactor = this.jamTimer > 0 ? 0.62 : 1;
    this.speed = smoothDamp(this.speed, targetSpeed * jamFactor, 5.2, dt);
    this.distance += this.speed * dt;

    if (Math.abs(this.keyboardX) > 0.1) {
      this.targetX = clamp(this.targetX + this.keyboardX * dt * 5.2, -this.level.trackWidth / 2 + 0.5, this.level.trackWidth / 2 - 0.5);
    }

    this.positionX = smoothDamp(this.positionX, this.targetX, this.jamTimer > 0 ? 5 : 9, dt);
    this.player.position.set(this.positionX, 0, -this.distance);
    this.updateTrail(dt);

    this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    this.syrupTimer = Math.max(0, this.syrupTimer - dt);
    this.jamTimer = Math.max(0, this.jamTimer - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    this.updateEntities(dt, elapsed);
    this.checkCollisions(dt);

    if (this.distance >= this.level.length) {
      this.enterFinish();
    }

    const progress = clamp(this.distance / this.level.length, 0, 1);
    this.hud.updateRun(this.level.id, progress, this.save, this.stats, this.stack);
  }

  private updateTrail(dt: number): void {
    const trail = getEquippedCosmetic(this.save, "trail");
    const activeTrail = trail.key !== "Plain Trail" || this.syrupTimer > 0 || this.magnetTimer > 0;
    if (!activeTrail || this.speed < 2.2) {
      return;
    }

    this.trailTimer -= dt;
    if (this.trailTimer > 0) {
      return;
    }
    this.trailTimer = 0.08;

    const particle = new THREE.Mesh(this.geometries.berry, this.materials.trail);
    particle.scale.setScalar(0.18 + Math.random() * 0.08);
    particle.position.set(
      this.player.position.x + (Math.random() - 0.5) * 0.9,
      0.32,
      this.player.position.z + 0.7 + Math.random() * 0.55
    );
    this.world.add(particle);
    this.floating.push({
      mesh: particle,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.35 + Math.random() * 0.25, 1.2),
      life: 0.58
    });
  }

  private updateEntities(dt: number, elapsed: number): void {
    this.entities.forEach((entity) => {
      entity.cooldown = Math.max(0, entity.cooldown - dt);
      if (entity.consumed) {
        entity.mesh.position.y = smoothDamp(entity.mesh.position.y, -1, 6, dt);
        return;
      }

      entity.mesh.rotation.y += dt * 1.4;
      if (this.isCollectable(entity.data.kind)) {
        const pullRadius = 1.25 + this.save.upgrades.magnet * 0.45 + (this.magnetTimer > 0 ? 2.6 : 0);
        const dz = Math.abs(this.player.position.z - entity.mesh.position.z);
        const dx = this.positionX - entity.mesh.position.x;
        if (dz < pullRadius * 1.4 && Math.abs(dx) < pullRadius) {
          entity.mesh.position.x += dx * dt * 5.6;
        }
        entity.mesh.position.y = 0.62 + Math.sin(elapsed * 4 + entity.data.z) * 0.08;
      }

      if (entity.data.kind === "rollingPin" || entity.data.kind === "tongue") {
        const range = entity.data.range ?? 2.5;
        const speed = entity.data.speed ?? 2;
        entity.mesh.position.x = entity.data.x + Math.sin(elapsed * speed + (entity.data.phase ?? 0)) * range;
        entity.mesh.rotation.z += dt * 8;
      }

      if (entity.data.kind === "blade") {
        entity.mesh.rotation.z += dt * 8;
      }

      if (entity.data.kind === "slammer") {
        const block = entity.mesh.children[0];
        if (block) {
          block.position.y = 1.35 + Math.abs(Math.sin(elapsed * (entity.data.speed ?? 2.5))) * 1.25;
        }
      }
    });
  }

  private checkCollisions(dt: number): void {
    const playerZ = this.player.position.z;
    const halfWidth = this.level.trackWidth / 2;
    if (Math.abs(this.positionX) > halfWidth + 0.45) {
      this.failRun();
      return;
    }

    this.entities.forEach((entity) => {
      if (entity.consumed || entity.cooldown > 0) {
        return;
      }

      const dx = Math.abs(this.positionX - entity.mesh.position.x);
      const dz = Math.abs(playerZ - entity.mesh.position.z);
      const width = entity.data.width ?? 1.1;
      const depth = entity.data.depth ?? 1.1;

      if (this.isCollectable(entity.data.kind)) {
        if (dx < 0.75 && dz < 0.8) {
          this.collect(entity);
        }
        return;
      }

      if (dz > depth) {
        return;
      }

      switch (entity.data.kind as HazardKind) {
        case "lowPipe":
          if (dx < width / 2 && this.stack > (entity.data.safeHeight ?? 8)) {
            this.trimStack(this.stack - (entity.data.safeHeight ?? 8), entity.mesh.position);
            entity.cooldown = 1.2;
          }
          break;
        case "blade":
          if (dx < width / 2) {
            this.takeHazardHit(Math.max(4, Math.ceil(this.stack * 0.65)), entity.mesh.position);
            entity.cooldown = 1.2;
          }
          break;
        case "rollingPin":
        case "tongue":
          if (dx < width / 2) {
            this.takeHazardHit(entity.data.kind === "tongue" ? 6 : 4, entity.mesh.position);
            entity.cooldown = 0.9;
          }
          break;
        case "jam":
          if (dx < width / 2) {
            this.jamTimer = Math.max(this.jamTimer, 2.2);
            entity.cooldown = 1.4;
            this.audio.hit();
          }
          break;
        case "glutton":
          if (dx < width / 2) {
            this.takeHazardHit(Math.ceil(dt * 16) + 1, entity.mesh.position);
            entity.cooldown = 0.28;
            this.audio.chomp();
          }
          break;
        case "slammer": {
          const block = entity.mesh.children[0];
          const blockY = block?.position.y ?? 2;
          if (dx < width / 2 && blockY < 1.75) {
            this.takeHazardHit(Math.max(6, Math.ceil(this.stack * 0.75)), entity.mesh.position);
            entity.cooldown = 1.1;
          }
          break;
        }
        case "hole":
          if (dx < width / 2) {
            this.failRun();
          }
          break;
        case "colorGate":
          if (dx > 0.85) {
            this.takeHazardHit(5, entity.mesh.position);
          } else {
            this.addScore(160);
            this.audio.collect("gate");
          }
          entity.consumed = true;
          break;
        case "heightGate":
          if (this.stack < (entity.data.minStack ?? 10)) {
            this.takeHazardHit(3, entity.mesh.position);
          } else {
            this.addScore(240);
            this.audio.collect("gate");
          }
          entity.consumed = true;
          break;
      }
    });
  }

  private collect(entity: RuntimeEntity): void {
    entity.consumed = true;
    const kind = entity.data.kind as CollectableKind;
    this.stats.combo = Math.min(12, this.stats.combo + 0.35);
    this.audio.collect(kind);
    this.spawnBurst(entity.mesh.position, this.getCollectableMaterial(kind), kind === "goldenPancake" ? 12 : 7);

    switch (kind) {
      case "pancake":
        this.addPancakes(1);
        this.addScore(10 * this.stats.combo);
        this.hud.popText("+1 stack");
        break;
      case "goldenPancake":
        this.addPancakes(2);
        this.addScore(50 * this.stats.combo);
        this.stats.coinsEarned += 2 + this.save.upgrades.coinValue;
        this.hud.popText("+2 stack", "coin");
        break;
      case "strawberry":
      case "banana":
      case "blueberry":
        this.toppings += 1;
        this.addScore(35 * this.stats.combo);
        this.addFloatingTopping(kind, entity.mesh.position);
        this.hud.popText("+topping");
        break;
      case "chocolate":
        this.toppings += 1;
        this.addScore(40 * this.stats.combo);
        this.stats.coinsEarned += 3 + this.save.upgrades.coinValue;
        this.addFloatingTopping(kind, entity.mesh.position);
        this.hud.popText("+coins", "coin");
        break;
      case "butter":
        this.butterShield = Math.min(3, this.butterShield + 1);
        this.addScore(60);
        this.addFloatingTopping(kind, entity.mesh.position);
        this.hud.popText("shield");
        break;
      case "syrup":
        this.syrupTimer = 6;
        this.addScore(120);
        this.addFloatingTopping(kind, entity.mesh.position);
        this.hud.popText("syrup x");
        break;
      case "magnet":
        this.magnetTimer = 6 + this.save.upgrades.magnet;
        this.addScore(80);
        this.addFloatingTopping(kind, entity.mesh.position);
        this.hud.popText("magnet");
        break;
    }
  }

  private addPancakes(count: number): void {
    this.stack += count;
    this.stats.stackMax = Math.max(this.stats.stackMax, this.stack);
    this.rebuildStack();
  }

  private trimStack(count: number, from: THREE.Vector3): void {
    if (count <= 0) {
      return;
    }
    this.takeHazardHit(count, from);
  }

  private takeHazardHit(rawCount: number, from: THREE.Vector3): void {
    if (this.butterShield > 0) {
      this.butterShield -= 1;
      this.addScore(40);
      this.audio.collect("shield");
      this.hud.popText("blocked");
      return;
    }

    const count = clamp(rawCount - this.save.upgrades.stability, 1, Math.max(1, this.stack));
    this.removePancakes(count, from);
    this.stats.combo = 1;
    this.stats.perfect = false;
    this.hitFlash = 0.22;
    this.cameraShake = 0.26;
    this.audio.hit();
    this.hud.popText(`-${count}`, "bad");
    this.spawnBurst(from, this.materials.hazard, 10);

    if (this.stack <= 0) {
      this.failRun();
    }
  }

  private removePancakes(count: number, from: THREE.Vector3): void {
    const removed = Math.min(this.stack, count);
    this.stack -= removed;
    for (let i = 0; i < Math.min(removed, 12); i += 1) {
      const mesh = new THREE.Mesh(this.geometries.pancakeSmall, this.materials.pancake);
      mesh.position.copy(this.player.position);
      mesh.position.y = 0.7 + i * 0.06;
      this.world.add(mesh);
      this.floating.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 4 + (this.player.position.x - from.x), 4 + Math.random() * 2, (Math.random() - 0.5) * 4),
        life: 1.2
      });
    }
    this.rebuildStack();
  }

  private rebuildStack(): void {
    this.stackGroup.clear();
    const visible = Math.min(this.stack, 58);
    for (let i = 0; i < visible; i += 1) {
      const pancake = new THREE.Mesh(this.geometries.pancake, this.materials.pancake);
      pancake.position.y = i * 0.145;
      pancake.rotation.y = (i * 0.57) % Math.PI;
      pancake.scale.x = 0.94 + Math.sin(i * 1.7) * 0.025;
      pancake.scale.z = 0.94 + Math.cos(i * 1.3) * 0.025;
      pancake.castShadow = true;
      pancake.receiveShadow = true;
      this.stackGroup.add(pancake);
    }

    if (this.stack > visible) {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.2, 36),
        new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.55 })
      );
      cap.position.y = visible * 0.145 + 0.12;
      this.stackGroup.add(cap);
    }
  }

  private addFloatingTopping(kind: CollectableKind, source: THREE.Vector3): void {
    const mesh = this.createCollectableMesh(kind);
    mesh.position.copy(source);
    this.world.add(mesh);
    this.floating.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 3.2, -1.2),
      life: 0.55
    });
  }

  private spawnBurst(source: THREE.Vector3, material: THREE.Material, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(this.geometries.berry, material);
      mesh.scale.setScalar(0.09 + Math.random() * 0.1);
      mesh.position.copy(source);
      mesh.position.y += 0.22 + Math.random() * 0.4;
      this.world.add(mesh);
      this.floating.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 3, 1.8 + Math.random() * 2.2, (Math.random() - 0.5) * 3),
        life: 0.45 + Math.random() * 0.28
      });
    }
  }

  private getCollectableMaterial(kind: CollectableKind): THREE.Material {
    if (kind === "goldenPancake") {
      return this.materials.coin;
    }
    if (kind === "strawberry") {
      return this.materials.strawberry;
    }
    if (kind === "banana") {
      return this.materials.banana;
    }
    if (kind === "blueberry") {
      return this.materials.blueberry;
    }
    if (kind === "chocolate") {
      return this.materials.chocolate;
    }
    if (kind === "butter") {
      return this.materials.butter;
    }
    if (kind === "syrup") {
      return this.materials.syrup;
    }
    if (kind === "magnet") {
      return this.materials.magnet;
    }
    return this.materials.pancake;
  }

  private enterFinish(): void {
    this.mode = "finish";
    this.finishTimer = 0;
    this.feedAccumulator = 0;
    this.speed = 0;
    const padIndex = clamp(Math.floor(((this.positionX + this.level.trackWidth / 2) / this.level.trackWidth) * this.level.finish.multiplierPads.length), 0, this.level.finish.multiplierPads.length - 1);
    this.finishMultiplier = this.level.finish.multiplierPads[padIndex] ?? 1;
    if (this.syrupTimer > 0) {
      this.finishMultiplier += 1;
    }
  }

  private updateFinish(dt: number, elapsed: number): void {
    this.finishTimer += dt;
    const finishZ = -this.level.length - 6;
    this.player.position.z = smoothDamp(this.player.position.z, finishZ, 2.7, dt);
    this.player.position.x = smoothDamp(this.player.position.x, 0, 3.8, dt);
    this.positionX = this.player.position.x;

    this.chompOpen = Math.sin(elapsed * 4.5) > -0.55;
    if (this.bossGroup.children.length) {
      this.bossGroup.scale.y = smoothDamp(this.bossGroup.scale.y, this.chompOpen ? 1 : 0.82, 10, dt);
      this.bossGroup.rotation.z = Math.sin(elapsed * 2) * 0.04;
    }

    if (this.finishTimer > 0.7 && this.stack > 0) {
      this.feedAccumulator += dt;
      const feedRate = this.level.finish.kind === "boss" && !this.chompOpen ? 0.18 : 0.075;
      while (this.feedAccumulator >= feedRate && this.stack > 0) {
        this.feedAccumulator -= feedRate;
        this.stack -= 1;
        this.stats.pancakesFed += 1;
        const damage = 1 + (this.toppings > 0 ? 0.15 : 0);
        this.bossHp = Math.max(0, this.bossHp - damage);
        this.addScore(25 * this.finishMultiplier);
        this.stats.coinsEarned += this.finishMultiplier + this.save.upgrades.coinValue;
        this.spawnFedPancake();
        this.rebuildStack();
        this.audio.chomp();
      }
    }

    if ((this.stack <= 0 && this.finishTimer > 1.1) || this.finishTimer > 7.5) {
      this.completeLevel();
    }

    this.hud.updateRun(this.level.id, 1, this.save, this.stats, this.stack);
  }

  private spawnFedPancake(): void {
    const mesh = new THREE.Mesh(this.geometries.pancakeSmall, this.materials.pancake);
    mesh.position.copy(this.player.position);
    mesh.position.y += 1.2 + this.stack * 0.05;
    this.world.add(mesh);
    this.floating.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.5, 2.5, -4.2),
      life: 0.7
    });
  }

  private completeLevel(): void {
    this.mode = "reward";
    const feedTargetMet = this.stats.pancakesFed >= this.level.finish.targetFeed;
    this.stats.bossDefeated = this.level.finish.kind === "boss" && this.bossHp <= 0;
    const targetScoreMet = this.stats.score >= this.level.targetScore;
    this.stats.starsEarned = 1 + (targetScoreMet ? 1 : 0) + (feedTargetMet && this.stats.perfect ? 1 : 0);
    if (this.stats.bossDefeated) {
      this.stats.coinsEarned += 150;
      this.stats.starsEarned = Math.max(this.stats.starsEarned, 3);
      this.audio.reward();
      this.spawnConfetti(36);
    } else if (feedTargetMet && this.stats.perfect) {
      this.spawnConfetti(22);
    }

    const key = String(this.level.id);
    this.save.highScores[key] = Math.max(this.save.highScores[key] ?? 0, Math.round(this.stats.score));
    this.save.bestStacks[key] = Math.max(this.save.bestStacks[key] ?? 0, this.stats.stackMax);
    this.save.coins += Math.round(this.stats.coinsEarned);
    const previousStars = this.save.levelStars[key] ?? 0;
    const starDelta = Math.max(0, this.stats.starsEarned - previousStars);
    const chest = grantLevelRewards(
      this.save,
      this.level.id,
      this.stats.starsEarned,
      Math.round(this.stats.score),
      this.stats.bossDefeated
    );
    this.stats.chestReward = chest.label;
    this.save.currentLevel = Math.max(this.save.currentLevel, this.level.id + 1);
    saveGame(this.save);

    const title = this.stats.bossDefeated ? "Boss Defeated" : feedTargetMet ? "Level Clear" : "Mouth Fed";
    const extra = this.stats.bossDefeated
      ? `${chest.label} • medal +1`
      : this.stats.perfect
        ? `${chest.label} • perfect run`
        : `${chest.label} • ${this.stats.pancakesFed}/${this.level.finish.targetFeed} fed`;
    this.hud.showReward({
      title,
      score: Math.round(this.stats.score),
      coins: Math.round(this.stats.coinsEarned + chest.coins),
      stars: starDelta > 0 ? `+${starDelta}` : `${this.stats.starsEarned}/3`,
      extra
    });
  }

  private failRun(): void {
    if (this.mode !== "run") {
      return;
    }
    this.mode = "fail";
    this.audio.fail();
    this.hud.showFail(this.stats);
  }

  private spawnConfetti(count: number): void {
    const mats = [this.materials.coin, this.materials.strawberry, this.materials.blueberry, this.materials.banana, this.materials.magnet];
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(this.geometries.cube, mats[i % mats.length]);
      mesh.scale.set(0.08, 0.035, 0.16);
      mesh.position.copy(this.player.position);
      mesh.position.x += (Math.random() - 0.5) * 3.8;
      mesh.position.y += 1.4 + Math.random() * 1.2;
      mesh.position.z -= 2.5 + Math.random() * 2;
      this.world.add(mesh);
      this.floating.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 4.5, 4 + Math.random() * 4, (Math.random() - 0.5) * 4.5),
        life: 1.4 + Math.random() * 0.8
      });
    }
  }

  private updateFloating(dt: number): void {
    this.floating = this.floating.filter((item) => {
      item.life -= dt;
      item.velocity.y -= dt * 8;
      item.mesh.position.addScaledVector(item.velocity, dt);
      item.mesh.rotation.x += dt * 6;
      item.mesh.rotation.z += dt * 4;
      if (item.life <= 0) {
        this.world.remove(item.mesh);
        return false;
      }
      return true;
    });
  }

  private updateVisuals(dt: number, elapsed: number): void {
    const stackHeight = Math.max(1, this.stack);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
    const wobbleAmount = Math.min(0.28, stackHeight * 0.006 + this.hitFlash * 0.8);
    this.stackGroup.rotation.z = smoothDamp(this.stackGroup.rotation.z, Math.sin(elapsed * 7) * wobbleAmount + this.positionX * -0.015, 8, dt);
    this.stackGroup.rotation.x = Math.cos(elapsed * 5.7) * wobbleAmount * 0.45;
    this.plate.rotation.z = smoothDamp(this.plate.rotation.z, this.positionX * -0.035, 7, dt);
    const squash = this.hitFlash > 0 ? 1 - this.hitFlash * 0.18 : 1;
    this.plate.scale.set(1 + this.hitFlash * 0.18, squash, 1 + this.hitFlash * 0.08);

    if (this.syrupTimer > 0) {
      this.stackGroup.children.forEach((child: THREE.Object3D, index: number) => {
        if (index % 7 === 0) {
          child.scale.x = 1.02;
          child.scale.z = 1.02;
        }
      });
    }

    this.updateCamera(dt);
  }

  private updateCamera(dt: number): void {
    const playerZ = this.player.position.z;
    const targetCamera = new THREE.Vector3(this.positionX * 0.26, 5.9 + Math.min(this.stack, 45) * 0.018, playerZ + 10.4);
    const targetLook = new THREE.Vector3(this.positionX * 0.16, 1.1 + Math.min(this.stack, 50) * 0.016, playerZ - 11.2);
    this.camera.position.x = smoothDamp(this.camera.position.x, targetCamera.x, 5, dt);
    this.camera.position.y = smoothDamp(this.camera.position.y, targetCamera.y, 5, dt);
    this.camera.position.z = smoothDamp(this.camera.position.z, targetCamera.z, 5, dt);
    if (this.cameraShake > 0) {
      const strength = this.cameraShake * 0.15;
      this.camera.position.x += (Math.random() - 0.5) * strength;
      this.camera.position.y += (Math.random() - 0.5) * strength;
    }
    this.camera.lookAt(targetLook);
  }

  private addScore(amount: number): void {
    this.stats.score += amount;
  }

  private createStats(): RunStats {
    return {
      score: 0,
      coinsEarned: 0,
      starsEarned: 0,
      stackMax: 0,
      combo: 1,
      perfect: true,
      bossDefeated: false,
      pancakesFed: 0,
      chestReward: ""
    };
  }

  private isCollectable(kind: string): kind is CollectableKind {
    return [
      "pancake",
      "goldenPancake",
      "strawberry",
      "banana",
      "blueberry",
      "chocolate",
      "butter",
      "syrup",
      "magnet"
    ].includes(kind);
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
