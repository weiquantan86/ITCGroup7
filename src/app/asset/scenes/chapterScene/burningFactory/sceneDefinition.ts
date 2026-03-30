import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PlayerWorldTickArgs } from "../../../entity/character/general/player";
import { createSceneResourceTracker } from "../../general/resourceTracker";
import type { SceneSetupContext, SceneSetupResult } from "../../general/sceneTypes";

type BoxCollider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type FlameCluster = {
  root: THREE.Group;
  outer: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  baseScale: number;
  phase: number;
  speed: number;
};

type SmokeSeed = {
  radius: number;
  angle: number;
  heightOffset: number;
  speed: number;
  drift: number;
  phase: number;
};

type EmberSeed = {
  radius: number;
  angle: number;
  height: number;
  speed: number;
  spin: number;
  phase: number;
};

type Vec3Tuple = [number, number, number];

export type BurningFactoryRelativeAnchor = "mada" | "duo";
export type BurningFactoryPreScene4Anchor = BurningFactoryRelativeAnchor | "world";

export type BurningFactoryRelativeCameraShotPreset = {
  anchor: BurningFactoryRelativeAnchor;
  initialPosition: Vec3Tuple;
  initialLookAtOffset: Vec3Tuple;
};

export type BurningFactoryPreScene3CameraShotPreset =
  BurningFactoryRelativeCameraShotPreset & {
    secondHalf?: BurningFactoryRelativeCameraShotPreset & {
      splitProgress?: number;
    };
  };

export type BurningFactoryPreScene4CameraShotPreset = {
  anchor: BurningFactoryPreScene4Anchor;
  initialPosition: Vec3Tuple;
  initialLookAtOffset: Vec3Tuple;
  endPosition: Vec3Tuple;
};

export type BurningFactoryAbsoluteCameraShotPreset = {
  initialPosition: Vec3Tuple;
  initialLookAt: Vec3Tuple;
};

export type BurningFactoryScene1OrbitPreset = {
  center: Vec3Tuple;
  radiusStart: number;
  radiusEnd: number;
  heightStart: number;
  heightEnd: number;
  angleSpeed: number;
  angleStartBias: number;
};

export type BurningFactoryScene1CameraShotPreset =
  BurningFactoryAbsoluteCameraShotPreset & {
    orbit: BurningFactoryScene1OrbitPreset;
  };

export type BurningFactoryCameraPreset = {
  preScene1: BurningFactoryRelativeCameraShotPreset;
  preScene2: BurningFactoryRelativeCameraShotPreset;
  preScene3: BurningFactoryPreScene3CameraShotPreset;
  preScene4: BurningFactoryPreScene4CameraShotPreset;
  scene1: BurningFactoryScene1CameraShotPreset;
  scene2: BurningFactoryAbsoluteCameraShotPreset;
};

export type BurningFactoryFightStageDefinition = {
  key: string;
  waitFor: "mada" | "both";
  showAgma: boolean;
  madaClipName: string | null;
  agmaClipName: string | null;
};

export type BurningFactoryFightConfig = {
  agmaModelPath: string;
  madaModelPath: string;
  targetModelHeight: number;
  stageSequence: readonly BurningFactoryFightStageDefinition[];
};

const seededRandom = (seed: number) => {
  const value = Math.sin(seed * 91.31 + 317.19) * 43758.5453;
  return value - Math.floor(value);
};

type FightStageDefinition = BurningFactoryFightStageDefinition;

const normalizeClipName = (clipName: string) => {
  const pipeIndex = clipName.lastIndexOf("|");
  const baseName = pipeIndex >= 0 ? clipName.slice(pipeIndex + 1) : clipName;
  return baseName.trim().toLowerCase();
};

const findArmatureGroups = (root: THREE.Object3D) => {
  const armatures: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node.name.toLowerCase().startsWith("armature")) {
      armatures.push(node);
    }
  });
  return armatures;
};

