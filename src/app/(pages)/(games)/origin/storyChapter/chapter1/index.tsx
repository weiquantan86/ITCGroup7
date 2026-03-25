import SceneLauncher from "@/app/asset/scenes/general/SceneLauncher";
import { createSceneResourceTracker } from "@/app/asset/scenes/general/resourceTracker";
import type {
  PlayerAttackTarget,
  PlayerUiState,
  PlayerWorldTickArgs,
} from "@/app/asset/entity/character/general/player";
import { Monster } from "@/app/asset/entity/monster/general";
import type {
  SceneDefinition,
  SceneSetupContext,
  SceneSetupResult,
  SceneUiState,
} from "@/app/asset/scenes/general/sceneTypes";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  StoryChapterComponentProps,
  StoryChapterDefinition,
} from "../types";
import originStyles from "../../origin.module.css";

const chapter1Rules = {
  sceneCallRules: [
    "Load chapter1 scene seed and chapter1 environment bindings.",
    "Keep scene host isolated so each chapter can replace only center frame logic.",
    "Expose chapter-level lifecycle hooks for future battle scene wiring.",
  ],
  rightPanelFillRules: [
    "Right panel pulls all visible content from chapter rules and chapter metadata.",
    "Rule cards are rendered in grouped sections with fixed order and stable labels.",
    "Panel content is chapter-owned and should not read from page-local hardcoded strings.",
  ],
  gameRules: [
    "Chapter1 currently runs as structure preview: no gameplay runtime attached yet.",
    "Future gameplay components should be registered in this chapter module only.",
    "Chapter switch should replace center and right panel content without reloading page shell.",
  ],
  displayRules: [
    "Left panel acts as chapter navigator and active item stays underlined.",
    "Center panel is chapter-owned frame placeholder for chapter game component.",
    "Right panel displays chapter summary and grouped rules for quick operator check.",
  ],
};

const chapter1IntroLines = [
  "Welcome to this world: Strike.",
  "A place filled with light and life. Mountains rise and fall, rivers wind, and forests whisper in the breeze.",
  "Across this land lives a strange kind of being: Strikers.",
  "They run, pulse, play freely, and laugh across this land.",
] as const;

const CHAPTER1_INTRO_TRANSITION_MS = 900;
const CHAPTER1_SCENE_CURTAIN_FADE_MS = 920;
const CHAPTER1_CONTROL_HINT_DELAY_MS = 2000;
const CHAPTER1_ADAM_PATH = "/assets/characters/adam/adam.glb";
const CHAPTER1_FLARE_SPAWN_X = 7;
const CHAPTER1_FLARE_SPAWN_Z = -6;
const CHAPTER1_FLARE_TALK_RANGE = 4.8;
const CHAPTER1_FLARE_GROUND_CLEARANCE = 0.015;
const CHAPTER1_FLARE_FOLLOW_TARGET_X = 34;
const CHAPTER1_FLARE_FOLLOW_TARGET_Z = -34;
const CHAPTER1_FLARE_FOLLOW_SPEED = 1.85;
const CHAPTER1_FLARE_FOLLOW_LEASH_DISTANCE = 5;
const CHAPTER1_FLARE_TURN_SPEED = Math.PI * 3.6;
const CHAPTER1_FLARE_FOLLOW_ARRIVAL_DISTANCE = 0.35;
const CHAPTER1_FLARE_BLOCKED_TARGET_ARRIVAL_DISTANCE = 1.4;
const CHAPTER1_FLARE_AVOIDANCE_CLEARANCE = 0.55;
const CHAPTER1_FLARE_AVOIDANCE_SEGMENT_LENGTH = 0.22;
const CHAPTER1_FLARE_AVOIDANCE_SAMPLE_ANGLES_DEG = [
  0, 16, -16, 32, -32, 48, -48, 64, -64, 84, -84, 112, -112, 144, -144,
] as const;
const CHAPTER1_WOOD_NODE_COUNT = 5;
const CHAPTER1_WOOD_PICKUP_DISTANCE = 1.3;
const CHAPTER1_RIGHT_PANEL_FADE_MS = 280;
const CHAPTER1_RIGHT_PANEL_FADE_FLOOR_OPACITY = 0.18;
const CHAPTER1_FLARE_DIALOGUE =
  'Flare: "Why so slow? The campfire festival is about to begin. You are new here, so I still need to teach you a few things. Follow me."';
const CHAPTER1_FLARE_DESTINATION_DIALOGUE =
  'Flare: "Keeping up? The campfire party needs more wood. You, go collect some."';

type Chapter1SceneUiState = {
  chapter1FlareNearby?: boolean;
  chapter1FlareReachedDestination?: boolean;
  chapter1PrimaryAttackUnlocked?: boolean;
  chapter1WoodCollected?: number;
  chapter1WoodTotal?: number;
};

