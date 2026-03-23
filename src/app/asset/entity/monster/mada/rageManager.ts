import * as THREE from "three";

const MADA_RAGE_HEALTH_RATIO_DEFAULT = 0.5;
const MADA_RAGE_SPEED_MULTIPLIER_DEFAULT = 1.1;
const MADA_RAGE_DAMAGE_BONUS_DEFAULT = 5;
const MADA_RAGE_PARTICLE_INTERVAL_MS_DEFAULT = 18;
const MADA_RAGE_PARTICLE_BURST_DEFAULT = 14;
const MADA_RAGE_PARTICLE_LIFE_S_DEFAULT = 1.02;
const MADA_RAGE_PARTICLE_CENTER_Y_OFFSET = 2.45;
const MADA_RAGE_ENTRY_BURST_COUNT = 40;

type MadaRagePhase =
  | "idle"
  | "animPending"
  | "animPlaying"
  | "vanishPending"
  | "awaitReveal"
  | "active";

type MadaRageParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

type MadaRageAnimationBridge = {
  canPlayRage: () => boolean;
  triggerRage: () => number;
  isRagePlaying: () => boolean;
};

type CreateMadaRageManagerArgs = {
  scene: THREE.Scene;
  rig: THREE.Object3D;
  maxHealth: number;
  animation: MadaRageAnimationBridge;
  healthRatio?: number;
  speedMultiplier?: number;
  damageBonus?: number;
  particleIntervalMs?: number;
  particleBurst?: number;
  particleLifeS?: number;
};

const clampPositive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

