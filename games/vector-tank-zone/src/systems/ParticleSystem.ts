import * as THREE from "three";

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity?: number;
  grow?: number;
  fadeMaterial?: THREE.Material & { opacity?: number; transparent?: boolean };
};

export class ParticleSystem {
  private readonly group: THREE.Group;
  private readonly particles: Particle[] = [];
  private readonly meshPool: THREE.Mesh[] = [];
  private readonly maxParticles = 260;
  private readonly sphere = new THREE.SphereGeometry(0.12, 8, 6);
  private readonly shard = new THREE.BoxGeometry(0.16, 0.045, 0.42);
  private readonly smoke = new THREE.SphereGeometry(0.38, 10, 8);
  private readonly scorch = new THREE.CircleGeometry(1, 28);
  private readonly shockRing = new THREE.TorusGeometry(1, 0.035, 8, 64);

  constructor(group: THREE.Group) {
    this.group = group;
  }

  reset(): void {
    while (this.particles.length > 0) {
      this.removeParticle(this.particles.length - 1);
    }
  }

  spawnMuzzle(position: THREE.Vector3, forward: THREE.Vector3): void {
    for (let index = 0; index < 8; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: index % 2 ? 0x70ff9e : 0xffffff, transparent: true, opacity: 0.9 });
      const mesh = this.borrowMesh(this.sphere, material);
      mesh.position.copy(position).addScaledVector(forward, 0.25);
      mesh.scale.setScalar(0.65 + Math.random() * 0.55);
      const side = new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.2) * 0.7, (Math.random() - 0.5) * 1.2);
      const velocity = forward.clone().multiplyScalar(6 + Math.random() * 4).add(side);
      this.addParticle({
        mesh,
        velocity,
        angularVelocity: new THREE.Vector3(),
        life: 0.22 + Math.random() * 0.12,
        maxLife: 0.34,
        fadeMaterial: material
      });
    }
  }

  spawnImpact(position: THREE.Vector3, color = 0x70ff9e): void {
    for (let index = 0; index < 12; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86 });
      const mesh = this.borrowMesh(this.shard, material);
      mesh.position.copy(position);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.addParticle({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 8, 1 + Math.random() * 3, (Math.random() - 0.5) * 8),
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 12),
        life: 0.6 + Math.random() * 0.3,
        maxLife: 0.9,
        fadeMaterial: material
      });
    }
    this.spawnSmoke(position, 4, false);
    this.spawnScorch(position, 0.9, color);
  }

  spawnExplosion(position: THREE.Vector3, strong = false): void {
    const count = strong ? 58 : 32;
    const colors = strong ? [0xffd166, 0xff6a4d, 0xffffff, 0x66d9ff] : [0xff6a4d, 0xffd166, 0x70ff9e];
    for (let index = 0; index < count; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: colors[index % colors.length], transparent: true, opacity: 0.92 });
      const mesh = this.borrowMesh(index % 3 === 0 ? this.shard : this.sphere, material);
      mesh.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 1.1, Math.random() * 0.7, (Math.random() - 0.5) * 1.1));
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      mesh.scale.setScalar(strong ? 1.25 : 0.95);
      const angle = Math.random() * Math.PI * 2;
      const speed = (strong ? 7 : 4.5) + Math.random() * (strong ? 9 : 5);
      this.addParticle({
        mesh,
        velocity: new THREE.Vector3(Math.sin(angle) * speed, 1.2 + Math.random() * (strong ? 5 : 3), Math.cos(angle) * speed),
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 16),
        life: (strong ? 1.4 : 0.9) + Math.random() * 0.55,
        maxLife: strong ? 1.95 : 1.2,
        fadeMaterial: material
      });
    }

    const ringMaterial = new THREE.MeshBasicMaterial({ color: strong ? 0xffd166 : 0xff6a4d, transparent: true, opacity: 0.55, depthWrite: false });
    const ring = this.borrowMesh(this.shockRing, ringMaterial);
    ring.position.copy(position).setY(0.08);
    ring.rotation.x = Math.PI / 2;
    ring.scale.setScalar(strong ? 1.2 : 0.7);
    this.addParticle({
      mesh: ring,
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      life: strong ? 0.85 : 0.58,
      maxLife: strong ? 0.85 : 0.58,
      fadeMaterial: ringMaterial
    });
    this.spawnSmoke(position, strong ? 12 : 7, strong);
    this.spawnScorch(position, strong ? 2.8 : 1.5, strong ? 0xff6a4d : 0xffd166);
  }

  update(dt: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;
      particle.velocity.y -= (particle.gravity ?? 5.4) * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += particle.angularVelocity.x * dt;
      particle.mesh.rotation.y += particle.angularVelocity.y * dt;
      particle.mesh.rotation.z += particle.angularVelocity.z * dt;
      if (particle.mesh instanceof THREE.Mesh && particle.mesh.geometry.type.includes("Torus")) {
        particle.mesh.scale.multiplyScalar(1 + dt * 2.4);
      } else if (particle.grow !== undefined) {
        particle.mesh.scale.multiplyScalar(1 + dt * particle.grow);
      } else {
        particle.mesh.scale.multiplyScalar(0.985);
      }
      if (particle.fadeMaterial && typeof particle.fadeMaterial.opacity === "number") {
        particle.fadeMaterial.opacity = Math.max(0, particle.life / particle.maxLife);
      }
      if (particle.life <= 0) {
        this.removeParticle(index);
      }
    }
  }

  private spawnSmoke(position: THREE.Vector3, count: number, strong: boolean): void {
    for (let index = 0; index < count; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: strong ? 0x6f766f : 0x44524a, transparent: true, opacity: strong ? 0.26 : 0.18, depthWrite: false });
      const mesh = this.borrowMesh(this.smoke, material);
      mesh.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 0.5, (Math.random() - 0.5) * 1.6));
      mesh.scale.setScalar(strong ? 1.2 + Math.random() * 0.7 : 0.72 + Math.random() * 0.38);
      this.addParticle({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.45 + Math.random() * (strong ? 1.1 : 0.65), (Math.random() - 0.5) * 0.8),
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8),
        life: strong ? 2.3 + Math.random() * 0.8 : 1.35 + Math.random() * 0.55,
        maxLife: strong ? 3.1 : 1.9,
        gravity: -0.08,
        grow: strong ? 0.72 : 0.48,
        fadeMaterial: material
      });
    }
  }

  private spawnScorch(position: THREE.Vector3, radius: number, color: number): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false });
    const mesh = this.borrowMesh(this.scorch, material);
    mesh.position.copy(position).setY(0.014);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI;
    mesh.scale.set(radius, radius, radius);
    this.addParticle({
      mesh,
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      life: 7.5,
      maxLife: 7.5,
      gravity: 0,
      grow: 0,
      fadeMaterial: material
    });
  }

  private addParticle(particle: Particle): void {
    this.group.add(particle.mesh);
    this.particles.push(particle);
    if (this.particles.length > this.maxParticles) {
      this.removeParticle(0);
    }
  }

  private removeParticle(index: number): void {
    const particle = this.particles[index];
    this.group.remove(particle.mesh);
    this.particles.splice(index, 1);
    this.recycleMesh(particle.mesh);
  }

  private borrowMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    const mesh = this.meshPool.pop() ?? new THREE.Mesh();
    mesh.geometry = geometry;
    mesh.material = material;
    mesh.visible = true;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    return mesh;
  }

  private recycleMesh(mesh: THREE.Mesh): void {
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else {
      material.dispose();
    }
    mesh.visible = false;
    if (this.meshPool.length < this.maxParticles) {
      this.meshPool.push(mesh);
    }
  }
}
