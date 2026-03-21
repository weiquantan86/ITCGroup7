import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../../../asset/entity/character/general/player";
import { Monster } from "../../../asset/entity/monster/general";
import {
  mochiSoldierCombatConfig,
  mochiSoldierProfile,
} from "../../../asset/entity/monster/mochiSoldier/profile";
import { createMochiSoldierDeathFxRuntime } from "../../../asset/entity/monster/mochiSoldier/runtime";
import {
  applyDamageToSlimluThreatOrPlayer,
  resolveSlimluThreatTargetForEnemy,
} from "../../../asset/entity/character/slimlu/threatRegistry";
import { createSceneResourceTracker } from "../../../asset/scenes/general/resourceTracker";
import { createMochiStreetScene } from "../../../asset/scenes/mochiStreet/sceneDefinition";
import type {
  SceneSetupContext,
  SceneSetupResult,
} from "../../../asset/scenes/general/sceneTypes";
import {
  SURGE_EDGE_SPAWN_PADDING,
  SURGE_SCENE_STATE_KEY,
  SURGE_SPAWN_BATCH_SIZE,
  SURGE_SPAWN_INTERVAL_MS,
  SURGE_TOTAL_MONSTERS,
  type MochiSoldierSurgeDifficultyConfig,
  type MochiSoldierSurgeState,
} from "./surgeConfig";

type SurgeMonsterEntry = {
  id: string;
  anchor: THREE.Group;
  hitbox: THREE.Mesh;
  fallback: THREE.Mesh;
  model: THREE.Object3D | null;
  renderMode: "model" | "instanced";
  instanceIndex: number;
  cachedTarget: THREE.Object3D | null;
  nextAiUpdateAt: number;
  nextMoveUpdateAt: number;
  monster: Monster;
  lastAttackAt: number;
  walkPhase: number;
  walkBlend: number;
  rig: SurgeMonsterRig | null;
  navWaypoints: NavWaypoint[];
  navWaypointIndex: number;
  nextRepathAt: number;
  lastNavTargetX: number;
  lastNavTargetZ: number;
};

type NavWaypoint = {
  x: number;
  z: number;
};

type SurgeMonsterRig = {
  body: THREE.Object3D | null;
  legLeft: THREE.Object3D | null;
  legRight: THREE.Object3D | null;
  armLeft: THREE.Object3D | null;
  armRight: THREE.Object3D | null;
  bodyBaseY: number;
  legLeftBaseX: number;
  legRightBaseX: number;
  armLeftBaseX: number;
  armRightBaseX: number;
};

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

const SURGE_NAV_CELL_SIZE = 1.7;
const SURGE_NAV_CLEARANCE = 0.62;
const SURGE_NAV_LINE_SAMPLE_STEP = 1.1;
const SURGE_NAV_REPATH_INTERVAL_MS = 520;
const SURGE_NAV_TARGET_SHIFT_REPATH_DISTANCE = 1.3;
const SURGE_NAV_MAX_EXPANSIONS = 3200;
const SURGE_FLOW_UPDATE_INTERVAL_MS = 180;
const SURGE_FLOW_TARGET_SHIFT_REBUILD_DISTANCE = 1.15;
const SURGE_AI_LOD_MID_DISTANCE = 26;
const SURGE_AI_LOD_FAR_DISTANCE = 42;
const SURGE_AI_LOD_VERY_FAR_DISTANCE = 58;
const SURGE_AI_LOD_MID_INTERVAL_MS = 60;
const SURGE_AI_LOD_FAR_INTERVAL_MS = 140;
const SURGE_AI_LOD_VERY_FAR_INTERVAL_MS = 240;
const SURGE_MOVE_LOD_MID_INTERVAL_MS = 45;
const SURGE_MOVE_LOD_FAR_INTERVAL_MS = 100;
const SURGE_MOVE_LOD_VERY_FAR_INTERVAL_MS = 180;
const SURGE_STATE_EMIT_INTERVAL_MS = 120;
const SURGE_RENDER_FORCE_INSTANCE_COUNT = 0;
const SURGE_RENDER_HIGH_DETAIL_CAP = 12;
const SURGE_RENDER_NEAR_DISTANCE = 24;
const SURGE_RENDER_FAR_DISTANCE = 34;
const SURGE_RENDER_LOD_UPDATE_INTERVAL_MS = 120;
const SURGE_INSTANCE_BASE_Y_OFFSET = 1.16;

