import * as THREE from "three";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../../../asset/entity/character/general/player";
import { createUnifiedMonsterRuntime } from "../../../asset/entity/monster/unified/registry";
import { createSceneResourceTracker } from "../../../asset/scenes/general/resourceTracker";
import type {
  SceneSetupContext,
  SceneSetupResult,
} from "../../../asset/scenes/general/sceneTypes";
import { createMochiFactoryScene } from "../../../asset/scenes/mochiFactory/sceneDefinition";
import {
  SURGE_SCENE_STATE_KEY,
  SURGE_TOTAL_MONSTERS,
  type MochiSoldierSurgeState,
} from "./battleConfig";

type Bounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const fallbackBounds: Bounds = {
  minX: -50,
  maxX: 50,
  minZ: -50,
  maxZ: 50,
};

const SCORE_PENALTY_ON_BOSS_HIT = 50;
const VICTORY_BONUS_5_MIN_SECONDS = 5 * 60;
const VICTORY_BONUS_7_MIN_SECONDS = 7 * 60;
const VICTORY_BONUS_10_MIN_SECONDS = 10 * 60;
const VICTORY_BONUS_WITHIN_5_MIN = 2000;
const VICTORY_BONUS_WITHIN_7_MIN = 1000;
const VICTORY_BONUS_WITHIN_10_MIN = 500;
const STATE_SYNC_INTERVAL_MS = 120;
const MOCHI_GENERAL_SPAWN_DELAY_MS = 2000;

export type MochiGeneralBattleDifficultyConfig = {
  bossDamageMultiplier?: number;
  bossDefenseRatio?: number;
  bossTempoMultiplier?: number;
};

type ResolvedMochiGeneralBattleDifficultyConfig = {
  bossDamageMultiplier: number;
  bossDefenseRatio: number;
  bossTempoMultiplier: number;
};

type DaylightPresetRuntime = {
  syncSkyToPlayer: (player: THREE.Object3D) => void;
  dispose: () => void;
};

const normalizePositiveMultiplier = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const normalizeDefenseRatio = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return THREE.MathUtils.clamp(parsed, 0, 1);
};

const resolveDifficultyConfig = (
  config?: MochiGeneralBattleDifficultyConfig
): ResolvedMochiGeneralBattleDifficultyConfig => {
  return {
    bossDamageMultiplier: normalizePositiveMultiplier(
      config?.bossDamageMultiplier,
      1
    ),
    bossDefenseRatio: normalizeDefenseRatio(config?.bossDefenseRatio),
    bossTempoMultiplier: normalizePositiveMultiplier(config?.bossTempoMultiplier, 1),
  };
};

const applyBattleDaylightPreset = (scene: THREE.Scene): DaylightPresetRuntime => {
  scene.background = new THREE.Color(0x6a2430);
  scene.fog = new THREE.Fog(0x8a3a44, 120, 340);

  const skyGeometry = new THREE.SphereGeometry(95, 40, 28);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x5e1025) },
      middleColor: { value: new THREE.Color(0xa23346) },
      bottomColor: { value: new THREE.Color(0xffa06b) },
      sunTintColor: { value: new THREE.Color(0x89c7ff) },
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
  skyDome.name = "mochiGeneralBattleColorSky";
  skyDome.renderOrder = -1000;
  skyDome.frustumCulled = false;
  scene.add(skyDome);

  const daylightGroup = new THREE.Group();
  daylightGroup.name = "mochiGeneralBattleDaylight";

  const ambient = new THREE.AmbientLight(0xffffff, 0.95);
  const hemi = new THREE.HemisphereLight(0xeaf4ff, 0xbdc9d8, 0.72);
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(22, 30, 14);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 120;

  const fill = new THREE.DirectionalLight(0xfff6df, 0.45);
  fill.position.set(-16, 12, -10);

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

