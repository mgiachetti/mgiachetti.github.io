import * as THREE from "three";
import type { Projectile, ProjectileOwner } from "../game/types";

export class ProjectileSystem {
  readonly projectiles: Projectile[] = [];

  private readonly group: THREE.Group;
  private nextId = 1;
  private readonly playerMaterial = new THREE.MeshBasicMaterial({ color: 0xb7ffd0 });
  private readonly enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff6a4d });
  private readonly playerTrailMaterial = new THREE.LineBasicMaterial({ color: 0x70ff9e, transparent: true, opacity: 0.62 });
  private readonly enemyTrailMaterial = new THREE.LineBasicMaterial({ color: 0xff6a4d, transparent: true, opacity: 0.5 });
  private readonly geometry = new THREE.SphereGeometry(0.14, 10, 8);

  constructor(group: THREE.Group) {
    this.group = group;
  }

  reset(): void {
    this.projectiles.forEach((projectile) => this.group.remove(projectile.mesh));
    this.projectiles.length = 0;
  }

  fire(owner: ProjectileOwner, position: THREE.Vector3, forward: THREE.Vector3, speed: number, damage: number): Projectile {
    const mesh = new THREE.Mesh(this.geometry, owner === "player" ? this.playerMaterial : this.enemyMaterial);
    mesh.position.copy(position);
    this.group.add(mesh);
    const trail = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([position, position.clone().addScaledVector(forward, -2.2)]),
      owner === "player" ? this.playerTrailMaterial : this.enemyTrailMaterial
    );
    this.group.add(trail);
    const projectile: Projectile = {
      id: this.nextId++,
      owner,
      mesh,
      trail,
      position: position.clone(),
      velocity: forward.clone().normalize().multiplyScalar(speed),
      damage,
      radius: owner === "player" ? 0.36 : 0.44,
      life: owner === "player" ? 2.4 : 3.1
    };
    this.projectiles.push(projectile);
    return projectile;
  }

  remove(projectile: Projectile): void {
    const index = this.projectiles.indexOf(projectile);
    if (index >= 0) {
      this.projectiles.splice(index, 1);
    }
    if (projectile.trail instanceof THREE.Line) {
      projectile.trail.geometry.dispose();
    }
    this.group.remove(projectile.mesh);
    this.group.remove(projectile.trail);
  }

  update(dt: number, arenaSize: number): void {
    const half = arenaSize / 2 + 8;
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.life -= dt;
      projectile.position.addScaledVector(projectile.velocity, dt);
      projectile.mesh.position.copy(projectile.position);
      const direction = projectile.velocity.clone().normalize();
      (projectile.trail as THREE.Line).geometry.dispose();
      (projectile.trail as THREE.Line).geometry = new THREE.BufferGeometry().setFromPoints([
        projectile.position,
        projectile.position.clone().addScaledVector(direction, projectile.owner === "player" ? -4.2 : -3.1)
      ]);
      if (projectile.life <= 0 || Math.abs(projectile.position.x) > half || Math.abs(projectile.position.z) > half) {
        this.remove(projectile);
      }
    }
  }
}
