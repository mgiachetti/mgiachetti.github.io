import * as THREE from "three";
import type { BossConfig, EnemyKind, LevelData, Projectile, RadarBlip, RuntimeEnemy, RuntimeWeakPoint } from "../game/types";
import type { SceneBuilder } from "../scene/SceneBuilder";
import { angleTo, clamp, wrapAngle } from "../utils/math";

type FireRequest = {
  position: THREE.Vector3;
  forward: THREE.Vector3;
  speed: number;
  damage: number;
};

type HitResult = {
  hit: boolean;
  killed: boolean;
  weakPoint: boolean;
  bossKilled: boolean;
  score: number;
  position: THREE.Vector3;
  strongExplosion: boolean;
};

export class EnemySystem {
  readonly enemies: RuntimeEnemy[] = [];

  private readonly sceneBuilder: SceneBuilder;
  private readonly tmpForward = new THREE.Vector3();

  constructor(sceneBuilder: SceneBuilder) {
    this.sceneBuilder = sceneBuilder;
  }

  reset(): void {
    this.sceneBuilder.enemyGroup.clear();
    this.enemies.length = 0;
  }

  loadLevel(level: LevelData): void {
    this.reset();
    level.enemySpawns.forEach((spawn) => {
      this.addEnemy(spawn.id, spawn.kind, spawn.x, spawn.z, spawn.hp, spawn.delay ?? 0);
    });
    if (level.boss) {
      this.addBoss(level.boss, 0, level.arenaSize * 0.32);
    }
  }

