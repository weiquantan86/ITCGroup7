import * as THREE from "three";
import type { MochiGeneralCombatEntry } from "./combatBehavior";

type SpinningSwordState = {
  object: THREE.Object3D;
  usingProxy: boolean;
  proxyMaterial: THREE.MeshStandardMaterial | null;
  originalParent: THREE.Object3D | null;
  originalLocalPosition: THREE.Vector3;
  originalLocalQuaternion: THREE.Quaternion;
  originalLocalScale: THREE.Vector3;
  bladeAxisLocal: THREE.Vector3;
  collisionForwardDistance: number;
  collisionBackwardDistance: number;
  launchStart: THREE.Vector3;
  orbitCenter: THREE.Vector3;
  orbitForward: THREE.Vector3;
  baseQuaternion: THREE.Quaternion;
  spinAngle: number;
  damagedTargetIds: Set<string>;
  phase: "launch" | "orbit" | "return";
  phaseTimer: number;
};

export type MochiGeneralSkill4Runtime = {
  onBossTick: (args: {
    entry: MochiGeneralCombatEntry;
    gameEnded: boolean;
  }) => void;
  update: (args: {
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    gameEnded: boolean;
  }) => void;
  onBossRemoved: (entry: MochiGeneralCombatEntry) => void;
  dispose: () => void;
};

const SKILL4_HIT_DAMAGE = 35;
const SKILL4_BLADE_COLLISION_RADIUS = 0.72;
const SKILL4_PLAYER_RADIUS = 0.55;
const SKILL4_PLAYER_HEIGHT_OFFSET = 1;
const SKILL4_ORBIT_FORWARD_DISTANCE = 6.2;
const SKILL4_ORBIT_RADIUS = 3.8 * 1.3;
const SKILL4_ORBIT_HEIGHT_ABOVE_GROUND = 0.72;
const SKILL4_LAUNCH_DURATION = 0.34;
const SKILL4_ORBIT_DURATION = 1.24;
const SKILL4_RETURN_SPEED = 17.5;
const SKILL4_ATTACH_DISTANCE = 0.28;
const SKILL4_SPIN_SPEED = 32;
const SKILL4_PROXY_LENGTH = 2.3;
const SKILL4_FALLEN_TILT_RADIANS = Math.PI * 0.5;
const SKILL4_THROW_SCALE_MULTIPLIER = 1.2;
const SKILL4_RAGE_SPIN_SPEED_MULTIPLIER = 1.28;

const swordOriginWorld = new THREE.Vector3();
const swordOrbitCenterWorld = new THREE.Vector3();
const swordForwardWorld = new THREE.Vector3();
const swordRightWorld = new THREE.Vector3();
const swordOrbitPointWorld = new THREE.Vector3();
const swordReturnTargetWorld = new THREE.Vector3();
const swordMoveDelta = new THREE.Vector3();
const playerProbeWorld = new THREE.Vector3();
const swordBladeAxisWorld = new THREE.Vector3();
const swordCollisionStartWorld = new THREE.Vector3();
const swordCollisionEndWorld = new THREE.Vector3();
const swordCollisionClosestWorld = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const anchorWorldRotation = new THREE.Quaternion();
const swordFallenTiltQuaternion = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 0, 1),
  SKILL4_FALLEN_TILT_RADIANS
);
const swordSpinQuaternion = new THREE.Quaternion();
const swordCollisionSegment = new THREE.Line3();

