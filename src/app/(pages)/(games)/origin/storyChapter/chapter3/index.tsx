import * as THREE from "three";
import SceneLauncher from "@/app/asset/scenes/general/SceneLauncher";
import type { PlayerUiState } from "@/app/asset/entity/character/general/player";
import type {
  SceneDefinition,
  SceneSetupContext,
  SceneUiState,
} from "@/app/asset/scenes/general/sceneTypes";
import type {
  BurningFactoryCameraPreset,
  BurningFactoryFightConfig,
} from "@/app/asset/scenes/chapterScene/burningFactory/sceneDefinition";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  StoryChapterComponentProps,
  StoryChapterDefinition,
} from "../general/types";
import { createChapter3BurningFactoryScene2HandEffects } from "./burningFactoryScene2HandEffects";

const chapter3Rules = {
  sceneCallRules: [],
  rightPanelFillRules: [],
  gameRules: [],
  displayRules: [],
};

type Chapter3Subtitle = {
  text: string;
  shakeLevel: 0 | 1 | 2 | 3;
};

type Chapter3SceneUiState = {
  burningFactoryFightStage?: string;
  burningFactoryFightCompleted?: boolean;
};

type Vec3Tuple = [number, number, number];

type Chapter3RelativeCameraEditableShot = {
  anchor: "mada" | "duo";
  initialPosition: Vec3Tuple;
  initialRotationDeg: Vec3Tuple;
  lookDistance: number;
};

type Chapter3PreScene3CameraEditableShot = Chapter3RelativeCameraEditableShot & {
  secondHalf?: Chapter3RelativeCameraEditableShot & {
    splitProgress?: number;
  };
};

type Chapter3PreScene4CameraEditableShot = Omit<
  Chapter3RelativeCameraEditableShot,
  "anchor"
> & {
  anchor: "mada" | "duo" | "world";
  endPosition: Vec3Tuple;
};

type Chapter3AbsoluteCameraEditableShot = {
  initialPosition: Vec3Tuple;
  initialRotationDeg: Vec3Tuple;
  lookDistance: number;
};

type Chapter3Scene1CameraEditableShot = Chapter3AbsoluteCameraEditableShot & {
  orbit: {
    center: Vec3Tuple;
    radiusStart: number;
    radiusEnd: number;
    heightStart: number;
    heightEnd: number;
    angleSpeed: number;
    angleStartBias: number;
  };
};

type BurningFactoryCameraEditableConfig = {
  preScene1: Chapter3RelativeCameraEditableShot;
  preScene2: Chapter3RelativeCameraEditableShot;
  preScene3: Chapter3PreScene3CameraEditableShot;
  preScene4: Chapter3PreScene4CameraEditableShot;
  scene1: Chapter3Scene1CameraEditableShot;
  scene2: Chapter3AbsoluteCameraEditableShot;
};

// Editable camera block for Chapter 3 BurningFactory.
const CHAPTER3_BURNING_FACTORY_CAMERA_EDITABLE: BurningFactoryCameraEditableConfig = {
  preScene1: {
    anchor: "mada",
    initialPosition: [-10, 2, 5],
    initialRotationDeg: [-10, 80, 0],
    lookDistance: 1.48,
  },
  preScene2: {
    anchor: "mada",
    initialPosition: [-15, 2, 5],
    initialRotationDeg: [-10, 100, 0],
    lookDistance: 1.4,
  },
  preScene3: {
    anchor: "mada",
    initialPosition: [10, 2, 5],
    initialRotationDeg: [-15, -100, 0],
    lookDistance: 1.4,
    secondHalf: {
      anchor: "mada",
      initialPosition: [-10, 2, 5],
      initialRotationDeg: [-15, 100, 0],
      lookDistance: 1.6,
      splitProgress: 0.5,
    },
  },
  preScene4: {
    anchor: "world",
    initialPosition: [0, 2, -30],
    endPosition: [0, 0, -2],
    initialRotationDeg: [0, 180, 0],
    lookDistance: 14.26,
  },
  scene1: {
    initialPosition: [0, 0, 0],
    initialRotationDeg: [0, 0, 0],
    lookDistance: 25.4,
    orbit: {
      center: [0, 1, 9],
      radiusStart: 25,
      radiusEnd: 8,
      heightStart: 18.5,
      heightEnd: 13.8,
      angleSpeed: 0.0001,
      angleStartBias: -0.42,
    },
  },
  scene2: {
    initialPosition: [0, 0, 17],
    initialRotationDeg: [25, -5, 0],
    lookDistance: 7.65,
  },
};

