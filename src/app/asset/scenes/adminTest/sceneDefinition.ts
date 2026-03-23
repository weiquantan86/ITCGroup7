import * as THREE from "three";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../../entity/character/general/player";
import {
  createUnifiedMonsterRuntime,
} from "../../entity/monster/unified/registry";
import type { UnifiedMonsterState } from "../../entity/monster/unified/types";
import { createSceneResourceTracker } from "../general/resourceTracker";
import type {
  SceneDefinition,
  SceneSetupContext,
  SceneSetupResult,
} from "../general/sceneTypes";

export type AdminTestMonsterOption = {
  id: string;
  label: string;
  path: string;
};

export const ADMIN_TEST_SCENE_STATE_KEY = "adminTestState";

export type AdminTestSceneUiState = UnifiedMonsterState;

const GROUND_Y = -1.4;
const ARENA_SIZE = 84;
const UI_EMIT_INTERVAL_MS = 120;

export const createAdminTestSceneDefinition = (
  monster: AdminTestMonsterOption
): SceneDefinition => ({
  id: `adminTest:${monster.id}`,
  setupScene: (scene, context) => createAdminTestScene(scene, context, monster),
});

const createAdminTestScene = (
  scene: THREE.Scene,
  context: SceneSetupContext | undefined,
  monster: AdminTestMonsterOption
): SceneSetupResult => {
  scene.background = new THREE.Color(0x08101f);
  scene.fog = new THREE.Fog(0x08101f, 45, 150);

  const bounds = {
    minX: -ARENA_SIZE / 2 + 2.4,
    maxX: ARENA_SIZE / 2 - 2.4,
    minZ: -ARENA_SIZE / 2 + 2.4,
    maxZ: ARENA_SIZE / 2 - 2.4,
  };
  const isBlocked = (x: number, z: number) =>
    x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ;

  const resourceTracker = createSceneResourceTracker();
  const { trackMesh, disposeTrackedResources } = resourceTracker;

  const arenaGroup = new THREE.Group();
  scene.add(arenaGroup);

  const ambient = new THREE.AmbientLight(0xe2ecff, 0.52);
  const hemi = new THREE.HemisphereLight(0xe2ecff, 0x0b1527, 0.64);
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(-12, 17, 10);
  const rim = new THREE.DirectionalLight(0x93c5fd, 0.42);
  rim.position.set(12, 10, -9);
  arenaGroup.add(ambient, hemi, key, rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
    new THREE.MeshStandardMaterial({
      color: 0x1a2438,
      roughness: 0.86,
      metalness: 0.12,
      emissive: 0x0f172a,
      emissiveIntensity: 0.2,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = GROUND_Y;
  floor.receiveShadow = true;
  arenaGroup.add(floor);
  trackMesh(floor);

  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.1, 48),
    new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.22,
    })
  );
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = GROUND_Y + 0.02;
  arenaGroup.add(centerRing);
  trackMesh(centerRing);

  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.5,
    metalness: 0.22,
    emissive: 0x1e293b,
    emissiveIntensity: 0.2,
  });
  const horizontalBorder = new THREE.BoxGeometry(ARENA_SIZE, 0.24, 0.7);
  const verticalBorder = new THREE.BoxGeometry(0.7, 0.24, ARENA_SIZE);
  const topBorder = new THREE.Mesh(horizontalBorder, borderMaterial);
  topBorder.position.set(0, GROUND_Y + 0.12, bounds.minZ);
  const bottomBorder = new THREE.Mesh(horizontalBorder, borderMaterial);
  bottomBorder.position.set(0, GROUND_Y + 0.12, bounds.maxZ);
  const leftBorder = new THREE.Mesh(verticalBorder, borderMaterial);
  leftBorder.position.set(bounds.minX, GROUND_Y + 0.12, 0);
  const rightBorder = new THREE.Mesh(verticalBorder, borderMaterial);
  rightBorder.position.set(bounds.maxX, GROUND_Y + 0.12, 0);
  arenaGroup.add(topBorder, bottomBorder, leftBorder, rightBorder);
  trackMesh(topBorder);
  trackMesh(bottomBorder);
  trackMesh(leftBorder);
  trackMesh(rightBorder);

  const projectileColliders: THREE.Object3D[] = [
    floor,
    topBorder,
    bottomBorder,
    leftBorder,
    rightBorder,
  ];
  const attackTargets: PlayerAttackTarget[] = [];

  const unifiedRuntime = createUnifiedMonsterRuntime({
    scene,
    hostGroup: arenaGroup,
    resourceTracker,
    monster,
    groundY: GROUND_Y,
    spawnPosition: new THREE.Vector3(0, GROUND_Y, 0),
    bounds,
    isBlocked,
    attackTargets,
  });

  const worldProjectileColliders = [
    ...projectileColliders,
    ...(unifiedRuntime.getProjectileColliders?.() ?? []),
  ];

  let nextUiEmitAt = 0;
  let lastUiSnapshot = "";
  const emitState = (force = false, now = performance.now()) => {
    if (!force && now < nextUiEmitAt) return;
    nextUiEmitAt = now + UI_EMIT_INTERVAL_MS;
    const state = unifiedRuntime.getState();
    const snapshot = `${state.monsterId}|${state.monsterHealth}|${state.monsterMaxHealth}|${
      state.monsterAlive ? "1" : "0"
    }`;
    if (!force && snapshot === lastUiSnapshot) return;
    lastUiSnapshot = snapshot;
    context?.onStateChange?.({
      [ADMIN_TEST_SCENE_STATE_KEY]: state,
    });
  };

  const worldTick = (args: PlayerWorldTickArgs) => {
    unifiedRuntime.tick(args);
    emitState(false, args.now);
  };

  const world: PlayerWorld = {
    sceneId: "adminTest",
    groundY: GROUND_Y,
    playerSpawn: new THREE.Vector3(0, GROUND_Y, 26),
    bounds,
    projectileColliders: worldProjectileColliders,
    attackTargets,
    isBlocked,
    onTick: worldTick,
    onPlayerDeath: ({ gameMode, now, resetPlayer }) => {
      if (gameMode !== "adminTest") return "ignore";
      resetPlayer();
      unifiedRuntime.reset(now);
      emitState(true, now);
      return "handled";
    },
    onPlayerReset: () => {
      unifiedRuntime.reset(performance.now());
      emitState(true);
    },
  };

  emitState(true);

  const dispose = () => {
    context?.onStateChange?.({});
    unifiedRuntime.dispose();
    attackTargets.length = 0;
    scene.remove(arenaGroup);
    disposeTrackedResources();
  };

  return { world, dispose };
};

