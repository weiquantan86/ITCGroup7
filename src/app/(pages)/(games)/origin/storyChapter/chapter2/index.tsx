import SceneLauncher from "@/app/asset/scenes/general/SceneLauncher";
import type {
  PlayerAttackHit,
  PlayerAttackTarget,
  PlayerController,
  RecoveryZone,
  PlayerUiState,
  PlayerWorldTickArgs,
} from "@/app/asset/entity/character/general/player";
import { createSceneResourceTracker } from "@/app/asset/scenes/general/resourceTracker";
import type {
  SceneDefinition,
  SceneSetupContext,
  SceneUiState,
} from "@/app/asset/scenes/general/sceneTypes";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  StoryChapterComponentProps,
  StoryChapterDefinition,
} from "../general/types";
import originStyles from "../../origin.module.css";

const chapter2Rules = {
  sceneCallRules: [],
  rightPanelFillRules: [],
  gameRules: [],
  displayRules: [],
};

const CHAPTER2_INTRO_LINES = [
  "The campfire festival is about to begin.",
  "Everyone is almost here...",
] as const;

const CHAPTER2_DIALOGUE_APPROACH = {
  speaker: "Flare",
  text: '"They will be here very soon. We need to get ready now."',
} as const;
const CHAPTER2_DIALOGUE_IGNITE = {
  speaker: "Flare",
  text: '"Now use my power to light it."',
} as const;
const CHAPTER2_DIALOGUE_ADAM_HOT = {
  speaker: "Adam",
  text: '"A bit warm."',
} as const;
const CHAPTER2_DIALOGUE_ADAM_WOW = {
  speaker: "Adam",
  text: '"Wow, that is amazing!"',
} as const;
const CHAPTER2_TASK_TEXT = "Approach the wood pile.";
const CHAPTER2_TASK_IGNITE = "Use Skill E to ignite your weapon flame.";
const CHAPTER2_TASK_IGNITE_WOOD = "Ignite the wood pile in front of you.";
const CHAPTER2_TUTORIAL_IGNITE =
  "Each character has three skills. Standard skills E and R consume Mana (blue bar). Q is the ultimate and consumes Energy (green bar).";
const CHAPTER2_TUTORIAL_BURN =
  "Flare's E skill empowers its primary attacks and applies a burning effect to targets.";
const CHAPTER2_TUTORIAL_SUPER_BURN =
  "Flare's Q puts it into an overburn state. Give it a try.";
const CHAPTER2_DIALOGUE_BONFIRE = [
  {
    speaker: "Adam",
    text: '"The fire is not very big."',
  },
  {
    speaker: "Flare",
    text: '"We need to make it burn stronger."',
  },
] as const;
const CHAPTER2_POST_FESTIVAL_DIALOGUE_SEQUENCE = [
  {
    anchorIndex: 1,
    speaker: "Flare",
    targetLabel: "Flare",
    text: '"Finally done with all that work. Nice job, buddy, hehe."',
  },
  {
    anchorIndex: 2,
    speaker: "Baron",
    targetLabel: "Baron",
    text: '"New guy, you look tense. Loosen up, do not be nervous. I can teach you some ninjutsu."',
  },
  {
    anchorIndex: 3,
    speaker: "Catrone",
    targetLabel: "Catrone",
    text: '"Why are you staring at me like that? What, do you think I am handsome? I know. Hahahahahahaha."',
  },
  {
    anchorIndex: 4,
    speaker: "Dakota",
    targetLabel: "Dakota",
    text: '"Hello, my new friend. Nice to meet you. I am Dakota. Looking forward to working with you."',
  },
  {
    anchorIndex: 5,
    speaker: "Harper",
    targetLabel: "Harper",
    text: '"Hey, want to be my little underling from hell? The benefits are not bad. Work five years and you can claim a lava hot spring in hell."',
  },
  {
    anchorIndex: 6,
    speaker: "Slimlu",
    targetLabel: "Slimlu",
    text: '"My friend, are you not hungry? I am starving. When are we eating? :("',
  },
] as const;
const CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT =
  CHAPTER2_POST_FESTIVAL_DIALOGUE_SEQUENCE.length;
const CHAPTER2_TASK_POST_FESTIVAL_DONE = "Completed";
const CHAPTER2_TUTORIAL_POST_FESTIVAL =
  "Approach the current target in order and press F to talk.";
const CHAPTER2_TASK_BONFIRE =
  "Use your ultimate to make the wood pile burn much stronger.";
const CHAPTER2_TASK_BONFIRE_DONE = "Task complete: The wood pile is blazing strongly.";
const CHAPTER2_TASK_FESTIVAL_PENDING =
  "The gathering will begin in a moment.";
const CHAPTER2_FESTIVAL_PROMPT_TEXT =
  "The campfire gathering has begun. Everyone is arriving with food.";
const CHAPTER2_TUTORIAL_FESTIVAL_PENDING =
  "Hold position and get ready for the campfire gathering scene.";
const CHAPTER2_WOOD_BURN_TARGET = 8;
const CHAPTER2_WOOD_BURN_GAIN_COOLDOWN_MS = 220;
const CHAPTER2_DIRECT_PRIMARY_OR_R_HIT_DAMAGE = new Set([
  15, // Flare super R fan tick
  18, // Flare normal attack 1
  24, // Flare normal attack 2
  32, // Flare normal attack 3
  40, // Flare super basic attacks
  46, // Flare R direct / projectile
]);

const CHAPTER2_INTRO_LINE_FADE_MS = 280;
const CHAPTER2_INTRO_TRANSITION_MS = 920;
const CHAPTER2_SCENE_CURTAIN_FADE_MS = 920;
const CHAPTER2_FESTIVAL_TRIGGER_DELAY_MS = 5000;
const CHAPTER2_FESTIVAL_REVEAL_FADE_MS = 2200;
const CHAPTER2_FESTIVAL_CINEMATIC_DURATION_MS = 7_000;
const CHAPTER2_POST_FESTIVAL_TALK_RANGE = 3.1;
const CHAPTER2_ADAM_TAKEOVER_FADE_OUT_MS = 900;
const CHAPTER2_ADAM_TAKEOVER_FADE_IN_MS = 900;
const CHAPTER2_POST_FESTIVAL_END_DELAY_MS = 5000;
const CHAPTER2_POST_FESTIVAL_END_FADE_MS = 1800;
const CHAPTER2_POST_FESTIVAL_END_HOLD_MS = 3960;
const CHAPTER2_POST_FESTIVAL_END_TEXT =
  "And so, they spent a loud, overstuffed night together :)";
const CHAPTER2_FLARE_PATH = "/assets/characters/flare/flare.glb";
const CHAPTER2_ADAM_PATH = "/assets/characters/adam/adam.glb";
const CHAPTER2_FESTIVAL_NPC_PATHS = [
  CHAPTER2_ADAM_PATH,
  CHAPTER2_FLARE_PATH,
  "/assets/characters/baron/baron.glb",
  "/assets/characters/catron/catron.glb",
  "/assets/characters/dakota/dakota.glb",
  "/assets/characters/harper/harper.glb",
  "/assets/characters/slimlu/slimlu.glb",
] as const;
const CHAPTER2_FLARE_FORWARD_DISTANCE = 20;
const CHAPTER2_WOODPILE_TASK_RADIUS = 5;
const CHAPTER2_ADAM_EDGE_Z = 9.2;
const CHAPTER2_WOODPILE_COLLIDER_RADIUS = 1.8;
const CHAPTER2_ADAM_COLLIDER_RADIUS = 0.9;
const CHAPTER2_COLLIDER_PLAYER_RADIUS = 0.5;
const CHAPTER2_ADAM_GROUND_CLEARANCE = 0.015;
const CHAPTER2_ADAM_NPC_SCALE = 0.92;
const CHAPTER2_ADAM_PLAYER_SCALE = 0.92;

type Chapter2SceneUiState = {
  chapter2WoodApproachCompleted?: boolean;
  chapter2WeaponIgnited?: boolean;
  chapter2WoodIgnited?: boolean;
  chapter2WoodBurnLevel?: number;
  chapter2FestivalPending?: boolean;
  chapter2PostFestivalMode?: boolean;
  chapter2PostFestivalTalkStep?: number;
  chapter2PostFestivalLastDialogueIndex?: number;
  chapter2PostFestivalTalkTargetNearby?: boolean;
};

type Chapter2FestivalPhase =
  | "inactive"
  | "pending"
  | "prompt"
  | "reveal"
  | "cinematic";