export const createMochiGeneralBattleScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext,
  difficultyConfig?: MochiGeneralBattleDifficultyConfig
): SceneSetupResult => {
  const difficulty = resolveDifficultyConfig(difficultyConfig);
  const factorySetup = createMochiFactoryScene(scene);
  const factoryWorld = factorySetup.world;
  if (!factoryWorld) return factorySetup;
  const daylightPreset = applyBattleDaylightPreset(scene);

  const bounds = factoryWorld.bounds ?? fallbackBounds;
  const worldIsBlocked = factoryWorld.isBlocked ?? (() => false);
  const groundY = factoryWorld.groundY;

  const runtimeHostGroup = new THREE.Group();
  runtimeHostGroup.name = "mochiGeneralUnifiedRuntimeHost";
  scene.add(runtimeHostGroup);

  const resourceTracker = createSceneResourceTracker();
  const { disposeTrackedResources } = resourceTracker;
  const attackTargets: PlayerAttackTarget[] = [];

  let playerDead = false;
  let gameEnded = false;
  let victory = false;
  let runStartedAtMs = performance.now();
  let elapsedSeconds = 0;
  let score = 0;
  let damageScore = 0;
  let hitPenaltyCount = 0;
  let hitPenaltyScore = 0;
  let victoryTimeBonusScore = 0;

  const addScore = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const normalized = Math.max(0, amount);
    score = Math.max(0, score + normalized);
    return normalized;
  };

  const applyScorePenalty = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const normalized = Math.max(0, amount);
    const before = score;
    score = Math.max(0, score - normalized);
    return before - score;
  };

  const resolveVictoryTimeBonus = (seconds: number) => {
    if (seconds <= VICTORY_BONUS_5_MIN_SECONDS) {
      return VICTORY_BONUS_WITHIN_5_MIN;
    }
    if (seconds <= VICTORY_BONUS_7_MIN_SECONDS) {
      return VICTORY_BONUS_WITHIN_7_MIN;
    }
    if (seconds <= VICTORY_BONUS_10_MIN_SECONDS) {
      return VICTORY_BONUS_WITHIN_10_MIN;
    }
    return 0;
  };

  const refreshElapsedSeconds = (nowMs: number) => {
    elapsedSeconds = Math.floor(Math.max(0, nowMs - runStartedAtMs) / 1000);
  };

  let monsterRuntime: ReturnType<typeof createUnifiedMonsterRuntime> | null = null;
  let monsterSpawnAt = runStartedAtMs + MOCHI_GENERAL_SPAWN_DELAY_MS;
  let lastMonsterHealth = 0;

  const spawnMonsterIfNeeded = () => {
    if (monsterRuntime) return;
    monsterRuntime = createUnifiedMonsterRuntime({
      scene,
      hostGroup: runtimeHostGroup,
      resourceTracker,
      monster: {
        id: "mochiGeneral",
        label: "Mochi General",
        path: "/assets/monsters/mochiGeneral/mochiGeneral.glb",
      },
      groundY,
      spawnPosition: new THREE.Vector3(0, groundY, 0),
      bounds,
      isBlocked: worldIsBlocked,
      attackTargets,
      runtimeOptions: {
        respawnOnDefeat: false,
        isGameEnded: () => gameEnded,
        mochiGeneral: {
          damageMultiplier: difficulty.bossDamageMultiplier,
          defenseRatio: difficulty.bossDefenseRatio,
          tempoMultiplier: difficulty.bossTempoMultiplier,
          maxBosses: SURGE_TOTAL_MONSTERS,
        },
      },
    });
    lastMonsterHealth = monsterRuntime.getState().monsterHealth;
  };

  const buildState = (): MochiSoldierSurgeState => {
    const monsterState = monsterRuntime?.getState();
    const hasSpawned = Boolean(monsterState);
    const alive = monsterState?.monsterAlive ? 1 : 0;
    const defeated = hasSpawned ? (alive > 0 ? 0 : 1) : 0;
    return {
      totalMonsters: SURGE_TOTAL_MONSTERS,
      spawnedMonsters: hasSpawned ? 1 : 0,
      aliveMonsters: alive,
      defeatedMonsters: defeated,
      elapsedSeconds,
      score: Math.max(0, Math.floor(score)),
      damageScore: Math.max(0, Math.floor(damageScore)),
      hitPenaltyCount: Math.max(0, Math.floor(hitPenaltyCount)),
      hitPenaltyScore: Math.max(0, Math.floor(hitPenaltyScore)),
      victoryTimeBonusScore: Math.max(0, Math.floor(victoryTimeBonusScore)),
      playerDead,
      gameEnded,
      victory,
    };
  };

  const areStatesEqual = (
    a: MochiSoldierSurgeState,
    b: MochiSoldierSurgeState
  ) => {
    return (
      a.totalMonsters === b.totalMonsters &&
      a.spawnedMonsters === b.spawnedMonsters &&
      a.aliveMonsters === b.aliveMonsters &&
      a.defeatedMonsters === b.defeatedMonsters &&
      a.elapsedSeconds === b.elapsedSeconds &&
      a.score === b.score &&
      a.damageScore === b.damageScore &&
      a.hitPenaltyCount === b.hitPenaltyCount &&
      a.hitPenaltyScore === b.hitPenaltyScore &&
      a.victoryTimeBonusScore === b.victoryTimeBonusScore &&
      a.playerDead === b.playerDead &&
      a.gameEnded === b.gameEnded &&
      a.victory === b.victory
    );
  };

  let lastEmittedState: MochiSoldierSurgeState | null = null;
  let lastStateEmitAt = 0;
  const emitState = (force = false, nowMs = performance.now()) => {
    const nextState = buildState();
    if (!force) {
      if (lastEmittedState && areStatesEqual(nextState, lastEmittedState)) {
        return;
      }
      if (nowMs - lastStateEmitAt < STATE_SYNC_INTERVAL_MS) {
        return;
      }
    }
    lastEmittedState = nextState;
    lastStateEmitAt = nowMs;
    context?.onStateChange?.({
      [SURGE_SCENE_STATE_KEY]: nextState,
    });
  };

  const endGame = (didWin: boolean, endedAtMs = performance.now()) => {
    if (gameEnded) return;
    refreshElapsedSeconds(endedAtMs);
    gameEnded = true;
    victory = didWin;
    if (didWin) {
      const bonus = resolveVictoryTimeBonus(elapsedSeconds);
      victoryTimeBonusScore += addScore(bonus);
    }
    emitState(true, endedAtMs);
  };

  const resetRun = (now: number) => {
    playerDead = false;
    gameEnded = false;
    victory = false;
    runStartedAtMs = now;
    elapsedSeconds = 0;
    score = 0;
    damageScore = 0;
    hitPenaltyCount = 0;
    hitPenaltyScore = 0;
    victoryTimeBonusScore = 0;
    monsterRuntime?.dispose();
    monsterRuntime = null;
    monsterSpawnAt = now + MOCHI_GENERAL_SPAWN_DELAY_MS;
    lastMonsterHealth = 0;
    emitState(true, now);
  };

  const worldTick = ({
    now,
    player,
    currentStats,
    applyDamage,
    ...rest
  }: PlayerWorldTickArgs) => {
    if (!gameEnded) {
      refreshElapsedSeconds(now);
    }
    daylightPreset.syncSkyToPlayer(player);

    if (!playerDead && currentStats.health <= 0) {
      playerDead = true;
      endGame(false, now);
      return;
    }

    if (!gameEnded && !monsterRuntime && now >= monsterSpawnAt) {
      spawnMonsterIfNeeded();
    }

    if (monsterRuntime) {
      monsterRuntime.tick({
        now,
        player,
        currentStats,
        applyDamage: (amount) => {
          const applied = applyDamage(amount);
          if (applied > 0) {
            hitPenaltyCount += 1;
            hitPenaltyScore += applyScorePenalty(SCORE_PENALTY_ON_BOSS_HIT);
          }
          return applied;
        },
        ...rest,
      });

      const monsterState = monsterRuntime.getState();
      if (monsterState.monsterHealth < lastMonsterHealth) {
        const gained = addScore(lastMonsterHealth - monsterState.monsterHealth);
        damageScore += gained;
      }
      lastMonsterHealth = monsterState.monsterHealth;

      if (!gameEnded && !monsterState.monsterAlive) {
        endGame(true, now);
      }
    }

    emitState(false, now);
  };

  const world: PlayerWorld = {
    sceneId: "mochiGeneralBattle",
    groundY,
    playerSpawn:
      factoryWorld.playerSpawn?.clone() ?? new THREE.Vector3(0, groundY, 14),
    resetOnDeath: false,
    isBlocked: worldIsBlocked,
    projectileColliders: factoryWorld.projectileColliders,
    recoveryZones: factoryWorld.recoveryZones,
    bounds,
    attackTargets,
    onTick: (args) => {
      factoryWorld.onTick?.(args);
      worldTick(args);
    },
    onPlayerDeath: ({ currentStats, now }) => {
      if (currentStats.health <= 0) {
        playerDead = true;
        endGame(false, now);
      }
      return "handled";
    },
    onPlayerReset: () => {
      factoryWorld.onPlayerReset?.();
      resetRun(performance.now());
    },
  };

  emitState(true);

  const dispose = () => {
    context?.onStateChange?.({});
    monsterRuntime?.dispose();
    attackTargets.length = 0;
    scene.remove(runtimeHostGroup);
    daylightPreset.dispose();
    disposeTrackedResources();
    factorySetup.dispose?.();
  };

  return { world, dispose };
};
