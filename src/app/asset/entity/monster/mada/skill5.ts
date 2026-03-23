import * as THREE from "three";
import type { PlayerWorldTickArgs } from "../../character/general/player";

const MADA_SKILL5_BEFORE_FALLBACK_MS = 760;
const MADA_SKILL5_BEFORE_HOLD_MS = 1000;
const MADA_SKILL5_HIDDEN_WAIT_MS = 2000;
const MADA_SKILL5_DURING_HOLD_MS = 1000;
const MADA_SKILL5_DURING_FALLBACK_MS = 860;
const MADA_SKILL5_AFTER_FALLBACK_MS = 760;
const MADA_SKILL5_AFTER_FINISH_GRACE_MS = 120;
const MADA_SKILL5_DAMAGE = 35;
const MADA_SKILL5_HIT_RADIUS = 2.25;
const MADA_SKILL5_PLAYER_RADIUS = 0.72;
const MADA_SKILL5_TELEPORT_MIN_RADIUS = 2.8;
const MADA_SKILL5_TELEPORT_MAX_RADIUS = 4.4;
const MADA_SKILL5_EDGE_MARGIN = 5;
const MADA_SKILL5_TELEPORT_ATTEMPTS = 20;
const MADA_SKILL5_SLASH_EMIT_INTERVAL_MS = 26;
const MADA_SKILL5_SLASH_LIFE_S = 0.58;
const MADA_SKILL5_SLASH_SPARK_COUNT = 16;
const MADA_SKILL5_SLASH_SPARK_LIFE_S = 0.42;
const MADA_SKILL5_REVEAL_PARTICLE_INTERVAL_MS = 22;
const MADA_SKILL5_REVEAL_PARTICLE_BURST = 14;
const MADA_SKILL5_REVEAL_PARTICLE_LIFE_S = 0.38;
const MADA_SKILL5_BEFORE_PARTICLE_INTERVAL_MS = 30;
const MADA_SKILL5_BEFORE_PARTICLE_BURST = 9;
const MADA_SKILL5_BEFORE_PARTICLE_LIFE_S = 0.45;
const MADA_SKILL5_HAND_FORWARD_OFFSET = 0.82;
const MADA_SKILL5_HAND_TRAIL_UP_OFFSET = 0.26;
const MADA_SKILL5_SWING_MIN_PROGRESS = 0.7;
const MADA_SKILL5_SWING_DOWN_SPEED_THRESHOLD = 0.9;
const MADA_SKILL5_SWING_DROP_MIN = 0.18;
const MADA_SKILL5_DAMAGE_FALLBACK_PROGRESS = 0.94;

type MadaBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type MadaSkill5AnimationBridge = {
  triggerSkill5Before: () => number;
  setSkill5BeforeTimeScale: (timeScale: number) => void;
  triggerSkill5During: () => number;
  setSkill5DuringTimeScale: (timeScale: number) => void;
  triggerSkill5After: () => number;
  isSkill5AfterPlaying: () => boolean;
  stopSkill5: () => void;
  getHandLFrontWorldPosition: (
    target: THREE.Vector3,
    forwardOffset?: number
  ) => boolean;
  getHandRFrontWorldPosition: (
    target: THREE.Vector3,
    forwardOffset?: number
  ) => boolean;
};

type TickArgs = {
  now: number;
  delta: number;
  rig: THREE.Object3D;
  player: PlayerWorldTickArgs["player"];
  applyDamage: PlayerWorldTickArgs["applyDamage"];
};

type SlashTrail = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
};

type BeforeParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

