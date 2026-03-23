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
import { createMochiStreetScene } from "../../../asset/scenes/mochiStreet/sceneDefinition";
import {
  SURGE_EDGE_SPAWN_PADDING,
  SURGE_SCENE_STATE_KEY,
  SURGE_SPAWN_BATCH_SIZE,
  SURGE_SPAWN_INTERVAL_MS,
  SURGE_TOTAL_MONSTERS,
  type MochiSoldierSurgeDifficultyConfig,
  type MochiSoldierSurgeState,
} from "./surgeConfig";

type Bounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const fallbackBounds: Bounds = {
  minX: -30,
  maxX: 30,
  minZ: -40,
  maxZ: 40,
};

const SURGE_STATE_EMIT_INTERVAL_MS = 120;

type ResolvedMochiSoldierSurgeDifficultyConfig = {
  totalMonsters: number;
  healthMultiplier: number;
  spawnIntervalMs: number;
  spawnBatchSize: number;
};

type DaylightPresetRuntime = {
  syncSkyToPlayer: (player: THREE.Object3D) => void;
  dispose: () => void;
};

type ActiveSurgeRuntime = {
  runtime: UnifiedMonsterRuntime;
};

const normalizePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

const normalizeClampedMultiplier = (
  value: unknown,
  fallback: number,
  min: number,
  max: number
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return THREE.MathUtils.clamp(parsed, min, max);
};

const resolveDifficultyConfig = (
  config?: MochiSoldierSurgeDifficultyConfig
): ResolvedMochiSoldierSurgeDifficultyConfig => {
  return {
    totalMonsters: THREE.MathUtils.clamp(
      normalizePositiveInt(config?.totalMonsters, SURGE_TOTAL_MONSTERS),
      1,
      300
    ),
    healthMultiplier: normalizeClampedMultiplier(config?.healthMultiplier, 1, 1, 2),
    spawnIntervalMs: THREE.MathUtils.clamp(
      normalizePositiveInt(config?.spawnIntervalMs, SURGE_SPAWN_INTERVAL_MS),
      1000,
      5000
    ),
    spawnBatchSize: THREE.MathUtils.clamp(
      normalizePositiveInt(config?.spawnBatchSize, SURGE_SPAWN_BATCH_SIZE),
      1,
      10
    ),
  };
};

