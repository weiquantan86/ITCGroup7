import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  PlayerAttackTarget,
  PlayerWorldTickArgs,
} from "../../../asset/entity/character/general/player";
import {
  normalizeModelToHeight,
  removeAttackTargetById,
} from "../../../asset/entity/monster/unified/runtimeUtils";
import { createMadaAnimationController } from "../../../asset/entity/monster/mada/animation";
import {
  createMadaPresentationController,
  resolveMadaPresentationState,
} from "../../../asset/entity/monster/mada/presentation";

export const MADA_LAB_MAX_HEALTH = 2800;

const MADA_GRAVITY = -28;
const MADA_MAX_FALL_SPEED = -48;
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
const MADA_HEAD_LOOK_HEIGHT = 1.45;
const MADA_ATTACK_TARGET_ID = "madaSubject";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const faceObjectTowardTargetOnYaw = (
  object: THREE.Object3D,
  target: THREE.Vector3
) => {
  const deltaX = target.x - object.position.x;
  const deltaZ = target.z - object.position.z;
  if (Math.abs(deltaX) < 0.0001 && Math.abs(deltaZ) < 0.0001) {
    object.rotation.set(0, 0, 0);
    return;
  }
  object.rotation.set(0, Math.atan2(deltaX, deltaZ), 0);
};

type MadaLabSkill1State = {
  active: boolean;
  elapsedMs: number;
  windupProgress: number;
  strikeProgress: number;
  recoverProgress: number;
};

export type MadaLabPresentationUpdateArgs = {
  formalBattleStarted: boolean;
  isInitialBreachActive: boolean;
  isSequenceComplete: boolean;
  reappearProgress: number;
  breachSequenceStarted: boolean;
  containmentReleased: boolean;
  hasVanished: boolean;
  fadeAlpha: number;
};

export type MadaLabCombatUpdateArgs = {
  now: number;
  delta: number;
  player: PlayerWorldTickArgs["player"];
  applyDamage: PlayerWorldTickArgs["applyDamage"];
  formalBattleStarted: boolean;
  storyModeActive: boolean;
  breachSequenceStarted: boolean;
  containmentReleased: boolean;
  storyHasMadaReappeared: boolean;
  storySequenceComplete: boolean;
  storyPlayerPosition: THREE.Vector3;
  ambushCrawlActive: boolean;
  hasVanished: boolean;
};

type CreateMadaLabCombatControllerArgs = {
  labGroup: THREE.Group;
  attackTargets: PlayerAttackTarget[];
  trackMesh: (mesh: THREE.Mesh) => void;
  trackObject: (object: THREE.Object3D) => void;
  disposeObjectResources: (object: THREE.Object3D) => void;
  spawnPosition: THREE.Vector3;
  groundY: number;
  containmentBaseLift: number;
  preSmokeExtraLift: number;
  isCombatAvailable: () => boolean;
  onHealthChanged: (now: number) => void;
};

export type MadaLabCombatController = {
  rig: THREE.Group;
  getHealth: () => number;
  getMaxHealth: () => number;
  isActivated: () => boolean;
  setActivated: (active: boolean) => void;
  resetForContainmentBreach: () => void;
  beginFormalBattle: (now: number) => void;
  setStoryPosition: (position: THREE.Vector3) => void;
  setDormantHover: (now: number, shieldPulse: number) => void;
  applyGravity: (delta: number) => void;
  updatePresentation: (args: MadaLabPresentationUpdateArgs) => void;
  updateCombatBehavior: (args: MadaLabCombatUpdateArgs) => void;
  getRightClawWorldPosition: (target: THREE.Vector3) => THREE.Vector3;
  getGrabReferenceWorldPosition: (target: THREE.Vector3) => boolean;
  dispose: () => void;
};

