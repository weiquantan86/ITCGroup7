import * as THREE from "three";
import type { PlayerWorldTickArgs } from "../../character/general/player";

const MADA_SKILL2_DURING_DURATION_MS = 3000;
const MADA_SKILL2_BEFORE_FALLBACK_MS = 900;
const MADA_SKILL2_AFTER_FALLBACK_MS = 960;
const MADA_SKILL2_AFTER_FINISH_GRACE_MS = 120;
const MADA_SKILL2_PRE_AFTER_FADE_MS = 420;
const MADA_SKILL2_LIFT_HEIGHT = 2.3;
const MADA_SKILL2_CENTER_UP_OFFSET = 0.58;
const MADA_SKILL2_CENTER_FORWARD_OFFSET = 0.72;
const MADA_SKILL2_AOE_RADIUS = 15 * 2.25;
const MADA_SKILL2_AOE_DAMAGE = 10;
const MADA_SKILL2_AOE_DAMAGE_INTERVAL_MS = 300;
const MADA_SKILL2_FLASH_INTERVAL_MS = 80;
const MADA_SKILL2_RING_SPAWN_INTERVAL_MS = 70;
const MADA_SKILL2_RING_SPAWN_INTERVAL_DURING_MS = 120;
const MADA_SKILL2_RING_LIFE_S = 0.95;
const MADA_SKILL2_SHAKE_MAGNITUDE = 0.24;
const MADA_SKILL2_RANGE_BURST_DECAY_PER_S = 11;
const MADA_SKILL2_INNER_FLOW_RED_SPEED = 24;
const MADA_SKILL2_INNER_FLOW_BLACK_SPEED = 31;
const MADA_SKILL2_SHARD_COUNT_PER_FLASH = 24;

type MadaSkill2AnimationBridge = {
  triggerSkill2Before: () => number;
  triggerSkill2During: () => number;
  triggerSkill2After: () => number;
  isSkill2AfterPlaying: () => boolean;
  getBodyWorldPosition: (target: THREE.Vector3) => boolean;
};

type TickArgs = {
  now: number;
  delta: number;
  rig: THREE.Object3D;
  player: PlayerWorldTickArgs["player"];
  applyDamage: PlayerWorldTickArgs["applyDamage"];
};

type ConvergeRing = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  isBlack: boolean;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  spinAxis: THREE.Vector3;
  spinSpeed: number;
};

type ExplosionPulse = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

type ExplosionShard = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const easeOutCubic = (value: number) => 1 - (1 - clamp01(value)) ** 3;
const easeInCubic = (value: number) => clamp01(value) ** 3;
const randomSigned = () => Math.random() * 2 - 1;

const centerProbe = new THREE.Vector3();
const rigForwardProbe = new THREE.Vector3();
const rigQuaternionProbe = new THREE.Quaternion();
const playerProbe = new THREE.Vector3();
const shardSpawnOffset = new THREE.Vector3();
const shardVelocity = new THREE.Vector3();
const shardAngularVelocity = new THREE.Vector3();

