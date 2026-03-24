import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  PlayerAttackTarget,
  PlayerWorldTickArgs,
} from "../../entity/character/general/player";
import {
  normalizeModelToHeight,
  removeAttackTargetById,
} from "../../entity/monster/unified/runtimeUtils";
import { createMadaAnimationController } from "../../entity/monster/mada/animation";
import {
  createMadaPresentationController,
  resolveMadaPresentationState,
} from "../../entity/monster/mada/presentation";

export const MADA_LAB_MAX_HEALTH = 4000;
export const MADA_LAB_MAX_HEALTH_OPTIONS = [4000, 6000, 8000] as const;

export const resolveMadaLabMaxHealth = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MADA_LAB_MAX_HEALTH;
  const normalized = Math.max(1, Math.floor(parsed));
  if ((MADA_LAB_MAX_HEALTH_OPTIONS as readonly number[]).includes(normalized)) {
    return normalized;
  }
  return MADA_LAB_MAX_HEALTH;
};

const MADA_GRAVITY = -28;
const MADA_MAX_FALL_SPEED = -48;
const MADA_HEAD_LOOK_HEIGHT = 1.45;
const MADA_ATTACK_TARGET_ID = "madaSubject";

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
  maxHealth?: number;
  isCombatAvailable: () => boolean;
  onHealthChanged: (now: number) => void;
};

export type MadaLabCombatController = {
  rig: THREE.Group;
  getHealth: () => number;
  getMaxHealth: () => number;
  setMaxHealth: (value: number, refill?: boolean) => void;
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
  maxHealth,
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

  let maxHealthValue = resolveMadaLabMaxHealth(maxHealth);
  let health = maxHealthValue;
  let activated = false;
  let verticalVelocity = 0;

  const specimenFocus = new THREE.Vector3();
  const madaHeadLookTarget = new THREE.Vector3();

  const setActivated = (active: boolean) => {
    if (activated === active) return;
    activated = active;
  };

  const setMaxHealth = (value: number, refill = true) => {
    maxHealthValue = resolveMadaLabMaxHealth(value);
    if (refill) {
      health = maxHealthValue;
      return;
    }
    health = Math.min(health, maxHealthValue);
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
    health = maxHealthValue;
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
    void now;
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
    delta,
    player,
    formalBattleStarted,
    breachSequenceStarted,
    containmentReleased,
    storyHasMadaReappeared,
    storySequenceComplete,
    storyPlayerPosition,
    ambushCrawlActive,
    hasVanished,
  }: MadaLabCombatUpdateArgs) => {
    madaAnimation.setCrawlEnabled(ambushCrawlActive);
    if (!ambushCrawlActive) {
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

  };

  const attackTarget: PlayerAttackTarget = {
    id: MADA_ATTACK_TARGET_ID,
    object: madaRig,
    category: "boss",
    label: "Mada Subject",
    isActive: () => activated && health > 0 && isCombatAvailable(),
    getHealth: () => health,
    getMaxHealth: () => maxHealthValue,
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
    getMaxHealth: () => maxHealthValue,
    setMaxHealth,
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