function Chapter2GameFrame({
  chapterUiState,
  setChapterUiState,
}: StoryChapterComponentProps) {
  const [playerControlMode, setPlayerControlMode] = useState<"flareStory" | "adamWalkSprint">(
    "flareStory"
  );
  const [phase, setPhase] = useState<
    "idle" | "intro" | "transition" | "scene" | "complete"
  >("idle");
  const [introIndex, setIntroIndex] = useState(0);
  const [introLineVisible, setIntroLineVisible] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const [showSceneCurtain, setShowSceneCurtain] = useState(false);
  const [sceneCurtainTransparent, setSceneCurtainTransparent] = useState(false);
  const [showAdamTakeoverCurtain, setShowAdamTakeoverCurtain] = useState(false);
  const [adamTakeoverCurtainOpaque, setAdamTakeoverCurtainOpaque] = useState(false);
  const [showPostFestivalEndingOverlay, setShowPostFestivalEndingOverlay] =
    useState(false);
  const [postFestivalEndingOpaque, setPostFestivalEndingOpaque] = useState(false);
  const [postFestivalEndingTextVisible, setPostFestivalEndingTextVisible] =
    useState(false);
  const [festivalPhase, setFestivalPhase] =
    useState<Chapter2FestivalPhase>("inactive");
  const [festivalPromptOpaque, setFestivalPromptOpaque] = useState(false);
  const scenePhaseRootRef = useRef<HTMLDivElement | null>(null);
  const weaponIgnitedRef = useRef(false);
  const woodIgnitedRef = useRef(false);
  const superBurnActiveRef = useRef(false);
  const woodBurnLevelRef = useRef(0);
  const festivalInputLockedRef = useRef(false);
  const festivalCinematicActiveRef = useRef(false);
  const festivalCinematicStartedAtRef = useRef(0);
  const festivalTriggeredRef = useRef(false);
  const miniMapVisibleRef = useRef(true);
  const adamControlTakeoverTriggeredRef = useRef(false);
  const playerControllerRef = useRef<PlayerController | null>(null);
  const postFestivalModeRef = useRef(false);
  const postFestivalTalkStepRef = useRef(0);
  const postFestivalTalkTargetNearbyRef = useRef(false);
  const postFestivalCurrentTargetAnchorRef = useRef<THREE.Object3D | null>(
    null
  );
  const postFestivalCurrentPlayerRef = useRef<THREE.Object3D | null>(null);
  const postFestivalEndingTriggeredRef = useRef(false);

  const introBusyRef = useRef(false);
  const introFadeTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const sceneCurtainStartTimerRef = useRef<number | null>(null);
  const sceneCurtainHideTimerRef = useRef<number | null>(null);
  const festivalPromptDelayTimerRef = useRef<number | null>(null);
  const festivalPromptFadeInTimerRef = useRef<number | null>(null);
  const festivalRevealTimerRef = useRef<number | null>(null);
  const adamTakeoverFadeToBlackTimerRef = useRef<number | null>(null);
  const adamTakeoverSwitchTimerRef = useRef<number | null>(null);
  const adamTakeoverHideCurtainTimerRef = useRef<number | null>(null);
  const postFestivalEndingDelayTimerRef = useRef<number | null>(null);
  const postFestivalEndingFadeTimerRef = useRef<number | null>(null);
  const postFestivalEndingCompleteTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (introFadeTimerRef.current !== null) {
      window.clearTimeout(introFadeTimerRef.current);
      introFadeTimerRef.current = null;
    }
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (sceneCurtainStartTimerRef.current !== null) {
      window.clearTimeout(sceneCurtainStartTimerRef.current);
      sceneCurtainStartTimerRef.current = null;
    }
    if (sceneCurtainHideTimerRef.current !== null) {
      window.clearTimeout(sceneCurtainHideTimerRef.current);
      sceneCurtainHideTimerRef.current = null;
    }
    if (festivalPromptDelayTimerRef.current !== null) {
      window.clearTimeout(festivalPromptDelayTimerRef.current);
      festivalPromptDelayTimerRef.current = null;
    }
    if (festivalPromptFadeInTimerRef.current !== null) {
      window.clearTimeout(festivalPromptFadeInTimerRef.current);
      festivalPromptFadeInTimerRef.current = null;
    }
    if (festivalRevealTimerRef.current !== null) {
      window.clearTimeout(festivalRevealTimerRef.current);
      festivalRevealTimerRef.current = null;
    }
    if (adamTakeoverFadeToBlackTimerRef.current !== null) {
      window.clearTimeout(adamTakeoverFadeToBlackTimerRef.current);
      adamTakeoverFadeToBlackTimerRef.current = null;
    }
    if (adamTakeoverSwitchTimerRef.current !== null) {
      window.clearTimeout(adamTakeoverSwitchTimerRef.current);
      adamTakeoverSwitchTimerRef.current = null;
    }
    if (adamTakeoverHideCurtainTimerRef.current !== null) {
      window.clearTimeout(adamTakeoverHideCurtainTimerRef.current);
      adamTakeoverHideCurtainTimerRef.current = null;
    }
    if (postFestivalEndingDelayTimerRef.current !== null) {
      window.clearTimeout(postFestivalEndingDelayTimerRef.current);
      postFestivalEndingDelayTimerRef.current = null;
    }
    if (postFestivalEndingFadeTimerRef.current !== null) {
      window.clearTimeout(postFestivalEndingFadeTimerRef.current);
      postFestivalEndingFadeTimerRef.current = null;
    }
    if (postFestivalEndingCompleteTimerRef.current !== null) {
      window.clearTimeout(postFestivalEndingCompleteTimerRef.current);
      postFestivalEndingCompleteTimerRef.current = null;
    }
    setShowAdamTakeoverCurtain(false);
    setAdamTakeoverCurtainOpaque(false);
    setShowPostFestivalEndingOverlay(false);
    setPostFestivalEndingOpaque(false);
    setPostFestivalEndingTextVisible(false);
    introBusyRef.current = false;
    festivalCinematicActiveRef.current = false;
    festivalInputLockedRef.current = false;
    postFestivalEndingTriggeredRef.current = false;
  }, []);

  useEffect(() => {
    weaponIgnitedRef.current = Boolean(chapterUiState.chapter2WeaponIgnited);
    woodIgnitedRef.current = Boolean(chapterUiState.chapter2WoodIgnited);
    woodBurnLevelRef.current = Math.max(
      0,
      Math.floor(chapterUiState.chapter2WoodBurnLevel ?? 0)
    );
    if (!woodIgnitedRef.current) {
      superBurnActiveRef.current = false;
    }
  }, [
    chapterUiState.chapter2WeaponIgnited,
    chapterUiState.chapter2WoodIgnited,
    chapterUiState.chapter2WoodBurnLevel,
  ]);

  useEffect(() => {
    postFestivalModeRef.current = Boolean(chapterUiState.chapter2PostFestivalMode);
    postFestivalTalkStepRef.current = Math.max(
      0,
      Math.min(
        CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT,
        Math.floor(chapterUiState.chapter2PostFestivalTalkStep ?? 0)
      )
    );
    postFestivalTalkTargetNearbyRef.current = Boolean(
      chapterUiState.chapter2PostFestivalTalkTargetNearby
    );
  }, [
    chapterUiState.chapter2PostFestivalMode,
    chapterUiState.chapter2PostFestivalTalkStep,
    chapterUiState.chapter2PostFestivalTalkTargetNearby,
  ]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    miniMapVisibleRef.current =
      phase === "scene" &&
      !showPostFestivalEndingOverlay &&
      festivalPhase !== "prompt" &&
      festivalPhase !== "reveal" &&
      festivalPhase !== "cinematic";
  }, [festivalPhase, phase, showPostFestivalEndingOverlay]);

  useEffect(() => {
    setChapterUiState((previous) => {
      const shouldHideRightPanel =
        phase !== "scene" ||
        showPostFestivalEndingOverlay ||
        festivalPhase === "prompt" ||
        festivalPhase === "reveal" ||
        festivalPhase === "cinematic";
      const nextCompleted =
        phase === "idle"
          ? false
          : Boolean(previous.chapter2WoodApproachCompleted);
      const nextWeaponIgnited =
        phase === "idle" ? false : Boolean(previous.chapter2WeaponIgnited);
      const nextWoodIgnited =
        phase === "idle" ? false : Boolean(previous.chapter2WoodIgnited);
      const nextWoodBurnLevel =
        phase === "idle"
          ? 0
          : Math.max(0, Math.floor(previous.chapter2WoodBurnLevel ?? 0));
      const nextFestivalPending =
        phase === "idle" ? false : Boolean(previous.chapter2FestivalPending);
      const nextPostFestivalMode =
        phase === "idle" ? false : Boolean(previous.chapter2PostFestivalMode);
      const nextPostFestivalTalkStep =
        phase === "idle"
          ? 0
          : Math.max(
              0,
              Math.min(
                CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT,
                Math.floor(previous.chapter2PostFestivalTalkStep ?? 0)
              )
            );
      const nextPostFestivalLastDialogueIndex =
        phase === "idle"
          ? undefined
          : Number.isFinite(previous.chapter2PostFestivalLastDialogueIndex)
            ? Math.max(
                -1,
                Math.floor(previous.chapter2PostFestivalLastDialogueIndex as number)
              )
            : undefined;
      const nextPostFestivalTalkTargetNearby =
        phase === "idle"
          ? false
          : Boolean(previous.chapter2PostFestivalTalkTargetNearby);
      if (
        previous.hideRightPanel === shouldHideRightPanel &&
        Boolean(previous.chapter2WoodApproachCompleted) === nextCompleted &&
        Boolean(previous.chapter2WeaponIgnited) === nextWeaponIgnited &&
        Boolean(previous.chapter2WoodIgnited) === nextWoodIgnited &&
        (previous.chapter2WoodBurnLevel ?? 0) === nextWoodBurnLevel &&
        Boolean(previous.chapter2FestivalPending) === nextFestivalPending &&
        Boolean(previous.chapter2PostFestivalMode) === nextPostFestivalMode &&
        (previous.chapter2PostFestivalTalkStep ?? 0) === nextPostFestivalTalkStep &&
        (previous.chapter2PostFestivalLastDialogueIndex ?? undefined) ===
          nextPostFestivalLastDialogueIndex &&
        Boolean(previous.chapter2PostFestivalTalkTargetNearby) ===
          nextPostFestivalTalkTargetNearby
      ) {
        return previous;
      }
      return {
        ...previous,
        hideRightPanel: shouldHideRightPanel,
        chapter2WoodApproachCompleted: nextCompleted,
        chapter2WeaponIgnited: nextWeaponIgnited,
        chapter2WoodIgnited: nextWoodIgnited,
        chapter2WoodBurnLevel: nextWoodBurnLevel,
        chapter2FestivalPending: nextFestivalPending,
        chapter2PostFestivalMode: nextPostFestivalMode,
        chapter2PostFestivalTalkStep: nextPostFestivalTalkStep,
        chapter2PostFestivalLastDialogueIndex: nextPostFestivalLastDialogueIndex,
        chapter2PostFestivalTalkTargetNearby: nextPostFestivalTalkTargetNearby,
      };
    });
  }, [festivalPhase, phase, setChapterUiState, showPostFestivalEndingOverlay]);

  const startChapter = useCallback(() => {
    clearTimers();
    setIntroIndex(0);
    setIntroLineVisible(true);
    setSceneReady(false);
    setShowSceneCurtain(false);
    setSceneCurtainTransparent(false);
    setShowAdamTakeoverCurtain(false);
    setAdamTakeoverCurtainOpaque(false);
    setFestivalPhase("inactive");
    setFestivalPromptOpaque(false);
    superBurnActiveRef.current = false;
    woodBurnLevelRef.current = 0;
    festivalTriggeredRef.current = false;
    festivalCinematicStartedAtRef.current = 0;
    adamControlTakeoverTriggeredRef.current = false;
    postFestivalModeRef.current = false;
    postFestivalTalkStepRef.current = 0;
    postFestivalTalkTargetNearbyRef.current = false;
    postFestivalCurrentTargetAnchorRef.current = null;
    postFestivalCurrentPlayerRef.current = null;
    setPlayerControlMode("flareStory");
    playerControllerRef.current?.setCharacterPath(CHAPTER2_FLARE_PATH);
    setPhase("intro");
    setChapterUiState((previous) => ({
      ...previous,
      hideRightPanel: true,
      chapter2WoodApproachCompleted: false,
      chapter2WeaponIgnited: false,
      chapter2WoodIgnited: false,
      chapter2WoodBurnLevel: 0,
      chapter2FestivalPending: false,
      chapter2PostFestivalMode: false,
      chapter2PostFestivalTalkStep: 0,
      chapter2PostFestivalLastDialogueIndex: undefined,
      chapter2PostFestivalTalkTargetNearby: false,
    }));
  }, [clearTimers, setChapterUiState]);

  const transitionToScene = useCallback(() => {
    setPhase("transition");
    setSceneReady(false);
    setShowSceneCurtain(false);
    setSceneCurtainTransparent(false);
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      setPhase("scene");
      setShowSceneCurtain(true);
      setSceneCurtainTransparent(false);
    }, CHAPTER2_INTRO_TRANSITION_MS);
  }, []);

  const advanceIntro = useCallback(() => {
    if (phase !== "intro" || introBusyRef.current) return;
    introBusyRef.current = true;
    setIntroLineVisible(false);
    setIntroIndex((currentIndex) => {
      const isLastLine = currentIndex >= CHAPTER2_INTRO_LINES.length - 1;
      if (isLastLine) {
        introFadeTimerRef.current = window.setTimeout(() => {
          introFadeTimerRef.current = null;
          transitionToScene();
          introBusyRef.current = false;
        }, CHAPTER2_INTRO_LINE_FADE_MS);
        return currentIndex;
      }
      const nextIndex = currentIndex + 1;
      introFadeTimerRef.current = window.setTimeout(() => {
        introFadeTimerRef.current = null;
        setIntroIndex(nextIndex);
        setIntroLineVisible(true);
        introBusyRef.current = false;
      }, CHAPTER2_INTRO_LINE_FADE_MS);
      return currentIndex;
    });
  }, [phase, transitionToScene]);

  const loadForestScene = useCallback(async (): Promise<SceneDefinition> => {
    const { createForestScene } = await import(
      "@/app/asset/scenes/chapterScene/forest/sceneDefinition"
    );

    return {
      id: "forest",
      setupScene: (
        scene: THREE.Scene,
        context?: SceneSetupContext
      ) => {
        const baseResult = createForestScene(scene);
        const world = baseResult.world;
        if (!world) {
          return baseResult;
        }
        const attackTargets = world.attackTargets ?? [];
        if (!world.attackTargets) {
          world.attackTargets = attackTargets;
        }
        const recoveryZones = world.recoveryZones ?? [];
        if (!world.recoveryZones) {
          world.recoveryZones = recoveryZones;
        }
        const freeResourceZone: RecoveryZone = {
          id: "chapter2_woodpile_superburn_free_resource",
          type: "both",
          minX: -100000,
          maxX: 100000,
          minZ: -100000,
          maxZ: 100000,
          cooldownMs: 0,
        };
        let freeResourceZoneEnabled = false;
        const setFreeResourceZoneEnabled = (enabled: boolean) => {
          if (enabled === freeResourceZoneEnabled) return;
          freeResourceZoneEnabled = enabled;
          const existingIndex = recoveryZones.findIndex((zone) => zone.id === freeResourceZone.id);
          if (enabled) {
            if (existingIndex < 0) {
              recoveryZones.push(freeResourceZone);
            }
            return;
          }
          if (existingIndex >= 0) {
            recoveryZones.splice(existingIndex, 1);
          }
        };

        const tracker = createSceneResourceTracker();
        const { trackMesh, trackObject, disposeObjectResources, disposeTrackedResources } =
          tracker;
        let isDisposed = false;
        let woodPileIgnited = false;
        let woodPileBurnLevel = 0;
        let lastBurnGainAt = -Infinity;

        const setPieceRoot = new THREE.Group();
        setPieceRoot.name = "chapter2SetPieceRoot";
        scene.add(setPieceRoot);

        const woodPileCenter = new THREE.Vector3(0, world.groundY, 0);
        const festivalCrowdRingRadius = 7.4;
        const festivalLookTarget = new THREE.Vector3(
          woodPileCenter.x,
          world.groundY + 1.08,
          woodPileCenter.z
        );
        const festivalNpcAnchors: THREE.Group[] = [];
        const festivalNpcFallbacks: THREE.Mesh[] = [];
        const festivalNpcModels: Array<{
          anchor: THREE.Group;
          model: THREE.Object3D;
          modelBaseQuaternion: THREE.Quaternion;
        }> = [];
        let festivalCrowdPrepared = false;

        // Hidden combat proxy so Flare's per-target burn FX remains non-visible on wood pile.
        const woodPileHitAnchor = new THREE.Group();
        woodPileHitAnchor.name = "chapter2WoodPileHitAnchor";
        woodPileHitAnchor.visible = false;
        woodPileHitAnchor.position.set(woodPileCenter.x, world.groundY + 0.75, woodPileCenter.z);
        setPieceRoot.add(woodPileHitAnchor);

        const woodPileHitCollider = new THREE.Mesh(
          new THREE.SphereGeometry(1.75, 12, 12),
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          })
        );
        woodPileHitCollider.name = "chapter2_wood_pile_collider";
        woodPileHitCollider.visible = false;
        woodPileHitAnchor.add(woodPileHitCollider);
        trackMesh(woodPileHitCollider);

        const woodMaterial = new THREE.MeshStandardMaterial({
          color: 0x6b3d21,
          roughness: 0.9,
          metalness: 0.08,
          emissive: 0x0,
          emissiveIntensity: 0,
        });
        const ropeMaterial = new THREE.MeshStandardMaterial({
          color: 0x8b5a2b,
          roughness: 0.92,
          metalness: 0.03,
          emissive: 0x0,
          emissiveIntensity: 0,
        });

        const addWoodLog = (
          x: number,
          y: number,
          z: number,
          length: number,
          radius: number,
          yaw: number
        ) => {
          const log = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius * 1.04, length, 12),
            woodMaterial
          );
          log.rotation.z = Math.PI / 2;
          log.rotation.y = yaw;
          log.position.set(x, y, z);
          log.castShadow = true;
          log.receiveShadow = true;
          setPieceRoot.add(log);
          trackMesh(log);
        };

        const ringRadii = [1.3, 0.95, 0.65] as const;
        for (let layer = 0; layer < ringRadii.length; layer += 1) {
          const ringRadius = ringRadii[layer];
          const count = 8 - layer * 2;
          const y = world.groundY + 0.28 + layer * 0.22;
          for (let i = 0; i < count; i += 1) {
            const angle = (i / count) * Math.PI * 2;
            addWoodLog(
              woodPileCenter.x + Math.cos(angle) * ringRadius,
              y,
              woodPileCenter.z + Math.sin(angle) * ringRadius,
              2.4 - layer * 0.2,
              0.2 - layer * 0.02,
              angle
            );
          }
        }

        const ropeRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.45, 0.06, 8, 28),
          ropeMaterial
        );
        ropeRing.rotation.x = Math.PI / 2;
        ropeRing.position.set(woodPileCenter.x, world.groundY + 0.48, woodPileCenter.z);
        ropeRing.castShadow = true;
        ropeRing.receiveShadow = true;
        setPieceRoot.add(ropeRing);
        trackMesh(ropeRing);

        const woodPileIgniteLight = new THREE.PointLight(0xff6b00, 0, 11, 2);
        woodPileIgniteLight.position.set(
          woodPileCenter.x,
          world.groundY + 1.55,
          woodPileCenter.z
        );
        setPieceRoot.add(woodPileIgniteLight);

        type WoodPileFlameTongue = {
          mesh: THREE.Mesh<THREE.ConeGeometry, THREE.MeshStandardMaterial>;
          material: THREE.MeshStandardMaterial;
          phase: number;
          orbitRadius: number;
          orbitSpeed: number;
          tilt: number;
          baseScale: THREE.Vector3;
          lift: number;
        };
        type WoodPileFlameEmber = {
          mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
          material: THREE.MeshBasicMaterial;
          phase: number;
          radius: number;
          speed: number;
          lift: number;
          scale: number;
        };

        const woodPileFlameRoot = new THREE.Group();
        woodPileFlameRoot.position.set(
          woodPileCenter.x,
          world.groundY + 0.64,
          woodPileCenter.z
        );
        woodPileFlameRoot.visible = false;
        setPieceRoot.add(woodPileFlameRoot);

        const woodPileFlameShellGeometry = new THREE.ConeGeometry(0.44, 1.24, 18, 1, true);
        woodPileFlameShellGeometry.translate(0, 0.62, 0);
        const woodPileFlameCoreGeometry = new THREE.ConeGeometry(0.28, 0.94, 16, 1, true);
        woodPileFlameCoreGeometry.translate(0, 0.47, 0);
        const woodPileFlameTongueGeometry = new THREE.ConeGeometry(0.14, 0.66, 12, 1, true);
        woodPileFlameTongueGeometry.translate(0, 0.33, 0);
        const woodPileFlameEmberGeometry = new THREE.SphereGeometry(0.04, 8, 8);

        const woodPileFlameShellMaterial = new THREE.MeshStandardMaterial({
          color: 0xff5a1f,
          emissive: 0xff2200,
          emissiveIntensity: 1.2,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          roughness: 0.5,
          metalness: 0.04,
          side: THREE.DoubleSide,
        });
        const woodPileFlameCoreMaterial = new THREE.MeshStandardMaterial({
          color: 0xffb347,
          emissive: 0xff7e1c,
          emissiveIntensity: 1.7,
          transparent: true,
          opacity: 0.86,
          depthWrite: false,
          roughness: 0.36,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });

        const woodPileFlameShell = new THREE.Mesh(
          woodPileFlameShellGeometry,
          woodPileFlameShellMaterial
        );
        woodPileFlameShell.frustumCulled = false;
        woodPileFlameRoot.add(woodPileFlameShell);
        trackMesh(woodPileFlameShell);

        const woodPileFlameCore = new THREE.Mesh(
          woodPileFlameCoreGeometry,
          woodPileFlameCoreMaterial
        );
        woodPileFlameCore.frustumCulled = false;
        woodPileFlameRoot.add(woodPileFlameCore);
        trackMesh(woodPileFlameCore);

        const woodPileFlameTongues: WoodPileFlameTongue[] = Array.from(
          { length: 12 },
          (_, index) => {
            const material = new THREE.MeshStandardMaterial({
              color: index % 2 === 0 ? 0xff7a2f : 0xff3f15,
              emissive: 0xff2b0f,
              emissiveIntensity: 1.02,
              transparent: true,
              opacity: 0.56,
              depthWrite: false,
              roughness: 0.44,
              metalness: 0.02,
              side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(woodPileFlameTongueGeometry, material);
            mesh.frustumCulled = false;
            mesh.visible = true;
            woodPileFlameRoot.add(mesh);
            trackMesh(mesh);
            const baseScale = new THREE.Vector3(
              0.44 + (index % 3) * 0.06,
              0.66 + (index % 4) * 0.05,
              0.44 + ((index + 1) % 3) * 0.06
            );
            return {
              mesh,
              material,
              phase: (index / 12) * Math.PI * 2,
              orbitRadius: 0.34 + (index % 4) * 0.06,
              orbitSpeed: 0.86 + (index % 5) * 0.24,
              tilt: 0.18 + (index % 3) * 0.08,
              baseScale,
              lift: 0.02 + (index % 4) * 0.06,
            };
          }
        );

        const woodPileFlameEmbers: WoodPileFlameEmber[] = Array.from(
          { length: 22 },
          (_, index) => {
            const material = new THREE.MeshBasicMaterial({
              color: index % 2 === 0 ? 0xff7832 : 0xffc071,
              transparent: true,
              opacity: 0,
              depthWrite: false,
            });
            const mesh = new THREE.Mesh(woodPileFlameEmberGeometry, material);
            mesh.frustumCulled = false;
            mesh.visible = false;
            woodPileFlameRoot.add(mesh);
            trackMesh(mesh);
            return {
              mesh,
              material,
              phase: (index / 22) * Math.PI * 2,
              radius: 0.18 + (index % 6) * 0.05,
              speed: 0.72 + (index % 7) * 0.18,
              lift: 0.68 + (index % 5) * 0.26,
              scale: 0.78 + (index % 4) * 0.18,
            };
          }
        );

        const updateWoodPileFlameFx = (nowMs: number) => {
          if (!woodPileIgnited) {
            woodPileFlameRoot.visible = false;
            return;
          }
          const t = nowMs * 0.001;
          woodPileFlameRoot.visible = true;
          const burnProgress = THREE.MathUtils.clamp(
            (woodPileBurnLevel - 1) / Math.max(1, CHAPTER2_WOOD_BURN_TARGET - 1),
            0,
            1
          );
          const burnBoost = 1 + burnProgress * 1.28;
          const pulse = 0.5 + 0.5 * Math.sin(t * 7.8);
          const flicker = 0.5 + 0.5 * Math.sin(t * 14.6 + 1.1);

          woodPileFlameShell.scale.set(
            (0.94 + pulse * 0.16) * (1 + burnProgress * 0.42),
            (1.06 + flicker * 0.24) * burnBoost,
            (0.94 + pulse * 0.16) * (1 + burnProgress * 0.42)
          );
          woodPileFlameShell.rotation.y = t * 0.72;
          woodPileFlameShellMaterial.opacity = 0.48 + pulse * 0.34 + burnProgress * 0.12;
          woodPileFlameShellMaterial.emissiveIntensity =
            (1.04 + flicker * 0.9) * (1 + burnProgress * 0.9);

          woodPileFlameCore.scale.set(
            (0.82 + flicker * 0.2) * (1 + burnProgress * 0.28),
            (0.98 + pulse * 0.22) * burnBoost,
            (0.82 + flicker * 0.2) * (1 + burnProgress * 0.28)
          );
          woodPileFlameCore.rotation.y = -t * 1.04;
          woodPileFlameCoreMaterial.opacity = 0.58 + flicker * 0.32 + burnProgress * 0.1;
          woodPileFlameCoreMaterial.emissiveIntensity =
            (1.48 + pulse * 1.2) * (1 + burnProgress * 1.15);

          for (let i = 0; i < woodPileFlameTongues.length; i += 1) {
            const tongue = woodPileFlameTongues[i];
            const spin = t * tongue.orbitSpeed + tongue.phase;
            const surge = 0.74 + 0.26 * Math.sin(t * (9.2 + i * 0.17) + tongue.phase);
            tongue.mesh.position.set(
              Math.cos(spin) * tongue.orbitRadius,
              tongue.lift + Math.sin(t * (5.4 + i * 0.06) + tongue.phase) * 0.06,
              Math.sin(spin) * tongue.orbitRadius
            );
            tongue.mesh.rotation.set(
              Math.sin(spin) * tongue.tilt,
              spin,
              Math.cos(spin) * tongue.tilt
            );
            tongue.mesh.scale
              .copy(tongue.baseScale)
              .multiplyScalar((0.84 + surge * 0.34) * (1 + burnProgress * 0.58));
            tongue.material.opacity = 0.32 + surge * 0.32 + burnProgress * 0.1;
            tongue.material.emissiveIntensity =
              (0.96 + surge * 0.88) * (1 + burnProgress * 0.95);
          }

          for (let i = 0; i < woodPileFlameEmbers.length; i += 1) {
            const ember = woodPileFlameEmbers[i];
            const risePhase = (t * (0.72 + i * 0.05) + ember.phase * 0.21) % 1;
            const orbit = t * ember.speed + ember.phase;
            const shimmer = 0.52 + 0.48 * Math.sin(t * (8.3 + i * 0.12) + ember.phase);
            ember.mesh.visible = true;
            ember.mesh.position.set(
              Math.cos(orbit) * ember.radius * (0.82 + risePhase * 0.28),
              0.14 + risePhase * ember.lift * (1 + burnProgress * 0.22),
              Math.sin(orbit) * ember.radius * (0.82 + risePhase * 0.28)
            );
            ember.mesh.scale.setScalar(
              ember.scale * (0.44 + shimmer * 0.42) * (1 + burnProgress * 0.64)
            );
            ember.material.opacity =
              (1 - risePhase) * (0.24 + shimmer * 0.46) * (1 + burnProgress * 0.7);
          }
          woodPileIgniteLight.intensity = 1.7 + burnProgress * 2.7 + flicker * 0.6;
          woodPileIgniteLight.distance = 11 + burnProgress * 6.5;
        };

        const setAnchorOnFestivalRing = (
          anchor: THREE.Object3D,
          index: number,
          total: number,
          radius: number
        ) => {
          const angle = (index / total) * Math.PI * 2 - Math.PI * 0.5;
          const anchorX = woodPileCenter.x + Math.cos(angle) * radius;
          const anchorZ = woodPileCenter.z + Math.sin(angle) * radius;
          anchor.position.set(
            anchorX,
            world.groundY,
            anchorZ
          );
          anchor.rotation.set(
            0,
            Math.atan2(festivalLookTarget.x - anchorX, festivalLookTarget.z - anchorZ),
            0
          );
        };

        const groundBounds = new THREE.Box3();
        const groundMeshBounds = new THREE.Box3();
        const groundModelOnAnchor = (model: THREE.Object3D, anchor: THREE.Object3D) => {
          groundBounds.makeEmpty();
          model.updateMatrixWorld(true);
          let hasGroundableMesh = false;
          model.traverse((child) => {
            if (!("isMesh" in child) || !(child as THREE.Mesh).isMesh) return;
            const mesh = child as THREE.Mesh;
            if (!mesh.visible) return;
            const nodeName = mesh.name.trim().toLowerCase();
            if (/(weapon|sword|fx|vfx|trail|aura|helper|collider|hitbox)/.test(nodeName)) {
              return;
            }
            const geometry = mesh.geometry;
            if (!geometry) return;
            if (!geometry.boundingBox) {
              geometry.computeBoundingBox();
            }
            if (!geometry.boundingBox) return;
            groundMeshBounds.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
            if (!Number.isFinite(groundMeshBounds.min.y) || !Number.isFinite(groundMeshBounds.max.y)) {
              return;
            }
            if (!hasGroundableMesh) {
              groundBounds.copy(groundMeshBounds);
              hasGroundableMesh = true;
            } else {
              groundBounds.union(groundMeshBounds);
            }
          });
          if (!hasGroundableMesh || groundBounds.isEmpty()) return;
          anchor.getWorldPosition(npcAnchorWorldPosition);
          const localMinY = groundBounds.min.y - npcAnchorWorldPosition.y;
          if (!Number.isFinite(localMinY)) return;
          model.position.y -= localMinY - CHAPTER2_ADAM_GROUND_CLEARANCE;
          model.updateMatrixWorld(true);
        };

        const spawnFestivalFoodProps = () => {
          const foodRoot = new THREE.Group();
          foodRoot.name = "chapter2FestivalFoodRoot";
          foodRoot.visible = false;
          setPieceRoot.add(foodRoot);
          const pseudoRandom = (seed: number) => {
            const x = Math.sin(seed * 12.9898) * 43758.5453123;
            return x - Math.floor(x);
          };
          const foodArchetypes = [
            {
              kind: "meat",
              colorPalette: [0xd06453, 0xb24a3d, 0x8f372f, 0xcd8260] as const,
              roughness: 0.72,
              metalness: 0.06,
              emissiveIntensity: 0.06,
              scaleMultiplier: 1.1,
              geometryFactories: [
                () => new THREE.CapsuleGeometry(0.12, 0.22, 4, 8),
                () => new THREE.BoxGeometry(0.32, 0.16, 0.2),
                () => new THREE.CylinderGeometry(0.1, 0.12, 0.22, 10),
              ] as const,
            },
            {
              kind: "vegetable",
              colorPalette: [0x6fa35a, 0x4f8d3f, 0xa8c66c, 0x7fb36e] as const,
              roughness: 0.76,
              metalness: 0.04,
              emissiveIntensity: 0.05,
              scaleMultiplier: 0.92,
              geometryFactories: [
                () => new THREE.ConeGeometry(0.09, 0.28, 10),
                () => new THREE.CylinderGeometry(0.07, 0.08, 0.26, 10),
                () => new THREE.CapsuleGeometry(0.08, 0.18, 4, 8),
              ] as const,
            },
            {
              kind: "fruit",
              colorPalette: [0xff6b6b, 0xffb347, 0xe879f9, 0x8ac926, 0xfde68a] as const,
              roughness: 0.62,
              metalness: 0.1,
              emissiveIntensity: 0.09,
              scaleMultiplier: 0.98,
              geometryFactories: [
                () => new THREE.SphereGeometry(0.12, 10, 10),
                () => new THREE.IcosahedronGeometry(0.13, 0),
                () => new THREE.TorusGeometry(0.1, 0.03, 8, 14),
              ] as const,
            },
          ] as const;
          type FoodKind = (typeof foodArchetypes)[number]["kind"];
          const primaryKinds: FoodKind[] = ["meat", "vegetable", "fruit"];
          const foodClusterCount = 8;
          const foodClusterRingRadius = 3.25;
          const foodClusterDefinitions: Array<{
            angle: number;
            radius: number;
            count: number;
            spread: number;
            yLift: number;
            primaryKind: FoodKind;
          }> = Array.from({ length: foodClusterCount }, (_, index) => {
            const angle = (index / foodClusterCount) * Math.PI * 2 - Math.PI * 0.5;
            const primaryKind = primaryKinds[index % primaryKinds.length];
            return {
              angle,
              radius: foodClusterRingRadius,
              count: 30,
              spread: 0.62,
              yLift: 0.06,
              primaryKind,
            };
          });
          const foodKindToArchetypeIndex: Record<
            (typeof foodArchetypes)[number]["kind"],
            number
          > = {
            meat: 0,
            vegetable: 1,
            fruit: 2,
          };

          let globalFoodIndex = 0;
          for (let clusterIndex = 0; clusterIndex < foodClusterDefinitions.length; clusterIndex += 1) {
            const cluster = foodClusterDefinitions[clusterIndex];
            const clusterCenterX =
              woodPileCenter.x + Math.cos(cluster.angle) * cluster.radius;
            const clusterCenterZ =
              woodPileCenter.z + Math.sin(cluster.angle) * cluster.radius;
            const trayColor =
              cluster.primaryKind === "meat"
                ? 0x4a3528
                : cluster.primaryKind === "vegetable"
                  ? 0x2f4632
                  : 0x473a52;
            const tray = new THREE.Mesh(
              new THREE.CylinderGeometry(1.05, 1.18, 0.08, 20),
              new THREE.MeshStandardMaterial({
                color: trayColor,
                roughness: 0.86,
                metalness: 0.08,
              })
            );
            tray.position.set(clusterCenterX, world.groundY + 0.03, clusterCenterZ);
            tray.rotation.y = cluster.angle + Math.PI * 0.5;
            tray.castShadow = true;
            tray.receiveShadow = true;
            foodRoot.add(tray);
            trackMesh(tray);

            for (let i = 0; i < cluster.count; i += 1) {
              const seed = globalFoodIndex * 1.137 + clusterIndex * 31.7 + 0.93;
              const primaryArchetypeIndex =
                foodKindToArchetypeIndex[cluster.primaryKind];
              const alternateArchetypeIndex = Math.min(
                foodArchetypes.length - 1,
                Math.floor(pseudoRandom(seed + 1.3) * foodArchetypes.length)
              );
              const archetypeIndex =
                pseudoRandom(seed + 2.2) < 0.7
                  ? primaryArchetypeIndex
                  : alternateArchetypeIndex;
              const archetype = foodArchetypes[archetypeIndex];
              const geometryIndex = Math.min(
                archetype.geometryFactories.length - 1,
                Math.floor(
                  pseudoRandom(seed + 3.9) * archetype.geometryFactories.length
                )
              );
              const geometry = archetype.geometryFactories[geometryIndex]();
              const colorIndex = Math.min(
                archetype.colorPalette.length - 1,
                Math.floor(pseudoRandom(seed + 6.1) * archetype.colorPalette.length)
              );
              const color = archetype.colorPalette[colorIndex];
              const material = new THREE.MeshStandardMaterial({
                color,
                roughness: archetype.roughness,
                metalness: archetype.metalness,
                emissive: color,
                emissiveIntensity: archetype.emissiveIntensity,
              });
              const mesh = new THREE.Mesh(geometry, material);

              const baseAngle =
                cluster.angle +
                (i / Math.max(1, cluster.count)) * Math.PI * 2 +
                (pseudoRandom(seed + 8.7) - 0.5) * 0.9;
              const radius = Math.sqrt(pseudoRandom(seed + 11.2)) * cluster.spread;
              const heightJitter = pseudoRandom(seed + 13.8) * 0.08;
              mesh.position.set(
                clusterCenterX + Math.cos(baseAngle) * radius,
                world.groundY + cluster.yLift + heightJitter,
                clusterCenterZ + Math.sin(baseAngle) * radius
              );
              mesh.rotation.set(
                (pseudoRandom(seed + 17.3) - 0.5) * 0.5,
                baseAngle + (pseudoRandom(seed + 19.4) - 0.5) * 0.6,
                (pseudoRandom(seed + 23.1) - 0.5) * 0.4
              );

              let scale =
                (0.58 + pseudoRandom(seed + 29.6) * 1.28) *
                archetype.scaleMultiplier;
              if (pseudoRandom(seed + 32.9) > 0.84) {
                scale *= 1.42;
              } else if (pseudoRandom(seed + 34.2) < 0.2) {
                scale *= 0.68;
              }
              if (archetype.kind === "fruit" && pseudoRandom(seed + 36.8) > 0.9) {
                scale *= 1.25;
              }
              mesh.scale.setScalar(scale);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              foodRoot.add(mesh);
              trackMesh(mesh);
              globalFoodIndex += 1;
            }
          }
          return foodRoot;
        };

        const festivalFoodRoot = spawnFestivalFoodProps();

        const npcLoader = new GLTFLoader();
        const npcAnchorWorldPosition = new THREE.Vector3();
        const createNpcFallback = (color: number) => {
          const fallback = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.34, 1.04, 6, 12),
            new THREE.MeshStandardMaterial({
              color,
              roughness: 0.68,
              metalness: 0.1,
            })
          );
          fallback.position.y = 0.92;
          fallback.castShadow = true;
          fallback.receiveShadow = true;
          trackMesh(fallback);
          return fallback;
        };

        for (let i = 0; i < CHAPTER2_FESTIVAL_NPC_PATHS.length; i += 1) {
          const anchor = new THREE.Group();
          anchor.name = `chapter2FestivalNpcAnchor${i}`;
          if (i === 0) {
            anchor.position.set(0, world.groundY, CHAPTER2_ADAM_EDGE_Z);
            const yaw = Math.atan2(
              woodPileCenter.x - anchor.position.x,
              woodPileCenter.z - anchor.position.z
            );
            anchor.rotation.set(0, yaw, 0);
          } else {
            setAnchorOnFestivalRing(
              anchor,
              i,
              CHAPTER2_FESTIVAL_NPC_PATHS.length,
              festivalCrowdRingRadius
            );
          }
          anchor.visible = i === 0;
          setPieceRoot.add(anchor);
          festivalNpcAnchors.push(anchor);

          const fallback = createNpcFallback(0x4b5563 + i * 0x090909);
          anchor.add(fallback);
          festivalNpcFallbacks.push(fallback);

          const npcPath = CHAPTER2_FESTIVAL_NPC_PATHS[i];
          const isHarperNpc = /\/harper\//i.test(npcPath);
          npcLoader.load(
            npcPath,
            (gltf) => {
              if (!gltf?.scene) return;
              if (isDisposed) {
                disposeObjectResources(gltf.scene);
                return;
              }
              const npcModel = gltf.scene;
              anchor.add(npcModel);
              if (i === 0) {
                npcModel.scale.setScalar(CHAPTER2_ADAM_NPC_SCALE);
              }
              const modelBaseQuaternion = npcModel.quaternion.clone();
              if (isHarperNpc) {
                const harperWeaponNodes: THREE.Object3D[] = [];
                npcModel.traverse((child) => {
                  if (/(sword|weapon|wep)/i.test(child.name)) {
                    harperWeaponNodes.push(child);
                  }
                });
                for (let nodeIndex = 0; nodeIndex < harperWeaponNodes.length; nodeIndex += 1) {
                  const node = harperWeaponNodes[nodeIndex];
                  node.removeFromParent();
                  disposeObjectResources(node);
                }
              }
              trackObject(npcModel, {
                castShadow: true,
                receiveShadow: true,
              });
              const shouldAnchorVisible = i === 0 || festivalCrowdPrepared;
              npcModel.updateMatrixWorld(true);
              groundModelOnAnchor(npcModel, anchor);
              anchor.visible = shouldAnchorVisible;
              fallback.visible = false;
              festivalNpcModels.push({
                anchor,
                model: npcModel,
                modelBaseQuaternion,
              });
            },
            undefined,
            () => {}
          );
        }

        const baseIsBlocked =
          typeof world.isBlocked === "function" ? world.isBlocked.bind(world) : null;
        const extraColliders = [
          {
            x: woodPileCenter.x,
            z: woodPileCenter.z,
            radius: CHAPTER2_WOODPILE_COLLIDER_RADIUS,
            active: true,
          },
          {
            x: festivalNpcAnchors[0]?.position.x ?? 0,
            z: festivalNpcAnchors[0]?.position.z ?? CHAPTER2_ADAM_EDGE_Z,
            radius: CHAPTER2_ADAM_COLLIDER_RADIUS,
            active: true,
          },
        ];
        world.isBlocked = (x: number, z: number) => {
          if (baseIsBlocked?.(x, z)) return true;
          if (!baseIsBlocked && world.bounds) {
            if (
              x < world.bounds.minX ||
              x > world.bounds.maxX ||
              z < world.bounds.minZ ||
              z > world.bounds.maxZ
            ) {
              return true;
            }
          }
          for (let i = 0; i < extraColliders.length; i += 1) {
            const collider = extraColliders[i];
            if (!collider.active) continue;
            const dx = x - collider.x;
            const dz = z - collider.z;
            const minDistance =
              collider.radius + CHAPTER2_COLLIDER_PLAYER_RADIUS;
            if (dx * dx + dz * dz < minDistance * minDistance) {
              return true;
            }
          }
          return false;
        };

        const desiredSpawn = new THREE.Vector3(
          woodPileCenter.x,
          world.groundY,
          woodPileCenter.z - CHAPTER2_FLARE_FORWARD_DISTANCE
        );

        const resolveWalkableSpawn = () => {
          const isWalkable = (x: number, z: number) =>
            typeof world.isBlocked !== "function" || !world.isBlocked(x, z);

          if (isWalkable(desiredSpawn.x, desiredSpawn.z)) {
            return desiredSpawn;
          }

          const sampleAnglesDeg = [0, 18, -18, 36, -36, 54, -54, 72, -72, 96, -96];
          for (let radius = 1; radius <= 8; radius += 1) {
            for (let i = 0; i < sampleAnglesDeg.length; i += 1) {
              const angle = (sampleAnglesDeg[i] * Math.PI) / 180;
              const sampleX = desiredSpawn.x + Math.cos(angle) * radius;
              const sampleZ = desiredSpawn.z + Math.sin(angle) * radius;
              if (isWalkable(sampleX, sampleZ)) {
                return new THREE.Vector3(sampleX, world.groundY, sampleZ);
              }
            }
          }
          return new THREE.Vector3(woodPileCenter.x, world.groundY, woodPileCenter.z - 12);
        };

        world.playerSpawn = resolveWalkableSpawn();

        const baseWorldTick = world.onTick;
        const baseIsInputLocked =
          typeof world.isInputLocked === "function"
            ? world.isInputLocked.bind(world)
            : null;
        const baseIsMiniMapVisible =
          typeof world.isMiniMapVisible === "function"
            ? world.isMiniMapVisible.bind(world)
            : null;
        world.isInputLocked = () =>
          Boolean(baseIsInputLocked?.()) || festivalInputLockedRef.current;
        world.isMiniMapVisible = () => {
          const baseVisible = baseIsMiniMapVisible?.() ?? true;
          return baseVisible && miniMapVisibleRef.current;
        };
        const taskRadiusSq = CHAPTER2_WOODPILE_TASK_RADIUS ** 2;
        let taskCompletedLocked = false;
        const prepareFestivalCrowd = (player: THREE.Object3D) => {
          if (festivalCrowdPrepared) return;
          festivalCrowdPrepared = true;
          festivalFoodRoot.visible = true;
          player.visible = false;
          player.position.set(9999, -9999, 9999);
          for (let i = 0; i < festivalNpcAnchors.length; i += 1) {
            const anchor = festivalNpcAnchors[i];
            setAnchorOnFestivalRing(
              anchor,
              i,
              CHAPTER2_FESTIVAL_NPC_PATHS.length,
              festivalCrowdRingRadius
            );
            anchor.visible = true;
          }
          for (let i = 0; i < festivalNpcModels.length; i += 1) {
            const npc = festivalNpcModels[i];
            npc.model.quaternion.copy(npc.modelBaseQuaternion);
            groundModelOnAnchor(npc.model, npc.anchor);
          }
          if (extraColliders[1]) {
            extraColliders[1].x = festivalNpcAnchors[0]?.position.x ?? extraColliders[1].x;
            extraColliders[1].z = festivalNpcAnchors[0]?.position.z ?? extraColliders[1].z;
          }
        };
        const woodPileAttackTarget: PlayerAttackTarget = {
          id: "chapter2_wood_pile",
          object: woodPileHitCollider,
          label: "chapter2WoodPile",
          onHit: (hit) => {
            const now = hit?.now ?? performance.now();
            const isDirectPrimaryOrSkillRHit = (() => {
              if (!hit) return false;
              const typedHit = hit as PlayerAttackHit;
              if (typedHit.source === "projectile") {
                return true;
              }
              if (typedHit.source !== "slash") {
                return false;
              }
              const roundedDamage = Math.round(Number(typedHit.damage) || 0);
              return CHAPTER2_DIRECT_PRIMARY_OR_R_HIT_DAMAGE.has(roundedDamage);
            })();
            if (!woodPileIgnited) {
              if (!weaponIgnitedRef.current || !isDirectPrimaryOrSkillRHit) return;
              woodPileIgnited = true;
              woodIgnitedRef.current = true;
              woodPileBurnLevel = 1;
              woodBurnLevelRef.current = woodPileBurnLevel;
              setFreeResourceZoneEnabled(true);
              context?.onStateChange?.({
                chapter2WoodIgnited: true,
                chapter2WoodBurnLevel: woodPileBurnLevel,
              });
              return;
            }
            if (!isDirectPrimaryOrSkillRHit) return;
            if (!superBurnActiveRef.current) return;
            if (now - lastBurnGainAt < CHAPTER2_WOOD_BURN_GAIN_COOLDOWN_MS) return;
            lastBurnGainAt = now;
            const nextBurnLevel = Math.min(
              CHAPTER2_WOOD_BURN_TARGET,
              woodPileBurnLevel + 1
            );
            if (nextBurnLevel === woodPileBurnLevel) return;
            woodPileBurnLevel = nextBurnLevel;
            woodBurnLevelRef.current = nextBurnLevel;
            context?.onStateChange?.({
              chapter2WoodBurnLevel: nextBurnLevel,
            });
          },
        };
        attackTargets.push(woodPileAttackTarget);

        context?.onStateChange?.({
          chapter2WoodApproachCompleted: false,
          chapter2WoodIgnited: false,
          chapter2WoodBurnLevel: 0,
          chapter2PostFestivalMode: false,
          chapter2PostFestivalTalkStep: 0,
          chapter2PostFestivalLastDialogueIndex: undefined,
          chapter2PostFestivalTalkTargetNearby: false,
        });

        world.onTick = (args: PlayerWorldTickArgs) => {
          baseWorldTick?.(args);
          updateWoodPileFlameFx(args.now);
          const desiredPlayerScale = postFestivalModeRef.current
            ? CHAPTER2_ADAM_PLAYER_SCALE
            : 1;
          if (
            Math.abs(args.player.scale.x - desiredPlayerScale) > 0.0001 ||
            Math.abs(args.player.scale.y - desiredPlayerScale) > 0.0001 ||
            Math.abs(args.player.scale.z - desiredPlayerScale) > 0.0001
          ) {
            args.player.scale.setScalar(desiredPlayerScale);
          }
          postFestivalCurrentPlayerRef.current = args.player;
          if (!taskCompletedLocked) {
            const dx = args.player.position.x - woodPileCenter.x;
            const dz = args.player.position.z - woodPileCenter.z;
            const taskCompleted = dx * dx + dz * dz <= taskRadiusSq;
            if (taskCompleted) {
              taskCompletedLocked = true;
              context?.onStateChange?.({
                chapter2WoodApproachCompleted: true,
              });
            }
          }

          if (festivalCinematicActiveRef.current) {
            prepareFestivalCrowd(args.player);
            args.player.visible = false;
            for (let i = 0; i < festivalNpcAnchors.length; i += 1) {
              setAnchorOnFestivalRing(
                festivalNpcAnchors[i],
                i,
                CHAPTER2_FESTIVAL_NPC_PATHS.length,
                festivalCrowdRingRadius
              );
            }
            for (let i = 0; i < festivalNpcModels.length; i += 1) {
              const npc = festivalNpcModels[i];
              npc.model.quaternion.copy(npc.modelBaseQuaternion);
              groundModelOnAnchor(npc.model, npc.anchor);
            }
            const elapsed = Math.max(
              0,
              args.now - festivalCinematicStartedAtRef.current
            );
            const orbitAngle = elapsed * 0.00034 + Math.PI * 0.16;
            const orbitRadius = 11.8 + Math.sin(elapsed * 0.00027) * 0.85;
            const orbitHeight = 7.6 + Math.cos(elapsed * 0.00023) * 0.62;
            args.camera.position.set(
              woodPileCenter.x + Math.cos(orbitAngle) * orbitRadius,
              world.groundY + orbitHeight,
              woodPileCenter.z + Math.sin(orbitAngle) * orbitRadius
            );
            args.camera.lookAt(festivalLookTarget);
            if (
              !adamControlTakeoverTriggeredRef.current &&
              elapsed >= CHAPTER2_FESTIVAL_CINEMATIC_DURATION_MS
            ) {
              adamControlTakeoverTriggeredRef.current = true;
              festivalInputLockedRef.current = true;
              const playerObject = args.player;
              setShowAdamTakeoverCurtain(true);
              setAdamTakeoverCurtainOpaque(false);
              adamTakeoverFadeToBlackTimerRef.current = window.setTimeout(() => {
                adamTakeoverFadeToBlackTimerRef.current = null;
                if (isDisposed) return;
                setAdamTakeoverCurtainOpaque(true);
              }, 16);
              adamTakeoverSwitchTimerRef.current = window.setTimeout(() => {
                adamTakeoverSwitchTimerRef.current = null;
                if (isDisposed) return;
                festivalCinematicActiveRef.current = false;
                festivalInputLockedRef.current = false;
                setFestivalPhase("inactive");
                setPlayerControlMode("adamWalkSprint");
                playerControllerRef.current?.setCharacterPath(CHAPTER2_ADAM_PATH);
                const adamAnchor = festivalNpcAnchors[0];
                if (adamAnchor) {
                  adamAnchor.visible = false;
                  playerObject.position.copy(adamAnchor.position);
                  playerObject.position.y = world.groundY;
                  playerObject.scale.setScalar(CHAPTER2_ADAM_PLAYER_SCALE);
                  const yaw = Math.atan2(
                    woodPileCenter.x - playerObject.position.x,
                    woodPileCenter.z - playerObject.position.z
                  );
                  playerObject.rotation.set(0, yaw, 0);
                } else {
                  playerObject.position.set(0, world.groundY, CHAPTER2_ADAM_EDGE_Z);
                }
                playerObject.visible = true;
                if (extraColliders[1]) {
                  extraColliders[1].active = false;
                }
                postFestivalModeRef.current = true;
                postFestivalTalkStepRef.current = 0;
                postFestivalTalkTargetNearbyRef.current = false;
                postFestivalCurrentTargetAnchorRef.current =
                  festivalNpcAnchors[
                    CHAPTER2_POST_FESTIVAL_DIALOGUE_SEQUENCE[0]?.anchorIndex ?? 1
                  ] ?? null;
                context?.onStateChange?.({
                  chapter2PostFestivalMode: true,
                  chapter2PostFestivalTalkStep: 0,
                  chapter2PostFestivalLastDialogueIndex: undefined,
                  chapter2PostFestivalTalkTargetNearby: false,
                });
                setAdamTakeoverCurtainOpaque(false);
                adamTakeoverHideCurtainTimerRef.current = window.setTimeout(() => {
                  adamTakeoverHideCurtainTimerRef.current = null;
                  if (isDisposed) return;
                  setShowAdamTakeoverCurtain(false);
                }, CHAPTER2_ADAM_TAKEOVER_FADE_IN_MS + 40);
              }, CHAPTER2_ADAM_TAKEOVER_FADE_OUT_MS);
            }
          }

          if (postFestivalModeRef.current && !festivalCinematicActiveRef.current) {
            const talkStep = Math.max(
              0,
              Math.min(
                CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT,
                Math.floor(postFestivalTalkStepRef.current)
              )
            );
            if (talkStep >= CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT) {
              postFestivalCurrentTargetAnchorRef.current = null;
              if (postFestivalTalkTargetNearbyRef.current) {
                postFestivalTalkTargetNearbyRef.current = false;
                context?.onStateChange?.({
                  chapter2PostFestivalTalkTargetNearby: false,
                });
              }
            } else {
              const nextTarget =
                CHAPTER2_POST_FESTIVAL_DIALOGUE_SEQUENCE[talkStep];
              const targetAnchor = festivalNpcAnchors[nextTarget.anchorIndex] ?? null;
              postFestivalCurrentTargetAnchorRef.current = targetAnchor;
              if (!targetAnchor) {
                if (postFestivalTalkTargetNearbyRef.current) {
                  postFestivalTalkTargetNearbyRef.current = false;
                  context?.onStateChange?.({
                    chapter2PostFestivalTalkTargetNearby: false,
                  });
                }
              } else {
                const dx = args.player.position.x - targetAnchor.position.x;
                const dz = args.player.position.z - targetAnchor.position.z;
                const isTargetNearby =
                  dx * dx + dz * dz <= CHAPTER2_POST_FESTIVAL_TALK_RANGE ** 2;
                if (isTargetNearby !== postFestivalTalkTargetNearbyRef.current) {
                  postFestivalTalkTargetNearbyRef.current = isTargetNearby;
                  context?.onStateChange?.({
                    chapter2PostFestivalTalkTargetNearby: isTargetNearby,
                  });
                }
              }
            }
          }
        };

        const dispose = () => {
          isDisposed = true;
          postFestivalModeRef.current = false;
          postFestivalTalkStepRef.current = 0;
          postFestivalTalkTargetNearbyRef.current = false;
          postFestivalCurrentTargetAnchorRef.current = null;
          postFestivalCurrentPlayerRef.current = null;
          setFreeResourceZoneEnabled(false);
          const attackTargetIndex = attackTargets.indexOf(woodPileAttackTarget);
          if (attackTargetIndex >= 0) {
            attackTargets.splice(attackTargetIndex, 1);
          }
          scene.remove(setPieceRoot);
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
    setSceneReady((current) => (current ? current : true));
  }, []);

  const handleSceneStateChange = useCallback(
    (nextState: SceneUiState) => {
      const typedState = nextState as Chapter2SceneUiState;
      const hasWoodApproach = Object.prototype.hasOwnProperty.call(
        typedState,
        "chapter2WoodApproachCompleted"
      );
      const hasWoodIgnited = Object.prototype.hasOwnProperty.call(
        typedState,
        "chapter2WoodIgnited"
      );
      const hasWoodBurnLevel = Object.prototype.hasOwnProperty.call(
        typedState,
        "chapter2WoodBurnLevel"
      );
      const hasPostFestivalMode = Object.prototype.hasOwnProperty.call(
        typedState,
        "chapter2PostFestivalMode"
      );
      const hasPostFestivalTalkStep = Object.prototype.hasOwnProperty.call(
        typedState,
        "chapter2PostFestivalTalkStep"
      );
      const hasPostFestivalLastDialogueIndex = Object.prototype.hasOwnProperty.call(
        typedState,
        "chapter2PostFestivalLastDialogueIndex"
      );
      const hasPostFestivalTalkTargetNearby = Object.prototype.hasOwnProperty.call(
        typedState,
        "chapter2PostFestivalTalkTargetNearby"
      );
      if (
        !hasWoodApproach &&
        !hasWoodIgnited &&
        !hasWoodBurnLevel &&
        !hasPostFestivalMode &&
        !hasPostFestivalTalkStep &&
        !hasPostFestivalLastDialogueIndex &&
        !hasPostFestivalTalkTargetNearby
      ) {
        return;
      }
      const nextCompleted = hasWoodApproach
        ? Boolean(typedState.chapter2WoodApproachCompleted)
        : null;
      const nextWoodIgnited = hasWoodIgnited
        ? Boolean(typedState.chapter2WoodIgnited)
        : null;
      const nextWoodBurnLevel = hasWoodBurnLevel
        ? Math.max(0, Math.floor(Number(typedState.chapter2WoodBurnLevel) || 0))
        : null;
      const nextPostFestivalMode = hasPostFestivalMode
        ? Boolean(typedState.chapter2PostFestivalMode)
        : null;
      const nextPostFestivalTalkStep = hasPostFestivalTalkStep
        ? Math.max(
            0,
            Math.min(
              CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT,
              Math.floor(Number(typedState.chapter2PostFestivalTalkStep) || 0)
            )
          )
        : null;
      const nextPostFestivalLastDialogueIndex = hasPostFestivalLastDialogueIndex
        ? Number.isFinite(typedState.chapter2PostFestivalLastDialogueIndex)
          ? Math.max(
              -1,
              Math.min(
                CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT - 1,
                Math.floor(Number(typedState.chapter2PostFestivalLastDialogueIndex))
              )
            )
          : undefined
        : null;
      const nextPostFestivalTalkTargetNearby = hasPostFestivalTalkTargetNearby
        ? Boolean(typedState.chapter2PostFestivalTalkTargetNearby)
        : null;
      setChapterUiState((previous) => {
        if (
          (nextCompleted === null ||
            Boolean(previous.chapter2WoodApproachCompleted) === nextCompleted) &&
          (nextWoodIgnited === null ||
            Boolean(previous.chapter2WoodIgnited) === nextWoodIgnited) &&
          (nextWoodBurnLevel === null ||
            (previous.chapter2WoodBurnLevel ?? 0) === nextWoodBurnLevel) &&
          (nextPostFestivalMode === null ||
            Boolean(previous.chapter2PostFestivalMode) === nextPostFestivalMode) &&
          (nextPostFestivalTalkStep === null ||
            (previous.chapter2PostFestivalTalkStep ?? 0) ===
              nextPostFestivalTalkStep) &&
          (nextPostFestivalLastDialogueIndex === null ||
            (previous.chapter2PostFestivalLastDialogueIndex ?? undefined) ===
              nextPostFestivalLastDialogueIndex) &&
          (nextPostFestivalTalkTargetNearby === null ||
            Boolean(previous.chapter2PostFestivalTalkTargetNearby) ===
              nextPostFestivalTalkTargetNearby)
        ) {
          return previous;
        }
        return {
          ...previous,
          chapter2WoodApproachCompleted:
            nextCompleted === null
              ? previous.chapter2WoodApproachCompleted
              : nextCompleted,
          chapter2WoodIgnited:
            nextWoodIgnited === null
              ? previous.chapter2WoodIgnited
              : nextWoodIgnited,
          chapter2WoodBurnLevel:
            nextWoodBurnLevel === null
              ? previous.chapter2WoodBurnLevel
              : nextWoodBurnLevel,
          chapter2PostFestivalMode:
            nextPostFestivalMode === null
              ? previous.chapter2PostFestivalMode
              : nextPostFestivalMode,
          chapter2PostFestivalTalkStep:
            nextPostFestivalTalkStep === null
              ? previous.chapter2PostFestivalTalkStep
              : nextPostFestivalTalkStep,
          chapter2PostFestivalLastDialogueIndex:
            nextPostFestivalLastDialogueIndex === null
              ? previous.chapter2PostFestivalLastDialogueIndex
              : nextPostFestivalLastDialogueIndex,
          chapter2PostFestivalTalkTargetNearby:
            nextPostFestivalTalkTargetNearby === null
              ? previous.chapter2PostFestivalTalkTargetNearby
              : nextPostFestivalTalkTargetNearby,
        };
      });
    },
    [setChapterUiState]
  );

  useEffect(() => {
    if (phase !== "scene") return;

    const handleIgniteProgress = (event: KeyboardEvent) => {
      if (playerControlMode === "adamWalkSprint") return;
      if (festivalInputLockedRef.current) return;
      if (event.defaultPrevented) return;
      if (event.code !== "KeyE") return;
      if (!chapterUiState.chapter2WoodApproachCompleted) return;
      setChapterUiState((previous) => {
        if (previous.chapter2WeaponIgnited) return previous;
        return {
          ...previous,
          chapter2WeaponIgnited: true,
          chapter2WoodIgnited: false,
          chapter2WoodBurnLevel: 0,
        };
      });
    };

    const handleQPermissionAndTracking = (event: KeyboardEvent) => {
      if (playerControlMode === "adamWalkSprint") return;
      if (festivalInputLockedRef.current) return;
      if (event.code !== "KeyQ") return;
      if (!chapterUiState.chapter2WoodIgnited) {
        superBurnActiveRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
      if (event.repeat) return;
      superBurnActiveRef.current = !superBurnActiveRef.current;
    };

    window.addEventListener("keydown", handleQPermissionAndTracking, true);
    window.addEventListener("keydown", handleIgniteProgress);
    return () => {
      window.removeEventListener("keydown", handleQPermissionAndTracking, true);
      window.removeEventListener("keydown", handleIgniteProgress);
    };
  }, [
    chapterUiState.chapter2WoodIgnited,
    chapterUiState.chapter2WoodApproachCompleted,
    phase,
    playerControlMode,
    setChapterUiState,
  ]);

  useEffect(() => {
    if (phase !== "scene" || playerControlMode !== "adamWalkSprint") return;
    const handleAdamInput = (event: KeyboardEvent) => {
      if (event.code !== "KeyF" && event.code !== "Space") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.code !== "KeyF" || event.repeat) return;
      if (!postFestivalModeRef.current) return;
      const talkStep = Math.max(
        0,
        Math.min(
          CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT,
          Math.floor(postFestivalTalkStepRef.current)
        )
      );
      if (talkStep >= CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT) return;
      if (!postFestivalTalkTargetNearbyRef.current) return;

      const targetAnchor = postFestivalCurrentTargetAnchorRef.current;
      const playerObject = postFestivalCurrentPlayerRef.current;
      if (!targetAnchor || !playerObject) return;
      const lookDx = playerObject.position.x - targetAnchor.position.x;
      const lookDz = playerObject.position.z - targetAnchor.position.z;
      if (lookDx * lookDx + lookDz * lookDz > 0.0001) {
        targetAnchor.rotation.set(0, Math.atan2(lookDx, lookDz), 0);
      }

      const nextTalkStep = talkStep + 1;
      postFestivalTalkStepRef.current = nextTalkStep;
      postFestivalTalkTargetNearbyRef.current = false;
      setChapterUiState((previous) => ({
        ...previous,
        chapter2PostFestivalMode: true,
        chapter2PostFestivalTalkStep: nextTalkStep,
        chapter2PostFestivalLastDialogueIndex: talkStep,
        chapter2PostFestivalTalkTargetNearby: false,
      }));
    };
    window.addEventListener("keydown", handleAdamInput, true);
    return () => {
      window.removeEventListener("keydown", handleAdamInput, true);
    };
  }, [phase, playerControlMode, setChapterUiState]);

  useEffect(() => {
    if (phase !== "scene" || !sceneReady) return;
    if (!chapterUiState.chapter2PostFestivalMode) return;
    const talkStep = Math.max(
      0,
      Math.min(
        CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT,
        Math.floor(chapterUiState.chapter2PostFestivalTalkStep ?? 0)
      )
    );
    if (talkStep < CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT) return;
    if (postFestivalEndingTriggeredRef.current) return;
    postFestivalEndingTriggeredRef.current = true;

    postFestivalEndingDelayTimerRef.current = window.setTimeout(() => {
      postFestivalEndingDelayTimerRef.current = null;
      festivalInputLockedRef.current = true;
      setShowPostFestivalEndingOverlay(true);
      setPostFestivalEndingOpaque(false);
      setPostFestivalEndingTextVisible(true);
      setChapterUiState((previous) => ({
        ...previous,
        hideRightPanel: true,
        chapter2PostFestivalTalkTargetNearby: false,
      }));
      postFestivalEndingFadeTimerRef.current = window.setTimeout(() => {
        postFestivalEndingFadeTimerRef.current = null;
        setPostFestivalEndingOpaque(true);
      }, 24);
      postFestivalEndingCompleteTimerRef.current = window.setTimeout(() => {
        postFestivalEndingCompleteTimerRef.current = null;
        setPhase("complete");
        setChapterUiState((previous) => ({
          ...previous,
          hideRightPanel: true,
        }));
      }, CHAPTER2_POST_FESTIVAL_END_FADE_MS + CHAPTER2_POST_FESTIVAL_END_HOLD_MS);
    }, CHAPTER2_POST_FESTIVAL_END_DELAY_MS);

    return () => {
      if (postFestivalEndingDelayTimerRef.current !== null) {
        window.clearTimeout(postFestivalEndingDelayTimerRef.current);
        postFestivalEndingDelayTimerRef.current = null;
      }
      if (postFestivalEndingFadeTimerRef.current !== null) {
        window.clearTimeout(postFestivalEndingFadeTimerRef.current);
        postFestivalEndingFadeTimerRef.current = null;
      }
      if (postFestivalEndingCompleteTimerRef.current !== null) {
        window.clearTimeout(postFestivalEndingCompleteTimerRef.current);
        postFestivalEndingCompleteTimerRef.current = null;
      }
      postFestivalEndingTriggeredRef.current = false;
    };
  }, [
    chapterUiState.chapter2PostFestivalMode,
    chapterUiState.chapter2PostFestivalTalkStep,
    phase,
    sceneReady,
    setChapterUiState,
  ]);

  useEffect(() => {
    if (!chapterUiState.chapter2WoodIgnited) {
      superBurnActiveRef.current = false;
    }
  }, [chapterUiState.chapter2WoodIgnited]);

  useEffect(() => {
    if (phase !== "scene") return;
    const woodBurnLevel = Math.max(
      0,
      Math.floor(chapterUiState.chapter2WoodBurnLevel ?? 0)
    );
    if (woodBurnLevel < CHAPTER2_WOOD_BURN_TARGET) return;
    if (festivalTriggeredRef.current) return;
    festivalTriggeredRef.current = true;
    festivalInputLockedRef.current = false;
    festivalCinematicActiveRef.current = false;
    festivalCinematicStartedAtRef.current = 0;
    setFestivalPromptOpaque(false);
    setFestivalPhase("pending");
    setChapterUiState((previous) => ({
      ...previous,
      chapter2FestivalPending: true,
    }));
    festivalPromptDelayTimerRef.current = window.setTimeout(() => {
      festivalPromptDelayTimerRef.current = null;
      setFestivalPhase("prompt");
      setChapterUiState((previous) => ({
        ...previous,
        chapter2FestivalPending: false,
      }));
      festivalPromptFadeInTimerRef.current = window.setTimeout(() => {
        festivalPromptFadeInTimerRef.current = null;
        setFestivalPromptOpaque(true);
        // Only unlock pointer (show cursor) after black prompt is actually shown.
        festivalInputLockedRef.current = true;
      }, 30);
    }, CHAPTER2_FESTIVAL_TRIGGER_DELAY_MS);
  }, [chapterUiState.chapter2WoodBurnLevel, phase, setChapterUiState]);

  const startFestivalReveal = useCallback(() => {
    if (festivalPhase !== "prompt") return;
    setFestivalPromptOpaque(false);
    if (festivalRevealTimerRef.current !== null) {
      window.clearTimeout(festivalRevealTimerRef.current);
      festivalRevealTimerRef.current = null;
    }
    const now = performance.now();
    festivalCinematicStartedAtRef.current = now;
    festivalCinematicActiveRef.current = true;
    festivalInputLockedRef.current = true;
    setFestivalPhase("reveal");

    festivalRevealTimerRef.current = window.setTimeout(() => {
      festivalRevealTimerRef.current = null;
      setFestivalPhase("cinematic");
    }, CHAPTER2_FESTIVAL_REVEAL_FADE_MS);
  }, [festivalPhase]);

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
    }, CHAPTER2_SCENE_CURTAIN_FADE_MS + 120);

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
    if (phase !== "scene") return;
    const scenePhaseRoot = scenePhaseRootRef.current;
    if (!scenePhaseRoot) return;
    const sceneHost = scenePhaseRoot.querySelector<HTMLElement>(
      '[aria-label="Interactive 3D scene"]'
    );
    if (!sceneHost) return;

    const shouldHideCoreHud =
      showPostFestivalEndingOverlay ||
      festivalPhase === "prompt" ||
      festivalPhase === "reveal" ||
      festivalPhase === "cinematic";
    const hudPanels = Array.from(sceneHost.children).filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.style.position !== "absolute") return false;
      if (node.style.zIndex !== "6") return false;
      return node.style.left.length > 0 || node.style.right.length > 0;
    }) as HTMLElement[];

    for (let i = 0; i < hudPanels.length; i += 1) {
      const panel = hudPanels[i];
      if (shouldHideCoreHud) {
        if (panel.dataset.chapter2PrevDisplay === undefined) {
          panel.dataset.chapter2PrevDisplay = panel.style.display || "";
        }
        panel.style.display = "none";
      } else if (panel.dataset.chapter2PrevDisplay !== undefined) {
        panel.style.display = panel.dataset.chapter2PrevDisplay;
        delete panel.dataset.chapter2PrevDisplay;
      }
    }

    return () => {
      for (let i = 0; i < hudPanels.length; i += 1) {
        const panel = hudPanels[i];
        if (panel.dataset.chapter2PrevDisplay !== undefined) {
          panel.style.display = panel.dataset.chapter2PrevDisplay;
          delete panel.dataset.chapter2PrevDisplay;
        }
      }
    };
  }, [festivalPhase, phase, showPostFestivalEndingOverlay]);

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
      {phase === "idle" ? (
        <div
          className={originStyles.chapter2IntroBackdropAnimated}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid rgba(249, 115, 22, 0.34)",
            background:
              "radial-gradient(circle at 50% 44%, rgba(194, 65, 12, 0.22), transparent 58%), linear-gradient(180deg, rgba(16, 8, 4, 0.95), rgba(11, 6, 3, 0.98))",
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
              color: "rgba(253, 186, 116, 0.95)",
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
              color: "rgba(255, 237, 213, 0.98)",
            }}
          >
            chapter2
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.94rem",
              letterSpacing: "0.03em",
              color: "rgba(254, 215, 170, 0.94)",
            }}
          >
            Click Start to play the opening narrative.
          </p>
          <button
            type="button"
            onClick={startChapter}
            style={{
              border: "1px solid rgba(249, 115, 22, 0.56)",
              borderRadius: "12px",
              background:
                "linear-gradient(180deg, rgba(194, 65, 12, 0.52), rgba(124, 45, 18, 0.8))",
              color: "rgba(255, 247, 237, 0.96)",
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
      ) : phase === "intro" ? (
        <button
          type="button"
          onClick={advanceIntro}
          className={originStyles.chapter2IntroBackdropAnimated}
          style={{
            margin: 0,
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid rgba(249, 115, 22, 0.34)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "32px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              opacity: introLineVisible ? 1 : 0,
              transition: `opacity ${CHAPTER2_INTRO_LINE_FADE_MS}ms ease`,
              color: "rgba(254, 242, 242, 0.96)",
            }}
          >
            <p
              style={{
                margin: 0,
                maxWidth: "760px",
                lineHeight: 1.72,
                fontSize: "clamp(1.2rem, 2.1vw, 1.95rem)",
                letterSpacing: "0.02em",
                textAlign: "center",
              }}
            >
              {CHAPTER2_INTRO_LINES[introIndex]}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(251, 191, 36, 0.92)",
                fontWeight: 700,
              }}
            >
              Click to continue
            </p>
          </div>
        </button>
      ) : phase === "transition" ? (
        <div
          className={originStyles.chapter2IntroBackdropAnimated}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid rgba(249, 115, 22, 0.32)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "14px",
            color: "rgba(255, 237, 213, 0.95)",
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
              color: "rgba(251, 191, 36, 0.95)",
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
            Moving into the forest clearing...
          </p>
        </div>
      ) : phase === "scene" ? (
        <div
          ref={scenePhaseRootRef}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid rgba(249, 115, 22, 0.26)",
            overflow: "hidden",
            position: "relative",
            background:
              "linear-gradient(180deg, rgba(14, 7, 4, 0.96), rgba(10, 5, 3, 0.98))",
          }}
        >
          <SceneLauncher
            sceneLoader={loadForestScene}
            gameMode="originChapter2"
            characterPath={CHAPTER2_FLARE_PATH}
            allowPrimaryAttack={() => playerControlMode !== "adamWalkSprint"}
            allowSkills={() =>
              playerControlMode !== "adamWalkSprint" &&
              Boolean(chapterUiState.chapter2WoodApproachCompleted)
            }
            allowJump={() => playerControlMode !== "adamWalkSprint"}
            showMiniMap
            onPlayerStateChange={handlePlayerStateChange}
            onSceneStateChange={handleSceneStateChange}
            onPlayerControllerReady={(controller) => {
              playerControllerRef.current = controller;
            }}
            maxPixelRatio={1.5}
            className="h-full w-full overflow-hidden rounded-[22px] border border-orange-300/20 bg-[#120905]"
          />

          {!sceneReady ? (
            <div
              className={originStyles.chapter2IntroBackdropAnimated}
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
                  color: "rgba(254, 215, 170, 0.96)",
                  fontWeight: 700,
                }}
              >
                Loading Forest...
              </p>
            </div>
          ) : null}

          {showSceneCurtain ? (
            <div
              className={originStyles.chapter2IntroBackdropAnimated}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                opacity: sceneCurtainTransparent ? 0 : 1,
                transition: `opacity ${CHAPTER2_SCENE_CURTAIN_FADE_MS}ms ease`,
              }}
            />
          ) : null}

          {showAdamTakeoverCurtain ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 38,
                pointerEvents: "none",
                background: "#000",
                opacity: adamTakeoverCurtainOpaque ? 1 : 0,
                transition: `opacity ${
                  adamTakeoverCurtainOpaque
                    ? CHAPTER2_ADAM_TAKEOVER_FADE_OUT_MS
                    : CHAPTER2_ADAM_TAKEOVER_FADE_IN_MS
                }ms ease`,
              }}
            />
          ) : null}

          {festivalPhase === "prompt" || festivalPhase === "reveal" ? (
            <button
              type="button"
              onClick={startFestivalReveal}
              disabled={festivalPhase !== "prompt"}
              style={{
                position: "absolute",
                inset: 0,
                border: "none",
                margin: 0,
                padding: "28px",
                background: "rgba(0, 0, 0, 0.98)",
                color: "rgba(255, 244, 229, 0.96)",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                cursor: festivalPhase === "prompt" ? "pointer" : "default",
                opacity:
                  festivalPhase === "prompt"
                    ? festivalPromptOpaque
                      ? 1
                      : 0
                    : 0,
                transition: `opacity ${CHAPTER2_FESTIVAL_REVEAL_FADE_MS}ms ease`,
                pointerEvents: festivalPhase === "prompt" ? "auto" : "none",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "14px",
                  maxWidth: "860px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "clamp(1.05rem, 1.8vw, 1.55rem)",
                    lineHeight: 1.7,
                    letterSpacing: "0.03em",
                    fontWeight: 700,
                  }}
                >
                  {CHAPTER2_FESTIVAL_PROMPT_TEXT}
                </p>
                {festivalPhase === "prompt" ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.16em",
                      color: "rgba(251, 191, 36, 0.92)",
                      fontWeight: 700,
                    }}
                  >
                    Click to continue
                  </p>
                ) : null}
              </div>
            </button>
          ) : null}

          {showPostFestivalEndingOverlay ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 45,
                pointerEvents: "none",
                background: "#000",
                opacity: postFestivalEndingOpaque ? 1 : 0,
                transition: `opacity ${CHAPTER2_POST_FESTIVAL_END_FADE_MS}ms ease`,
                display: "grid",
                placeItems: "center",
                padding: "28px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  maxWidth: "900px",
                  textAlign: "center",
                  fontSize: "clamp(1rem, 1.7vw, 1.45rem)",
                  lineHeight: 1.7,
                  letterSpacing: "0.025em",
                  color: "rgba(255, 244, 229, 0.96)",
                  fontWeight: 700,
                  opacity:
                    postFestivalEndingOpaque && postFestivalEndingTextVisible
                      ? 1
                      : 0,
                  transition: `opacity ${Math.round(
                    CHAPTER2_POST_FESTIVAL_END_FADE_MS * 0.72
                  )}ms ease`,
                }}
              >
                {CHAPTER2_POST_FESTIVAL_END_TEXT}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={originStyles.chapter2IntroBackdropAnimated}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid rgba(249, 115, 22, 0.34)",
            background:
              "radial-gradient(circle at 50% 44%, rgba(194, 65, 12, 0.24), transparent 58%), linear-gradient(180deg, rgba(16, 8, 4, 0.96), rgba(11, 6, 3, 0.99))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            color: "rgba(255, 237, 213, 0.94)",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.76rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(253, 186, 116, 0.9)",
              fontWeight: 700,
            }}
          >
            Chapter Complete
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(1.45rem, 2.5vw, 2.25rem)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(255, 247, 237, 0.98)",
            }}
          >
            Congratulations, you completed Chapter 2.
          </h2>
        </div>
      )}
    </div>
  );
}