const rotationDegToLookAtPoint = (
  initialPosition: Vec3Tuple,
  initialRotationDeg: Vec3Tuple,
  lookDistance: number
): Vec3Tuple => {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(initialRotationDeg[0]),
    THREE.MathUtils.degToRad(initialRotationDeg[1]),
    THREE.MathUtils.degToRad(initialRotationDeg[2]),
    "XYZ"
  );
  const distance = Math.max(0.001, lookDistance);
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler).normalize();
  return [
    initialPosition[0] + forward.x * distance,
    initialPosition[1] + forward.y * distance,
    initialPosition[2] + forward.z * distance,
  ];
};

const buildBurningFactoryCameraPreset = (
  editable: BurningFactoryCameraEditableConfig
): BurningFactoryCameraPreset => {
  const buildRelativeShot = (shot: Chapter3RelativeCameraEditableShot) => ({
    anchor: shot.anchor,
    initialPosition: shot.initialPosition,
    initialLookAtOffset: rotationDegToLookAtPoint(
      shot.initialPosition,
      shot.initialRotationDeg,
      shot.lookDistance
    ),
  });
  const buildAbsoluteShot = (shot: Chapter3AbsoluteCameraEditableShot) => ({
    initialPosition: shot.initialPosition,
    initialLookAt: rotationDegToLookAtPoint(
      shot.initialPosition,
      shot.initialRotationDeg,
      shot.lookDistance
    ),
  });
  const buildPreScene4Shot = (shot: Chapter3PreScene4CameraEditableShot) => ({
    anchor: shot.anchor,
    initialPosition: shot.initialPosition,
    initialLookAtOffset: rotationDegToLookAtPoint(
      shot.initialPosition,
      shot.initialRotationDeg,
      shot.lookDistance
    ),
    endPosition: shot.endPosition,
  });
  return {
    preScene1: buildRelativeShot(editable.preScene1),
    preScene2: buildRelativeShot(editable.preScene2),
    preScene3: {
      ...buildRelativeShot(editable.preScene3),
      secondHalf: editable.preScene3.secondHalf
        ? {
            ...buildRelativeShot(editable.preScene3.secondHalf),
            splitProgress: editable.preScene3.secondHalf.splitProgress,
          }
        : undefined,
    },
    preScene4: buildPreScene4Shot(editable.preScene4),
    scene1: {
      ...buildAbsoluteShot(editable.scene1),
      orbit: editable.scene1.orbit,
    },
    scene2: buildAbsoluteShot(editable.scene2),
  };
};

const CHAPTER3_BURNING_FACTORY_CAMERA_PRESET = buildBurningFactoryCameraPreset(
  CHAPTER3_BURNING_FACTORY_CAMERA_EDITABLE
);

const CHAPTER3_BURNING_FACTORY_FIGHT_CONFIG: BurningFactoryFightConfig = {
  agmaModelPath: "/assets/special/agma/agma_fight_agma.glb",
  madaModelPath: "/assets/special/agma/agma_fight_mada.glb",
  targetModelHeight: 9,
  stageSequence: [
    {
      key: "preScene1",
      waitFor: "mada",
      showAgma: false,
      madaClipName: "preScene1Mada",
      agmaClipName: null,
    },
    {
      key: "preScene2",
      waitFor: "both",
      showAgma: true,
      madaClipName: "preScene2Mada-Armature",
      agmaClipName: "preScene2Agma",
    },
    {
      key: "preScene3",
      waitFor: "both",
      showAgma: true,
      madaClipName: "preScene3Mada-Armature",
      agmaClipName: "preScene3Agma",
    },
    {
      key: "preScene4",
      waitFor: "both",
      showAgma: true,
      madaClipName: "preScene4Mada",
      agmaClipName: "preScene4Agma-Armature.001",
    },
    {
      key: "scene1",
      waitFor: "both",
      showAgma: true,
      madaClipName: "scene1Mada-Armature",
      agmaClipName: "scene1Agma",
    },
    {
      key: "scene2",
      waitFor: "both",
      showAgma: true,
      madaClipName: "scene2Mada",
      agmaClipName: "scene2Agma",
    },
  ],
};