  update(playerPosition: THREE.Vector3, dt: number): FireRequest[] {
    const requests: FireRequest[] = [];
    const now = performance.now() * 0.001;
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      enemy.spawnDelay = Math.max(0, enemy.spawnDelay - dt);
      enemy.mesh.visible = enemy.spawnDelay <= 0;
      if (enemy.spawnDelay > 0) {
        this.updateSpawnTelegraph(enemy, dt);
        return;
      }
      if (enemy.spawnTelegraph) {
        enemy.spawnTelegraph.visible = false;
      }
      const targetYaw = angleTo(enemy.position.x, enemy.position.z, playerPosition.x, playerPosition.z);
      enemy.yaw += clamp(wrapAngle(targetYaw - enemy.yaw), -2.2 * dt, 2.2 * dt);
      enemy.mesh.rotation.y = enemy.yaw;
      enemy.reload -= dt;

      const distance = enemy.position.distanceTo(playerPosition);
      if (enemy.kind !== "turret" && enemy.kind !== "boss") {
        const desired = enemy.kind === "scout" ? 16 : enemy.kind === "heavy" ? 28 : 22;
        const direction = distance > desired ? 1 : distance < desired * 0.66 ? -1 : enemy.kind === "scout" ? 0.12 : 0.22;
        this.tmpForward.set(Math.sin(enemy.yaw), 0, Math.cos(enemy.yaw));
        enemy.position.addScaledVector(this.tmpForward, enemy.speed * direction * dt);
        const strafe = Math.sin(performance.now() * 0.0018 + enemy.strafeSeed) * (enemy.kind === "scout" ? 5.4 : enemy.kind === "tank" ? 2.2 : 1.2);
        enemy.position.x += Math.cos(enemy.yaw) * strafe * dt;
        enemy.position.z -= Math.sin(enemy.yaw) * strafe * dt;
        this.syncEnemyMesh(enemy, now);
      } else if (enemy.kind === "boss") {
        enemy.position.x = Math.sin(performance.now() * 0.00055 + enemy.strafeSeed) * 6;
        this.syncEnemyMesh(enemy, now);
      } else {
        this.syncEnemyMesh(enemy, now);
      }

      enemy.weakPoints.forEach((weakPoint, index) => {
        weakPoint.mesh.visible = !weakPoint.destroyed;
        weakPoint.mesh.rotation.y += dt * (1.5 + index * 0.3);
        weakPoint.mesh.scale.setScalar(1 + Math.sin(performance.now() * 0.006 + index) * 0.08);
        const shield = weakPoint.mesh.userData.shield as THREE.Mesh | undefined;
        if (shield) {
          const healthRatio = weakPoint.hp / Math.max(1, weakPoint.maxHp);
          shield.rotation.z -= dt * (2.6 + index * 0.35);
          shield.scale.setScalar(1.12 + (1 - healthRatio) * 0.28 + Math.sin(now * 5.8 + index) * 0.08);
          if (shield.material instanceof THREE.Material) {
            shield.material.opacity = 0.22 + healthRatio * 0.34 + Math.sin(now * 7.2 + index) * 0.06;
          }
        }
      });

      const fireDistance = enemy.kind === "boss" ? 70 : enemy.kind === "turret" ? 62 : 48;
      const reloadReady = enemy.reload <= 0;
      const facing = Math.abs(wrapAngle(targetYaw - enemy.yaw)) < (enemy.kind === "boss" ? 0.42 : 0.22);
      if (reloadReady && facing && distance < fireDistance && this.sceneBuilder.hasLineOfSight(enemy.position, playerPosition, enemy.kind === "boss" ? 1.2 : 0.48)) {
        this.tmpForward.set(Math.sin(enemy.yaw), 0, Math.cos(enemy.yaw)).normalize();
        const muzzle = enemy.position.clone().addScaledVector(this.tmpForward, enemy.radius + 1.2).setY(enemy.kind === "boss" ? 1.8 : 0.95);
        if (enemy.kind === "boss") {
          const destroyedWeakPoints = enemy.weakPoints.filter((point) => point.destroyed).length;
          const spread = destroyedWeakPoints >= 2 ? [-0.22, 0, 0.22] : destroyedWeakPoints >= 1 ? [-0.14, 0.14] : [0];
          spread.forEach((offset) => {
            const direction = this.tmpForward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), offset + Math.sin(enemy.attackIndex) * 0.035);
            requests.push({ position: muzzle.clone(), forward: direction, speed: 18 + destroyedWeakPoints, damage: 18 + destroyedWeakPoints * 3 });
          });
          enemy.attackIndex += 1;
          enemy.reload = Math.max(0.62, enemy.attackInterval - destroyedWeakPoints * 0.12);
        } else {
          requests.push({
            position: muzzle,
            forward: this.tmpForward.clone(),
            speed: enemy.kind === "scout" ? 23 : 20,
            damage: enemy.kind === "heavy" ? 18 : 13
          });
          enemy.reload = enemy.attackInterval;
        }
      }
    });
    return requests;
  }

  applyHit(projectile: Projectile): HitResult {
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.spawnDelay > 0) {
        continue;
      }
      const distance = projectile.position.distanceTo(enemy.position);
      if (distance > enemy.radius + projectile.radius) {
        continue;
      }

      const weakPoint = this.findWeakPointHit(enemy, projectile.position);
      if (weakPoint) {
        weakPoint.hp = Math.max(0, weakPoint.hp - projectile.damage);
        if (weakPoint.hp <= 0 && !weakPoint.destroyed) {
          weakPoint.destroyed = true;
          enemy.hp = Math.max(0, enemy.hp - enemy.maxHp * 0.22);
          return this.finishHit(enemy, projectile.position, true, 250);
        }
        return this.finishHit(enemy, projectile.position, true, 80);
      }

      const weakArmor = enemy.weakPoints.length > 0 && enemy.weakPoints.some((point) => !point.destroyed);
      enemy.hp = Math.max(0, enemy.hp - projectile.damage * (weakArmor ? 0.34 : 1));
      return this.finishHit(enemy, projectile.position, false, weakArmor ? 35 : 55);
    }
    return {
      hit: false,
      killed: false,
      weakPoint: false,
      bossKilled: false,
      score: 0,
      position: projectile.position.clone(),
      strongExplosion: false
    };
  }

  aliveCount(): number {
    return this.enemies.filter((enemy) => enemy.alive && enemy.spawnDelay <= 0).length;
  }

  remainingCount(): number {
    return this.enemies.filter((enemy) => enemy.alive).length;
  }

  bossInfo(): { name: string; hp: number } | null {
    const boss = this.enemies.find((enemy) => enemy.kind === "boss" && enemy.alive);
    if (!boss) {
      return null;
    }
    return { name: boss.id, hp: boss.hp / boss.maxHp };
  }

  radarBlips(playerPosition: THREE.Vector3): RadarBlip[] {
    return this.enemies
      .filter((enemy) => enemy.alive && enemy.spawnDelay <= 0)
      .map((enemy) => ({
        x: enemy.position.x - playerPosition.x,
        z: enemy.position.z - playerPosition.z,
        boss: enemy.kind === "boss"
      }));
  }

  private addEnemy(id: string, kind: EnemyKind, x: number, z: number, hp?: number, delay = 0): void {
    const mesh = this.sceneBuilder.createEnemyMesh(kind);
    const defaults = enemyDefaults(kind);
    const enemy: RuntimeEnemy = {
      id,
      kind,
      hp: hp ?? defaults.hp,
      maxHp: hp ?? defaults.hp,
      mesh,
      position: new THREE.Vector3(x, 0, z),
      yaw: Math.PI,
      reload: 1.2 + delay,
      spawnDelay: delay,
      radius: defaults.radius,
      speed: defaults.speed,
      attackInterval: defaults.attackInterval,
      scoreValue: defaults.score,
      alive: true,
      weakPoints: [],
      strafeSeed: x * 0.37 + z * 0.19,
      attackIndex: 0
    };
    mesh.position.copy(enemy.position);
    mesh.visible = delay <= 0;
    if (delay > 0) {
      enemy.spawnTelegraph = this.sceneBuilder.createSpawnTelegraph();
      enemy.spawnTelegraph.position.copy(enemy.position);
      this.sceneBuilder.enemyGroup.add(enemy.spawnTelegraph);
    }
    this.sceneBuilder.enemyGroup.add(mesh);
    this.enemies.push(enemy);
  }

  private addBoss(config: BossConfig, x: number, z: number): void {
    const mesh = this.sceneBuilder.createEnemyMesh("boss");
    const enemy: RuntimeEnemy = {
      id: config.name,
      kind: "boss",
      hp: config.hp,
      maxHp: config.hp,
      mesh,
      position: new THREE.Vector3(x, 0, z),
      yaw: Math.PI,
      reload: config.attackInterval,
      spawnDelay: 0,
      radius: 4.1,
      speed: 1.4,
      attackInterval: config.attackInterval,
      scoreValue: config.score,
      alive: true,
      strafeSeed: config.hp * 0.013,
      attackIndex: 0,
      weakPoints: config.weakPoints.map((point) => {
        const weakMesh = this.sceneBuilder.createWeakPointMesh(point.label);
        weakMesh.position.set(point.x, point.y, point.z);
        mesh.add(weakMesh);
        return {
          ...point,
          hp: point.hp,
          maxHp: point.hp,
          mesh: weakMesh,
          destroyed: false
        };
      })
    };
    mesh.position.copy(enemy.position);
    this.sceneBuilder.enemyGroup.add(mesh);
    this.enemies.push(enemy);
  }

  private findWeakPointHit(enemy: RuntimeEnemy, position: THREE.Vector3): RuntimeWeakPoint | null {
    for (const weakPoint of enemy.weakPoints) {
      if (weakPoint.destroyed) {
        continue;
      }
      const world = new THREE.Vector3();
      weakPoint.mesh.getWorldPosition(world);
      if (world.distanceTo(position) < 1.05) {
        return weakPoint;
      }
    }
    return null;
  }

  private finishHit(enemy: RuntimeEnemy, position: THREE.Vector3, weakPoint: boolean, score: number): HitResult {
    const killed = enemy.hp <= 0;
    if (killed) {
      enemy.alive = false;
      enemy.mesh.visible = false;
    }
    return {
      hit: true,
      killed,
      weakPoint,
      bossKilled: killed && enemy.kind === "boss",
      score: score + (killed ? enemy.scoreValue : 0),
      position: position.clone(),
      strongExplosion: killed && (enemy.kind === "heavy" || enemy.kind === "boss")
    };
  }

  private syncEnemyMesh(enemy: RuntimeEnemy, time: number): void {
    const bob = enemy.kind === "scout" ? Math.sin(time * 8 + enemy.strafeSeed) * 0.08 : enemy.kind === "heavy" ? Math.sin(time * 3 + enemy.strafeSeed) * 0.025 : enemy.kind === "boss" ? Math.sin(time * 1.8 + enemy.strafeSeed) * 0.06 : 0;
    enemy.mesh.position.set(enemy.position.x, bob, enemy.position.z);
    const body = enemy.mesh.userData.body as THREE.Object3D | undefined;
    if (body) {
      body.rotation.z = enemy.kind === "scout" ? Math.sin(time * 6 + enemy.strafeSeed) * 0.06 : 0;
    }
    const nose = enemy.mesh.userData.nose as THREE.Object3D | undefined;
    if (nose) {
      nose.rotation.z = Math.sin(time * 10 + enemy.strafeSeed) * 0.1;
    }
  }

  private updateSpawnTelegraph(enemy: RuntimeEnemy, dt: number): void {
    if (!enemy.spawnTelegraph) {
      return;
    }
    enemy.spawnTelegraph.visible = true;
    const pulse = 1 + Math.sin(performance.now() * 0.01 + enemy.strafeSeed) * 0.12;
    enemy.spawnTelegraph.scale.setScalar(pulse + Math.max(0, enemy.spawnDelay) * 0.06);
    enemy.spawnTelegraph.rotation.y += dt * 2.8;
    enemy.spawnTelegraph.traverse((item) => {
      const material = (item as THREE.Mesh).material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.32 + Math.sin(performance.now() * 0.012 + enemy.strafeSeed) * 0.14;
      }
    });
  }
}

function enemyDefaults(kind: EnemyKind): { hp: number; radius: number; speed: number; score: number; attackInterval: number } {
  if (kind === "scout") {
    return { hp: 28, radius: 1.35, speed: 8.2, score: 140, attackInterval: 1.7 };
  }
  if (kind === "heavy") {
    return { hp: 82, radius: 2.25, speed: 3.2, score: 340, attackInterval: 2.45 };
  }
  if (kind === "turret") {
    return { hp: 52, radius: 1.75, speed: 0, score: 220, attackInterval: 1.55 };
  }
  if (kind === "boss") {
    return { hp: 320, radius: 4.1, speed: 1.4, score: 1200, attackInterval: 1.05 };
  }
  return { hp: 48, radius: 1.85, speed: 5.2, score: 210, attackInterval: 2.15 };
}
