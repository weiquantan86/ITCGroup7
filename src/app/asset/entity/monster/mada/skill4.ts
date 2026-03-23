import * as THREE from "three";
import type { PlayerWorldTickArgs } from "../../character/general/player";

const MADA_SKILL4_DURING_DURATION_MS = 5000;
const MADA_SKILL4_DURING_WARMUP_MS = 1500;
const MADA_SKILL4_BEFORE_FALLBACK_MS = 820;
const MADA_SKILL4_AFTER_FALLBACK_MS = 860;
const MADA_SKILL4_AFTER_FINISH_GRACE_MS = 120;
const MADA_SKILL4_BEFORE_FLASH_INTERVAL_MS = 120;
const MADA_SKILL4_CHARGE_SPAWN_INTERVAL_MS = 34;
const MADA_SKILL4_CHARGE_PARTICLES_PER_BURST = 8;
const MADA_SKILL4_LASER_DAMAGE = 10;
const MADA_SKILL4_LASER_DAMAGE_INTERVAL_MS = 500;
const MADA_SKILL4_LASER_LENGTH_MULTIPLIER = 5;
const MADA_SKILL4_LASER_MIN_LENGTH = 6 * MADA_SKILL4_LASER_LENGTH_MULTIPLIER;
const MADA_SKILL4_LASER_MAX_LENGTH = 36 * MADA_SKILL4_LASER_LENGTH_MULTIPLIER;
const MADA_SKILL4_LASER_GROW_SPEED_PER_S = 30;
const MADA_SKILL4_LASER_TURN_SPEED_RAD_PER_S = 0.2;
const MADA_SKILL4_LASER_HIT_RADIUS = 0.88;
const MADA_SKILL4_PLAYER_RADIUS = 0.72;
const MADA_SKILL4_FALLBACK_REFERENCE_OFFSET_Y = 2.05;

type MadaSkill4AnimationBridge = {
  triggerSkill4Before: () => number;
  triggerSkill4During: () => number;
  triggerSkill4After: () => number;
  isSkill4AfterPlaying: () => boolean;
  getGrabReferenceWorldPosition: (target: THREE.Vector3) => boolean;
};

type TickArgs = {
  now: number;
  delta: number;
  rig: THREE.Object3D;
  player: PlayerWorldTickArgs["player"];
  applyDamage: PlayerWorldTickArgs["applyDamage"];
};

type ChargeParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