type SlashSpark = {
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

const randomSigned = () => Math.random() * 2 - 1;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

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

const handLProbe = new THREE.Vector3();
const handRProbe = new THREE.Vector3();
const handLPrevious = new THREE.Vector3();
const handRPrevious = new THREE.Vector3();
const slashDirection = new THREE.Vector3();
const playerProbe = new THREE.Vector3();
const teleportCandidate = new THREE.Vector3();
const bodyCenterProbe = new THREE.Vector3();
const particleOffset = new THREE.Vector3();
const particleVelocity = new THREE.Vector3();
const slashLateral = new THREE.Vector3();
const slashUpAxis = new THREE.Vector3(0, 1, 0);
const slashFallbackAxis = new THREE.Vector3(1, 0, 0);
const sparkOffset = new THREE.Vector3();
const sparkVelocity = new THREE.Vector3();

export const createMadaSkill5Runtime = ({
  scene,
  animation,
  bounds,
  isBlocked,
  groundY,
}: {
  scene: THREE.Scene;
  animation: MadaSkill5AnimationBridge;
  bounds: MadaBounds;
  isBlocked: (x: number, z: number) => boolean;
  groundY: number;
}) => {
  const slashGeometry = new THREE.PlaneGeometry(1, 1.2);
  const slashSparkGeometry = new THREE.SphereGeometry(0.075, 7, 6);
  const beforeParticleGeometry = new THREE.SphereGeometry(0.09, 7, 6);

  const slashTrails: SlashTrail[] = [];
  const slashSparks: SlashSpark[] = [];
  const beforeParticles: BeforeParticle[] = [];
  const bodyMaterialStates: BodyMaterialState[] = [];

  let phase:
    | "idle"
    | "before"
    | "beforeHold"
    | "hiddenWait"
    | "duringHold"
    | "during"
    | "after" = "idle";
  let beforeEndsAt = 0;
  let beforeHoldEndsAt = 0;
  let hiddenEndsAt = 0;
  let duringHoldEndsAt = 0;
  let duringStartedAt = 0;
  let duringEndsAt = 0;
  let afterEndsAt = 0;
  let slashEmitCarryMs = 0;
  let revealParticleCarryMs = 0;
  let beforeParticleCarryMs = 0;
  let bodyMaskApplied = false;
  let hasHandLSample = false;
  let hasHandRSample = false;
  let handLDownSpeed = 0;
  let handRDownSpeed = 0;
  let handLPeakY = Number.NEGATIVE_INFINITY;
  let handRPeakY = Number.NEGATIVE_INFINITY;
  let damageApplied = false;
  let castFailed = false;

  const removeSlashTrailAt = (index: number) => {
    const trail = slashTrails[index];
    if (!trail) return;
    trail.mesh.removeFromParent();
    trail.material.dispose();
    slashTrails.splice(index, 1);
  };

  const clearSlashTrails = () => {
    for (let i = slashTrails.length - 1; i >= 0; i -= 1) {
      removeSlashTrailAt(i);
    }
  };

  const removeBeforeParticleAt = (index: number) => {
    const particle = beforeParticles[index];
    if (!particle) return;
    particle.mesh.removeFromParent();
    particle.material.dispose();
    beforeParticles.splice(index, 1);
  };

  const clearBeforeParticles = () => {
    for (let i = beforeParticles.length - 1; i >= 0; i -= 1) {
      removeBeforeParticleAt(i);
    }
  };

  const removeSlashSparkAt = (index: number) => {
    const spark = slashSparks[index];
    if (!spark) return;
    spark.mesh.removeFromParent();
    spark.material.dispose();
    slashSparks.splice(index, 1);
  };

  const clearSlashSparks = () => {
    for (let i = slashSparks.length - 1; i >= 0; i -= 1) {
      removeSlashSparkAt(i);
    }
  };

  const resolveBodyCenter = (rig: THREE.Object3D) => {
    rig.getWorldPosition(bodyCenterProbe);
    bodyCenterProbe.y += 1.7;
    return bodyCenterProbe;
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

  const spawnBeforeParticles = (center: THREE.Vector3, count: number) => {
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x050505 : 0x120608,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(beforeParticleGeometry, material);
      particleOffset.set(randomSigned(), randomSigned(), randomSigned());
      if (particleOffset.lengthSq() <= 0.0001) {
        particleOffset.set(0.7, 0.45, -0.5);
      }
      particleOffset.normalize();
      mesh.position.copy(center).addScaledVector(particleOffset, 0.55 + Math.random() * 1.6);
      const startScale = 0.5 + Math.random() * 1.5;
      mesh.scale.setScalar(startScale);
      scene.add(mesh);

      particleVelocity
        .copy(particleOffset)
        .multiplyScalar(1.2 + Math.random() * 2.1);
      particleVelocity.y += 1.3 + Math.random() * 2.5;
      beforeParticles.push({
        mesh,
        material,
        velocity: particleVelocity.clone(),
        age: 0,
        life: MADA_SKILL5_BEFORE_PARTICLE_LIFE_S * (0.8 + Math.random() * 0.4),
        startScale,
        endScale: 0.02 + Math.random() * 0.08,
      });
    }
  };

  const spawnRevealParticles = (center: THREE.Vector3, count: number) => {
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0x090909 : 0x020202,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(beforeParticleGeometry, material);
      particleOffset.set(randomSigned(), randomSigned(), randomSigned());
      if (particleOffset.lengthSq() <= 0.0001) {
        particleOffset.set(0.6, 0.3, -0.4);
      }
      particleOffset.normalize();
      mesh.position
        .copy(center)
        .addScaledVector(particleOffset, 0.35 + Math.random() * 1.2);
      const startScale = 0.6 + Math.random() * 1.25;
      mesh.scale.setScalar(startScale);
      scene.add(mesh);

      particleVelocity
        .copy(particleOffset)
        .multiplyScalar(2 + Math.random() * 4.3);
      particleVelocity.y += 0.4 + Math.random() * 1.8;
      beforeParticles.push({
        mesh,
        material,
        velocity: particleVelocity.clone(),
        age: 0,
        life: MADA_SKILL5_REVEAL_PARTICLE_LIFE_S * (0.75 + Math.random() * 0.4),
        startScale,
        endScale: 0.03 + Math.random() * 0.08,
      });
    }
  };

  const updateBeforeParticles = (delta: number) => {
    for (let i = beforeParticles.length - 1; i >= 0; i -= 1) {
      const particle = beforeParticles[i];
      particle.age += delta;
      if (particle.age >= particle.life) {
        removeBeforeParticleAt(i);
        continue;
      }
      particle.mesh.position.addScaledVector(particle.velocity, Math.max(0, delta));
      particle.velocity.multiplyScalar(Math.max(0, 1 - 1.7 * Math.max(0, delta)));
      const t = particle.age / particle.life;
      const fade = 1 - t;
      particle.material.opacity = Math.max(0.02, fade * fade * 0.9);
      const scale = THREE.MathUtils.lerp(particle.startScale, particle.endScale, t);
      particle.mesh.scale.setScalar(Math.max(0.02, scale));
    }
  };

  const isNearEdge = (x: number, z: number) =>
    x <= bounds.minX + MADA_SKILL5_EDGE_MARGIN ||
    x >= bounds.maxX - MADA_SKILL5_EDGE_MARGIN ||
    z <= bounds.minZ + MADA_SKILL5_EDGE_MARGIN ||
    z >= bounds.maxZ - MADA_SKILL5_EDGE_MARGIN;

  const tryTeleportNearPlayer = (rig: THREE.Object3D, player: THREE.Object3D) => {
    player.getWorldPosition(playerProbe);
    if (isNearEdge(playerProbe.x, playerProbe.z)) {
      return false;
    }

    for (let i = 0; i < MADA_SKILL5_TELEPORT_ATTEMPTS; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius =
        MADA_SKILL5_TELEPORT_MIN_RADIUS +
        Math.random() * (MADA_SKILL5_TELEPORT_MAX_RADIUS - MADA_SKILL5_TELEPORT_MIN_RADIUS);
      const x = playerProbe.x + Math.cos(angle) * radius;
      const z = playerProbe.z + Math.sin(angle) * radius;
      if (isNearEdge(x, z)) continue;
      if (isBlocked(x, z)) continue;
      teleportCandidate.set(x, groundY, z);
      rig.position.copy(teleportCandidate);
      rig.rotation.set(0, Math.random() * Math.PI * 2, 0);
      return true;
    }
    return false;
  };

  const emitGrabTrail = (start: THREE.Vector3, end: THREE.Vector3) => {
    const segment = end.clone().sub(start);
    const length = segment.length();
    if (length <= 0.02) return;

    const center = start.clone().lerp(end, 0.5);
    slashDirection.copy(segment).normalize();
    const width = Math.max(0.22, Math.min(0.5, length * 0.5));
    slashLateral.copy(slashDirection).cross(slashUpAxis);
    if (slashLateral.lengthSq() <= 0.00001) {
      slashLateral.copy(slashDirection).cross(slashFallbackAxis);
    }
    slashLateral.normalize();

    const emitSlice = (
      color: number,
      opacity: number,
      scale: number,
      dark: boolean,
      lateralOffset: number,
      verticalOffset: number
    ) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(
        slashGeometry,
        material
      );
      mesh.position
        .copy(center)
        .addScaledVector(slashLateral, lateralOffset)
        .addScaledVector(slashUpAxis, verticalOffset);
      mesh.lookAt(center.clone().add(slashDirection));
      mesh.rotateX(Math.PI / 2);
      mesh.scale.set(
        width * scale,
        Math.max(0.75, length * (1.9 + scale * 0.5)),
        1
      );
      scene.add(mesh);
      slashTrails.push({
        mesh,
        material,
        life: MADA_SKILL5_SLASH_LIFE_S * (0.9 + Math.random() * 0.25),
        maxLife: MADA_SKILL5_SLASH_LIFE_S,
      });
    };

    emitSlice(0x050304, 0.9, 1.42, true, -0.12, 0.05);
    emitSlice(0x1f090b, 0.84, 1.2, true, 0.1, 0.02);
    emitSlice(0xc61c15, 0.72, 1.02, false, 0, 0.08);
    emitSlice(0xff3f2c, 0.58, 0.84, false, 0.08, 0.12);
    emitSlice(0x2a0d0f, 0.52, 0.74, true, -0.06, -0.02);

    const burstCount =
      MADA_SKILL5_SLASH_SPARK_COUNT + Math.floor(Math.random() * 5);
    const burstRadius = Math.max(0.18, width * 0.8);
    for (let i = 0; i < burstCount; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff3a28 : 0x170709,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: i % 3 === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(slashSparkGeometry, material);
      sparkOffset
        .copy(slashLateral)
        .multiplyScalar(randomSigned() * burstRadius)
        .addScaledVector(slashUpAxis, randomSigned() * burstRadius * 0.6)
        .addScaledVector(slashDirection, randomSigned() * length * 0.25);
      mesh.position.copy(center).add(sparkOffset);
      const startScale = 0.45 + Math.random() * 1.35;
      mesh.scale.setScalar(startScale);
      scene.add(mesh);

      sparkVelocity
        .copy(slashDirection)
        .multiplyScalar(2.4 + Math.random() * 5.8)
        .addScaledVector(slashLateral, randomSigned() * (2 + Math.random() * 5.5))
        .addScaledVector(slashUpAxis, -0.6 + Math.random() * 2.6);
      slashSparks.push({
        mesh,
        material,
        velocity: sparkVelocity.clone(),
        age: 0,
        life: MADA_SKILL5_SLASH_SPARK_LIFE_S * (0.8 + Math.random() * 0.55),
        startScale,
        endScale: 0.03 + Math.random() * 0.09,
      });
    }
  };

  const updateSlashTrails = (delta: number) => {
    for (let i = slashTrails.length - 1; i >= 0; i -= 1) {
      const trail = slashTrails[i];
      trail.life -= Math.max(0, delta);
      if (trail.life <= 0) {
        removeSlashTrailAt(i);
        continue;
      }
      const t = 1 - trail.life / trail.maxLife;
      trail.material.opacity = Math.max(0.02, trail.material.opacity * (1 - t * 0.5));
      trail.mesh.scale.x *= 1 + Math.max(0, delta) * 1.6;
      trail.mesh.scale.y *= 1 - Math.max(0, delta) * 0.12;
    }
  };

  const updateSlashSparks = (delta: number) => {
    for (let i = slashSparks.length - 1; i >= 0; i -= 1) {
      const spark = slashSparks[i];
      spark.age += delta;
      if (spark.age >= spark.life) {
        removeSlashSparkAt(i);
        continue;
      }
      spark.mesh.position.addScaledVector(spark.velocity, Math.max(0, delta));
      spark.velocity.multiplyScalar(Math.max(0, 1 - 2.2 * Math.max(0, delta)));
      spark.velocity.y -= 2.8 * Math.max(0, delta);
      const t = spark.age / spark.life;
      spark.material.opacity = Math.max(0.02, (1 - t) * (1 - t) * 0.92);
      const scale = THREE.MathUtils.lerp(spark.startScale, spark.endScale, t);
      spark.mesh.scale.setScalar(Math.max(0.02, scale));
    }
  };

  const sampleHandsAndEmit = (delta: number) => {
    const dt = Math.max(1 / 240, Math.max(0, delta));
    slashEmitCarryMs += Math.max(0, delta) * 1000;
    const emitNow = slashEmitCarryMs >= MADA_SKILL5_SLASH_EMIT_INTERVAL_MS;
    if (emitNow) {
      slashEmitCarryMs -= MADA_SKILL5_SLASH_EMIT_INTERVAL_MS;
    }

    const hasL = animation.getHandLFrontWorldPosition(handLProbe, MADA_SKILL5_HAND_FORWARD_OFFSET);
    const hasR = animation.getHandRFrontWorldPosition(handRProbe, MADA_SKILL5_HAND_FORWARD_OFFSET);
    if (hasL) {
      handLProbe.y += MADA_SKILL5_HAND_TRAIL_UP_OFFSET;
    }
    if (hasR) {
      handRProbe.y += MADA_SKILL5_HAND_TRAIL_UP_OFFSET;
    }

    if (emitNow) {
      if (hasL && hasHandLSample) {
        emitGrabTrail(handLPrevious, handLProbe);
      }
      if (hasR && hasHandRSample) {
        emitGrabTrail(handRPrevious, handRProbe);
      }
    }

    if (hasL) {
      handLPeakY = Math.max(handLPeakY, handLProbe.y);
      if (hasHandLSample) {
        handLDownSpeed = (handLPrevious.y - handLProbe.y) / dt;
      } else {
        handLDownSpeed = 0;
      }
      handLPrevious.copy(handLProbe);
      hasHandLSample = true;
    } else {
      hasHandLSample = false;
      handLDownSpeed = 0;
    }
    if (hasR) {
      handRPeakY = Math.max(handRPeakY, handRProbe.y);
      if (hasHandRSample) {
        handRDownSpeed = (handRPrevious.y - handRProbe.y) / dt;
      } else {
        handRDownSpeed = 0;
      }
      handRPrevious.copy(handRProbe);
      hasHandRSample = true;
    } else {
      hasHandRSample = false;
      handRDownSpeed = 0;
    }
  };

  const tryApplyDamage = (
    now: number,
    player: THREE.Object3D,
    applyDamage: TickArgs["applyDamage"]
  ) => {
    if (damageApplied) return;
    const duringDurationMs = Math.max(1, duringEndsAt - duringStartedAt);
    const progress = clamp01((now - duringStartedAt) / duringDurationMs);
    if (progress < MADA_SKILL5_SWING_MIN_PROGRESS) return;

    const leftSwingDown =
      hasHandLSample &&
      handLDownSpeed >= MADA_SKILL5_SWING_DOWN_SPEED_THRESHOLD &&
      handLPeakY - handLPrevious.y >= MADA_SKILL5_SWING_DROP_MIN;
    const rightSwingDown =
      hasHandRSample &&
      handRDownSpeed >= MADA_SKILL5_SWING_DOWN_SPEED_THRESHOLD &&
      handRPeakY - handRPrevious.y >= MADA_SKILL5_SWING_DROP_MIN;
    if (
      !leftSwingDown &&
      !rightSwingDown &&
      progress < MADA_SKILL5_DAMAGE_FALLBACK_PROGRESS
    ) {
      return;
    }

    player.getWorldPosition(playerProbe);
    playerProbe.y += 1.2;
    const hitRadius = MADA_SKILL5_HIT_RADIUS + MADA_SKILL5_PLAYER_RADIUS;
    const hitRadiusSq = hitRadius * hitRadius;

    const hitLeft =
      hasHandLSample && handLPrevious.distanceToSquared(playerProbe) <= hitRadiusSq;
    const hitRight =
      hasHandRSample && handRPrevious.distanceToSquared(playerProbe) <= hitRadiusSq;
    if (hitLeft || hitRight) {
      applyDamage(MADA_SKILL5_DAMAGE);
      damageApplied = true;
    }
  };

  const switchToDuring = (now: number) => {
    const duringDurationS = animation.triggerSkill5During();
    const holdMs = Math.max(0, MADA_SKILL5_DURING_HOLD_MS);
    const duringDurationMs = Math.max(
      MADA_SKILL5_DURING_FALLBACK_MS,
      duringDurationS * 1000
    );
    duringHoldEndsAt = now + holdMs;
    duringStartedAt = duringHoldEndsAt;
    duringEndsAt = duringStartedAt + duringDurationMs;
    slashEmitCarryMs = 0;
    revealParticleCarryMs = 0;
    hasHandLSample = false;
    hasHandRSample = false;
    handLDownSpeed = 0;
    handRDownSpeed = 0;
    handLPeakY = Number.NEGATIVE_INFINITY;
    handRPeakY = Number.NEGATIVE_INFINITY;
    damageApplied = false;
    if (holdMs > 0) {
      phase = "duringHold";
      animation.setSkill5DuringTimeScale(0);
      return;
    }
    phase = "during";
    animation.setSkill5DuringTimeScale(1);
  };

  const switchToAfter = (now: number) => {
    animation.setSkill5DuringTimeScale(1);
    const afterDurationS = animation.triggerSkill5After();
    phase = "after";
    afterEndsAt =
      now +
      Math.max(
        MADA_SKILL5_AFTER_FALLBACK_MS,
        afterDurationS * 1000 + MADA_SKILL5_AFTER_FINISH_GRACE_MS
      );
  };

  const finishCast = (rig: THREE.Object3D | null = null) => {
    phase = "idle";
    beforeEndsAt = 0;
    beforeHoldEndsAt = 0;
    hiddenEndsAt = 0;
    duringHoldEndsAt = 0;
    duringStartedAt = 0;
    duringEndsAt = 0;
    afterEndsAt = 0;
    slashEmitCarryMs = 0;
    revealParticleCarryMs = 0;
    beforeParticleCarryMs = 0;
    hasHandLSample = false;
    hasHandRSample = false;
    handLDownSpeed = 0;
    handRDownSpeed = 0;
    handLPeakY = Number.NEGATIVE_INFINITY;
    handRPeakY = Number.NEGATIVE_INFINITY;
    damageApplied = false;
    animation.setSkill5BeforeTimeScale(1);
    animation.setSkill5DuringTimeScale(1);
    animation.stopSkill5();
    applyBodyBlackMask(false);
    if (rig) rig.visible = true;
    clearBeforeParticles();
    clearSlashTrails();
    clearSlashSparks();
  };

  return {
    beginCast: (now: number, rig: THREE.Object3D) => {
      captureBodyMaterials(rig);
      applyBodyBlackMask(false);
      clearBeforeParticles();
      clearSlashTrails();
      clearSlashSparks();
      castFailed = false;
      rig.visible = true;

      const beforeDurationS = animation.triggerSkill5Before();
      if (beforeDurationS > 0) {
        phase = "before";
        beforeEndsAt =
          now + Math.max(MADA_SKILL5_BEFORE_FALLBACK_MS, beforeDurationS * 1000);
        beforeHoldEndsAt = 0;
        revealParticleCarryMs = 0;
        beforeParticleCarryMs = 0;
        return true;
      }
      return false;
    },
    isCasting: () => phase !== "idle",
    consumeCastFailed: () => {
      const failed = castFailed;
      castFailed = false;
      return failed;
    },
    tick: ({ now, delta, rig, player, applyDamage }: TickArgs) => {
      if (phase === "idle") return;

      updateBeforeParticles(Math.max(0, delta));
      updateSlashTrails(Math.max(0, delta));
      updateSlashSparks(Math.max(0, delta));

      if (phase === "before") {
        applyBodyBlackMask(true);
        const center = resolveBodyCenter(rig);
        beforeParticleCarryMs += Math.max(0, delta) * 1000;
        while (beforeParticleCarryMs >= MADA_SKILL5_BEFORE_PARTICLE_INTERVAL_MS) {
          beforeParticleCarryMs -= MADA_SKILL5_BEFORE_PARTICLE_INTERVAL_MS;
          spawnBeforeParticles(center, MADA_SKILL5_BEFORE_PARTICLE_BURST);
        }

        if (now >= beforeEndsAt) {
          phase = "beforeHold";
          beforeHoldEndsAt = now + MADA_SKILL5_BEFORE_HOLD_MS;
          animation.setSkill5BeforeTimeScale(0);
        }
        return;
      }

      if (phase === "beforeHold") {
        if (now < beforeHoldEndsAt) {
          return;
        }
        animation.setSkill5BeforeTimeScale(1);
        applyBodyBlackMask(false);
        rig.visible = false;
        phase = "hiddenWait";
        hiddenEndsAt = now + MADA_SKILL5_HIDDEN_WAIT_MS;
        return;
      }

      if (phase === "hiddenWait") {
        rig.visible = false;
        if (now < hiddenEndsAt) {
          return;
        }

        const teleported = tryTeleportNearPlayer(rig, player);
        if (!teleported) {
          rig.visible = true;
          castFailed = true;
          finishCast(rig);
          return;
        }
        rig.visible = false;
        switchToDuring(now);
        return;
      }

      rig.visible = true;
      applyBodyBlackMask(false);

      if (phase === "duringHold") {
        rig.visible = false;
        const center = resolveBodyCenter(rig);
        revealParticleCarryMs += Math.max(0, delta) * 1000;
        while (
          revealParticleCarryMs >= MADA_SKILL5_REVEAL_PARTICLE_INTERVAL_MS
        ) {
          revealParticleCarryMs -= MADA_SKILL5_REVEAL_PARTICLE_INTERVAL_MS;
          spawnRevealParticles(center, MADA_SKILL5_REVEAL_PARTICLE_BURST);
        }
        if (now >= duringHoldEndsAt) {
          animation.setSkill5DuringTimeScale(1);
          rig.visible = true;
          phase = "during";
        }
        return;
      }

      if (phase === "during") {
        sampleHandsAndEmit(delta);
        tryApplyDamage(now, player, applyDamage);
        if (now >= duringEndsAt) {
          switchToAfter(now);
        }
        return;
      }

      if (phase === "after" && now >= afterEndsAt && !animation.isSkill5AfterPlaying()) {
        finishCast(rig);
      }
    },
    reset: () => {
      castFailed = false;
      finishCast();
    },
    dispose: () => {
      finishCast();
      slashGeometry.dispose();
      slashSparkGeometry.dispose();
      beforeParticleGeometry.dispose();
    },
  };
};