function Chapter1GameFrame({
  chapterUiState,
  setChapterUiState,
}: StoryChapterComponentProps) {
  const [phase, setPhase] = useState<"idle" | "intro" | "transition" | "scene">(
    "idle"
  );
  const [introIndex, setIntroIndex] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [showSceneCurtain, setShowSceneCurtain] = useState(false);
  const [sceneCurtainTransparent, setSceneCurtainTransparent] = useState(false);
  const flareTalkedRef = useRef(false);
  const introTransitionTimerRef = useRef<number | null>(null);
  const sceneCurtainStartTimerRef = useRef<number | null>(null);
  const sceneCurtainHideTimerRef = useRef<number | null>(null);
  const sceneControlHintTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (introTransitionTimerRef.current !== null) {
      window.clearTimeout(introTransitionTimerRef.current);
      introTransitionTimerRef.current = null;
    }
    if (sceneCurtainStartTimerRef.current !== null) {
      window.clearTimeout(sceneCurtainStartTimerRef.current);
      sceneCurtainStartTimerRef.current = null;
    }
    if (sceneCurtainHideTimerRef.current !== null) {
      window.clearTimeout(sceneCurtainHideTimerRef.current);
      sceneCurtainHideTimerRef.current = null;
    }
    if (sceneControlHintTimerRef.current !== null) {
      window.clearTimeout(sceneControlHintTimerRef.current);
      sceneControlHintTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    flareTalkedRef.current = Boolean(chapterUiState.chapter1FlareTalked);
  }, [chapterUiState.chapter1FlareTalked]);

  const startIntro = useCallback(() => {
    clearTimers();
    flareTalkedRef.current = false;
    setIntroIndex(0);
    setPhase("intro");
    setSceneReady(false);
    setShowSceneCurtain(false);
    setSceneCurtainTransparent(false);
    setChapterUiState((previous) => ({
      ...previous,
      hideRightPanel: true,
      chapter1ControlHintVisible: false,
      chapter1FlareNearby: false,
      chapter1FlareTalked: false,
      chapter1FlareReachedDestination: false,
      chapter1PrimaryAttackUnlocked: false,
      chapter1WoodCollected: 0,
      chapter1WoodTotal: CHAPTER1_WOOD_NODE_COUNT,
    }));
  }, [clearTimers, setChapterUiState]);

  const advanceIntro = useCallback(() => {
    setIntroIndex((currentIndex) => {
      if (currentIndex >= chapter1IntroLines.length - 1) {
        clearTimers();
        setPhase("transition");
        introTransitionTimerRef.current = window.setTimeout(() => {
          introTransitionTimerRef.current = null;
          flareTalkedRef.current = false;
          setPhase("scene");
          setShowSceneCurtain(true);
          setSceneCurtainTransparent(false);
          setChapterUiState((previous) => ({
            ...previous,
            hideRightPanel: false,
            chapter1ControlHintVisible: false,
            chapter1FlareNearby: false,
            chapter1FlareTalked: false,
            chapter1FlareReachedDestination: false,
            chapter1PrimaryAttackUnlocked: false,
            chapter1WoodCollected: 0,
            chapter1WoodTotal: CHAPTER1_WOOD_NODE_COUNT,
          }));
        }, CHAPTER1_INTRO_TRANSITION_MS);
        return currentIndex;
      }
      return currentIndex + 1;
    });
  }, [clearTimers, setChapterUiState]);

  const loadForestScene = useCallback(async (): Promise<SceneDefinition> => {
    const { createForestScene } = await import(
      "@/app/asset/scenes/chapterScene/forest/sceneDefinition"
    );

    return {
      id: "forest",
      setupScene: (
        scene: THREE.Scene,
        context?: SceneSetupContext
      ): SceneSetupResult => {
        const baseResult = createForestScene(scene);
        const world = baseResult.world;
        const attackTargets = world?.attackTargets ?? [];
        if (world && !world.attackTargets) {
          world.attackTargets = attackTargets;
        }
        const flareGroundY = world?.groundY ?? -1.4;
        const flareSpawn = new THREE.Vector3(
          CHAPTER1_FLARE_SPAWN_X,
          flareGroundY,
          CHAPTER1_FLARE_SPAWN_Z
        );
        const flareTalkRangeSq = CHAPTER1_FLARE_TALK_RANGE ** 2;
        const flareLeashDistanceSq = CHAPTER1_FLARE_FOLLOW_LEASH_DISTANCE ** 2;
        const flareFollowTarget = new THREE.Vector3(
          CHAPTER1_FLARE_FOLLOW_TARGET_X,
          flareGroundY,
          CHAPTER1_FLARE_FOLLOW_TARGET_Z
        );

        const tracker = createSceneResourceTracker();
        const {
          trackMesh,
          trackObject,
          disposeObjectResources,
          disposeTrackedResources,
        } = tracker;

        const flareAnchor = new THREE.Group();
        flareAnchor.name = "chapter1FlareAnchor";
        flareAnchor.position.copy(flareSpawn);
        flareAnchor.rotation.y = Math.PI * 0.76;
        scene.add(flareAnchor);

        const flareLocatorLight = new THREE.PointLight(0xbe123c, 0.9, 11, 2);
        flareLocatorLight.position.set(0, 2.2, 0);
        flareAnchor.add(flareLocatorLight);

        const flareFallback = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.4, 1.1, 6, 14),
          new THREE.MeshStandardMaterial({
            color: 0x9f1239,
            roughness: 0.42,
            metalness: 0.26,
            emissive: 0x450a0a,
            emissiveIntensity: 0.62,
          })
        );
        flareFallback.position.y = 0.95;
        flareFallback.castShadow = true;
        flareFallback.receiveShadow = true;
        flareAnchor.add(flareFallback);
        trackMesh(flareFallback);

        type ChapterWoodNode = {
          id: string;
          root: THREE.Group;
          markerMesh: THREE.Mesh;
          beamMesh: THREE.Mesh;
          markerMaterial: THREE.MeshStandardMaterial;
          beamMaterial: THREE.MeshStandardMaterial;
          ringMaterial: THREE.MeshStandardMaterial;
          collectible: boolean;
          collected: boolean;
          pulseOffset: number;
          pickupScale: number;
          pickupSpinSpeed: number;
          monster: Monster;
          attackTarget: PlayerAttackTarget;
        };

        const playerPosition = new THREE.Vector3();
        const flarePosition = new THREE.Vector3();
        const flareAnchorWorldPosition = new THREE.Vector3();
        const flareToPlayerDirection = new THREE.Vector3();
        const flareToTargetDirection = new THREE.Vector3();
        const woodPosition = new THREE.Vector3();
        const woodOffsets = [
          new THREE.Vector2(6.2, 3.8),
          new THREE.Vector2(-6.3, 2.4),
          new THREE.Vector2(5.4, -5.6),
          new THREE.Vector2(-5.8, -4.4),
          new THREE.Vector2(0.9, 7.1),
        ] as const;
        const woodNodes: ChapterWoodNode[] = [];
        let woodCollectedCount = 0;
        let isDisposed = false;
        let flareNearby = false;
        let flareBreathTime = 0;
        let flareModelLoaded = false;
        let flareReachedFollowTarget = false;
        let flareReachStateEmitted = false;
        let woodNodesSpawned = false;
        let flareAnimationMixer: THREE.AnimationMixer | null = null;
        let flareWalkAction: THREE.AnimationAction | null = null;
        let flareWalkPlaying = false;
        let flareAnimationRoot: THREE.Object3D | null = null;

        const emitSceneState = (nextState: Chapter1SceneUiState) => {
          context?.onStateChange?.(nextState);
        };

        const emitFlareNearby = (isNearby: boolean, force = false) => {
          if (!force && flareNearby === isNearby) return;
          flareNearby = isNearby;
          emitSceneState({ chapter1FlareNearby: isNearby });
        };

        const emitWoodCollected = () => {
          emitSceneState({
            chapter1WoodCollected: woodCollectedCount,
            chapter1WoodTotal: CHAPTER1_WOOD_NODE_COUNT,
          });
        };

        const flareAvoidanceCandidateDirection = new THREE.Vector3();
        const flareAvoidanceUpAxis = new THREE.Vector3(0, 1, 0);

        const isFlarePositionWalkable = (x: number, z: number) => {
          const isBlocked = world?.isBlocked;
          if (!isBlocked) return true;
          const clearance = CHAPTER1_FLARE_AVOIDANCE_CLEARANCE;
          const diagonalOffset = clearance * 0.7;
          if (isBlocked(x, z)) return false;
          if (isBlocked(x + clearance, z)) return false;
          if (isBlocked(x - clearance, z)) return false;
          if (isBlocked(x, z + clearance)) return false;
          if (isBlocked(x, z - clearance)) return false;
          if (isBlocked(x + diagonalOffset, z + diagonalOffset)) return false;
          if (isBlocked(x + diagonalOffset, z - diagonalOffset)) return false;
          if (isBlocked(x - diagonalOffset, z + diagonalOffset)) return false;
          if (isBlocked(x - diagonalOffset, z - diagonalOffset)) return false;
          return true;
        };

        const isFlarePathWalkable = (
          startX: number,
          startZ: number,
          direction: THREE.Vector3,
          distance: number
        ) => {
          if (distance <= 0.000001) return true;
          const sampleCount = Math.max(
            1,
            Math.ceil(distance / CHAPTER1_FLARE_AVOIDANCE_SEGMENT_LENGTH)
          );
          for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
            const progress = sampleIndex / sampleCount;
            const sampleX = startX + direction.x * distance * progress;
            const sampleZ = startZ + direction.z * distance * progress;
            if (!isFlarePositionWalkable(sampleX, sampleZ)) {
              return false;
            }
          }
          return true;
        };

        const resolveFlareMoveDirection = (
          desiredDirection: THREE.Vector3,
          distance: number
        ) => {
          if (distance <= 0.000001) return null;
          if (desiredDirection.lengthSq() < 0.000001) return null;
          const startX = flareAnchor.position.x;
          const startZ = flareAnchor.position.z;
          flareAvoidanceCandidateDirection
            .copy(desiredDirection)
            .setY(0)
            .normalize();

          for (
            let angleIndex = 0;
            angleIndex < CHAPTER1_FLARE_AVOIDANCE_SAMPLE_ANGLES_DEG.length;
            angleIndex += 1
          ) {
            const angleRad =
              CHAPTER1_FLARE_AVOIDANCE_SAMPLE_ANGLES_DEG[angleIndex] *
              THREE.MathUtils.DEG2RAD;
            const candidateDirection = flareAvoidanceCandidateDirection
              .clone()
              .applyAxisAngle(flareAvoidanceUpAxis, angleRad)
              .normalize();
            const dotToDesired = candidateDirection.dot(flareToTargetDirection);
            if (dotToDesired < -0.15) continue;
            if (
              !isFlarePathWalkable(
                startX,
                startZ,
                candidateDirection,
                distance
              )
            ) {
              continue;
            }
            return candidateDirection;
          }
          return null;
        };

        emitSceneState({
          chapter1FlareNearby: false,
          chapter1FlareReachedDestination: false,
          chapter1PrimaryAttackUnlocked: false,
          chapter1WoodCollected: 0,
          chapter1WoodTotal: CHAPTER1_WOOD_NODE_COUNT,
        });

        const resolveValidWoodPosition = (
          desiredX: number,
          desiredZ: number
        ) => {
          const bounds = world?.bounds;
          const clampToBounds = (value: number, isX: boolean) => {
            if (!bounds) return value;
            return THREE.MathUtils.clamp(
              value,
              (isX ? bounds.minX : bounds.minZ) + 1.2,
              (isX ? bounds.maxX : bounds.maxZ) - 1.2
            );
          };

          const isAvailable = (x: number, z: number) =>
            !(world?.isBlocked?.(x, z) ?? false);

          const baseX = clampToBounds(desiredX, true);
          const baseZ = clampToBounds(desiredZ, false);
          if (isAvailable(baseX, baseZ)) {
            return new THREE.Vector3(baseX, flareGroundY + 0.06, baseZ);
          }

          for (let radius = 1.2; radius <= 8; radius += 0.8) {
            for (let step = 0; step < 12; step += 1) {
              const angle = (Math.PI * 2 * step) / 12;
              const candidateX = clampToBounds(baseX + Math.cos(angle) * radius, true);
              const candidateZ = clampToBounds(baseZ + Math.sin(angle) * radius, false);
              if (!isAvailable(candidateX, candidateZ)) continue;
              return new THREE.Vector3(
                candidateX,
                flareGroundY + 0.06,
                candidateZ
              );
            }
          }

          return new THREE.Vector3(baseX, flareGroundY + 0.06, baseZ);
        };

        const spawnWoodNodes = () => {
          if (woodNodesSpawned) return;
          woodNodesSpawned = true;
          woodCollectedCount = 0;
          emitWoodCollected();

          for (
            let nodeIndex = 0;
            nodeIndex < CHAPTER1_WOOD_NODE_COUNT;
            nodeIndex += 1
          ) {
            const offset = woodOffsets[nodeIndex % woodOffsets.length];
            const spawnPos = resolveValidWoodPosition(
              flareFollowTarget.x + offset.x,
              flareFollowTarget.z + offset.y
            );
            const nodeRoot = new THREE.Group();
            nodeRoot.name = `chapter1WoodNode_${nodeIndex + 1}`;
            nodeRoot.position.copy(spawnPos);
            nodeRoot.rotation.y = (nodeIndex * Math.PI) / 5;

            const logMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.24, 0.3, 2.3, 14),
              new THREE.MeshStandardMaterial({
                color: 0x8f5527,
                roughness: 0.88,
                metalness: 0.06,
                emissive: 0x251204,
                emissiveIntensity: 0.22,
              })
            );
            logMesh.rotation.z = Math.PI / 2;
            logMesh.position.y = 0.24;
            logMesh.castShadow = true;
            logMesh.receiveShadow = true;
            nodeRoot.add(logMesh);
            trackMesh(logMesh);

            const ringMaterial = new THREE.MeshStandardMaterial({
              color: 0x9f1239,
              roughness: 0.35,
              metalness: 0.22,
              emissive: 0x7f1d1d,
              emissiveIntensity: 0.72,
            });
            const ringMesh = new THREE.Mesh(
              new THREE.TorusGeometry(0.5, 0.07, 12, 28),
              ringMaterial
            );
            ringMesh.position.y = 1.05;
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.castShadow = false;
            ringMesh.receiveShadow = false;
            nodeRoot.add(ringMesh);
            trackMesh(ringMesh);

            const markerMaterial = new THREE.MeshStandardMaterial({
              color: 0xf43f5e,
              roughness: 0.2,
              metalness: 0.1,
              emissive: 0x9f1239,
              emissiveIntensity: 1.25,
            });
            const markerMesh = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.18, 0),
              markerMaterial
            );
            markerMesh.position.y = 1.12;
            markerMesh.castShadow = false;
            markerMesh.receiveShadow = false;
            nodeRoot.add(markerMesh);
            trackMesh(markerMesh);

            const beamMaterial = new THREE.MeshStandardMaterial({
              color: 0xf43f5e,
              roughness: 0.15,
              metalness: 0.05,
              emissive: 0xbe123c,
              emissiveIntensity: 0.95,
              transparent: true,
              opacity: 0.52,
            });
            const beamMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.09, 0.15, 1.5, 10),
              beamMaterial
            );
            beamMesh.position.y = 1.28;
            beamMesh.castShadow = false;
            beamMesh.receiveShadow = false;
            nodeRoot.add(beamMesh);
            trackMesh(beamMesh);

            scene.add(nodeRoot);
            const woodMonster = new Monster({
              model: nodeRoot,
              profile: {
                id: `chapter1_wood_node_${nodeIndex + 1}`,
                label: "Wood Node",
                stats: {
                  health: 1,
                },
              },
            });

            const nodeState: ChapterWoodNode = {
              id: `chapter1_wood_node_${nodeIndex + 1}`,
              root: nodeRoot,
              markerMesh,
              beamMesh,
              markerMaterial,
              beamMaterial,
              ringMaterial,
              collectible: false,
              collected: false,
              pulseOffset: nodeIndex * 0.8,
              pickupScale: 0.48,
              pickupSpinSpeed: 2.7 + nodeIndex * 0.18,
              monster: woodMonster,
              attackTarget: {
                id: `chapter1_wood_node_${nodeIndex + 1}`,
                object: nodeRoot,
                isActive: () => !nodeState.collectible && !nodeState.collected,
                onHit: (hit) => {
                  if (nodeState.collected || nodeState.collectible) return;
                  const appliedDamage = nodeState.monster.takeDamage(hit.damage);
                  if (appliedDamage <= 0) return;
                  nodeState.collectible = true;
                  nodeState.ringMaterial.color.setHex(0x84cc16);
                  nodeState.ringMaterial.emissive.setHex(0x14532d);
                  nodeState.ringMaterial.emissiveIntensity = 0.92;
                  nodeState.markerMaterial.color.setHex(0xbef264);
                  nodeState.markerMaterial.emissive.setHex(0x65a30d);
                  nodeState.markerMaterial.emissiveIntensity = 1.48;
                  nodeState.beamMaterial.color.setHex(0xbef264);
                  nodeState.beamMaterial.emissive.setHex(0x84cc16);
                  nodeState.beamMaterial.emissiveIntensity = 1.16;
                  nodeState.beamMaterial.opacity = 0.7;
                  nodeState.root.scale.setScalar(nodeState.pickupScale);
                },
              },
            };
            woodNodes.push(nodeState);
            attackTargets.push(nodeState.attackTarget);
          }
        };

        const rotateFlareToward = (targetYaw: number, delta: number) => {
          const currentYaw = flareAnchor.rotation.y;
          const yawDelta =
            THREE.MathUtils.euclideanModulo(
              targetYaw - currentYaw + Math.PI,
              Math.PI * 2
            ) - Math.PI;
          const maxStep = Math.max(
            0,
            CHAPTER1_FLARE_TURN_SPEED * Math.max(0, delta)
          );
          if (Math.abs(yawDelta) <= maxStep) {
            flareAnchor.rotation.y = targetYaw;
            return;
          }
          flareAnchor.rotation.y = currentYaw + Math.sign(yawDelta) * maxStep;
        };

        emitFlareNearby(false, true);

        const flareLoader = new GLTFLoader();
        const flareModelPath =
          process.env.NODE_ENV === "development"
            ? `/assets/characters/flare/flare.glb?v=${Date.now()}`
            : "/assets/characters/flare/flare.glb";
        flareLoader.load(
          flareModelPath,
          (gltf) => {
            if (!gltf?.scene) return;
            if (isDisposed) {
              disposeObjectResources(gltf.scene);
              return;
            }
            const flareModel = gltf.scene;
            flareAnchor.add(flareModel);
            trackObject(flareModel, { castShadow: true, receiveShadow: true });
            flareModel.updateMatrixWorld(true);
            const flareBounds = new THREE.Box3().setFromObject(flareModel);
            flareAnchor.getWorldPosition(flareAnchorWorldPosition);
            const localMinY = flareBounds.min.y - flareAnchorWorldPosition.y;
            flareModel.position.y -= localMinY - CHAPTER1_FLARE_GROUND_CLEARANCE;
            flareModel.updateMatrixWorld(true);
            flareFallback.visible = false;
            flareModelLoaded = true;

            flareAnimationRoot = flareModel;
            if (gltf.animations.length > 0) {
              flareAnimationMixer = new THREE.AnimationMixer(flareModel);
              const walkClip =
                gltf.animations.find(
                  (clip) => clip.name.trim().toLowerCase() === "walk"
                ) ??
                gltf.animations.find((clip) =>
                  clip.name.trim().toLowerCase().includes("walk")
                ) ??
                null;
              if (walkClip) {
                flareWalkAction = flareAnimationMixer.clipAction(walkClip);
                flareWalkAction.enabled = true;
                flareWalkAction.setLoop(THREE.LoopRepeat, Infinity);
                flareWalkAction.clampWhenFinished = false;
              }
            }
          },
          undefined,
          () => {}
        );

        if (world) {
          const originalOnTick = world.onTick;
          world.onTick = (args: PlayerWorldTickArgs) => {
            originalOnTick?.(args);
            flareBreathTime += args.delta;
            flareAnimationMixer?.update(Math.max(0, args.delta));
            const pulse = 0.52 + 0.48 * Math.sin(flareBreathTime * 2.6);
            const fallbackMaterial =
              flareFallback.material as THREE.MeshStandardMaterial;
            fallbackMaterial.emissiveIntensity = 0.45 + pulse * 0.6;
            if (!flareModelLoaded) {
              flareFallback.rotation.y += args.delta * 0.7;
            }
            args.player.getWorldPosition(playerPosition);
            flareAnchor.getWorldPosition(flarePosition);
            let flareMovingThisFrame = false;
            if (flareTalkedRef.current && !flareReachedFollowTarget) {
              flareToTargetDirection.set(
                flareFollowTarget.x - flareAnchor.position.x,
                0,
                flareFollowTarget.z - flareAnchor.position.z
              );
              const immediateTargetDistance = flareToTargetDirection.length();
              const followTargetBlocked = Boolean(
                world?.isBlocked?.(flareFollowTarget.x, flareFollowTarget.z)
              );
              if (
                immediateTargetDistance <= CHAPTER1_FLARE_FOLLOW_ARRIVAL_DISTANCE ||
                (followTargetBlocked &&
                  immediateTargetDistance <=
                    CHAPTER1_FLARE_BLOCKED_TARGET_ARRIVAL_DISTANCE)
              ) {
                flareReachedFollowTarget = true;
              }

              if (flareReachedFollowTarget) {
                flareAnchor.getWorldPosition(flarePosition);
              } else {
                flareToTargetDirection.divideScalar(
                  Math.max(0.000001, immediateTargetDistance)
                );
                flareToPlayerDirection.set(
                  playerPosition.x - flarePosition.x,
                  0,
                  playerPosition.z - flarePosition.z
                );
                const playerDistanceSq = flareToPlayerDirection.lengthSq();
                if (playerDistanceSq > flareLeashDistanceSq) {
                  if (playerDistanceSq > 0.000001) {
                    rotateFlareToward(
                      Math.atan2(flareToPlayerDirection.x, flareToPlayerDirection.z),
                      args.delta
                    );
                  }
                } else {
                const moveStep = Math.min(
                  immediateTargetDistance,
                  CHAPTER1_FLARE_FOLLOW_SPEED * Math.max(0, args.delta)
                );
                  const resolvedMoveDirection = resolveFlareMoveDirection(
                    flareToTargetDirection,
                    moveStep
                  );
                  if (resolvedMoveDirection) {
                    flareAnchor.position.x += resolvedMoveDirection.x * moveStep;
                    flareAnchor.position.z += resolvedMoveDirection.z * moveStep;
                    flareMovingThisFrame = moveStep > 0.00001;
                    rotateFlareToward(
                      Math.atan2(
                        resolvedMoveDirection.x,
                        resolvedMoveDirection.z
                      ),
                      args.delta
                    );
                  } else {
                    rotateFlareToward(
                      Math.atan2(flareToTargetDirection.x, flareToTargetDirection.z),
                      args.delta
                    );
                  }
                }
              }
              flareAnchor.getWorldPosition(flarePosition);
            }

            if (flareReachedFollowTarget && !flareReachStateEmitted) {
              flareReachStateEmitted = true;
              emitSceneState({
                chapter1FlareReachedDestination: true,
                chapter1PrimaryAttackUnlocked: true,
              });
              spawnWoodNodes();
            }

            if (flareWalkAction) {
              if (flareMovingThisFrame) {
                if (!flareWalkPlaying) {
                  flareWalkAction.reset();
                  flareWalkAction.fadeIn(0.16);
                  flareWalkAction.play();
                  flareWalkPlaying = true;
                }
              } else if (flareWalkPlaying) {
                flareWalkAction.fadeOut(0.14);
                flareWalkPlaying = false;
              }
            }

            const dx = playerPosition.x - flarePosition.x;
            const dz = playerPosition.z - flarePosition.z;
            emitFlareNearby(dx * dx + dz * dz <= flareTalkRangeSq);

            for (let nodeIndex = 0; nodeIndex < woodNodes.length; nodeIndex += 1) {
              const node = woodNodes[nodeIndex];
              if (node.collected) continue;
              const nodePulse = Math.sin(flareBreathTime * 3.4 + node.pulseOffset);
              node.markerMesh.rotation.y += args.delta * 1.8;
              node.beamMesh.rotation.y += args.delta * 0.9;
              node.ringMaterial.emissiveIntensity = node.collectible
                ? 0.92 + Math.max(0, nodePulse) * 0.52
                : 0.62 + Math.max(0, nodePulse) * 0.4;
              if (node.collectible) {
                node.root.position.y =
                  flareGroundY + 0.06 + Math.sin(flareBreathTime * 2 + node.pulseOffset) * 0.08;
                node.root.rotation.y += args.delta * node.pickupSpinSpeed;
                node.root.getWorldPosition(woodPosition);
                const woodDx = playerPosition.x - woodPosition.x;
                const woodDz = playerPosition.z - woodPosition.z;
                if (
                  woodDx * woodDx + woodDz * woodDz <=
                  CHAPTER1_WOOD_PICKUP_DISTANCE * CHAPTER1_WOOD_PICKUP_DISTANCE
                ) {
                  node.collected = true;
                  node.root.visible = false;
                  woodCollectedCount += 1;
                  emitWoodCollected();
                }
              }
            }
          };
        }

        const dispose = () => {
          isDisposed = true;
          if (flareWalkAction) {
            flareWalkAction.stop();
            flareWalkAction = null;
          }
          if (flareAnimationMixer) {
            flareAnimationMixer.stopAllAction();
            if (flareAnimationRoot) {
              flareAnimationMixer.uncacheRoot(flareAnimationRoot);
            }
          }
          for (let nodeIndex = 0; nodeIndex < woodNodes.length; nodeIndex += 1) {
            const node = woodNodes[nodeIndex];
            node.monster.dispose();
            const targetIndex = attackTargets.indexOf(node.attackTarget);
            if (targetIndex >= 0) {
              attackTargets.splice(targetIndex, 1);
            }
            scene.remove(node.root);
          }
          woodNodes.length = 0;
          flareAnimationMixer = null;
          flareAnimationRoot = null;
          context?.onStateChange?.({});
          scene.remove(flareAnchor);
          disposeTrackedResources();
          baseResult.dispose?.();
        };

        return {
          world,
          dispose,
        };
      },
    };
  }, []);

  const handlePlayerStateChange = useCallback((_: PlayerUiState) => {
    setSceneReady((current) => {
      if (current) return current;
      return true;
    });
  }, []);

  const handleSceneStateChange = useCallback(
    (nextState: SceneUiState) => {
      const typedState = nextState as Chapter1SceneUiState;
      const hasOwn = (key: keyof Chapter1SceneUiState) =>
        Object.prototype.hasOwnProperty.call(typedState, key);
      setChapterUiState((previous) => {
        let changed = false;
        const nextUiState = { ...previous };
        if (hasOwn("chapter1FlareNearby")) {
          const nextNearby = Boolean(typedState.chapter1FlareNearby);
          if (Boolean(previous.chapter1FlareNearby) !== nextNearby) {
            nextUiState.chapter1FlareNearby = nextNearby;
            changed = true;
          }
        }
        if (hasOwn("chapter1FlareReachedDestination")) {
          const reachedDestination = Boolean(
            typedState.chapter1FlareReachedDestination
          );
          if (
            Boolean(previous.chapter1FlareReachedDestination) !==
            reachedDestination
          ) {
            nextUiState.chapter1FlareReachedDestination = reachedDestination;
            changed = true;
          }
        }
        if (hasOwn("chapter1PrimaryAttackUnlocked")) {
          const nextPrimaryAttackUnlocked = Boolean(
            typedState.chapter1PrimaryAttackUnlocked
          );
          if (
            Boolean(previous.chapter1PrimaryAttackUnlocked) !==
            nextPrimaryAttackUnlocked
          ) {
            nextUiState.chapter1PrimaryAttackUnlocked =
              nextPrimaryAttackUnlocked;
            changed = true;
          }
        }
        if (hasOwn("chapter1WoodCollected")) {
          const nextWoodCollected = Number.isFinite(
            typedState.chapter1WoodCollected
          )
            ? Math.max(0, Math.floor(typedState.chapter1WoodCollected ?? 0))
            : 0;
          if ((previous.chapter1WoodCollected ?? 0) !== nextWoodCollected) {
            nextUiState.chapter1WoodCollected = nextWoodCollected;
            changed = true;
          }
        }
        if (hasOwn("chapter1WoodTotal")) {
          const nextWoodTotal = Number.isFinite(typedState.chapter1WoodTotal)
            ? Math.max(0, Math.floor(typedState.chapter1WoodTotal ?? 0))
            : CHAPTER1_WOOD_NODE_COUNT;
          if (
            (previous.chapter1WoodTotal ?? CHAPTER1_WOOD_NODE_COUNT) !==
            nextWoodTotal
          ) {
            nextUiState.chapter1WoodTotal = nextWoodTotal;
            changed = true;
          }
        }
        return changed ? nextUiState : previous;
      });
    },
    [setChapterUiState]
  );

  useEffect(() => {
    if (!showSceneCurtain || !sceneReady || phase !== "scene") {
      return;
    }

    sceneCurtainStartTimerRef.current = window.setTimeout(() => {
      sceneCurtainStartTimerRef.current = null;
      setSceneCurtainTransparent(true);
    }, 40);

    sceneCurtainHideTimerRef.current = window.setTimeout(() => {
      sceneCurtainHideTimerRef.current = null;
      setShowSceneCurtain(false);
      setSceneCurtainTransparent(false);
    }, CHAPTER1_SCENE_CURTAIN_FADE_MS + 120);

    return () => {
      if (sceneCurtainStartTimerRef.current !== null) {
        window.clearTimeout(sceneCurtainStartTimerRef.current);
        sceneCurtainStartTimerRef.current = null;
      }
      if (sceneCurtainHideTimerRef.current !== null) {
        window.clearTimeout(sceneCurtainHideTimerRef.current);
        sceneCurtainHideTimerRef.current = null;
      }
    };
  }, [phase, sceneReady, showSceneCurtain]);

  useEffect(() => {
    if (phase !== "scene" || !sceneReady) {
      setChapterUiState((previous) => {
        if (!previous.chapter1ControlHintVisible) return previous;
        return {
          ...previous,
          chapter1ControlHintVisible: false,
        };
      });
      return;
    }
    sceneControlHintTimerRef.current = window.setTimeout(() => {
      sceneControlHintTimerRef.current = null;
      setChapterUiState((previous) => ({
        ...previous,
        hideRightPanel: false,
        chapter1ControlHintVisible: true,
      }));
    }, CHAPTER1_CONTROL_HINT_DELAY_MS);
    return () => {
      if (sceneControlHintTimerRef.current !== null) {
        window.clearTimeout(sceneControlHintTimerRef.current);
        sceneControlHintTimerRef.current = null;
      }
    };
  }, [phase, sceneReady, setChapterUiState]);

  useEffect(() => {
    if (phase !== "scene" || !sceneReady) return;
    const handleTalkKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyF" || event.repeat) return;
      setChapterUiState((previous) => {
        if (!previous.chapter1FlareNearby) return previous;
        if (previous.chapter1FlareTalked) return previous;
        flareTalkedRef.current = true;
        return {
          ...previous,
          chapter1FlareTalked: true,
        };
      });
    };
    window.addEventListener("keydown", handleTalkKeyDown);
    return () => {
      window.removeEventListener("keydown", handleTalkKeyDown);
    };
  }, [phase, sceneReady, setChapterUiState]);

  const primaryAttackUnlocked = Boolean(
    chapterUiState.chapter1PrimaryAttackUnlocked
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px",
      }}
    >
      {phase === "intro" ? (
        <button
          type="button"
          onClick={advanceIntro}
          className={originStyles.chapter1IntroBackdropAnimated}
          style={{
            margin: 0,
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid rgba(56, 189, 248, 0.28)",
            backdropFilter: "blur(9px)",
            WebkitBackdropFilter: "blur(9px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "16px",
            padding: "32px",
            color: "rgba(226, 232, 240, 0.95)",
            cursor: "pointer",
          }}
        >
          <p
            style={{
              margin: 0,
              maxWidth: "760px",
              lineHeight: 1.72,
              fontSize: "clamp(1.2rem, 2.1vw, 1.9rem)",
              letterSpacing: "0.02em",
            }}
          >
            {chapter1IntroLines[introIndex]}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(148, 163, 184, 0.86)",
              fontWeight: 700,
            }}
          >
            Click to continue
          </p>
        </button>
      ) : phase === "transition" ? (
        <div
          className={originStyles.chapter1IntroBackdropAnimated}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid rgba(56, 189, 248, 0.32)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "14px",
            color: "rgba(226, 232, 240, 0.95)",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.74rem",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "rgba(147, 197, 253, 0.92)",
              fontWeight: 700,
            }}
          >
            Transitioning
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(1.1rem, 1.9vw, 1.45rem)",
              lineHeight: 1.65,
              maxWidth: "780px",
            }}
          >
            Crossing into the forest...
          </p>
        </div>
      ) : phase === "scene" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid rgba(56, 189, 248, 0.26)",
            overflow: "hidden",
            position: "relative",
            background:
              "linear-gradient(180deg, rgba(1, 4, 10, 0.96), rgba(4, 9, 16, 0.98))",
          }}
        >
          <SceneLauncher
            sceneLoader={loadForestScene}
            gameMode="originChapter1"
            characterPath={CHAPTER1_ADAM_PATH}
            allowPrimaryAttack={primaryAttackUnlocked}
            allowSkills={false}
            allowJump={false}
            onPlayerStateChange={handlePlayerStateChange}
            onSceneStateChange={handleSceneStateChange}
            maxPixelRatio={1.5}
            className="h-full w-full overflow-hidden rounded-[22px] border border-cyan-300/20 bg-[#050b13]"
          />

          {!sceneReady ? (
            <div
              className={originStyles.chapter1IntroBackdropAnimated}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.84rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "rgba(186, 230, 253, 0.95)",
                  fontWeight: 700,
                }}
              >
                Loading Forest...
              </p>
            </div>
          ) : null}

          {showSceneCurtain ? (
            <div
              className={originStyles.chapter1IntroBackdropAnimated}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                opacity: sceneCurtainTransparent ? 0 : 1,
                transition: `opacity ${CHAPTER1_SCENE_CURTAIN_FADE_MS}ms ease`,
              }}
            />
          ) : null}

          {sceneReady &&
          phase === "scene" &&
          chapterUiState.chapter1FlareNearby &&
          !chapterUiState.chapter1FlareTalked ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: "24px",
                transform: "translateX(-50%)",
                borderRadius: "12px",
                border: "1px solid rgba(125, 211, 252, 0.64)",
                background:
                  "linear-gradient(180deg, rgba(2, 10, 20, 0.88), rgba(1, 6, 14, 0.95))",
                padding: "10px 14px",
                color: "rgba(226, 232, 240, 0.98)",
                fontSize: "0.9rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                boxShadow: "0 0 24px rgba(56, 189, 248, 0.3)",
                pointerEvents: "none",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              }}
            >
              Press F To Talk
            </div>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid rgba(56, 189, 248, 0.32)",
            background:
              "radial-gradient(circle at 50% 44%, rgba(14, 116, 144, 0.25), transparent 58%), linear-gradient(180deg, rgba(1, 9, 23, 0.95), rgba(2, 6, 23, 0.98))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            color: "rgba(186, 230, 253, 0.92)",
            textAlign: "center",
            padding: "20px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.76rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(148, 163, 184, 0.86)",
              fontWeight: 700,
            }}
          >
            Chapter Frame
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(1.5rem, 2.4vw, 2.3rem)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            chapter1
          </h2>
          <p
            style={{
              margin: 0,
              maxWidth: "580px",
              lineHeight: 1.6,
              color: "rgba(226, 232, 240, 0.82)",
            }}
          >
            Click Start to play the opening narrative.
          </p>
          <button
            type="button"
            onClick={startIntro}
            style={{
              border: "1px solid rgba(125, 211, 252, 0.54)",
              borderRadius: "12px",
              background:
                "linear-gradient(180deg, rgba(14, 116, 144, 0.5), rgba(8, 47, 73, 0.8))",
              color: "rgba(236, 254, 255, 0.95)",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 800,
              padding: "10px 18px",
              cursor: "pointer",
            }}
          >
            Start
          </button>
        </div>
      )}
    </div>
  );
}

