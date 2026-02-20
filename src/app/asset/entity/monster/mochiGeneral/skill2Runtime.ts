import * as THREE from "three";
import type { MochiGeneralCombatEntry } from "./combatBehavior";
import type { StatusEffectApplication } from "../../character/general/types";

type ThrownMochiState = {
  entry: MochiGeneralCombatEntry;
  object: THREE.Object3D;
  usingProxy: boolean;
  proxyMaterial: THREE.MeshStandardMaterial | null;
  detachedMaterialOverrides: DetachedMochiMaterialOverride[];
  originalParent: THREE.Object3D | null;
  originalLocalPosition: THREE.Vector3;
  originalLocalQuaternion: THREE.Quaternion;
  originalLocalScale: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  returning: boolean;
  hitPlayer: boolean;
  trailSpawnCarry: number;
  rageSkill1BurstTriggerTimes: number[];
  rageSkill1BurstFiredCount: number;
  flowTime: number;
};

type DetachedMochiMaterialOverride = {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  overrideMaterial: THREE.Material | THREE.Material[];
};

type StickyBlob = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  baseOffset: THREE.Vector3;
  baseScale: number;
  wobblePhase: number;
  wobbleAmplitude: number;
  wobbleSpeed: number;
};

type StickyFxState = {
  group: THREE.Group;
  blobs: StickyBlob[];
  coreMesh: THREE.Mesh;
  auraMesh: THREE.Mesh;
  coreMaterial: THREE.MeshStandardMaterial;
  auraMaterial: THREE.MeshStandardMaterial;
  time: number;
};

type ThrowFlashParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

type ThrowShockwave = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

type MeteorTrailParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

export type MochiGeneralSkill2Runtime = {
  onBossTick: (args: {
    entry: MochiGeneralCombatEntry;
    delta: number;
    player: THREE.Object3D;
    gameEnded: boolean;
  }) => void;
  update: (args: {
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    applyStatusEffect: (effect: StatusEffectApplication) => boolean;
    gameEnded: boolean;
    spawnSkill1SingleBurst?: (args: {
      entry: MochiGeneralCombatEntry;
      origin: THREE.Vector3;
      gameEnded: boolean;
    }) => void;
  }) => void;
  onBossRemoved: (entry: MochiGeneralCombatEntry) => void;
  dispose: () => void;
};

const SKILL2_OUTBOUND_SPEED = 9.8 * 0.75 * 0.8;
const SKILL2_OUTBOUND_TURN_RATE = 6.4;
const SKILL2_OUTBOUND_MAX_DURATION = 10;
const SKILL2_RETURN_SPEED = 11.5;
const SKILL2_RETURN_TURN_RATE = 7.8;
const SKILL2_ATTACH_DISTANCE = 0.26;
const SKILL2_PROJECTILE_RADIUS = 0.3;
const SKILL2_PLAYER_RADIUS = 0.55;
const SKILL2_PLAYER_HEIGHT_OFFSET = 1;
const SKILL2_HIT_DAMAGE = 30;
const SKILL2_SLOW_DURATION = 5;
const SKILL2_SLOW_SPEED_MULTIPLIER = 0.5;
const SKILL2_PROXY_RADIUS = 0.22;
const SKILL2_STICKY_BLOB_COUNT = 26;
const SKILL2_STICKY_BASE_HEIGHT = 0.96;
const SKILL2_THROW_FLASH_PARTICLE_COUNT = 34;
const SKILL2_THROW_FLASH_PARTICLE_LIFE_MIN = 0.24;
const SKILL2_THROW_FLASH_PARTICLE_LIFE_MAX = 0.48;
const SKILL2_THROW_FLASH_PARTICLE_SPEED_MIN = 4.8;
const SKILL2_THROW_FLASH_PARTICLE_SPEED_MAX = 10.8;
const SKILL2_THROW_SHOCKWAVE_LIFE = 0.36;
const SKILL2_METEOR_TRAIL_SPAWN_RATE = 40;
const SKILL2_METEOR_TRAIL_SPAWN_RATE_RAGE = 76;
const SKILL2_METEOR_TRAIL_SPAWN_PER_FRAME_CAP = 18;
const SKILL2_METEOR_TRAIL_LIFE_MIN = 0.12;
const SKILL2_METEOR_TRAIL_LIFE_MAX = 0.28;
const SKILL2_METEOR_TRAIL_SCALE_MIN = 0.3;
const SKILL2_METEOR_TRAIL_SCALE_MAX = 0.86;
const SKILL2_METEOR_TRAIL_SPEED = 5.6;
const SKILL2_RAGE_FX_MULTIPLIER = 1.4;
const SKILL2_RAGE_SKILL1_SINGLE_BURST_COUNT = 2;
const SKILL2_RAGE_SKILL1_SINGLE_BURST_TRIGGER_MIN_RATIO = 0.16;
const SKILL2_RAGE_SKILL1_SINGLE_BURST_TRIGGER_MAX_RATIO = 0.68;
const SKILL2_TRACKING_FLOW_SPEED = 8.2;
const SKILL2_TRACKING_FLOW_POSITION_FREQUENCY = 6.4;
const SKILL2_TRACKING_FLOW_EMISSIVE_MIN = 0.14;
const SKILL2_TRACKING_FLOW_EMISSIVE_MAX = 0.7;

