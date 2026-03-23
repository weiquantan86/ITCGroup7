import * as THREE from "three";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../../../asset/entity/character/general/player";
import { createUnifiedMonsterRuntime } from "../../../asset/entity/monster/unified/registry";
import type { UnifiedMonsterRuntime } from "../../../asset/entity/monster/unified/types";
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

type BoxCollider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  enabled?: boolean;
};

const GROUND_Y = -1.4;
const ROOM_WIDTH = 92;
const ROOM_DEPTH = 70;
const ROOM_HEIGHT = 18;
const UI_EMIT_INTERVAL_MS = 140;
const TERMINAL_INTERACTION_RADIUS = 2.1;

export type MadaLabDifficultyConfig = {
  battleMultiplier?: number;
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const normalizePositiveMultiplier = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const createStateSnapshotKey = (state: MadaLabState) =>
  [
    state.madaHealth,
    state.madaMaxHealth,
    state.containmentIntegrity,
    state.electricActivity,
    state.fluidPatches,
    state.circuitBreaks,
    state.statusLabel,
    state.terminalInRange ? 1 : 0,
  ].join("|");

export const createMadaLabScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext,
  difficultyConfig?: MadaLabDifficultyConfig
): SceneSetupResult => {
  const battleMultiplier = normalizePositiveMultiplier(
    difficultyConfig?.battleMultiplier,
    1
  );
  scene.background = new THREE.Color(0x030910);
  scene.fog = new THREE.Fog(0x030910, 36, 126);

  const resourceTracker = createSceneResourceTracker();
  const { trackMesh, disposeTrackedResources } = resourceTracker;

  const bounds = {
    minX: -ROOM_WIDTH / 2 + 3,
    maxX: ROOM_WIDTH / 2 - 3,
    minZ: -ROOM_DEPTH / 2 + 3,
    maxZ: ROOM_DEPTH / 2 - 3,
  };

  const colliders: BoxCollider[] = [];
  const attackTargets: PlayerAttackTarget[] = [];

  const labGroup = new THREE.Group();
  labGroup.name = "madaLab";
  scene.add(labGroup);

  const solidGroup = new THREE.Group();
  solidGroup.name = "madaLabSolid";
  labGroup.add(solidGroup);

  const runtimeHostGroup = new THREE.Group();
  runtimeHostGroup.name = "madaLabMonsterRuntimeHost";
  labGroup.add(runtimeHostGroup);

  const ambient = new THREE.AmbientLight(0xd9f2ff, 0.76);
  const hemi = new THREE.HemisphereLight(0xa9ddff, 0x0a1118, 0.52);
  const key = new THREE.DirectionalLight(0xffffff, 0.84);
  key.position.set(-12, 20, 16);
  const fill = new THREE.DirectionalLight(0x8fb8ff, 0.38);
  fill.position.set(13, 11, -9);
  scene.add(ambient, hemi, key, fill);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
      metalness: 0.08,
      emissive: 0x020617,
      emissiveIntensity: 0.25,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = GROUND_Y;
  floor.receiveShadow = true;
  solidGroup.add(floor);
  trackMesh(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.2,
    emissive: 0x0f172a,
    emissiveIntensity: 0.18,
  });
  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_WIDTH, ROOM_HEIGHT, 1.4),
    wallMaterial
  );
  northWall.position.set(0, GROUND_Y + ROOM_HEIGHT / 2, bounds.minZ - 1);
  solidGroup.add(northWall);
  trackMesh(northWall);

  const southWall = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_WIDTH, ROOM_HEIGHT, 1.4),
    wallMaterial
  );
  southWall.position.set(0, GROUND_Y + ROOM_HEIGHT / 2, bounds.maxZ + 1);
  solidGroup.add(southWall);
  trackMesh(southWall);

  const westWall = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, ROOM_HEIGHT, ROOM_DEPTH),
    wallMaterial
  );
  westWall.position.set(bounds.minX - 1, GROUND_Y + ROOM_HEIGHT / 2, 0);
  solidGroup.add(westWall);
  trackMesh(westWall);

  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, ROOM_HEIGHT, ROOM_DEPTH),
    wallMaterial
  );
  eastWall.position.set(bounds.maxX + 1, GROUND_Y + ROOM_HEIGHT / 2, 0);
  solidGroup.add(eastWall);
  trackMesh(eastWall);

  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.6,
    metalness: 0.28,
  });
  const pillarOffsets: Array<[number, number]> = [
    [-18, -18],
    [18, -18],
    [-18, 18],
    [18, 18],
  ];
  for (let i = 0; i < pillarOffsets.length; i += 1) {
    const [x, z] = pillarOffsets[i];
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(5, 9, 5),
      pillarMaterial
    );
    pillar.position.set(x, GROUND_Y + 4.5, z);
    solidGroup.add(pillar);
    trackMesh(pillar);
    colliders.push({
      minX: x - 2.8,
      maxX: x + 2.8,
      minZ: z - 2.8,
      maxZ: z + 2.8,
      enabled: true,
    });
  }

  const terminalAnchor = new THREE.Vector3(0, GROUND_Y + 1.25, bounds.maxZ - 6.2);
  const terminalBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 2.4, 1.4),
    new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      roughness: 0.4,
      metalness: 0.36,
      emissive: 0x164e63,
      emissiveIntensity: 0.3,
    })
  );
  terminalBody.position.copy(terminalAnchor);
  solidGroup.add(terminalBody);
  trackMesh(terminalBody);
  colliders.push({
    minX: terminalAnchor.x - 1.4,
    maxX: terminalAnchor.x + 1.4,
    minZ: terminalAnchor.z - 1.1,
    maxZ: terminalAnchor.z + 1.1,
    enabled: true,
  });

  const terminalRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.2, 36),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.26,
    })
  );
  terminalRing.rotation.x = -Math.PI / 2;
  terminalRing.position.set(terminalAnchor.x, GROUND_Y + 0.02, terminalAnchor.z);
  solidGroup.add(terminalRing);
  trackMesh(terminalRing);

  const monsterSpawn = new THREE.Vector3(0, GROUND_Y, -8);
  let terminalUnlocked = false;
  let terminalInRange = false;
  let nextUiEmitAt = 0;
  let lastStateKey = "";
  let monsterRuntime: UnifiedMonsterRuntime | null = null;
  const playerWorldPosition = new THREE.Vector3();

  const createMonsterRuntime = () => {
    if (monsterRuntime) return;
    monsterRuntime = createUnifiedMonsterRuntime({
      scene,
      hostGroup: runtimeHostGroup,
      resourceTracker,
      monster: {
        id: "mada",
        label: "Mada Subject",
        path: "/assets/monsters/mada/mada.glb",
      },
      groundY: GROUND_Y,
      spawnPosition: monsterSpawn.clone(),
      bounds,
      isBlocked: (x, z) =>
        x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ,
      attackTargets,
      runtimeOptions: {
        respawnOnDefeat: false,
        mada: {
          healthMultiplier: battleMultiplier,
          damageMultiplier: battleMultiplier,
          tempoMultiplier: battleMultiplier,
          triggerRangeMultiplier: battleMultiplier,
          strikeRangeMultiplier: battleMultiplier,
        },
      },
    });
  };

  const resolveStatusLabel = (healthRatio: number) => {
    if (!terminalUnlocked) {
      return terminalInRange
        ? "Terminal ready - enter authorization"
        : "Containment stabilizing";
    }
    if (healthRatio <= 0) {
      return "Subject neutralized";
    }
    if (healthRatio <= 0.25) {
      return "Containment collapse risk";
    }
    if (healthRatio <= 0.55) {
      return "Containment breach escalating";
    }
    return "Containment breach active";
  };

  const buildUiState = (): MadaLabState => {
    const monsterState = monsterRuntime?.getState();
    const maxHealth = Math.max(1, Math.floor(monsterState?.monsterMaxHealth ?? 2800));
    const health = Math.max(
      0,
      Math.floor(monsterState?.monsterHealth ?? (terminalUnlocked ? maxHealth : 2800))
    );
    const healthRatio = maxHealth <= 0 ? 0 : health / maxHealth;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.0035);
    const electricBase = terminalUnlocked ? 62 : 78;
    const electricExtra = terminalUnlocked ? (1 - healthRatio) * 32 : 8;
    const electricActivity = clampPercent(electricBase + electricExtra + pulse * 8);

    return {
      madaHealth: health,
      madaMaxHealth: maxHealth,
      containmentIntegrity: terminalUnlocked
        ? clampPercent(healthRatio * 100)
        : 100,
      electricActivity,
      fluidPatches: terminalUnlocked ? Math.floor((1 - healthRatio) * 6) : 0,
      circuitBreaks: terminalUnlocked ? Math.floor((1 - healthRatio) * 4) : 0,
      statusLabel: resolveStatusLabel(healthRatio),
      terminalInRange: !terminalUnlocked && terminalInRange,
    };
  };

  const emitState = (force = false, now = performance.now()) => {
    if (!force && now < nextUiEmitAt) return;
    nextUiEmitAt = now + UI_EMIT_INTERVAL_MS;
    const state = buildUiState();
    const snapshotKey = createStateSnapshotKey(state);
    if (!force && snapshotKey === lastStateKey) return;
    lastStateKey = snapshotKey;
    context?.onStateChange?.({
      [MADA_LAB_STATE_KEY]: state,
    });
  };

  const handleTerminalUnlock = (event: Event) => {
    const customEvent = event as CustomEvent<{ code?: string }>;
    if (customEvent.detail?.code !== "1986") return;
    terminalUnlocked = true;
    createMonsterRuntime();
    emitState(true, performance.now());
  };

  if (typeof window !== "undefined") {
    window.addEventListener(
      MADA_TERMINAL_UNLOCK_EVENT,
      handleTerminalUnlock as EventListener
    );
  }

  const worldTick = ({ now, player, ...rest }: PlayerWorldTickArgs) => {
    player.getWorldPosition(playerWorldPosition);
    terminalInRange =
      playerWorldPosition.distanceTo(terminalAnchor) <= TERMINAL_INTERACTION_RADIUS;

    if (terminalUnlocked && monsterRuntime) {
      monsterRuntime.tick({
        now,
        player,
        ...rest,
      });
    }

    emitState(false, now);
  };

  const world: PlayerWorld = {
    sceneId: "madaLab",
    groundY: GROUND_Y,
    playerSpawn: new THREE.Vector3(0, GROUND_Y, 28),
    bounds,
    projectileColliders: [solidGroup],
    attackTargets,
    isBlocked: (x, z) => {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
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
    onPlayerDeath: ({ gameMode, now, resetPlayer }) => {
      if (gameMode !== "madacombat") return "ignore";
      resetPlayer();
      if (terminalUnlocked && monsterRuntime) {
        monsterRuntime.reset(now);
      }
      emitState(true, now);
      return "handled";
    },
    onPlayerReset: () => {
      if (terminalUnlocked && monsterRuntime) {
        monsterRuntime.reset(performance.now());
      }
      emitState(true);
    },
  };

  emitState(true);

  const dispose = () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(
        MADA_TERMINAL_UNLOCK_EVENT,
        handleTerminalUnlock as EventListener
      );
    }
    context?.onStateChange?.({});
    monsterRuntime?.dispose();
    monsterRuntime = null;
    attackTargets.length = 0;
    scene.remove(ambient, hemi, key, fill);
    scene.remove(labGroup);
    disposeTrackedResources();
  };

  return { world, dispose };
};
