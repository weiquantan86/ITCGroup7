import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../../../asset/entity/character/general/player";
import { createMochiGeneralBossLifecycle } from "../../../asset/entity/monster/mochiGeneral/lifecycle";
import { createMochiSoldierLifecycle } from "../../../asset/entity/monster/mochiSoldier/lifecycle";
import { normalizeMochiSoldierPrototype } from "../../../asset/entity/monster/mochiSoldier/runtime";
import { createMochiFactoryScene } from "../../../asset/scenes/mochiFactory/sceneDefinition";
import { createSceneResourceTracker } from "../../../asset/scenes/general/resourceTracker";
import type {
  SceneSetupContext,
  SceneSetupResult,
} from "../../../asset/scenes/general/sceneTypes";
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

type DaylightPresetRuntime = {
  syncSkyToPlayer: (player: THREE.Object3D) => void;
  dispose: () => void;
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
  context?: SceneSetupContext
): SceneSetupResult => {
  const factorySetup = createMochiFactoryScene(scene);
  const factoryWorld = factorySetup.world;
  if (!factoryWorld) return factorySetup;
  const daylightPreset = applyBattleDaylightPreset(scene);

  const bounds = factoryWorld.bounds ?? fallbackBounds;
  const worldIsBlocked = factoryWorld.isBlocked ?? (() => false);
  const groundY = factoryWorld.groundY;

  const bossesGroup = new THREE.Group();
  bossesGroup.name = "mochiGeneralBosses";
  scene.add(bossesGroup);
  const summonedSoldiersGroup = new THREE.Group();
  summonedSoldiersGroup.name = "mochiGeneralSummonedSoldiers";
  scene.add(summonedSoldiersGroup);

  const resourceTracker = createSceneResourceTracker();
  const {
    trackGeometry,
    trackMaterial,
    trackMesh,
    trackObject,
    disposeObjectResources,
    disposeTrackedResources,
  } = resourceTracker;

  const bossFallbackGeometry = new THREE.CapsuleGeometry(2.1375, 3.0375, 7, 16);
  const bossFallbackMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xddd6fe,
    roughness: 0.34,
    metalness: 0.12,
    emissive: 0x581c87,
    emissiveIntensity: 0.18,
  });
  const bossHitboxGeometry = new THREE.CapsuleGeometry(2.8125, 4.32, 7, 14);

  const soldierFallbackGeometry = new THREE.CapsuleGeometry(0.58, 1.15, 6, 14);
  const soldierFallbackMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xf8d2a6,
    roughness: 0.38,
    metalness: 0.08,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.16,
  });
  const soldierHitboxGeometry = new THREE.CapsuleGeometry(0.9, 1.56, 6, 12);

  const hitboxMaterialTemplate = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  trackGeometry(bossFallbackGeometry);
  trackGeometry(bossHitboxGeometry);
  trackGeometry(soldierFallbackGeometry);
  trackGeometry(soldierHitboxGeometry);
  trackMaterial(bossFallbackMaterialTemplate);
  trackMaterial(soldierFallbackMaterialTemplate);
  trackMaterial(hitboxMaterialTemplate);

  const attackTargets: PlayerAttackTarget[] = [];

  let playerDead = false;
  let gameEnded = false;
  let victory = false;
  const runStartedAtMs = performance.now();
  let elapsedSeconds = 0;
  let score = 0;

  const addScore = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    score = Math.max(0, score + amount);
  };

  const applyScorePenalty = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    score = Math.max(0, score - amount);
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

  const resolveElapsedSeconds = (nowMs: number) => {
    return Math.max(0, (nowMs - runStartedAtMs) / 1000);
  };

  const refreshElapsedSeconds = (nowMs: number) => {
    elapsedSeconds = Math.floor(resolveElapsedSeconds(nowMs));
  };

  const soldierLifecycle = createMochiSoldierLifecycle({
    scene,
    group: summonedSoldiersGroup,
    attackTargets,
    isGameEnded: () => gameEnded,
    isBlocked: worldIsBlocked,
    trackMesh,
    trackObject,
    disposeObjectResources,
    fallbackGeometry: soldierFallbackGeometry,
    fallbackMaterialTemplate: soldierFallbackMaterialTemplate,
    hitboxGeometry: soldierHitboxGeometry,
    hitboxMaterialTemplate,
  });

  const bossLifecycle = createMochiGeneralBossLifecycle({
    scene,
    group: bossesGroup,
    attackTargets,
    isGameEnded: () => gameEnded,
    isBlocked: worldIsBlocked,
    groundY,
    maxBosses: SURGE_TOTAL_MONSTERS,
    onSummonSoldier: (position) => {
      soldierLifecycle.spawn(position);
    },
    trackMesh,
    trackObject,
    disposeObjectResources,
    fallbackGeometry: bossFallbackGeometry,
    fallbackMaterialTemplate: bossFallbackMaterialTemplate,
    hitboxGeometry: bossHitboxGeometry,
    hitboxMaterialTemplate,
    onBossDamaged: (appliedDamage) => {
      if (gameEnded || appliedDamage <= 0) return;
      addScore(appliedDamage);
    },
  });

  const buildState = (): MochiSoldierSurgeState => {
    const bossStats = bossLifecycle.getStats();
    return {
      totalMonsters: SURGE_TOTAL_MONSTERS,
      spawnedMonsters: bossStats.spawned,
      aliveMonsters: bossStats.alive,
      defeatedMonsters: bossStats.defeated,
      elapsedSeconds,
      score: Math.max(0, Math.floor(score)),
      playerDead,
      gameEnded,
      victory,
    };
  };

  let lastStateKey = "";
  const emitState = (force = false) => {
    const nextState = buildState();
    const stateKey = JSON.stringify(nextState);
    if (!force && stateKey === lastStateKey) return;
    lastStateKey = stateKey;
    context?.onStateChange?.({
      [SURGE_SCENE_STATE_KEY]: nextState,
    });
  };

  const endGame = (didWin: boolean, endedAtMs = performance.now()) => {
    if (gameEnded) return;
    const elapsedSecondsRaw = resolveElapsedSeconds(endedAtMs);
    elapsedSeconds = Math.floor(elapsedSecondsRaw);
    gameEnded = true;
    victory = didWin;
    if (didWin) {
      addScore(resolveVictoryTimeBonus(elapsedSecondsRaw));
    }
    emitState(true);
  };

  const bossSpawnDelayMs = 4000;
  const bossSpawnAt = performance.now() + bossSpawnDelayMs;
  const bossSpawnPosition = new THREE.Vector3(0, groundY, 0);
  let bossSpawned = false;

  const worldTick = ({
    now,
    delta,
    player,
    currentStats,
    applyDamage,
    applyStatusEffect,
    projectileBlockers,
    handleProjectileBlockHit,
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

    if (!bossSpawned && !gameEnded && now >= bossSpawnAt) {
      bossSpawned = bossLifecycle.spawn(bossSpawnPosition);
    }

    bossLifecycle.tick({
      now,
      delta,
      player,
      applyDamage: (amount) => {
        const applied = applyDamage(amount);
        if (applied > 0) {
          applyScorePenalty(SCORE_PENALTY_ON_BOSS_HIT);
        }
        return applied;
      },
      applyStatusEffect,
      projectileBlockers,
      handleProjectileBlockHit,
    });
    soldierLifecycle.tick({
      now,
      delta,
      player,
      applyDamage,
    });

    if (!gameEnded) {
      const bossStats = bossLifecycle.getStats();
      if (bossStats.defeated >= SURGE_TOTAL_MONSTERS) {
        endGame(true, now);
      }
    }

    emitState();
  };

  let isDisposed = false;
  const loader = new GLTFLoader();
  loader.load(
    "/assets/monsters/mochiGeneral/mochiGeneral.glb",
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        disposeObjectResources(gltf.scene);
        return;
      }

      const prototype = gltf.scene;
      const modelBounds = new THREE.Box3().setFromObject(prototype);
      const modelHeight = Math.max(0.001, modelBounds.max.y - modelBounds.min.y);
      const targetHeight = 6.975;
      prototype.scale.setScalar(targetHeight / modelHeight);
      prototype.updateMatrixWorld(true);

      modelBounds.setFromObject(prototype);
      prototype.position.y -= modelBounds.min.y;
      prototype.updateMatrixWorld(true);

      trackObject(prototype, {
        castShadow: true,
        receiveShadow: true,
      });
      bossLifecycle.setPrototype(prototype);
    },
    undefined,
    () => {}
  );

  loader.load(
    "/assets/monsters/mochiSoldier/mochiSoldier.glb",
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        disposeObjectResources(gltf.scene);
        return;
      }

      const prototype = gltf.scene;
      normalizeMochiSoldierPrototype(prototype);

      trackObject(prototype, {
        castShadow: true,
        receiveShadow: true,
      });
      soldierLifecycle.setPrototype(prototype);
    },
    undefined,
    () => {}
  );

  emitState(true);

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
    onPlayerDeath: ({ currentStats }) => {
      if (currentStats.health <= 0) {
        playerDead = true;
        endGame(false);
      }
      return "handled";
    },
    onPlayerReset: factoryWorld.onPlayerReset,
  };

  const dispose = () => {
    isDisposed = true;
    context?.onStateChange?.({});
    bossLifecycle.dispose();
    soldierLifecycle.dispose();
    attackTargets.length = 0;
    scene.remove(bossesGroup);
    scene.remove(summonedSoldiersGroup);
    daylightPreset.dispose();
    disposeTrackedResources();
    factorySetup.dispose?.();
  };

  return { world, dispose };
};
