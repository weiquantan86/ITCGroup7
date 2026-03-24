import SceneLauncher from "@/app/asset/scenes/general/SceneLauncher";
import { createSceneResourceTracker } from "@/app/asset/scenes/general/resourceTracker";
import type {
  PlayerUiState,
  PlayerWorldTickArgs,
} from "@/app/asset/entity/character/general/player";
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
const CHAPTER1_FLARE_FOLLOW_TARGET_X = 24;
const CHAPTER1_FLARE_FOLLOW_TARGET_Z = -20;
const CHAPTER1_FLARE_FOLLOW_SPEED = 1.85;
const CHAPTER1_FLARE_FOLLOW_LEASH_DISTANCE = 5;
const CHAPTER1_FLARE_TURN_SPEED = Math.PI * 3.6;
const CHAPTER1_FLARE_DIALOGUE =
  'Flare: "Why so slow? The campfire festival is about to begin. You are new here, so I still need to teach you a few things. Follow me."';

type Chapter1SceneUiState = {
  chapter1FlareNearby?: boolean;
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

        const playerPosition = new THREE.Vector3();
        const flarePosition = new THREE.Vector3();
        const flareAnchorWorldPosition = new THREE.Vector3();
        const flareToPlayerDirection = new THREE.Vector3();
        const flareToTargetDirection = new THREE.Vector3();
        let isDisposed = false;
        let flareNearby = false;
        let flareBreathTime = 0;
        let flareModelLoaded = false;
        let flareReachedFollowTarget = false;
        let flareAnimationMixer: THREE.AnimationMixer | null = null;
        let flareWalkAction: THREE.AnimationAction | null = null;
        let flareWalkPlaying = false;
        let flareAnimationRoot: THREE.Object3D | null = null;

        const rotateFlareToward = (targetYaw: number, delta: number) => {
          const currentYaw = flareAnchor.rotation.y;
          const yawDelta =
            THREE.MathUtils.euclideanModulo(
              targetYaw - currentYaw + Math.PI,
              Math.PI * 2
            ) - Math.PI;
          const maxStep = Math.max(0, CHAPTER1_FLARE_TURN_SPEED * Math.max(0, delta));
          if (Math.abs(yawDelta) <= maxStep) {
            flareAnchor.rotation.y = targetYaw;
            return;
          }
          flareAnchor.rotation.y = currentYaw + Math.sign(yawDelta) * maxStep;
        };

        const emitFlareNearby = (isNearby: boolean, force = false) => {
          if (!force && flareNearby === isNearby) return;
          flareNearby = isNearby;
          context?.onStateChange?.({
            chapter1FlareNearby: isNearby,
          });
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
              flareToPlayerDirection
                .set(
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
                flareToTargetDirection
                  .set(
                    flareFollowTarget.x - flareAnchor.position.x,
                    0,
                    flareFollowTarget.z - flareAnchor.position.z
                  );
                const targetDistance = flareToTargetDirection.length();
                if (targetDistance <= 0.1) {
                  flareReachedFollowTarget = true;
                } else {
                  flareToTargetDirection.divideScalar(Math.max(0.000001, targetDistance));
                  const moveStep = Math.min(
                    targetDistance,
                    CHAPTER1_FLARE_FOLLOW_SPEED * Math.max(0, args.delta)
                  );
                  flareAnchor.position.x += flareToTargetDirection.x * moveStep;
                  flareAnchor.position.z += flareToTargetDirection.z * moveStep;
                  flareMovingThisFrame = moveStep > 0.00001;
                  rotateFlareToward(
                    Math.atan2(flareToTargetDirection.x, flareToTargetDirection.z),
                    args.delta
                  );
                }
              }
              flareAnchor.getWorldPosition(flarePosition);
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
      const isFlareNearby = Boolean(typedState.chapter1FlareNearby);
      setChapterUiState((previous) => {
        if (Boolean(previous.chapter1FlareNearby) === isFlareNearby) {
          return previous;
        }
        return {
          ...previous,
          chapter1FlareNearby: isFlareNearby,
        };
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
            allowPrimaryAttack={false}
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
  if (chapterUiState.hideRightPanel) {
    return null;
  }

  if (!chapterUiState.chapter1ControlHintVisible) {
    return null;
  }

  const flareTalked = Boolean(chapterUiState.chapter1FlareTalked);
  const flareNearby = Boolean(chapterUiState.chapter1FlareNearby);

  return (
    <div
      style={{
        display: "grid",
        gap: "12px",
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
              <div
                style={{
                  borderRadius: "11px",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  background: "rgba(2, 16, 36, 0.82)",
                  padding: "9px 10px",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  alignItems: "center",
                  gap: "10px",
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
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  alignItems: "center",
                  gap: "10px",
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
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  alignItems: "center",
                  gap: "10px",
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
          ) : (
            <>
              <div
                style={{
                  borderRadius: "11px",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  background: "rgba(2, 16, 36, 0.82)",
                  padding: "9px 10px",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  alignItems: "center",
                  gap: "10px",
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
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  alignItems: "center",
                  gap: "10px",
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
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  alignItems: "center",
                  gap: "10px",
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
          {flareTalked ? "Follow Flare." : "Find Flare and talk to him."}
        </p>
        {flareNearby && !flareTalked ? (
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
            {CHAPTER1_FLARE_DIALOGUE}
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
  },
};

export default chapter1;
