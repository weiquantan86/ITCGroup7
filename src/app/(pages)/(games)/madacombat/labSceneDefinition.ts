import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../../../asset/entity/character/general/player";
import { createSceneResourceTracker } from "../../../asset/scenes/general/resourceTracker";
import type {
  SceneSetupContext,
  SceneSetupResult,
} from "../../../asset/scenes/general/sceneTypes";
import {
  MADA_LAB_STATE_KEY,
  MADA_TERMINAL_UNLOCK_EVENT,
  type MadaLabState,
} from "./labConfig";
import {
  createMadaPresentationController,
  resolveMadaPresentationState,
} from "../../../asset/entity/monster/mada/presentation";
import { createMadaAnimationController } from "../../../asset/entity/monster/mada/animation";

type BoxCollider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  enabled?: boolean;
};

type ActivationRemovableObstacle = {
  object: THREE.Object3D;
  collider?: BoxCollider;
};

const GROUND_Y = -1.4;
const MADA_GROUND_Y = GROUND_Y;
const MADA_GRAVITY = -28;
const MADA_MAX_FALL_SPEED = -48;
const ROOM_WIDTH = 92;
const ROOM_DEPTH = 70;
const ROOM_HEIGHT = 18;
const MADA_MAX_HEALTH = 2800;
const UI_EMIT_INTERVAL_MS = 140;
const BREACH_INTRO_SMOKE_DURATION_MS = 900;
const BREACH_LOOK_LEFT_DURATION_MS = 700;
const BREACH_LOOK_RIGHT_DURATION_MS = 950;
const BREACH_LOOK_RETURN_DURATION_MS = 700;
const BREACH_LOOK_AROUND_DURATION_MS =
  BREACH_LOOK_LEFT_DURATION_MS +
  BREACH_LOOK_RIGHT_DURATION_MS +
  BREACH_LOOK_RETURN_DURATION_MS;
const BREACH_BIG_SMOKE_EXPAND_DURATION_MS = 1100;
const BREACH_BIG_SMOKE_HOLD_DURATION_MS = 1100;
const BREACH_BIG_SMOKE_DISSIPATE_DURATION_MS = 1400;
const BREACH_BIG_SMOKE_DURATION_MS =
  BREACH_BIG_SMOKE_EXPAND_DURATION_MS +
  BREACH_BIG_SMOKE_HOLD_DURATION_MS +
  BREACH_BIG_SMOKE_DISSIPATE_DURATION_MS;
const BREACH_BIG_SMOKE_START_MS =
  BREACH_INTRO_SMOKE_DURATION_MS + BREACH_LOOK_AROUND_DURATION_MS;
const BREACH_BIG_SMOKE_RELEASE_MS =
  BREACH_BIG_SMOKE_START_MS + BREACH_BIG_SMOKE_DURATION_MS / 2;
const BREACH_BIG_SMOKE_END_MS =
  BREACH_BIG_SMOKE_START_MS + BREACH_BIG_SMOKE_DURATION_MS;
const MADA_RISE_DURATION_MS = 2200;
const MADA_STARE_DURATION_MS = 1000;
const MADA_FADE_ALPHA_DURATION_MS = 1600;
const MADA_FADE_DURATION_MS = MADA_FADE_ALPHA_DURATION_MS;
const BREACH_FADE_START_MS =
  BREACH_BIG_SMOKE_END_MS + MADA_RISE_DURATION_MS + MADA_STARE_DURATION_MS;
const BREACH_SEQUENCE_DURATION_MS = BREACH_FADE_START_MS + MADA_FADE_DURATION_MS;
const AMBUSH_WALK_DURATION_MS = 4615;
const AMBUSH_WALK_DISTANCE = 12.8;
const AMBUSH_LOOK_LEFT_DURATION_MS = 620;
const AMBUSH_LOOK_RIGHT_DURATION_MS = 840;
const AMBUSH_LOOK_DURATION_MS =
  AMBUSH_LOOK_LEFT_DURATION_MS + AMBUSH_LOOK_RIGHT_DURATION_MS;
const AMBUSH_BEHIND_DISTANCE = 5.8;
const AMBUSH_SIDE_OFFSET = 0.65;
const MADA_CONTAINMENT_BASE_LIFT = 1;
const MADA_PRE_SMOKE_EXTRA_LIFT = 1.3;
const MADA_POST_SMOKE_RISE_LIFT = 1.2;
const AMBUSH_REVEAL_TURN_DURATION_MS = 180;
const AMBUSH_DISCOVERY_DURATION_MS = 300;
const AMBUSH_BACKSTEP_DURATION_MS = 360;
const AMBUSH_BACKSTEP_DISTANCE = 2.1;
const AMBUSH_PLAYER_RETREAT_DISTANCE = 3;
const AMBUSH_PLAYER_RETREAT_DURATION_MS = 220;
const AMBUSH_GRAB_WINDUP_DURATION_MS = 360;
const AMBUSH_GRAB_STRIKE_DURATION_MS = 220;
const AMBUSH_GRAB_RECOVER_DURATION_MS = 460;
const AMBUSH_GRAB_DAMAGE = 24;
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
const AMBUSH_WALK_START_MS = BREACH_SEQUENCE_DURATION_MS;
const AMBUSH_WALK_END_MS = AMBUSH_WALK_START_MS + AMBUSH_WALK_DURATION_MS;
const AMBUSH_LOOK_START_MS = AMBUSH_WALK_END_MS;
const AMBUSH_LOOK_END_MS = AMBUSH_LOOK_START_MS + AMBUSH_LOOK_DURATION_MS;
const AMBUSH_REVEAL_TURN_END_MS =
  AMBUSH_LOOK_END_MS + AMBUSH_REVEAL_TURN_DURATION_MS;
const AMBUSH_DISCOVERY_END_MS =
  AMBUSH_REVEAL_TURN_END_MS + AMBUSH_DISCOVERY_DURATION_MS;
const AMBUSH_PLAYER_RETREAT_START_MS = AMBUSH_DISCOVERY_END_MS;
const AMBUSH_PLAYER_RETREAT_END_MS =
  AMBUSH_PLAYER_RETREAT_START_MS + AMBUSH_PLAYER_RETREAT_DURATION_MS;
const AMBUSH_GRAB_WINDUP_END_MS =
  AMBUSH_DISCOVERY_END_MS + AMBUSH_GRAB_WINDUP_DURATION_MS;
const AMBUSH_GRAB_STRIKE_END_MS =
  AMBUSH_GRAB_WINDUP_END_MS + AMBUSH_GRAB_STRIKE_DURATION_MS;
const STORY_SEQUENCE_DURATION_MS =
  AMBUSH_GRAB_STRIKE_END_MS + AMBUSH_GRAB_RECOVER_DURATION_MS;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const inverseLerp = (start: number, end: number, value: number) => {
  if (Math.abs(end - start) < 0.0001) {
    return value >= end ? 1 : 0;
  }
  return clamp((value - start) / (end - start), 0, 1);
};

const easeInOut = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const easeOutCubic = (value: number) => {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
};

const lerpAngle = (start: number, end: number, value: number) => {
  const t = clamp(value, 0, 1);
  const delta =
    THREE.MathUtils.euclideanModulo(end - start + Math.PI, Math.PI * 2) - Math.PI;
  return start + delta * t;
};

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

const resolveRenderableBounds = (object: THREE.Object3D) => {
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  let hasMesh = false;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshBounds.setFromObject(mesh);
    if (!hasMesh) {
      bounds.copy(meshBounds);
      hasMesh = true;
    } else {
      bounds.union(meshBounds);
    }
  });
  if (!hasMesh) {
    bounds.setFromObject(object);
  }
  return bounds;
};

const createPuddleGeometry = (radiusX: number, radiusZ: number, phase: number) => {
  const shape = new THREE.Shape();
  const points = 14;
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const ripple =
      0.84 +
      0.1 * Math.sin(angle * 3 + phase) +
      0.06 * Math.cos(angle * 4 - phase * 0.7);
    const x = Math.cos(angle) * radiusX * ripple;
    const z = Math.sin(angle) * radiusZ * ripple;
    if (i === 0) {
      shape.moveTo(x, z);
    } else {
      shape.lineTo(x, z);
    }
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
};

