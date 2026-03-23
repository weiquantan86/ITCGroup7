import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  PlayerAttackTarget,
  PlayerWorldTickArgs,
} from "../../character/general/player";
import {
  createMadaPresentationController,
  type MadaPresentationState,
} from "../mada/presentation";
import { createMadaAnimationController } from "../mada/animation";
import { normalizeModelToHeight, removeAttackTargetById } from "./runtimeUtils";
import type {
  UnifiedMonsterRuntime,
  UnifiedMonsterRuntimeHost,
  UnifiedMonsterState,
} from "./types";

const MADA_MAX_HEALTH = 2800;
const MADA_RESPAWN_DELAY_MS = 1800;
const MADA_SKILL1_WINDUP_DURATION_MS = 560;
const MADA_SKILL1_STRIKE_DURATION_MS = 260;
const MADA_SKILL1_RECOVER_DURATION_MS = 540;
const MADA_SKILL1_DURATION_MS =
  MADA_SKILL1_WINDUP_DURATION_MS +
  MADA_SKILL1_STRIKE_DURATION_MS +
  MADA_SKILL1_RECOVER_DURATION_MS;
const MADA_SKILL1_COOLDOWN_MS = 3200;
const MADA_SKILL1_TRIGGER_RANGE = 11.5;
const MADA_SKILL1_DAMAGE_RANGE = 6.5;
const MADA_SKILL1_DAMAGE = 22;

