import * as THREE from "three";
import type { LevelData, ObstacleCollider } from "../game/types";

export class SceneBuilder {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 420);
  readonly world = new THREE.Group();
  readonly enemyGroup = new THREE.Group();
  readonly projectileGroup = new THREE.Group();
  readonly particleGroup = new THREE.Group();
  readonly obstacleGroup = new THREE.Group();
  readonly obstacleColliders: ObstacleCollider[] = [];

  private readonly canvas: HTMLCanvasElement;
  private readonly terrainGroup = new THREE.Group();
  private readonly themes = [
    { background: 0x07110d, fog: 0x07110d, grid: 0x70ff9e, horizon: 0xffd166, obstacle: 0x1f5f48 },
    { background: 0x061018, fog: 0x061018, grid: 0x66d9ff, horizon: 0xff6a4d, obstacle: 0x17435a },
    { background: 0x100914, fog: 0x100914, grid: 0xd08cff, horizon: 0x70ff9e, obstacle: 0x4a245c },
    { background: 0x120d07, fog: 0x120d07, grid: 0xffd166, horizon: 0x66d9ff, obstacle: 0x5a3a17 }
  ];
  private readonly materials = {
    grid: new THREE.LineBasicMaterial({ color: 0x70ff9e, transparent: true, opacity: 0.52 }),
    horizon: new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.5 }),
    ground: new THREE.MeshBasicMaterial({ color: 0x07110d }),
    obstacle: new THREE.MeshStandardMaterial({ color: 0x1f5f48, roughness: 0.74, metalness: 0.04, wireframe: true }),
    player: new THREE.MeshStandardMaterial({ color: 0x70ff9e, roughness: 0.48, metalness: 0.1, wireframe: true }),
    playerSolid: new THREE.MeshStandardMaterial({ color: 0x123c2a, roughness: 0.64, metalness: 0.08 }),
    enemy: new THREE.MeshStandardMaterial({ color: 0xff6a4d, roughness: 0.55, metalness: 0.08, wireframe: true }),
    enemyHeavy: new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.58, metalness: 0.1, wireframe: true }),
    boss: new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5, metalness: 0.12, wireframe: true }),
    weakPoint: new THREE.MeshStandardMaterial({ color: 0x66d9ff, roughness: 0.28, metalness: 0.18, emissive: 0x0077aa, emissiveIntensity: 0.25 }),
    spawn: new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.58, depthWrite: false }),
    boundary: new THREE.LineBasicMaterial({ color: 0xff6a4d, transparent: true, opacity: 0.74 })
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const params = new URLSearchParams(window.location.search);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: params.has("pixel") || params.has("autostart")
    });
    const pixelCap = window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelCap));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0x07110d);
    this.scene.fog = new THREE.Fog(0x07110d, 64, 250);

    const hemi = new THREE.HemisphereLight(0xcaffdc, 0x112218, 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-16, 24, -12);
    sun.castShadow = true;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    this.scene.add(sun);
    this.world.add(this.terrainGroup, this.obstacleGroup, this.enemyGroup, this.projectileGroup, this.particleGroup);
    this.scene.add(this.world);
    this.camera.position.set(0, 4, -8);
  }

  resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  buildArena(level: LevelData): void {
    this.terrainGroup.clear();
    this.obstacleGroup.clear();
    this.obstacleColliders.length = 0;
    const size = level.arenaSize;
    this.applyTheme(level);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.25, size * 1.25), this.materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    this.terrainGroup.add(ground);

    const gridPoints: THREE.Vector3[] = [];
    const step = 5;
    for (let coord = -size / 2; coord <= size / 2; coord += step) {
      gridPoints.push(new THREE.Vector3(-size / 2, 0, coord), new THREE.Vector3(size / 2, 0, coord));
      gridPoints.push(new THREE.Vector3(coord, 0, -size / 2), new THREE.Vector3(coord, 0, size / 2));
    }
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPoints), this.materials.grid);
    this.terrainGroup.add(grid);

    const half = size / 2;
    const boundaryPoints = [
      new THREE.Vector3(-half, 0.06, -half),
      new THREE.Vector3(half, 0.06, -half),
      new THREE.Vector3(half, 0.06, half),
      new THREE.Vector3(-half, 0.06, half),
      new THREE.Vector3(-half, 0.06, -half)
    ];
    const boundary = new THREE.Line(new THREE.BufferGeometry().setFromPoints(boundaryPoints), this.materials.boundary);
    this.terrainGroup.add(boundary);
    for (let index = 0; index < 4; index += 1) {
      const marker = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.2, 4), new THREE.MeshBasicMaterial({ color: 0xff6a4d, wireframe: true }));
      marker.position.set(index < 2 ? -half : half, 1.1, index === 0 || index === 3 ? -half : half);
      marker.rotation.y = Math.PI / 4;
      this.terrainGroup.add(marker);
    }

    const ridgePoints: THREE.Vector3[] = [];
    const ridgeCount = 18;
    for (let index = 0; index <= ridgeCount; index += 1) {
      const x = -size * 0.78 + (index / ridgeCount) * size * 1.56;
      const z = size * 0.62 + Math.sin(index * 1.7 + level.id) * 4;
      const y = 2 + Math.sin(index * 0.9) * 2.5;
      ridgePoints.push(new THREE.Vector3(x, y, z));
    }
    this.terrainGroup.add(new THREE.Line(ridgePointsToGeometry(ridgePoints), this.materials.horizon));

    for (let index = 0; index < 8; index += 1) {
      const obstacle = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2 + (index % 3), 2.7 + (index % 2), 1.8 + (index % 4) * 0.55, 5),
        this.materials.obstacle
      );
      const angle = (index / 8) * Math.PI * 2 + level.id * 0.27;
      const radius = size * (0.22 + (index % 4) * 0.055);
      obstacle.position.set(Math.sin(angle) * radius, 0.75, Math.cos(angle) * radius);
      obstacle.rotation.y = angle * 0.7;
      obstacle.castShadow = true;
      this.obstacleGroup.add(obstacle);
      this.obstacleColliders.push({
        id: `obstacle-${index}`,
        position: obstacle.position.clone().setY(0),
        radius: 2.9 + (index % 3) * 0.55
      });
    }
  }

  pushOutOfObstacles(position: THREE.Vector3, radius: number): boolean {
    let pushed = false;
    this.obstacleColliders.forEach((obstacle) => {
      const dx = position.x - obstacle.position.x;
      const dz = position.z - obstacle.position.z;
      const distance = Math.hypot(dx, dz);
      const minimum = radius + obstacle.radius;
      if (distance > 0.001 && distance < minimum) {
        const push = (minimum - distance) / distance;
        position.x += dx * push;
        position.z += dz * push;
        pushed = true;
      }
    });
    return pushed;
  }

  projectileObstacleHit(position: THREE.Vector3, radius: number): ObstacleCollider | null {
    const flatPosition = position.clone().setY(0);
    for (const obstacle of this.obstacleColliders) {
      if (flatPosition.distanceTo(obstacle.position) < radius + obstacle.radius) {
        return obstacle;
      }
    }
    return null;
  }

  hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3, clearance = 0.35): boolean {
    const start = from.clone().setY(0);
    const end = to.clone().setY(0);
    const segment = end.clone().sub(start);
    const lengthSq = Math.max(0.001, segment.lengthSq());
    for (const obstacle of this.obstacleColliders) {
      const t = THREE.MathUtils.clamp(obstacle.position.clone().sub(start).dot(segment) / lengthSq, 0, 1);
      const closest = start.clone().addScaledVector(segment, t);
      if (closest.distanceTo(obstacle.position) < obstacle.radius + clearance) {
        return false;
      }
    }
    return true;
  }

  createPlayerMesh(): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.62, 3.2), this.materials.playerSolid);
    body.position.y = 0.46;
    body.castShadow = true;
    group.add(body);
    const hullWire = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.68, 3.28), this.materials.player);
    hullWire.position.y = 0.46;
    group.add(hullWire);
    const turretPivot = new THREE.Group();
    group.userData.turretPivot = turretPivot;
    group.add(turretPivot);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.72, 0.52, 8), this.materials.player);
    turret.position.y = 1.03;
    turret.rotation.y = Math.PI / 8;
    turret.castShadow = true;
    turretPivot.add(turret);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 2.4), this.materials.player);
    barrel.position.set(0, 1.08, 1.35);
    barrel.castShadow = true;
    turretPivot.add(barrel);
    return group;
  }

  createEnemyMesh(kind: "scout" | "tank" | "heavy" | "turret" | "boss"): THREE.Group {
    const group = new THREE.Group();
    const material = kind === "boss" ? this.materials.boss : kind === "heavy" ? this.materials.enemyHeavy : this.materials.enemy;
    const bodySize = kind === "boss" ? [5.8, 1.5, 5.2] : kind === "heavy" ? [3.2, 0.9, 3.6] : kind === "scout" ? [1.8, 0.62, 2.2] : [2.5, 0.72, 3];
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodySize[0], bodySize[1], bodySize[2]), material);
    body.position.y = bodySize[1] / 2;
    body.castShadow = true;
    group.userData.body = body;
    group.add(body);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(bodySize[0] * 0.18, bodySize[0] * 0.24, bodySize[1] * 0.55, 8), material);
    turret.position.y = bodySize[1] + 0.26;
    group.add(turret);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(bodySize[0] * 0.08, bodySize[1] * 0.16, bodySize[2] * 0.72), material);
    barrel.position.set(0, bodySize[1] + 0.28, bodySize[2] * 0.43);
    group.add(barrel);
    if (kind === "scout") {
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.2, 3), material);
      nose.position.set(0, bodySize[1] * 0.6, bodySize[2] * 0.72);
      nose.rotation.x = Math.PI / 2;
      group.userData.nose = nose;
      group.add(nose);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.7), material);
      fin.position.set(0, bodySize[1] + 0.72, -bodySize[2] * 0.16);
      group.add(fin);
    }
    if (kind === "heavy") {
      [-1, 1].forEach((side) => {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.82, bodySize[2] * 0.94), material);
        plate.position.set(side * (bodySize[0] * 0.58), bodySize[1] * 0.55, 0);
        group.add(plate);
      });
    }
    if (kind === "turret") {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 0.45, 8), material);
      base.position.y = 0.22;
      group.add(base);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), material);
      mast.position.set(0.78, 1.6, -0.25);
      group.add(mast);
    }
    if (kind === "boss") {
      [-1, 1].forEach((side) => {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.76, 1.4), material);
        pod.position.set(side * 3.15, 0.7, -0.6);
        group.add(pod);
      });
    }
    return group;
  }

  createWeakPointMesh(label: string): THREE.Group {
    const group = new THREE.Group();
    const shieldMaterial = this.materials.weakPoint.clone();
    shieldMaterial.transparent = true;
    shieldMaterial.opacity = 0.48;
    shieldMaterial.depthWrite = false;
    const shield = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 36), shieldMaterial);
    shield.rotation.x = Math.PI / 2;
    shield.userData.label = `${label}-shield`;
    group.userData.shield = shield;
    group.add(shield);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.055, 8, 32), this.materials.weakPoint);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), this.materials.weakPoint);
    core.userData.label = label;
    group.add(core);
    return group;
  }

  createSpawnTelegraph(): THREE.Group {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.04, 8, 42), this.materials.spawn.clone());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    group.userData.ring = ring;
    group.add(ring);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), this.materials.spawn.clone());
    mast.position.y = 0.72;
    group.userData.mast = mast;
    group.add(mast);
    return group;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private applyTheme(level: LevelData): void {
    const theme = this.themes[Math.floor((level.id - 1) / 5) % this.themes.length];
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(theme.fog, 64, 250);
    this.materials.grid.color.setHex(theme.grid);
    this.materials.horizon.color.setHex(theme.horizon);
    this.materials.obstacle.color.setHex(theme.obstacle);
    this.materials.boundary.color.setHex(level.boss ? 0xffd166 : 0xff6a4d);
  }
}

function ridgePointsToGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints(points);
}
