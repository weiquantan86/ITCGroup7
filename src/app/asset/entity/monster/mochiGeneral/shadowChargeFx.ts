import * as THREE from "three";

type ShadowChargeParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  center: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
  spinSpeed: number;
};

export type MochiGeneralShadowChargeFx = {
  spawnBurst: (
    origin: THREE.Vector3,
    options?: {
      count?: number;
      radiusScale?: number;
      inwardSpeedScale?: number;
      lifeScale?: number;
    }
  ) => void;
  update: (delta: number) => void;
  dispose: () => void;
};

const SHADOW_ORB_COLOR = 0x08070d;
const SHADOW_ORB_EMISSIVE = 0x2a1840;
const SHADOW_ORB_EMISSIVE_INTENSITY = 1.34;
const SHADOW_CHARGE_MIN_COUNT = 6;
const SHADOW_CHARGE_RADIUS_MIN = 0.56;
const SHADOW_CHARGE_RADIUS_MAX = 1.46;
const SHADOW_CHARGE_SPEED_MIN = 3.2;
const SHADOW_CHARGE_SPEED_MAX = 7.8;
const SHADOW_CHARGE_LIFE_MIN = 0.28;
const SHADOW_CHARGE_LIFE_MAX = 0.58;
const SHADOW_CHARGE_SCALE_MIN = 0.56;
const SHADOW_CHARGE_SCALE_MAX = 1.22;

const spawnDirection = new THREE.Vector3();
const spawnPosition = new THREE.Vector3();
const inwardDirection = new THREE.Vector3();

export const createMochiGeneralShadowChargeFx = (
  scene: THREE.Scene
): MochiGeneralShadowChargeFx => {
  const particleGeometry = new THREE.SphereGeometry(0.09, 9, 7);
  const particleMaterialTemplate = new THREE.MeshStandardMaterial({
    color: SHADOW_ORB_COLOR,
    roughness: 0.24,
    metalness: 0.08,
    emissive: SHADOW_ORB_EMISSIVE,
    emissiveIntensity: SHADOW_ORB_EMISSIVE_INTENSITY,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles: ShadowChargeParticle[] = [];

  const removeParticleAt = (index: number) => {
    const particle = particles[index];
    if (!particle) return;
    particle.mesh.removeFromParent();
    particle.material.dispose();
    particles.splice(index, 1);
  };

  const spawnBurst = (
    origin: THREE.Vector3,
    options?: {
      count?: number;
      radiusScale?: number;
      inwardSpeedScale?: number;
      lifeScale?: number;
    }
  ) => {
    const particleCount = Math.max(
      SHADOW_CHARGE_MIN_COUNT,
      Math.floor(options?.count ?? 12)
    );
    const radiusScale = Math.max(0.2, options?.radiusScale ?? 1);
    const inwardSpeedScale = Math.max(0.2, options?.inwardSpeedScale ?? 1);
    const lifeScale = Math.max(0.2, options?.lifeScale ?? 1);

    for (let i = 0; i < particleCount; i += 1) {
      let attempts = 0;
      do {
        spawnDirection.set(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        );
        attempts += 1;
        if (attempts > 10) break;
      } while (spawnDirection.lengthSq() <= 0.00001);
      if (spawnDirection.lengthSq() <= 0.00001) {
        spawnDirection.set(1, 0.3, 0);
      }
      spawnDirection.normalize();

      const radius =
        THREE.MathUtils.lerp(SHADOW_CHARGE_RADIUS_MIN, SHADOW_CHARGE_RADIUS_MAX, Math.random()) *
        radiusScale;
      spawnPosition.copy(origin).addScaledVector(spawnDirection, radius);
      spawnPosition.y += THREE.MathUtils.lerp(-0.18, 0.52, Math.random()) * radiusScale;

      inwardDirection.copy(origin).sub(spawnPosition);
      if (inwardDirection.lengthSq() <= 0.00001) {
        inwardDirection.set(0, 1, 0);
      } else {
        inwardDirection.normalize();
      }

      const material = particleMaterialTemplate.clone();
      material.opacity = THREE.MathUtils.lerp(0.48, 0.95, Math.random());
      material.emissiveIntensity =
        SHADOW_ORB_EMISSIVE_INTENSITY * THREE.MathUtils.lerp(0.78, 1.18, Math.random());

      const mesh = new THREE.Mesh(particleGeometry, material);
      mesh.position.copy(spawnPosition);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 6;

      const startScale = THREE.MathUtils.lerp(
        SHADOW_CHARGE_SCALE_MIN,
        SHADOW_CHARGE_SCALE_MAX,
        Math.random()
      );
      const endScale = startScale * THREE.MathUtils.lerp(0.14, 0.5, Math.random());
      mesh.scale.setScalar(startScale);
      scene.add(mesh);

      const speed =
        THREE.MathUtils.lerp(SHADOW_CHARGE_SPEED_MIN, SHADOW_CHARGE_SPEED_MAX, Math.random()) *
        inwardSpeedScale;
      const life =
        THREE.MathUtils.lerp(SHADOW_CHARGE_LIFE_MIN, SHADOW_CHARGE_LIFE_MAX, Math.random()) *
        lifeScale;

      particles.push({
        mesh,
        material,
        center: origin.clone(),
        velocity: inwardDirection.multiplyScalar(speed),
        age: 0,
        life,
        startScale,
        endScale,
        spinSpeed: THREE.MathUtils.lerp(4.2, 12.5, Math.random()),
      });
    }
  };

  const update = (delta: number) => {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.age += delta;
      const t = particle.life > 0 ? particle.age / particle.life : 1;
      if (t >= 1) {
        removeParticleAt(i);
        continue;
      }

      inwardDirection.copy(particle.center).sub(particle.mesh.position);
      if (inwardDirection.lengthSq() > 0.000001) {
        inwardDirection.normalize().multiplyScalar(
          THREE.MathUtils.lerp(4.5, 10.2, t)
        );
        particle.velocity.lerp(
          inwardDirection,
          THREE.MathUtils.clamp(delta * 7.4, 0, 1)
        );
      }

      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.multiplyScalar(
        THREE.MathUtils.clamp(1 - delta * 2.4, 0.7, 0.98)
      );
      particle.mesh.rotation.x += delta * particle.spinSpeed;
      particle.mesh.rotation.y += delta * particle.spinSpeed * 0.62;
      particle.mesh.scale.setScalar(
        THREE.MathUtils.lerp(particle.startScale, particle.endScale, t)
      );

      const fade = Math.max(0, 1 - t);
      particle.material.opacity = fade * fade * 0.95;
      particle.material.emissiveIntensity =
        SHADOW_ORB_EMISSIVE_INTENSITY * (0.36 + fade * 0.82);
    }
  };

  const dispose = () => {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      removeParticleAt(i);
    }
    particleGeometry.dispose();
    particleMaterialTemplate.dispose();
  };

  return {
    spawnBurst,
    update,
    dispose,
  };
};