export const createMadaSkill2Runtime = ({
  scene,
  animation,
}: {
  scene: THREE.Scene;
  animation: MadaSkill2AnimationBridge;
}) => {
  const ringGeometry = new THREE.TorusGeometry(1, 0.08, 10, 40);
  const pulseGeometry = new THREE.RingGeometry(0.84, 1, 52);
  const shardGeometry = new THREE.IcosahedronGeometry(0.18, 0);
  const coreGeometry = new THREE.SphereGeometry(0.4, 14, 12);
  const auraGeometry = new THREE.IcosahedronGeometry(0.9, 1);
  const areaSphereGeometry = new THREE.SphereGeometry(1, 18, 16);
  const areaRingGeometry = new THREE.RingGeometry(0.88, 1, 56);
  const innerFlowGeometry = new THREE.RingGeometry(0.26, 1, 72);

  const coreRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff2a1e,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const coreBlackMaterial = new THREE.MeshBasicMaterial({
    color: 0x0f0709,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const auraMaterial = new THREE.MeshBasicMaterial({
    color: 0xb21114,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    wireframe: true,
  });

  const areaShellRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3222,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    wireframe: true,
  });
  const areaShellBlackMaterial = new THREE.MeshBasicMaterial({
    color: 0x0f0507,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    blending: THREE.NormalBlending,
    wireframe: true,
  });
  const areaRingRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3524,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const areaRingBlackMaterial = new THREE.MeshBasicMaterial({
    color: 0x100608,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
  const innerFlowRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3120,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const innerFlowBlackMaterial = new THREE.MeshBasicMaterial({
    color: 0x100607,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });

  const coreRedMesh = new THREE.Mesh(coreGeometry, coreRedMaterial);
  const coreBlackMesh = new THREE.Mesh(coreGeometry, coreBlackMaterial);
  const auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
  const areaShellRedMesh = new THREE.Mesh(areaSphereGeometry, areaShellRedMaterial);
  const areaShellBlackMesh = new THREE.Mesh(
    areaSphereGeometry,
    areaShellBlackMaterial
  );
  const areaRingRedMesh = new THREE.Mesh(areaRingGeometry, areaRingRedMaterial);
  const areaRingBlackMesh = new THREE.Mesh(areaRingGeometry, areaRingBlackMaterial);
  const innerFlowRedMesh = new THREE.Mesh(innerFlowGeometry, innerFlowRedMaterial);
  const innerFlowBlackMesh = new THREE.Mesh(innerFlowGeometry, innerFlowBlackMaterial);

  coreBlackMesh.scale.setScalar(1.28);
  areaRingRedMesh.rotation.x = -Math.PI * 0.5;
  areaRingBlackMesh.rotation.x = -Math.PI * 0.5;
  innerFlowRedMesh.rotation.x = -Math.PI * 0.5;
  innerFlowBlackMesh.rotation.x = -Math.PI * 0.5;
  innerFlowRedMesh.position.y = -1.34;
  innerFlowBlackMesh.position.y = -1.34;

  const fxGroup = new THREE.Group();
  fxGroup.visible = false;
  fxGroup.add(
    areaShellBlackMesh,
    areaShellRedMesh,
    areaRingBlackMesh,
    areaRingRedMesh,
    innerFlowBlackMesh,
    innerFlowRedMesh,
    coreBlackMesh,
    coreRedMesh,
    auraMesh
  );
  scene.add(fxGroup);

  const rings: ConvergeRing[] = [];
  const pulses: ExplosionPulse[] = [];
  const shards: ExplosionShard[] = [];

  let phase: "idle" | "before" | "during" | "after" = "idle";
  let beforeStartedAt = 0;
  let beforeEndsAt = 0;
  let duringStartedAt = 0;
  let duringEndsAt = 0;
  let afterStartedAt = 0;
  let afterEndsAt = 0;
  let nextDamageTickAt = 0;
  let nextFlashAt = 0;
  let ringSpawnCarryMs = 0;
  let ringSpawnSerial = 0;
  let rangeBurstStrength = 0;
  let castBaseY = 0;
  let activeRig: THREE.Object3D | null = null;
  const currentShakeOffset = new THREE.Vector3();

  const removeRingAt = (index: number) => {
    const ring = rings[index];
    if (!ring) return;
    ring.mesh.removeFromParent();
    ring.material.dispose();
    rings.splice(index, 1);
  };

  const clearRings = () => {
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      removeRingAt(i);
    }
  };

  const removePulseAt = (index: number) => {
    const pulse = pulses[index];
    if (!pulse) return;
    pulse.mesh.removeFromParent();
    pulse.material.dispose();
    pulses.splice(index, 1);
  };

  const clearPulses = () => {
    for (let i = pulses.length - 1; i >= 0; i -= 1) {
      removePulseAt(i);
    }
  };

  const removeShardAt = (index: number) => {
    const shard = shards[index];
    if (!shard) return;
    shard.mesh.removeFromParent();
    shard.material.dispose();
    shards.splice(index, 1);
  };

  const clearShards = () => {
    for (let i = shards.length - 1; i >= 0; i -= 1) {
      removeShardAt(i);
    }
  };

  const resolveCenter = (rig: THREE.Object3D) => {
    if (!animation.getBodyWorldPosition(centerProbe)) {
      rig.getWorldPosition(centerProbe);
      centerProbe.y += 1.65;
    }

    rig.getWorldQuaternion(rigQuaternionProbe);
    rigForwardProbe.set(0, 0, 1).applyQuaternion(rigQuaternionProbe);
    rigForwardProbe.y = 0;
    if (rigForwardProbe.lengthSq() <= 0.000001) {
      rigForwardProbe.set(0, 0, 1);
    } else {
      rigForwardProbe.normalize();
    }

    centerProbe.y += MADA_SKILL2_CENTER_UP_OFFSET;
    centerProbe.addScaledVector(rigForwardProbe, MADA_SKILL2_CENTER_FORWARD_OFFSET);
    return centerProbe;
  };

  const clearRigShake = (rig: THREE.Object3D) => {
    if (currentShakeOffset.lengthSq() <= 0.0000001) return;
    rig.position.sub(currentShakeOffset);
    currentShakeOffset.set(0, 0, 0);
  };

  const spawnConvergeRing = (center: THREE.Vector3, fromDuring: boolean) => {
    const isBlack = ringSpawnSerial % 2 === 0;
    ringSpawnSerial += 1;

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: isBlack ? 0x090304 : 0xff2c1f,
      transparent: true,
      opacity: isBlack
        ? fromDuring
          ? 0.82
          : 0.9
        : fromDuring
          ? 0.64
          : 0.76,
      depthWrite: false,
      blending: isBlack ? THREE.NormalBlending : THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.position.copy(center);
    ringMesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    const startScale = fromDuring
      ? 1.5 + Math.random() * 1.6
      : 2.8 + Math.random() * 3;
    ringMesh.scale.setScalar(startScale);
    scene.add(ringMesh);

    const spinAxis = new THREE.Vector3(randomSigned(), randomSigned(), randomSigned());
    if (spinAxis.lengthSq() <= 0.0001) {
      spinAxis.set(0, 1, 0);
    } else {
      spinAxis.normalize();
    }

    rings.push({
      mesh: ringMesh,
      material: ringMaterial,
      isBlack,
      life: 0,
      maxLife: MADA_SKILL2_RING_LIFE_S * (0.85 + Math.random() * 0.45),
      startScale,
      endScale: 0.18 + Math.random() * 0.28,
      spinAxis,
      spinSpeed: (2 + Math.random() * 3.6) * (Math.random() < 0.5 ? -1 : 1),
    });
  };

  const updateConvergeRings = (
    delta: number,
    center: THREE.Vector3,
    fadeMultiplier = 1
  ) => {
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const ring = rings[i];
      ring.life += delta;
      const t = ring.life / ring.maxLife;
      if (t >= 1) {
        removeRingAt(i);
        continue;
      }
      const eased = easeOutCubic(t);
      ring.mesh.position.copy(center);
      const scale = THREE.MathUtils.lerp(ring.startScale, ring.endScale, eased);
      ring.mesh.scale.setScalar(scale);
      ring.mesh.rotateOnAxis(ring.spinAxis, ring.spinSpeed * delta);
      const baseOpacity = ring.isBlack ? 0.92 : 0.8;
      const minOpacity = ring.isBlack ? 0.06 : 0.02;
      ring.material.opacity = Math.max(
        minOpacity,
        baseOpacity * (1 - t) * (1 - t) * fadeMultiplier
      );
    }
  };

  const spawnExplosionPulse = (
    darkPhase: boolean,
    scaleMultiplier = 1,
    lifeMultiplier = 1,
    yJitter = 0.04
  ) => {
    const material = new THREE.MeshBasicMaterial({
      color: darkPhase ? 0x130708 : 0xff2d1f,
      transparent: true,
      opacity: darkPhase ? 0.42 : 0.64,
      depthWrite: false,
      blending: darkPhase ? THREE.NormalBlending : THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(pulseGeometry, material);
    mesh.rotation.x = -Math.PI * 0.5;
    mesh.position.set(
      randomSigned() * 0.35 * scaleMultiplier,
      -1.35 + randomSigned() * yJitter,
      randomSigned() * 0.35 * scaleMultiplier
    );
    const startScale = (2.2 + Math.random() * 1.1) * scaleMultiplier;
    mesh.scale.setScalar(startScale);
    fxGroup.add(mesh);
    pulses.push({
      mesh,
      material,
      age: 0,
      life: (0.24 + Math.random() * 0.2) * lifeMultiplier,
      startScale,
      endScale:
        MADA_SKILL2_AOE_RADIUS *
        (1.05 + Math.random() * 0.28) *
        scaleMultiplier,
    });
  };

  const spawnExplosionShards = (darkPhase: boolean) => {
    for (let i = 0; i < MADA_SKILL2_SHARD_COUNT_PER_FLASH; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: darkPhase
          ? i % 2 === 0
            ? 0x0a0405
            : 0x5f1011
          : i % 2 === 0
            ? 0xff3b2b
            : 0x18090a,
        transparent: true,
        opacity: darkPhase ? 0.78 : 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(shardGeometry, material);
      shardSpawnOffset.set(randomSigned(), randomSigned(), randomSigned());
      if (shardSpawnOffset.lengthSq() <= 0.0001) {
        shardSpawnOffset.set(0.7, 0.4, -0.45);
      }
      shardSpawnOffset.normalize();
      const spawnRadius = 0.4 + Math.random() * 1.2;
      mesh.position.copy(shardSpawnOffset).multiplyScalar(spawnRadius);
      mesh.position.y += -1.3 + randomSigned() * 0.16;
      const startScale = 0.35 + Math.random() * 0.7;
      mesh.scale.setScalar(startScale);
      fxGroup.add(mesh);

      shardVelocity
        .copy(shardSpawnOffset)
        .multiplyScalar(8.5 + Math.random() * 14.5);
      shardVelocity.y += 0.45 + Math.random() * 3.8;
      shardAngularVelocity.set(
        randomSigned() * 10.5,
        randomSigned() * 12.5,
        randomSigned() * 10.5
      );

      shards.push({
        mesh,
        material,
        velocity: shardVelocity.clone(),
        angularVelocity: shardAngularVelocity.clone(),
        age: 0,
        life: 0.16 + Math.random() * 0.24,
        startScale,
        endScale: 0.02 + Math.random() * 0.06,
      });
    }
  };

  const updateExplosionPulses = (delta: number, fadeMultiplier = 1) => {
    for (let i = pulses.length - 1; i >= 0; i -= 1) {
      const pulse = pulses[i];
      pulse.age += delta;
      const t = pulse.age / pulse.life;
      if (t >= 1) {
        removePulseAt(i);
        continue;
      }
      const scale = THREE.MathUtils.lerp(pulse.startScale, pulse.endScale, easeOutCubic(t));
      pulse.mesh.scale.setScalar(scale);
      pulse.material.opacity = Math.max(
        0.01,
        (1 - t) * (1 - t) * 0.72 * fadeMultiplier
      );
    }
  };

  const updateExplosionShards = (delta: number, fadeMultiplier = 1) => {
    for (let i = shards.length - 1; i >= 0; i -= 1) {
      const shard = shards[i];
      shard.age += delta;
      if (shard.age >= shard.life) {
        removeShardAt(i);
        continue;
      }
      const t = shard.age / shard.life;
      const inv = 1 - t;
      shard.mesh.position.addScaledVector(shard.velocity, delta);
      shard.velocity.multiplyScalar(Math.max(0, 1 - 1.6 * delta));
      shard.mesh.rotation.x += shard.angularVelocity.x * delta;
      shard.mesh.rotation.y += shard.angularVelocity.y * delta;
      shard.mesh.rotation.z += shard.angularVelocity.z * delta;
      const scale = THREE.MathUtils.lerp(shard.startScale, shard.endScale, t);
      shard.mesh.scale.setScalar(Math.max(0.02, scale));
      shard.material.opacity = Math.max(0.02, inv * inv * 0.94 * fadeMultiplier);
    }
  };

  const applyRigLiftAndShake = (now: number, rig: THREE.Object3D) => {
    clearRigShake(rig);
    if (phase === "idle") return;

    let lift = 0;
    if (phase === "before") {
      const progress = (now - beforeStartedAt) / Math.max(1, beforeEndsAt - beforeStartedAt);
      lift = easeOutCubic(progress) * MADA_SKILL2_LIFT_HEIGHT;
    } else if (phase === "during") {
      lift = MADA_SKILL2_LIFT_HEIGHT;
    } else if (phase === "after") {
      const progress = (now - afterStartedAt) / Math.max(1, afterEndsAt - afterStartedAt);
      lift = (1 - easeInCubic(progress)) * MADA_SKILL2_LIFT_HEIGHT;
    }

    rig.position.y = castBaseY + lift;

    if (phase === "during") {
      const phaseProgress = clamp01(
        (now - duringStartedAt) / Math.max(1, duringEndsAt - duringStartedAt)
      );
      const shakeAmp = MADA_SKILL2_SHAKE_MAGNITUDE * Math.pow(1 - phaseProgress, 1.05);
      const t = now * 0.001;
      currentShakeOffset.set(
        (Math.sin(t * 73.4 + 0.8) + Math.cos(t * 121.1 + 0.5) * 0.5) * shakeAmp,
        (Math.sin(t * 97.2 + 1.2) + Math.cos(t * 157.7 + 0.2) * 0.35) * shakeAmp * 0.62,
        (Math.cos(t * 83.9 + 1.7) + Math.sin(t * 134.8 + 0.8) * 0.45) * shakeAmp
      );
      rig.position.add(currentShakeOffset);
    }
  };

  const updateAreaVisuals = (
    now: number,
    delta: number,
    center: THREE.Vector3,
    fadeMultiplier = 1
  ) => {
    const duringElapsed = Math.max(0, now - duringStartedAt);
    const darkPhase =
      Math.floor(duringElapsed / Math.max(1, MADA_SKILL2_FLASH_INTERVAL_MS)) % 2 === 1;

    while (
      now >= nextFlashAt &&
      nextFlashAt < duringEndsAt - MADA_SKILL2_PRE_AFTER_FADE_MS
    ) {
      // Layered pulses: main ring + inverse-color outer shock + dense inner burst.
      spawnExplosionPulse(darkPhase, 1, 1, 0.05);
      spawnExplosionPulse(!darkPhase, 1.26, 0.9, 0.08);
      spawnExplosionPulse(darkPhase, 0.82, 0.72, 0.03);
      spawnExplosionShards(darkPhase);
      nextFlashAt += MADA_SKILL2_FLASH_INTERVAL_MS;
      rangeBurstStrength = 1;
    }
    rangeBurstStrength = Math.max(
      0,
      rangeBurstStrength -
        Math.max(0, delta) * MADA_SKILL2_RANGE_BURST_DECAY_PER_S
    );
    const burst = rangeBurstStrength * fadeMultiplier;

    const pulse = 1 + Math.sin(now * 0.02) * 0.06;
    const pulseAlt = 1 + Math.cos(now * 0.017 + 0.8) * 0.08;
    areaShellRedMesh.scale.setScalar(MADA_SKILL2_AOE_RADIUS * pulse);
    areaShellBlackMesh.scale.setScalar(MADA_SKILL2_AOE_RADIUS * (0.96 + (pulseAlt - 1) * 0.5));
    areaRingRedMesh.scale.setScalar(MADA_SKILL2_AOE_RADIUS * (0.98 + (pulse - 1) * 0.8));
    areaRingBlackMesh.scale.setScalar(MADA_SKILL2_AOE_RADIUS * (0.92 + (pulseAlt - 1) * 0.7));

    if (darkPhase) {
      areaShellRedMaterial.opacity = 0.09 * burst;
      areaShellBlackMaterial.opacity = 0.64 * burst;
      areaRingRedMaterial.opacity = 0.14 * burst;
      areaRingBlackMaterial.opacity = 0.8 * burst;
      areaShellRedMaterial.color.setHex(0x9b1410);
      areaShellBlackMaterial.color.setHex(0x050203);
    } else {
      areaShellRedMaterial.opacity = 0.78 * burst;
      areaShellBlackMaterial.opacity = 0.07 * burst;
      areaRingRedMaterial.opacity = 0.92 * burst;
      areaRingBlackMaterial.opacity = 0.12 * burst;
      areaShellRedMaterial.color.setHex(0xff4a35);
      areaShellBlackMaterial.color.setHex(0x2a0f11);
    }

    areaRingRedMaterial.color.setHex(darkPhase ? 0x9f1713 : 0xff4a32);
    areaRingBlackMaterial.color.setHex(darkPhase ? 0x060304 : 0x2a1012);

    // Fast-moving black/red flow inside the net area
    const flowT = now * 0.001;
    innerFlowRedMesh.rotation.z += Math.max(0, delta) * MADA_SKILL2_INNER_FLOW_RED_SPEED;
    innerFlowBlackMesh.rotation.z -= Math.max(0, delta) * MADA_SKILL2_INNER_FLOW_BLACK_SPEED;
    innerFlowRedMesh.scale.setScalar(
      MADA_SKILL2_AOE_RADIUS * (0.62 + Math.sin(flowT * 17.5 + 0.6) * 0.2)
    );
    innerFlowBlackMesh.scale.setScalar(
      MADA_SKILL2_AOE_RADIUS * (0.48 + Math.cos(flowT * 21.7 + 1.2) * 0.18)
    );
    if (darkPhase) {
      innerFlowRedMaterial.opacity = 0.16 * burst;
      innerFlowBlackMaterial.opacity = 0.86 * burst;
      innerFlowRedMaterial.color.setHex(0xca1d15);
      innerFlowBlackMaterial.color.setHex(0x040203);
    } else {
      innerFlowRedMaterial.opacity = 0.95 * burst;
      innerFlowBlackMaterial.opacity = 0.12 * burst;
      innerFlowRedMaterial.color.setHex(0xff4a32);
      innerFlowBlackMaterial.color.setHex(0x210d0f);
    }
  };

  const updateCoreVisuals = (
    now: number,
    delta: number,
    center: THREE.Vector3,
    fadeMultiplier = 1
  ) => {
    fxGroup.position.copy(center);
    const pulse = 1 + Math.sin(now * 0.015) * 0.26;
    const pulseAlt = 1 + Math.cos(now * 0.012 + 0.6) * 0.22;
    coreRedMesh.scale.setScalar(0.96 * pulse);
    coreBlackMesh.scale.setScalar(1.28 * pulseAlt);
    auraMesh.scale.setScalar(1.1 + Math.sin(now * 0.011 + 1.2) * 0.1);
    auraMesh.rotation.x += 0.9 * Math.max(0, delta);
    auraMesh.rotation.y -= 1.3 * Math.max(0, delta);
    auraMesh.rotation.z += 1.1 * Math.max(0, delta);
    coreRedMaterial.opacity = (0.56 + (pulse - 1) * 0.5) * fadeMultiplier;
    coreBlackMaterial.opacity = (0.44 + (pulseAlt - 1) * 0.34) * fadeMultiplier;
    const auraBase = phase === "during" ? 0.42 : 0.28;
    auraMaterial.opacity = auraBase * fadeMultiplier;
  };

  const updateDamage = (
    now: number,
    center: THREE.Vector3,
    player: THREE.Object3D,
    applyDamage: TickArgs["applyDamage"]
  ) => {
    while (now >= nextDamageTickAt && nextDamageTickAt < duringEndsAt) {
      player.getWorldPosition(playerProbe);
      const dx = playerProbe.x - center.x;
      const dz = playerProbe.z - center.z;
      if (dx * dx + dz * dz <= MADA_SKILL2_AOE_RADIUS * MADA_SKILL2_AOE_RADIUS) {
        applyDamage(MADA_SKILL2_AOE_DAMAGE);
      }
      nextDamageTickAt += MADA_SKILL2_AOE_DAMAGE_INTERVAL_MS;
    }
  };

  const resolveDuringCenterFadeMultiplier = (now: number) => {
    if (phase !== "during") return 1;
    const fadeStartAt = duringEndsAt - MADA_SKILL2_PRE_AFTER_FADE_MS;
    if (now <= fadeStartAt) return 1;
    return clamp01((duringEndsAt - now) / Math.max(1, MADA_SKILL2_PRE_AFTER_FADE_MS));
  };

  const switchToDuring = (now: number) => {
    animation.triggerSkill2During();
    phase = "during";
    duringStartedAt = now;
    duringEndsAt = now + MADA_SKILL2_DURING_DURATION_MS;
    nextDamageTickAt = now + MADA_SKILL2_AOE_DAMAGE_INTERVAL_MS;
    nextFlashAt = now;
    ringSpawnCarryMs = 0;
    rangeBurstStrength = 0;
  };

  const switchToAfter = (now: number) => {
    const afterDurationS = animation.triggerSkill2After();
    phase = "after";
    afterStartedAt = now;
    rangeBurstStrength = 0;
    clearPulses();
    clearShards();
    afterEndsAt =
      now +
      Math.max(
        MADA_SKILL2_AFTER_FALLBACK_MS,
        afterDurationS * 1000 + MADA_SKILL2_AFTER_FINISH_GRACE_MS
      );
  };

  const finishCast = () => {
    phase = "idle";
    if (activeRig) {
      clearRigShake(activeRig);
      activeRig.position.y = castBaseY;
    }
    fxGroup.visible = false;
    clearRings();
    clearPulses();
    clearShards();
    ringSpawnCarryMs = 0;
    ringSpawnSerial = 0;
    rangeBurstStrength = 0;
    areaShellRedMaterial.opacity = 0;
    areaShellBlackMaterial.opacity = 0;
    areaRingRedMaterial.opacity = 0;
    areaRingBlackMaterial.opacity = 0;
    innerFlowRedMaterial.opacity = 0;
    innerFlowBlackMaterial.opacity = 0;
  };

  return {
    beginCast: (now: number, rig: THREE.Object3D) => {
      activeRig = rig;
      clearRigShake(rig);
      castBaseY = rig.position.y;
      clearRings();
      clearPulses();
      clearShards();
      fxGroup.visible = true;
      ringSpawnCarryMs = 0;
      ringSpawnSerial = 0;
      rangeBurstStrength = 0;

      const beforeDurationS = animation.triggerSkill2Before();
      if (beforeDurationS > 0) {
        phase = "before";
        beforeStartedAt = now;
        beforeEndsAt =
          now + Math.max(MADA_SKILL2_BEFORE_FALLBACK_MS, beforeDurationS * 1000);
        return true;
      }

      const duringDurationS = animation.triggerSkill2During();
      if (duringDurationS <= 0) {
        finishCast();
        return false;
      }
      phase = "during";
      duringStartedAt = now;
      duringEndsAt = now + MADA_SKILL2_DURING_DURATION_MS;
      nextDamageTickAt = now + MADA_SKILL2_AOE_DAMAGE_INTERVAL_MS;
      nextFlashAt = now;
      return true;
    },
    isCasting: () => phase !== "idle",
    tick: ({ now, delta, rig, player, applyDamage }: TickArgs) => {
      if (phase === "idle") {
        return;
      }
      activeRig = rig;

      if (phase === "before" && now >= beforeEndsAt) {
        switchToDuring(now);
      }
      if (phase === "during" && now >= duringEndsAt) {
        switchToAfter(now);
      }
      if (phase === "after" && now >= afterEndsAt && !animation.isSkill2AfterPlaying()) {
        finishCast();
        return;
      }

      applyRigLiftAndShake(now, rig);
      rig.updateMatrixWorld(true);
      const center = resolveCenter(rig);
      const centerFadeMultiplier =
        phase === "during"
          ? resolveDuringCenterFadeMultiplier(now)
          : phase === "before"
            ? 1
            : 0;
      fxGroup.visible = true;
      updateCoreVisuals(now, delta, center, centerFadeMultiplier);

      if (phase === "before" || phase === "during") {
        const allowRingSpawn =
          phase === "before" ||
          (phase === "during" &&
            now < duringEndsAt - MADA_SKILL2_PRE_AFTER_FADE_MS);
        if (allowRingSpawn) {
          ringSpawnCarryMs += Math.max(0, delta) * 1000;
          const spawnInterval =
            phase === "before"
              ? MADA_SKILL2_RING_SPAWN_INTERVAL_MS
              : MADA_SKILL2_RING_SPAWN_INTERVAL_DURING_MS;
          while (ringSpawnCarryMs >= spawnInterval) {
            ringSpawnCarryMs -= spawnInterval;
            spawnConvergeRing(center, phase === "during");
          }
        }
      }

      if (phase === "during") {
        updateAreaVisuals(now, delta, center, centerFadeMultiplier);
        updateDamage(now, center, player, applyDamage);
      } else if (phase === "before") {
        areaShellRedMaterial.opacity = 0;
        areaShellBlackMaterial.opacity = 0;
        areaRingRedMaterial.opacity = 0;
        areaRingBlackMaterial.opacity = 0;
        innerFlowRedMaterial.opacity = 0;
        innerFlowBlackMaterial.opacity = 0;
      } else if (phase === "after") {
        const fade = clamp01(
          (afterEndsAt - now) / Math.max(1, afterEndsAt - afterStartedAt)
        );
        areaShellRedMaterial.opacity = 0.12 * fade * rangeBurstStrength;
        areaShellBlackMaterial.opacity = 0.08 * fade * rangeBurstStrength;
        areaRingRedMaterial.opacity = 0.16 * fade * rangeBurstStrength;
        areaRingBlackMaterial.opacity = 0.1 * fade * rangeBurstStrength;
        innerFlowRedMaterial.opacity = 0.1 * fade * rangeBurstStrength;
        innerFlowBlackMaterial.opacity = 0.08 * fade * rangeBurstStrength;
      }

      updateConvergeRings(Math.max(0, delta), center, centerFadeMultiplier);
      updateExplosionPulses(Math.max(0, delta), centerFadeMultiplier);
      updateExplosionShards(Math.max(0, delta), centerFadeMultiplier);
    },
    reset: () => {
      if (activeRig) {
        clearRigShake(activeRig);
        activeRig.position.y = castBaseY;
      }
      activeRig = null;
      phase = "idle";
      beforeStartedAt = 0;
      beforeEndsAt = 0;
      duringStartedAt = 0;
      duringEndsAt = 0;
      afterStartedAt = 0;
      afterEndsAt = 0;
      nextDamageTickAt = 0;
      nextFlashAt = 0;
      ringSpawnCarryMs = 0;
      ringSpawnSerial = 0;
      rangeBurstStrength = 0;
      fxGroup.visible = false;
      clearRings();
      clearPulses();
      clearShards();
    },
    dispose: () => {
      if (activeRig) {
        clearRigShake(activeRig);
      }
      clearRings();
      clearPulses();
      clearShards();
      fxGroup.removeFromParent();
      ringGeometry.dispose();
      pulseGeometry.dispose();
      shardGeometry.dispose();
      coreGeometry.dispose();
      auraGeometry.dispose();
      areaSphereGeometry.dispose();
      areaRingGeometry.dispose();
      innerFlowGeometry.dispose();
      coreRedMaterial.dispose();
      coreBlackMaterial.dispose();
      auraMaterial.dispose();
      areaShellRedMaterial.dispose();
      areaShellBlackMaterial.dispose();
      areaRingRedMaterial.dispose();
      areaRingBlackMaterial.dispose();
      innerFlowRedMaterial.dispose();
      innerFlowBlackMaterial.dispose();
    },
  };
};