const mochiThrowOriginWorld = new THREE.Vector3();
const mochiThrowTargetWorld = new THREE.Vector3();
const mochiThrowDirection = new THREE.Vector3();
const mochiReturnTargetWorld = new THREE.Vector3();
const mochiVelocityTarget = new THREE.Vector3();
const mochiDelta = new THREE.Vector3();
const playerWorldProbe = new THREE.Vector3();
const throwFlashDirection = new THREE.Vector3();
const meteorTrailDirection = new THREE.Vector3();
const meteorTrailSpawnOffset = new THREE.Vector3();
const rageSkill1BurstOrigin = new THREE.Vector3();

export const createMochiGeneralSkill2Runtime = (
  scene: THREE.Scene
): MochiGeneralSkill2Runtime => {
  const proxyGeometry = new THREE.SphereGeometry(SKILL2_PROXY_RADIUS, 12, 10);
  const proxyMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xfbf2d7,
    roughness: 0.36,
    metalness: 0.04,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.2,
  });
  const stickyBlobGeometry = new THREE.SphereGeometry(0.11, 8, 6);
  const stickyBlobMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xfff5d1,
    roughness: 0.35,
    metalness: 0,
    emissive: 0xb45309,
    emissiveIntensity: 0.16,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const stickyCoreGeometry = new THREE.SphereGeometry(0.34, 14, 10);
  const stickyAuraGeometry = new THREE.IcosahedronGeometry(0.68, 1);
  const stickyCoreMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xfff1bf,
    roughness: 0.42,
    metalness: 0,
    emissive: 0xc2410c,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
  });
  const stickyAuraMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.55,
    metalness: 0,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    wireframe: true,
  });
  const throwFlashGeometry = new THREE.IcosahedronGeometry(0.12, 0);
  const throwFlashMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xfff4cf,
    roughness: 0.18,
    metalness: 0,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.1,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const throwShockwaveGeometry = new THREE.RingGeometry(0.56, 0.9, 32);
  const throwShockwaveMaterialTemplate = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const meteorTrailGeometry = new THREE.SphereGeometry(0.08, 7, 5);
  const meteorTrailWhiteMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
    metalness: 0,
    emissive: 0xffffff,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const meteorTrailBlackMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.38,
    metalness: 0.04,
    emissive: 0x020617,
    emissiveIntensity: 0.16,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });

  const thrownStates = new Map<MochiGeneralCombatEntry, ThrownMochiState>();
  const throwFlashParticles: ThrowFlashParticle[] = [];
  const throwShockwaves: ThrowShockwave[] = [];
  const meteorTrailParticles: MeteorTrailParticle[] = [];
  let stickyFxRemaining = 0;
  let stickyFxState: StickyFxState | null = null;
  let stickyFxIntensity = 1;

  const resolveHeldMochiOrigin = (entry: MochiGeneralCombatEntry, out: THREE.Vector3) => {
    const heldMochi = entry.rig?.heldMochi;
    if (heldMochi) {
      heldMochi.getWorldPosition(out);
      return;
    }
    out.copy(entry.anchor.position);
    out.y += 2.2;
  };

  const applyDetachedMochiMaterialOverrides = (
    object: THREE.Object3D
  ): DetachedMochiMaterialOverride[] => {
    const overrides: DetachedMochiMaterialOverride[] = [];
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (Array.isArray(mesh.material)) {
        const originalMaterial = mesh.material;
        const overrideMaterial = originalMaterial.map((material) => material.clone());
        mesh.material = overrideMaterial;
        overrides.push({
          mesh,
          originalMaterial,
          overrideMaterial,
        });
        return;
      }
      const originalMaterial = mesh.material;
      const overrideMaterial = originalMaterial.clone();
      mesh.material = overrideMaterial;
      overrides.push({
        mesh,
        originalMaterial,
        overrideMaterial,
      });
    });
    return overrides;
  };

  const restoreDetachedMochiMaterialOverrides = (
    overrides: DetachedMochiMaterialOverride[]
  ) => {
    for (let i = 0; i < overrides.length; i += 1) {
      const override = overrides[i];
      if (!override?.mesh) continue;
      override.mesh.material = override.originalMaterial;
      if (Array.isArray(override.overrideMaterial)) {
        for (let j = 0; j < override.overrideMaterial.length; j += 1) {
          override.overrideMaterial[j]?.dispose();
        }
      } else {
        override.overrideMaterial.dispose();
      }
    }
  };

  const applyTrackingFlowToMaterial = (
    material: THREE.Material,
    flowT: number,
    rageFxMultiplier: number
  ) => {
    const clampedT = THREE.MathUtils.clamp(flowT, 0, 1);
    const colorMaterial = material as THREE.Material & { color?: THREE.Color };
    if (colorMaterial.color?.isColor) {
      colorMaterial.color.setRGB(clampedT, clampedT, clampedT);
    }

    const emissiveMaterial = material as THREE.Material & {
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    };
    if (emissiveMaterial.emissive?.isColor) {
      const emissiveTone = THREE.MathUtils.lerp(0.02, 0.42, clampedT);
      emissiveMaterial.emissive.setRGB(emissiveTone, emissiveTone, emissiveTone);
      emissiveMaterial.emissiveIntensity =
        THREE.MathUtils.lerp(
          SKILL2_TRACKING_FLOW_EMISSIVE_MIN,
          SKILL2_TRACKING_FLOW_EMISSIVE_MAX,
          clampedT
        ) * rageFxMultiplier;
    }
  };

  const updateTrackingFlowFx = (
    thrownState: ThrownMochiState,
    delta: number,
    rageActive: boolean
  ) => {
    const rageFxMultiplier = rageActive ? SKILL2_RAGE_FX_MULTIPLIER : 1;
    thrownState.flowTime +=
      delta *
      SKILL2_TRACKING_FLOW_SPEED *
      (rageActive ? 1.18 : 1);
    const worldPhase =
      thrownState.object.position.x * 0.53 +
      thrownState.object.position.y * 0.61 +
      thrownState.object.position.z * 0.47;

    if (thrownState.proxyMaterial) {
      const flowT =
        0.5 +
        0.5 *
          Math.sin(
            thrownState.flowTime +
              worldPhase * SKILL2_TRACKING_FLOW_POSITION_FREQUENCY
          );
      applyTrackingFlowToMaterial(thrownState.proxyMaterial, flowT, rageFxMultiplier);
      return;
    }

    for (let i = 0; i < thrownState.detachedMaterialOverrides.length; i += 1) {
      const materialOverride = thrownState.detachedMaterialOverrides[i];
      const localPhase =
        materialOverride.mesh.position.x * 0.9 +
        materialOverride.mesh.position.y * 0.7 +
        materialOverride.mesh.position.z * 0.6;
      const phase =
        thrownState.flowTime +
        worldPhase * SKILL2_TRACKING_FLOW_POSITION_FREQUENCY +
        localPhase * SKILL2_TRACKING_FLOW_POSITION_FREQUENCY +
        i * 0.86;
      const flowT = 0.5 + 0.5 * Math.sin(phase);

      if (Array.isArray(materialOverride.overrideMaterial)) {
        for (let j = 0; j < materialOverride.overrideMaterial.length; j += 1) {
          const layeredPhase = phase + j * 0.94;
          const layeredFlowT = 0.5 + 0.5 * Math.sin(layeredPhase);
          applyTrackingFlowToMaterial(
            materialOverride.overrideMaterial[j],
            layeredFlowT,
            rageFxMultiplier
          );
        }
        continue;
      }

      applyTrackingFlowToMaterial(
        materialOverride.overrideMaterial,
        flowT,
        rageFxMultiplier
      );
    }
  };

  const disposeStickyFx = () => {
    if (!stickyFxState) return;
    for (let i = 0; i < stickyFxState.blobs.length; i += 1) {
      const blob = stickyFxState.blobs[i];
      blob.material.dispose();
    }
    stickyFxState.coreMaterial.dispose();
    stickyFxState.auraMaterial.dispose();
    if (stickyFxState.group.parent) {
      stickyFxState.group.parent.remove(stickyFxState.group);
    }
    stickyFxState = null;
    stickyFxIntensity = 1;
  };

  const ensureStickyFx = (player: THREE.Object3D) => {
    if (stickyFxState) return;
    const group = new THREE.Group();
    group.name = "mochiGeneralSkill2StickyFx";
    group.position.set(0, SKILL2_STICKY_BASE_HEIGHT, 0);
    const coreMaterial = stickyCoreMaterialTemplate.clone();
    const auraMaterial = stickyAuraMaterialTemplate.clone();
    const coreMesh = new THREE.Mesh(stickyCoreGeometry, coreMaterial);
    const auraMesh = new THREE.Mesh(stickyAuraGeometry, auraMaterial);
    coreMesh.castShadow = false;
    coreMesh.receiveShadow = false;
    auraMesh.castShadow = false;
    auraMesh.receiveShadow = false;
    coreMesh.scale.setScalar(1.2 * stickyFxIntensity);
    auraMesh.scale.setScalar(1.02 * stickyFxIntensity);
    group.add(coreMesh);
    group.add(auraMesh);

    const blobs: StickyBlob[] = [];
    for (let i = 0; i < SKILL2_STICKY_BLOB_COUNT; i += 1) {
      const material = stickyBlobMaterialTemplate.clone();
      material.opacity = THREE.MathUtils.lerp(0.68, 0.98, Math.random());
      material.emissiveIntensity =
        THREE.MathUtils.lerp(0.2, 0.42, Math.random()) * stickyFxIntensity;
      const mesh = new THREE.Mesh(stickyBlobGeometry, material);
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 0.52;
      const baseOffset = new THREE.Vector3(
        Math.cos(angle) * radius,
        THREE.MathUtils.lerp(-0.34, 0.98, Math.random()),
        Math.sin(angle) * radius
      );
      mesh.position.copy(baseOffset);
      const scale =
        THREE.MathUtils.lerp(0.72, 1.82, Math.random()) * stickyFxIntensity;
      mesh.scale.setScalar(scale);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
      blobs.push({
        mesh,
        material,
        baseOffset,
        baseScale: scale,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmplitude: THREE.MathUtils.lerp(0.035, 0.11, Math.random()),
        wobbleSpeed: THREE.MathUtils.lerp(3.8, 9.4, Math.random()),
      });
    }
    player.add(group);
    stickyFxState = {
      group,
      blobs,
      coreMesh,
      auraMesh,
      coreMaterial,
      auraMaterial,
      time: 0,
    };
  };

  const updateStickyFx = (delta: number) => {
    if (!stickyFxState) return;
    stickyFxState.time += delta;
    const pulse = 1 + Math.sin(stickyFxState.time * 6.2) * 0.12;
    const pulseSecondary = 1 + Math.sin(stickyFxState.time * 3.1 + 1.2) * 0.09;
    stickyFxState.coreMesh.scale.setScalar(1.15 * pulse * stickyFxIntensity);
    stickyFxState.auraMesh.scale.setScalar(1.02 * pulseSecondary * stickyFxIntensity);
    stickyFxState.coreMesh.rotation.y += delta * 0.9;
    stickyFxState.auraMesh.rotation.y -= delta * 1.35;
    stickyFxState.auraMesh.rotation.x += delta * 0.45;
    const corePulseT = THREE.MathUtils.clamp((pulse - 0.88) / 0.24, 0, 1);
    const auraPulseT = THREE.MathUtils.clamp((pulseSecondary - 0.91) / 0.18, 0, 1);
    stickyFxState.coreMaterial.emissiveIntensity =
      THREE.MathUtils.lerp(0.2, 0.45, corePulseT) * stickyFxIntensity;
    stickyFxState.auraMaterial.opacity =
      THREE.MathUtils.lerp(0.22, 0.44, auraPulseT) *
      THREE.MathUtils.clamp(stickyFxIntensity, 1, 1.3);

    for (let i = 0; i < stickyFxState.blobs.length; i += 1) {
      const blob = stickyFxState.blobs[i];
      const wobble =
        Math.sin(stickyFxState.time * blob.wobbleSpeed + blob.wobblePhase) *
        blob.wobbleAmplitude;
      const outwardPulse = 1 + Math.sin(stickyFxState.time * 2.8 + i * 0.31) * 0.09;
      blob.mesh.position.x = blob.baseOffset.x * outwardPulse + wobble;
      blob.mesh.position.z = blob.baseOffset.z * outwardPulse - wobble * 0.65;
      blob.mesh.position.y =
        blob.baseOffset.y +
        Math.abs(wobble) * 0.42 +
        Math.sin(stickyFxState.time * 2.2 + i * 0.22) * 0.018;
      blob.mesh.rotation.y += delta * (0.8 + i * 0.055);
      blob.mesh.rotation.x = wobble * 2.4;
      const blobPulse = 1 + Math.sin(stickyFxState.time * 5.2 + i * 0.8) * 0.12;
      blob.mesh.scale.setScalar(blob.baseScale * blobPulse);
    }
  };

  const removeThrowFlashParticleAt = (index: number) => {
    const particle = throwFlashParticles[index];
    if (!particle) return;
    if (particle.mesh.parent) {
      particle.mesh.parent.remove(particle.mesh);
    }
    particle.material.dispose();
    throwFlashParticles.splice(index, 1);
  };

  const removeThrowShockwaveAt = (index: number) => {
    const shockwave = throwShockwaves[index];
    if (!shockwave) return;
    if (shockwave.mesh.parent) {
      shockwave.mesh.parent.remove(shockwave.mesh);
    }
    shockwave.material.dispose();
    throwShockwaves.splice(index, 1);
  };

  const removeMeteorTrailParticleAt = (index: number) => {
    const particle = meteorTrailParticles[index];
    if (!particle) return;
    if (particle.mesh.parent) {
      particle.mesh.parent.remove(particle.mesh);
    }
    particle.material.dispose();
    meteorTrailParticles.splice(index, 1);
  };

  const spawnMeteorTrailParticles = (
    thrownState: ThrownMochiState,
    entry: MochiGeneralCombatEntry,
    delta: number
  ) => {
    if (thrownState.returning) return;
    const spawnRate = entry.rageActive
      ? SKILL2_METEOR_TRAIL_SPAWN_RATE_RAGE
      : SKILL2_METEOR_TRAIL_SPAWN_RATE;
    thrownState.trailSpawnCarry += spawnRate * delta;
    const spawnCount = Math.min(
      SKILL2_METEOR_TRAIL_SPAWN_PER_FRAME_CAP,
      Math.floor(thrownState.trailSpawnCarry)
    );
    if (spawnCount <= 0) return;
    thrownState.trailSpawnCarry -= spawnCount;

    meteorTrailDirection.copy(thrownState.velocity);
    if (meteorTrailDirection.lengthSq() <= 0.00001) {
      meteorTrailDirection.set(0, 0, 1);
    } else {
      meteorTrailDirection.normalize();
    }
    const rageFxMultiplier = entry.rageActive ? SKILL2_RAGE_FX_MULTIPLIER : 1;

    for (let i = 0; i < spawnCount; i += 1) {
      const isWhite = Math.random() < 0.5;
      const material = (
        isWhite ? meteorTrailWhiteMaterialTemplate : meteorTrailBlackMaterialTemplate
      ).clone();
      material.opacity = THREE.MathUtils.clamp(
        material.opacity * THREE.MathUtils.lerp(0.72, 1.08, Math.random()) * rageFxMultiplier,
        0,
        1
      );
      material.emissiveIntensity *= THREE.MathUtils.lerp(0.7, 1.35, Math.random()) * rageFxMultiplier;

      const mesh = new THREE.Mesh(meteorTrailGeometry, material);
      meteorTrailSpawnOffset
        .set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
        .multiplyScalar(0.12 * rageFxMultiplier);
      mesh.position
        .copy(thrownState.object.position)
        .addScaledVector(meteorTrailDirection, -THREE.MathUtils.lerp(0.08, 0.42, Math.random()))
        .add(meteorTrailSpawnOffset);
      const startScale =
        THREE.MathUtils.lerp(
          SKILL2_METEOR_TRAIL_SCALE_MIN,
          SKILL2_METEOR_TRAIL_SCALE_MAX,
          Math.random()
        ) * rageFxMultiplier;
      mesh.scale.setScalar(startScale);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      scene.add(mesh);

      const life = THREE.MathUtils.lerp(
        SKILL2_METEOR_TRAIL_LIFE_MIN,
        SKILL2_METEOR_TRAIL_LIFE_MAX,
        Math.random()
      );
      meteorTrailParticles.push({
        mesh,
        material,
        velocity: meteorTrailDirection
          .clone()
          .multiplyScalar(
            -SKILL2_METEOR_TRAIL_SPEED * THREE.MathUtils.lerp(0.8, 1.2, Math.random())
          )
          .addScaledVector(meteorTrailSpawnOffset, 8),
        age: 0,
        life,
        startScale,
        endScale: startScale * THREE.MathUtils.lerp(0.04, 0.22, Math.random()),
      });
    }
  };

  const spawnThrowFx = (originWorld: THREE.Vector3, rageActive: boolean) => {
    const rageFxMultiplier = rageActive ? SKILL2_RAGE_FX_MULTIPLIER : 1;
    const shockwaveMaterial = throwShockwaveMaterialTemplate.clone();
    shockwaveMaterial.opacity = THREE.MathUtils.clamp(
      shockwaveMaterial.opacity * THREE.MathUtils.lerp(1, 1.25, rageActive ? 1 : 0),
      0,
      1
    );
    const shockwaveMesh = new THREE.Mesh(throwShockwaveGeometry, shockwaveMaterial);
    shockwaveMesh.position.copy(originWorld);
    shockwaveMesh.rotation.x = -Math.PI * 0.5;
    shockwaveMesh.castShadow = false;
    shockwaveMesh.receiveShadow = false;
    scene.add(shockwaveMesh);
    throwShockwaves.push({
      mesh: shockwaveMesh,
      material: shockwaveMaterial,
      age: 0,
      life: SKILL2_THROW_SHOCKWAVE_LIFE,
      startScale: 0.5,
      endScale: 3.4 * rageFxMultiplier,
    });

    const flashParticleCount = Math.max(
      1,
      Math.round(
        SKILL2_THROW_FLASH_PARTICLE_COUNT * (rageActive ? SKILL2_RAGE_FX_MULTIPLIER : 1)
      )
    );
    for (let i = 0; i < flashParticleCount; i += 1) {
      let safety = 0;
      do {
        throwFlashDirection.set(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        );
        throwFlashDirection.y = Math.max(-0.08, throwFlashDirection.y);
        safety += 1;
        if (safety > 8) break;
      } while (throwFlashDirection.lengthSq() <= 0.00001);
      if (throwFlashDirection.lengthSq() <= 0.00001) {
        throwFlashDirection.set(1, 0.2, 0);
      }
      throwFlashDirection.normalize();

      const material = throwFlashMaterialTemplate.clone();
      material.opacity = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(0.62, 0.96, Math.random()) * rageFxMultiplier,
        0,
        1
      );
      material.emissiveIntensity =
        THREE.MathUtils.lerp(0.9, 1.65, Math.random()) * rageFxMultiplier;

      const mesh = new THREE.Mesh(throwFlashGeometry, material);
      mesh.position.copy(originWorld);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const startScale =
        THREE.MathUtils.lerp(0.58, 1.42, Math.random()) * rageFxMultiplier;
      mesh.scale.setScalar(startScale);
      scene.add(mesh);

      const life = THREE.MathUtils.lerp(
        SKILL2_THROW_FLASH_PARTICLE_LIFE_MIN,
        SKILL2_THROW_FLASH_PARTICLE_LIFE_MAX,
        Math.random()
      );
      const speed = THREE.MathUtils.lerp(
        SKILL2_THROW_FLASH_PARTICLE_SPEED_MIN,
        SKILL2_THROW_FLASH_PARTICLE_SPEED_MAX,
        Math.random()
      ) * rageFxMultiplier;
      throwFlashParticles.push({
        mesh,
        material,
        velocity: throwFlashDirection.clone().multiplyScalar(speed),
        age: 0,
        life,
        startScale,
        endScale: startScale * THREE.MathUtils.lerp(0.18, 0.5, Math.random()),
      });
    }
  };

  const updateThrowFx = (delta: number) => {
    for (let i = throwFlashParticles.length - 1; i >= 0; i -= 1) {
      const particle = throwFlashParticles[i];
      particle.age += delta;
      const t = particle.life > 0 ? particle.age / particle.life : 1;
      if (t >= 1) {
        removeThrowFlashParticleAt(i);
        continue;
      }
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.multiplyScalar(0.94);
      particle.velocity.y += 0.6 * delta;
      particle.mesh.rotation.x += delta * 6.5;
      particle.mesh.rotation.y += delta * 5.2;
      const scale = THREE.MathUtils.lerp(particle.startScale, particle.endScale, t);
      particle.mesh.scale.setScalar(scale);
      const fade = Math.max(0, 1 - t);
      particle.material.opacity = fade * fade * 0.95;
    }

    for (let i = throwShockwaves.length - 1; i >= 0; i -= 1) {
      const shockwave = throwShockwaves[i];
      shockwave.age += delta;
      const t = shockwave.life > 0 ? shockwave.age / shockwave.life : 1;
      if (t >= 1) {
        removeThrowShockwaveAt(i);
        continue;
      }
      const eased = THREE.MathUtils.smoothstep(t, 0, 1);
      const scale = THREE.MathUtils.lerp(shockwave.startScale, shockwave.endScale, eased);
      shockwave.mesh.scale.setScalar(scale);
      shockwave.material.opacity = Math.max(0, (1 - eased) * 0.88);
      shockwave.mesh.position.y += delta * 0.08;
    }
  };

  const updateMeteorTrailFx = (delta: number) => {
    for (let i = meteorTrailParticles.length - 1; i >= 0; i -= 1) {
      const particle = meteorTrailParticles[i];
      particle.age += delta;
      const t = particle.life > 0 ? particle.age / particle.life : 1;
      if (t >= 1) {
        removeMeteorTrailParticleAt(i);
        continue;
      }
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.multiplyScalar(0.9);
      particle.velocity.y += 0.42 * delta;
      particle.mesh.rotation.x += delta * 9.2;
      particle.mesh.rotation.y += delta * 6.4;
      const fade = Math.max(0, 1 - t);
      particle.material.opacity = fade * fade * 0.92;
      particle.material.emissiveIntensity = THREE.MathUtils.lerp(1.25, 0.2, t);
      particle.mesh.scale.setScalar(
        THREE.MathUtils.lerp(particle.startScale, particle.endScale, t)
      );
    }
  };

  const createRageSkill1BurstTriggerTimes = () => {
    const triggerTimes: number[] = [];
    for (let i = 0; i < SKILL2_RAGE_SKILL1_SINGLE_BURST_COUNT; i += 1) {
      const ratio = THREE.MathUtils.lerp(
        SKILL2_RAGE_SKILL1_SINGLE_BURST_TRIGGER_MIN_RATIO,
        SKILL2_RAGE_SKILL1_SINGLE_BURST_TRIGGER_MAX_RATIO,
        Math.random()
      );
      triggerTimes.push(SKILL2_OUTBOUND_MAX_DURATION * ratio);
    }
    triggerTimes.sort((a, b) => a - b);
    return triggerTimes;
  };

  const emitPendingRageSkill1Bursts = ({
    thrownState,
    spawnSkill1SingleBurst,
    gameEnded,
    forceAll,
  }: {
    thrownState: ThrownMochiState;
    spawnSkill1SingleBurst?: (args: {
      entry: MochiGeneralCombatEntry;
      origin: THREE.Vector3;
      gameEnded: boolean;
    }) => void;
    gameEnded: boolean;
    forceAll: boolean;
  }) => {
    if (!spawnSkill1SingleBurst || !thrownState.entry.rageActive) return;

    while (
      thrownState.rageSkill1BurstFiredCount <
      thrownState.rageSkill1BurstTriggerTimes.length
    ) {
      const nextTriggerTime =
        thrownState.rageSkill1BurstTriggerTimes[
          thrownState.rageSkill1BurstFiredCount
        ];
      if (!forceAll && thrownState.age < nextTriggerTime) break;
      rageSkill1BurstOrigin.copy(thrownState.object.position);
      spawnSkill1SingleBurst({
        entry: thrownState.entry,
        origin: rageSkill1BurstOrigin,
        gameEnded,
      });
      thrownState.rageSkill1BurstFiredCount += 1;
    }
  };

  const clearThrownState = (entry: MochiGeneralCombatEntry) => {
    const thrownState = thrownStates.get(entry);
    if (!thrownState) {
      entry.skill2ProjectileActive = false;
      return;
    }

    if (!thrownState.usingProxy && thrownState.detachedMaterialOverrides.length > 0) {
      restoreDetachedMochiMaterialOverrides(thrownState.detachedMaterialOverrides);
      thrownState.detachedMaterialOverrides = [];
    }

    if (thrownState.usingProxy) {
      if (thrownState.object.parent) {
        thrownState.object.parent.remove(thrownState.object);
      }
      thrownState.proxyMaterial?.dispose();
    } else if (thrownState.originalParent) {
      thrownState.originalParent.attach(thrownState.object);
      thrownState.object.position.copy(thrownState.originalLocalPosition);
      thrownState.object.quaternion.copy(thrownState.originalLocalQuaternion);
      thrownState.object.scale.copy(thrownState.originalLocalScale);
    } else if (thrownState.object.parent) {
      thrownState.object.parent.remove(thrownState.object);
    }

    if (!thrownState.usingProxy) {
      entry.monster.invalidateHitFlashMaterialCache();
    }

    thrownStates.delete(entry);
    entry.skill2ProjectileActive = false;
  };

  const beginThrow = ({
    entry,
    player,
    gameEnded,
  }: {
    entry: MochiGeneralCombatEntry;
    player: THREE.Object3D;
    gameEnded: boolean;
  }) => {
    if (gameEnded || !entry.monster.isAlive) {
      entry.skill2ProjectileActive = false;
      return;
    }
    if (thrownStates.has(entry)) return;

    resolveHeldMochiOrigin(entry, mochiThrowOriginWorld);
    const heldMochi = entry.rig?.heldMochi;

    let object: THREE.Object3D;
    let usingProxy = false;
    let proxyMaterial: THREE.MeshStandardMaterial | null = null;
    let detachedMaterialOverrides: DetachedMochiMaterialOverride[] = [];
    let originalParent: THREE.Object3D | null = null;
    let originalLocalPosition = new THREE.Vector3();
    let originalLocalQuaternion = new THREE.Quaternion();
    let originalLocalScale = new THREE.Vector3(1, 1, 1);

    if (heldMochi?.parent) {
      originalParent = heldMochi.parent;
      originalLocalPosition = heldMochi.position.clone();
      originalLocalQuaternion = heldMochi.quaternion.clone();
      originalLocalScale = heldMochi.scale.clone();
      scene.attach(heldMochi);
      detachedMaterialOverrides = applyDetachedMochiMaterialOverrides(heldMochi);
      entry.monster.invalidateHitFlashMaterialCache();
      object = heldMochi;
    } else {
      usingProxy = true;
      proxyMaterial = proxyMaterialTemplate.clone();
      const proxyMesh = new THREE.Mesh(proxyGeometry, proxyMaterial);
      proxyMesh.castShadow = false;
      proxyMesh.receiveShadow = false;
      proxyMesh.position.copy(mochiThrowOriginWorld);
      scene.add(proxyMesh);
      object = proxyMesh;
    }

    object.position.copy(mochiThrowOriginWorld);
    spawnThrowFx(mochiThrowOriginWorld, entry.rageActive);
    player.getWorldPosition(mochiThrowTargetWorld);
    mochiThrowTargetWorld.y += SKILL2_PLAYER_HEIGHT_OFFSET;
    mochiThrowDirection.copy(mochiThrowTargetWorld).sub(mochiThrowOriginWorld);
    if (mochiThrowDirection.lengthSq() <= 0.00001) {
      mochiThrowDirection.set(0, 0.1, 1);
    } else {
      mochiThrowDirection.normalize();
    }

    thrownStates.set(entry, {
      entry,
      object,
      usingProxy,
      proxyMaterial,
      detachedMaterialOverrides,
      originalParent,
      originalLocalPosition,
      originalLocalQuaternion,
      originalLocalScale,
      velocity: mochiThrowDirection.clone().multiplyScalar(SKILL2_OUTBOUND_SPEED),
      age: 0,
      returning: false,
      hitPlayer: false,
      trailSpawnCarry: 0,
      rageSkill1BurstTriggerTimes: entry.rageActive
        ? createRageSkill1BurstTriggerTimes()
        : [],
      rageSkill1BurstFiredCount: 0,
      flowTime: Math.random() * Math.PI * 2,
    });
    entry.skill2ProjectileActive = true;
  };

  const updateThrownMochiStates = ({
    delta,
    player,
    applyDamage,
    applyStatusEffect,
    gameEnded,
    spawnSkill1SingleBurst,
  }: {
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    applyStatusEffect: (effect: StatusEffectApplication) => boolean;
    gameEnded: boolean;
    spawnSkill1SingleBurst?: (args: {
      entry: MochiGeneralCombatEntry;
      origin: THREE.Vector3;
      gameEnded: boolean;
    }) => void;
  }) => {
    player.getWorldPosition(playerWorldProbe);
    playerWorldProbe.y += SKILL2_PLAYER_HEIGHT_OFFSET;

    const entries = Array.from(thrownStates.entries());
    for (let i = 0; i < entries.length; i += 1) {
      const [entry, thrownState] = entries[i];
      const objectPosition = thrownState.object.position;

      if (gameEnded || !entry.monster.isAlive) {
        thrownState.returning = true;
      }

      if (!thrownState.returning) {
        thrownState.age += delta;

        mochiVelocityTarget
          .copy(playerWorldProbe)
          .sub(objectPosition);
        if (mochiVelocityTarget.lengthSq() > 0.00001) {
          mochiVelocityTarget
            .normalize()
            .multiplyScalar(SKILL2_OUTBOUND_SPEED);
          thrownState.velocity.lerp(
            mochiVelocityTarget,
            THREE.MathUtils.clamp(SKILL2_OUTBOUND_TURN_RATE * delta, 0, 1)
          );
        }
        objectPosition.addScaledVector(thrownState.velocity, delta);
        updateTrackingFlowFx(thrownState, delta, entry.rageActive);
        spawnMeteorTrailParticles(thrownState, entry, delta);

        emitPendingRageSkill1Bursts({
          thrownState,
          spawnSkill1SingleBurst,
          gameEnded,
          forceAll: false,
        });

        const collisionDistance = SKILL2_PROJECTILE_RADIUS + SKILL2_PLAYER_RADIUS;
        if (
          !thrownState.hitPlayer &&
          objectPosition.distanceToSquared(playerWorldProbe) <=
            collisionDistance * collisionDistance
        ) {
          emitPendingRageSkill1Bursts({
            thrownState,
            spawnSkill1SingleBurst,
            gameEnded,
            forceAll: true,
          });
          thrownState.hitPlayer = true;
          thrownState.returning = true;
          applyDamage(SKILL2_HIT_DAMAGE);
          if (
            applyStatusEffect({
              type: "slow",
              source: "mochiGeneral.skill2",
              tag: "mochiGeneral.skill2.slow",
              durationSec: SKILL2_SLOW_DURATION,
              moveSpeedMultiplier: SKILL2_SLOW_SPEED_MULTIPLIER,
            })
          ) {
            stickyFxIntensity = Math.max(
              stickyFxIntensity,
              entry.rageActive ? SKILL2_RAGE_FX_MULTIPLIER : 1
            );
            stickyFxRemaining = Math.max(stickyFxRemaining, SKILL2_SLOW_DURATION);
            ensureStickyFx(player);
          }
        }

        if (thrownState.age >= SKILL2_OUTBOUND_MAX_DURATION) {
          emitPendingRageSkill1Bursts({
            thrownState,
            spawnSkill1SingleBurst,
            gameEnded,
            forceAll: true,
          });
          thrownState.returning = true;
        }
      }

      if (thrownState.returning) {
        if (thrownState.originalParent) {
          mochiReturnTargetWorld.copy(thrownState.originalLocalPosition);
          thrownState.originalParent.localToWorld(mochiReturnTargetWorld);
        } else {
          mochiReturnTargetWorld.copy(entry.anchor.position);
          mochiReturnTargetWorld.y += 2.2;
        }

        mochiDelta.copy(mochiReturnTargetWorld).sub(objectPosition);
        const remainingDistance = mochiDelta.length();
        if (remainingDistance <= SKILL2_ATTACH_DISTANCE) {
          clearThrownState(entry);
          continue;
        }

        if (remainingDistance > 0.00001) {
          mochiVelocityTarget
            .copy(mochiDelta)
            .normalize()
            .multiplyScalar(SKILL2_RETURN_SPEED);
          thrownState.velocity.lerp(
            mochiVelocityTarget,
            THREE.MathUtils.clamp(SKILL2_RETURN_TURN_RATE * delta, 0, 1)
          );
        }
        objectPosition.addScaledVector(thrownState.velocity, delta);
      }
    }
  };

  const updateStickyDebuffFx = ({
    delta,
  }: {
    delta: number;
  }) => {
    if (stickyFxRemaining > 0) {
      stickyFxRemaining = Math.max(0, stickyFxRemaining - delta);
      updateStickyFx(delta);
      if (stickyFxRemaining <= 0) {
        disposeStickyFx();
      }
    } else if (stickyFxState) {
      disposeStickyFx();
    }
  };

  return {
    onBossTick: ({ entry, player, gameEnded }) => {
      if (!entry.skill2ThrowRequested) return;
      entry.skill2ThrowRequested = false;
      beginThrow({
        entry,
        player,
        gameEnded,
      });
    },
    update: ({
      delta,
      player,
      applyDamage,
      applyStatusEffect,
      gameEnded,
      spawnSkill1SingleBurst,
    }) => {
      updateThrowFx(delta);
      updateMeteorTrailFx(delta);
      updateThrownMochiStates({
        delta,
        player,
        applyDamage,
        applyStatusEffect,
        gameEnded,
        spawnSkill1SingleBurst,
      });
      updateStickyDebuffFx({
        delta,
      });
    },
    onBossRemoved: (entry) => {
      clearThrownState(entry);
    },
    dispose: () => {
      const activeEntries = Array.from(thrownStates.keys());
      for (let i = 0; i < activeEntries.length; i += 1) {
        clearThrownState(activeEntries[i]);
      }
      for (let i = throwFlashParticles.length - 1; i >= 0; i -= 1) {
        removeThrowFlashParticleAt(i);
      }
      for (let i = throwShockwaves.length - 1; i >= 0; i -= 1) {
        removeThrowShockwaveAt(i);
      }
      for (let i = meteorTrailParticles.length - 1; i >= 0; i -= 1) {
        removeMeteorTrailParticleAt(i);
      }
      disposeStickyFx();
      proxyGeometry.dispose();
      proxyMaterialTemplate.dispose();
      stickyBlobGeometry.dispose();
      stickyBlobMaterialTemplate.dispose();
      stickyCoreGeometry.dispose();
      stickyAuraGeometry.dispose();
      stickyCoreMaterialTemplate.dispose();
      stickyAuraMaterialTemplate.dispose();
      throwFlashGeometry.dispose();
      throwFlashMaterialTemplate.dispose();
      throwShockwaveGeometry.dispose();
      throwShockwaveMaterialTemplate.dispose();
      meteorTrailGeometry.dispose();
      meteorTrailWhiteMaterialTemplate.dispose();
      meteorTrailBlackMaterialTemplate.dispose();
      stickyFxRemaining = 0;
      stickyFxIntensity = 1;
    },
  };
};