type ResolvedMochiSoldierSurgeDifficultyConfig = {
  totalMonsters: number;
  healthMultiplier: number;
  spawnIntervalMs: number;
  spawnBatchSize: number;
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

type DaylightPresetRuntime = {
  syncSkyToPlayer: (player: THREE.Object3D) => void;
  dispose: () => void;
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
  const baseStats = mochiSoldierProfile.stats ?? {};
  const scaledMochiSoldierProfile = {
    ...mochiSoldierProfile,
    stats: {
      ...baseStats,
      health: Math.max(1, (baseStats.health ?? 50) * difficulty.healthMultiplier),
    },
  };

  const bounds = streetWorld.bounds ?? fallbackBounds;
  const worldIsBlocked = streetWorld.isBlocked ?? (() => false);
  const groundY = streetWorld.groundY;
  const surgePursuitRange = Math.hypot(
    bounds.maxX - bounds.minX,
    bounds.maxZ - bounds.minZ
  );

  const monstersGroup = new THREE.Group();
  scene.add(monstersGroup);

  const resourceTracker = createSceneResourceTracker();
  const {
    trackGeometry,
    trackMaterial,
    trackMesh,
    trackObject,
    disposeObjectResources,
    disposeTrackedResources,
  } = resourceTracker;
  const deathFxRuntime = createMochiSoldierDeathFxRuntime(scene);

  const fallbackGeometry = new THREE.CapsuleGeometry(0.58, 1.15, 6, 14);
  const fallbackMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xf8d2a6,
    roughness: 0.38,
    metalness: 0.08,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.16,
  });
  const hitboxGeometry = new THREE.CapsuleGeometry(0.9, 1.56, 6, 12);
  const edgeHitboxGeometry = new THREE.SphereGeometry(1.08, 16, 12);
  const hitboxMaterialTemplate = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  trackGeometry(fallbackGeometry);
  trackGeometry(hitboxGeometry);
  trackGeometry(edgeHitboxGeometry);
  trackMaterial(fallbackMaterialTemplate);
  trackMaterial(hitboxMaterialTemplate);

  const instancedFallbackMaterial = fallbackMaterialTemplate.clone();
  instancedFallbackMaterial.transparent = false;
  const instancedFallbackMesh = new THREE.InstancedMesh(
    fallbackGeometry,
    instancedFallbackMaterial,
    totalMonsters
  );
  instancedFallbackMesh.count = 0;
  instancedFallbackMesh.castShadow = false;
  instancedFallbackMesh.receiveShadow = false;
  instancedFallbackMesh.frustumCulled = false;
  instancedFallbackMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  monstersGroup.add(instancedFallbackMesh);
  trackMaterial(instancedFallbackMaterial);

  const monsters: SurgeMonsterEntry[] = [];
  const instancedEntries: SurgeMonsterEntry[] = [];
  const attackTargets: PlayerAttackTarget[] = [];

  let spawnedMonsters = 0;
  let aliveMonsters = 0;
  let defeatedMonsters = 0;
  let nextSpawnAt = performance.now() + spawnIntervalMs;
  let playerDead = false;
  let gameEnded = false;
  let victory = false;
  let nextRenderLodUpdateAt = 0;
  let nextStateEmitAt = 0;
  let nextFlowUpdateAt = 0;
  let flowGoalCellIndex = -1;
  let flowGoalTargetX = Number.NaN;
  let flowGoalTargetZ = Number.NaN;

  const lodPlayerPosition = new THREE.Vector3();
  const instanceDummy = new THREE.Object3D();
  const instancePitchEuler = new THREE.Euler(0, 0, 0, "XYZ");
  const instancePitchQuaternion = new THREE.Quaternion();
  const instanceBaseQuaternion = new THREE.Quaternion();
  const swappedInstanceMatrix = new THREE.Matrix4();
  const flowTargetWorld = new THREE.Vector3();
  const flowWaypointScratch = new THREE.Vector2();
  const targetWorldScratch = new THREE.Vector3();

  const buildState = (): MochiSoldierSurgeState => ({
    totalMonsters,
    spawnedMonsters,
    aliveMonsters,
    defeatedMonsters,
    playerDead,
    gameEnded,
    victory,
  });

  let lastStateKey = "";
  const emitState = (force = false) => {
    const now = performance.now();
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

  const navOriginX = bounds.minX;
  const navOriginZ = bounds.minZ;
  const navCols = Math.max(
    2,
    Math.floor((bounds.maxX - bounds.minX) / SURGE_NAV_CELL_SIZE) + 1
  );
  const navRows = Math.max(
    2,
    Math.floor((bounds.maxZ - bounds.minZ) / SURGE_NAV_CELL_SIZE) + 1
  );
  const navCellCount = navCols * navRows;
  const navWalkable = new Uint8Array(navCellCount);
  const flowFieldDistance = new Float32Array(navCellCount);
  const flowInQueue = new Uint8Array(navCellCount);
  const navNeighborSteps = [
    { dx: 1, dz: 0, cost: 1 },
    { dx: -1, dz: 0, cost: 1 },
    { dx: 0, dz: 1, cost: 1 },
    { dx: 0, dz: -1, cost: 1 },
    { dx: 1, dz: 1, cost: Math.SQRT2 },
    { dx: 1, dz: -1, cost: Math.SQRT2 },
    { dx: -1, dz: 1, cost: Math.SQRT2 },
    { dx: -1, dz: -1, cost: Math.SQRT2 },
  ] as const;
  const navClearanceDiagonal = SURGE_NAV_CLEARANCE * 0.70710678;
  const navClearanceOffsets: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [SURGE_NAV_CLEARANCE, 0],
    [-SURGE_NAV_CLEARANCE, 0],
    [0, SURGE_NAV_CLEARANCE],
    [0, -SURGE_NAV_CLEARANCE],
    [navClearanceDiagonal, navClearanceDiagonal],
    [navClearanceDiagonal, -navClearanceDiagonal],
    [-navClearanceDiagonal, navClearanceDiagonal],
    [-navClearanceDiagonal, -navClearanceDiagonal],
  ];

  const clampCellX = (x: number) => THREE.MathUtils.clamp(x, 0, navCols - 1);
  const clampCellZ = (z: number) => THREE.MathUtils.clamp(z, 0, navRows - 1);
  const cellIndex = (cellX: number, cellZ: number) => cellZ * navCols + cellX;
  const cellXFromIndex = (index: number) => index % navCols;
  const cellZFromIndex = (index: number) => Math.floor(index / navCols);
  const cellCenterX = (cellX: number) => navOriginX + cellX * SURGE_NAV_CELL_SIZE;
  const cellCenterZ = (cellZ: number) => navOriginZ + cellZ * SURGE_NAV_CELL_SIZE;

  const isPointWalkable = (x: number, z: number) => {
    for (let i = 0; i < navClearanceOffsets.length; i += 1) {
      const [offsetX, offsetZ] = navClearanceOffsets[i];
      if (worldIsBlocked(x + offsetX, z + offsetZ)) {
        return false;
      }
    }
    return true;
  };

  const isCellWalkable = (cellX: number, cellZ: number) => {
    if (cellX < 0 || cellX >= navCols || cellZ < 0 || cellZ >= navRows) {
      return false;
    }
    return navWalkable[cellIndex(cellX, cellZ)] === 1;
  };

  for (let cellZ = 0; cellZ < navRows; cellZ += 1) {
    for (let cellX = 0; cellX < navCols; cellX += 1) {
      const walkable = isPointWalkable(cellCenterX(cellX), cellCenterZ(cellZ));
      navWalkable[cellIndex(cellX, cellZ)] = walkable ? 1 : 0;
    }
  }

  const resolveNearestWalkableCell = (x: number, z: number, maxRadius = 12) => {
    const originCellX = clampCellX(Math.round((x - navOriginX) / SURGE_NAV_CELL_SIZE));
    const originCellZ = clampCellZ(Math.round((z - navOriginZ) / SURGE_NAV_CELL_SIZE));
    if (isCellWalkable(originCellX, originCellZ)) {
      return { cellX: originCellX, cellZ: originCellZ };
    }

    let bestCell: { cellX: number; cellZ: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      let found = false;
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const isEdge = Math.abs(dx) === radius || Math.abs(dz) === radius;
          if (!isEdge) continue;
          const cellX = originCellX + dx;
          const cellZ = originCellZ + dz;
          if (!isCellWalkable(cellX, cellZ)) continue;
          const centerX = cellCenterX(cellX);
          const centerZ = cellCenterZ(cellZ);
          const distance = Math.hypot(centerX - x, centerZ - z);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestCell = { cellX, cellZ };
            found = true;
          }
        }
      }
      if (found && bestCell) {
        return bestCell;
      }
    }

    return bestCell;
  };

  const rebuildFlowField = (targetX: number, targetZ: number) => {
    const goalCell = resolveNearestWalkableCell(
      targetX,
      targetZ,
      Math.max(navCols, navRows)
    );
    if (!goalCell) {
      flowFieldDistance.fill(Number.POSITIVE_INFINITY);
      flowGoalCellIndex = -1;
      flowGoalTargetX = Number.NaN;
      flowGoalTargetZ = Number.NaN;
      return;
    }

    const goalIndex = cellIndex(goalCell.cellX, goalCell.cellZ);
    flowFieldDistance.fill(Number.POSITIVE_INFINITY);
    flowInQueue.fill(0);
    flowFieldDistance[goalIndex] = 0;
    flowInQueue[goalIndex] = 1;
    const queue: number[] = [goalIndex];
    let queueHead = 0;
    let expansions = 0;
    const maxExpansions = navCellCount * 6;

    while (queueHead < queue.length && expansions < maxExpansions) {
      const current = queue[queueHead++];
      flowInQueue[current] = 0;
      const currentDistance = flowFieldDistance[current];
      const currentCellX = cellXFromIndex(current);
      const currentCellZ = cellZFromIndex(current);
      for (let i = 0; i < navNeighborSteps.length; i += 1) {
        const step = navNeighborSteps[i];
        const nextCellX = currentCellX + step.dx;
        const nextCellZ = currentCellZ + step.dz;
        if (!isCellWalkable(nextCellX, nextCellZ)) continue;
        if (
          step.dx !== 0 &&
          step.dz !== 0 &&
          (!isCellWalkable(currentCellX + step.dx, currentCellZ) ||
            !isCellWalkable(currentCellX, currentCellZ + step.dz))
        ) {
          continue;
        }
        const nextIndex = cellIndex(nextCellX, nextCellZ);
        const nextDistance = currentDistance + step.cost;
        if (nextDistance >= flowFieldDistance[nextIndex]) continue;
        flowFieldDistance[nextIndex] = nextDistance;
        if (!flowInQueue[nextIndex]) {
          queue.push(nextIndex);
          flowInQueue[nextIndex] = 1;
        }
      }
      expansions += 1;
    }

    flowGoalCellIndex = goalIndex;
    flowGoalTargetX = targetX;
    flowGoalTargetZ = targetZ;
  };

  const maybeUpdateFlowField = (targetX: number, targetZ: number, now: number) => {
    const targetShift = Number.isFinite(flowGoalTargetX) && Number.isFinite(flowGoalTargetZ)
      ? Math.hypot(targetX - flowGoalTargetX, targetZ - flowGoalTargetZ)
      : Number.POSITIVE_INFINITY;
    const shouldRebuild =
      flowGoalCellIndex < 0 ||
      now >= nextFlowUpdateAt ||
      targetShift >= SURGE_FLOW_TARGET_SHIFT_REBUILD_DISTANCE;
    if (!shouldRebuild) return;
    rebuildFlowField(targetX, targetZ);
    nextFlowUpdateAt = now + SURGE_FLOW_UPDATE_INTERVAL_MS;
  };

  const resolveFlowWaypoint = (fromX: number, fromZ: number) => {
    if (flowGoalCellIndex < 0) return null;
    const originCell = resolveNearestWalkableCell(fromX, fromZ, 8);
    if (!originCell) return null;

    const originIndex = cellIndex(originCell.cellX, originCell.cellZ);
    let bestIndex = originIndex;
    let bestDistance = flowFieldDistance[originIndex];

    for (let i = 0; i < navNeighborSteps.length; i += 1) {
      const step = navNeighborSteps[i];
      const nextCellX = originCell.cellX + step.dx;
      const nextCellZ = originCell.cellZ + step.dz;
      if (!isCellWalkable(nextCellX, nextCellZ)) continue;
      if (
        step.dx !== 0 &&
        step.dz !== 0 &&
        (!isCellWalkable(originCell.cellX + step.dx, originCell.cellZ) ||
          !isCellWalkable(originCell.cellX, originCell.cellZ + step.dz))
      ) {
        continue;
      }
      const nextIndex = cellIndex(nextCellX, nextCellZ);
      const nextDistance = flowFieldDistance[nextIndex];
      if (!Number.isFinite(nextDistance)) continue;
      if (nextDistance < bestDistance - 0.0001) {
        bestDistance = nextDistance;
        bestIndex = nextIndex;
      }
    }

    if (bestIndex === originIndex || !Number.isFinite(bestDistance)) return null;
    flowWaypointScratch.set(
      cellCenterX(cellXFromIndex(bestIndex)),
      cellCenterZ(cellZFromIndex(bestIndex))
    );
    return flowWaypointScratch;
  };

  const isSegmentBlocked = (fromX: number, fromZ: number, toX: number, toZ: number) => {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0.00001) return false;
    const samples = Math.max(1, Math.ceil(distance / SURGE_NAV_LINE_SAMPLE_STEP));
    for (let step = 1; step <= samples; step += 1) {
      const ratio = step / samples;
      const sampleX = fromX + dx * ratio;
      const sampleZ = fromZ + dz * ratio;
      if (!isPointWalkable(sampleX, sampleZ)) {
        return true;
      }
    }
    return false;
  };

  const findGridPath = (startIndex: number, goalIndex: number): number[] => {
    if (startIndex === goalIndex) return [startIndex];

    const gScore = new Float32Array(navCellCount);
    const fScore = new Float32Array(navCellCount);
    const cameFrom = new Int32Array(navCellCount);
    const openSet: number[] = [];
    const inOpenSet = new Uint8Array(navCellCount);

    gScore.fill(Number.POSITIVE_INFINITY);
    fScore.fill(Number.POSITIVE_INFINITY);
    cameFrom.fill(-1);

    const goalX = cellXFromIndex(goalIndex);
    const goalZ = cellZFromIndex(goalIndex);
    const estimateHeuristic = (index: number) => {
      const x = cellXFromIndex(index);
      const z = cellZFromIndex(index);
      return Math.hypot(goalX - x, goalZ - z);
    };

    gScore[startIndex] = 0;
    fScore[startIndex] = estimateHeuristic(startIndex);
    openSet.push(startIndex);
    inOpenSet[startIndex] = 1;

    let expansions = 0;
    while (openSet.length > 0 && expansions < SURGE_NAV_MAX_EXPANSIONS) {
      let bestOpenIndex = 0;
      for (let i = 1; i < openSet.length; i += 1) {
        if (fScore[openSet[i]] < fScore[openSet[bestOpenIndex]]) {
          bestOpenIndex = i;
        }
      }

      const current = openSet[bestOpenIndex];
      const tail = openSet[openSet.length - 1];
      openSet[bestOpenIndex] = tail;
      openSet.pop();
      inOpenSet[current] = 0;

      if (current === goalIndex) {
        const reversedPath = [current];
        let cursor = current;
        while (cursor !== startIndex) {
          cursor = cameFrom[cursor];
          if (cursor < 0) {
            return [];
          }
          reversedPath.push(cursor);
          if (reversedPath.length > navCellCount) {
            return [];
          }
        }
        reversedPath.reverse();
        return reversedPath;
      }

      expansions += 1;
      const currentX = cellXFromIndex(current);
      const currentZ = cellZFromIndex(current);

      for (let i = 0; i < navNeighborSteps.length; i += 1) {
        const step = navNeighborSteps[i];
        const nextX = currentX + step.dx;
        const nextZ = currentZ + step.dz;
        if (!isCellWalkable(nextX, nextZ)) continue;

        if (step.dx !== 0 && step.dz !== 0) {
          if (
            !isCellWalkable(currentX + step.dx, currentZ) ||
            !isCellWalkable(currentX, currentZ + step.dz)
          ) {
            continue;
          }
        }

        const nextIndex = cellIndex(nextX, nextZ);
        const tentative = gScore[current] + step.cost;
        if (tentative >= gScore[nextIndex]) continue;

        cameFrom[nextIndex] = current;
        gScore[nextIndex] = tentative;
        fScore[nextIndex] = tentative + estimateHeuristic(nextIndex);
        if (!inOpenSet[nextIndex]) {
          openSet.push(nextIndex);
          inOpenSet[nextIndex] = 1;
        }
      }
    }

    return [];
  };

  const buildPathWaypoints = (
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number
  ): NavWaypoint[] => {
    const startCell = resolveNearestWalkableCell(startX, startZ);
    const goalCell = resolveNearestWalkableCell(targetX, targetZ);
    if (!startCell || !goalCell) return [];

    const startIndex = cellIndex(startCell.cellX, startCell.cellZ);
    const goalIndex = cellIndex(goalCell.cellX, goalCell.cellZ);
    const gridPath = findGridPath(startIndex, goalIndex);
    if (gridPath.length <= 1) {
      return isSegmentBlocked(startX, startZ, targetX, targetZ)
        ? []
        : [{ x: targetX, z: targetZ }];
    }

    const rawWaypoints: NavWaypoint[] = [];
    for (let i = 1; i < gridPath.length; i += 1) {
      const index = gridPath[i];
      rawWaypoints.push({
        x: cellCenterX(cellXFromIndex(index)),
        z: cellCenterZ(cellZFromIndex(index)),
      });
    }
    rawWaypoints.push({ x: targetX, z: targetZ });

    const smoothedWaypoints: NavWaypoint[] = [];
    let anchorX = startX;
    let anchorZ = startZ;
    let cursor = 0;
    while (cursor < rawWaypoints.length) {
      let furthest = cursor;
      while (
        furthest + 1 < rawWaypoints.length &&
        !isSegmentBlocked(
          anchorX,
          anchorZ,
          rawWaypoints[furthest + 1].x,
          rawWaypoints[furthest + 1].z
        )
      ) {
        furthest += 1;
      }

      const nextWaypoint = rawWaypoints[furthest];
      smoothedWaypoints.push(nextWaypoint);
      anchorX = nextWaypoint.x;
      anchorZ = nextWaypoint.z;
      cursor = furthest + 1;
    }

    return smoothedWaypoints;
  };

  const resolveEdgeSpawnPosition = () => {
    const edgeSpawnPadding = Math.max(
      SURGE_EDGE_SPAWN_PADDING,
      SURGE_NAV_CLEARANCE + 0.08
    );
    const minX = bounds.minX + edgeSpawnPadding;
    const maxX = bounds.maxX - edgeSpawnPadding;
    const minZ = bounds.minZ + edgeSpawnPadding;
    const maxZ = bounds.maxZ - edgeSpawnPadding;
    const edgeBandDepth = 3;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const side = Math.floor(Math.random() * 4);
      let x = 0;
      let z = 0;
      if (side === 0) {
        x = minX;
        z = randomBetween(minZ, maxZ);
      } else if (side === 1) {
        x = maxX;
        z = randomBetween(minZ, maxZ);
      } else if (side === 2) {
        x = randomBetween(minX, maxX);
        z = minZ;
      } else {
        x = randomBetween(minX, maxX);
        z = maxZ;
      }
      if (isPointWalkable(x, z)) {
        return new THREE.Vector3(x, groundY, z);
      }
    }

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const side = Math.floor(Math.random() * 4);
      let x = 0;
      let z = 0;
      if (side === 0) {
        x = randomBetween(minX, Math.min(maxX, minX + edgeBandDepth));
        z = randomBetween(minZ, maxZ);
      } else if (side === 1) {
        x = randomBetween(Math.max(minX, maxX - edgeBandDepth), maxX);
        z = randomBetween(minZ, maxZ);
      } else if (side === 2) {
        x = randomBetween(minX, maxX);
        z = randomBetween(minZ, Math.min(maxZ, minZ + edgeBandDepth));
      } else {
        x = randomBetween(minX, maxX);
        z = randomBetween(Math.max(minZ, maxZ - edgeBandDepth), maxZ);
      }
      if (isPointWalkable(x, z)) {
        return new THREE.Vector3(x, groundY, z);
      }
    }

    const fallbackCell = resolveNearestWalkableCell(
      minX,
      minZ,
      Math.max(navCols, navRows)
    );
    if (fallbackCell) {
      return new THREE.Vector3(
        cellCenterX(fallbackCell.cellX),
        groundY,
        cellCenterZ(fallbackCell.cellZ)
      );
    }
    return new THREE.Vector3(
      (bounds.minX + bounds.maxX) * 0.5,
      groundY,
      (bounds.minZ + bounds.maxZ) * 0.5
    );
  };

  let mochiSoldierPrototype: THREE.Object3D | null = null;
  const cloneObjectMaterials = (object: THREE.Object3D) => {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => material.clone());
      } else {
        mesh.material = mesh.material.clone();
      }
    });
  };
  const applyObjectShadowFlags = (
    object: THREE.Object3D,
    options?: {
      castShadow?: boolean;
      receiveShadow?: boolean;
    }
  ) => {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (typeof options?.castShadow === "boolean") {
        mesh.castShadow = options.castShadow;
      }
      if (typeof options?.receiveShadow === "boolean") {
        mesh.receiveShadow = options.receiveShadow;
      }
    });
  };
  const disposeObjectMaterials = (object: THREE.Object3D) => {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (Array.isArray(mesh.material)) {
        for (let i = 0; i < mesh.material.length; i += 1) {
          mesh.material[i]?.dispose?.();
        }
        return;
      }
      mesh.material.dispose?.();
    });
  };

  const resolveMonsterRig = (model: THREE.Object3D): SurgeMonsterRig => {
    let body: THREE.Object3D | null = null;
    let legLeft: THREE.Object3D | null = null;
    let legRight: THREE.Object3D | null = null;
    let armLeft: THREE.Object3D | null = null;
    let armRight: THREE.Object3D | null = null;

    model.traverse((child) => {
      const name = child.name.toLowerCase();
      if (!body && (name === "body" || name.includes("body"))) {
        body = child;
      }
      if (!legLeft && name.includes("legleft")) {
        legLeft = child;
      }
      if (!legRight && name.includes("legright")) {
        legRight = child;
      }
      if (!armLeft && name.includes("armleft")) {
        armLeft = child;
      }
      if (!armRight && name.includes("armright")) {
        armRight = child;
      }
    });

    return {
      body,
      legLeft,
      legRight,
      armLeft,
      armRight,
      bodyBaseY: body?.position.y ?? 0,
      legLeftBaseX: legLeft?.rotation.x ?? 0,
      legRightBaseX: legRight?.rotation.x ?? 0,
      armLeftBaseX: armLeft?.rotation.x ?? 0,
      armRightBaseX: armRight?.rotation.x ?? 0,
    };
  };

  const applyMonsterWalkAnimation = (
    entry: SurgeMonsterEntry,
    delta: number,
    isMoving: boolean
  ) => {
    const targetBlend = isMoving ? 1 : 0;
    entry.walkBlend = THREE.MathUtils.damp(entry.walkBlend, targetBlend, 8.5, delta);
    entry.walkPhase += delta * (3 + entry.walkBlend * 9);

    if (!entry.model || !entry.rig) {
      const swing = Math.sin(entry.walkPhase) * 0.14 * entry.walkBlend;
      const bounce = Math.max(0, Math.sin(entry.walkPhase * 2)) * 0.03 * entry.walkBlend;
      entry.fallback.rotation.x = swing;
      entry.fallback.position.y = 1.16 + bounce;
      return;
    }

    const rig = entry.rig;
    const legSwing = Math.sin(entry.walkPhase) * 0.56 * entry.walkBlend;
    const armSwing = legSwing * 0.45;
    const bodyBob = Math.max(0, Math.sin(entry.walkPhase * 2)) * 0.04 * entry.walkBlend;

    if (rig.legLeft) {
      rig.legLeft.rotation.x = rig.legLeftBaseX + legSwing;
    }
    if (rig.legRight) {
      rig.legRight.rotation.x = rig.legRightBaseX - legSwing;
    }
    if (rig.armLeft) {
      rig.armLeft.rotation.x = rig.armLeftBaseX - armSwing;
    }
    if (rig.armRight) {
      rig.armRight.rotation.x = rig.armRightBaseX + armSwing;
    }
    if (rig.body) {
      rig.body.position.y = rig.bodyBaseY + bodyBob;
    }
  };

  const attachPrototypeToMonster = (entry: SurgeMonsterEntry) => {
    if (!mochiSoldierPrototype || entry.model) return;
    const model = cloneSkeleton(mochiSoldierPrototype);
    cloneObjectMaterials(model);
    entry.anchor.add(model);
    applyObjectShadowFlags(model, { castShadow: false, receiveShadow: false });
    entry.model = model;
    entry.rig = resolveMonsterRig(model);
    entry.fallback.visible = false;
    entry.monster.invalidateHitFlashMaterialCache();
  };

  const removePrototypeFromMonster = (entry: SurgeMonsterEntry) => {
    if (!entry.model) return;
    if (entry.model.parent === entry.anchor) {
      entry.anchor.remove(entry.model);
    }
    disposeObjectMaterials(entry.model);
    entry.model = null;
    entry.rig = null;
  };

  const removeFromInstancedEntries = (entry: SurgeMonsterEntry) => {
    if (entry.instanceIndex < 0) return;
    const removeIndex = entry.instanceIndex;
    const lastIndex = instancedEntries.length - 1;
    const lastEntry = instancedEntries[lastIndex];
    if (removeIndex !== lastIndex && lastEntry) {
      instancedEntries[removeIndex] = lastEntry;
      lastEntry.instanceIndex = removeIndex;
      instancedFallbackMesh.getMatrixAt(lastIndex, swappedInstanceMatrix);
      instancedFallbackMesh.setMatrixAt(removeIndex, swappedInstanceMatrix);
    }
    instancedEntries.pop();
    entry.instanceIndex = -1;
    instancedFallbackMesh.count = instancedEntries.length;
  };

  const switchMonsterToInstanced = (entry: SurgeMonsterEntry) => {
    if (entry.renderMode === "instanced" && entry.instanceIndex >= 0) {
      return;
    }
    removePrototypeFromMonster(entry);
    entry.fallback.visible = false;
    if (entry.instanceIndex < 0) {
      entry.instanceIndex = instancedEntries.length;
      instancedEntries.push(entry);
      instancedFallbackMesh.count = instancedEntries.length;
    }
    entry.renderMode = "instanced";
  };

  const switchMonsterToModel = (entry: SurgeMonsterEntry) => {
    if (
      entry.renderMode === "model" &&
      entry.instanceIndex < 0 &&
      Boolean(entry.model)
    ) {
      return;
    }
    if (!mochiSoldierPrototype) {
      switchMonsterToInstanced(entry);
      return;
    }
    if (entry.instanceIndex >= 0) {
      removeFromInstancedEntries(entry);
    }
    attachPrototypeToMonster(entry);
    entry.renderMode = "model";
  };

  const updateInstancedEntries = () => {
    for (let i = 0; i < instancedEntries.length; i += 1) {
      const entry = instancedEntries[i];
      const swing = Math.sin(entry.walkPhase) * 0.14 * entry.walkBlend;
      const bounce = Math.max(0, Math.sin(entry.walkPhase * 2)) * 0.03 * entry.walkBlend;
      instanceDummy.position.copy(entry.anchor.position);
      instanceDummy.position.y += SURGE_INSTANCE_BASE_Y_OFFSET + bounce;
      instanceBaseQuaternion.copy(entry.anchor.quaternion);
      if (Math.abs(swing) > 0.00001) {
        instancePitchEuler.x = swing;
        instancePitchQuaternion.setFromEuler(instancePitchEuler);
        instanceBaseQuaternion.multiply(instancePitchQuaternion);
      }
      instanceDummy.quaternion.copy(instanceBaseQuaternion);
      instanceDummy.scale.set(1, 1, 1);
      instanceDummy.updateMatrix();
      instancedFallbackMesh.setMatrixAt(i, instanceDummy.matrix);
    }
    instancedFallbackMesh.instanceMatrix.needsUpdate = true;
  };

  const updateMonsterRenderLod = (player: THREE.Object3D, now: number) => {
    if (now < nextRenderLodUpdateAt) return;
    nextRenderLodUpdateAt = now + SURGE_RENDER_LOD_UPDATE_INTERVAL_MS;

    const aliveEntries = monsters.filter((entry) => entry.monster.isAlive);
    if (!aliveEntries.length) return;

    const overThreshold = aliveEntries.length > SURGE_RENDER_FORCE_INSTANCE_COUNT;
    const nearDistanceSq = SURGE_RENDER_NEAR_DISTANCE * SURGE_RENDER_NEAR_DISTANCE;
    const farDistanceSq = SURGE_RENDER_FAR_DISTANCE * SURGE_RENDER_FAR_DISTANCE;
    const desiredModelEntries = new Set<SurgeMonsterEntry>();

    if (!overThreshold && mochiSoldierPrototype) {
      for (let i = 0; i < aliveEntries.length; i += 1) {
        desiredModelEntries.add(aliveEntries[i]);
      }
    } else {
      player.getWorldPosition(lodPlayerPosition);
      const scored = aliveEntries.map((entry) => {
        const dx = entry.anchor.position.x - lodPlayerPosition.x;
        const dz = entry.anchor.position.z - lodPlayerPosition.z;
        const distanceSq = dx * dx + dz * dz;
        let priority = 0;
        if (distanceSq <= nearDistanceSq) {
          priority = 3;
        } else if (entry.renderMode === "model" && distanceSq <= farDistanceSq) {
          priority = 2;
        } else if (distanceSq <= farDistanceSq) {
          priority = 1;
        }
        return { entry, distanceSq, priority };
      });

      scored.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.distanceSq - b.distanceSq;
      });

      if (mochiSoldierPrototype) {
        const highDetailBudget = Math.min(
          SURGE_RENDER_HIGH_DETAIL_CAP,
          scored.length
        );
        for (let i = 0; i < highDetailBudget; i += 1) {
          desiredModelEntries.add(scored[i].entry);
        }
      }
    }

    for (let i = 0; i < aliveEntries.length; i += 1) {
      const entry = aliveEntries[i];
      if (desiredModelEntries.has(entry)) {
        switchMonsterToModel(entry);
      } else {
        switchMonsterToInstanced(entry);
      }
    }
  };

  const removeAttackTarget = (id: string) => {
    const index = attackTargets.findIndex((target) => target.id === id);
    if (index < 0) return;
    attackTargets.splice(index, 1);
  };

  const removeMonsterEntry = (entry: SurgeMonsterEntry, countedAsDefeat: boolean) => {
    const index = monsters.indexOf(entry);
    if (index < 0) return;
    if (countedAsDefeat && !entry.monster.isAlive) {
      deathFxRuntime.spawn(entry);
    }
    removeAttackTarget(entry.id);
    if (entry.instanceIndex >= 0) {
      removeFromInstancedEntries(entry);
    }
    removePrototypeFromMonster(entry);
    entry.renderMode = "instanced";
    entry.cachedTarget = null;
    if (entry.fallback.parent === entry.anchor) {
      entry.anchor.remove(entry.fallback);
    }
    if (entry.hitbox.parent === entry.anchor) {
      entry.anchor.remove(entry.hitbox);
    }
    entry.monster.dispose();
    if (entry.anchor.parent === monstersGroup) {
      monstersGroup.remove(entry.anchor);
    }
    monsters.splice(index, 1);

    if (countedAsDefeat) {
      handleMonsterDefeated();
    }
  };

  const handleMonsterDefeated = () => {
    defeatedMonsters += 1;
    aliveMonsters = Math.max(0, aliveMonsters - 1);

    if (defeatedMonsters >= totalMonsters) {
      endGame(true);
      return;
    }

    emitState();
  };

  const spawnMonster = () => {
    if (spawnedMonsters >= totalMonsters) return;

    const spawnPosition = resolveEdgeSpawnPosition();
    const anchor = new THREE.Group();
    anchor.position.copy(spawnPosition);
    monstersGroup.add(anchor);

    const fallback = new THREE.Mesh(
      fallbackGeometry,
      fallbackMaterialTemplate.clone()
    );
    fallback.position.set(0, 1.16, 0);
    fallback.castShadow = false;
    fallback.receiveShadow = false;
    anchor.add(fallback);
    trackMesh(fallback);

    const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterialTemplate.clone());
    hitbox.position.set(0, 1.16, 0);
    hitbox.visible = false;
    anchor.add(hitbox);
    trackMesh(hitbox);

    const edgeHitbox = new THREE.Mesh(
      edgeHitboxGeometry,
      hitboxMaterialTemplate.clone()
    );
    edgeHitbox.position.set(0, 1.2, 0);
    edgeHitbox.visible = false;
    anchor.add(edgeHitbox);
    trackMesh(edgeHitbox);

    const entry: SurgeMonsterEntry = {
      id: `mochi-surge-${spawnedMonsters + 1}`,
      anchor,
      hitbox,
      fallback,
      model: null,
      renderMode: "instanced",
      instanceIndex: -1,
      cachedTarget: null,
      nextAiUpdateAt: 0,
      nextMoveUpdateAt: 0,
      monster: new Monster({
        model: anchor,
        profile: scaledMochiSoldierProfile,
      }),
      lastAttackAt: 0,
      walkPhase: Math.random() * Math.PI * 2,
      walkBlend: 0,
      rig: null,
      navWaypoints: [],
      navWaypointIndex: 0,
      nextRepathAt: 0,
      lastNavTargetX: Number.NaN,
      lastNavTargetZ: Number.NaN,
    };
    monsters.push(entry);
    spawnedMonsters += 1;
    aliveMonsters += 1;

    attackTargets.push({
      id: entry.id,
      object: anchor,
      isActive: () => entry.monster.isAlive,
      category: "normal",
      label: scaledMochiSoldierProfile.label,
      getHealth: () => entry.monster.health,
      getMaxHealth: () => entry.monster.maxHealth,
      onHit: (hit) => {
        if (gameEnded || !entry.monster.isAlive) return;
        const dealt = entry.monster.takeDamage(Math.max(1, Math.round(hit.damage)));
        if (dealt <= 0) return;
        if (!entry.monster.isAlive) {
          removeMonsterEntry(entry, true);
        } else {
          emitState();
        }
      },
    });

    switchMonsterToInstanced(entry);
  };

  const spawnWave = () => {
    const remaining = totalMonsters - spawnedMonsters;
    const batch = Math.min(spawnBatchSize, remaining);
    for (let i = 0; i < batch; i += 1) {
      spawnMonster();
    }
    emitState();
  };

  const clearEntryPath = (entry: SurgeMonsterEntry) => {
    entry.navWaypoints = [];
    entry.navWaypointIndex = 0;
  };

  const moveTowardPosition = (
    entry: SurgeMonsterEntry,
    targetX: number,
    targetZ: number,
    delta: number
  ) => {
    const position = entry.anchor.position;
    const startX = position.x;
    const startZ = position.z;
    const dx = targetX - startX;
    const dz = targetZ - startZ;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0.00001) return 0;

    const step = entry.monster.stats.speed * delta;
    const ratio = Math.min(step / distance, 1);
    const candidateX = startX + dx * ratio;
    const candidateZ = startZ + dz * ratio;
    if (isPointWalkable(candidateX, candidateZ)) {
      position.x = candidateX;
      position.z = candidateZ;
    } else {
      let moved = false;
      const slideX = startX + dx * ratio;
      if (isPointWalkable(slideX, startZ)) {
        position.x = slideX;
        moved = true;
      }
      const slideZ = startZ + dz * ratio;
      if (isPointWalkable(position.x, slideZ)) {
        position.z = slideZ;
        moved = true;
      }
      if (!moved) {
        return 0;
      }
    }

    const movedDistance = Math.hypot(position.x - startX, position.z - startZ);
    if (movedDistance > 0.0001) {
      const moveDx = position.x - startX;
      const moveDz = position.z - startZ;
      entry.anchor.rotation.y = Math.atan2(moveDx, moveDz);
    }
    return movedDistance;
  };

  const navigateTowardTarget = ({
    entry,
    now,
    delta,
    targetX,
    targetZ,
    useFlowField,
    preferDirectLine,
  }: {
    entry: SurgeMonsterEntry;
    now: number;
    delta: number;
    targetX: number;
    targetZ: number;
    useFlowField: boolean;
    preferDirectLine: boolean;
  }) => {
    const position = entry.anchor.position;

    if (
      preferDirectLine &&
      !isSegmentBlocked(position.x, position.z, targetX, targetZ)
    ) {
      clearEntryPath(entry);
      entry.lastNavTargetX = targetX;
      entry.lastNavTargetZ = targetZ;
      entry.nextRepathAt = now + SURGE_NAV_REPATH_INTERVAL_MS;
      return moveTowardPosition(entry, targetX, targetZ, delta);
    }

    if (useFlowField) {
      const flowWaypoint = resolveFlowWaypoint(position.x, position.z);
      if (flowWaypoint) {
        clearEntryPath(entry);
        entry.lastNavTargetX = flowWaypoint.x;
        entry.lastNavTargetZ = flowWaypoint.y;
        entry.nextRepathAt = now + SURGE_NAV_REPATH_INTERVAL_MS;
        return moveTowardPosition(entry, flowWaypoint.x, flowWaypoint.y, delta);
      }
    }

    const targetShifted =
      !Number.isFinite(entry.lastNavTargetX) ||
      !Number.isFinite(entry.lastNavTargetZ) ||
      Math.hypot(targetX - entry.lastNavTargetX, targetZ - entry.lastNavTargetZ) >=
        SURGE_NAV_TARGET_SHIFT_REPATH_DISTANCE;
    const needsRepath =
      entry.navWaypointIndex >= entry.navWaypoints.length ||
      now >= entry.nextRepathAt ||
      targetShifted;

    if (needsRepath) {
      const waypoints = buildPathWaypoints(position.x, position.z, targetX, targetZ);
      entry.navWaypoints = waypoints;
      entry.navWaypointIndex = 0;
      entry.lastNavTargetX = targetX;
      entry.lastNavTargetZ = targetZ;
      entry.nextRepathAt =
        now + SURGE_NAV_REPATH_INTERVAL_MS + Math.random() * 220;
    }

    while (entry.navWaypointIndex < entry.navWaypoints.length) {
      const waypoint = entry.navWaypoints[entry.navWaypointIndex];
      const remaining = Math.hypot(
        waypoint.x - position.x,
        waypoint.z - position.z
      );
      if (remaining <= 0.45) {
        entry.navWaypointIndex += 1;
        continue;
      }
      const movedDistance = moveTowardPosition(
        entry,
        waypoint.x,
        waypoint.z,
        delta
      );
      if (movedDistance <= 0.0001) {
        entry.nextRepathAt = Math.min(entry.nextRepathAt, now + 110);
      }
      return movedDistance;
    }

    return moveTowardPosition(entry, targetX, targetZ, delta);
  };

  const worldTick = ({
    now,
    delta,
    player,
    currentStats,
    applyDamage,
  }: PlayerWorldTickArgs) => {
    daylightPreset.syncSkyToPlayer(player);

    if (!playerDead && currentStats.health <= 0) {
      playerDead = true;
      endGame(false);
    }

    if (!gameEnded && now >= nextSpawnAt && spawnedMonsters < totalMonsters) {
      spawnWave();
      nextSpawnAt = now + spawnIntervalMs;
    }

    player.getWorldPosition(flowTargetWorld);
    maybeUpdateFlowField(flowTargetWorld.x, flowTargetWorld.z, now);
    updateMonsterRenderLod(player, now);
    const aiLodMidDistanceSq = SURGE_AI_LOD_MID_DISTANCE * SURGE_AI_LOD_MID_DISTANCE;
    const aiLodFarDistanceSq = SURGE_AI_LOD_FAR_DISTANCE * SURGE_AI_LOD_FAR_DISTANCE;
    const aiLodVeryFarDistanceSq =
      SURGE_AI_LOD_VERY_FAR_DISTANCE * SURGE_AI_LOD_VERY_FAR_DISTANCE;

    for (let i = monsters.length - 1; i >= 0; i -= 1) {
      const entry = monsters[i];
      if (!entry.monster.isAlive) {
        removeMonsterEntry(entry, true);
        continue;
      }

      let isMoving = false;
      if (!gameEnded) {
        const toPlayerDx = entry.anchor.position.x - flowTargetWorld.x;
        const toPlayerDz = entry.anchor.position.z - flowTargetWorld.z;
        const distanceToPlayerSq = toPlayerDx * toPlayerDx + toPlayerDz * toPlayerDz;
        const aiIntervalMs =
          distanceToPlayerSq >= aiLodVeryFarDistanceSq
            ? SURGE_AI_LOD_VERY_FAR_INTERVAL_MS
            : distanceToPlayerSq >= aiLodFarDistanceSq
              ? SURGE_AI_LOD_FAR_INTERVAL_MS
              : distanceToPlayerSq >= aiLodMidDistanceSq
                ? SURGE_AI_LOD_MID_INTERVAL_MS
                : 0;
        const moveIntervalMs =
          distanceToPlayerSq >= aiLodVeryFarDistanceSq
            ? SURGE_MOVE_LOD_VERY_FAR_INTERVAL_MS
            : distanceToPlayerSq >= aiLodFarDistanceSq
              ? SURGE_MOVE_LOD_FAR_INTERVAL_MS
              : distanceToPlayerSq >= aiLodMidDistanceSq
                ? SURGE_MOVE_LOD_MID_INTERVAL_MS
                : 0;
        const shouldRefreshAiDecision =
          aiIntervalMs <= 0 ||
          now >= entry.nextAiUpdateAt ||
          !entry.cachedTarget ||
          !entry.cachedTarget.parent;

        let resolvedTarget = entry.cachedTarget ?? player;
        if (shouldRefreshAiDecision) {
          resolvedTarget = resolveSlimluThreatTargetForEnemy({
            fallbackTarget: player,
            enemyObject: entry.anchor,
          });
          entry.cachedTarget = resolvedTarget;
          entry.nextAiUpdateAt = now + aiIntervalMs;
        }

        let targetX = flowTargetWorld.x;
        let targetZ = flowTargetWorld.z;
        if (resolvedTarget !== player) {
          resolvedTarget.getWorldPosition(targetWorldScratch);
          targetX = targetWorldScratch.x;
          targetZ = targetWorldScratch.z;
        }
        const dxToTarget = targetX - entry.anchor.position.x;
        const dzToTarget = targetZ - entry.anchor.position.z;
        const detectRange = Math.max(entry.monster.stats.aggroRange, surgePursuitRange);
        const distance = Math.hypot(dxToTarget, dzToTarget);
        if (distance <= detectRange) {
          const shouldMoveUpdate =
            moveIntervalMs <= 0 || now >= entry.nextMoveUpdateAt;
          if (shouldMoveUpdate) {
            entry.nextMoveUpdateAt = now + moveIntervalMs;
          }

          if (distance > entry.monster.stats.attackRange + 0.15) {
            if (shouldMoveUpdate) {
              const effectiveDelta =
                moveIntervalMs <= 0
                  ? delta
                  : Math.min(0.12, delta + moveIntervalMs / 1000);
              const movedDistance = navigateTowardTarget({
                entry,
                now,
                delta: effectiveDelta,
                targetX,
                targetZ,
                useFlowField: resolvedTarget === player,
                preferDirectLine:
                  resolvedTarget !== player ||
                  distanceToPlayerSq <= aiLodMidDistanceSq,
              });
              isMoving = movedDistance > 0.0001;
            }
          } else {
            clearEntryPath(entry);
          }

          if (shouldRefreshAiDecision || aiIntervalMs <= 0) {
            if (dxToTarget * dxToTarget + dzToTarget * dzToTarget > 0.000001) {
              entry.anchor.rotation.y = Math.atan2(dxToTarget, dzToTarget);
            }

            if (
              distance <= entry.monster.stats.attackRange + 0.15 &&
              now - entry.lastAttackAt >= mochiSoldierCombatConfig.attackCooldownMs
            ) {
              const canMeleeAttack = !isSegmentBlocked(
                entry.anchor.position.x,
                entry.anchor.position.z,
                targetX,
                targetZ
              );
              if (canMeleeAttack) {
                applyDamageToSlimluThreatOrPlayer({
                  target: resolvedTarget,
                  amount: entry.monster.stats.attack,
                  applyPlayerDamage: applyDamage,
                });
                entry.lastAttackAt = now;
              }
            }
          }
        } else {
          clearEntryPath(entry);
        }
      }

      applyMonsterWalkAnimation(entry, delta, isMoving);
    }
    updateInstancedEntries();
    deathFxRuntime.update(delta);

    emitState();
  };

  let isDisposed = false;
  const loader = new GLTFLoader();
  loader.load(
    "/assets/monsters/mochiSoldier/mochiSoldier.glb",
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        disposeObjectResources(gltf.scene);
        return;
      }

      mochiSoldierPrototype = gltf.scene;
      const modelBounds = new THREE.Box3().setFromObject(mochiSoldierPrototype);
      const modelHeight = Math.max(0.001, modelBounds.max.y - modelBounds.min.y);
      const targetHeight = 2.5;
      mochiSoldierPrototype.scale.setScalar(targetHeight / modelHeight);
      mochiSoldierPrototype.updateMatrixWorld(true);

      modelBounds.setFromObject(mochiSoldierPrototype);
      mochiSoldierPrototype.position.y -= modelBounds.min.y;
      mochiSoldierPrototype.updateMatrixWorld(true);

      trackObject(mochiSoldierPrototype, {
        castShadow: false,
        receiveShadow: false,
      });
      nextRenderLodUpdateAt = 0;
    },
    undefined,
    () => {}
  );

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
    onPlayerReset: streetWorld.onPlayerReset,
  };

  const dispose = () => {
    isDisposed = true;
    context?.onStateChange?.({});
    while (monsters.length > 0) {
      removeMonsterEntry(monsters[0], false);
    }
    deathFxRuntime.dispose();
    attackTargets.length = 0;
    scene.remove(monstersGroup);
    daylightPreset.dispose();
    disposeTrackedResources();
    streetSetup.dispose?.();
  };

  return { world, dispose };
};