function Chapter2RightPanel({ chapterUiState }: StoryChapterComponentProps) {
  if (chapterUiState.hideRightPanel) {
    return null;
  }

  const taskCompleted = Boolean(chapterUiState.chapter2WoodApproachCompleted);
  const igniteCompleted = Boolean(chapterUiState.chapter2WeaponIgnited);
  const woodIgnited = Boolean(chapterUiState.chapter2WoodIgnited);
  const festivalPending = Boolean(chapterUiState.chapter2FestivalPending);
  const postFestivalMode = Boolean(chapterUiState.chapter2PostFestivalMode);
  const postFestivalTalkStep = Math.max(
    0,
    Math.min(
      CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT,
      Math.floor(chapterUiState.chapter2PostFestivalTalkStep ?? 0)
    )
  );
  const postFestivalLastDialogueIndex = Number.isFinite(
    chapterUiState.chapter2PostFestivalLastDialogueIndex
  )
    ? Math.max(
        -1,
        Math.min(
          CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT - 1,
          Math.floor(Number(chapterUiState.chapter2PostFestivalLastDialogueIndex))
        )
      )
    : -1;
  const postFestivalTargetNearby = Boolean(
    chapterUiState.chapter2PostFestivalTalkTargetNearby
  );
  const woodBurnLevel = Math.max(
    0,
    Math.floor(chapterUiState.chapter2WoodBurnLevel ?? 0)
  );
  const woodBurnCompleted = woodBurnLevel >= CHAPTER2_WOOD_BURN_TARGET;
  const nextStage = postFestivalMode
    ? `postFestival-${Math.min(
        postFestivalTalkStep,
        CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT
      )}`
    : !taskCompleted
      ? "approach"
      : !igniteCompleted
        ? "igniteWeapon"
        : !woodIgnited
          ? "igniteWoodPile"
          : festivalPending
            ? "festivalPending"
            : woodBurnCompleted
              ? "bonfireDone"
              : "bonfireBoost";
  const [displayStage, setDisplayStage] = useState(nextStage);
  const [panelVisible, setPanelVisible] = useState(true);

  useEffect(() => {
    if (displayStage === nextStage) return;
    setPanelVisible(false);
    const timeoutId = window.setTimeout(() => {
      setDisplayStage(nextStage);
      setPanelVisible(true);
    }, 200);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [displayStage, nextStage]);

  const dialogueLines = postFestivalMode
    ? postFestivalLastDialogueIndex >= 0
      ? [
          CHAPTER2_POST_FESTIVAL_DIALOGUE_SEQUENCE[postFestivalLastDialogueIndex],
        ]
      : []
    : displayStage === "festivalPending"
      ? [CHAPTER2_DIALOGUE_ADAM_WOW]
      : displayStage === "bonfireBoost" || displayStage === "bonfireDone"
        ? CHAPTER2_DIALOGUE_BONFIRE
      : displayStage === "igniteWoodPile"
        ? [CHAPTER2_DIALOGUE_ADAM_HOT]
      : displayStage === "igniteWeapon"
        ? [CHAPTER2_DIALOGUE_IGNITE]
        : [CHAPTER2_DIALOGUE_APPROACH];
  const currentPostFestivalTarget =
    postFestivalTalkStep < CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT
      ? CHAPTER2_POST_FESTIVAL_DIALOGUE_SEQUENCE[postFestivalTalkStep]
      : null;
  const taskText =
    postFestivalMode
      ? postFestivalTalkStep >= CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT
        ? CHAPTER2_TASK_POST_FESTIVAL_DONE
        : `Talk to everyone in order (${postFestivalTalkStep}/${CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT}). Next: ${currentPostFestivalTarget?.targetLabel}${
            postFestivalTargetNearby ? " (Press F now)" : ""
          }`
      : displayStage === "festivalPending"
        ? CHAPTER2_TASK_FESTIVAL_PENDING
      : displayStage === "bonfireBoost"
        ? `${CHAPTER2_TASK_BONFIRE} (${Math.min(
            CHAPTER2_WOOD_BURN_TARGET,
            Math.max(0, woodBurnLevel)
          )}/${CHAPTER2_WOOD_BURN_TARGET})`
      : displayStage === "bonfireDone"
        ? CHAPTER2_TASK_BONFIRE_DONE
      : displayStage === "igniteWoodPile"
        ? CHAPTER2_TASK_IGNITE_WOOD
      : displayStage === "igniteWeapon"
        ? CHAPTER2_TASK_IGNITE
        : CHAPTER2_TASK_TEXT;
  const tutorialText =
    postFestivalMode
      ? CHAPTER2_TUTORIAL_POST_FESTIVAL
      : displayStage === "festivalPending"
        ? CHAPTER2_TUTORIAL_FESTIVAL_PENDING
      : displayStage === "bonfireBoost" || displayStage === "bonfireDone"
        ? CHAPTER2_TUTORIAL_SUPER_BURN
      : displayStage === "igniteWoodPile"
      ? CHAPTER2_TUTORIAL_BURN
      : displayStage === "igniteWeapon"
        ? CHAPTER2_TUTORIAL_IGNITE
        : "Reach the wood pile first.";
  const isTaskFinished = postFestivalMode
    ? postFestivalTalkStep >= CHAPTER2_POST_FESTIVAL_DIALOGUE_COUNT
    : displayStage === "bonfireDone";

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
          border: "1px solid rgba(251, 146, 60, 0.62)",
          background:
            "linear-gradient(180deg, rgba(30, 14, 7, 0.92), rgba(18, 9, 5, 0.97))",
          padding: "18px 16px",
          color: "rgba(255, 237, 213, 0.95)",
          boxShadow:
            "0 0 28px rgba(249, 115, 22, 0.25), inset 0 0 0 1px rgba(254, 215, 170, 0.14)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.88rem",
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            color: "rgba(253, 186, 116, 0.98)",
            fontWeight: 800,
          }}
        >
          Dialogue
        </p>
        <div
          style={{
            margin: "10px 0 0",
            opacity: panelVisible ? 1 : 0,
            transition: "opacity 200ms ease",
            display: "grid",
            gap: "8px",
          }}
        >
          {dialogueLines.map((line, index) => (
            <div
              key={`${line.speaker}-${index}`}
              style={{
                borderRadius: "10px",
                border: "1px solid rgba(251, 146, 60, 0.28)",
                background: "rgba(22, 10, 5, 0.52)",
                padding: "8px 10px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(253, 186, 116, 0.92)",
                  fontWeight: 800,
                }}
              >
                {line.speaker}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.9rem",
                  lineHeight: 1.55,
                  color: "rgba(255, 247, 237, 0.95)",
                }}
              >
                {line.text}
              </p>
            </div>
          ))}
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
            color: isTaskFinished
              ? "rgba(134, 239, 172, 0.98)"
              : "rgba(248, 250, 252, 0.94)",
            fontWeight: 700,
            opacity: panelVisible ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        >
          {taskText}
        </p>
      </div>

      <div
        style={{
          borderRadius: "16px",
          border: "1px solid rgba(56, 189, 248, 0.24)",
          background:
            "linear-gradient(180deg, rgba(5, 18, 32, 0.9), rgba(3, 12, 23, 0.96))",
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
            color: "rgba(125, 211, 252, 0.95)",
            fontWeight: 800,
          }}
        >
          Tutorial
        </p>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "0.84rem",
            color: "rgba(224, 242, 254, 0.96)",
            fontWeight: 700,
            lineHeight: 1.5,
            minHeight: "3.8em",
            opacity: panelVisible ? 1 : 0.8,
            transition: "opacity 200ms ease",
          }}
        >
          {tutorialText}
        </p>
      </div>
    </div>
  );
}

const chapter2: StoryChapterDefinition = {
  id: "chapter2",
  label: "chapter2",
  summary: "",
  rules: chapter2Rules,
  GameFrame: Chapter2GameFrame,
  RightPanel: Chapter2RightPanel,
  initialUiState: {
    hideRightPanel: true,
    chapter2WoodApproachCompleted: false,
    chapter2WeaponIgnited: false,
    chapter2WoodIgnited: false,
    chapter2WoodBurnLevel: 0,
    chapter2PostFestivalMode: false,
    chapter2PostFestivalTalkStep: 0,
    chapter2PostFestivalLastDialogueIndex: undefined,
    chapter2PostFestivalTalkTargetNearby: false,
  },
};

export default chapter2;
