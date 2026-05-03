import * as THREE from "three";
import { AudioManager } from "../audio/AudioManager";
import { PlayerTank } from "../entities/PlayerTank";
import { InputManager } from "../input/InputManager";
import { getLevel } from "../levels/levelCatalog";
import { SceneBuilder } from "../scene/SceneBuilder";
import { EnemySystem } from "../systems/EnemySystem";
import { ParticleSystem } from "../systems/ParticleSystem";
import { ProjectileSystem } from "../systems/ProjectileSystem";
import { Hud } from "../ui/Hud";
import { grantLevelRewards, loadSave, resetSave, saveGame } from "./saveData";
import type { GameMode, LevelData, Projectile, RunStats, SaveData } from "./types";

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly sceneBuilder: SceneBuilder;
  private readonly hud = new Hud();
  private readonly input: InputManager;
  private readonly audio: AudioManager;
  private readonly player: PlayerTank;
  private readonly projectiles: ProjectileSystem;
  private readonly particles: ParticleSystem;
  private readonly enemies: EnemySystem;
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpPosition = new THREE.Vector3();

  private save: SaveData = loadSave();
  private mode: GameMode = "title";
  private level: LevelData = getLevel(1);
  private pendingLevel = this.save.currentLevel;
  private stats: RunStats = this.createStats();
  private lastTime = 0;
  private radarPingTimer = 0;
  private contactDamageCooldown = 0;
  private clearTimer = 0;
  private clearDelay = 1.2;
  private clearBoss = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.sceneBuilder = new SceneBuilder(canvas);
    this.input = new InputManager(canvas);
    this.audio = new AudioManager(this.save.muted);
    this.projectiles = new ProjectileSystem(this.sceneBuilder.projectileGroup);
    this.particles = new ParticleSystem(this.sceneBuilder.particleGroup);
    this.enemies = new EnemySystem(this.sceneBuilder);
    this.player = new PlayerTank(this.sceneBuilder.createPlayerMesh());
    this.sceneBuilder.world.add(this.player.mesh);
    this.applyDebugSaveParams();
    this.bindUi();
    this.bindKeyboardShortcuts();
    this.sceneBuilder.resize();
    this.sceneBuilder.buildArena(this.level);
    this.player.reset();
    this.hud.updateMute(this.save.muted);
    this.hud.showTitle(this.save);
  }

  start(): void {
    window.addEventListener("resize", () => this.sceneBuilder.resize());
    this.sceneBuilder.renderer.setAnimationLoop((time: number) => this.tick(time));
  }

  async quickStart(levelNumber = this.save.currentLevel): Promise<void> {
    await this.beginLevel(levelNumber, true);
  }

  private bindUi(): void {
    this.hud.onStart = () => this.showBriefing(this.save.currentLevel);
    this.hud.onDeploy = () => void this.beginLevel(this.pendingLevel);
    this.hud.onNext = () => this.showBriefing(this.save.currentLevel);
    this.hud.onRetry = () => void this.beginLevel(this.level.id);
    this.hud.onHome = () => {
      this.mode = "title";
      this.audio.setEngine(0, false);
      this.audio.switchMusic("menu");
      this.hud.showTitle(this.save);
    };
    this.hud.onPause = () => {
      if (this.mode === "playing") {
        this.mode = "paused";
        this.audio.setEngine(0, false);
        this.hud.showPause();
      }
    };
    this.hud.onResume = () => {
      if (this.mode === "paused") {
        this.mode = "playing";
        this.hud.showRun();
      }
    };
    this.hud.onMute = () => {
      this.save.muted = this.audio.toggleMuted();
      saveGame(this.save);
      this.hud.updateMute(this.save.muted);
    };
  }

  private bindKeyboardShortcuts(): void {
    window.addEventListener("keydown", (event) => {
      if (event.code === "Escape" || event.code === "KeyP") {
        if (this.mode === "playing") {
          this.mode = "paused";
          this.audio.setEngine(0, false);
          this.hud.showPause();
        } else if (this.mode === "paused") {
          this.mode = "playing";
          this.hud.showRun();
        }
      }
      if (event.code === "KeyR" && (this.mode === "gameOver" || this.mode === "levelClear")) {
        void this.beginLevel(this.level.id);
      }
      if ((event.code === "Space" || event.code === "Enter") && this.mode === "title") {
        this.showBriefing(this.save.currentLevel);
      } else if ((event.code === "Space" || event.code === "Enter") && this.mode === "briefing") {
        void this.beginLevel(this.pendingLevel);
      }
      if (event.code === "KeyM") {
        this.save.muted = this.audio.toggleMuted();
        saveGame(this.save);
        this.hud.updateMute(this.save.muted);
      }
    });
  }

  private applyDebugSaveParams(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.has("reset")) {
      this.save = resetSave();
    }
    if (params.has("unlock")) {
      this.save.currentLevel = Math.max(this.save.currentLevel, 10);
      this.save.medals = Math.max(this.save.medals, 30);
      this.save.highScore = Math.max(this.save.highScore, 50000);
      saveGame(this.save);
    }
  }

  private async beginLevel(levelNumber: number, skipAudio = false): Promise<void> {
    if (!skipAudio) {
      await this.audio.unlock();
    }
    this.level = getLevel(levelNumber);
    this.stats = this.createStats();
    this.mode = "playing";
    this.sceneBuilder.buildArena(this.level);
    this.player.reset();
    this.projectiles.reset();
    this.particles.reset();
    this.enemies.loadLevel(this.level);
    this.radarPingTimer = 0.8;
    this.contactDamageCooldown = 0;
    this.clearTimer = 0;
    this.clearBoss = false;
    this.audio.switchMusic(this.level.boss ? "boss" : "combat");
    this.hud.showRun();
    this.hud.popText(this.level.name, this.level.boss ? "boss" : "good");
  }

  private showBriefing(levelNumber: number): void {
    this.pendingLevel = levelNumber;
    this.mode = "briefing";
    this.audio.setEngine(0, false);
    this.audio.switchMusic("menu");
    this.hud.showBriefing(getLevel(levelNumber), this.save);
  }

  private tick(timeMs: number): void {
    const time = timeMs / 1000;
    const dt = Math.min(0.05, this.lastTime ? time - this.lastTime : 0.016);
    this.lastTime = time;

    if (this.mode === "playing") {
      this.updatePlaying(dt);
    } else if (this.mode === "levelClearing") {
      this.updateLevelClearing(dt);
    } else {
      this.audio.setEngine(0, false);
    }
    this.particles.update(dt);
    this.player.updateCamera(this.sceneBuilder.camera, dt);
    this.sceneBuilder.render();
  }

  private updatePlaying(dt: number): void {
    const input = this.input.read();
    this.audio.setEngine(input.throttle, true);
    this.player.update(input, this.level.arenaSize, dt);
    if (this.sceneBuilder.pushOutOfObstacles(this.player.position, 1.55)) {
      this.player.sync();
    }
    if ((input.fire || (input.fireHeld && this.player.reload <= 0)) && this.player.canFire()) {
      this.firePlayerShell();
    }

    this.enemies.update(this.player.position, dt).forEach((request) => {
      this.projectiles.fire("enemy", request.position, request.forward, request.speed, request.damage);
      this.particles.spawnMuzzle(request.position, request.forward);
      this.audio.enemyShoot();
    });
    this.resolveTankEnemyCollisions(dt);

    this.projectiles.update(dt, this.level.arenaSize);
    this.resolveProjectileCollisions();
    this.radarPingTimer -= dt;
    if (this.radarPingTimer <= 0) {
      this.radarPingTimer = this.level.boss ? 1.6 : 2.35;
      this.audio.radarPing();
    }
    this.stats.score += dt * Math.max(0, 6 - this.enemies.aliveCount()) * 0.8;
    this.updateHud();

    if (this.player.armor <= 0) {
      this.failLevel();
      return;
    }
    if (this.enemies.remainingCount() === 0) {
      this.startLevelClearSequence(this.level.boss !== undefined);
    }
  }

  private firePlayerShell(): void {
    const muzzle = this.player.getMuzzlePosition(this.tmpPosition);
    const forward = this.player.getAimForward(this.tmpForward);
    this.projectiles.fire("player", muzzle, forward, 58, 42);
    this.player.markFired();
    this.stats.shots += 1;
    this.particles.spawnMuzzle(muzzle, forward);
    this.audio.shoot();
  }

  private resolveProjectileCollisions(): void {
    const active = [...this.projectiles.projectiles];
    active.forEach((projectile) => {
      if (!this.projectiles.projectiles.includes(projectile)) {
        return;
      }
      if (projectile.owner === "player") {
        const obstacle = this.sceneBuilder.projectileObstacleHit(projectile.position, projectile.radius);
        if (obstacle) {
          this.projectiles.remove(projectile);
          this.particles.spawnImpact(projectile.position, 0xffd166);
          this.audio.hit();
          return;
        }
        const result = this.enemies.applyHit(projectile);
        if (!result.hit) {
          return;
        }
        this.projectiles.remove(projectile);
        this.stats.hits += 1;
        if (result.weakPoint) {
          this.stats.weakPoints += 1;
          this.hud.popText("Weak point", "boss");
        }
        if (result.killed) {
          this.stats.kills += 1;
          this.stats.streak += 1;
          this.stats.maxStreak = Math.max(this.stats.maxStreak, this.stats.streak);
          const multiplier = 1 + Math.min(5, Math.max(0, this.stats.streak - 1)) * 0.12;
          const killScore = Math.round(result.score * multiplier);
          const bonus = Math.max(0, killScore - result.score);
          this.stats.streakBonus += bonus;
          this.stats.score += killScore;
          this.hud.popText(`Kill +${killScore}`, result.bossKilled ? "boss" : "good");
          this.particles.spawnExplosion(result.position, result.strongExplosion);
          this.audio.explosion(result.strongExplosion);
        } else {
          this.stats.score += result.score;
          this.particles.spawnImpact(result.position, result.weakPoint ? 0x66d9ff : 0x70ff9e);
          this.audio.hit();
        }
        return;
      }

      const obstacle = this.sceneBuilder.projectileObstacleHit(projectile.position, projectile.radius);
      if (obstacle) {
        this.projectiles.remove(projectile);
        this.particles.spawnImpact(projectile.position, 0xff6a4d);
        return;
      }

      if (projectile.position.distanceTo(this.player.position) < 1.45 + projectile.radius) {
        this.projectiles.remove(projectile);
        this.player.damage(projectile.damage);
        this.stats.damageTaken += projectile.damage;
        this.stats.streak = 0;
        this.particles.spawnImpact(projectile.position, 0xff6a4d);
        this.hud.flashDamage();
        this.hud.popText(`Armor -${projectile.damage}`, "bad");
        this.audio.explosion(false);
      }
    });
  }

  private resolveTankEnemyCollisions(dt: number): void {
    this.contactDamageCooldown = Math.max(0, this.contactDamageCooldown - dt);
    this.enemies.enemies.forEach((enemy) => {
      if (!enemy.alive || enemy.spawnDelay > 0) {
        return;
      }
      const dx = this.player.position.x - enemy.position.x;
      const dz = this.player.position.z - enemy.position.z;
      const distance = Math.hypot(dx, dz);
      const minimum = 1.55 + enemy.radius;
      if (distance <= 0.001 || distance >= minimum) {
        return;
      }
      const push = (minimum - distance) / distance;
      this.player.position.x += dx * push;
      this.player.position.z += dz * push;
      this.player.sync();
      if (this.contactDamageCooldown <= 0) {
        const damage = enemy.kind === "boss" ? 28 : enemy.kind === "heavy" ? 18 : enemy.kind === "scout" ? 9 : 13;
        this.player.damage(damage);
        this.stats.damageTaken += damage;
        this.stats.streak = 0;
        this.contactDamageCooldown = 0.9;
        this.hud.flashDamage();
        this.hud.popText(`Rammed -${damage}`, "bad");
        this.particles.spawnImpact(this.player.position.clone().setY(0.7), 0xff6a4d);
        this.audio.explosion(false);
      }
    });
  }

  private startLevelClearSequence(bossDefeated: boolean): void {
    if (this.mode !== "playing") {
      return;
    }
    this.mode = "levelClearing";
    this.audio.setEngine(0, false);
    this.clearTimer = 0;
    this.clearBoss = bossDefeated;
    this.clearDelay = bossDefeated ? 2.8 : 1.35;
    this.projectiles.reset();
    this.audio.reward();
    this.hud.popText(bossDefeated ? "Boss destroyed" : "Zone secure", bossDefeated ? "boss" : "good");
    this.particles.spawnExplosion(this.player.position.clone().setY(1.2), bossDefeated);
  }

  private updateLevelClearing(dt: number): void {
    this.clearTimer += dt;
    this.audio.setEngine(0, false);
    this.player.update({ throttle: 0, turn: 0, turretTurn: 0, fire: false, fireHeld: false }, this.level.arenaSize, dt);
    if (this.clearBoss && this.clearTimer < 2.2 && Math.floor(this.clearTimer * 8) !== Math.floor((this.clearTimer - dt) * 8)) {
      const angle = this.clearTimer * 5.4;
      const burst = new THREE.Vector3(Math.sin(angle) * 4, 1.2 + Math.sin(angle * 1.7) * 0.6, this.level.arenaSize * 0.32 + Math.cos(angle) * 4);
      this.particles.spawnExplosion(burst, true);
      this.audio.explosion(true);
    }
    this.updateHud();
    if (this.clearTimer >= this.clearDelay) {
      this.completeLevel();
    }
  }

  private completeLevel(): void {
    if (this.mode !== "playing" && this.mode !== "levelClearing") {
      return;
    }
    this.mode = "levelClear";
    this.audio.setEngine(0, false);
    this.applyCompletionBonuses();
    const reward = grantLevelRewards(this.save, this.level.id, this.stats, this.level.targetScore);
    this.stats.medals = reward.medals;
    this.particles.spawnExplosion(this.player.position.clone().setY(1.2), true);
    this.audio.reward();
    this.hud.showClear(this.level.name, this.stats, reward.medals, reward.best);
  }

  private failLevel(): void {
    if (this.mode !== "playing") {
      return;
    }
    this.mode = "gameOver";
    this.audio.setEngine(0, false);
    this.particles.spawnExplosion(this.player.position.clone().setY(0.9), true);
    this.audio.fail();
    this.hud.showFail(this.stats);
  }

  private updateHud(): void {
    const boss = this.enemies.bossInfo();
    this.hud.updateRun({
      level: this.level.id,
      armor: this.player.armor,
      score: this.stats.score,
      targets: this.enemies.remainingCount(),
      reload: this.player.reload,
      stats: this.stats,
      blips: this.enemies.radarBlips(this.player.position),
      arenaSize: this.level.arenaSize,
      objectiveLabel: this.level.objective?.label,
      bossName: boss?.name,
      bossHp: boss?.hp
    });
  }

  private createStats(): RunStats {
    return {
      score: 0,
      kills: 0,
      shots: 0,
      hits: 0,
      streak: 0,
      maxStreak: 0,
      weakPoints: 0,
      damageTaken: 0,
      timeBonus: 0,
      noDamageBonus: 0,
      streakBonus: 0,
      objectiveBonus: 0,
      medals: 0,
      levelStartedAt: performance.now()
    };
  }

  private applyCompletionBonuses(): void {
    if (this.stats.timeBonus > 0 || this.stats.noDamageBonus > 0 || this.stats.objectiveBonus > 0) {
      return;
    }
    const elapsed = (performance.now() - this.stats.levelStartedAt) / 1000;
    const parTime = 44 + this.level.enemySpawns.length * 2.8 + (this.level.boss ? 32 : 0);
    this.stats.timeBonus = Math.max(0, Math.round((parTime - elapsed) * 14));
    this.stats.noDamageBonus = this.stats.damageTaken <= 0 ? 850 + this.level.id * 35 : 0;
    this.stats.objectiveBonus = this.isObjectiveComplete(elapsed, parTime) ? (this.level.objective?.bonus ?? 0) : 0;
    this.stats.score += this.stats.timeBonus + this.stats.noDamageBonus + this.stats.objectiveBonus;
  }

  private isObjectiveComplete(elapsed: number, parTime: number): boolean {
    const objective = this.level.objective;
    if (!objective) {
      return false;
    }
    if (objective.kind === "accuracy") {
      return this.stats.hits / Math.max(1, this.stats.shots) >= objective.target;
    }
    if (objective.kind === "armor") {
      return this.stats.damageTaken <= objective.target;
    }
    if (objective.kind === "streak") {
      return this.stats.maxStreak >= objective.target;
    }
    if (objective.kind === "weakPoints") {
      return this.stats.weakPoints >= objective.target;
    }
    return elapsed <= parTime;
  }
}