export const createMadaLabScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext
): SceneSetupResult => {
  const sceneBaseColor = new THREE.Color(0x031017);
  const sceneSmokeColor = new THREE.Color(0x020202);
  const baseFogNear = 38;
  const baseFogFar = 128;
  const sceneBackgroundColor = sceneBaseColor.clone();
  const sceneFog = new THREE.Fog(sceneBaseColor.getHex(), baseFogNear, baseFogFar);
  scene.background = sceneBackgroundColor;
  scene.fog = sceneFog;

  const resourceTracker = createSceneResourceTracker();
  const {
    trackMesh,
    trackObject,
    disposeObjectResources,
    disposeTrackedResources,
  } = resourceTracker;

  const bounds = {
    minX: -ROOM_WIDTH / 2 + 3,
    maxX: ROOM_WIDTH / 2 - 3,
    minZ: -ROOM_DEPTH / 2 + 3,
    maxZ: ROOM_DEPTH / 2 - 3,
  };

  const labGroup = new THREE.Group();
  const fxGroup = new THREE.Group();
  const solidGroup = new THREE.Group();
  labGroup.add(solidGroup, fxGroup);
  scene.add(labGroup);

  const attackTargets: PlayerAttackTarget[] = [];
  const colliders: BoxCollider[] = [];
  const activationRemovableObstacles: ActivationRemovableObstacle[] = [];
  const animators: Array<(now: number, delta: number) => void> = [];

  let madaHealth = MADA_MAX_HEALTH;
  let madaActivated = false;
  let terminalInRange = false;
  let terminalDestroyed = false;
  let breachSequenceStarted = false;
  let breachSequenceStartedAt = 0;
  let breachPendingTunnelExit = false;
  let playerWasInsideTunnel = false;
  let breachSequenceElapsedMs = 0;
  let breachSequenceClockNow = 0;
  let terminalExplosionStartedAt = 0;
  let electricActivity = 82;
  let shieldPulse = 0;
  let lastStateKey = "";
  let nextUiEmitAt = 0;
  let circuitBreakCount = 0;
  let fluidPatchCount = 0;
  let breachAftermathSpawned = false;
  let activationObstaclesRemoved = false;
  let containmentReleased = false;
  let storyModeActive = false;
  let madaHasVanished = false;
  let formalBattleStarted = false;
  let madaVerticalVelocity = 0;
  let madaGrabDamageApplied = false;
  let madaSkill1StartedAt = -1;
  let madaSkill1NextAvailableAt = 0;
  let madaSkill1DamageApplied = false;
  const frontWallDepth = 1.4;
  const frontWallZ = bounds.maxZ + 0.8;
  const tunnelWidth = 8.8;
  const tunnelHeight = 7.4;
  const tunnelDepth = 25.6;
  const tunnelStartZ = frontWallZ + frontWallDepth / 2;
  const tunnelCenterZ = tunnelStartZ + tunnelDepth / 2;
  const tunnelEndZ = tunnelStartZ + tunnelDepth;
  const terminalInteractionRadius = 2.05;
  const tunnelExitThresholdZ = frontWallZ + 0.1;
  const terminalAnchor = new THREE.Vector3(
    0,
    GROUND_Y + 1.25,
    tunnelEndZ - 1.15
  );
  const playableBounds = {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minZ: bounds.minZ,
    maxZ: tunnelEndZ - 0.45,
  };
  const playerWorldPosition = new THREE.Vector3();
  const breachIntroSmokeAnchor = new THREE.Vector3(0, GROUND_Y + 3.2, -12);
  const breachBigSmokeAnchor = new THREE.Vector3(0, GROUND_Y + 2.7, -3.5);
  const breachCutscenePlayerPosition = new THREE.Vector3();
  const breachForwardDirection = new THREE.Vector3();
  const breachRightDirection = new THREE.Vector3();
  const breachWalkEndPosition = new THREE.Vector3();
  const breachBackstepTargetPosition = new THREE.Vector3();
  const breachRetreatTargetPosition = new THREE.Vector3();
  const breachAmbushPosition = new THREE.Vector3();
  const breachRetreatDirection = new THREE.Vector3();
  const breachStoryPlayerPosition = new THREE.Vector3();
  const breachStoryMadaPosition = new THREE.Vector3();
  const breachLookTarget = new THREE.Vector3();
  let breachFocusYaw = Math.PI;
  let breachFocusPitch = 0;
  const ambientBaseColor = new THREE.Color(0xe4fbff);
  const ambientAlarmColor = new THREE.Color(0xff2f2f);

  const ambient = new THREE.AmbientLight(0xe4fbff, 2.1);
  scene.add(ambient);
  const breachAlarmLight = new THREE.PointLight(0xff2424, 0, 90, 2);
  breachAlarmLight.position.set(0, GROUND_Y + 8.6, -10);
  scene.add(breachAlarmLight);

  const addCollider = (
    x: number,
    z: number,
    width: number,
    depth: number,
    padding = 0.55
  ) => {
    const collider = {
      minX: x - width / 2 - padding,
      maxX: x + width / 2 + padding,
      minZ: z - depth / 2 - padding,
      maxZ: z + depth / 2 + padding,
      enabled: true,
    };
    colliders.push(collider);
    return collider;
  };

  const registerActivationRemovableObstacle = (
    object: THREE.Object3D,
    collider?: BoxCollider
  ) => {
    activationRemovableObstacles.push({ object, collider });
  };

  const removeActivationObstacles = () => {
    if (activationObstaclesRemoved) return;
    activationObstaclesRemoved = true;
    for (let i = 0; i < activationRemovableObstacles.length; i += 1) {
      const entry = activationRemovableObstacles[i];
      if (entry.collider) {
        entry.collider.enabled = false;
      }
      entry.object.visible = false;
      if (entry.object.parent) {
        entry.object.parent.remove(entry.object);
      }
    }
  };

  const getBreachTimelineState = (now: number) => {
    if (!breachSequenceStarted) {
      return {
        elapsedMs: 0,
        introSmokeOpacity: 0,
        bigSmokeOpacity: 0,
        bigSmokeExpandProgress: 0,
        bigSmokeDissipateProgress: 0,
        riseProgress: 0,
        fadeProgress: 0,
        shouldReleaseContainment: false,
        hasBigSmokeStarted: false,
        hasBigSmokeEnded: false,
        isLookingAround: false,
        isLookingAtPlayer: false,
        isSequenceComplete: false,
      };
    }

    if (breachSequenceClockNow <= 0) {
      breachSequenceClockNow = now;
    } else if (now > breachSequenceClockNow && !formalBattleStarted) {
      breachSequenceElapsedMs += now - breachSequenceClockNow;
      breachSequenceClockNow = now;
    }

    const elapsedMs = Math.max(0, breachSequenceElapsedMs);
    const introSmokeProgress = clamp(
      elapsedMs / BREACH_INTRO_SMOKE_DURATION_MS,
      0,
      1
    );
    const introSmokeOpacity =
      elapsedMs < BREACH_INTRO_SMOKE_DURATION_MS
        ? Math.sin(introSmokeProgress * Math.PI) * 0.92
        : 0;
    const bigSmokeElapsed = clamp(
      elapsedMs - BREACH_BIG_SMOKE_START_MS,
      0,
      BREACH_BIG_SMOKE_DURATION_MS
    );
    const rawBigSmokeExpandProgress = clamp(
      bigSmokeElapsed / BREACH_BIG_SMOKE_EXPAND_DURATION_MS,
      0,
      1
    );
    const rawBigSmokeHoldProgress = clamp(
      (bigSmokeElapsed - BREACH_BIG_SMOKE_EXPAND_DURATION_MS) /
        BREACH_BIG_SMOKE_HOLD_DURATION_MS,
      0,
      1
    );
    const rawBigSmokeDissipateProgress = clamp(
      (bigSmokeElapsed -
        BREACH_BIG_SMOKE_EXPAND_DURATION_MS -
        BREACH_BIG_SMOKE_HOLD_DURATION_MS) /
        BREACH_BIG_SMOKE_DISSIPATE_DURATION_MS,
      0,
      1
    );
    const bigSmokeExpandProgress = easeOutCubic(rawBigSmokeExpandProgress);
    const bigSmokeDissipateProgress = easeInOut(rawBigSmokeDissipateProgress);
    const bigSmokeOpacity =
      elapsedMs < BREACH_BIG_SMOKE_START_MS
        ? 0
        : rawBigSmokeExpandProgress < 1
        ? bigSmokeExpandProgress
        : rawBigSmokeHoldProgress < 1
        ? 1
        : 1 - bigSmokeDissipateProgress;
    const riseProgress = easeOutCubic(
      clamp(
        (elapsedMs - BREACH_BIG_SMOKE_END_MS) / MADA_RISE_DURATION_MS,
        0,
        1
      )
    );
    const fadeElapsed = Math.max(0, elapsedMs - BREACH_FADE_START_MS);
    const fadeProgress = easeInOut(
      clamp(fadeElapsed / MADA_FADE_ALPHA_DURATION_MS, 0, 1)
    );

    return {
      elapsedMs,
      introSmokeOpacity,
      bigSmokeOpacity,
      bigSmokeExpandProgress,
      bigSmokeDissipateProgress,
      riseProgress,
      fadeProgress,
      shouldReleaseContainment: elapsedMs >= BREACH_BIG_SMOKE_RELEASE_MS,
      hasBigSmokeStarted: elapsedMs >= BREACH_BIG_SMOKE_START_MS,
      hasBigSmokeEnded: elapsedMs >= BREACH_BIG_SMOKE_END_MS,
      isLookingAround:
        elapsedMs >= BREACH_INTRO_SMOKE_DURATION_MS &&
        elapsedMs < BREACH_BIG_SMOKE_START_MS,
      isLookingAtPlayer:
        elapsedMs >= BREACH_BIG_SMOKE_END_MS &&
        elapsedMs < BREACH_SEQUENCE_DURATION_MS,
      isSequenceComplete: elapsedMs >= BREACH_SEQUENCE_DURATION_MS,
    };
  };

  const getStoryTimelineState = (now: number) => {
    const breachTimeline = getBreachTimelineState(now);
    const elapsedMs = breachTimeline.elapsedMs;
    const walkProgress = easeInOut(
      inverseLerp(AMBUSH_WALK_START_MS, AMBUSH_WALK_END_MS, elapsedMs)
    );
    const lookElapsed = clamp(
      elapsedMs - AMBUSH_LOOK_START_MS,
      0,
      AMBUSH_LOOK_DURATION_MS
    );
    const lookLeftProgress = easeInOut(
      inverseLerp(0, AMBUSH_LOOK_LEFT_DURATION_MS, lookElapsed)
    );
    const lookRightProgress = easeInOut(
      inverseLerp(
        AMBUSH_LOOK_LEFT_DURATION_MS,
        AMBUSH_LOOK_DURATION_MS,
        lookElapsed
      )
    );
    const reappearProgress = easeInOut(
      inverseLerp(AMBUSH_LOOK_START_MS, AMBUSH_LOOK_END_MS, elapsedMs)
    );
    const revealTurnProgress = easeInOut(
      inverseLerp(AMBUSH_LOOK_END_MS, AMBUSH_REVEAL_TURN_END_MS, elapsedMs)
    );
    const discoveryProgress = inverseLerp(
      AMBUSH_REVEAL_TURN_END_MS,
      AMBUSH_DISCOVERY_END_MS,
      elapsedMs
    );
    const backstepProgress = easeOutCubic(
      inverseLerp(
        AMBUSH_REVEAL_TURN_END_MS,
        AMBUSH_REVEAL_TURN_END_MS + AMBUSH_BACKSTEP_DURATION_MS,
        elapsedMs
      )
    );
    const grabWindupProgress = easeInOut(
      inverseLerp(
        AMBUSH_DISCOVERY_END_MS,
        AMBUSH_GRAB_WINDUP_END_MS,
        elapsedMs
      )
    );
    const grabStrikeProgress = easeInOut(
      inverseLerp(
        AMBUSH_GRAB_WINDUP_END_MS,
        AMBUSH_GRAB_STRIKE_END_MS,
        elapsedMs
      )
    );
    const grabRecoverProgress = easeInOut(
      inverseLerp(
        AMBUSH_GRAB_STRIKE_END_MS,
        STORY_SEQUENCE_DURATION_MS,
        elapsedMs
      )
    );

    return {
      breachTimeline,
      elapsedMs,
      walkProgress,
      lookLeftProgress,
      lookRightProgress,
      reappearProgress,
      revealTurnProgress,
      discoveryProgress,
      backstepProgress,
      grabWindupProgress,
      grabStrikeProgress,
      grabRecoverProgress,
      isInitialBreachActive: elapsedMs < BREACH_SEQUENCE_DURATION_MS,
      isWalkPhase:
        elapsedMs >= AMBUSH_WALK_START_MS && elapsedMs < AMBUSH_WALK_END_MS,
      isLookPhase:
        elapsedMs >= AMBUSH_LOOK_START_MS && elapsedMs < AMBUSH_LOOK_END_MS,
      isRevealTurnPhase:
        elapsedMs >= AMBUSH_LOOK_END_MS && elapsedMs < AMBUSH_REVEAL_TURN_END_MS,
      isDiscoveryPhase:
        elapsedMs >= AMBUSH_REVEAL_TURN_END_MS && elapsedMs < AMBUSH_DISCOVERY_END_MS,
      isGrabWindupPhase:
        elapsedMs >= AMBUSH_DISCOVERY_END_MS && elapsedMs < AMBUSH_GRAB_WINDUP_END_MS,
      isGrabStrikePhase:
        elapsedMs >= AMBUSH_GRAB_WINDUP_END_MS && elapsedMs < AMBUSH_GRAB_STRIKE_END_MS,
      isGrabRecoverPhase:
        elapsedMs >= AMBUSH_GRAB_STRIKE_END_MS && elapsedMs < STORY_SEQUENCE_DURATION_MS,
      hasAmbushStarted: elapsedMs >= AMBUSH_WALK_START_MS,
      hasMadaReappeared: elapsedMs >= AMBUSH_LOOK_END_MS,
      isSequenceComplete: elapsedMs >= STORY_SEQUENCE_DURATION_MS,
    };
  };

  const getMadaSkill1State = (now: number) => {
    if (madaSkill1StartedAt < 0) {
      return {
        active: false,
        elapsedMs: 0,
        windupProgress: 0,
        strikeProgress: 0,
        recoverProgress: 0,
        isWindupPhase: false,
        isStrikePhase: false,
        isRecoverPhase: false,
      };
    }

    const elapsedMs = Math.max(0, now - madaSkill1StartedAt);
    if (elapsedMs >= MADA_SKILL1_DURATION_MS) {
      return {
        active: false,
        elapsedMs,
        windupProgress: 1,
        strikeProgress: 1,
        recoverProgress: 1,
        isWindupPhase: false,
        isStrikePhase: false,
        isRecoverPhase: false,
      };
    }

    return {
      active: true,
      elapsedMs,
      windupProgress: easeInOut(
        inverseLerp(0, MADA_SKILL1_WINDUP_DURATION_MS, elapsedMs)
      ),
      strikeProgress: easeInOut(
        inverseLerp(
          MADA_SKILL1_WINDUP_DURATION_MS,
          MADA_SKILL1_WINDUP_DURATION_MS + MADA_SKILL1_STRIKE_DURATION_MS,
          elapsedMs
        )
      ),
      recoverProgress: easeInOut(
        inverseLerp(
          MADA_SKILL1_WINDUP_DURATION_MS + MADA_SKILL1_STRIKE_DURATION_MS,
          MADA_SKILL1_DURATION_MS,
          elapsedMs
        )
      ),
      isWindupPhase: elapsedMs < MADA_SKILL1_WINDUP_DURATION_MS,
      isStrikePhase:
        elapsedMs >= MADA_SKILL1_WINDUP_DURATION_MS &&
        elapsedMs < MADA_SKILL1_WINDUP_DURATION_MS + MADA_SKILL1_STRIKE_DURATION_MS,
      isRecoverPhase:
        elapsedMs >= MADA_SKILL1_WINDUP_DURATION_MS + MADA_SKILL1_STRIKE_DURATION_MS,
    };
  };

  const resolveStoryPlayerPosition = (now: number, target: THREE.Vector3) => {
    if (!breachSequenceStarted) {
      return target.copy(playerWorldPosition);
    }

    const timeline = getStoryTimelineState(now);
    target.copy(breachCutscenePlayerPosition);

    if (timeline.elapsedMs >= AMBUSH_WALK_START_MS) {
      target.lerpVectors(
        breachCutscenePlayerPosition,
        breachWalkEndPosition,
        timeline.walkProgress
      );
    }

    if (timeline.elapsedMs >= AMBUSH_REVEAL_TURN_END_MS) {
      target.lerpVectors(
        breachWalkEndPosition,
        breachBackstepTargetPosition,
        timeline.backstepProgress
      );
    }

    if (timeline.elapsedMs >= AMBUSH_PLAYER_RETREAT_START_MS) {
      const retreatProgress = easeOutCubic(
        inverseLerp(
          AMBUSH_PLAYER_RETREAT_START_MS,
          AMBUSH_PLAYER_RETREAT_END_MS,
          timeline.elapsedMs
        )
      );
      target.lerpVectors(
        breachBackstepTargetPosition,
        breachRetreatTargetPosition,
        retreatProgress
      );
    }

    target.y = breachCutscenePlayerPosition.y;
    return target;
  };

  const resolveStoryMadaPosition = (now: number, target: THREE.Vector3) => {
    const timeline = getStoryTimelineState(now);
    const baseMadaY = MADA_GROUND_Y;
    const breachTimeline = timeline.breachTimeline;

    if (!timeline.hasAmbushStarted) {
      const preSmokeRiseProgress = easeInOut(
        inverseLerp(0, BREACH_BIG_SMOKE_START_MS, breachTimeline.elapsedMs)
      );
      const containmentLift =
        MADA_CONTAINMENT_BASE_LIFT + preSmokeRiseProgress * MADA_PRE_SMOKE_EXTRA_LIFT;
      const riseOffset = breachTimeline.hasBigSmokeEnded
        ? breachTimeline.riseProgress * MADA_POST_SMOKE_RISE_LIFT
        : 0;
      const hoverOffset = breachTimeline.hasBigSmokeEnded
        ? Math.sin(now * 0.0015) * 0.16
        : Math.sin(now * 0.0012) * 0.08;
      target.set(
        0,
        baseMadaY + containmentLift + riseOffset + hoverOffset + shieldPulse * 0.05,
        -12
      );
      return target;
    }

    target.copy(breachAmbushPosition);
    target.y = MADA_GROUND_Y;

    if (
      timeline.isGrabWindupPhase ||
      timeline.isGrabStrikePhase ||
      timeline.isGrabRecoverPhase
    ) {
      resolveStoryPlayerPosition(now, breachStoryPlayerPosition);
      breachLookTarget
        .copy(breachStoryPlayerPosition)
        .sub(target)
        .setY(0);
      const distance = breachLookTarget.length();
      if (distance > 0.001) {
        breachLookTarget.normalize();
        const lungeDistance = timeline.isGrabWindupPhase
          ? 0.22 * timeline.grabWindupProgress
          : timeline.isGrabStrikePhase
          ? 0.22 + 1.15 * timeline.grabStrikeProgress
          : THREE.MathUtils.lerp(1.37, 0.3, timeline.grabRecoverProgress);
        target.addScaledVector(breachLookTarget, lungeDistance);
      }
    }

    return target;
  };

  const emitState = (force = false, now = performance.now()) => {
    if (!force && now < nextUiEmitAt) return;
    nextUiEmitAt = now + UI_EMIT_INTERVAL_MS;
    const containmentIntegrity = clamp(
      Math.round((madaHealth / MADA_MAX_HEALTH) * 100),
      0,
      100
    );
    const nextState: MadaLabState = {
      madaHealth: Math.max(0, Math.floor(madaHealth)),
      madaMaxHealth: MADA_MAX_HEALTH,
      containmentIntegrity,
      electricActivity: clamp(Math.round(electricActivity), 0, 100),
      fluidPatches: fluidPatchCount,
      circuitBreaks: circuitBreakCount,
      terminalInRange,
      statusLabel:
        madaHasVanished
          ? "Specimen vanished"
          : storyModeActive
          ? "Story sequence"
          :
        madaHealth <= 0
          ? "Containment failure"
          : breachSequenceStarted
          ? "Containment breach"
          : !madaActivated
          ? "Specimen dormant"
          : containmentIntegrity <= 30
          ? "Containment unstable"
          : containmentIntegrity <= 60
          ? "Specimen destabilized"
          : "Specimen restrained",
    };
    const stateKey = JSON.stringify(nextState);
    if (!force && stateKey === lastStateKey) return;
    lastStateKey = stateKey;
    context?.onStateChange?.({
      [MADA_LAB_STATE_KEY]: nextState,
    });
  };

  const registerAnimator = (animate: (now: number, delta: number) => void) => {
    animators.push(animate);
  };

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b1a22,
    roughness: 0.9,
    metalness: 0.16,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x16252f,
    roughness: 0.88,
    metalness: 0.18,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x233744,
    roughness: 0.68,
    metalness: 0.28,
  });
  const glowCyan = new THREE.MeshBasicMaterial({ color: 0x7df7ff });
  const glowLime = new THREE.MeshBasicMaterial({ color: 0xb7ff5c });
  const glowAmber = new THREE.MeshBasicMaterial({ color: 0xffc54d });
  const glowRed = new THREE.MeshBasicMaterial({ color: 0xff6b6b });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = GROUND_Y;
  solidGroup.add(floor);
  trackMesh(floor);

  const centerRunway = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 50),
    new THREE.MeshStandardMaterial({
      color: 0x132833,
      roughness: 0.74,
      metalness: 0.22,
    })
  );
  centerRunway.rotation.x = -Math.PI / 2;
  centerRunway.position.set(0, GROUND_Y + 0.01, 1);
  solidGroup.add(centerRunway);
  trackMesh(centerRunway);

  const floorGridMaterial = new THREE.MeshBasicMaterial({
    color: 0x163541,
    transparent: true,
    opacity: 0.38,
  });
  for (let x = -30; x <= 30; x += 10) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.02, ROOM_DEPTH - 18),
      floorGridMaterial.clone()
    );
    stripe.position.set(x, GROUND_Y + 0.02, 0);
    solidGroup.add(stripe);
    trackMesh(stripe);
  }
  for (let z = -24; z <= 24; z += 8) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_WIDTH - 20, 0.02, 0.18),
      floorGridMaterial.clone()
    );
    stripe.position.set(0, GROUND_Y + 0.02, z);
    solidGroup.add(stripe);
    trackMesh(stripe);
  }

  const createWall = (width: number, height: number, depth: number) =>
    new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);

  const backWall = createWall(ROOM_WIDTH - 8, ROOM_HEIGHT, 1.4);
  backWall.position.set(0, GROUND_Y + ROOM_HEIGHT / 2, bounds.minZ - 0.8);
  solidGroup.add(backWall);
  trackMesh(backWall);

  const frontWallSideWidth = (ROOM_WIDTH - 8 - tunnelWidth) / 2;
  const frontWallLeft = createWall(frontWallSideWidth, ROOM_HEIGHT, frontWallDepth);
  frontWallLeft.position.set(
    -(tunnelWidth / 2 + frontWallSideWidth / 2),
    GROUND_Y + ROOM_HEIGHT / 2,
    frontWallZ
  );
  solidGroup.add(frontWallLeft);
  trackMesh(frontWallLeft);

  const frontWallRight = createWall(frontWallSideWidth, ROOM_HEIGHT, frontWallDepth);
  frontWallRight.position.set(
    tunnelWidth / 2 + frontWallSideWidth / 2,
    GROUND_Y + ROOM_HEIGHT / 2,
    frontWallZ
  );
  solidGroup.add(frontWallRight);
  trackMesh(frontWallRight);

  const frontWallTop = createWall(tunnelWidth, ROOM_HEIGHT - tunnelHeight, frontWallDepth);
  frontWallTop.position.set(
    0,
    GROUND_Y + tunnelHeight + (ROOM_HEIGHT - tunnelHeight) / 2,
    frontWallZ
  );
  solidGroup.add(frontWallTop);
  trackMesh(frontWallTop);

  const leftWall = createWall(1.4, ROOM_HEIGHT, ROOM_DEPTH - 8);
  leftWall.position.set(bounds.minX - 0.8, GROUND_Y + ROOM_HEIGHT / 2, 0);
  solidGroup.add(leftWall);
  trackMesh(leftWall);

  const rightWall = createWall(1.4, ROOM_HEIGHT, ROOM_DEPTH - 8);
  rightWall.position.set(bounds.maxX + 0.8, GROUND_Y + ROOM_HEIGHT / 2, 0);
  solidGroup.add(rightWall);
  trackMesh(rightWall);

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_WIDTH - 8, 1.2, ROOM_DEPTH - 8),
    wallMaterial
  );
  ceiling.position.set(0, GROUND_Y + ROOM_HEIGHT + 0.5, 0);
  solidGroup.add(ceiling);
  trackMesh(ceiling);

  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.set(0, 0, 0);

  const tunnelFloor = new THREE.Mesh(
    new THREE.BoxGeometry(tunnelWidth + 0.36, 0.18, tunnelDepth),
    trimMaterial
  );
  tunnelFloor.position.set(0, GROUND_Y + 0.09, tunnelCenterZ);
  tunnelGroup.add(tunnelFloor);

  const tunnelCeiling = new THREE.Mesh(
    new THREE.BoxGeometry(tunnelWidth + 0.5, 0.24, tunnelDepth),
    trimMaterial
  );
  tunnelCeiling.position.set(0, GROUND_Y + tunnelHeight, tunnelCenterZ);
  tunnelGroup.add(tunnelCeiling);

  const tunnelLeftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, tunnelHeight, tunnelDepth),
    wallMaterial
  );
  tunnelLeftWall.position.set(-(tunnelWidth / 2 + 0.17), GROUND_Y + tunnelHeight / 2, tunnelCenterZ);
  tunnelGroup.add(tunnelLeftWall);

  const tunnelRightWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, tunnelHeight, tunnelDepth),
    wallMaterial
  );
  tunnelRightWall.position.set(tunnelWidth / 2 + 0.17, GROUND_Y + tunnelHeight / 2, tunnelCenterZ);
  tunnelGroup.add(tunnelRightWall);

  const tunnelEndWall = new THREE.Mesh(
    new THREE.BoxGeometry(tunnelWidth + 0.36, tunnelHeight, 0.28),
    wallMaterial
  );
  tunnelEndWall.position.set(0, GROUND_Y + tunnelHeight / 2, tunnelEndZ - 0.14);
  tunnelGroup.add(tunnelEndWall);

  const terminalGroup = new THREE.Group();
  tunnelGroup.add(terminalGroup);

  const terminalPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.2, 1.1),
    trimMaterial
  );
  terminalPedestal.position.copy(terminalAnchor);
  terminalPedestal.position.y = GROUND_Y + 0.68;
  terminalGroup.add(terminalPedestal);

  const terminalStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 1.05, 0.36),
    wallMaterial
  );
  terminalStem.position.set(0, GROUND_Y + 1.56, terminalAnchor.z - 0.1);
  terminalGroup.add(terminalStem);

  const terminalConsole = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.96, 0.34),
    trimMaterial
  );
  terminalConsole.position.set(0, GROUND_Y + 2.18, terminalAnchor.z - 0.18);
  terminalConsole.rotation.x = -0.22;
  terminalGroup.add(terminalConsole);

  const terminalScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 0.64),
    new THREE.MeshBasicMaterial({
      color: 0x7df7ff,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    })
  );
  terminalScreen.position.set(0, GROUND_Y + 2.2, terminalAnchor.z - 0.37);
  terminalScreen.rotation.set(-0.22, Math.PI, 0);
  terminalGroup.add(terminalScreen);

  const terminalSideLightLeftMaterial = glowLime.clone();
  const terminalSideLightLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.72, 0.08),
    terminalSideLightLeftMaterial
  );
  terminalSideLightLeft.position.set(-0.78, GROUND_Y + 2.18, terminalAnchor.z - 0.22);
  terminalGroup.add(terminalSideLightLeft);

  const terminalSideLightRightMaterial = glowLime.clone();
  const terminalSideLightRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.72, 0.08),
    terminalSideLightRightMaterial
  );
  terminalSideLightRight.position.x = 0.78;
  terminalSideLightRight.position.y = GROUND_Y + 2.18;
  terminalSideLightRight.position.z = terminalAnchor.z - 0.22;
  terminalGroup.add(terminalSideLightRight);

  const terminalExplosionGroup = new THREE.Group();
  terminalExplosionGroup.visible = false;
  tunnelGroup.add(terminalExplosionGroup);

  const terminalExplosionFlashMaterial = new THREE.MeshBasicMaterial({
    color: 0xff8a65,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const terminalExplosionFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 10),
    terminalExplosionFlashMaterial
  );
  terminalExplosionGroup.add(terminalExplosionFlash);

  const terminalExplosionSmokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x090909,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const terminalExplosionSmoke = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 14, 12),
    terminalExplosionSmokeMaterial
  );
  terminalExplosionGroup.add(terminalExplosionSmoke);

  const terminalExplosionShards = Array.from({ length: 6 }, (_, index) => {
    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.26, 0.08),
      trimMaterial.clone()
    );
    const angle = (index / 6) * Math.PI * 2;
    shard.position.set(Math.cos(angle) * 0.34, 0.14, Math.sin(angle) * 0.28);
    terminalExplosionGroup.add(shard);
    return {
      mesh: shard,
      angle,
      lift: 0.2 + index * 0.04,
    };
  });
  terminalExplosionGroup.position.set(0, GROUND_Y + 1.9, terminalAnchor.z - 0.2);

  registerAnimator((now) => {
    const screenMaterial = terminalScreen.material as THREE.MeshBasicMaterial;
    const terminalBlinkOn = Math.floor(now / 300) % 2 === 0;
    if (!terminalDestroyed) {
      const pulse = 0.58 + (0.5 + 0.5 * Math.sin(now * 0.0048)) * 0.24;
      screenMaterial.color.setHex(0x7df7ff);
      screenMaterial.opacity = pulse;
      terminalScreen.scale.x = 0.98 + Math.sin(now * 0.0026) * 0.015;
      terminalSideLightLeftMaterial.color.setHex(0xb7ff5c);
      terminalSideLightRightMaterial.color.setHex(0xb7ff5c);
      terminalSideLightLeft.scale.y = 0.84 + Math.sin(now * 0.005 + 0.3) * 0.12;
      terminalSideLightRight.scale.y = 0.84 + Math.sin(now * 0.005 + 1.1) * 0.12;
    } else {
      screenMaterial.color.setHex(terminalBlinkOn ? 0xff4d4d : 0x2f0608);
      screenMaterial.opacity = terminalBlinkOn ? 0.96 : 0.26;
      terminalScreen.scale.x = terminalBlinkOn ? 1.02 : 0.99;
      terminalSideLightLeftMaterial.color.setHex(
        terminalBlinkOn ? 0xff6b6b : 0x3f1010
      );
      terminalSideLightRightMaterial.color.setHex(
        terminalBlinkOn ? 0xff6b6b : 0x3f1010
      );
      terminalSideLightLeft.scale.y = terminalBlinkOn ? 1.06 : 0.64;
      terminalSideLightRight.scale.y = terminalBlinkOn ? 1.06 : 0.64;
    }

    if (terminalExplosionStartedAt <= 0) {
      terminalExplosionGroup.visible = false;
      terminalExplosionFlashMaterial.opacity = 0;
      terminalExplosionSmokeMaterial.opacity = 0;
      return;
    }

    const progress = THREE.MathUtils.clamp(
      (now - terminalExplosionStartedAt) / 850,
      0,
      1
    );
    if (progress >= 1) {
      terminalExplosionGroup.visible = false;
      terminalExplosionFlashMaterial.opacity = 0;
      terminalExplosionSmokeMaterial.opacity = 0;
      return;
    }

    terminalExplosionGroup.visible = true;
    terminalExplosionFlash.scale.setScalar(0.6 + progress * 1.8);
    terminalExplosionSmoke.scale.setScalar(0.8 + progress * 2.2);
    terminalExplosionFlashMaterial.opacity = (1 - progress) * 0.78;
    terminalExplosionSmokeMaterial.opacity = (1 - progress) * 0.34;
    terminalExplosionGroup.rotation.y += 0.08;

    for (let i = 0; i < terminalExplosionShards.length; i += 1) {
      const shard = terminalExplosionShards[i];
      const drift = 0.4 + progress * 1.4;
      shard.mesh.position.set(
        Math.cos(shard.angle) * drift,
        shard.lift + progress * 0.7,
        Math.sin(shard.angle) * drift * 0.9
      );
      shard.mesh.rotation.x += 0.14;
      shard.mesh.rotation.y += 0.19;
    }
  });

  solidGroup.add(tunnelGroup);
  trackObject(tunnelGroup);
  addCollider(-(tunnelWidth / 2 + 0.17), tunnelCenterZ, 0.34, tunnelDepth, 0.08);
  addCollider(tunnelWidth / 2 + 0.17, tunnelCenterZ, 0.34, tunnelDepth, 0.08);
  addCollider(0, tunnelEndZ - 0.14, tunnelWidth + 0.36, 0.28, 0.08);
  const terminalCollider = addCollider(0, terminalAnchor.z - 0.12, 2, 1.8, 0.1);

  const createPanelWindow = (x: number) => {
    const panel = new THREE.Group();
    panel.position.set(x, GROUND_Y + 10.2, bounds.minZ + 0.24);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 7.2, 0.22),
      trimMaterial
    );
    panel.add(frame);

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 6.2, 0.16),
      new THREE.MeshBasicMaterial({
        color: 0x4fe8ff,
        transparent: true,
        opacity: 0.18,
      })
    );
    glass.position.z = 0.14;
    panel.add(glass);
    registerAnimator((now) => {
      const material = glass.material as THREE.MeshBasicMaterial;
      material.opacity = 0.12 + (0.5 + 0.5 * Math.sin(now * 0.0012 + x)) * 0.1;
    });

    solidGroup.add(panel);
    trackObject(panel);
  };

  [-11, 0, 11].forEach(createPanelWindow);

  const createCeilingStrip = (x: number, z: number, color: number, speed: number) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.18, 1),
      new THREE.MeshBasicMaterial({ color })
    );
    strip.position.set(x, GROUND_Y + ROOM_HEIGHT - 0.9, z);
    solidGroup.add(strip);
    trackMesh(strip);
    registerAnimator((now) => {
      const scale = 0.85 + (0.5 + 0.5 * Math.sin(now * 0.0018 * speed + x)) * 0.2;
      strip.scale.x = scale;
    });
  };

  [-28, -9, 9, 28].forEach((x, index) => {
    createCeilingStrip(x, 17, 0x7df7ff, 1 + index * 0.15);
    createCeilingStrip(x, -17, 0xb7ff5c, 1.2 + index * 0.15);
  });

  const createLabBench = (x: number, z: number, rotationY: number) => {
    const bench = new THREE.Group();
    bench.position.set(x, 0, z);
    bench.rotation.y = rotationY;

    const benchBody = new THREE.MeshStandardMaterial({
      color: 0x1a2933,
      roughness: 0.86,
      metalness: 0.16,
    });
    const benchTop = new THREE.MeshStandardMaterial({
      color: 0x30414c,
      roughness: 0.62,
      metalness: 0.22,
    });

    const top = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.2, 3.6), benchTop);
    top.position.y = GROUND_Y + 1.28;
    bench.add(top);

    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 0.18, 2.8),
      benchBody
    );
    shelf.position.y = GROUND_Y + 0.54;
    bench.add(shelf);

    [-3.5, -1.2, 1.2, 3.5].forEach((legX) => {
      const frontLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 1.1, 0.16),
        benchBody
      );
      frontLeg.position.set(legX, GROUND_Y + 0.54, -1.3);
      bench.add(frontLeg);
      const backLeg = frontLeg.clone();
      backLeg.position.z = 1.3;
      bench.add(backLeg);
    });

    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x7df7ff })
    );
    monitor.position.set(-2.2, GROUND_Y + 2.1, -0.2);
    bench.add(monitor);

    const device = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.7, 0.9),
      trimMaterial
    );
    device.position.set(1.1, GROUND_Y + 1.65, 0.4);
    bench.add(device);

    [-0.4, 0.45, 1.3].forEach((offset, index) => {
      const beaker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.52 + index * 0.08, 10),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0xb7ff5c : 0x7df7ff,
        })
      );
      beaker.position.set(offset, GROUND_Y + 1.56, -0.96);
      bench.add(beaker);
    });

    solidGroup.add(bench);
    trackObject(bench);
    const collider = addCollider(x, z, 8.6, 3.6, 0.7);
    registerActivationRemovableObstacle(bench, collider);
  };

  createLabBench(-24, 10, Math.PI * 0.08);
  createLabBench(24, 8, -Math.PI * 0.08);
  createLabBench(-22, -22, Math.PI * 0.08);
  createLabBench(22, -24, -Math.PI * 0.08);

  const createTankRack = (x: number, z: number, rotationY: number) => {
    const rack = new THREE.Group();
    rack.position.set(x, 0, z);
    rack.rotation.y = rotationY;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 4.8, 2.2),
      trimMaterial
    );
    frame.position.y = GROUND_Y + 2.4;
    rack.add(frame);

    [-1, 0, 1].forEach((offset, index) => {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 2.9, 12),
        wallMaterial
      );
      tank.position.set(offset, GROUND_Y + 2.15, 0);
      rack.add(tank);

      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 1.2 + index * 0.24, 10),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0x7df7ff : 0xb7ff5c,
        })
      );
      core.position.set(offset, GROUND_Y + 1.7, 0);
      rack.add(core);
      registerAnimator((now) => {
        core.position.y =
          GROUND_Y + 1.7 + Math.sin(now * 0.0014 + offset * 2) * 0.08;
      });
    });

    solidGroup.add(rack);
    trackObject(rack);
    const collider = addCollider(x, z, 4.2, 2.2, 0.6);
    registerActivationRemovableObstacle(rack, collider);
  };

  createTankRack(-35, 22, Math.PI / 2);
  createTankRack(35, 22, -Math.PI / 2);
  createTankRack(-35, -16, Math.PI / 2);
  createTankRack(35, -16, -Math.PI / 2);

  const createBrokenCircuitPanel = (
    x: number,
    y: number,
    z: number,
    rotationY: number,
    color: number,
    brokenIndex: number
  ) => {
    const panel = new THREE.Group();
    panel.position.set(x, y, z);
    panel.rotation.y = rotationY;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 5, 0.26),
      trimMaterial
    );
    panel.add(base);

    const traceMaterial = new THREE.MeshBasicMaterial({ color });
    const traces = [
      { x: -2.1, y: 1.5, w: 1.8, h: 0.12 },
      { x: -1.2, y: 0.9, w: 0.12, h: 1.2 },
      { x: -0.1, y: 0.9, w: 2.1, h: 0.12 },
      { x: 1.0, y: 0.1, w: 0.12, h: 1.5 },
      { x: 1.9, y: 0.1, w: 1.6, h: 0.12 },
      { x: -1.8, y: -0.8, w: 0.12, h: 1.1 },
      { x: -0.9, y: -1.4, w: 2, h: 0.12 },
      { x: 0.9, y: -1.4, w: 0.12, h: 1.2 },
    ];

    traces.forEach((trace, index) => {
      if (index === brokenIndex) {
        circuitBreakCount += 1;
        const shard = new THREE.Mesh(
          new THREE.BoxGeometry(trace.w, trace.h, 0.08),
          traceMaterial.clone()
        );
        shard.position.set(trace.x * 0.7, -2.4 - index * 0.08, 0.26);
        shard.rotation.z = 0.4 + index * 0.08;
        panel.add(shard);
        return;
      }
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(trace.w, trace.h, 0.08),
        traceMaterial
      );
      segment.position.set(trace.x, trace.y, 0.18);
      panel.add(segment);
    });

    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({ color })
    );
    spark.position.set(0.5, 1, 0.22);
    panel.add(spark);
    registerAnimator((now) => {
      spark.scale.setScalar(0.75 + (0.5 + 0.5 * Math.sin(now * 0.006 + x)) * 0.65);
    });

    solidGroup.add(panel);
    trackObject(panel);
  };

  createBrokenCircuitPanel(bounds.minX + 0.3, GROUND_Y + 10.4, -6, Math.PI / 2, 0x7df7ff, 1);
  createBrokenCircuitPanel(bounds.maxX - 0.3, GROUND_Y + 10.2, -4, -Math.PI / 2, 0xffc54d, 3);
  createBrokenCircuitPanel(bounds.minX + 0.3, GROUND_Y + 9.8, 18, Math.PI / 2, 0xb7ff5c, 5);
  createBrokenCircuitPanel(bounds.maxX - 0.3, GROUND_Y + 9.7, 18, -Math.PI / 2, 0xff6b6b, 6);

  const createEnergyRail = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: number,
    beadCount: number,
    speed: number
  ) => {
    const group = new THREE.Group();
    const direction = end.clone().sub(start);
    const length = direction.length();
    const yaw = Math.atan2(direction.x, direction.z);

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, length),
      new THREE.MeshBasicMaterial({ color })
    );
    bar.position.copy(start.clone().lerp(end, 0.5));
    bar.rotation.y = yaw;
    group.add(bar);

    const beads: THREE.Mesh[] = [];
    for (let i = 0; i < beadCount; i += 1) {
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshBasicMaterial({ color })
      );
      beads.push(bead);
      group.add(bead);
    }

    registerAnimator((now) => {
      for (let i = 0; i < beads.length; i += 1) {
        const bead = beads[i];
        const t = (now * 0.00022 * speed + i / beads.length) % 1;
        bead.position.copy(start).lerp(end, t);
        const scale = 0.75 + (0.5 + 0.5 * Math.sin(now * 0.006 + i)) * 0.35;
        bead.scale.setScalar(scale);
      }
    });

    fxGroup.add(group);
    trackObject(group);
  };

  const railY = GROUND_Y + 7.2;
  createEnergyRail(
    new THREE.Vector3(bounds.minX + 1.5, railY, bounds.minZ + 3),
    new THREE.Vector3(bounds.maxX - 1.5, railY, bounds.minZ + 3),
    0x7df7ff,
    8,
    1
  );
  createEnergyRail(
    new THREE.Vector3(bounds.minX + 1.5, railY, bounds.maxZ - 3),
    new THREE.Vector3(bounds.maxX - 1.5, railY, bounds.maxZ - 3),
    0xb7ff5c,
    8,
    1.1
  );
  createEnergyRail(
    new THREE.Vector3(bounds.minX + 3, railY, bounds.minZ + 6),
    new THREE.Vector3(bounds.minX + 3, railY, bounds.maxZ - 6),
    0xffc54d,
    6,
    1.2
  );
  createEnergyRail(
    new THREE.Vector3(bounds.maxX - 3, railY, bounds.minZ + 6),
    new THREE.Vector3(bounds.maxX - 3, railY, bounds.maxZ - 6),
    0x7df7ff,
    6,
    1.3
  );

  const createElectricColumn = (x: number, z: number, color: number, phase: number) => {
    const column = new THREE.Group();
    column.position.set(x, 0, z);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.1, 0.9, 12),
      trimMaterial
    );
    base.position.y = GROUND_Y + 0.45;
    column.add(base);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 5.1, 10),
      trimMaterial
    );
    stem.position.y = GROUND_Y + 3;
    column.add(stem);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.08, 10, 28),
      new THREE.MeshBasicMaterial({ color })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = GROUND_Y + 5.5;
    column.add(halo);

    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshBasicMaterial({ color })
    );
    bead.position.y = GROUND_Y + 5.5;
    column.add(bead);

    registerAnimator((now) => {
      halo.rotation.z += 0.02;
      bead.position.y = GROUND_Y + 5.3 + Math.sin(now * 0.002 + phase) * 0.35;
      bead.scale.setScalar(0.85 + (0.5 + 0.5 * Math.sin(now * 0.004 + phase)) * 0.4);
    });

    solidGroup.add(column);
    trackObject(column);
    const collider = addCollider(x, z, 2.2, 2.2, 0.45);
    registerActivationRemovableObstacle(column, collider);
  };

  createElectricColumn(-38, -24, 0x7df7ff, 0.2);
  createElectricColumn(38, -24, 0xffc54d, 0.8);
  createElectricColumn(-38, 24, 0xb7ff5c, 1.4);
  createElectricColumn(38, 24, 0x7df7ff, 2.2);

  const createPuddle = (
    x: number,
    z: number,
    radiusX: number,
    radiusZ: number,
    color: number,
    phase: number
  ) => {
    const puddle = new THREE.Mesh(
      createPuddleGeometry(radiusX, radiusZ, phase),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62 })
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, GROUND_Y + 0.04, z);
    fxGroup.add(puddle);
    trackMesh(puddle);
    fluidPatchCount += 1;
  };

  [
    [-32, -4, 2.1, 1.4, 0xb7ff5c, 0.2],
    [-28, 18, 1.8, 1.1, 0x7df7ff, 0.6],
    [-18, -28, 2.4, 1.7, 0xb7ff5c, 1.1],
    [-9, 12, 1.4, 0.9, 0x4fffd6, 1.5],
    [-2, -20, 1.6, 1.1, 0x7df7ff, 2],
    [8, -4, 1.9, 1.2, 0xb7ff5c, 2.4],
    [10, 18, 1.5, 1, 0x7df7ff, 2.8],
    [14, -29, 2.2, 1.4, 0x8dff75, 3.3],
    [22, 24, 1.5, 1.1, 0xb7ff5c, 3.7],
    [28, -10, 1.8, 1.1, 0x7df7ff, 4.2],
    [31, 6, 1.5, 0.9, 0xb7ff5c, 4.7],
    [-36, 2, 1.2, 0.8, 0x7df7ff, 5.1],
    [0, -32, 2.8, 1.3, 0xb7ff5c, 5.5],
    [3, 26, 2.2, 1.2, 0x4fffd6, 5.9],
  ].forEach(([x, z, rx, rz, color, phase]) => {
    createPuddle(
      x as number,
      z as number,
      rx as number,
      rz as number,
      color as number,
      phase as number
    );
  });

  const spawnBreachAftermathPuddles = () => {
    [
      [-9.4, -14.8, 3.8, 2.5, 0x7df7ff, 0.35],
      [-6.2, -8.4, 2.8, 1.7, 0x4fffd6, 0.7],
      [-2.5, -16.2, 3.1, 2.1, 0xb7ff5c, 1.1],
      [0.3, -10.6, 4.2, 2.6, 0x7df7ff, 1.45],
      [3.8, -17.6, 2.9, 1.9, 0x8dff75, 1.8],
      [7.4, -12.2, 3.4, 2.2, 0x4fffd6, 2.15],
      [-12.4, -20.6, 2.6, 1.7, 0xb7ff5c, 2.5],
      [12.1, -21.8, 2.8, 1.8, 0x7df7ff, 2.85],
      [-15.3, -6.8, 2.4, 1.5, 0x4fffd6, 3.2],
      [15.4, -7.4, 2.5, 1.6, 0xb7ff5c, 3.55],
      [-4.4, -23.8, 3.7, 2.1, 0x7df7ff, 3.9],
      [5.6, -24.6, 3.5, 2, 0x8dff75, 4.25],
    ].forEach(([x, z, rx, rz, color, phase]) => {
      createPuddle(
        x as number,
        z as number,
        rx as number,
        rz as number,
        color as number,
        phase as number
      );
    });
  };

  const chamber = new THREE.Group();
  chamber.position.set(0, 0, -12);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 6, 1.3, 24),
    trimMaterial
  );
  platform.position.y = GROUND_Y + 0.65;
  chamber.add(platform);

  const containmentShellGroup = new THREE.Group();
  chamber.add(containmentShellGroup);

  const platformRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.9, 0.14, 10, 40),
    glowLime
  );
  platformRing.rotation.x = Math.PI / 2;
  platformRing.position.y = GROUND_Y + 1.45;
  containmentShellGroup.add(platformRing);

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, 8.6, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x7df7ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    })
  );
  shell.position.y = GROUND_Y + 5.15;
  containmentShellGroup.add(shell);

  const topCap = new THREE.Mesh(
    new THREE.TorusGeometry(4.25, 0.16, 10, 40),
    glowCyan
  );
  topCap.rotation.x = Math.PI / 2;
  topCap.position.y = GROUND_Y + 9.45;
  containmentShellGroup.add(topCap);

  const middleBand = new THREE.Mesh(
    new THREE.TorusGeometry(4.42, 0.12, 10, 40),
    glowCyan
  );
  middleBand.rotation.x = Math.PI / 2;
  middleBand.position.y = GROUND_Y + 5.8;
  containmentShellGroup.add(middleBand);

  [
    [-3.2, -3.2],
    [3.2, -3.2],
    [-3.2, 3.2],
    [3.2, 3.2],
  ].forEach(([x, z]) => {
    const strut = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 8.5, 0.34),
      trimMaterial
    );
    strut.position.set(x, GROUND_Y + 5.15, z);
    containmentShellGroup.add(strut);
  });

  const crackGroup = new THREE.Group();
  [
    [1.2, 7.7, 0.18, 0.05],
    [0.8, 6.1, 0.12, -0.08],
    [-1.6, 5.4, -0.22, 0.04],
    [-1.8, 4.1, -0.1, -0.06],
    [2.1, 5.0, 0.24, -0.04],
  ].forEach(([x, y, z, rotZ]) => {
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.2, 0.04),
      glowCyan.clone()
    );
    crack.position.set(x as number, GROUND_Y + (y as number), z as number);
    crack.rotation.z = rotZ as number;
    crackGroup.add(crack);
  });
  containmentShellGroup.add(crackGroup);

  const chamberProjectileBlockerMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  chamberProjectileBlockerMaterial.colorWrite = false;
  const chamberProjectileBlocker = new THREE.Mesh(
    new THREE.CylinderGeometry(4.45, 4.45, 9.2, 24),
    chamberProjectileBlockerMaterial
  );
  chamberProjectileBlocker.position.y = GROUND_Y + 5.15;
  chamberProjectileBlocker.visible = true;
  let chamberProjectileBlockingEnabled = true;
  const chamberProjectileBlockerRaycast =
    chamberProjectileBlocker.raycast.bind(chamberProjectileBlocker);
  chamberProjectileBlocker.raycast = (raycaster, intersects) => {
    if (!chamberProjectileBlockingEnabled) return;
    chamberProjectileBlockerRaycast(raycaster, intersects);
  };
  chamber.add(chamberProjectileBlocker);

  type ContainmentMaterialState = {
    material: THREE.Material;
    baseOpacity: number;
    baseTransparent: boolean;
    baseDepthWrite: boolean;
  };

  const containmentMaterialStates: ContainmentMaterialState[] = [];
  const containmentMaterialSet = new Set<THREE.Material>();
  containmentShellGroup.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (let i = 0; i < materials.length; i += 1) {
      const material = materials[i];
      if (!material || containmentMaterialSet.has(material)) continue;
      containmentMaterialSet.add(material);
      containmentMaterialStates.push({
        material,
        baseOpacity: material.opacity,
        baseTransparent: material.transparent,
        baseDepthWrite: material.depthWrite,
      });
    }
  });

  const setContainmentShellAlpha = (alpha: number) => {
    const resolvedAlpha = clamp(alpha, 0, 1);
    containmentShellGroup.visible = resolvedAlpha > 0.001;
    for (let i = 0; i < containmentMaterialStates.length; i += 1) {
      const entry = containmentMaterialStates[i];
      const nextOpacity = entry.baseOpacity * resolvedAlpha;
      const nextTransparent =
        entry.baseTransparent || resolvedAlpha < 0.999;
      const nextDepthWrite = nextOpacity > 0.02 ? entry.baseDepthWrite : false;
      const opacityChanged = Math.abs(entry.material.opacity - nextOpacity) > 0.001;
      const transparentChanged =
        entry.material.transparent !== nextTransparent;
      const depthWriteChanged = entry.material.depthWrite !== nextDepthWrite;
      entry.material.opacity = nextOpacity;
      entry.material.transparent = nextTransparent;
      entry.material.depthWrite = nextDepthWrite;
      if (opacityChanged || transparentChanged || depthWriteChanged) {
        entry.material.needsUpdate = true;
      }
    }
  };

  setContainmentShellAlpha(1);

  const breachSmokeGroup = new THREE.Group();
  breachSmokeGroup.visible = false;
  fxGroup.add(breachSmokeGroup);
  trackObject(breachSmokeGroup);

  const breachSmokePuffs = Array.from({ length: 52 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0x050505,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 12),
      material
    );
    breachSmokeGroup.add(mesh);
    return {
      mesh,
      material,
      radius: 5 + (index % 8) * 2.8 + Math.random() * 1.4,
      angle: (index / 52) * Math.PI * 2 + Math.random() * 0.65,
      height: 1 + Math.random() * 8.2,
      drift: (Math.random() - 0.5) * 3.8,
      phase: Math.random() * Math.PI * 2,
      scale: 4.2 + Math.random() * 6.4,
    };
  });

  registerAnimator((now, delta) => {
    const pulse = 0.72 + (0.5 + 0.5 * Math.sin(now * 0.0022)) * 0.25 + shieldPulse * 0.12;
    platformRing.scale.setScalar(pulse);
    topCap.rotation.z += delta * 0.6;
    middleBand.rotation.z -= delta * 0.35;
    shell.scale.setScalar(1 + shieldPulse * 0.04);

    const storyTimeline = getStoryTimelineState(now);
    const breachTimeline = storyTimeline.breachTimeline;
    const isActivationBlackSmokePeriod =
      breachSequenceStarted &&
      breachTimeline.hasBigSmokeStarted &&
      !breachTimeline.hasBigSmokeEnded;
    if (isActivationBlackSmokePeriod) {
      removeActivationObstacles();
    }
    if (breachTimeline.shouldReleaseContainment) {
      releaseMadaContainment(now);
    }
    storyModeActive = breachSequenceStarted && !storyTimeline.isSequenceComplete;
    madaHasVanished =
      breachSequenceStarted &&
      breachTimeline.isSequenceComplete &&
      storyTimeline.reappearProgress <= 0.001 &&
      !storyTimeline.isSequenceComplete;

    if (formalBattleStarted) {
      madaPresentation.applyState({
        mode: "active",
        fadeAlpha: 1,
      });
    } else if (storyTimeline.isInitialBreachActive) {
      const madaFadeAlpha =
        breachSequenceStarted && breachTimeline.elapsedMs >= BREACH_FADE_START_MS
          ? 1 - breachTimeline.fadeProgress
          : 1;
      madaPresentation.applyState(
        resolveMadaPresentationState({
          activated: madaActivated,
          breachSequenceStarted,
          containmentReleased,
          hasVanished: false,
          fadeAlpha: madaFadeAlpha,
        })
      );
    } else if (storyTimeline.isSequenceComplete) {
      madaPresentation.applyState({
        mode: "active",
        fadeAlpha: 1,
      });
    } else if (storyTimeline.reappearProgress > 0.001) {
      madaPresentation.applyState({
        mode: storyTimeline.reappearProgress >= 0.999 ? "active" : "vanishing",
        fadeAlpha: storyTimeline.reappearProgress,
      });
    } else {
      madaPresentation.applyState({
        mode: "vanished",
        fadeAlpha: 0,
      });
    }

    const introSmokeOpacity = breachTimeline.introSmokeOpacity;
    const bigSmokeOpacity = breachTimeline.bigSmokeOpacity;
    const smokeOcclusion = Math.max(
      introSmokeOpacity * 0.18,
      bigSmokeOpacity * 0.42
    );
    const breachPulse = breachSequenceStarted
      ? 0.68 +
        (0.5 + 0.5 * Math.sin(now * 0.00864)) * 0.22 +
        bigSmokeOpacity * 0.24
      : 0;
    ambient.color.copy(ambientBaseColor).lerp(ambientAlarmColor, breachPulse * 0.54);
    breachAlarmLight.intensity = breachPulse * 28;
    breachAlarmLight.distance = 88 + breachPulse * 18;
    sceneBackgroundColor
      .copy(sceneBaseColor)
      .lerp(sceneSmokeColor, smokeOcclusion * 0.72);
    sceneFog.color.copy(sceneBaseColor).lerp(sceneSmokeColor, smokeOcclusion * 0.72);
    sceneFog.near = THREE.MathUtils.lerp(baseFogNear, 18, smokeOcclusion);
    sceneFog.far = THREE.MathUtils.lerp(baseFogFar, 62, smokeOcclusion);

    const activeSmokeOpacity = Math.max(introSmokeOpacity, bigSmokeOpacity);
    const isBigSmokeActive = bigSmokeOpacity >= introSmokeOpacity;
    breachSmokeGroup.visible = breachSequenceStarted && activeSmokeOpacity > 0.01;
    for (let i = 0; i < breachSmokePuffs.length; i += 1) {
      const puff = breachSmokePuffs[i];
      if (!breachSmokeGroup.visible) {
        puff.material.opacity = 0;
        continue;
      }

      const swirl = now * (isBigSmokeActive ? 0.00074 : 0.00105) + puff.phase;
      if (isBigSmokeActive) {
        const spikeWave =
          breachTimeline.bigSmokeDissipateProgress > 0
            ? 0.22 +
              0.78 *
                Math.pow(
                  0.5 +
                    0.5 *
                      Math.sin(
                        puff.angle * 6 +
                          puff.phase * 1.7 +
                          now * 0.0034 +
                          breachTimeline.bigSmokeDissipateProgress * 15
                      ),
                  5
                )
            : 1;
        const radius =
          1.5 +
          puff.radius *
            (0.26 + breachTimeline.bigSmokeExpandProgress * 0.95) +
          breachTimeline.bigSmokeDissipateProgress * (5 + spikeWave * 9);
        puff.mesh.position.set(
          breachBigSmokeAnchor.x +
            Math.cos(puff.angle + swirl * 0.86) * radius +
            puff.drift *
              (0.24 +
                breachTimeline.bigSmokeExpandProgress * 1.9 +
                breachTimeline.bigSmokeDissipateProgress * 0.7),
          breachBigSmokeAnchor.y +
            puff.height * (0.2 + breachTimeline.bigSmokeExpandProgress * 0.58) +
            breachTimeline.bigSmokeDissipateProgress * (1.4 + spikeWave * 2.4),
          breachBigSmokeAnchor.z +
            Math.sin(puff.angle + swirl) * radius * (0.9 + spikeWave * 0.12)
        );
        puff.mesh.scale.setScalar(
          (1.2 +
            puff.scale * 0.34 +
            bigSmokeOpacity * 6.6 +
            breachTimeline.bigSmokeExpandProgress * 8.4) *
            (breachTimeline.bigSmokeDissipateProgress > 0
              ? 0.56 + spikeWave * 0.82
              : 1)
        );
        puff.material.opacity = THREE.MathUtils.clamp(
          0.88 *
            bigSmokeOpacity *
            (breachTimeline.bigSmokeDissipateProgress > 0
              ? 0.26 + spikeWave * 0.74
              : 1),
          0,
          0.88
        );
      } else {
        const introWave = 0.68 + (0.5 + 0.5 * Math.sin(now * 0.004 + puff.phase)) * 0.32;
        const radius = 0.9 + puff.radius * 0.18 + introSmokeOpacity * 2.1;
        puff.mesh.position.set(
          breachIntroSmokeAnchor.x +
            Math.cos(puff.angle + swirl * 0.72) * radius +
            puff.drift * 0.2,
          breachIntroSmokeAnchor.y -
            1 +
            puff.height * 0.18 +
            introSmokeOpacity * 1.9,
          breachIntroSmokeAnchor.z +
            Math.sin(puff.angle + swirl) * radius * 0.8
        );
        puff.mesh.scale.setScalar(
          0.8 + puff.scale * 0.16 + introSmokeOpacity * 2.5
        );
        puff.material.opacity = THREE.MathUtils.clamp(
          0.58 * introSmokeOpacity * introWave,
          0,
          0.58
        );
      }
    }
  });

  labGroup.add(chamber);
  trackObject(chamber);
  const chamberCollider = addCollider(0, -12, 11.2, 11.2, 0.85);

  const madaRig = new THREE.Group();
  madaRig.position.set(
    0,
    MADA_GROUND_Y + MADA_CONTAINMENT_BASE_LIFT + MADA_PRE_SMOKE_EXTRA_LIFT,
    -12
  );
  const madaModelRoot = new THREE.Group();
  madaRig.add(madaModelRoot);
  labGroup.add(madaRig);
  madaRig.rotation.y = 0;

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
  const setMadaActivated = (active: boolean) => {
    if (madaActivated === active) return;
    madaActivated = active;
  };

  const resolveContainedIdleMadaY = (now: number) =>
    MADA_GROUND_Y +
    MADA_CONTAINMENT_BASE_LIFT +
    MADA_PRE_SMOKE_EXTRA_LIFT +
    Math.sin(now * 0.0012) * 0.08 +
    shieldPulse * 0.05;

  const applyMadaGravity = (delta: number) => {
    if (!Number.isFinite(delta) || delta <= 0) return;
    madaVerticalVelocity = Math.max(
      MADA_MAX_FALL_SPEED,
      madaVerticalVelocity + MADA_GRAVITY * delta
    );
    madaRig.position.y += madaVerticalVelocity * delta;
    if (madaRig.position.y <= MADA_GROUND_Y) {
      madaRig.position.y = MADA_GROUND_Y;
      madaVerticalVelocity = 0;
    }
  };

  const configureBreachCutscene = (playerPosition: THREE.Vector3) => {
    breachCutscenePlayerPosition.copy(playerPosition);
    breachStoryPlayerPosition.copy(playerPosition);
    const toMadaX = madaRig.position.x - playerPosition.x;
    const toMadaZ = madaRig.position.z - playerPosition.z;
    const horizontalDistance = Math.max(0.001, Math.hypot(toMadaX, toMadaZ));
    breachFocusYaw = Math.atan2(toMadaX, toMadaZ);
    breachFocusPitch = clamp(
      Math.atan2(GROUND_Y + 3.25 - (playerPosition.y + 1.6), horizontalDistance),
      -0.2,
      0.18
    );
    breachForwardDirection.set(
      Math.sin(breachFocusYaw),
      0,
      Math.cos(breachFocusYaw)
    );
    breachRightDirection.set(
      Math.cos(breachFocusYaw),
      0,
      -Math.sin(breachFocusYaw)
    );
    breachWalkEndPosition
      .copy(playerPosition)
      .addScaledVector(breachForwardDirection, AMBUSH_WALK_DISTANCE);
    breachWalkEndPosition.y = playerPosition.y;
    breachBackstepTargetPosition
      .copy(breachWalkEndPosition)
      .addScaledVector(breachForwardDirection, AMBUSH_BACKSTEP_DISTANCE);
    breachBackstepTargetPosition.y = playerPosition.y;
    breachAmbushPosition
      .copy(breachWalkEndPosition)
      .addScaledVector(breachForwardDirection, -AMBUSH_BEHIND_DISTANCE)
      .addScaledVector(breachRightDirection, AMBUSH_SIDE_OFFSET);
    breachAmbushPosition.y = MADA_GROUND_Y;
    breachRetreatDirection
      .copy(breachBackstepTargetPosition)
      .sub(breachAmbushPosition)
      .setY(0);
    if (breachRetreatDirection.lengthSq() <= 0.0001) {
      breachRetreatDirection.copy(breachForwardDirection).multiplyScalar(-1);
    } else {
      breachRetreatDirection.normalize();
    }
    breachRetreatTargetPosition
      .copy(breachBackstepTargetPosition)
      .addScaledVector(breachRetreatDirection, AMBUSH_PLAYER_RETREAT_DISTANCE);
    breachRetreatTargetPosition.y = playerPosition.y;
    breachIntroSmokeAnchor.set(madaRig.position.x, GROUND_Y + 3.2, madaRig.position.z);
    breachBigSmokeAnchor.copy(playerPosition);
    const forwardDistance = Math.min(15.5, horizontalDistance * 0.5);
    breachBigSmokeAnchor.x += Math.sin(breachFocusYaw) * forwardDistance;
    breachBigSmokeAnchor.y = GROUND_Y + 2.85;
    breachBigSmokeAnchor.z += Math.cos(breachFocusYaw) * forwardDistance;
  };

  const releaseMadaContainment = (now: number) => {
    if (containmentReleased) return;
    containmentReleased = true;
    chamber.visible = false;
    chamberProjectileBlockingEnabled = false;
    setContainmentShellAlpha(0);
    chamberCollider.enabled = false;
    setMadaActivated(true);
    shieldPulse = Math.max(shieldPulse, 1.25);
    if (!breachAftermathSpawned) {
      breachAftermathSpawned = true;
      spawnBreachAftermathPuddles();
    }
    emitState(true, now);
  };

  const resolveBreachLookOverride = (now: number) => {
    if (!breachSequenceStarted || formalBattleStarted) return null;
    const storyTimeline = getStoryTimelineState(now);
    if (storyTimeline.isSequenceComplete) return null;

    const timeline = storyTimeline.breachTimeline;
    const leftLookOffset = 0.48;
    let yaw = breachFocusYaw;
    let pitch = breachFocusPitch;

    resolveStoryPlayerPosition(now, breachStoryPlayerPosition);

    if (storyTimeline.isInitialBreachActive && timeline.elapsedMs < BREACH_INTRO_SMOKE_DURATION_MS) {
      return { yaw, pitch, blend: 0.11 };
    }

    if (storyTimeline.isInitialBreachActive && timeline.isLookingAround) {
      const lookElapsed = timeline.elapsedMs - BREACH_INTRO_SMOKE_DURATION_MS;
      if (lookElapsed < BREACH_LOOK_LEFT_DURATION_MS) {
        yaw = THREE.MathUtils.lerp(
          breachFocusYaw,
          breachFocusYaw - leftLookOffset,
          easeInOut(lookElapsed / BREACH_LOOK_LEFT_DURATION_MS)
        );
        pitch = breachFocusPitch + 0.015;
      } else if (
        lookElapsed <
        BREACH_LOOK_LEFT_DURATION_MS + BREACH_LOOK_RIGHT_DURATION_MS
      ) {
        const segmentElapsed = lookElapsed - BREACH_LOOK_LEFT_DURATION_MS;
        yaw = THREE.MathUtils.lerp(
          breachFocusYaw - leftLookOffset,
          breachFocusYaw + leftLookOffset,
          easeInOut(segmentElapsed / BREACH_LOOK_RIGHT_DURATION_MS)
        );
        pitch = breachFocusPitch + 0.02;
      } else {
        const segmentElapsed =
          lookElapsed -
          BREACH_LOOK_LEFT_DURATION_MS -
          BREACH_LOOK_RIGHT_DURATION_MS;
        yaw = THREE.MathUtils.lerp(
          breachFocusYaw + leftLookOffset,
          breachFocusYaw,
          easeInOut(segmentElapsed / BREACH_LOOK_RETURN_DURATION_MS)
        );
        pitch = breachFocusPitch + 0.01;
      }
      return { yaw, pitch, blend: 0.12 };
    }

    if (storyTimeline.isInitialBreachActive && !timeline.hasBigSmokeEnded) {
      return { yaw, pitch, blend: 0.1 };
    }

    if (storyTimeline.isInitialBreachActive) {
      resolveStoryMadaPosition(now, breachStoryMadaPosition);
      breachLookTarget.set(
        breachStoryMadaPosition.x,
        breachStoryMadaPosition.y + 1.7,
        breachStoryMadaPosition.z
      );
      const toTargetX = breachLookTarget.x - breachCutscenePlayerPosition.x;
      const toTargetZ = breachLookTarget.z - breachCutscenePlayerPosition.z;
      const horizontalDistance = Math.max(0.001, Math.hypot(toTargetX, toTargetZ));
      yaw = Math.atan2(toTargetX, toTargetZ);
      pitch = clamp(
        Math.atan2(
          breachLookTarget.y - (breachCutscenePlayerPosition.y + 1.6),
          horizontalDistance
        ),
        -0.22,
        0.24
      );
      return { yaw, pitch, blend: 0.09 };
    }

    if (storyTimeline.isWalkPhase) {
      return {
        yaw: breachFocusYaw,
        pitch: clamp(breachFocusPitch * 0.45, -0.08, 0.08),
        blend: 0.12,
      };
    }

    if (storyTimeline.isLookPhase) {
      if (storyTimeline.lookLeftProgress < 1) {
        yaw = lerpAngle(
          breachFocusYaw,
          breachFocusYaw - 0.42,
          storyTimeline.lookLeftProgress
        );
        pitch = 0.04;
      } else {
        yaw = lerpAngle(
          breachFocusYaw - 0.42,
          breachFocusYaw + 0.5,
          storyTimeline.lookRightProgress
        );
        pitch = 0.05;
      }
      return { yaw, pitch, blend: 0.12 };
    }

    resolveStoryMadaPosition(now, breachStoryMadaPosition);
    breachLookTarget.set(
      breachStoryMadaPosition.x,
      breachStoryMadaPosition.y + 1.6,
      breachStoryMadaPosition.z
    );
    const toTargetX = breachLookTarget.x - breachStoryPlayerPosition.x;
    const toTargetZ = breachLookTarget.z - breachStoryPlayerPosition.z;
    const horizontalDistance = Math.max(0.001, Math.hypot(toTargetX, toTargetZ));
    const targetYaw = Math.atan2(toTargetX, toTargetZ);
    const targetPitch = clamp(
      Math.atan2(
        breachLookTarget.y - (breachStoryPlayerPosition.y + 1.6),
        horizontalDistance
      ),
      -0.22,
      0.24
    );

    if (storyTimeline.isRevealTurnPhase) {
      return {
        yaw: lerpAngle(
          breachFocusYaw + 0.5,
          targetYaw,
          storyTimeline.revealTurnProgress
        ),
        pitch: THREE.MathUtils.lerp(0.05, targetPitch, storyTimeline.revealTurnProgress),
        blend: 0.3,
      };
    }

    return {
      yaw: targetYaw,
      pitch: targetPitch,
      blend:
        storyTimeline.isDiscoveryPhase ||
        storyTimeline.isGrabWindupPhase ||
        storyTimeline.isGrabStrikePhase ||
        storyTimeline.isGrabRecoverPhase
          ? 0.42
          : 0.28,
    };
  };

  const destroyTerminal = (now: number) => {
    if (terminalDestroyed) return;
    terminalDestroyed = true;
    breachPendingTunnelExit = true;
    terminalInRange = false;
    terminalExplosionStartedAt = 0;
    terminalCollider.enabled = false;
    emitState(true, now);
  };

  const startContainmentBreach = (now: number, playerPosition: THREE.Vector3) => {
    if (breachSequenceStarted) return;
    breachSequenceStarted = true;
    breachSequenceStartedAt = now;
    breachSequenceElapsedMs = 0;
    breachSequenceClockNow = now;
    breachPendingTunnelExit = false;
    breachAftermathSpawned = false;
    containmentReleased = false;
    storyModeActive = true;
    madaHasVanished = false;
    formalBattleStarted = false;
    madaVerticalVelocity = 0;
    madaGrabDamageApplied = false;
    madaSkill1StartedAt = -1;
    madaSkill1NextAvailableAt = 0;
    madaSkill1DamageApplied = false;
    chamber.visible = true;
    chamberProjectileBlockingEnabled = true;
    setContainmentShellAlpha(1);
    chamberCollider.enabled = true;
    setMadaActivated(false);
    shieldPulse = Math.max(shieldPulse, 0.9);
    configureBreachCutscene(playerPosition);
    madaAnimation.resetPose();
    madaPresentation.applyState(
      resolveMadaPresentationState({
        activated: false,
        breachSequenceStarted: true,
        containmentReleased: false,
        hasVanished: false,
      })
    );
    emitState(true, now);
  };

  const handleTerminalUnlock = (event: Event) => {
    const customEvent = event as CustomEvent<{ code?: string }>;
    if (customEvent.detail?.code !== "1986") return;
    destroyTerminal(performance.now());
  };

  if (typeof window !== "undefined") {
    window.addEventListener(
      MADA_TERMINAL_UNLOCK_EVENT,
      handleTerminalUnlock as EventListener
    );
  }

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
      const modelBounds = resolveRenderableBounds(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      modelBounds.getSize(size);
      const targetHeight = 5.6;
      const height = Math.max(0.001, size.y);
      model.scale.setScalar(targetHeight / height);
      model.updateMatrixWorld(true);

      const normalizedBounds = resolveRenderableBounds(model);
      normalizedBounds.getCenter(center);
      model.position.set(-center.x, -normalizedBounds.min.y, -center.z);
      model.updateMatrixWorld(true);

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

  const specimenFocus = new THREE.Vector3();
  const madaHeadLookTarget = new THREE.Vector3();
  const madaGrabOrigin = new THREE.Vector3();
  const madaGrabTarget = new THREE.Vector3();
  const madaGrabDirection = new THREE.Vector3();
  const madaSkill1Direction = new THREE.Vector3();
  const madaAttackTarget: PlayerAttackTarget = {
    id: "madaSubject",
    object: madaRig,
    category: "boss",
    label: "Mada Subject",
    isActive: () =>
      madaActivated && madaHealth > 0 && !storyModeActive && !madaHasVanished,
    getHealth: () => madaHealth,
    getMaxHealth: () => MADA_MAX_HEALTH,
    onHit: (hit) => {
      if (!madaActivated || madaHealth <= 0 || storyModeActive || madaHasVanished) {
        return;
      }
      setMadaActivated(true);
      madaPresentation.triggerHitFlash(hit.now);
      madaHealth = Math.max(0, madaHealth - Math.max(1, Math.floor(hit.damage)));
      shieldPulse = Math.min(1.4, shieldPulse + 0.55);
      emitState(true, hit.now);
    },
  };
  attackTargets.push(madaAttackTarget);

  const worldTick = ({
    now,
    delta,
    player,
    applyDamage,
  }: PlayerWorldTickArgs) => {
    const effectiveDelta = delta;

    shieldPulse = Math.max(0, shieldPulse - effectiveDelta * 1.5);

    for (let i = 0; i < animators.length; i += 1) {
      animators[i](now, effectiveDelta);
    }

    player.getWorldPosition(playerWorldPosition);
    const playerInsideTunnel = playerWorldPosition.z > tunnelExitThresholdZ;
    terminalInRange =
      !terminalDestroyed &&
      playerWorldPosition.distanceTo(terminalAnchor) <= terminalInteractionRadius;

    if (
      breachPendingTunnelExit &&
      playerWasInsideTunnel &&
      !playerInsideTunnel
    ) {
      startContainmentBreach(now, playerWorldPosition);
    }
    playerWasInsideTunnel = playerInsideTunnel;

    const storyTimeline = getStoryTimelineState(now);
    const breachTimeline = storyTimeline.breachTimeline;
    const breachActive =
      breachSequenceStarted && (!madaHasVanished || storyTimeline.hasMadaReappeared);

    electricActivity = breachActive
      ? 94 + (0.5 + 0.5 * Math.sin(now * 0.011)) * 6 + shieldPulse * 12
      : 60 +
        12 * (0.5 + 0.5 * Math.sin(now * 0.0024)) +
        shieldPulse * 20 +
        (madaHealth <= MADA_MAX_HEALTH * 0.35 ? 8 : 0);

    if (storyModeActive) {
      resolveStoryPlayerPosition(now, breachStoryPlayerPosition);
      player.position.copy(breachStoryPlayerPosition);
    } else {
      breachStoryPlayerPosition.copy(playerWorldPosition);
    }

    if (breachSequenceStarted && !formalBattleStarted) {
      resolveStoryMadaPosition(now, breachStoryMadaPosition);
      madaRig.position.copy(breachStoryMadaPosition);
      madaVerticalVelocity = 0;
    } else if (!breachSequenceStarted && !madaActivated) {
      madaRig.position.y = resolveContainedIdleMadaY(now);
      madaVerticalVelocity = 0;
    } else {
      applyMadaGravity(effectiveDelta);
    }

    let madaSkill1State = getMadaSkill1State(now);
    if (
      formalBattleStarted &&
      madaActivated &&
      madaHealth > 0 &&
      !storyModeActive &&
      !madaSkill1State.active &&
      now >= madaSkill1NextAvailableAt
    ) {
      player.getWorldPosition(specimenFocus);
      madaSkill1Direction
        .copy(specimenFocus)
        .sub(madaRig.position)
        .setY(0);
      if (madaSkill1Direction.length() <= MADA_SKILL1_TRIGGER_RANGE) {
        madaSkill1StartedAt = now;
        madaSkill1NextAvailableAt = now + MADA_SKILL1_COOLDOWN_MS;
        madaSkill1DamageApplied = false;
        madaSkill1State = getMadaSkill1State(now);
      }
    }

    const ambushCrawlActive =
      storyModeActive &&
      storyTimeline.hasMadaReappeared &&
      !storyTimeline.isSequenceComplete;
    madaAnimation.setCrawlEnabled(ambushCrawlActive);

    if (madaSkill1State.active) {
      madaAnimation.applyGrabAnimation({
        revealProgress: 1,
        windupProgress: madaSkill1State.windupProgress,
        strikeProgress: madaSkill1State.strikeProgress,
        recoverProgress: madaSkill1State.recoverProgress,
      });
    } else if (!ambushCrawlActive) {
      madaAnimation.resetPose();
    }
    madaAnimation.update(effectiveDelta);

    if (madaHealth > 0 && (!madaHasVanished || storyTimeline.hasMadaReappeared)) {
      if (breachSequenceStarted && !formalBattleStarted) {
        if (containmentReleased && !storyTimeline.isSequenceComplete) {
          faceObjectTowardTargetOnYaw(madaRig, breachStoryPlayerPosition);
          madaHeadLookTarget.copy(breachStoryPlayerPosition);
          madaHeadLookTarget.y += 1.45;
        } else {
          madaRig.rotation.y = 0;
          madaHeadLookTarget.set(0, 0, 0);
        }
      } else if (madaActivated) {
        player.getWorldPosition(specimenFocus);
        faceObjectTowardTargetOnYaw(madaRig, specimenFocus);
        madaHeadLookTarget.copy(specimenFocus);
        madaHeadLookTarget.y += 1.45;
      } else {
        madaRig.rotation.y = 0;
        madaHeadLookTarget.set(0, 0, 0);
      }
      madaAnimation.applyHeadLook(
        madaHeadLookTarget.lengthSq() > 0.0001 ? madaHeadLookTarget : null
      );
    } else if (!madaHasVanished) {
      madaRig.rotation.y += effectiveDelta * 0.35;
      madaAnimation.applyHeadLook(null);
    } else {
      madaAnimation.applyHeadLook(null);
    }

    if (
      storyModeActive &&
      !madaGrabDamageApplied &&
      storyTimeline.elapsedMs >= AMBUSH_GRAB_WINDUP_END_MS
    ) {
      resolveStoryPlayerPosition(now, breachStoryPlayerPosition);
      madaRig.updateMatrixWorld(true);
      madaAnimation.getRightClawWorldPosition(madaGrabOrigin);
      const hasReferenceTarget =
        madaAnimation.getGrabReferenceWorldPosition(madaGrabTarget);
      specimenFocus.copy(breachStoryPlayerPosition);
      specimenFocus.y += 1.25;
      const clawToPlayerDistance = madaGrabOrigin.distanceTo(specimenFocus);
      const referenceToPlayerDistance = hasReferenceTarget
        ? madaGrabTarget.distanceTo(specimenFocus)
        : Infinity;
      if (clawToPlayerDistance <= 1.05 && referenceToPlayerDistance <= 0.8) {
        applyDamage(AMBUSH_GRAB_DAMAGE);
      }
      madaGrabDamageApplied = true;
    }

    if (
      formalBattleStarted &&
      madaSkill1State.active &&
      !madaSkill1DamageApplied &&
      madaSkill1State.elapsedMs >= MADA_SKILL1_WINDUP_DURATION_MS
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
      madaSkill1DamageApplied = true;
    }

    if (!madaSkill1State.active && madaSkill1StartedAt >= 0) {
      madaSkill1StartedAt = -1;
      madaSkill1DamageApplied = false;
    }

    if (
      breachSequenceStarted &&
      !formalBattleStarted &&
      storyTimeline.isSequenceComplete
    ) {
      formalBattleStarted = true;
      storyModeActive = false;
      madaHasVanished = false;
      madaSkill1StartedAt = -1;
      madaSkill1NextAvailableAt = now + 700;
      madaSkill1DamageApplied = false;
      setMadaActivated(true);
      emitState(true, now);
    }

    emitState(false, now);
  };

  const world: PlayerWorld = {
    sceneId: "madaLab",
    groundY: GROUND_Y,
    playerSpawn: new THREE.Vector3(0, GROUND_Y, 28),
    bounds: playableBounds,
    projectileColliders: [solidGroup, chamberProjectileBlocker],
    attackTargets,
    isInputLocked: () => storyModeActive,
    isMiniMapVisible: () => !storyModeActive,
    getLookOverride: (now) => resolveBreachLookOverride(now),
    isBlocked: (x, z) => {
      if (
        x < playableBounds.minX ||
        x > playableBounds.maxX ||
        z < playableBounds.minZ ||
        z > playableBounds.maxZ
      ) {
        return true;
      }
      if (z > bounds.maxZ && Math.abs(x) > tunnelWidth / 2 - 0.18) {
        return true;
      }
      for (let i = 0; i < colliders.length; i += 1) {
        const collider = colliders[i];
        if (collider.enabled === false) continue;
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
    onTick: worldTick,
  };

  emitState(true);

  const dispose = () => {
    isDisposed = true;
    if (typeof window !== "undefined") {
      window.removeEventListener(
        MADA_TERMINAL_UNLOCK_EVENT,
        handleTerminalUnlock as EventListener
      );
    }
    context?.onStateChange?.({});
    scene.remove(ambient);
    scene.remove(breachAlarmLight);
    attackTargets.length = 0;
    scene.remove(labGroup);
    disposeTrackedResources();
  };

  return { world, dispose };
};