const CHAPTER3_SUBTITLES: readonly Chapter3Subtitle[] = [
  {
    text: "1. Once, in a corner of the world, there was a snack factory: Dream.",
    shakeLevel: 0,
  },
  {
    text: "2. It gathered the world's brightest minds, all dedicated to creating better snacks and bringing happiness to the people.",
    shakeLevel: 0,
  },
  { text: "3. Happiness.", shakeLevel: 0 },
  { text: "4. That's how it should have been.", shakeLevel: 0 },
  {
    text: "5. \"Our snacks aren't enough—not enough to dominate the entire market!\"",
    shakeLevel: 0,
  },
  {
    text: "6. \"What more do we need? No... we've already reached our limit.\"",
    shakeLevel: 0,
  },
  { text: "7. \"...\"", shakeLevel: 0 },
  { text: "8. \"Data. We need more data!\"", shakeLevel: 0 },
  {
    text: "9. \"We gather all knowledge, throw it into this terminal container, and we will...\"",
    shakeLevel: 0,
  },
  { text: "10. \"...\"", shakeLevel: 0 },
  { text: "11. \"We will conquer every market!\"", shakeLevel: 0 },
  {
    text: "12. \"What's happening? Why is the container glass cracking? Why is it vibrating?\"",
    shakeLevel: 0,
  },
  { text: "13. \"What-\"", shakeLevel: 0 },
  {
    text: "14. \"What do you mean 'Data Overload'!? Wait, something is breaking out!\"",
    shakeLevel: 1,
  },
  { text: "15. \"HAHAHAHAHAAHAHAHA\"", shakeLevel: 2 },
  {
    text: "16. (Sound of a massive explosion)",
    shakeLevel: 3,
  },
] as const;

const CHAPTER3_SUBTITLE_FADE_MS = 320;
const CHAPTER3_BLACKOUT_MS = 3000;
const CHAPTER3_SCENE_CURTAIN_FADE_MS = 900;
const CHAPTER3_SHAKE_DURATION_MS = 2000;
const CHAPTER3_SCENE_OUTRO_DELAY_MS = 3000;
const CHAPTER3_SCENE_OUTRO_BLACK_FADE_MS = 1200;
const CHAPTER3_SCENE_OUTRO_1986_DELAY_MS = 1000;
const CHAPTER3_SCENE_OUTRO_1986_FADE_MS = 900;
const CHAPTER3_SCENE_OUTRO_COMPLETE_DELAY_MS = 5000;
const CHAPTER3_SCENE2_TIME_SCALE = 0.3;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const resolveSubtitleRedProgress = (index: number) => {
  const total = CHAPTER3_SUBTITLES.length;
  if (total <= 1) return 1;
  return clamp01(index / (total - 1));
};

const resolveSubtitleColor = (index: number) => {
  const progress = resolveSubtitleRedProgress(index);
  const channel = Math.round(255 * (1 - progress));
  return `rgb(255, ${channel}, ${channel})`;
};