const normalizePositiveMultiplier = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const createMadaUnifiedRuntime = (
  host: UnifiedMonsterRuntimeHost
): UnifiedMonsterRuntime => {
  const {
    hostGroup,
    resourceTracker,
    spawnPosition,
    attackTargets,
    monster,
    runtimeOptions,
  } = host;
  const allowRespawn = runtimeOptions?.respawnOnDefeat !== false;
  const isGameEnded = runtimeOptions?.isGameEnded ?? (() => false);
  const madaConfig = runtimeOptions?.mada;
  const healthMultiplier = normalizePositiveMultiplier(
    madaConfig?.healthMultiplier,
    1
  );
  const damageMultiplier = normalizePositiveMultiplier(
    madaConfig?.damageMultiplier,
    1
  );
  const tempoMultiplier = normalizePositiveMultiplier(
    madaConfig?.tempoMultiplier,
    1
  );
  const triggerRangeMultiplier = normalizePositiveMultiplier(
    madaConfig?.triggerRangeMultiplier,
    1
  );
  const strikeRangeMultiplier = normalizePositiveMultiplier(
    madaConfig?.strikeRangeMultiplier,
    1
  );
  const resolvedMaxHealth = Math.max(
    1,
    Math.floor(MADA_MAX_HEALTH * healthMultiplier)
  );
  const resolvedSkill1WindupDurationMs = Math.max(
    80,
    MADA_SKILL1_WINDUP_DURATION_MS / tempoMultiplier
  );
  const resolvedSkill1StrikeDurationMs = Math.max(
    80,
    MADA_SKILL1_STRIKE_DURATION_MS / tempoMultiplier
  );
  const resolvedSkill1RecoverDurationMs = Math.max(
    120,
    MADA_SKILL1_RECOVER_DURATION_MS / tempoMultiplier
  );
  const resolvedSkill1DurationMs =
    resolvedSkill1WindupDurationMs +
    resolvedSkill1StrikeDurationMs +
    resolvedSkill1RecoverDurationMs;
  const resolvedSkill1CooldownMs = Math.max(
    250,
    MADA_SKILL1_COOLDOWN_MS / tempoMultiplier
  );
  const resolvedSkill1TriggerRange =
    MADA_SKILL1_TRIGGER_RANGE * triggerRangeMultiplier;
  const resolvedSkill1DamageRange =
    MADA_SKILL1_DAMAGE_RANGE * strikeRangeMultiplier;
  const resolvedSkill1Damage = Math.max(
    1,
    Math.floor(MADA_SKILL1_DAMAGE * damageMultiplier)
  );

  const runtimeGroup = new THREE.Group();
  runtimeGroup.name = "unified-mada-runtime";
  hostGroup.add(runtimeGroup);

  const madaRig = new THREE.Group();
  madaRig.position.copy(spawnPosition);
  madaRig.name = "unified-mada-rig";
  runtimeGroup.add(madaRig);

  const modelRoot = new THREE.Group();
  modelRoot.name = "unified-mada-model-root";
  madaRig.add(modelRoot);

  const fallbackBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.2, 2.6, 6, 12),
    new THREE.MeshStandardMaterial({
      color: 0x352930,
      roughness: 0.72,
      metalness: 0.08,
    })
  );
  fallbackBody.position.y = 2.5;
  modelRoot.add(fallbackBody);
  resourceTracker.trackMesh(fallbackBody);

  const hitbox = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.25, 2.9, 6, 14),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  hitbox.position.y = 2.5;
  madaRig.add(hitbox);
  resourceTracker.trackMesh(hitbox);

  const madaPresentation = createMadaPresentationController({
    rig: madaRig,
    modelRoot,
  });
  const madaAnimation = createMadaAnimationController({
    rig: madaRig,
  });

  const toTarget = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let health = resolvedMaxHealth;
  let respawnAt = 0;
  let skillStartedAt = -1;
  let skillNextAvailableAt = performance.now() + 700 / tempoMultiplier;
  let skillDamageApplied = false;

  const applyPresentationState = (state: MadaPresentationState) => {
    madaPresentation.applyState(state);
  };

  applyPresentationState({ mode: "active", fadeAlpha: 1 });

  const resetSkillState = (now: number) => {
    skillStartedAt = -1;
    skillNextAvailableAt = now + 700 / tempoMultiplier;
    skillDamageApplied = false;
  };

  const reset = (now: number) => {
    health = resolvedMaxHealth;
    respawnAt = 0;
    madaRig.visible = true;
    madaRig.position.copy(spawnPosition);
    madaRig.rotation.set(0, 0, 0);
    resetSkillState(now);
    madaAnimation.resetPose();
    madaAnimation.applyHeadLook(null);
    applyPresentationState({ mode: "active", fadeAlpha: 1 });
  };

  const onDown = (now: number) => {
    health = 0;
    respawnAt = allowRespawn ? now + MADA_RESPAWN_DELAY_MS : 0;
    madaRig.visible = false;
    resetSkillState(now);
    applyPresentationState({ mode: "vanished", fadeAlpha: 0 });
  };

  const attackTargetId = "unified-mada";
  const attackTarget: PlayerAttackTarget = {
    id: attackTargetId,
    object: hitbox,
    category: "boss",
    label: monster.label,
    isActive: () => health > 0,
    getHealth: () => health,
    getMaxHealth: () => resolvedMaxHealth,
    onHit: (hit) => {
      if (health <= 0) return;
      madaPresentation.triggerHitFlash(hit.now);
      health = Math.max(0, health - Math.max(1, Math.floor(hit.damage)));
      if (health <= 0) {
        onDown(hit.now);
      }
    },
  };
  attackTargets.push(attackTarget);

  const loader = new GLTFLoader();
  let isDisposed = false;
  loader.load(
    monster.path,
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        resourceTracker.disposeObjectResources(gltf.scene);
        return;
      }

      const model = gltf.scene;
      normalizeModelToHeight(model, 5.6);
      while (modelRoot.children.length > 0) {
        modelRoot.remove(modelRoot.children[0]);
      }
      modelRoot.add(model);
      madaPresentation.bindModel(model);
      madaAnimation.bindModel(model);
      madaAnimation.bindAnimations(gltf.animations ?? []);
      resourceTracker.trackObject(model, {
        castShadow: true,
        receiveShadow: true,
      });
    },
    undefined,
    () => {}
  );

  const resolveSkillState = (now: number) => {
    if (skillStartedAt < 0) {
      return {
        active: false,
        elapsedMs: 0,
        windupProgress: 0,
        strikeProgress: 0,
        recoverProgress: 0,
      };
    }
    const elapsedMs = Math.max(0, now - skillStartedAt);
    if (elapsedMs >= resolvedSkill1DurationMs) {
      return {
        active: false,
        elapsedMs,
        windupProgress: 1,
        strikeProgress: 1,
        recoverProgress: 1,
      };
    }
    const windupProgress = Math.max(
      0,
      Math.min(1, elapsedMs / resolvedSkill1WindupDurationMs)
    );
    const strikeProgress = Math.max(
      0,
      Math.min(
        1,
        (elapsedMs - resolvedSkill1WindupDurationMs) /
          resolvedSkill1StrikeDurationMs
      )
    );
    const recoverProgress = Math.max(
      0,
      Math.min(
        1,
        (elapsedMs -
          resolvedSkill1WindupDurationMs -
          resolvedSkill1StrikeDurationMs) /
          resolvedSkill1RecoverDurationMs
      )
    );
    return {
      active: true,
      elapsedMs,
      windupProgress,
      strikeProgress,
      recoverProgress,
    };
  };

  return {
    tick: ({ now, delta, player, applyDamage }: PlayerWorldTickArgs) => {
      if (health <= 0) {
        if (allowRespawn && respawnAt > 0 && now >= respawnAt) {
          reset(now);
        }
        return;
      }
      if (isGameEnded()) {
        madaAnimation.resetPose();
        madaAnimation.applyHeadLook(null);
        madaAnimation.update(delta);
        return;
      }

      player.getWorldPosition(toTarget);
      const dx = toTarget.x - madaRig.position.x;
      const dz = toTarget.z - madaRig.position.z;
      if (Math.abs(dx) > 0.0001 || Math.abs(dz) > 0.0001) {
        madaRig.rotation.y = Math.atan2(dx, dz);
      }

      toTarget.y += 1.45;
      madaAnimation.applyHeadLook(toTarget);

      const planarDistance = Math.hypot(dx, dz);
      let skillState = resolveSkillState(now);
      if (
        !skillState.active &&
        now >= skillNextAvailableAt &&
        planarDistance <= resolvedSkill1TriggerRange
      ) {
        skillStartedAt = now;
        skillNextAvailableAt = now + resolvedSkill1CooldownMs;
        skillDamageApplied = false;
        skillState = resolveSkillState(now);
      }

      if (skillState.active) {
        madaAnimation.applyGrabAnimation({
          revealProgress: 1,
          windupProgress: skillState.windupProgress,
          strikeProgress: skillState.strikeProgress,
          recoverProgress: skillState.recoverProgress,
        });
      } else {
        madaAnimation.resetPose();
      }
      madaAnimation.update(delta);

      if (
        skillState.active &&
        !skillDamageApplied &&
        skillState.elapsedMs >= resolvedSkill1WindupDurationMs
      ) {
        player.getWorldPosition(toTarget);
        toTarget.y = madaRig.position.y;
        forward.set(Math.sin(madaRig.rotation.y), 0, Math.cos(madaRig.rotation.y));
        const directionToTarget = toTarget.sub(madaRig.position).setY(0);
        const horizontalDistance = directionToTarget.length();
        if (horizontalDistance > 0.001) {
          directionToTarget.normalize();
          const facing = forward.dot(directionToTarget);
          if (
            horizontalDistance <= resolvedSkill1DamageRange &&
            facing >= 0.15
          ) {
            applyDamage(resolvedSkill1Damage);
          }
        }
        skillDamageApplied = true;
      }

      if (!skillState.active && skillStartedAt >= 0) {
        skillStartedAt = -1;
        skillDamageApplied = false;
      }
    },
    reset,
    getState: (): UnifiedMonsterState => ({
      monsterId: monster.id,
      monsterLabel: monster.label,
      monsterHealth: Math.max(0, Math.floor(health)),
      monsterMaxHealth: resolvedMaxHealth,
      monsterAlive: health > 0,
    }),
    dispose: () => {
      isDisposed = true;
      removeAttackTargetById(attackTargets, attackTargetId);
      if (runtimeGroup.parent) {
        runtimeGroup.parent.remove(runtimeGroup);
      }
    },
  };
};
