import * as THREE from "three";
import type {
  CharacterRuntime,
  FireProjectileArgs,
  SkillKey,
} from "../types";

type CreateCarrotPhantomModifierArgs = {
  avatar: THREE.Object3D;
  fireProjectile?: (args?: FireProjectileArgs) => void;
  applyHealth?: (amount: number) => number;
  applyEnergy?: (amount: number) => number;
};

type PhantomPhase = "idle" | "shallow" | "deep";

export const createCarrotPhantomModifier = ({
  avatar,
  fireProjectile,
  applyHealth,
  applyEnergy,
}: CreateCarrotPhantomModifierArgs) => {
  const phantomConfig = {
    shallowDurationMs: 300,
    deepDurationMs: 3000,
    recoverHp: 15,
    recoverEnergy: 20,
    volleyYawOffsets: [-0.28, -0.14, 0, 0.14, 0.28],
    volleyPitchOffsets: [0.07, 0.03, 0, -0.03, -0.07],
    volleyLaneOffsets: [-0.36, -0.18, 0, 0.18, 0.36],
    projectileSpeed: 19.5,
    projectileLifetime: 1.7,
    projectileDamage: 13,
  };

  const phantomState = {
    phase: "idle" as PhantomPhase,
    endsAt: 0,
  };

  const phantomUp = new THREE.Vector3(0, 1, 0);
  const phantomAvatarQuaternion = new THREE.Quaternion();
  const phantomAvatarPosition = new THREE.Vector3();
  const phantomForward = new THREE.Vector3();
  const phantomRight = new THREE.Vector3();
  const phantomDirection = new THREE.Vector3();
  const phantomShotOrigin = new THREE.Vector3();

  const setPhantomPhase = (phase: PhantomPhase, until = 0) => {
    phantomState.phase = phase;
    phantomState.endsAt = until;
  };

  const endDeepPhantom = (triggerRecovery: boolean) => {
    if (triggerRecovery) {
      applyHealth?.(phantomConfig.recoverHp);
      applyEnergy?.(phantomConfig.recoverEnergy);
    }
    setPhantomPhase("idle", 0);
  };

  const updatePhantomPhase = (now: number) => {
    if (phantomState.phase === "idle") return;
    if (now < phantomState.endsAt) return;
    if (phantomState.phase === "deep") {
      endDeepPhantom(true);
      return;
    }
    setPhantomPhase("idle", 0);
  };

  const enterShallowPhantom = (now: number) => {
    setPhantomPhase("shallow", now + phantomConfig.shallowDurationMs);
  };

  const enterDeepPhantom = (now: number) => {
    setPhantomPhase("deep", now + phantomConfig.deepDurationMs);
  };

  const resolveAvatarForward = () => {
    avatar.updateMatrixWorld(true);
    avatar.getWorldQuaternion(phantomAvatarQuaternion);
    phantomForward.set(0, 0, 1).applyQuaternion(phantomAvatarQuaternion);
    phantomForward.y = 0;
    if (phantomForward.lengthSq() < 0.000001) {
      phantomForward.set(0, 0, 1);
    } else {
      phantomForward.normalize();
    }
    phantomRight.crossVectors(phantomUp, phantomForward);
    if (phantomRight.lengthSq() < 0.000001) {
      phantomRight.set(1, 0, 0);
    } else {
      phantomRight.normalize();
    }
  };

  const fireDeepVolley = () => {
    if (!fireProjectile) return;
    resolveAvatarForward();
    avatar.getWorldPosition(phantomAvatarPosition);

    for (let i = 0; i < 5; i += 1) {
      const yawOffset = phantomConfig.volleyYawOffsets[i] ?? 0;
      const pitchOffset = phantomConfig.volleyPitchOffsets[i] ?? 0;
      const laneOffset = phantomConfig.volleyLaneOffsets[i] ?? 0;

      phantomDirection.copy(phantomForward).applyAxisAngle(phantomUp, yawOffset);
      phantomDirection.addScaledVector(phantomUp, pitchOffset);
      if (phantomDirection.lengthSq() < 0.000001) {
        phantomDirection.copy(phantomForward);
      } else {
        phantomDirection.normalize();
      }

      phantomShotOrigin
        .copy(phantomAvatarPosition)
        .addScaledVector(phantomUp, 1.05)
        .addScaledVector(phantomForward, 0.72)
        .addScaledVector(phantomRight, laneOffset);

      fireProjectile({
        origin: phantomShotOrigin.clone(),
        direction: phantomDirection.clone(),
        speed: phantomConfig.projectileSpeed,
        lifetime: phantomConfig.projectileLifetime,
        color: 0x67e8f9,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.05,
        scale: 0.22,
        radius: 0.12,
        damage: phantomConfig.projectileDamage,
      });
    }
  };

  const isDeepActive = (now: number) =>
    phantomState.phase === "deep" && now < phantomState.endsAt;

  const handleSkillE = () => {
    const now = performance.now();
    updatePhantomPhase(now);
    if (isDeepActive(now)) {
      fireDeepVolley();
      endDeepPhantom(false);
      return true;
    }
    if (phantomState.phase !== "idle") return false;
    enterShallowPhantom(now);
    return true;
  };

  const beforeSkillUse: NonNullable<CharacterRuntime["beforeSkillUse"]> = ({
    key,
    now,
  }: {
    key: SkillKey;
    now: number;
  }) => {
    if (key !== "e") return;
    updatePhantomPhase(now);
    if (!isDeepActive(now)) return;
    return {
      ignoreCooldown: true,
      ignoreResource: true,
      ignoreCostAndCooldown: true,
    };
  };

  const beforeDamage: NonNullable<CharacterRuntime["beforeDamage"]> = ({
    amount,
    now,
  }: {
    amount: number;
    now: number;
  }) => {
    if (amount <= 0) return { amount };
    updatePhantomPhase(now);
    if (phantomState.phase === "shallow") {
      enterDeepPhantom(now);
      return { amount: 0 };
    }
    if (isDeepActive(now)) {
      return { amount: 0 };
    }
    return { amount };
  };

  const onTick: NonNullable<CharacterRuntime["onTick"]> = ({ now }) => {
    updatePhantomPhase(now);
  };

  const reset = () => {
    setPhantomPhase("idle", 0);
  };

  return {
    handleSkillE,
    beforeSkillUse,
    beforeDamage,
    onTick,
    reset,
  };
};