const applySurgeDaylightPreset = (scene: THREE.Scene): DaylightPresetRuntime => {
  scene.background = new THREE.Color(0x1d3278);
  scene.fog = new THREE.Fog(0x3457a3, 85, 240);

  const skyGeometry = new THREE.SphereGeometry(95, 40, 28);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x102567) },
      middleColor: { value: new THREE.Color(0x2c58bf) },
      bottomColor: { value: new THREE.Color(0x74b1ff) },
      sunTintColor: { value: new THREE.Color(0xffcf8c) },
    },
    vertexShader: `
      varying vec3 vWorldDirection;
      void main() {
        vWorldDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDirection;
      uniform vec3 topColor;
      uniform vec3 middleColor;
      uniform vec3 bottomColor;
      uniform vec3 sunTintColor;
      void main() {
        float h = clamp(vWorldDirection.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 sky = mix(bottomColor, middleColor, smoothstep(0.0, 0.58, h));
        sky = mix(sky, topColor, smoothstep(0.52, 1.0, h));
        vec3 sunDir = normalize(vec3(0.82, 0.32, -0.24));
        float sunGlow = pow(max(dot(vWorldDirection, sunDir), 0.0), 12.0);
        sky = mix(sky, sunTintColor, sunGlow * 0.36);
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });
  const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
  skyDome.name = "mochiSoldierSurgeColorSky";
  skyDome.renderOrder = -1000;
  skyDome.frustumCulled = false;
  scene.add(skyDome);

  const daylightGroup = new THREE.Group();
  daylightGroup.name = "mochiSoldierSurgeDaylight";

  const ambient = new THREE.AmbientLight(0xffffff, 0.95);
  const hemi = new THREE.HemisphereLight(0xf0f7ff, 0xc4cfdb, 0.7);
  const key = new THREE.DirectionalLight(0xffffff, 0.86);
  key.position.set(20, 26, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 90;

  const fill = new THREE.DirectionalLight(0xfff5df, 0.42);
  fill.position.set(-15, 11, -9);

  daylightGroup.add(ambient, hemi, key, fill);
  scene.add(daylightGroup);

  const skyFollowPosition = new THREE.Vector3();
  return {
    syncSkyToPlayer: (player) => {
      player.getWorldPosition(skyFollowPosition);
      skyDome.position.copy(skyFollowPosition);
    },
    dispose: () => {
      scene.remove(daylightGroup);
      scene.remove(skyDome);
      skyGeometry.dispose();
      skyMaterial.dispose();
    },
  };
};

export const createMochiSoldierSurgeScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext,
  difficultyConfig?: MochiSoldierSurgeDifficultyConfig
): SceneSetupResult => {
  const difficulty = resolveDifficultyConfig(difficultyConfig);
  const streetSetup = createMochiStreetScene(scene);
  const streetWorld = streetSetup.world;
  if (!streetWorld) return streetSetup;
  const daylightPreset = applySurgeDaylightPreset(scene);

  const totalMonsters = difficulty.totalMonsters;
  const spawnIntervalMs = difficulty.spawnIntervalMs;
  const spawnBatchSize = difficulty.spawnBatchSize;
  const bounds = streetWorld.bounds ?? fallbackBounds;
  const worldIsBlocked = streetWorld.isBlocked ?? (() => false);
  const groundY = streetWorld.groundY;

  const runtimeHostGroup = new THREE.Group();
  runtimeHostGroup.name = "mochiSoldierSurgeRuntimeHost";
  scene.add(runtimeHostGroup);

  const resourceTracker = createSceneResourceTracker();
  const { disposeTrackedResources } = resourceTracker;
  const attackTargets: PlayerAttackTarget[] = [];

  let spawnedMonsters = 0;
  let aliveMonsters = 0;
  let defeatedMonsters = 0;
  let nextSpawnAt = performance.now() + spawnIntervalMs;
  let pendingSpawnTickets = 0;
  let playerDead = false;
  let gameEnded = false;
  let victory = false;
  let nextStateEmitAt = 0;
  let lastStateKey = "";
  const activeRuntimes: ActiveSurgeRuntime[] = [];

  const buildState = (): MochiSoldierSurgeState => ({
    totalMonsters,
    spawnedMonsters,
    aliveMonsters,
    defeatedMonsters,
    playerDead,
    gameEnded,
    victory,
  });

  const emitState = (force = false, now = performance.now()) => {
    if (!force && now < nextStateEmitAt) return;
    const nextState = buildState();
    const stateKey = [
      nextState.totalMonsters,
      nextState.spawnedMonsters,
      nextState.aliveMonsters,
      nextState.defeatedMonsters,
      nextState.playerDead ? 1 : 0,
      nextState.gameEnded ? 1 : 0,
      nextState.victory ? 1 : 0,
    ].join("|");
    if (!force && stateKey === lastStateKey) return;
    lastStateKey = stateKey;
    nextStateEmitAt = now + SURGE_STATE_EMIT_INTERVAL_MS;
    context?.onStateChange?.({
      [SURGE_SCENE_STATE_KEY]: nextState,
    });
  };

  const endGame = (didWin: boolean) => {
    if (gameEnded) return;
    gameEnded = true;
    victory = didWin;
    emitState(true);
  };

  const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

  const resolveEdgeSpawnPosition = () => {
    const padding = SURGE_EDGE_SPAWN_PADDING;
    const minX = bounds.minX + padding;
    const maxX = bounds.maxX - padding;
    const minZ = bounds.minZ + padding;
    const maxZ = bounds.maxZ - padding;
    const fallback = new THREE.Vector3(0, groundY, bounds.minZ + 4);
    if (maxX <= minX || maxZ <= minZ) {
      return fallback;
    }

    const modes: Array<"top" | "right" | "bottom" | "left"> = [
      "top",
      "right",
      "bottom",
      "left",
    ];
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const mode = modes[Math.floor(Math.random() * modes.length)];
      const x =
        mode === "left"
          ? minX
          : mode === "right"
          ? maxX
          : randomBetween(minX, maxX);
      const z =
        mode === "top"
          ? minZ
          : mode === "bottom"
          ? maxZ
          : randomBetween(minZ, maxZ);
      if (worldIsBlocked(x, z)) {
        continue;
      }
      return new THREE.Vector3(x, groundY, z);
    }
    return fallback;
  };

  const spawnNextMonster = () => {
    if (spawnedMonsters >= totalMonsters || gameEnded) return false;
    const spawnPosition = resolveEdgeSpawnPosition();
    const runtime = createUnifiedMonsterRuntime({
      scene,
      hostGroup: runtimeHostGroup,
      resourceTracker,
      monster: {
        id: "mochiSoldier",
        label: "Mochi Soldier",
        path: "/assets/monsters/mochiSoldier/mochiSoldier.glb",
      },
      groundY,
      spawnPosition,
      bounds,
      isBlocked: worldIsBlocked,
      attackTargets,
      runtimeOptions: {
        respawnOnDefeat: false,
        isGameEnded: () => gameEnded,
        mochiSoldier: {
          healthMultiplier: difficulty.healthMultiplier,
        },
      },
    });
    activeRuntimes.push({ runtime });
    spawnedMonsters += 1;
    aliveMonsters = activeRuntimes.length;
    return true;
  };

  const consumeSpawnTickets = () => {
    if (gameEnded || pendingSpawnTickets <= 0) return;
    const remaining = totalMonsters - spawnedMonsters;
    if (remaining <= 0) {
      pendingSpawnTickets = 0;
      return;
    }
    pendingSpawnTickets = Math.min(pendingSpawnTickets, remaining);
    while (pendingSpawnTickets > 0 && !gameEnded) {
      const spawned = spawnNextMonster();
      if (!spawned) {
        pendingSpawnTickets = 0;
        break;
      }
      pendingSpawnTickets -= 1;
    }
  };

  const disposeAllRuntimes = () => {
    for (let i = activeRuntimes.length - 1; i >= 0; i -= 1) {
      activeRuntimes[i].runtime.dispose();
    }
    activeRuntimes.length = 0;
  };

  const resetRun = () => {
    disposeAllRuntimes();
    spawnedMonsters = 0;
    aliveMonsters = 0;
    defeatedMonsters = 0;
    nextSpawnAt = performance.now() + spawnIntervalMs;
    pendingSpawnTickets = Math.max(1, spawnBatchSize);
    playerDead = false;
    gameEnded = false;
    victory = false;
    consumeSpawnTickets();
    emitState(true);
  };

  const worldTick = ({ now, player, currentStats, ...rest }: PlayerWorldTickArgs) => {
    daylightPreset.syncSkyToPlayer(player);

    if (!playerDead && currentStats.health <= 0) {
      playerDead = true;
      endGame(false);
    }

    if (!gameEnded && now >= nextSpawnAt && spawnedMonsters < totalMonsters) {
      pendingSpawnTickets += spawnBatchSize;
      const remaining = totalMonsters - spawnedMonsters;
      pendingSpawnTickets = Math.min(pendingSpawnTickets, remaining);
      nextSpawnAt = now + spawnIntervalMs;
    }

    consumeSpawnTickets();

    for (let i = activeRuntimes.length - 1; i >= 0; i -= 1) {
      const entry = activeRuntimes[i];
      entry.runtime.tick({
        now,
        player,
        currentStats,
        ...rest,
      });
      const state = entry.runtime.getState();
      if (!state.monsterAlive) {
        entry.runtime.dispose();
        activeRuntimes.splice(i, 1);
        defeatedMonsters += 1;
      }
    }

    aliveMonsters = activeRuntimes.length;
    if (!gameEnded && defeatedMonsters >= totalMonsters) {
      endGame(true);
    }

    emitState(false, now);
  };

  pendingSpawnTickets = Math.max(1, spawnBatchSize);
  consumeSpawnTickets();
  emitState(true);

  const world: PlayerWorld = {
    sceneId: "mochiSoldierSurge",
    groundY,
    playerSpawn: streetWorld.playerSpawn,
    resetOnDeath: false,
    isBlocked: worldIsBlocked,
    projectileColliders: streetWorld.projectileColliders,
    recoveryZones: streetWorld.recoveryZones,
    bounds,
    attackTargets,
    onTick: (args) => {
      streetWorld.onTick?.(args);
      worldTick(args);
    },
    onPlayerDeath: ({ currentStats }) => {
      if (currentStats.health <= 0) {
        playerDead = true;
        endGame(false);
      }
      return "handled";
    },
    onPlayerReset: () => {
      streetWorld.onPlayerReset?.();
      resetRun();
    },
  };

  const dispose = () => {
    context?.onStateChange?.({});
    disposeAllRuntimes();
    attackTargets.length = 0;
    scene.remove(runtimeHostGroup);
    daylightPreset.dispose();
    disposeTrackedResources();
    streetSetup.dispose?.();
  };

  return { world, dispose };
};
