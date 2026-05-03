import * as THREE from "three";
import type { InputState } from "../input/InputManager";
import { clamp, damp, wrapAngle } from "../utils/math";

export class PlayerTank {
  readonly mesh: THREE.Group;
  readonly position = new THREE.Vector3();
  yaw = 0;
  turretYaw = 0;
  armor = 100;
  reload = 0;
  shots = 0;
  damageFlash = 0;

  private speed = 0;
  private readonly forward = new THREE.Vector3();
  private readonly aimForward = new THREE.Vector3();

  constructor(mesh: THREE.Group) {
    this.mesh = mesh;
    this.mesh.position.copy(this.position);
  }

  reset(): void {
    this.position.set(0, 0, -8);
    this.yaw = 0;
    this.turretYaw = 0;
    this.armor = 100;
    this.reload = 0;
    this.speed = 0;
    this.shots = 0;
    this.damageFlash = 0;
    this.syncMesh();
  }

  update(input: InputState, arenaSize: number, dt: number): void {
    const turnRate = 2.15;
    this.yaw += input.turn * turnRate * dt;
    this.turretYaw += input.turretDelta;
    if (Math.abs(input.turretTurn) > 0.04) {
      this.turretYaw += input.turretTurn * 1.35 * dt;
    } else if (!input.aimActive) {
      this.turretYaw += clamp(wrapAngle(this.yaw - this.turretYaw), -0.675 * dt, 0.675 * dt);
    }
    const targetSpeed = input.throttle * (input.throttle > 0 ? 12 : 7);
    this.speed = damp(this.speed, targetSpeed, 5.5, dt);
    this.getForward(this.forward);
    this.position.addScaledVector(this.forward, this.speed * dt);
    const half = arenaSize / 2 - 3;
    this.position.x = clamp(this.position.x, -half, half);
    this.position.z = clamp(this.position.z, -half, half);
    this.reload = Math.max(0, this.reload - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.8);
    this.syncMesh();
  }

  canFire(): boolean {
    return this.reload <= 0;
  }

  markFired(): void {
    this.reload = 0.62;
    this.shots += 1;
  }

  damage(amount: number): void {
    this.armor = Math.max(0, this.armor - amount);
    this.damageFlash = 1;
  }

  sync(): void {
    this.syncMesh();
  }

  getMuzzlePosition(target = new THREE.Vector3()): THREE.Vector3 {
    this.getAimForward(this.aimForward);
    return target.copy(this.position).addScaledVector(this.aimForward, 2.75).setY(1.06);
  }

  getForward(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  getAimForward(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(Math.sin(this.turretYaw), 0, Math.cos(this.turretYaw)).normalize();
  }

  updateCamera(camera: THREE.PerspectiveCamera, dt: number): void {
    this.getForward(this.forward);
    this.getAimForward(this.aimForward);
    const desiredPosition = this.position.clone().addScaledVector(this.aimForward, -6.6).add(new THREE.Vector3(0, 3.35, 0));
    camera.position.lerp(desiredPosition, 1 - Math.exp(-5.2 * dt));
    const lookTarget = this.position.clone().addScaledVector(this.aimForward, 28).setY(1.35);
    camera.lookAt(lookTarget);
  }

  private syncMesh(): void {
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
    const recoil = 1 + this.damageFlash * 0.035;
    this.mesh.scale.set(recoil, 1 + this.damageFlash * 0.02, recoil);
    const turretPivot = this.mesh.userData.turretPivot as THREE.Object3D | undefined;
    if (turretPivot) {
      turretPivot.rotation.y = wrapAngle(this.turretYaw - this.yaw);
    }
  }
}