export const createMochiGeneralSkill4Runtime = (
  scene: THREE.Scene
): MochiGeneralSkill4Runtime => {
  const proxyGeometry = new THREE.BoxGeometry(0.2, 0.2, SKILL4_PROXY_LENGTH);
  const proxyMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.28,
    metalness: 0.62,
    emissive: 0x0f172a,
    emissiveIntensity: 0.22,
  });

  const spinningStates = new Map<MochiGeneralCombatEntry, SpinningSwordState>();

  const resolveSwordOrigin = (entry: MochiGeneralCombatEntry, out: THREE.Vector3) => {
    const sword = entry.rig?.sword;
    if (sword) {
      sword.getWorldPosition(out);
      return;
    }
    out.copy(entry.anchor.position);
    out.y += 2.65;
  };

  const resolveForward = (entry: MochiGeneralCombatEntry, out: THREE.Vector3) => {
    entry.anchor.getWorldQuaternion(anchorWorldRotation);
    out.set(0, 0, 1);
    out.applyQuaternion(anchorWorldRotation);
    out.y = 0;
    if (out.lengthSq() <= 0.00001) {
      out.set(0, 0, 1);
    } else {
      out.normalize();
    }
  };

  const clearSpinningState = (entry: MochiGeneralCombatEntry) => {
    const state = spinningStates.get(entry);
    if (!state) {
      entry.skill4SwordActive = false;
      return;
    }

    if (state.usingProxy) {
      if (state.object.parent) {
        state.object.parent.remove(state.object);
      }
      state.proxyMaterial?.dispose();
    } else if (state.originalParent) {
      state.originalParent.attach(state.object);
      state.object.position.copy(state.originalLocalPosition);
      state.object.quaternion.copy(state.originalLocalQuaternion);
      state.object.scale.copy(state.originalLocalScale);
    } else if (state.object.parent) {
      state.object.parent.remove(state.object);
    }

    spinningStates.delete(entry);
    entry.skill4SwordActive = false;
  };

  const applyFallenSpinPose = (
    state: SpinningSwordState,
    delta: number,
    rageActive: boolean
  ) => {
    state.spinAngle +=
      SKILL4_SPIN_SPEED * (rageActive ? SKILL4_RAGE_SPIN_SPEED_MULTIPLIER : 1) * delta;
    swordSpinQuaternion.setFromAxisAngle(worldUp, state.spinAngle);
    state.object.quaternion
      .copy(state.baseQuaternion)
      .multiply(swordFallenTiltQuaternion)
      .multiply(swordSpinQuaternion);
  };

  const beginSkill4Throw = ({
    entry,
    gameEnded,
  }: {
    entry: MochiGeneralCombatEntry;
    gameEnded: boolean;
  }) => {
    if (gameEnded || !entry.monster.isAlive) {
      entry.skill4SwordActive = false;
      return;
    }
    if (spinningStates.has(entry)) return;

    resolveSwordOrigin(entry, swordOriginWorld);
    resolveForward(entry, swordForwardWorld);

    let object: THREE.Object3D;
    let usingProxy = false;
    let proxyMaterial: THREE.MeshStandardMaterial | null = null;
    let originalParent: THREE.Object3D | null = null;
    let originalLocalPosition = new THREE.Vector3();
    let originalLocalQuaternion = new THREE.Quaternion();
    let originalLocalScale = new THREE.Vector3(1, 1, 1);
    let bladeAxisLocal = new THREE.Vector3(0, 0, 1);
    let collisionForwardDistance =
      (SKILL4_PROXY_LENGTH * SKILL4_THROW_SCALE_MULTIPLIER) * 0.5;
    let collisionBackwardDistance = collisionForwardDistance;

    const sword = entry.rig?.sword;
    if (sword?.parent) {
      originalParent = sword.parent;
      originalLocalPosition = sword.position.clone();
      originalLocalQuaternion = sword.quaternion.clone();
      originalLocalScale = sword.scale.clone();
      scene.attach(sword);
      object = sword;
      object.scale.copy(originalLocalScale).multiplyScalar(SKILL4_THROW_SCALE_MULTIPLIER);
      const swordTip = entry.rig?.swordTip;
      if (swordTip?.parent === sword) {
        const localTip = swordTip.position.clone();
        if (localTip.lengthSq() > 0.00001) {
          bladeAxisLocal.copy(localTip).normalize();
          const tipDistance =
            localTip.length() *
            Math.max(object.scale.x, object.scale.y, object.scale.z);
          collisionForwardDistance = Math.max(0.72, tipDistance);
          collisionBackwardDistance = Math.max(0.24, tipDistance * 0.36);
        }
      }
    } else {
      usingProxy = true;
      proxyMaterial = proxyMaterialTemplate.clone();
      const proxyMesh = new THREE.Mesh(proxyGeometry, proxyMaterial);
      proxyMesh.castShadow = false;
      proxyMesh.receiveShadow = false;
      scene.add(proxyMesh);
      object = proxyMesh;
      object.scale.setScalar(SKILL4_THROW_SCALE_MULTIPLIER);
    }

    object.position.copy(swordOriginWorld);
    swordOrbitCenterWorld.copy(entry.anchor.position);
    swordOrbitCenterWorld.addScaledVector(swordForwardWorld, SKILL4_ORBIT_FORWARD_DISTANCE);
    swordOrbitCenterWorld.y =
      entry.anchor.position.y + SKILL4_ORBIT_HEIGHT_ABOVE_GROUND;

    spinningStates.set(entry, {
      object,
      usingProxy,
      proxyMaterial,
      originalParent,
      originalLocalPosition,
      originalLocalQuaternion,
      originalLocalScale,
      bladeAxisLocal,
      collisionForwardDistance,
      collisionBackwardDistance,
      launchStart: swordOriginWorld.clone(),
      orbitCenter: swordOrbitCenterWorld.clone(),
      orbitForward: swordForwardWorld.clone(),
      baseQuaternion: object.quaternion.clone(),
      spinAngle: 0,
      damagedTargetIds: new Set<string>(),
      phase: "launch",
      phaseTimer: 0,
    });
    entry.skill4SwordActive = true;
  };

  const updateSwordCollision = ({
    state,
    player,
    applyDamage,
  }: {
    state: SpinningSwordState;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
  }) => {
    const targetId = player.uuid;
    if (state.damagedTargetIds.has(targetId)) return;
    player.getWorldPosition(playerProbeWorld);
    playerProbeWorld.y += SKILL4_PLAYER_HEIGHT_OFFSET;
    swordBladeAxisWorld.copy(state.bladeAxisLocal).applyQuaternion(state.object.quaternion);
    if (swordBladeAxisWorld.lengthSq() <= 0.00001) {
      swordBladeAxisWorld.set(0, 0, 1).applyQuaternion(state.object.quaternion);
    }
    if (swordBladeAxisWorld.lengthSq() <= 0.00001) {
      swordBladeAxisWorld.set(0, 0, 1);
    } else {
      swordBladeAxisWorld.normalize();
    }
    swordCollisionStartWorld
      .copy(state.object.position)
      .addScaledVector(swordBladeAxisWorld, -state.collisionBackwardDistance);
    swordCollisionEndWorld
      .copy(state.object.position)
      .addScaledVector(swordBladeAxisWorld, state.collisionForwardDistance);
    swordCollisionSegment.set(swordCollisionStartWorld, swordCollisionEndWorld);
    swordCollisionSegment.closestPointToPoint(
      playerProbeWorld,
      true,
      swordCollisionClosestWorld
    );
    const collisionDistance = SKILL4_BLADE_COLLISION_RADIUS + SKILL4_PLAYER_RADIUS;
    if (
      swordCollisionClosestWorld.distanceToSquared(playerProbeWorld) >
      collisionDistance * collisionDistance
    ) return;
    state.damagedTargetIds.add(targetId);
    applyDamage(SKILL4_HIT_DAMAGE);
  };

  const updateSpinningStates = ({
    delta,
    player,
    applyDamage,
    gameEnded,
  }: {
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    gameEnded: boolean;
  }) => {
    const entries = Array.from(spinningStates.entries());
    for (let i = 0; i < entries.length; i += 1) {
      const [entry, state] = entries[i];
      if (gameEnded || !entry.monster.isAlive) {
        state.phase = "return";
      }

      if (state.phase === "launch") {
        state.phaseTimer += delta;
        const t = THREE.MathUtils.clamp(
          state.phaseTimer / Math.max(0.00001, SKILL4_LAUNCH_DURATION),
          0,
          1
        );
        swordRightWorld.copy(worldUp).cross(state.orbitForward);
        if (swordRightWorld.lengthSq() <= 0.00001) {
          swordRightWorld.set(1, 0, 0);
        } else {
          swordRightWorld.normalize();
        }
        swordOrbitPointWorld
          .copy(state.orbitCenter)
          .addScaledVector(swordRightWorld, SKILL4_ORBIT_RADIUS);
        state.object.position.lerpVectors(state.launchStart, swordOrbitPointWorld, t);
        applyFallenSpinPose(state, delta, entry.rageActive);
        if (t >= 1) {
          state.phase = "orbit";
          state.phaseTimer = 0;
        }
      } else if (state.phase === "orbit") {
        state.phaseTimer += delta;
        const t = THREE.MathUtils.clamp(
          state.phaseTimer / Math.max(0.00001, SKILL4_ORBIT_DURATION),
          0,
          1
        );
        const theta = t * Math.PI * 2;
        swordRightWorld.copy(worldUp).cross(state.orbitForward);
        if (swordRightWorld.lengthSq() <= 0.00001) {
          swordRightWorld.set(1, 0, 0);
        } else {
          swordRightWorld.normalize();
        }
        swordOrbitPointWorld
          .copy(state.orbitCenter)
          .addScaledVector(swordRightWorld, Math.cos(theta) * SKILL4_ORBIT_RADIUS)
          .addScaledVector(state.orbitForward, Math.sin(theta) * SKILL4_ORBIT_RADIUS);
        state.object.position.copy(swordOrbitPointWorld);
        applyFallenSpinPose(state, delta, entry.rageActive);
        if (t >= 1) {
          state.phase = "return";
          state.phaseTimer = 0;
        }
      } else {
        if (state.originalParent) {
          swordReturnTargetWorld.copy(state.originalLocalPosition);
          state.originalParent.localToWorld(swordReturnTargetWorld);
        } else {
          swordReturnTargetWorld.copy(entry.anchor.position);
          swordReturnTargetWorld.y += 2.65;
        }
        swordMoveDelta.copy(swordReturnTargetWorld).sub(state.object.position);
        const remaining = swordMoveDelta.length();
        if (remaining <= SKILL4_ATTACH_DISTANCE) {
          clearSpinningState(entry);
          continue;
        }
        if (remaining > 0.00001) {
          swordMoveDelta.multiplyScalar(1 / remaining);
          state.object.position.addScaledVector(
            swordMoveDelta,
            Math.min(remaining, SKILL4_RETURN_SPEED * delta)
          );
        }
        applyFallenSpinPose(state, delta * 0.8, entry.rageActive);
      }

      updateSwordCollision({
        state,
        player,
        applyDamage,
      });
    }
  };

  return {
    onBossTick: ({ entry, gameEnded }) => {
      if (!entry.skill4ThrowRequested) return;
      entry.skill4ThrowRequested = false;
      beginSkill4Throw({
        entry,
        gameEnded,
      });
    },
    update: ({ delta, player, applyDamage, gameEnded }) => {
      updateSpinningStates({
        delta,
        player,
        applyDamage,
        gameEnded,
      });
    },
    onBossRemoved: (entry) => {
      clearSpinningState(entry);
    },
    dispose: () => {
      const activeEntries = Array.from(spinningStates.keys());
      for (let i = 0; i < activeEntries.length; i += 1) {
        clearSpinningState(activeEntries[i]);
      }
      proxyGeometry.dispose();
      proxyMaterialTemplate.dispose();
    },
  };
};