const findDuplicateBoneNames = (root: THREE.Object3D) => {
  const counts = new Map<string, number>();
  root.traverse((node) => {
    const maybeBone = node as THREE.Bone;
    if (!maybeBone.isBone) return;
    const key = maybeBone.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort();
};

const collectClipsByExactName = (clips: readonly THREE.AnimationClip[]) => {
  const byName = new Map<string, THREE.AnimationClip[]>();
  for (let i = 0; i < clips.length; i += 1) {
    const clip = clips[i];
    const normalizedName = normalizeClipName(clip.name);
    const list = byName.get(normalizedName);
    if (list) {
      list.push(clip);
    } else {
      byName.set(normalizedName, [clip]);
    }
  }
  return byName;
};

const resolveActorStageClips = (
  stageSequence: readonly FightStageDefinition[],
  actorKey: "agma" | "mada",
  actorLabel: string,
  clips: readonly THREE.AnimationClip[]
): Map<FightStageDefinition["key"], THREE.AnimationClip> | null => {
  const byName = collectClipsByExactName(clips);
  const resolved = new Map<FightStageDefinition["key"], THREE.AnimationClip>();

  for (let i = 0; i < stageSequence.length; i += 1) {
    const stage = stageSequence[i];
    const wantedName = actorKey === "agma" ? stage.agmaClipName : stage.madaClipName;
    if (!wantedName) {
      continue;
    }

    const matches = byName.get(normalizeClipName(wantedName)) ?? [];
    if (matches.length === 0) {
      console.warn(
        `[burningFactory] ${actorLabel} asset missing exact clip "${wantedName}".`
      );
      return null;
    }
    if (matches.length > 1) {
      console.warn(
        `[burningFactory] ${actorLabel} clip "${wantedName}" is ambiguous (${matches.length} exact-name matches).`
      );
      return null;
    }
    resolved.set(stage.key, matches[0]);
  }
  return resolved;
};

const validateFightModel = (
  actorLabel: string,
  model: THREE.Object3D
) => {
  const armatures = findArmatureGroups(model);
  if (armatures.length !== 1) {
    console.warn(
      `[burningFactory] ${actorLabel} asset invalid: expected exactly 1 armature, found ${armatures.length}.`
    );
    return false;
  }
  const duplicateBoneNames = findDuplicateBoneNames(model);
  if (duplicateBoneNames.length > 0) {
    console.warn(
      `[burningFactory] ${actorLabel} asset invalid: duplicate bone names detected (${duplicateBoneNames.length}).`,
      duplicateBoneNames.slice(0, 20)
    );
    return false;
  }
  return true;
};

export const createBurningFactoryScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext,
  cameraPreset?: BurningFactoryCameraPreset,
  fightConfig?: BurningFactoryFightConfig
): SceneSetupResult => {
  const resolvedFightConfig = fightConfig;
  const fightStageSequence = resolvedFightConfig?.stageSequence ?? [];
  const fightTargetHeight = resolvedFightConfig?.targetModelHeight ?? 9;
  if (!resolvedFightConfig) {
    console.warn(
      "[burningFactory] Missing fight config. BurningFactory fight sequence is disabled."
    );
  } else if (fightStageSequence.length === 0) {
    console.warn(
      "[burningFactory] Empty fight stage sequence. BurningFactory fight sequence is disabled."
    );
  }

  scene.background = new THREE.Color(0x040202);
  scene.fog = new THREE.Fog(0x120607, 16, 92);

  const groundY = -1.4;
  const floorSize = 120;
  const halfSize = floorSize / 2;
  const wallZ = halfSize - 5;
  const wallX = halfSize - 5;
  const battleRadius = 24;
  const bounds = {
    minX: -halfSize + 3,
    maxX: halfSize - 3,
    minZ: -halfSize + 3,
    maxZ: halfSize - 3,
  };

  const resourceTracker = createSceneResourceTracker();
  const {
    trackMesh,
    trackGeometry,
    trackMaterial,
    trackObject,
    disposeObjectResources,
    disposeTrackedResources,
  } = resourceTracker;

  const root = new THREE.Group();
  root.name = "burningFactoryScene";
  scene.add(root);

  type FightActorRuntime = {
    key: "agma" | "mada";
    label: "Agma" | "Mada";
    path: string;
    model: THREE.Object3D | null;
    mixer: THREE.AnimationMixer | null;
    actionsByStage: Map<FightStageDefinition["key"], THREE.AnimationAction>;
    currentAction: THREE.AnimationAction | null;
    finishedListener: ((event: THREE.Event) => void) | null;
    currentActionFinished: boolean;
    ready: boolean;
  };

  const createFightActor = (
    key: FightActorRuntime["key"],
    label: FightActorRuntime["label"],
    path: string
  ): FightActorRuntime => ({
    key,
    label,
    path,
    model: null,
    mixer: null,
    actionsByStage: new Map(),
    currentAction: null,
    finishedListener: null,
    currentActionFinished: false,
    ready: false,
  });

  const agmaActor = createFightActor(
    "agma",
    "Agma",
    resolvedFightConfig?.agmaModelPath ?? ""
  );
  const madaActor = createFightActor(
    "mada",
    "Mada",
    resolvedFightConfig?.madaModelPath ?? ""
  );
  const fightActors = [agmaActor, madaActor] as const;
  let fightStageIndex = -1;
  let hasStartedFightSequence = false;
  let hasReportedFightCompletion = false;
  let isDisposed = false;
  const cameraGoalPosition = new THREE.Vector3();
  const cameraGoalLookAt = new THREE.Vector3();
  const cameraCurrentPosition = new THREE.Vector3();
  const cameraCurrentLookAt = new THREE.Vector3();
  const preScene4StartPosition = new THREE.Vector3(0.45, groundY + 4.85, 14.2);
  const preScene4EndPosition = new THREE.Vector3(0.65, groundY + 4.15, 10.2);
  const scene1OrbitCenter = new THREE.Vector3(0, groundY + 2.6, 0);
  const madaFocus = new THREE.Vector3();
  const agmaFocus = new THREE.Vector3();
  const sharedFocus = new THREE.Vector3();
  const preScene4PresetStartPosition = new THREE.Vector3();
  const preScene4PresetEndPosition = new THREE.Vector3();
  let hasCameraState = false;

  const resolveAnchorPoint = (
    anchor: BurningFactoryRelativeAnchor,
    madaPoint: THREE.Vector3,
    duoPoint: THREE.Vector3
  ) => (anchor === "mada" ? madaPoint : duoPoint);

  const applyRelativeCameraShot = (
    shot: BurningFactoryRelativeCameraShotPreset,
    madaPoint: THREE.Vector3,
    duoPoint: THREE.Vector3
  ) => {
    const anchorPoint = resolveAnchorPoint(shot.anchor, madaPoint, duoPoint);
    cameraGoalPosition.set(
      anchorPoint.x + shot.initialPosition[0],
      anchorPoint.y + shot.initialPosition[1],
      anchorPoint.z + shot.initialPosition[2]
    );
    cameraGoalLookAt.set(
      anchorPoint.x + shot.initialLookAtOffset[0],
      anchorPoint.y + shot.initialLookAtOffset[1],
      anchorPoint.z + shot.initialLookAtOffset[2]
    );
  };

  const emitFightState = (
    stage: FightStageDefinition["key"],
    completed: boolean
  ) => {
    context?.onStateChange?.({
      burningFactoryFightStage: stage,
      burningFactoryFightCompleted: completed,
    });
  };

  const hasBothActorsReady = () => fightActors.every((actor) => actor.ready);

  const updateActorVisibilityForStage = (stage: FightStageDefinition) => {
    if (agmaActor.model) {
      agmaActor.model.visible = stage.showAgma;
    }
    if (madaActor.model) {
      madaActor.model.visible = true;
    }
  };

  const playActorStageAction = (
    actor: FightActorRuntime,
    stage: FightStageDefinition
  ) => {
    if (!actor.mixer) {
      return false;
    }
    const wantedClipName = actor.key === "agma" ? stage.agmaClipName : stage.madaClipName;
    if (!wantedClipName) {
      if (actor.currentAction) {
        actor.currentAction.stop();
      }
      actor.currentAction = null;
      actor.currentActionFinished = true;
      return true;
    }
    const nextAction = actor.actionsByStage.get(stage.key);
    if (!nextAction) {
      return false;
    }
    if (actor.currentAction && actor.currentAction !== nextAction) {
      actor.currentAction.stop();
    }
    actor.currentAction = nextAction;
    nextAction.enabled = true;
    nextAction.clampWhenFinished = true;
    nextAction.setLoop(THREE.LoopOnce, 1);
    nextAction.reset();
    nextAction.play();
    actor.currentActionFinished = false;
    return true;
  };

  const playFightStageAt = (index: number) => {
    if (!hasBothActorsReady()) return;
    if (index < 0 || index >= fightStageSequence.length) return;

    const stage = fightStageSequence[index];
    const madaPlayed = playActorStageAction(madaActor, stage);
    const agmaPlayed = playActorStageAction(agmaActor, stage);
    if (!agmaPlayed || !madaPlayed) {
      return;
    }
    fightStageIndex = index;
    updateActorVisibilityForStage(stage);
    emitFightState(stage.key, false);
  };

  const maybeAdvanceFightStage = () => {
    if (!hasStartedFightSequence) return;
    if (fightStageIndex < 0) return;

    const stage = fightStageSequence[fightStageIndex];
    if (stage.waitFor === "mada") {
      if (!madaActor.currentActionFinished) return;
    } else {
      if (!agmaActor.currentActionFinished || !madaActor.currentActionFinished) {
        return;
      }
    }

    if (fightStageIndex >= fightStageSequence.length - 1) {
      if (!hasReportedFightCompletion) {
        hasReportedFightCompletion = true;
        emitFightState(stage.key, true);
      }
      return;
    }
    playFightStageAt(fightStageIndex + 1);
  };

  const maybeStartFightStage = () => {
    if (hasStartedFightSequence) return;
    if (!hasBothActorsReady()) return;
    if (fightStageSequence.length === 0) return;
    hasStartedFightSequence = true;
    playFightStageAt(0);
  };

  const resolveActorFocus = (
    actor: FightActorRuntime,
    out: THREE.Vector3,
    fallback: THREE.Vector3
  ) => {
    if (!actor.model) {
      out.copy(fallback);
      return;
    }
    actor.model.getWorldPosition(out);
    out.y = groundY + 3.4;
  };

  const resolveStageProgress = (stageKey: FightStageDefinition["key"]) => {
    const measure = (action: THREE.AnimationAction | null) => {
      if (!action) return null;
      const clip = action.getClip();
      if (!clip || clip.duration <= 0.0001) return null;
      return THREE.MathUtils.clamp(action.time / clip.duration, 0, 1);
    };
    const madaProgress = measure(madaActor.currentAction);
    const agmaProgress = measure(agmaActor.currentAction);
    if (stageKey === "scene1") {
      return (
        (madaProgress !== null && agmaProgress !== null
          ? (madaProgress + agmaProgress) * 0.5
          : madaProgress ?? agmaProgress) ?? 0
      );
    }
    if (stageKey === "preScene3" || stageKey === "preScene4") {
      return madaProgress ?? agmaProgress ?? 0;
    }
    return 0;
  };

  const resolveCameraGoal = (now: number) => {
    if (fightStageSequence.length === 0) {
      cameraGoalPosition.set(0, groundY + 8, 14);
      cameraGoalLookAt.set(0, groundY + 3.2, 0);
      return;
    }

    const currentStage =
      fightStageIndex >= 0 && fightStageIndex < fightStageSequence.length
        ? fightStageSequence[fightStageIndex]
        : fightStageSequence[0];

    const baseCenter = hasCameraState
      ? sharedFocus.copy(cameraCurrentLookAt)
      : sharedFocus.set(0, groundY + 3.2, 0);
    resolveActorFocus(madaActor, madaFocus, baseCenter);
    resolveActorFocus(agmaActor, agmaFocus, baseCenter);
    const duoCenter = sharedFocus.copy(madaFocus).add(agmaFocus).multiplyScalar(0.5);
    const stageProgress = resolveStageProgress(currentStage.key);

    if (cameraPreset) {
      if (currentStage.key === "preScene1") {
        applyRelativeCameraShot(cameraPreset.preScene1, madaFocus, duoCenter);
        return;
      }
      if (currentStage.key === "preScene2") {
        applyRelativeCameraShot(cameraPreset.preScene2, madaFocus, duoCenter);
        return;
      }
      if (currentStage.key === "preScene3") {
        const stagePreset = cameraPreset.preScene3;
        const secondHalf = stagePreset.secondHalf;
        const splitProgress = THREE.MathUtils.clamp(
          secondHalf?.splitProgress ?? 0.5,
          0,
          1
        );
        if (secondHalf && stageProgress >= splitProgress) {
          applyRelativeCameraShot(secondHalf, madaFocus, duoCenter);
        } else {
          applyRelativeCameraShot(stagePreset, madaFocus, duoCenter);
        }
        return;
      }
      if (currentStage.key === "preScene4") {
        const stagePreset = cameraPreset.preScene4;
        if (stagePreset.anchor === "world") {
          preScene4PresetStartPosition.set(
            stagePreset.initialPosition[0],
            stagePreset.initialPosition[1],
            stagePreset.initialPosition[2]
          );
          preScene4PresetEndPosition.set(
            stagePreset.endPosition[0],
            stagePreset.endPosition[1],
            stagePreset.endPosition[2]
          );
          cameraGoalPosition
            .copy(preScene4PresetStartPosition)
            .lerp(preScene4PresetEndPosition, stageProgress);
          cameraGoalLookAt.set(
            stagePreset.initialLookAtOffset[0],
            stagePreset.initialLookAtOffset[1],
            stagePreset.initialLookAtOffset[2]
          );
        } else {
          const anchorPoint = resolveAnchorPoint(stagePreset.anchor, madaFocus, duoCenter);
          preScene4PresetStartPosition.set(
            anchorPoint.x + stagePreset.initialPosition[0],
            anchorPoint.y + stagePreset.initialPosition[1],
            anchorPoint.z + stagePreset.initialPosition[2]
          );
          preScene4PresetEndPosition.set(
            anchorPoint.x + stagePreset.endPosition[0],
            anchorPoint.y + stagePreset.endPosition[1],
            anchorPoint.z + stagePreset.endPosition[2]
          );
          cameraGoalPosition
            .copy(preScene4PresetStartPosition)
            .lerp(preScene4PresetEndPosition, stageProgress);
          cameraGoalLookAt.set(
            anchorPoint.x + stagePreset.initialLookAtOffset[0],
            anchorPoint.y + stagePreset.initialLookAtOffset[1],
            anchorPoint.z + stagePreset.initialLookAtOffset[2]
          );
        }
        return;
      }
      if (currentStage.key === "scene1") {
        const stagePreset = cameraPreset.scene1;
        const orbit = stagePreset.orbit;
        const angle = orbit.angleStartBias + stageProgress * 1.8 + now * orbit.angleSpeed;
        const radius = THREE.MathUtils.lerp(orbit.radiusStart, orbit.radiusEnd, stageProgress);
        const height = THREE.MathUtils.lerp(orbit.heightStart, orbit.heightEnd, stageProgress);
        const centerX = orbit.center[0];
        const centerY = orbit.center[1];
        const centerZ = orbit.center[2];
        cameraGoalPosition.set(
          centerX + Math.sin(angle) * radius,
          centerY + height,
          centerZ + Math.cos(angle) * radius
        );
        cameraGoalLookAt.set(centerX, centerY, centerZ);
        return;
      }
      cameraGoalPosition.set(
        cameraPreset.scene2.initialPosition[0],
        cameraPreset.scene2.initialPosition[1],
        cameraPreset.scene2.initialPosition[2]
      );
      cameraGoalLookAt.set(
        cameraPreset.scene2.initialLookAt[0],
        cameraPreset.scene2.initialLookAt[1],
        cameraPreset.scene2.initialLookAt[2]
      );
      return;
    }

    if (currentStage.key === "preScene1") {
      cameraGoalPosition.set(madaFocus.x - 0.3, madaFocus.y + 1.7, madaFocus.z + 11.4);
      cameraGoalLookAt.set(madaFocus.x, madaFocus.y + 0.4, madaFocus.z);
      return;
    }
    if (currentStage.key === "preScene2") {
      cameraGoalPosition.set(madaFocus.x + 0.25, madaFocus.y + 1.8, madaFocus.z + 10.6);
      cameraGoalLookAt.set(madaFocus.x, madaFocus.y + 0.35, madaFocus.z);
      return;
    }
    if (currentStage.key === "preScene3") {
      cameraGoalPosition.set(duoCenter.x + 0.2, duoCenter.y + 1.4, duoCenter.z + 14.4);
      cameraGoalLookAt.set(madaFocus.x, madaFocus.y + 0.28, madaFocus.z);
      return;
    }
    if (currentStage.key === "preScene4") {
      cameraGoalPosition.copy(preScene4StartPosition).lerp(preScene4EndPosition, stageProgress);
      cameraGoalLookAt.set(madaFocus.x, madaFocus.y + 0.28, madaFocus.z);
      return;
    }
    if (currentStage.key === "scene1") {
      scene1OrbitCenter.set(madaFocus.x, groundY + 2.6, madaFocus.z);
      const angle = -0.42 + stageProgress * 1.8 + now * 0.00008;
      const radius = THREE.MathUtils.lerp(18, 11.5, stageProgress);
      const height = THREE.MathUtils.lerp(20.5, 13.8, stageProgress);
      cameraGoalPosition.set(
        scene1OrbitCenter.x + Math.sin(angle) * radius,
        scene1OrbitCenter.y + height,
        scene1OrbitCenter.z + Math.cos(angle) * radius
      );
      cameraGoalLookAt.set(madaFocus.x, madaFocus.y + 0.2, madaFocus.z);
      return;
    }
    cameraGoalPosition.set(duoCenter.x + 0.56, duoCenter.y + 0.76, duoCenter.z + 7.6);
    cameraGoalLookAt.set(madaFocus.x, madaFocus.y + 0.18, madaFocus.z);
  };

  const updateCinematicCamera = (now: number, delta: number, camera: THREE.PerspectiveCamera) => {
    resolveCameraGoal(now);
    const safeDelta = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.1)) : 0.016;
    if (!hasCameraState) {
      cameraCurrentPosition.copy(cameraGoalPosition);
      cameraCurrentLookAt.copy(cameraGoalLookAt);
      hasCameraState = true;
    } else {
      const blend = THREE.MathUtils.clamp(1 - Math.exp(-8.5 * safeDelta), 0, 1);
      cameraCurrentPosition.lerp(cameraGoalPosition, blend);
      cameraCurrentLookAt.lerp(cameraGoalLookAt, blend);
    }
    camera.position.copy(cameraCurrentPosition);
    camera.lookAt(cameraCurrentLookAt);
  };

  const bindActorSequence = (
    actor: FightActorRuntime,
    resolvedStageClips: Map<FightStageDefinition["key"], THREE.AnimationClip>
  ) => {
    if (!actor.model || resolvedStageClips.size === 0) return;
    const mixer = new THREE.AnimationMixer(actor.model);
    actor.mixer = mixer;
    actor.actionsByStage.clear();
    for (const [stageKey, clip] of resolvedStageClips.entries()) {
      actor.actionsByStage.set(stageKey, mixer.clipAction(clip));
    }
    actor.currentAction = null;
    actor.currentActionFinished = false;
    actor.ready = true;

    const handleFinished = (
      event: THREE.Event & {
        action?: THREE.AnimationAction;
      }
    ) => {
      if (!actor.currentAction) return;
      if (event.action !== actor.currentAction) return;
      actor.currentActionFinished = true;
      maybeAdvanceFightStage();
    };

    actor.finishedListener = handleFinished as (event: THREE.Event) => void;
    mixer.addEventListener("finished", actor.finishedListener);
    maybeStartFightStage();
  };

  const loadFightActor = (actor: FightActorRuntime) => {
    if (!actor.path) {
      console.warn(
        `[burningFactory] ${actor.label} model path is missing. ${actor.label} sequence will not play.`
      );
      return;
    }
    const loader = new GLTFLoader();
    loader.load(
      actor.path,
      (gltf) => {
        if (isDisposed) {
          disposeObjectResources(gltf.scene);
          return;
        }

        actor.model = gltf.scene;
        actor.model.visible = false;
        root.add(actor.model);
        trackObject(actor.model, { castShadow: true, receiveShadow: true });
        actor.model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.frustumCulled = false;
        });

        actor.model.position.set(0, 0, 0);
        actor.model.updateMatrixWorld(true);

        const bounds = new THREE.Box3().setFromObject(actor.model);
        const modelHeight = bounds.max.y - bounds.min.y;
        if (Number.isFinite(modelHeight) && modelHeight > 0.0001) {
          const uniformScale = fightTargetHeight / modelHeight;
          actor.model.scale.multiplyScalar(uniformScale);
          actor.model.updateMatrixWorld(true);
        }

        bounds.setFromObject(actor.model);
        actor.model.position.y += groundY - bounds.min.y;
        actor.model.updateMatrixWorld(true);

        const clips = gltf.animations ?? [];
        if (!validateFightModel(actor.label, actor.model)) {
          console.warn(
            `[burningFactory] ${actor.label} sequence will not play. Waiting for a compliant ${actor.label} asset export.`
          );
          return;
        }
        const resolvedStageClips = resolveActorStageClips(
          fightStageSequence,
          actor.key,
          actor.label,
          clips
        );
        if (!resolvedStageClips) {
          console.warn(
            `[burningFactory] ${actor.label} sequence will not play. Required exact-name clips are missing.`
          );
          return;
        }
        bindActorSequence(actor, resolvedStageClips);
      },
      undefined,
      (error) => {
        console.warn(`[burningFactory] Failed to load ${actor.label} GLB.`, error);
      }
    );
  };

  loadFightActor(agmaActor);
  loadFightActor(madaActor);

  const colliders: BoxCollider[] = [];
  const addCollider = (
    x: number,
    z: number,
    width: number,
    depth: number,
    padding = 0.38
  ) => {
    colliders.push({
      minX: x - width / 2 - padding,
      maxX: x + width / 2 + padding,
      minZ: z - depth / 2 - padding,
      maxZ: z + depth / 2 + padding,
    });
  };

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x181112,
    roughness: 0.96,
    metalness: 0.04,
    emissive: 0x180708,
    emissiveIntensity: 0.32,
  });
  const battleGroundMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1c1a,
    roughness: 0.95,
    metalness: 0.03,
    emissive: 0x1f0a08,
    emissiveIntensity: 0.38,
  });
  const stainMaterial = new THREE.MeshStandardMaterial({
    color: 0x150c0d,
    roughness: 1,
    metalness: 0,
    emissive: 0x130707,
    emissiveIntensity: 0.24,
    transparent: true,
    opacity: 0.74,
    side: THREE.DoubleSide,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2021,
    roughness: 0.9,
    metalness: 0.18,
    emissive: 0x17090a,
    emissiveIntensity: 0.2,
  });
  const wallEdgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a2827,
    roughness: 0.76,
    metalness: 0.24,
    emissive: 0x2c100f,
    emissiveIntensity: 0.25,
  });
  const beamMaterial = new THREE.MeshStandardMaterial({
    color: 0x322523,
    roughness: 0.78,
    metalness: 0.28,
    emissive: 0x1d0a09,
    emissiveIntensity: 0.21,
  });
  const rubbleMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b302f,
    roughness: 0.94,
    metalness: 0.08,
    emissive: 0x190c0b,
    emissiveIntensity: 0.12,
  });
  const brokenSlabMaterial = new THREE.MeshStandardMaterial({
    color: 0x332726,
    roughness: 0.9,
    metalness: 0.16,
    emissive: 0x1a0a09,
    emissiveIntensity: 0.16,
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorSize, floorSize),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = groundY;
  floor.receiveShadow = true;
  root.add(floor);
  trackMesh(floor);

  const battleGround = new THREE.Mesh(
    new THREE.CircleGeometry(battleRadius, 60),
    battleGroundMaterial
  );
  battleGround.rotation.x = -Math.PI / 2;
  battleGround.position.y = groundY + 0.02;
  battleGround.receiveShadow = true;
  root.add(battleGround);
  trackMesh(battleGround);

  for (let i = 0; i < 11; i += 1) {
    const stain = new THREE.Mesh(
      new THREE.CircleGeometry(2.5 + seededRandom(11 + i) * 5.2, 26),
      stainMaterial
    );
    const angle = seededRandom(44 + i) * Math.PI * 2;
    const radius = seededRandom(77 + i) * (battleRadius - 3.4);
    stain.rotation.x = -Math.PI / 2;
    stain.rotation.z = seededRandom(101 + i) * Math.PI * 2;
    stain.position.set(
      Math.cos(angle) * radius,
      groundY + 0.03,
      Math.sin(angle) * radius
    );
    root.add(stain);
    trackMesh(stain);
  }

  const battleCenterAnchor = new THREE.Object3D();
  battleCenterAnchor.name = "burningFactoryBattleCenter";
  battleCenterAnchor.position.set(0, groundY + 0.05, 0);
  root.add(battleCenterAnchor);

  const addWallSegment = (
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    withCollider = true
  ) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      wallMaterial
    );
    wall.position.set(x, groundY + height / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    root.add(wall);
    trackMesh(wall);
    if (withCollider) {
      addCollider(x, z, width, depth);
    }
  };

  const addBrokenColumn = (x: number, z: number, height: number) => {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, height, 2.1),
      wallEdgeMaterial
    );
    column.position.set(x, groundY + height / 2, z);
    column.castShadow = true;
    column.receiveShadow = true;
    root.add(column);
    trackMesh(column);

    const brokenTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.36, 2.4),
      brokenSlabMaterial
    );
    brokenTop.position.set(x, groundY + height + 0.08, z);
    brokenTop.rotation.y = seededRandom(130 + x + z) * Math.PI * 2;
    brokenTop.castShadow = true;
    brokenTop.receiveShadow = true;
    root.add(brokenTop);
    trackMesh(brokenTop);
  };

  addWallSegment(-19, -wallZ, 30, 2, 7.4);
  addWallSegment(19, -wallZ, 30, 2, 7.6);
  addWallSegment(-19, wallZ, 30, 2, 7.2);
  addWallSegment(19, wallZ, 30, 2, 7.5);
  addWallSegment(-wallX, -19, 2, 30, 7.4);
  addWallSegment(-wallX, 19, 2, 30, 7.6);
  addWallSegment(wallX, -19, 2, 30, 7.4);
  addWallSegment(wallX, 19, 2, 30, 7.6);

  addBrokenColumn(-39, -39, 6.8);
  addBrokenColumn(39, -39, 7.1);
  addBrokenColumn(-39, 39, 6.6);
  addBrokenColumn(39, 39, 7);
  addBrokenColumn(-45, 0, 6.2);
  addBrokenColumn(45, 0, 6.4);
  addBrokenColumn(0, -45, 6.3);
  addBrokenColumn(0, 45, 6.3);

  const beamGeometry = new THREE.BoxGeometry(10.5, 0.45, 1.15);
  const beamCount = 18;
  const beams = new THREE.InstancedMesh(beamGeometry, beamMaterial, beamCount);
  beams.castShadow = true;
  beams.receiveShadow = true;
  root.add(beams);
  trackMesh(beams);

  const beamDummy = new THREE.Object3D();
  for (let i = 0; i < beamCount; i += 1) {
    const angle = seededRandom(170 + i) * Math.PI * 2;
    const radius = 28 + seededRandom(220 + i) * 17;
    beamDummy.position.set(
      Math.cos(angle) * radius,
      groundY + 0.5 + seededRandom(240 + i) * 1.8,
      Math.sin(angle) * radius
    );
    beamDummy.rotation.set(
      seededRandom(260 + i) * 0.7,
      seededRandom(280 + i) * Math.PI * 2,
      seededRandom(300 + i) * 0.7
    );
    beamDummy.scale.set(
      0.85 + seededRandom(320 + i) * 0.8,
      1,
      0.9 + seededRandom(340 + i) * 0.7
    );
    beamDummy.updateMatrix();
    beams.setMatrixAt(i, beamDummy.matrix);
  }
  beams.instanceMatrix.needsUpdate = true;

  const rubbleGeometry = new THREE.DodecahedronGeometry(0.95, 0);
  const rubbleCount = 130;
  const rubble = new THREE.InstancedMesh(
    rubbleGeometry,
    rubbleMaterial,
    rubbleCount
  );
  rubble.castShadow = true;
  rubble.receiveShadow = true;
  root.add(rubble);
  trackMesh(rubble);

  const rubbleDummy = new THREE.Object3D();
  for (let i = 0; i < rubbleCount; i += 1) {
    const angle = seededRandom(350 + i) * Math.PI * 2;
    const radius = battleRadius + 4 + seededRandom(410 + i) * 19;
    const scale = 0.7 + seededRandom(450 + i) * 2.1;
    rubbleDummy.position.set(
      Math.cos(angle) * radius,
      groundY + scale * 0.46,
      Math.sin(angle) * radius
    );
    rubbleDummy.rotation.set(
      seededRandom(480 + i) * Math.PI,
      seededRandom(510 + i) * Math.PI,
      seededRandom(540 + i) * Math.PI
    );
    rubbleDummy.scale.setScalar(scale);
    rubbleDummy.updateMatrix();
    rubble.setMatrixAt(i, rubbleDummy.matrix);
  }
  rubble.instanceMatrix.needsUpdate = true;

  const flameOuterMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6a2d,
    roughness: 0.26,
    metalness: 0.06,
    emissive: 0xff3d1e,
    emissiveIntensity: 1.05,
    transparent: true,
    opacity: 0.84,
    side: THREE.DoubleSide,
  });
  const flameCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb061,
    transparent: true,
    opacity: 0.64,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flameOuterGeometry = new THREE.ConeGeometry(0.78, 3.6, 12, 1, true);
  const flameCoreGeometry = new THREE.SphereGeometry(0.8, 10, 10);

  const flameClusters: FlameCluster[] = [];
  const addFlameCluster = (x: number, z: number, seed: number) => {
    const clusterRoot = new THREE.Group();
    clusterRoot.position.set(x, groundY + 0.14, z);

    const outer = new THREE.Mesh(flameOuterGeometry, flameOuterMaterial);
    outer.position.y = 1.4;
    clusterRoot.add(outer);
    trackMesh(outer);

    const core = new THREE.Mesh(flameCoreGeometry, flameCoreMaterial);
    core.position.y = 0.86;
    clusterRoot.add(core);
    trackMesh(core);

    root.add(clusterRoot);
    flameClusters.push({
      root: clusterRoot,
      outer,
      core,
      baseScale: 0.82 + seededRandom(seed) * 0.42,
      phase: seededRandom(seed + 13) * Math.PI * 2,
      speed: 0.75 + seededRandom(seed + 29) * 0.55,
    });
  };

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = battleRadius + 6 + (i % 2) * 3.5;
    addFlameCluster(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      610 + i * 23
    );
  }

  const smokeCount = 24;
  const smokePositions = new Float32Array(smokeCount * 3);
  const smokeSeeds: SmokeSeed[] = [];
  for (let i = 0; i < smokeCount; i += 1) {
    smokeSeeds.push({
      radius: battleRadius + 5 + seededRandom(710 + i) * 18,
      angle: seededRandom(740 + i) * Math.PI * 2,
      heightOffset: seededRandom(760 + i) * 4.8,
      speed: 0.22 + seededRandom(780 + i) * 0.4,
      drift: 0.45 + seededRandom(810 + i) * 0.95,
      phase: seededRandom(830 + i) * Math.PI * 2,
    });
  }
  const smokeGeometry = new THREE.BufferGeometry();
  smokeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(smokePositions, 3)
  );
  const smokeMaterial = new THREE.PointsMaterial({
    color: 0x3a2f2f,
    size: 2.2,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const smokePoints = new THREE.Points(smokeGeometry, smokeMaterial);
  root.add(smokePoints);
  trackGeometry(smokeGeometry);
  trackMaterial(smokeMaterial);

  const emberCount = 38;
  const emberPositions = new Float32Array(emberCount * 3);
  const emberSeeds: EmberSeed[] = [];
  for (let i = 0; i < emberCount; i += 1) {
    emberSeeds.push({
      radius: 8 + seededRandom(920 + i) * 26,
      angle: seededRandom(940 + i) * Math.PI * 2,
      height: 0.8 + seededRandom(960 + i) * 2.8,
      speed: 0.3 + seededRandom(980 + i) * 0.78,
      spin: 0.42 + seededRandom(1000 + i) * 1.24,
      phase: seededRandom(1030 + i) * Math.PI * 2,
    });
  }
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(emberPositions, 3)
  );
  const emberMaterial = new THREE.PointsMaterial({
    color: 0xff8a45,
    size: 0.38,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const emberPoints = new THREE.Points(emberGeometry, emberMaterial);
  root.add(emberPoints);
  trackGeometry(emberGeometry);
  trackMaterial(emberMaterial);

  const ambient = new THREE.AmbientLight(0x2f1513, 0.7);
  root.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xff7b38, 0.48);
  keyLight.position.set(-18, 22, 16);
  keyLight.castShadow = false;
  root.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x54231c, 0.32);
  fillLight.position.set(20, 10, -18);
  fillLight.castShadow = false;
  root.add(fillLight);

  const globalFireLight = new THREE.PointLight(0xff5e2a, 1.9, 46, 2.1);
  globalFireLight.position.set(0, groundY + 4.8, 0);
  globalFireLight.castShadow = false;
  root.add(globalFireLight);

  const edgeFireLight = new THREE.PointLight(0xff421f, 1.2, 28, 2.2);
  edgeFireLight.position.set(-20, groundY + 4.2, -17);
  edgeFireLight.castShadow = false;
  root.add(edgeFireLight);

  let lastEffectsUpdateAt = 0;
  const EFFECT_UPDATE_INTERVAL_MS = 33;

  const world = {
    sceneId: "burningFactory",
    groundY,
    playerSpawn: new THREE.Vector3(0, groundY, -240),
    bounds,
    projectileColliders: [root] as THREE.Object3D[],
    isInputLocked: () => true,
    isMiniMapVisible: () => false,
    isBlocked: (x: number, z: number) => {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
        return true;
      }
      for (let i = 0; i < colliders.length; i += 1) {
        const collider = colliders[i];
        if (
          x >= collider.minX &&
          x <= collider.maxX &&
          z >= collider.minZ &&
          z <= collider.maxZ
        ) {
          return true;
        }
      }
      return false;
    },
    onTick: ({ now, delta, camera }: PlayerWorldTickArgs) => {
      const animationDelta = Math.max(0, Math.min(delta, 0.1));
      for (let i = 0; i < fightActors.length; i += 1) {
        const actor = fightActors[i];
        if (actor.mixer) {
          actor.mixer.update(animationDelta);
        }
      }
      updateCinematicCamera(now, delta, camera);
      if (now - lastEffectsUpdateAt < EFFECT_UPDATE_INTERVAL_MS) {
        return;
      }
      lastEffectsUpdateAt = now;
      const t = now * 0.001;

      for (let i = 0; i < flameClusters.length; i += 1) {
        const flame = flameClusters[i];
        const pulse =
          0.9 +
          Math.sin(t * (2.8 + flame.speed) + flame.phase) * 0.22 +
          Math.cos(t * (2 + flame.speed * 0.7) + flame.phase * 0.8) * 0.1;
        flame.root.scale.setScalar(flame.baseScale * (0.92 + pulse * 0.32));
        flame.root.position.y =
          groundY + 0.12 + Math.sin(t * (3.9 + flame.speed) + flame.phase) * 0.16;
        flame.outer.material.opacity = 0.68 + pulse * 0.16;
        flame.core.material.opacity = 0.42 + pulse * 0.18;
      }

      for (let i = 0; i < smokeCount; i += 1) {
        const seed = smokeSeeds[i];
        const rise = ((t * seed.speed + seed.phase * 0.25) % 1 + 1) % 1;
        const driftAngle = t * (0.35 + seed.speed * 0.4) + seed.phase;
        const x =
          Math.cos(seed.angle) * seed.radius +
          Math.cos(driftAngle) * seed.drift * (0.4 + rise);
        const z =
          Math.sin(seed.angle) * seed.radius +
          Math.sin(driftAngle) * seed.drift * (0.4 + rise);
        const y = groundY + 1.3 + seed.heightOffset * 0.35 + rise * 7.2;
        const index = i * 3;
        smokePositions[index] = x;
        smokePositions[index + 1] = y;
        smokePositions[index + 2] = z;
      }
      smokeGeometry.attributes.position.needsUpdate = true;

      for (let i = 0; i < emberCount; i += 1) {
        const seed = emberSeeds[i];
        const orbit = t * seed.spin + seed.phase;
        const rise = ((t * seed.speed + seed.phase * 0.41) % 1 + 1) % 1;
        const x = Math.cos(orbit) * seed.radius * (0.72 + rise * 0.26);
        const z = Math.sin(orbit) * seed.radius * (0.72 + rise * 0.26);
        const y = groundY + seed.height + rise * 2.4;
        const index = i * 3;
        emberPositions[index] = x;
        emberPositions[index + 1] = y;
        emberPositions[index + 2] = z;
      }
      emberGeometry.attributes.position.needsUpdate = true;

      const globalPulse = 0.86 + Math.sin(t * 2.1) * 0.18;
      globalFireLight.intensity = 1.35 + globalPulse * 0.7;
      edgeFireLight.intensity = 0.82 + globalPulse * 0.42;
    },
  };

  const dispose = () => {
    isDisposed = true;
    for (let i = 0; i < fightActors.length; i += 1) {
      const actor = fightActors[i];
      if (actor.mixer) {
        if (actor.finishedListener) {
          actor.mixer.removeEventListener("finished", actor.finishedListener);
        }
        actor.mixer.stopAllAction();
        if (actor.model) {
          actor.mixer.uncacheRoot(actor.model);
        }
      }
      actor.mixer = null;
      actor.finishedListener = null;
      actor.actionsByStage.clear();
      actor.currentAction = null;
      actor.currentActionFinished = false;
      actor.ready = false;
      if (actor.model) {
        actor.model.removeFromParent();
        actor.model = null;
      }
    }
    hasStartedFightSequence = false;
    hasReportedFightCompletion = false;
    fightStageIndex = -1;
    hasCameraState = false;
    scene.remove(root);
    disposeTrackedResources();
  };

  return { world, dispose };
};