export const createMadaRageManager = ({
  scene,
  rig,
  maxHealth,
  animation,
  healthRatio = MADA_RAGE_HEALTH_RATIO_DEFAULT,
  speedMultiplier = MADA_RAGE_SPEED_MULTIPLIER_DEFAULT,
  damageBonus = MADA_RAGE_DAMAGE_BONUS_DEFAULT,
  particleIntervalMs = MADA_RAGE_PARTICLE_INTERVAL_MS_DEFAULT,
  particleBurst = MADA_RAGE_PARTICLE_BURST_DEFAULT,
  particleLifeS = MADA_RAGE_PARTICLE_LIFE_S_DEFAULT,
}: CreateMadaRageManagerArgs) => {
  const resolvedHealthRatio = THREE.MathUtils.clamp(healthRatio, 0.01, 1);
  const resolvedSpeedMultiplier = clampPositive(
    speedMultiplier,
    MADA_RAGE_SPEED_MULTIPLIER_DEFAULT
  );
  const resolvedDamageBonus = Number.isFinite(damageBonus)
    ? Math.max(0, damageBonus)
    : MADA_RAGE_DAMAGE_BONUS_DEFAULT;
  const resolvedParticleIntervalMs = clampPositive(
    particleIntervalMs,
    MADA_RAGE_PARTICLE_INTERVAL_MS_DEFAULT
  );
  const resolvedParticleBurst = Math.max(
    1,
    Math.floor(
      Number.isFinite(particleBurst)
        ? particleBurst
        : MADA_RAGE_PARTICLE_BURST_DEFAULT
    )
  );
  const resolvedParticleLifeS = clampPositive(
    particleLifeS,
    MADA_RAGE_PARTICLE_LIFE_S_DEFAULT
  );

  const particleGeometry = new THREE.SphereGeometry(0.095, 8, 7);
  const particles: MadaRageParticle[] = [];
  const particleCenter = new THREE.Vector3();
  const particleOffset = new THREE.Vector3();
  const particleVelocity = new THREE.Vector3();

  let phase: MadaRagePhase = "idle";
  let particleCarryMs = 0;
  let combatNowMs = 0;
  let vanishRequested = false;

  const randomSigned = () => Math.random() * 2 - 1;

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

  const spawnParticles = (count: number) => {
    rig.getWorldPosition(particleCenter);
    particleCenter.y += MADA_RAGE_PARTICLE_CENTER_Y_OFFSET;
    const spawnCount = Math.max(1, Math.floor(count));
    for (let i = 0; i < spawnCount; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xda241a : 0x140607,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: i % 3 === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(particleGeometry, material);
      particleOffset.set(randomSigned(), randomSigned(), randomSigned());
      if (particleOffset.lengthSq() <= 0.0001) {
        particleOffset.set(0.65, 0.38, -0.45);
      }
      particleOffset.normalize();
      mesh.position
        .copy(particleCenter)
        .addScaledVector(particleOffset, 0.3 + Math.random() * 1.55);
      const startScale = 0.7 + Math.random() * 1.75;
      mesh.scale.setScalar(startScale);
      scene.add(mesh);

      particleVelocity
        .copy(particleOffset)
        .multiplyScalar(2.2 + Math.random() * 4.9);
      particleVelocity.y += 1.6 + Math.random() * 3.5;
      particles.push({
        mesh,
        material,
        velocity: particleVelocity.clone(),
        age: 0,
        life: resolvedParticleLifeS * (0.8 + Math.random() * 0.65),
        startScale,
        endScale: 0.04 + Math.random() * 0.1,
      });
    }
  };

  const updateParticles = (delta: number, allowSpawn: boolean) => {
    const safeDelta = Math.max(0, delta);
    const shouldSpawn = phase === "active" && allowSpawn;
    if (shouldSpawn) {
      particleCarryMs += safeDelta * 1000;
      while (particleCarryMs >= resolvedParticleIntervalMs) {
        particleCarryMs -= resolvedParticleIntervalMs;
        spawnParticles(resolvedParticleBurst);
      }
    } else {
      particleCarryMs = 0;
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const entry = particles[i];
      entry.age += safeDelta;
      if (entry.age >= entry.life) {
        removeParticleAt(i);
        continue;
      }
      entry.mesh.position.addScaledVector(entry.velocity, safeDelta);
      entry.velocity.multiplyScalar(Math.max(0, 1 - 2.05 * safeDelta));
      const t = entry.age / entry.life;
      entry.material.opacity = Math.max(0.02, (1 - t) * (1 - t) * 0.92);
      const scale = THREE.MathUtils.lerp(entry.startScale, entry.endScale, t);
      entry.mesh.scale.setScalar(Math.max(0.02, scale));
    }
  };

  const onHealthChanged = (health: number) => {
    if (phase !== "idle") return false;
    if (health > maxHealth * resolvedHealthRatio) return false;
    phase = "animPending";
    vanishRequested = false;
    return true;
  };

  const updateSequence = ({
    allowAnimationTrigger,
    requestVanish,
  }: {
    allowAnimationTrigger: boolean;
    requestVanish: () => void;
  }) => {
    if (phase === "animPending" && allowAnimationTrigger) {
      // Keep waiting until the clip is bound instead of skipping rage animation.
      if (!animation.canPlayRage()) {
        return;
      }
      const duration = animation.triggerRage();
      if (duration > 0) {
        phase = "animPlaying";
      } else {
        phase = "vanishPending";
      }
    }

    if (phase === "animPlaying" && !animation.isRagePlaying()) {
      phase = "vanishPending";
    }

    if (phase === "vanishPending" && !vanishRequested) {
      requestVanish();
      vanishRequested = true;
      phase = "awaitReveal";
    }
  };

  const onReveal = () => {
    if (phase !== "awaitReveal") return false;
    phase = "active";
    vanishRequested = false;
    particleCarryMs = 0;
    spawnParticles(MADA_RAGE_ENTRY_BURST_COUNT);
    return true;
  };

  const advanceCombatTime = (delta: number) => {
    const scaledDelta =
      Math.max(0, delta) * (phase === "active" ? resolvedSpeedMultiplier : 1);
    combatNowMs += scaledDelta * 1000;
    return {
      scaledDelta,
      now: combatNowMs,
    };
  };

  const resolveDamage = (amount: number) => {
    const base = Number.isFinite(amount) ? amount : 0;
    if (phase !== "active" || base <= 0) return base;
    return base + resolvedDamageBonus;
  };

  const shouldIgnoreIncomingDamage = () =>
    phase === "animPending" ||
    phase === "animPlaying" ||
    phase === "vanishPending" ||
    phase === "awaitReveal";

  const blocksSkillStart = () =>
    phase === "animPending" ||
    phase === "animPlaying";

  const reset = () => {
    phase = "idle";
    particleCarryMs = 0;
    combatNowMs = 0;
    vanishRequested = false;
    clearParticles();
  };

  const dispose = () => {
    reset();
    particleGeometry.dispose();
  };

  return {
    reset,
    dispose,
    onHealthChanged,
    onReveal,
    updateSequence,
    updateParticles,
    advanceCombatTime,
    resolveDamage,
    shouldIgnoreIncomingDamage,
    blocksSkillStart,
    isRageActive: () => phase === "active",
    isRagePlaying: () => animation.isRagePlaying(),
  };
};
