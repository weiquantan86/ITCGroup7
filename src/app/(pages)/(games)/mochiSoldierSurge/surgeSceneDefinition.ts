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
  type MochiSoldierSurgeState,
} from "./surgeConfig";

type SurgeMonsterEntry = {
  id: string;
  anchor: THREE.Group;
  hitbox: THREE.Mesh;
  fallback: THREE.Mesh;
  model: THREE.Object3D | null;
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
const SURGE_NAV_LINE_SAMPLE_STEP = 0.55;
const SURGE_NAV_REPATH_INTERVAL_MS = 520;
const SURGE_NAV_TARGET_SHIFT_REPATH_DISTANCE = 1.3;
const SURGE_NAV_MAX_EXPANSIONS = 3200;

export const createMochiSoldierSurgeScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext
): SceneSetupResult => {
  const streetSetup = createMochiStreetScene(scene);
  const streetWorld = streetSetup.world;
  if (!streetWorld) return streetSetup;

  const bounds = streetWorld.bounds ?? fallbackBounds;
  const worldIsBlocked = streetWorld.isBlocked ?? (() => false);
  const groundY = streetWorld.groundY;

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

  const monsters: SurgeMonsterEntry[] = [];
  const attackTargets: PlayerAttackTarget[] = [];

  let spawnedMonsters = 0;
  let aliveMonsters = 0;
  let defeatedMonsters = 0;
  let nextSpawnAt = performance.now() + SURGE_SPAWN_INTERVAL_MS;
  let playerDead = false;
  let gameEnded = false;
  let victory = false;

  const buildState = (): MochiSoldierSurgeState => ({
    totalMonsters: SURGE_TOTAL_MONSTERS,
    spawnedMonsters,
    aliveMonsters,
    defeatedMonsters,
    playerDead,
    gameEnded,
    victory,
  });

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
    const minX = bounds.minX + SURGE_EDGE_SPAWN_PADDING;
    const maxX = bounds.maxX - SURGE_EDGE_SPAWN_PADDING;
    const minZ = bounds.minZ + SURGE_EDGE_SPAWN_PADDING;
    const maxZ = bounds.maxZ - SURGE_EDGE_SPAWN_PADDING;

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
      if (!worldIsBlocked(x, z)) {
        return new THREE.Vector3(x, groundY, z);
      }
    }

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = randomBetween(bounds.minX + 2, bounds.maxX - 2);
      const z = randomBetween(bounds.minZ + 2, bounds.maxZ - 2);
      if (!worldIsBlocked(x, z)) {
        return new THREE.Vector3(x, groundY, z);
      }
    }

    return new THREE.Vector3(0, groundY, 0);
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
    trackObject(model, { castShadow: true, receiveShadow: true });
    entry.model = model;
    entry.rig = resolveMonsterRig(model);
    entry.fallback.visible = false;
    entry.monster.invalidateHitFlashMaterialCache();
  };

  const handleMonsterDefeated = () => {
    defeatedMonsters += 1;
    aliveMonsters = Math.max(0, aliveMonsters - 1);

    if (defeatedMonsters >= SURGE_TOTAL_MONSTERS) {
      endGame(true);
      return;
    }

    emitState();
  };

  const spawnMonster = () => {
    if (spawnedMonsters >= SURGE_TOTAL_MONSTERS) return;

    const spawnPosition = resolveEdgeSpawnPosition();
    const anchor = new THREE.Group();
    anchor.position.copy(spawnPosition);
    monstersGroup.add(anchor);

    const fallback = new THREE.Mesh(
      fallbackGeometry,
      fallbackMaterialTemplate.clone()
    );
    fallback.position.set(0, 1.16, 0);
    fallback.castShadow = true;
    fallback.receiveShadow = true;
    anchor.add(fallback);
    trackMesh(fallback);

    const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterialTemplate.clone());
    hitbox.position.set(0, 1.16, 0);
    anchor.add(hitbox);
    trackMesh(hitbox);

    const edgeHitbox = new THREE.Mesh(
      edgeHitboxGeometry,
      hitboxMaterialTemplate.clone()
    );
    edgeHitbox.position.set(0, 1.2, 0);
    anchor.add(edgeHitbox);
    trackMesh(edgeHitbox);

    const entry: SurgeMonsterEntry = {
      id: `mochi-surge-${spawnedMonsters + 1}`,
      anchor,
      hitbox,
      fallback,
      model: null,
      monster: new Monster({
        model: anchor,
        profile: mochiSoldierProfile,
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
      label: mochiSoldierProfile.label,
      getHealth: () => entry.monster.health,
      getMaxHealth: () => entry.monster.maxHealth,
      onHit: (hit) => {
        if (gameEnded || !entry.monster.isAlive) return;
        const dealt = entry.monster.takeDamage(Math.max(1, Math.round(hit.damage)));
        if (dealt <= 0) return;
        if (!entry.monster.isAlive) {
          entry.anchor.visible = false;
          handleMonsterDefeated();
        } else {
          emitState();
        }
      },
    });

    attachPrototypeToMonster(entry);
  };

  const spawnWave = () => {
    const remaining = SURGE_TOTAL_MONSTERS - spawnedMonsters;
    const batch = Math.min(SURGE_SPAWN_BATCH_SIZE, remaining);
    for (let i = 0; i < batch; i += 1) {
      spawnMonster();
    }
    emitState();
  };

  const navTargetScratch = new THREE.Vector3();
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

  const navigateTowardPlayer = (
    entry: SurgeMonsterEntry,
    player: THREE.Object3D,
    now: number,
    delta: number
  ) => {
    player.getWorldPosition(navTargetScratch);
    const targetX = navTargetScratch.x;
    const targetZ = navTargetScratch.z;
    const position = entry.anchor.position;

    if (!isSegmentBlocked(position.x, position.z, targetX, targetZ)) {
      clearEntryPath(entry);
      entry.lastNavTargetX = targetX;
      entry.lastNavTargetZ = targetZ;
      entry.nextRepathAt = now + SURGE_NAV_REPATH_INTERVAL_MS;
      return moveTowardPosition(entry, targetX, targetZ, delta);
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
    if (!playerDead && currentStats.health <= 0) {
      playerDead = true;
      endGame(false);
    }

    if (!gameEnded && now >= nextSpawnAt && spawnedMonsters < SURGE_TOTAL_MONSTERS) {
      spawnWave();
      nextSpawnAt = now + SURGE_SPAWN_INTERVAL_MS;
    }

    for (let i = 0; i < monsters.length; i += 1) {
      const entry = monsters[i];
      if (!entry.monster.isAlive) continue;

      let isMoving = false;
      if (!gameEnded) {
        const detectRange = entry.monster.stats.aggroRange;
        let distance = entry.monster.distanceTo(player);
        if (distance <= detectRange) {
          if (distance > entry.monster.stats.attackRange + 0.15) {
            const movedDistance = navigateTowardPlayer(entry, player, now, delta);
            distance = entry.monster.distanceTo(player);
            isMoving = movedDistance > 0.0001;
          } else {
            clearEntryPath(entry);
          }

          entry.monster.faceTarget(player);
          player.getWorldPosition(navTargetScratch);
          const canMeleeAttack = !isSegmentBlocked(
            entry.anchor.position.x,
            entry.anchor.position.z,
            navTargetScratch.x,
            navTargetScratch.z
          );

          if (
            distance <= entry.monster.stats.attackRange + 0.15 &&
            canMeleeAttack &&
            now - entry.lastAttackAt >= mochiSoldierCombatConfig.attackCooldownMs
          ) {
            applyDamage(entry.monster.stats.attack);
            entry.lastAttackAt = now;
          }
        } else {
          clearEntryPath(entry);
        }
      }

      applyMonsterWalkAnimation(entry, delta, isMoving);
    }

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
        castShadow: true,
        receiveShadow: true,
      });
      monsters.forEach((monsterEntry) => attachPrototypeToMonster(monsterEntry));
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
    monsters.forEach((entry) => entry.monster.dispose());
    monsters.length = 0;
    attackTargets.length = 0;
    scene.remove(monstersGroup);
    disposeTrackedResources();
    streetSetup.dispose?.();
  };

  return { world, dispose };
};
