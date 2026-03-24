import * as THREE from "three";
import type { PlayerWorldTickArgs } from "../../character/general/player";

const MADA_SKILL3_SHOT_COUNT = 5;
const MADA_SKILL3_SHOT_INTERVAL_MS = 800;
const MADA_SKILL3_BEFORE_FALLBACK_MS = 560;
const MADA_SKILL3_AFTER_FALLBACK_MS = 920;
const MADA_SKILL3_AFTER_FINISH_GRACE_MS = 120;
const MADA_SKILL3_AFTER_BODY_SPEED_THRESHOLD = 1.35;
const MADA_SKILL3_AFTER_BODY_MOTION_WINDOW_MS = 180;
const MADA_SKILL3_AFTER_BODY_MOTION_DECAY_PER_S = 1.8;
const MADA_SKILL3_AFTER_CHARGE_DURATION_MS = 420;
const MADA_SKILL3_AFTER_FORCE_TRIGGER_LEAD_MS = 560;
const MADA_SKILL3_AFTER_FORCE_FIRE_LEAD_MS = 90;
const MADA_SKILL3_AFTER_FINISHER_SPEED_MULTIPLIER = 2;
const MADA_SKILL3_PROJECTILE_DAMAGE = 10;
const MADA_SKILL3_PROJECTILE_SPEED = 14.8;
const MADA_SKILL3_PROJECTILE_MAX_LIFE_S = 12.5;
const MADA_SKILL3_PROJECTILE_RADIUS = 3.52 * 0.7; // 70% of previous size
const MADA_SKILL3_PLAYER_RADIUS = 0.72;
const MADA_SKILL3_TARGET_HIT_RADIUS_MAX = 2.6;
const MADA_SKILL3_FLASH_INTERVAL_S = 0.12;
const MADA_SKILL3_DESPAWN_DURATION_S = 0.3;
const MADA_SKILL3_DESPAWN_PARTICLE_INTERVAL_S = 0.045;
const MADA_SKILL3_EDGE_MARGIN = 0.1;
const MADA_SKILL3_REFERENCE_HEAD_TOP_OFFSET_Y = 0.42;

type MadaBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type MadaSkill3AnimationBridge = {
  triggerSkill3Before: () => number;
  triggerSkill3During: () => number;
  triggerSkill3After: () => number;
  isSkill3AfterPlaying: () => boolean;
  getGrabReferenceWorldPosition: (target: THREE.Vector3) => boolean;
  getBodyWorldPosition: (target: THREE.Vector3) => boolean;
};

type TickArgs = {
  now: number;
  delta: number;
  rig: THREE.Object3D;
  player: PlayerWorldTickArgs["player"];
  applyDamage: PlayerWorldTickArgs["applyDamage"];
};

type Skill3ProjectilePhase = "active" | "fading";

type Skill3Projectile = {
  group: THREE.Group;
  core: THREE.Mesh;
  coreMaterial: THREE.MeshStandardMaterial;
  auraMaterial: THREE.MeshBasicMaterial;
  ringOuterMaterial: THREE.MeshBasicMaterial;
  ringInnerMaterial: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  speed: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  flashElapsed: number;
  redPhase: boolean;
  phase: Skill3ProjectilePhase;
  fadeElapsed: number;
  particleCarry: number;
};

type SpawnProjectileOptions = {
  speedMultiplier?: number;
};

type DespawnParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const randomSigned = () => Math.random() * 2 - 1;

const referenceProbe = new THREE.Vector3();
const fallbackOrigin = new THREE.Vector3();
const bodyProbe = new THREE.Vector3();
const afterBodyPrevProbe = new THREE.Vector3();
const playerProbe = new THREE.Vector3();
const projectileDirection = new THREE.Vector3();
const edgeCheckPosition = new THREE.Vector3();
const despawnOffset = new THREE.Vector3();
const despawnVelocity = new THREE.Vector3();
const targetBounds = new THREE.Box3();
const targetSphere = new THREE.Sphere();
const stepStartPosition = new THREE.Vector3();
const segmentDelta = new THREE.Vector3();
const segmentToTarget = new THREE.Vector3();
const segmentClosestPoint = new THREE.Vector3();