export const createMadaLabCombatController = ({
  labGroup,
  attackTargets,
  trackMesh,
  trackObject,
  disposeObjectResources,
  spawnPosition,
  groundY,
  containmentBaseLift,
  preSmokeExtraLift,
  isCombatAvailable,
  onHealthChanged,
}: CreateMadaLabCombatControllerArgs): MadaLabCombatController => {
  const madaRig = new THREE.Group();
  madaRig.position.copy(spawnPosition);
  madaRig.rotation.y = 0;

  const madaModelRoot = new THREE.Group();
  madaRig.add(madaModelRoot);
  labGroup.add(madaRig);

  const fallbackMaterial = new THREE.MeshStandardMaterial({
    color: 0x352930,
    roughness: 0.72,
    metalness: 0.08,
  });
  const fallbackBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.2, 2.6, 6, 12),
    fallbackMaterial
  );
  fallbackBody.position.y = 2.5;
  madaModelRoot.add(fallbackBody);
  trackMesh(fallbackBody);

  const madaPresentation = createMadaPresentationController({
    rig: madaRig,
    modelRoot: madaModelRoot,
  });
  const madaAnimation = createMadaAnimationController({
    rig: madaRig,
  });

  let health = MADA_LAB_MAX_HEALTH;
  let activated = false;
  let verticalVelocity = 0;
  let skill1StartedAt = -1;
  let skill1NextAvailableAt = 0;
  let skill1DamageApplied = false;

  const specimenFocus = new THREE.Vector3();
  const madaHeadLookTarget = new THREE.Vector3();
  const madaGrabTarget = new THREE.Vector3();
  const madaGrabDirection = new THREE.Vector3();
  const madaSkill1Direction = new THREE.Vector3();

  const setActivated = (active: boolean) => {
    if (activated === active) return;
    activated = active;
  };

  const resolveSkill1State = (now: number): MadaLabSkill1State => {
    if (skill1StartedAt < 0) {
      return {
        active: false,
        elapsedMs: 0,
        windupProgress: 0,
        strikeProgress: 0,
        recoverProgress: 0,
      };
    }

    const elapsedMs = Math.max(0, now - skill1StartedAt);
    if (elapsedMs >= MADA_SKILL1_DURATION_MS) {
      return {
        active: false,
        elapsedMs,
        windupProgress: 1,
        strikeProgress: 1,
        recoverProgress: 1,
      };
    }

    return {
      active: true,
      elapsedMs,
      windupProgress: clamp(elapsedMs / MADA_SKILL1_WINDUP_DURATION_MS, 0, 1),
      strikeProgress: clamp(
        (elapsedMs - MADA_SKILL1_WINDUP_DURATION_MS) /
          MADA_SKILL1_STRIKE_DURATION_MS,
        0,
        1
      ),
      recoverProgress: clamp(
        (elapsedMs -
          MADA_SKILL1_WINDUP_DURATION_MS -
          MADA_SKILL1_STRIKE_DURATION_MS) /
          MADA_SKILL1_RECOVER_DURATION_MS,
        0,
        1
      ),
    };
  };

  const applyGravity = (delta: number) => {
    if (!Number.isFinite(delta) || delta <= 0) return;
    verticalVelocity = Math.max(
      MADA_MAX_FALL_SPEED,
      verticalVelocity + MADA_GRAVITY * delta
    );
    madaRig.position.y += verticalVelocity * delta;
    if (madaRig.position.y <= groundY) {
      madaRig.position.y = groundY;
      verticalVelocity = 0;
    }
  };

  const setStoryPosition = (position: THREE.Vector3) => {
    madaRig.position.copy(position);
    verticalVelocity = 0;
  };

  const setDormantHover = (now: number, shieldPulse: number) => {
    madaRig.position.y =
      groundY +
      containmentBaseLift +
      preSmokeExtraLift +
      Math.sin(now * 0.0012) * 0.08 +
      shieldPulse * 0.05;
    verticalVelocity = 0;
  };

  const resetForContainmentBreach = () => {
    setActivated(false);
    verticalVelocity = 0;
    skill1StartedAt = -1;
    skill1NextAvailableAt = 0;
    skill1DamageApplied = false;
    madaAnimation.resetPose();
    madaPresentation.applyState(
      resolveMadaPresentationState({
        activated: false,
        transitionActive: true,
        released: false,
        hasVanished: false,
      })
    );
  };

  const beginFormalBattle = (now: number) => {
    skill1StartedAt = -1;
    skill1NextAvailableAt = now + 700;
    skill1DamageApplied = false;
    setActivated(true);
  };

  const updatePresentation = ({
    formalBattleStarted,
    isInitialBreachActive,
    isSequenceComplete,
    reappearProgress,
    breachSequenceStarted,
    containmentReleased,
    hasVanished,
    fadeAlpha,
  }: MadaLabPresentationUpdateArgs) => {
    if (formalBattleStarted) {
      madaPresentation.applyState({
        mode: "active",
        fadeAlpha: 1,
      });
      return;
    }

    if (isInitialBreachActive) {
      madaPresentation.applyState(
        resolveMadaPresentationState({
          activated,
          transitionActive: breachSequenceStarted,
          released: containmentReleased,
          hasVanished: false,
          fadeAlpha,
        })
      );
      return;
    }

    if (isSequenceComplete) {
      madaPresentation.applyState({
        mode: "active",
        fadeAlpha: 1,
      });
      return;
    }

    if (reappearProgress > 0.001) {
      madaPresentation.applyState({
        mode: reappearProgress >= 0.999 ? "active" : "vanishing",
        fadeAlpha: reappearProgress,
      });
      return;
    }

    if (hasVanished) {
      madaPresentation.applyState({
        mode: "vanished",
        fadeAlpha: 0,
      });
      return;
    }

    madaPresentation.applyState({
      mode: activated ? "active" : "inactive",
      fadeAlpha: 1,
    });
  };

  const updateCombatBehavior = ({
    now,
    delta,
    player,
    applyDamage,
    formalBattleStarted,
    storyModeActive,
    breachSequenceStarted,
    containmentReleased,
    storyHasMadaReappeared,
    storySequenceComplete,
    storyPlayerPosition,
    ambushCrawlActive,
    hasVanished,
  }: MadaLabCombatUpdateArgs) => {
    let skill1State = resolveSkill1State(now);
    if (
      formalBattleStarted &&
      activated &&
      health > 0 &&
      !storyModeActive &&
      !skill1State.active &&
      now >= skill1NextAvailableAt
    ) {
      player.getWorldPosition(specimenFocus);
      madaSkill1Direction.copy(specimenFocus).sub(madaRig.position).setY(0);
      if (madaSkill1Direction.length() <= MADA_SKILL1_TRIGGER_RANGE) {
        skill1StartedAt = now;
        skill1NextAvailableAt = now + MADA_SKILL1_COOLDOWN_MS;
        skill1DamageApplied = false;
        skill1State = resolveSkill1State(now);
      }
    }

    madaAnimation.setCrawlEnabled(ambushCrawlActive);
    if (skill1State.active) {
      madaAnimation.applyGrabAnimation({
        revealProgress: 1,
        windupProgress: skill1State.windupProgress,
        strikeProgress: skill1State.strikeProgress,
        recoverProgress: skill1State.recoverProgress,
      });
    } else if (!ambushCrawlActive) {
      madaAnimation.resetPose();
    }
    madaAnimation.update(delta);

    if (health > 0 && (!hasVanished || storyHasMadaReappeared)) {
      if (breachSequenceStarted && !formalBattleStarted) {
        if (containmentReleased && !storySequenceComplete) {
          faceObjectTowardTargetOnYaw(madaRig, storyPlayerPosition);
          madaHeadLookTarget.copy(storyPlayerPosition);
          madaHeadLookTarget.y += MADA_HEAD_LOOK_HEIGHT;
        } else {
          madaRig.rotation.y = 0;
          madaHeadLookTarget.set(0, 0, 0);
        }
      } else if (activated) {
        player.getWorldPosition(specimenFocus);
        faceObjectTowardTargetOnYaw(madaRig, specimenFocus);
        madaHeadLookTarget.copy(specimenFocus);
        madaHeadLookTarget.y += MADA_HEAD_LOOK_HEIGHT;
      } else {
        madaRig.rotation.y = 0;
        madaHeadLookTarget.set(0, 0, 0);
      }
      madaAnimation.applyHeadLook(
        madaHeadLookTarget.lengthSq() > 0.0001 ? madaHeadLookTarget : null
      );
    } else if (!hasVanished) {
      madaRig.rotation.y += delta * 0.35;
      madaAnimation.applyHeadLook(null);
    } else {
      madaAnimation.applyHeadLook(null);
    }

    if (
      formalBattleStarted &&
      skill1State.active &&
      !skill1DamageApplied &&
      skill1State.elapsedMs >= MADA_SKILL1_WINDUP_DURATION_MS
    ) {
      player.getWorldPosition(madaGrabTarget);
      madaGrabDirection.copy(madaGrabTarget).sub(madaRig.position).setY(0);
      const horizontalDistance = madaGrabDirection.length();
      if (horizontalDistance > 0.001) {
        madaGrabDirection.normalize();
        madaSkill1Direction
          .set(Math.sin(madaRig.rotation.y), 0, Math.cos(madaRig.rotation.y))
          .normalize();
        if (
          horizontalDistance <= MADA_SKILL1_DAMAGE_RANGE &&
          madaSkill1Direction.dot(madaGrabDirection) >= 0.15
        ) {
          applyDamage(MADA_SKILL1_DAMAGE);
        }
      }
      skill1DamageApplied = true;
    }

    if (!skill1State.active && skill1StartedAt >= 0) {
      skill1StartedAt = -1;
      skill1DamageApplied = false;
    }
  };

  const attackTarget: PlayerAttackTarget = {
    id: MADA_ATTACK_TARGET_ID,
    object: madaRig,
    category: "boss",
    label: "Mada Subject",
    isActive: () => activated && health > 0 && isCombatAvailable(),
    getHealth: () => health,
    getMaxHealth: () => MADA_LAB_MAX_HEALTH,
    onHit: (hit) => {
      if (!activated || health <= 0 || !isCombatAvailable()) {
        return;
      }
      setActivated(true);
      madaPresentation.triggerHitFlash(hit.now);
      health = Math.max(0, health - Math.max(1, Math.floor(hit.damage)));
      onHealthChanged(hit.now);
    },
  };
  attackTargets.push(attackTarget);

  const loader = new GLTFLoader();
  let isDisposed = false;
  loader.load(
    "/assets/monsters/mada/mada.glb",
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        disposeObjectResources(gltf.scene);
        return;
      }

      const model = gltf.scene;
      normalizeModelToHeight(model, 5.6);
      while (madaModelRoot.children.length > 0) {
        madaModelRoot.remove(madaModelRoot.children[0]);
      }
      madaModelRoot.add(model);
      madaPresentation.bindModel(model);
      madaAnimation.bindModel(model);
      madaAnimation.bindAnimations(gltf.animations ?? []);
      trackObject(model);
    },
    undefined,
    () => {}
  );

  return {
    rig: madaRig,
    getHealth: () => health,
    getMaxHealth: () => MADA_LAB_MAX_HEALTH,
    isActivated: () => activated,
    setActivated,
    resetForContainmentBreach,
    beginFormalBattle,
    setStoryPosition,
    setDormantHover,
    applyGravity,
    updatePresentation,
    updateCombatBehavior,
    getRightClawWorldPosition: (target: THREE.Vector3) =>
      madaAnimation.getRightClawWorldPosition(target),
    getGrabReferenceWorldPosition: (target: THREE.Vector3) =>
      madaAnimation.getGrabReferenceWorldPosition(target),
    dispose: () => {
      isDisposed = true;
      removeAttackTargetById(attackTargets, MADA_ATTACK_TARGET_ID);
    },
  };
};