function Chapter1RightPanel({ chapterUiState }: StoryChapterComponentProps) {
  const isPanelVisible =
    !chapterUiState.hideRightPanel &&
    Boolean(chapterUiState.chapter1ControlHintVisible);

  const flareTalked = Boolean(chapterUiState.chapter1FlareTalked);
  const flareNearby = Boolean(chapterUiState.chapter1FlareNearby);
  const flareReachedDestination = Boolean(
    chapterUiState.chapter1FlareReachedDestination
  );
  const woodCollected = Math.max(
    0,
    Math.floor(chapterUiState.chapter1WoodCollected ?? 0)
  );
  const woodTotal = Math.max(
    1,
    Math.floor(chapterUiState.chapter1WoodTotal ?? CHAPTER1_WOOD_NODE_COUNT)
  );
  const activeStage: "find" | "follow" | "collect" = !flareTalked
    ? "find"
    : flareReachedDestination
      ? "collect"
      : "follow";
  const [displayStage, setDisplayStage] = useState(activeStage);
  const [contentOpacity, setContentOpacity] = useState(1);

  useEffect(() => {
    if (activeStage === displayStage) return;
    setContentOpacity(CHAPTER1_RIGHT_PANEL_FADE_FLOOR_OPACITY);
    const stageSwapDelay = Math.max(
      80,
      Math.round(CHAPTER1_RIGHT_PANEL_FADE_MS * 0.55)
    );
    const transitionTimer = window.setTimeout(() => {
      setDisplayStage(activeStage);
      setContentOpacity(1);
    }, stageSwapDelay);
    return () => {
      window.clearTimeout(transitionTimer);
    };
  }, [activeStage, displayStage]);

  const showMovementTutorial = displayStage === "find";
  const showCameraTutorial = displayStage === "follow";
  const showWoodTutorial = displayStage === "collect";
  const taskText = showWoodTutorial
    ? `Collect wood ${Math.min(woodCollected, woodTotal)}/${woodTotal}.`
    : showCameraTutorial
      ? "Follow Flare."
      : "Find Flare and talk to him.";
  const dialogueText = showWoodTutorial
    ? CHAPTER1_FLARE_DESTINATION_DIALOGUE
    : CHAPTER1_FLARE_DIALOGUE;

  if (!isPanelVisible) {
    return null;
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "12px",
        opacity: contentOpacity,
        transition: `opacity ${CHAPTER1_RIGHT_PANEL_FADE_MS}ms ease`,
      }}
    >
      <div
        style={{
          borderRadius: "18px",
          border: "1px solid rgba(125, 211, 252, 0.62)",
          background:
            "linear-gradient(180deg, rgba(3, 14, 28, 0.92), rgba(2, 9, 20, 0.97))",
          padding: "18px 16px",
          color: "rgba(226, 232, 240, 0.95)",
          boxShadow:
            "0 0 30px rgba(56, 189, 248, 0.26), inset 0 0 0 1px rgba(191, 219, 254, 0.16)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.88rem",
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            color: "rgba(186, 230, 253, 0.98)",
            fontWeight: 800,
            textShadow: "0 0 12px rgba(56, 189, 248, 0.7)",
          }}
        >
          Tutorial
        </p>
        <div
          style={{
            marginTop: "12px",
            display: "grid",
            gap: "10px",
          }}
        >
          {flareTalked ? (
            <>
              {showCameraTutorial ? (
                <>
                  <div
                    style={{
                      borderRadius: "11px",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      background: "rgba(2, 16, 36, 0.82)",
                      padding: "9px 10px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.96rem",
                        fontWeight: 900,
                        letterSpacing: "0.14em",
                        color: "rgba(125, 211, 252, 1)",
                      }}
                    >
                      Z / X
                    </span>
                    <span
                      style={{
                        fontSize: "0.92rem",
                        fontWeight: 700,
                        color: "rgba(226, 232, 240, 0.96)",
                        lineHeight: 1.45,
                      }}
                    >
                      Orbit third-person camera around Adam. Hold Z for left orbit,
                      hold X for right orbit.
                    </span>
                  </div>
                  <div
                    style={{
                      borderRadius: "11px",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      background: "rgba(2, 16, 36, 0.82)",
                      padding: "9px 10px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.96rem",
                        fontWeight: 900,
                        letterSpacing: "0.14em",
                        color: "rgba(125, 211, 252, 1)",
                      }}
                    >
                      C / V
                    </span>
                    <span
                      style={{
                        fontSize: "0.92rem",
                        fontWeight: 700,
                        color: "rgba(226, 232, 240, 0.96)",
                        lineHeight: 1.45,
                      }}
                    >
                      Adjust camera pitch offset. Hold C to raise the viewpoint,
                      hold V to lower it. Pitch is clamped to keep visibility stable.
                    </span>
                  </div>
                  <div
                    style={{
                      borderRadius: "11px",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      background: "rgba(2, 16, 36, 0.82)",
                      padding: "9px 10px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.96rem",
                        fontWeight: 900,
                        letterSpacing: "0.14em",
                        color: "rgba(125, 211, 252, 1)",
                      }}
                    >
                      B / N
                    </span>
                    <span
                      style={{
                        fontSize: "0.92rem",
                        fontWeight: 700,
                        color: "rgba(226, 232, 240, 0.96)",
                        lineHeight: 1.45,
                      }}
                    >
                      Change camera orbit distance. Hold B to zoom out farther, hold
                      N to zoom in closer.
                    </span>
                  </div>
                </>
              ) : showWoodTutorial ? (
                <div
                  style={{
                    borderRadius: "11px",
                    border: "1px solid rgba(74, 222, 128, 0.55)",
                    background: "rgba(7, 28, 18, 0.84)",
                    padding: "10px 11px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.84rem",
                      fontWeight: 900,
                      letterSpacing: "0.12em",
                      color: "rgba(190, 242, 100, 0.98)",
                    }}
                  >
                    LEFT MOUSE
                  </span>
                  <span
                    style={{
                      fontSize: "0.94rem",
                      fontWeight: 700,
                      color: "rgba(240, 253, 244, 0.96)",
                      lineHeight: 1.45,
                    }}
                  >
                    Hold to charge a throw orb, then release to launch. Hit each
                    wood node first, then walk into the dropped wood to collect it.
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {showMovementTutorial ? (
                <>
                  <div
                    style={{
                      borderRadius: "11px",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      background: "rgba(2, 16, 36, 0.82)",
                      padding: "9px 10px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1rem",
                        fontWeight: 900,
                        letterSpacing: "0.15em",
                        color: "rgba(125, 211, 252, 1)",
                      }}
                    >
                      WASD
                    </span>
                    <span
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "rgba(226, 232, 240, 0.96)",
                      }}
                    >
                      Move
                    </span>
                  </div>
                  <div
                    style={{
                      borderRadius: "11px",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      background: "rgba(2, 16, 36, 0.82)",
                      padding: "9px 10px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1rem",
                        fontWeight: 900,
                        letterSpacing: "0.12em",
                        color: "rgba(125, 211, 252, 1)",
                      }}
                    >
                      SHIFT
                    </span>
                    <span
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "rgba(226, 232, 240, 0.96)",
                      }}
                    >
                      Sprint
                    </span>
                  </div>
                  <div
                    style={{
                      borderRadius: "11px",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      background: "rgba(2, 16, 36, 0.82)",
                      padding: "9px 10px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.92rem",
                        fontWeight: 900,
                        letterSpacing: "0.1em",
                        color: "rgba(125, 211, 252, 1)",
                      }}
                    >
                      WASD + F
                    </span>
                    <span
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "rgba(226, 232, 240, 0.96)",
                      }}
                    >
                      Quick Dash
                    </span>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div
        style={{
          borderRadius: "16px",
          border: "1px solid rgba(248, 250, 252, 0.16)",
          background:
            "linear-gradient(180deg, rgba(10, 17, 32, 0.86), rgba(7, 12, 24, 0.94))",
          padding: "14px 14px",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.74rem",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "rgba(253, 224, 71, 0.95)",
            fontWeight: 800,
          }}
        >
          Task
        </p>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "0.92rem",
            lineHeight: 1.55,
            color: "rgba(248, 250, 252, 0.94)",
            fontWeight: 700,
          }}
        >
          {taskText}
        </p>
        {flareNearby && displayStage === "find" ? (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "0.84rem",
              color: "rgba(125, 211, 252, 0.95)",
              fontWeight: 700,
            }}
          >
            Flare is nearby. Press F to talk.
          </p>
        ) : null}
      </div>

      {flareTalked ? (
        <div
          style={{
            borderRadius: "16px",
            border: "1px solid rgba(248, 250, 252, 0.16)",
            background:
              "linear-gradient(180deg, rgba(22, 10, 10, 0.82), rgba(14, 7, 7, 0.9))",
            padding: "14px 14px",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.74rem",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(248, 113, 113, 0.96)",
              fontWeight: 800,
            }}
          >
            Dialogue
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              color: "rgba(254, 242, 242, 0.95)",
            }}
          >
            {dialogueText}
          </p>
        </div>
      ) : null}
    </div>
  );
}

const chapter1: StoryChapterDefinition = {
  id: "chapter1",
  label: "chapter1",
  summary: "",
  rules: chapter1Rules,
  GameFrame: Chapter1GameFrame,
  RightPanel: Chapter1RightPanel,
  initialUiState: {
    hideRightPanel: true,
    chapter1ControlHintVisible: false,
    chapter1FlareNearby: false,
    chapter1FlareTalked: false,
    chapter1FlareReachedDestination: false,
    chapter1PrimaryAttackUnlocked: false,
    chapter1WoodCollected: 0,
    chapter1WoodTotal: CHAPTER1_WOOD_NODE_COUNT,
  },
};

export default chapter1;