export const createMadaSkill3Runtime = ({
  scene,
  animation,
  bounds,
}: {
  scene: THREE.Scene;
  animation: MadaSkill3AnimationBridge;
  bounds: MadaBounds;
}) => {
  const projectileGeometry = new THREE.SphereGeometry(0.92, 20, 16);
  const auraGeometry = new THREE.IcosahedronGeometry(1.3, 1);
  const ringGeometry = new THREE.TorusGeometry(1.22, 0.08, 12, 34);
  const particleGeometry = new THREE.SphereGeometry(0.08, 7, 6);
  const chargeCoreGeometry = new THREE.SphereGeometry(0.44, 16, 12);
  const chargeRingGeometry = new THREE.TorusGeometry(1.06, 0.075, 12, 40);

  const chargeCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3020,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const chargeRingRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3727,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const chargeRingBlackMaterial = new THREE.MeshBasicMaterial({
    color: 0x120708,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });

  const chargeCoreMesh = new THREE.Mesh(chargeCoreGeometry, chargeCoreMaterial);
  const chargeRingRedMesh = new THREE.Mesh(chargeRingGeometry, chargeRingRedMaterial);
  const chargeRingBlackMesh = new THREE.Mesh(
    chargeRingGeometry,
    chargeRingBlackMaterial
  );
  chargeRingRedMesh.rotation.x = Math.PI * 0.5;
  chargeRingBlackMesh.rotation.y = Math.PI * 0.5;

  const chargeGroup = new THREE.Group();
  chargeGroup.visible = false;
  chargeGroup.add(chargeRingBlackMesh, chargeRingRedMesh, chargeCoreMesh);
  scene.add(chargeGroup);

  const particles: DespawnParticle[] = [];
  const projectiles: Skill3Projectile[] = [];

  let phase: "idle" | "before" | "during" | "after" = "idle";
  let beforeEndsAt = 0;
  let duringStartedAt = 0;
  let nextShotAt = 0;
  let shotsFired = 0;
  let afterEndsAt = 0;
  let afterBodyProbeReady = false;
  let afterBodyStrongMotionMs = 0;
  let afterChargeStartedAt = 0;
  let afterChargeEndsAt = 0;
  let afterFinisherState: "idle" | "charging" | "fired" = "idle";

  const removeParticleAt = (index: number) => {
    const entry = particles[index];
    if (!entry) return;
    entry.mesh.removeFromParent();
    entry.material.dispose();
    particles.splice(index, 1);
  };

  const clearParticles = () => {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      removeParticleAt(i);
    }
  };

  const isOutOfBounds = (position: THREE.Vector3) =>
    position.x <= bounds.minX + MADA_SKILL3_EDGE_MARGIN ||
    position.x >= bounds.maxX - MADA_SKILL3_EDGE_MARGIN ||
    position.z <= bounds.minZ + MADA_SKILL3_EDGE_MARGIN ||
    position.z >= bounds.maxZ - MADA_SKILL3_EDGE_MARGIN;

  const applyFlashPhase = (projectile: Skill3Projectile, redPhase: boolean) => {
    projectile.redPhase = redPhase;
    if (redPhase) {
      projectile.coreMaterial.color.setHex(0xff3221);
      projectile.coreMaterial.emissive.setHex(0xb5150f);
      projectile.coreMaterial.emissiveIntensity = 2.2;
      projectile.coreMaterial.opacity = 0.94;
      projectile.auraMaterial.color.setHex(0xff3f2a);
      projectile.auraMaterial.opacity = 0.56;
      projectile.ringOuterMaterial.color.setHex(0xff3a27);
      projectile.ringInnerMaterial.color.setHex(0xc71d16);
      projectile.ringOuterMaterial.opacity = 0.82;
      projectile.ringInnerMaterial.opacity = 0.64;
    } else {
      projectile.coreMaterial.color.setHex(0x100607);
      projectile.coreMaterial.emissive.setHex(0x2b0808);
      projectile.coreMaterial.emissiveIntensity = 0.24;
      projectile.coreMaterial.opacity = 0.86;
      projectile.auraMaterial.color.setHex(0x120708);
      projectile.auraMaterial.opacity = 0.22;
      projectile.ringOuterMaterial.color.setHex(0x190809);
      projectile.ringInnerMaterial.color.setHex(0x2a0d0f);
      projectile.ringOuterMaterial.opacity = 0.5;
      projectile.ringInnerMaterial.opacity = 0.42;
    }
  };

  const spawnDespawnParticles = (
    position: THREE.Vector3,
    radius: number,
    count: number
  ) => {
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff3423 : 0x130607,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(particleGeometry, material);
      despawnOffset.set(randomSigned(), randomSigned(), randomSigned());
      if (despawnOffset.lengthSq() <= 0.0001) {
        despawnOffset.set(0.7, 0.4, -0.52);
      }
      despawnOffset.normalize().multiplyScalar(radius * (0.08 + Math.random() * 0.2));
      mesh.position.copy(position).add(despawnOffset);
      const startScale = 0.5 + Math.random() * 1.2;
      mesh.scale.setScalar(startScale);
      scene.add(mesh);

      despawnVelocity
        .copy(despawnOffset)
        .normalize()
        .multiplyScalar(4.8 + Math.random() * 10.5);
      despawnVelocity.y += 1.2 + Math.random() * 3.6;
      particles.push({
        mesh,
        material,
        velocity: despawnVelocity.clone(),
        age: 0,
        life: 0.15 + Math.random() * 0.22,
        startScale,
        endScale: 0.02 + Math.random() * 0.06,
      });
    }
  };

  const beginProjectileFade = (projectile: Skill3Projectile) => {
    if (projectile.phase === "fading") return;
    projectile.phase = "fading";
    projectile.fadeElapsed = 0;
    projectile.particleCarry = 0;
    spawnDespawnParticles(projectile.group.position, projectile.radius, 22);
  };

  const removeProjectileAt = (index: number) => {
    const projectile = projectiles[index];
    if (!projectile) return;
    projectile.group.removeFromParent();
    projectile.coreMaterial.dispose();
    projectile.auraMaterial.dispose();
    projectile.ringOuterMaterial.dispose();
    projectile.ringInnerMaterial.dispose();
    projectiles.splice(index, 1);
  };

  const clearProjectiles = () => {
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      removeProjectileAt(i);
    }
  };

  const hideChargeVfx = () => {
    chargeGroup.visible = false;
    chargeCoreMaterial.opacity = 0;
    chargeRingRedMaterial.opacity = 0;
    chargeRingBlackMaterial.opacity = 0;
  };

  const resetAfterFinisherState = () => {
    afterBodyProbeReady = false;
    afterBodyStrongMotionMs = 0;
    afterChargeStartedAt = 0;
    afterChargeEndsAt = 0;
    afterFinisherState = "idle";
    hideChargeVfx();
  };

  const updateAfterBodyMotion = (delta: number, rig: THREE.Object3D) => {
    if (!animation.getBodyWorldPosition(bodyProbe)) {
      rig.getWorldPosition(bodyProbe);
      bodyProbe.y += 1.55;
    }
    if (!afterBodyProbeReady) {
      afterBodyPrevProbe.copy(bodyProbe);
      afterBodyProbeReady = true;
      return;
    }
    const dt = Math.max(1 / 240, Math.max(0, delta));
    const speed = bodyProbe.distanceTo(afterBodyPrevProbe) / dt;
    afterBodyPrevProbe.copy(bodyProbe);

    if (speed >= MADA_SKILL3_AFTER_BODY_SPEED_THRESHOLD) {
      afterBodyStrongMotionMs += dt * 1000;
    } else {
      afterBodyStrongMotionMs = Math.max(
        0,
        afterBodyStrongMotionMs - dt * 1000 * MADA_SKILL3_AFTER_BODY_MOTION_DECAY_PER_S
      );
    }
  };

  const startAfterCharge = (now: number) => {
    if (afterFinisherState !== "idle") return;
    const remaining = Math.max(0, afterEndsAt - now);
    const maxAllowedDuration = Math.max(70, remaining - MADA_SKILL3_AFTER_FORCE_FIRE_LEAD_MS);
    const chargeDurationMs = Math.min(
      MADA_SKILL3_AFTER_CHARGE_DURATION_MS,
      maxAllowedDuration
    );
    afterFinisherState = "charging";
    afterChargeStartedAt = now;
    afterChargeEndsAt = now + chargeDurationMs;
    chargeGroup.visible = true;
  };

  const resolveSpawnOrigin = (rig: THREE.Object3D) => {
    if (animation.getGrabReferenceWorldPosition(referenceProbe)) {
      referenceProbe.y += MADA_SKILL3_REFERENCE_HEAD_TOP_OFFSET_Y;
      return referenceProbe;
    }
    rig.getWorldPosition(fallbackOrigin);
    fallbackOrigin.y += 2.15;
    return fallbackOrigin;
  };

  const spawnProjectile = (
    rig: THREE.Object3D,
    player: THREE.Object3D,
    options: SpawnProjectileOptions = {}
  ) => {
    const speedMultiplier = Math.max(0.1, options.speedMultiplier ?? 1);
    const projectileSpeed = MADA_SKILL3_PROJECTILE_SPEED * speedMultiplier;
    const origin = resolveSpawnOrigin(rig).clone();
    player.getWorldPosition(playerProbe);
    playerProbe.y += 1.15;
    projectileDirection.copy(playerProbe).sub(origin);
    if (projectileDirection.lengthSq() <= 0.00001) {
      projectileDirection
        .set(Math.sin(rig.rotation.y), 0.02, Math.cos(rig.rotation.y))
        .normalize();
    } else {
      projectileDirection.normalize();
    }

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3221,
      emissive: 0xb5150f,
      emissiveIntensity: 2.2,
      roughness: 0.22,
      metalness: 0.08,
      transparent: true,
      opacity: 0.94,
    });
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3f2a,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ringOuterMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3a27,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ringInnerMaterial = new THREE.MeshBasicMaterial({
      color: 0xc71d16,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const core = new THREE.Mesh(projectileGeometry, coreMaterial);
    const aura = new THREE.Mesh(auraGeometry, auraMaterial);
    const ringOuter = new THREE.Mesh(ringGeometry, ringOuterMaterial);
    const ringInner = new THREE.Mesh(ringGeometry, ringInnerMaterial);

    aura.scale.setScalar(1.18);
    ringOuter.scale.setScalar(1.1);
    ringInner.scale.setScalar(0.82);
    ringOuter.rotation.x = Math.PI * 0.5;
    ringInner.rotation.y = Math.PI * 0.5;

    const group = new THREE.Group();
    group.position.copy(origin);
    group.scale.setScalar(MADA_SKILL3_PROJECTILE_RADIUS);
    group.add(core, aura, ringOuter, ringInner);
    scene.add(group);

    const projectile: Skill3Projectile = {
      group,
      core,
      coreMaterial,
      auraMaterial,
      ringOuterMaterial,
      ringInnerMaterial,
      velocity: projectileDirection.clone().multiplyScalar(projectileSpeed),
      speed: projectileSpeed,
      radius: MADA_SKILL3_PROJECTILE_RADIUS,
      damage: MADA_SKILL3_PROJECTILE_DAMAGE,
      life: 0,
      maxLife: MADA_SKILL3_PROJECTILE_MAX_LIFE_S,
      flashElapsed: 0,
      redPhase: true,
      phase: "active",
      fadeElapsed: 0,
      particleCarry: 0,
    };
    applyFlashPhase(projectile, true);
    projectiles.push(projectile);
  };

  const resolveTargetHitProbe = (target: THREE.Object3D) => {
    target.getWorldPosition(playerProbe);
    targetBounds.setFromObject(target);
    if (targetBounds.isEmpty()) {
      playerProbe.y += 1.2;
      return MADA_SKILL3_PLAYER_RADIUS;
    }
    targetBounds.getBoundingSphere(targetSphere);
    playerProbe.copy(targetSphere.center);
    return Math.max(
      MADA_SKILL3_PLAYER_RADIUS,
      Math.min(MADA_SKILL3_TARGET_HIT_RADIUS_MAX, targetSphere.radius)
    );
  };

  const doesStepSegmentHitTarget = (
    stepStart: THREE.Vector3,
    stepEnd: THREE.Vector3,
    target: THREE.Vector3,
    hitDistance: number
  ) => {
    const hitDistanceSq = hitDistance * hitDistance;
    segmentDelta.copy(stepEnd).sub(stepStart);
    const segmentLenSq = segmentDelta.lengthSq();
    if (segmentLenSq <= 0.0000001) {
      return stepStart.distanceToSquared(target) <= hitDistanceSq;
    }
    const t = THREE.MathUtils.clamp(
      segmentToTarget.copy(target).sub(stepStart).dot(segmentDelta) /
        segmentLenSq,
      0,
      1
    );
    segmentClosestPoint.copy(stepStart).addScaledVector(segmentDelta, t);
    return segmentClosestPoint.distanceToSquared(target) <= hitDistanceSq;
  };

  const fireAfterFinisher = (rig: THREE.Object3D, player: THREE.Object3D) => {
    if (afterFinisherState === "fired") return;
    hideChargeVfx();
    spawnProjectile(rig, player, {
      speedMultiplier: MADA_SKILL3_AFTER_FINISHER_SPEED_MULTIPLIER,
    });
    afterFinisherState = "fired";
  };

  const updateAfterChargeVfx = (
    now: number,
    delta: number,
    rig: THREE.Object3D,
    player: THREE.Object3D
  ) => {
    if (afterFinisherState !== "charging") return;

    chargeGroup.position.copy(resolveSpawnOrigin(rig));
    chargeGroup.visible = true;
    const duration = Math.max(1, afterChargeEndsAt - afterChargeStartedAt);
    const progress = clamp01((now - afterChargeStartedAt) / duration);
    const pulse = 1 + Math.sin(now * 0.028) * 0.16;
    const pulseAlt = 1 + Math.cos(now * 0.023 + 0.7) * 0.2;

    chargeCoreMesh.scale.setScalar(0.52 + progress * 0.88 * pulse);
    chargeRingRedMesh.scale.setScalar((2.3 - progress * 1.5) * pulseAlt);
    chargeRingBlackMesh.scale.setScalar((2 - progress * 1.32) * pulse);
    chargeRingRedMesh.rotation.z += Math.max(0, delta) * 4.4;
    chargeRingBlackMesh.rotation.x -= Math.max(0, delta) * 5.1;

    const darkPhase = Math.floor((now - afterChargeStartedAt) / 100) % 2 === 1;
    if (darkPhase) {
      chargeCoreMaterial.color.setHex(0x140708);
      chargeCoreMaterial.opacity = 0.5 + progress * 0.3;
      chargeRingRedMaterial.color.setHex(0xb81814);
      chargeRingRedMaterial.opacity = 0.4 + progress * 0.3;
      chargeRingBlackMaterial.color.setHex(0x050203);
      chargeRingBlackMaterial.opacity = 0.86;
    } else {
      chargeCoreMaterial.color.setHex(0xff3120);
      chargeCoreMaterial.opacity = 0.68 + progress * 0.25;
      chargeRingRedMaterial.color.setHex(0xff3d2b);
      chargeRingRedMaterial.opacity = 0.88;
      chargeRingBlackMaterial.color.setHex(0x220d0f);
      chargeRingBlackMaterial.opacity = 0.38 + progress * 0.2;
    }

    if (now >= afterChargeEndsAt) {
      fireAfterFinisher(rig, player);
    }
  };

  const updateParticles = (delta: number) => {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.age += delta;
      if (particle.age >= particle.life) {
        removeParticleAt(i);
        continue;
      }
      const t = particle.age / particle.life;
      const inv = 1 - t;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      const scale = THREE.MathUtils.lerp(particle.startScale, particle.endScale, t);
      particle.mesh.scale.setScalar(Math.max(0.02, scale));
      particle.material.opacity = Math.max(0.01, inv * inv * 0.95);
    }
  };

  const switchToDuring = (now: number) => {
    animation.triggerSkill3During();
    phase = "during";
    duringStartedAt = now;
    shotsFired = 0;
    nextShotAt = now;
  };

  const switchToAfter = (now: number) => {
    const afterDurationS = animation.triggerSkill3After();
    phase = "after";
    resetAfterFinisherState();
    afterEndsAt =
      now +
      Math.max(
        MADA_SKILL3_AFTER_FALLBACK_MS,
        afterDurationS * 1000 + MADA_SKILL3_AFTER_FINISH_GRACE_MS
      );
  };

  const finishCast = () => {
    hideChargeVfx();
    phase = "idle";
    beforeEndsAt = 0;
    duringStartedAt = 0;
    nextShotAt = 0;
    shotsFired = 0;
    afterEndsAt = 0;
    afterBodyProbeReady = false;
    afterBodyStrongMotionMs = 0;
    afterChargeStartedAt = 0;
    afterChargeEndsAt = 0;
    afterFinisherState = "idle";
  };

  return {
    beginCast: (now: number) => {
      clearProjectiles();
      clearParticles();
      resetAfterFinisherState();
      const beforeDurationS = animation.triggerSkill3Before();
      if (beforeDurationS > 0) {
        phase = "before";
        beforeEndsAt =
          now + Math.max(MADA_SKILL3_BEFORE_FALLBACK_MS, beforeDurationS * 1000);
        shotsFired = 0;
        nextShotAt = 0;
        return true;
      }
      const duringDurationS = animation.triggerSkill3During();
      if (duringDurationS <= 0) {
        finishCast();
        return false;
      }
      phase = "during";
      duringStartedAt = now;
      shotsFired = 0;
      nextShotAt = now;
      return true;
    },
    isCasting: () => phase !== "idle",
    tick: ({ now, delta, rig, player, applyDamage }: TickArgs) => {
      if (phase === "before" && now >= beforeEndsAt) {
        switchToDuring(now);
      }

      if (phase === "during") {
        while (shotsFired < MADA_SKILL3_SHOT_COUNT && now >= nextShotAt) {
          spawnProjectile(rig, player);
          shotsFired += 1;
          nextShotAt += MADA_SKILL3_SHOT_INTERVAL_MS;
        }
      }

      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        const projectile = projectiles[i];
        if (projectile.phase === "active") {
          projectile.life += Math.max(0, delta);
          projectile.flashElapsed += Math.max(0, delta);
          while (projectile.flashElapsed >= MADA_SKILL3_FLASH_INTERVAL_S) {
            projectile.flashElapsed -= MADA_SKILL3_FLASH_INTERVAL_S;
            applyFlashPhase(projectile, !projectile.redPhase);
          }

          stepStartPosition.copy(projectile.group.position);
          edgeCheckPosition
            .copy(stepStartPosition)
            .addScaledVector(projectile.velocity, Math.max(0, delta));
          const targetHitRadius = resolveTargetHitProbe(player);
          const hitDistance = projectile.radius + targetHitRadius;
          const stepHit = doesStepSegmentHitTarget(
            stepStartPosition,
            edgeCheckPosition,
            playerProbe,
            hitDistance
          );
          if (stepHit) {
            projectile.group.position.copy(edgeCheckPosition);
            applyDamage(projectile.damage);
            beginProjectileFade(projectile);
          } else if (isOutOfBounds(edgeCheckPosition)) {
            beginProjectileFade(projectile);
          } else {
            projectile.group.position.copy(edgeCheckPosition);
            if (projectile.life >= projectile.maxLife) {
              beginProjectileFade(projectile);
            }
          }

          projectile.group.rotation.y += Math.max(0, delta) * 1.25;
          if (projectile.group.children[2]) {
            projectile.group.children[2].rotation.z += Math.max(0, delta) * 4.6;
          }
          if (projectile.group.children[3]) {
            projectile.group.children[3].rotation.x -= Math.max(0, delta) * 5.2;
          }
          continue;
        }

        projectile.fadeElapsed += Math.max(0, delta);
        projectile.particleCarry += Math.max(0, delta);
        while (
          projectile.particleCarry >= MADA_SKILL3_DESPAWN_PARTICLE_INTERVAL_S &&
          projectile.fadeElapsed < MADA_SKILL3_DESPAWN_DURATION_S
        ) {
          projectile.particleCarry -= MADA_SKILL3_DESPAWN_PARTICLE_INTERVAL_S;
          spawnDespawnParticles(projectile.group.position, projectile.radius, 4);
        }
        const fade = 1 - clamp01(projectile.fadeElapsed / MADA_SKILL3_DESPAWN_DURATION_S);
        projectile.coreMaterial.opacity = 0.9 * fade;
        projectile.auraMaterial.opacity = 0.58 * fade;
        projectile.ringOuterMaterial.opacity = 0.74 * fade;
        projectile.ringInnerMaterial.opacity = 0.62 * fade;
        projectile.group.scale.setScalar(
          MADA_SKILL3_PROJECTILE_RADIUS * (0.92 + 0.18 * fade)
        );
        if (projectile.fadeElapsed >= MADA_SKILL3_DESPAWN_DURATION_S) {
          removeProjectileAt(i);
        }
      }

      updateParticles(Math.max(0, delta));

      if (
        phase === "during" &&
        shotsFired >= MADA_SKILL3_SHOT_COUNT &&
        projectiles.length === 0
      ) {
        switchToAfter(now);
      }

      if (phase === "after") {
        updateAfterBodyMotion(Math.max(0, delta), rig);

        if (
          afterFinisherState === "idle" &&
          (afterBodyStrongMotionMs >= MADA_SKILL3_AFTER_BODY_MOTION_WINDOW_MS ||
            now >= afterEndsAt - MADA_SKILL3_AFTER_FORCE_TRIGGER_LEAD_MS)
        ) {
          startAfterCharge(now);
        }

        updateAfterChargeVfx(now, Math.max(0, delta), rig, player);

        if (
          afterFinisherState !== "fired" &&
          now >= afterEndsAt - MADA_SKILL3_AFTER_FORCE_FIRE_LEAD_MS
        ) {
          fireAfterFinisher(rig, player);
        }
      }

      if (phase === "after" && now >= afterEndsAt && !animation.isSkill3AfterPlaying()) {
        finishCast();
      }
    },
    reset: () => {
      clearProjectiles();
      clearParticles();
      finishCast();
    },
    dispose: () => {
      clearProjectiles();
      clearParticles();
      hideChargeVfx();
      chargeGroup.removeFromParent();
      projectileGeometry.dispose();
      auraGeometry.dispose();
      ringGeometry.dispose();
      particleGeometry.dispose();
      chargeCoreGeometry.dispose();
      chargeRingGeometry.dispose();
      chargeCoreMaterial.dispose();
      chargeRingRedMaterial.dispose();
      chargeRingBlackMaterial.dispose();
    },
  };
};