function Chapter3GameFrame({ setChapterUiState }: StoryChapterComponentProps) {
  const [phase, setPhase] = useState<
    "idle" | "subtitles" | "blackout" | "scene" | "complete"
  >("idle");
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [subtitleVisible, setSubtitleVisible] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const [showSceneCurtain, setShowSceneCurtain] = useState(false);
  const [sceneCurtainTransparent, setSceneCurtainTransparent] = useState(false);
  const [showSceneOutroOverlay, setShowSceneOutroOverlay] = useState(false);
  const [sceneOutroBlackOpaque, setSceneOutroBlackOpaque] = useState(false);
  const [sceneOutroTextVisible, setSceneOutroTextVisible] = useState(false);
  const subtitleFrameRef = useRef<HTMLButtonElement | null>(null);
  const subtitleBusyRef = useRef(false);
  const lineFadeTimerRef = useRef<number | null>(null);
  const blackoutTimerRef = useRef<number | null>(null);
  const sceneCurtainStartTimerRef = useRef<number | null>(null);
  const sceneCurtainHideTimerRef = useRef<number | null>(null);
  const sceneOutroStartDelayTimerRef = useRef<number | null>(null);
  const sceneOutroBlackFadeTimerRef = useRef<number | null>(null);
  const sceneOutroTextTimerRef = useRef<number | null>(null);
  const sceneOutroCompleteTimerRef = useRef<number | null>(null);
  const shakeRafRef = useRef<number | null>(null);
  const subtitleShownAtRef = useRef(0);
  const sceneOutroTriggeredRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (lineFadeTimerRef.current !== null) {
      window.clearTimeout(lineFadeTimerRef.current);
      lineFadeTimerRef.current = null;
    }
    if (blackoutTimerRef.current !== null) {
      window.clearTimeout(blackoutTimerRef.current);
      blackoutTimerRef.current = null;
    }
    if (sceneCurtainStartTimerRef.current !== null) {
      window.clearTimeout(sceneCurtainStartTimerRef.current);
      sceneCurtainStartTimerRef.current = null;
    }
    if (sceneCurtainHideTimerRef.current !== null) {
      window.clearTimeout(sceneCurtainHideTimerRef.current);
      sceneCurtainHideTimerRef.current = null;
    }
    if (sceneOutroStartDelayTimerRef.current !== null) {
      window.clearTimeout(sceneOutroStartDelayTimerRef.current);
      sceneOutroStartDelayTimerRef.current = null;
    }
    if (sceneOutroBlackFadeTimerRef.current !== null) {
      window.clearTimeout(sceneOutroBlackFadeTimerRef.current);
      sceneOutroBlackFadeTimerRef.current = null;
    }
    if (sceneOutroTextTimerRef.current !== null) {
      window.clearTimeout(sceneOutroTextTimerRef.current);
      sceneOutroTextTimerRef.current = null;
    }
    if (sceneOutroCompleteTimerRef.current !== null) {
      window.clearTimeout(sceneOutroCompleteTimerRef.current);
      sceneOutroCompleteTimerRef.current = null;
    }
  }, []);

  const clearShakeFrame = useCallback(() => {
    if (shakeRafRef.current !== null) {
      window.cancelAnimationFrame(shakeRafRef.current);
      shakeRafRef.current = null;
    }
    const frame = subtitleFrameRef.current;
    if (frame) {
      frame.style.transform = "translate3d(0, 0, 0)";
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      clearShakeFrame();
    };
  }, [clearShakeFrame, clearTimers]);

  useEffect(() => {
    setChapterUiState((previous) =>
      previous.hideRightPanel
        ? previous
        : {
            ...previous,
            hideRightPanel: true,
          }
    );
  }, [setChapterUiState]);

  const loadBurningFactoryScene = useCallback(async (): Promise<SceneDefinition> => {
    const { createBurningFactoryScene } = await import(
      "@/app/asset/scenes/chapterScene/burningFactory/sceneDefinition"
    );
    return {
      id: "burningFactory",
      setupScene: (scene, context?: SceneSetupContext) => {
        const scene2HandEffects = createChapter3BurningFactoryScene2HandEffects(
          scene
        );
        let currentFightStage = "";
        let simNowMs = 0;
        const wrappedContext: SceneSetupContext | undefined = context
          ? {
              ...context,
              onStateChange: (state) => {
                if (typeof state.burningFactoryFightStage === "string") {
                  currentFightStage = state.burningFactoryFightStage;
                }
                scene2HandEffects.handleSceneState(state);
                context.onStateChange?.(state);
              },
            }
          : {
              onStateChange: (state) => {
                if (typeof state.burningFactoryFightStage === "string") {
                  currentFightStage = state.burningFactoryFightStage;
                }
                scene2HandEffects.handleSceneState(state);
              },
            };
        const setupResult = createBurningFactoryScene(
          scene,
          wrappedContext,
          CHAPTER3_BURNING_FACTORY_CAMERA_PRESET,
          CHAPTER3_BURNING_FACTORY_FIGHT_CONFIG
        );

        const originalTick = setupResult.world?.onTick;
        if (setupResult.world) {
          setupResult.world.onTick = (args) => {
            const timeScale =
              currentFightStage === "scene2" ? CHAPTER3_SCENE2_TIME_SCALE : 1;
            const scaledDelta = args.delta * timeScale;
            simNowMs += scaledDelta * 1000;
            originalTick?.({
              ...args,
              now: simNowMs,
              delta: scaledDelta,
            });
            scene2HandEffects.onTick(simNowMs);
          };
        }

        const originalDispose = setupResult.dispose;
        return {
          ...setupResult,
          dispose: () => {
            scene2HandEffects.dispose();
            originalDispose?.();
          },
        };
      },
    };
  }, []);

  const enterBlackout = useCallback(() => {
    if (phase !== "subtitles") return;
    clearTimers();
    subtitleBusyRef.current = false;
    setSubtitleVisible(false);
    setPhase("blackout");
    blackoutTimerRef.current = window.setTimeout(() => {
      blackoutTimerRef.current = null;
      setSceneReady(false);
      setShowSceneCurtain(true);
      setSceneCurtainTransparent(false);
      setPhase("scene");
    }, CHAPTER3_BLACKOUT_MS);
  }, [clearTimers, phase]);

  const startChapter = useCallback(() => {
    clearTimers();
    clearShakeFrame();
    subtitleBusyRef.current = false;
    sceneOutroTriggeredRef.current = false;
    setSubtitleIndex(0);
    setSubtitleVisible(true);
    setSceneReady(false);
    setShowSceneCurtain(false);
    setSceneCurtainTransparent(false);
    setShowSceneOutroOverlay(false);
    setSceneOutroBlackOpaque(false);
    setSceneOutroTextVisible(false);
    subtitleShownAtRef.current = performance.now();
    setPhase("subtitles");
    setChapterUiState((previous) => ({
      ...previous,
      hideRightPanel: true,
    }));
  }, [clearShakeFrame, clearTimers, setChapterUiState]);

  const advanceSubtitle = useCallback(() => {
    if (phase !== "subtitles" || subtitleBusyRef.current) return;
    if (subtitleIndex >= CHAPTER3_SUBTITLES.length - 1) {
      enterBlackout();
      return;
    }
    subtitleBusyRef.current = true;
    setSubtitleVisible(false);
    lineFadeTimerRef.current = window.setTimeout(() => {
      lineFadeTimerRef.current = null;
      setSubtitleIndex((current) =>
        Math.min(CHAPTER3_SUBTITLES.length - 1, current + 1)
      );
      setSubtitleVisible(true);
      subtitleBusyRef.current = false;
    }, CHAPTER3_SUBTITLE_FADE_MS);
  }, [enterBlackout, phase, subtitleIndex]);

  useEffect(() => {
    if (phase !== "subtitles") return;
    subtitleShownAtRef.current = performance.now();
  }, [phase, subtitleIndex]);

  useEffect(() => {
    if (phase !== "subtitles") return;
    const handleKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== "t") return;
      event.preventDefault();
      enterBlackout();
    };
    window.addEventListener("keydown", handleKeydown, true);
    return () => {
      window.removeEventListener("keydown", handleKeydown, true);
    };
  }, [enterBlackout, phase]);

  useEffect(() => {
    if (phase !== "subtitles") {
      clearShakeFrame();
      return;
    }
    const frame = subtitleFrameRef.current;
    if (!frame) return;

    const tick = () => {
      const now = performance.now();
      const shakeLevel = CHAPTER3_SUBTITLES[subtitleIndex]?.shakeLevel ?? 0;
      const elapsedSinceLineShown = now - subtitleShownAtRef.current;
      const effectiveShake =
        shakeLevel > 0 && elapsedSinceLineShown <= CHAPTER3_SHAKE_DURATION_MS
          ? shakeLevel
          : 0;

      if (effectiveShake > 0.001) {
        const amplitude = effectiveShake * 2.2;
        const x = Math.sin(now * 0.12) * amplitude;
        const y = Math.cos(now * 0.16) * amplitude * 0.72;
        const rotation = Math.sin(now * 0.09) * effectiveShake * 0.25;
        frame.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(
          2
        )}px, 0) rotate(${rotation.toFixed(2)}deg)`;
      } else {
        frame.style.transform = "translate3d(0, 0, 0)";
      }
      shakeRafRef.current = window.requestAnimationFrame(tick);
    };

    shakeRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      clearShakeFrame();
    };
  }, [clearShakeFrame, phase, subtitleIndex]);

  const subtitleColor = resolveSubtitleColor(subtitleIndex);
  const handlePlayerStateChange = useCallback((_: PlayerUiState) => {
    setSceneReady((current) => (current ? current : true));
  }, []);

  const startSceneOutroSequence = useCallback(() => {
    if (sceneOutroTriggeredRef.current) return;
    sceneOutroTriggeredRef.current = true;
    clearTimers();

    sceneOutroStartDelayTimerRef.current = window.setTimeout(() => {
      sceneOutroStartDelayTimerRef.current = null;
      setShowSceneOutroOverlay(true);
      setSceneOutroBlackOpaque(false);
      setSceneOutroTextVisible(false);

      sceneOutroBlackFadeTimerRef.current = window.setTimeout(() => {
        sceneOutroBlackFadeTimerRef.current = null;
        setSceneOutroBlackOpaque(true);
      }, 24);

      sceneOutroTextTimerRef.current = window.setTimeout(() => {
        sceneOutroTextTimerRef.current = null;
        setSceneOutroTextVisible(true);
      }, CHAPTER3_SCENE_OUTRO_1986_DELAY_MS);

      sceneOutroCompleteTimerRef.current = window.setTimeout(() => {
        sceneOutroCompleteTimerRef.current = null;
        setShowSceneOutroOverlay(false);
        setSceneOutroBlackOpaque(false);
        setSceneOutroTextVisible(false);
        setPhase("complete");
        setChapterUiState((previous) => ({
          ...previous,
          hideRightPanel: true,
        }));
      }, CHAPTER3_SCENE_OUTRO_1986_DELAY_MS + CHAPTER3_SCENE_OUTRO_COMPLETE_DELAY_MS);
    }, CHAPTER3_SCENE_OUTRO_DELAY_MS);
  }, [clearTimers, setChapterUiState]);

  const handleSceneStateChange = useCallback(
    (nextState: SceneUiState) => {
      const typedState = nextState as Chapter3SceneUiState;
      if (!Object.prototype.hasOwnProperty.call(typedState, "burningFactoryFightCompleted")) {
        return;
      }
      if (!typedState.burningFactoryFightCompleted) {
        return;
      }
      if (phase !== "scene" || !sceneReady) {
        return;
      }
      startSceneOutroSequence();
    },
    [phase, sceneReady, startSceneOutroSequence]
  );

  useEffect(() => {
    if (!showSceneCurtain || !sceneReady || phase !== "scene") return;

    sceneCurtainStartTimerRef.current = window.setTimeout(() => {
      sceneCurtainStartTimerRef.current = null;
      setSceneCurtainTransparent(true);
    }, 40);

    sceneCurtainHideTimerRef.current = window.setTimeout(() => {
      sceneCurtainHideTimerRef.current = null;
      setShowSceneCurtain(false);
      setSceneCurtainTransparent(false);
    }, CHAPTER3_SCENE_CURTAIN_FADE_MS + 120);

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

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px",
      }}
      >
      {phase === "idle" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid #ffffff",
            background: "#000000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.74rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#ffffff",
              fontWeight: 700,
            }}
          >
            Chapter Frame
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(1.35rem, 2.4vw, 2rem)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#ffffff",
            }}
          >
            chapter3
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.94rem",
              letterSpacing: "0.03em",
              color: "#ffffff",
            }}
          >
            Click Start to enter Chapter 3.
          </p>
          <button
            type="button"
            onClick={startChapter}
            style={{
              border: "1px solid #ffffff",
              borderRadius: "12px",
              background: "#000000",
              color: "#ffffff",
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
      ) : phase === "subtitles" ? (
        <button
          ref={subtitleFrameRef}
          type="button"
          onClick={advanceSubtitle}
          style={{
            margin: 0,
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid #ff0000",
            background: "#000000",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: "16px",
            padding: "32px",
            position: "relative",
            cursor: "pointer",
          }}
        >
          <p
            style={{
              position: "absolute",
              top: "16px",
              right: "18px",
              margin: 0,
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: subtitleColor,
              fontWeight: 700,
              opacity: 0.95,
            }}
          >
            Press T to skip
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              maxWidth: "980px",
              opacity: subtitleVisible ? 1 : 0,
              transition: `opacity ${CHAPTER3_SUBTITLE_FADE_MS}ms ease`,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "clamp(1.1rem, 1.95vw, 1.78rem)",
                lineHeight: 1.74,
                letterSpacing: "0.02em",
                color: subtitleColor,
                fontWeight: 700,
              }}
            >
              {CHAPTER3_SUBTITLES[subtitleIndex]?.text}
            </p>
            <p
              style={{
              margin: 0,
              fontSize: "0.78rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: subtitleColor,
              fontWeight: 700,
              opacity: 0.94,
            }}
          >
              Click to continue
            </p>
          </div>
        </button>
      ) : phase === "blackout" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid #220000",
            background: "#000000",
          }}
        />
      ) : phase === "scene" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid #330000",
            overflow: "hidden",
            position: "relative",
            background: "#000000",
          }}
        >
          <SceneLauncher
            sceneLoader={loadBurningFactoryScene}
            gameMode="originChapter3"
            characterPath="/assets/characters/adam/adam.glb"
            allowPrimaryAttack={false}
            allowSkills={false}
            allowJump={false}
            showMiniMap={false}
            showHud={false}
            onPlayerStateChange={handlePlayerStateChange}
            onSceneStateChange={handleSceneStateChange}
            maxPixelRatio={1.5}
            className="h-full w-full overflow-hidden rounded-[22px] border border-red-900/50 bg-black"
          />

          {!sceneReady ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                background: "#000000",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.84rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#ff0000",
                  fontWeight: 700,
                }}
              >
                Loading Burning Factory...
              </p>
            </div>
          ) : null}

          {showSceneCurtain ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: "#000000",
                opacity: sceneCurtainTransparent ? 0 : 1,
                transition: `opacity ${CHAPTER3_SCENE_CURTAIN_FADE_MS}ms ease`,
              }}
            />
          ) : null}

          {showSceneOutroOverlay ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 45,
                pointerEvents: "none",
                background: "#000000",
                opacity: sceneOutroBlackOpaque ? 1 : 0,
                transition: `opacity ${CHAPTER3_SCENE_OUTRO_BLACK_FADE_MS}ms ease`,
                display: "grid",
                placeItems: "center",
                padding: "28px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "clamp(1.8rem, 3.8vw, 3.4rem)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#ff0000",
                  fontWeight: 800,
                  opacity: sceneOutroTextVisible ? 1 : 0,
                  transition: `opacity ${CHAPTER3_SCENE_OUTRO_1986_FADE_MS}ms ease`,
                }}
              >
                1986
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid #ff0000",
            background: "#000000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.78rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#ff0000",
              fontWeight: 700,
            }}
          >
            Chapter Complete
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(1.4rem, 2.4vw, 2.2rem)",
              color: "#ff0000",
              lineHeight: 1.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Congratulations, you completed Chapter 3.
          </h2>
        </div>
      )}
    </div>
  );
}

function Chapter3RightPanel() {
  return null;
}

const chapter3: StoryChapterDefinition = {
  id: "chapter3",
  label: "chapter3",
  summary: "",
  rules: chapter3Rules,
  GameFrame: Chapter3GameFrame,
  RightPanel: Chapter3RightPanel,
  initialUiState: {
    hideRightPanel: true,
  },
};

export default chapter3;