type BodyMaterialState = {
  material: THREE.Material;
  baseColor?: THREE.Color;
  baseEmissive?: THREE.Color;
  baseEmissiveIntensity?: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const randomSigned = () => Math.random() * 2 - 1;

const isColorMaterial = (
  material: THREE.Material
): material is THREE.Material & { color: THREE.Color } =>
  Boolean(
    (material as THREE.Material & { color?: THREE.Color }).color?.isColor
  );

const isEmissiveMaterial = (
  material: THREE.Material
): material is THREE.Material & {
  emissive: THREE.Color;
  emissiveIntensity: number;
} => {
  const candidate = material as THREE.Material & {
    emissive?: THREE.Color;
    emissiveIntensity?: number;
  };
  return Boolean(candidate.emissive?.isColor);
};

const referenceProbe = new THREE.Vector3();
const playerProbe = new THREE.Vector3();
const laserDirection = new THREE.Vector3();
const desiredLaserDirection = new THREE.Vector3();
const laserToPlayer = new THREE.Vector3();
const randomOffset = new THREE.Vector3();
const particleVelocity = new THREE.Vector3();
const particleToCenter = new THREE.Vector3();
const tangentVector = new THREE.Vector3();
const laserTurnAxis = new THREE.Vector3();
const laserFallbackAxis = new THREE.Vector3();
const laserUpAxis = new THREE.Vector3(0, 1, 0);

export const createMadaSkill4Runtime = ({
  scene,
  animation,
}: {
  scene: THREE.Scene;
  animation: MadaSkill4AnimationBridge;
}) => {
  const chargeParticleGeometry = new THREE.SphereGeometry(0.1, 7, 6);
  const chargeCoreGeometry = new THREE.SphereGeometry(0.36, 16, 12);
  const chargeRingGeometry = new THREE.TorusGeometry(1.12, 0.09, 10, 40);
  const laserCoreGeometry = new THREE.CylinderGeometry(0.16, 0.16, 1, 12, 1, true);
  const laserAuraGeometry = new THREE.CylinderGeometry(0.32, 0.32, 1, 14, 1, true);
  const laserShellGeometry = new THREE.CylinderGeometry(0.48, 0.48, 1, 14, 1, true);
  const laserOrbGeometry = new THREE.SphereGeometry(0.34, 16, 12);
  const laserRingGeometry = new THREE.TorusGeometry(0.8, 0.06, 10, 36);

  const chargeCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xff2f20,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const chargeRingRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3525,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const chargeRingBlackMaterial = new THREE.MeshBasicMaterial({
    color: 0x110607,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });

  const laserCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3a2a,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const laserAuraMaterial = new THREE.MeshBasicMaterial({
    color: 0x160708,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const laserShellMaterial = new THREE.MeshBasicMaterial({
    color: 0xbf1a16,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    wireframe: true,
  });
  const laserOriginMaterial = new THREE.MeshBasicMaterial({
    color: 0x130607,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const laserTipMaterial = new THREE.MeshBasicMaterial({
    color: 0xff412d,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const laserSpinRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3b29,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const laserSpinBlackMaterial = new THREE.MeshBasicMaterial({
    color: 0x120607,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });

  const chargeCoreMesh = new THREE.Mesh(chargeCoreGeometry, chargeCoreMaterial);
  const chargeRingRedMesh = new THREE.Mesh(chargeRingGeometry, chargeRingRedMaterial);
  const chargeRingBlackMesh = new THREE.Mesh(chargeRingGeometry, chargeRingBlackMaterial);
  chargeRingRedMesh.rotation.x = Math.PI * 0.5;
  chargeRingBlackMesh.rotation.y = Math.PI * 0.5;
  const chargeGroup = new THREE.Group();
  chargeGroup.visible = false;
  chargeGroup.add(chargeRingBlackMesh, chargeRingRedMesh, chargeCoreMesh);
  scene.add(chargeGroup);

  const laserCoreMesh = new THREE.Mesh(laserCoreGeometry, laserCoreMaterial);
  const laserAuraMesh = new THREE.Mesh(laserAuraGeometry, laserAuraMaterial);
  const laserShellMesh = new THREE.Mesh(laserShellGeometry, laserShellMaterial);
  const laserOriginOrbMesh = new THREE.Mesh(laserOrbGeometry, laserOriginMaterial);
  const laserTipOrbMesh = new THREE.Mesh(laserOrbGeometry, laserTipMaterial);
  const laserSpinRedMesh = new THREE.Mesh(laserRingGeometry, laserSpinRedMaterial);
  const laserSpinBlackMesh = new THREE.Mesh(laserRingGeometry, laserSpinBlackMaterial);
  laserSpinRedMesh.rotation.x = Math.PI * 0.5;
  laserSpinBlackMesh.rotation.y = Math.PI * 0.5;
  const laserGroup = new THREE.Group();
  laserGroup.visible = false;
  laserGroup.add(
    laserShellMesh,
    laserAuraMesh,
    laserCoreMesh,
    laserOriginOrbMesh,
    laserSpinBlackMesh,
    laserSpinRedMesh,
    laserTipOrbMesh
  );
  scene.add(laserGroup);

  const particles: ChargeParticle[] = [];
  const bodyMaterialStates: BodyMaterialState[] = [];

  let phase: "idle" | "before" | "during" | "after" = "idle";
  let beforeStartedAt = 0;
  let beforeEndsAt = 0;
  let duringStartedAt = 0;
  let laserWarmupEndsAt = 0;
  let laserActiveStartedAt = 0;
  let laserActive = false;
  let duringEndsAt = 0;
  let afterEndsAt = 0;
  let nextDamageTickAt = 0;
  let chargeSpawnCarryMs = 0;
  let bodyMaskApplied = false;
  const lastLaserOrigin = new THREE.Vector3();
  const lastLaserDirection = new THREE.Vector3(0, 1, 0);
  let lastLaserLength = MADA_SKILL4_LASER_MIN_LENGTH;

  const resetLaserKinematics = (rig: THREE.Object3D) => {
    lastLaserOrigin.copy(resolveReferencePosition(rig));
    lastLaserDirection
      .set(Math.sin(rig.rotation.y), 0.02, Math.cos(rig.rotation.y))
      .normalize();
    // Start almost at the emitter, then extend outward during during-phase.
    lastLaserLength = 0.06;
  };

  const removeParticleAt = (index: number) => {
    const particle = particles[index];
    if (!particle) return;
    particle.mesh.removeFromParent();
    particle.material.dispose();
    particles.splice(index, 1);
  };

  const clearChargeParticles = () => {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      removeParticleAt(i);
    }
  };

  const hideChargeVisuals = () => {
    chargeGroup.visible = false;
    chargeCoreMaterial.opacity = 0;
    chargeRingRedMaterial.opacity = 0;
    chargeRingBlackMaterial.opacity = 0;
  };

  const hideLaserVisuals = () => {
    laserGroup.visible = false;
  };

  const resolveReferencePosition = (rig: THREE.Object3D) => {
    if (animation.getGrabReferenceWorldPosition(referenceProbe)) {
      return referenceProbe;
    }
    rig.getWorldPosition(referenceProbe);
    referenceProbe.y += MADA_SKILL4_FALLBACK_REFERENCE_OFFSET_Y;
    return referenceProbe;
  };

  const rotateLaserDirectionTowards = (
    current: THREE.Vector3,
    target: THREE.Vector3,
    maxAngleDelta: number
  ) => {
    const clampedStep = Math.max(0, maxAngleDelta);
    if (clampedStep <= 0) return;
    const angle = current.angleTo(target);
    if (!Number.isFinite(angle) || angle <= clampedStep) {
      current.copy(target);
      return;
    }
    laserTurnAxis.copy(current).cross(target);
    if (laserTurnAxis.lengthSq() <= 0.0000001) {
      laserFallbackAxis.set(0, 1, 0);
      if (Math.abs(current.y) > 0.95) {
        laserFallbackAxis.set(1, 0, 0);
      }
      laserTurnAxis.copy(current).cross(laserFallbackAxis);
    }
    laserTurnAxis.normalize();
    current.applyAxisAngle(laserTurnAxis, clampedStep).normalize();
  };

  const captureBodyMaterials = (rig: THREE.Object3D) => {
    bodyMaterialStates.length = 0;
    const tracked = new Set<THREE.Material>();
    rig.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (/eye/i.test(mesh.name ?? "")) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (let i = 0; i < materials.length; i += 1) {
        const material = materials[i];
        if (!material || tracked.has(material)) continue;
        if (!isColorMaterial(material) && !isEmissiveMaterial(material)) continue;
        tracked.add(material);
        bodyMaterialStates.push({
          material,
          baseColor: isColorMaterial(material) ? material.color.clone() : undefined,
          baseEmissive: isEmissiveMaterial(material)
            ? material.emissive.clone()
            : undefined,
          baseEmissiveIntensity: isEmissiveMaterial(material)
            ? material.emissiveIntensity
            : undefined,
        });
      }
    });
    bodyMaskApplied = false;
  };

  const applyBodyBlackMask = (enabled: boolean) => {
    if (bodyMaskApplied === enabled) return;
    for (let i = 0; i < bodyMaterialStates.length; i += 1) {
      const entry = bodyMaterialStates[i];
      if (entry.baseColor && isColorMaterial(entry.material)) {
        if (enabled) {
          entry.material.color.setRGB(0, 0, 0);
        } else {
          entry.material.color.copy(entry.baseColor);
        }
      }
      if (entry.baseEmissive && isEmissiveMaterial(entry.material)) {
        if (enabled) {
          entry.material.emissive.setRGB(0, 0, 0);
          entry.material.emissiveIntensity = 0;
        } else {
          entry.material.emissive.copy(entry.baseEmissive);
          entry.material.emissiveIntensity = entry.baseEmissiveIntensity ?? 0;
        }
      }
    }
    bodyMaskApplied = enabled;
  };

  const spawnChargeParticles = (center: THREE.Vector3, count: number) => {
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff3626 : 0x130607,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: i % 2 === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(chargeParticleGeometry, material);
      randomOffset.set(randomSigned(), randomSigned(), randomSigned());
      if (randomOffset.lengthSq() <= 0.0001) {
        randomOffset.set(0.72, 0.45, -0.56);
      }
      randomOffset.normalize();
      const radius = 1.05 + Math.random() * 2.7;
      mesh.position.copy(center).addScaledVector(randomOffset, radius);
      const startScale = 0.32 + Math.random() * 0.86;
      mesh.scale.setScalar(startScale);
      scene.add(mesh);

      tangentVector.set(-randomOffset.z, 0, randomOffset.x);
      if (tangentVector.lengthSq() > 0.0001) {
        tangentVector.normalize();
      }
      particleVelocity
        .copy(randomOffset)
        .multiplyScalar(-(5 + Math.random() * 7.8))
        .addScaledVector(
          tangentVector,
          (2.1 + Math.random() * 3.2) * (Math.random() < 0.5 ? -1 : 1)
        );
      particleVelocity.y += randomSigned() * 1.6;

      particles.push({
        mesh,
        material,
        velocity: particleVelocity.clone(),
        age: 0,
        life: 0.35 + Math.random() * 0.42,
        startScale,
        endScale: 0.02 + Math.random() * 0.07,
      });
    }
  };

  const updateChargeParticles = (delta: number, center: THREE.Vector3) => {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.age += delta;
      if (particle.age >= particle.life) {
        removeParticleAt(i);
        continue;
      }

      particleToCenter.copy(center).sub(particle.mesh.position);
      const centerDistance = particleToCenter.length();
      if (centerDistance > 0.0001) {
        particleToCenter.multiplyScalar(1 / centerDistance);
        particle.velocity.addScaledVector(
          particleToCenter,
          Math.max(0, delta) * (14 + centerDistance * 10)
        );
      }
      particle.velocity.multiplyScalar(Math.max(0, 1 - 2.2 * Math.max(0, delta)));
      particle.mesh.position.addScaledVector(particle.velocity, Math.max(0, delta));

      const t = particle.age / particle.life;
      const fade = 1 - t;
      const scale = THREE.MathUtils.lerp(particle.startScale, particle.endScale, t);
      particle.mesh.scale.setScalar(Math.max(0.01, scale));
      particle.material.opacity = Math.max(0.01, fade * fade * 0.96);

      if (centerDistance <= 0.07) {
        removeParticleAt(i);
      }
    }
  };

  const updateBeforeVisuals = (now: number, delta: number, rig: THREE.Object3D) => {
    const center = resolveReferencePosition(rig);

    const flashPhase =
      Math.floor((now - beforeStartedAt) / MADA_SKILL4_BEFORE_FLASH_INTERVAL_MS) % 2 ===
      0;
    applyBodyBlackMask(flashPhase);

    chargeSpawnCarryMs += Math.max(0, delta) * 1000;
    while (chargeSpawnCarryMs >= MADA_SKILL4_CHARGE_SPAWN_INTERVAL_MS) {
      chargeSpawnCarryMs -= MADA_SKILL4_CHARGE_SPAWN_INTERVAL_MS;
      spawnChargeParticles(center, MADA_SKILL4_CHARGE_PARTICLES_PER_BURST);
    }
    updateChargeParticles(Math.max(0, delta), center);

    chargeGroup.visible = true;
    chargeGroup.position.copy(center);
    const pulse = 1 + Math.sin(now * 0.023) * 0.22;
    const pulseAlt = 1 + Math.cos(now * 0.019 + 0.8) * 0.18;
    chargeCoreMesh.scale.setScalar(0.86 * pulse);
    chargeRingRedMesh.scale.setScalar(1.78 * pulseAlt);
    chargeRingBlackMesh.scale.setScalar(1.44 * pulse);
    chargeRingRedMesh.rotation.z += Math.max(0, delta) * 4.1;
    chargeRingBlackMesh.rotation.x -= Math.max(0, delta) * 5;

    const darkPhase = Math.floor((now - beforeStartedAt) / 90) % 2 === 1;
    if (darkPhase) {
      chargeCoreMaterial.color.setHex(0x130607);
      chargeCoreMaterial.opacity = 0.54;
      chargeRingRedMaterial.color.setHex(0xc11a14);
      chargeRingRedMaterial.opacity = 0.38;
      chargeRingBlackMaterial.color.setHex(0x030202);
      chargeRingBlackMaterial.opacity = 0.88;
    } else {
      chargeCoreMaterial.color.setHex(0xff3222);
      chargeCoreMaterial.opacity = 0.82;
      chargeRingRedMaterial.color.setHex(0xff402d);
      chargeRingRedMaterial.opacity = 0.9;
      chargeRingBlackMaterial.color.setHex(0x220d0f);
      chargeRingBlackMaterial.opacity = 0.42;
    }
  };

  const updateDuringWarmupVisuals = (
    now: number,
    delta: number,
    rig: THREE.Object3D
  ) => {
    const center = resolveReferencePosition(rig);
    chargeSpawnCarryMs += Math.max(0, delta) * 1000;
    while (chargeSpawnCarryMs >= MADA_SKILL4_CHARGE_SPAWN_INTERVAL_MS) {
      chargeSpawnCarryMs -= MADA_SKILL4_CHARGE_SPAWN_INTERVAL_MS;
      spawnChargeParticles(center, MADA_SKILL4_CHARGE_PARTICLES_PER_BURST + 2);
    }
    updateChargeParticles(Math.max(0, delta), center);

    chargeGroup.visible = true;
    chargeGroup.position.copy(center);
    const warmupProgress = clamp01(
      (now - duringStartedAt) / Math.max(1, MADA_SKILL4_DURING_WARMUP_MS)
    );
    const pulse = 1 + Math.sin(now * 0.028) * 0.25;
    const pulseAlt = 1 + Math.cos(now * 0.022 + 0.7) * 0.2;
    chargeCoreMesh.scale.setScalar((0.94 + warmupProgress * 0.4) * pulse);
    chargeRingRedMesh.scale.setScalar((1.85 - warmupProgress * 0.3) * pulseAlt);
    chargeRingBlackMesh.scale.setScalar((1.5 - warmupProgress * 0.22) * pulse);
    chargeRingRedMesh.rotation.z += Math.max(0, delta) * 5.2;
    chargeRingBlackMesh.rotation.x -= Math.max(0, delta) * 5.8;

    const darkPhase = Math.floor((now - duringStartedAt) / 80) % 2 === 1;
    if (darkPhase) {
      chargeCoreMaterial.color.setHex(0x120607);
      chargeCoreMaterial.opacity = 0.58 + warmupProgress * 0.16;
      chargeRingRedMaterial.color.setHex(0xc01913);
      chargeRingRedMaterial.opacity = 0.42 + warmupProgress * 0.14;
      chargeRingBlackMaterial.color.setHex(0x030202);
      chargeRingBlackMaterial.opacity = 0.9;
    } else {
      chargeCoreMaterial.color.setHex(0xff3624);
      chargeCoreMaterial.opacity = 0.84 + warmupProgress * 0.1;
      chargeRingRedMaterial.color.setHex(0xff422f);
      chargeRingRedMaterial.opacity = 0.92;
      chargeRingBlackMaterial.color.setHex(0x250e10);
      chargeRingBlackMaterial.opacity = 0.46;
    }
  };

  const updateLaserVisuals = (
    now: number,
    delta: number,
    rig: THREE.Object3D,
    player: THREE.Object3D
  ) => {
    const origin = resolveReferencePosition(rig);
    player.getWorldPosition(playerProbe);
    playerProbe.y += 1.15;
    desiredLaserDirection.copy(playerProbe).sub(origin);
    if (desiredLaserDirection.lengthSq() <= 0.0001) {
      desiredLaserDirection.set(Math.sin(rig.rotation.y), 0, Math.cos(rig.rotation.y));
    }
    const targetDistance = desiredLaserDirection.length();
    if (targetDistance <= 0.0001) {
      desiredLaserDirection.set(0, 0, 1);
    } else {
      desiredLaserDirection.multiplyScalar(1 / targetDistance);
    }

    const turnStep = MADA_SKILL4_LASER_TURN_SPEED_RAD_PER_S * Math.max(0, delta);
    rotateLaserDirectionTowards(lastLaserDirection, desiredLaserDirection, turnStep);

    const desiredBeamLength = THREE.MathUtils.clamp(
      (targetDistance + 2) * MADA_SKILL4_LASER_LENGTH_MULTIPLIER,
      MADA_SKILL4_LASER_MIN_LENGTH,
      MADA_SKILL4_LASER_MAX_LENGTH
    );
    const growStep = MADA_SKILL4_LASER_GROW_SPEED_PER_S * Math.max(0, delta);
    if (lastLaserLength < desiredBeamLength) {
      lastLaserLength = Math.min(desiredBeamLength, lastLaserLength + growStep);
    } else if (lastLaserLength > desiredBeamLength) {
      lastLaserLength = Math.max(desiredBeamLength, lastLaserLength - growStep * 0.9);
    }

    lastLaserOrigin.copy(origin);

    laserGroup.visible = true;
    laserGroup.position.copy(origin);
    laserGroup.quaternion.setFromUnitVectors(laserUpAxis, lastLaserDirection);
    const beamLength = lastLaserLength;
    laserCoreMesh.position.y = beamLength * 0.5;
    laserAuraMesh.position.y = beamLength * 0.5;
    laserShellMesh.position.y = beamLength * 0.5;
    laserCoreMesh.scale.set(1, beamLength, 1);
    laserAuraMesh.scale.set(1, beamLength, 1);
    laserShellMesh.scale.set(1, beamLength, 1);
    laserOriginOrbMesh.position.y = 0;
    laserTipOrbMesh.position.y = beamLength;
    laserTipOrbMesh.scale.setScalar(1 + Math.sin(now * 0.04) * 0.16);
    laserSpinRedMesh.position.y = beamLength * 0.12;
    laserSpinBlackMesh.position.y = beamLength * 0.16;
    laserSpinRedMesh.rotation.z += Math.max(0, delta) * 6;
    laserSpinBlackMesh.rotation.x -= Math.max(0, delta) * 5.3;

    const laserPhaseStartedAt =
      laserActiveStartedAt > 0 ? laserActiveStartedAt : duringStartedAt;
    const darkPhase = Math.floor((now - laserPhaseStartedAt) / 100) % 2 === 1;
    if (darkPhase) {
      laserCoreMaterial.color.setHex(0xb71913);
      laserCoreMaterial.opacity = 0.58;
      laserAuraMaterial.color.setHex(0x040203);
      laserAuraMaterial.opacity = 0.82;
      laserShellMaterial.color.setHex(0x6d0f10);
      laserShellMaterial.opacity = 0.38;
      laserTipMaterial.color.setHex(0x170709);
      laserTipMaterial.opacity = 0.7;
      laserSpinRedMaterial.opacity = 0.46;
      laserSpinBlackMaterial.opacity = 0.9;
    } else {
      laserCoreMaterial.color.setHex(0xff4a34);
      laserCoreMaterial.opacity = 0.96;
      laserAuraMaterial.color.setHex(0x250e10);
      laserAuraMaterial.opacity = 0.48;
      laserShellMaterial.color.setHex(0xda221b);
      laserShellMaterial.opacity = 0.52;
      laserTipMaterial.color.setHex(0xff4b36);
      laserTipMaterial.opacity = 0.94;
      laserSpinRedMaterial.opacity = 0.82;
      laserSpinBlackMaterial.opacity = 0.42;
    }
  };

  const canLaserHitPlayer = (player: THREE.Object3D) => {
    player.getWorldPosition(playerProbe);
    playerProbe.y += 1.2;
    laserToPlayer.copy(playerProbe).sub(lastLaserOrigin);
    const projection = laserToPlayer.dot(lastLaserDirection);
    if (projection < 0 || projection > lastLaserLength) {
      return false;
    }
    const perpSq = laserToPlayer.lengthSq() - projection * projection;
    const hitRadius = MADA_SKILL4_LASER_HIT_RADIUS + MADA_SKILL4_PLAYER_RADIUS;
    return perpSq <= hitRadius * hitRadius;
  };

  const switchToDuring = (now: number) => {
    animation.triggerSkill4During();
    phase = "during";
    duringStartedAt = now;
    laserWarmupEndsAt = now + MADA_SKILL4_DURING_WARMUP_MS;
    laserActiveStartedAt = 0;
    laserActive = false;
    duringEndsAt = laserWarmupEndsAt + MADA_SKILL4_DURING_DURATION_MS;
    nextDamageTickAt = 0;
    chargeSpawnCarryMs = 0;
    applyBodyBlackMask(false);
    hideLaserVisuals();
    clearChargeParticles();
  };

  const switchToAfter = (now: number) => {
    const afterDurationS = animation.triggerSkill4After();
    phase = "after";
    afterEndsAt =
      now +
      Math.max(
        MADA_SKILL4_AFTER_FALLBACK_MS,
        afterDurationS * 1000 + MADA_SKILL4_AFTER_FINISH_GRACE_MS
      );
    applyBodyBlackMask(false);
    hideChargeVisuals();
    hideLaserVisuals();
    clearChargeParticles();
  };

  const finishCast = () => {
    phase = "idle";
    beforeStartedAt = 0;
    beforeEndsAt = 0;
    duringStartedAt = 0;
    laserWarmupEndsAt = 0;
    laserActiveStartedAt = 0;
    laserActive = false;
    duringEndsAt = 0;
    afterEndsAt = 0;
    nextDamageTickAt = 0;
    chargeSpawnCarryMs = 0;
    applyBodyBlackMask(false);
    hideChargeVisuals();
    hideLaserVisuals();
    clearChargeParticles();
  };

  return {
    beginCast: (now: number, rig: THREE.Object3D) => {
      captureBodyMaterials(rig);
      applyBodyBlackMask(false);
      hideChargeVisuals();
      hideLaserVisuals();
      clearChargeParticles();
      chargeSpawnCarryMs = 0;

      const beforeDurationS = animation.triggerSkill4Before();
      if (beforeDurationS > 0) {
        phase = "before";
        beforeStartedAt = now;
        beforeEndsAt =
          now + Math.max(MADA_SKILL4_BEFORE_FALLBACK_MS, beforeDurationS * 1000);
        return true;
      }

      const duringDurationS = animation.triggerSkill4During();
      if (duringDurationS <= 0) {
        finishCast();
        return false;
      }
      phase = "during";
      duringStartedAt = now;
      laserWarmupEndsAt = now + MADA_SKILL4_DURING_WARMUP_MS;
      laserActiveStartedAt = 0;
      laserActive = false;
      duringEndsAt = laserWarmupEndsAt + MADA_SKILL4_DURING_DURATION_MS;
      nextDamageTickAt = 0;
      chargeSpawnCarryMs = 0;
      hideLaserVisuals();
      return true;
    },
    isCasting: () => phase !== "idle",
    tick: ({ now, delta, rig, player, applyDamage }: TickArgs) => {
      if (phase === "idle") return;

      if (phase === "before" && now >= beforeEndsAt) {
        switchToDuring(now);
      }
      if (phase === "during" && now >= duringEndsAt) {
        switchToAfter(now);
      }
      if (phase === "after" && now >= afterEndsAt && !animation.isSkill4AfterPlaying()) {
        finishCast();
        return;
      }

      if (phase === "before") {
        updateBeforeVisuals(now, delta, rig);
        hideLaserVisuals();
        return;
      }

      applyBodyBlackMask(false);
      hideChargeVisuals();

      if (phase === "during") {
        if (!laserActive) {
          if (now >= laserWarmupEndsAt) {
            laserActive = true;
            laserActiveStartedAt = now;
            nextDamageTickAt = now + MADA_SKILL4_LASER_DAMAGE_INTERVAL_MS;
            resetLaserKinematics(rig);
            hideChargeVisuals();
            clearChargeParticles();
          } else {
            hideLaserVisuals();
            updateDuringWarmupVisuals(now, delta, rig);
            return;
          }
        }

        hideChargeVisuals();
        updateLaserVisuals(now, delta, rig, player);
        while (now >= nextDamageTickAt && nextDamageTickAt < duringEndsAt) {
          if (canLaserHitPlayer(player)) {
            applyDamage(MADA_SKILL4_LASER_DAMAGE);
          }
          nextDamageTickAt += MADA_SKILL4_LASER_DAMAGE_INTERVAL_MS;
        }
      } else {
        hideLaserVisuals();
      }
    },
    reset: () => {
      finishCast();
    },
    dispose: () => {
      finishCast();
      chargeGroup.removeFromParent();
      laserGroup.removeFromParent();
      chargeParticleGeometry.dispose();
      chargeCoreGeometry.dispose();
      chargeRingGeometry.dispose();
      laserCoreGeometry.dispose();
      laserAuraGeometry.dispose();
      laserShellGeometry.dispose();
      laserOrbGeometry.dispose();
      laserRingGeometry.dispose();
      chargeCoreMaterial.dispose();
      chargeRingRedMaterial.dispose();
      chargeRingBlackMaterial.dispose();
      laserCoreMaterial.dispose();
      laserAuraMaterial.dispose();
      laserShellMaterial.dispose();
      laserOriginMaterial.dispose();
      laserTipMaterial.dispose();
      laserSpinRedMaterial.dispose();
      laserSpinBlackMaterial.dispose();
    },
  };
};
