import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../../../asset/entity/character/general/player";
import { Monster } from "../../../asset/entity/monster/general";
import type { MochiGeneralCombatEntry } from "../../../asset/entity/monster/mochiGeneral/combatBehavior";
import {
  createMochiGeneralCombatState,
  resetMochiGeneralCombatState,
  resolveMochiGeneralRig,
  tickMochiGeneralCombat,
} from "../../../asset/entity/monster/mochiGeneral/combatBehavior";
import { mochiGeneralProfile } from "../../../asset/entity/monster/mochiGeneral/profile";
import { createMochiFactoryScene } from "../../../asset/scenes/mochiFactory/sceneDefinition";
import type {
  SceneSetupContext,
  SceneSetupResult,
} from "../../../asset/scenes/general/sceneTypes";
import {
  SURGE_SCENE_STATE_KEY,
  SURGE_TOTAL_MONSTERS,
  type MochiSoldierSurgeState,
} from "./battleConfig";

type BossEntry = {
  id: string;
  hitbox: THREE.Mesh;
} & MochiGeneralCombatEntry;

type EntranceSmokeParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

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

export const createMochiGeneralBattleScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext
): SceneSetupResult => {
  const factorySetup = createMochiFactoryScene(scene);
  const factoryWorld = factorySetup.world;
  if (!factoryWorld) return factorySetup;

  const bounds = factoryWorld.bounds ?? fallbackBounds;
  const worldIsBlocked = factoryWorld.isBlocked ?? (() => false);
  const groundY = factoryWorld.groundY;

  const bossesGroup = new THREE.Group();
  bossesGroup.name = "mochiGeneralBosses";
  scene.add(bossesGroup);
  const smokeGroup = new THREE.Group();
  smokeGroup.name = "mochiGeneralEntranceSmoke";
  scene.add(smokeGroup);

  const extraGeometries = new Set<THREE.BufferGeometry>();
  const extraMaterials = new Set<THREE.Material>();

  const trackMesh = (mesh: THREE.Mesh) => {
    extraGeometries.add(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => extraMaterials.add(material));
    } else {
      extraMaterials.add(mesh.material);
    }
  };

  const trackObject = (object: THREE.Object3D) => {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      trackMesh(mesh);
    });
  };

  const disposeObjectResources = (object: THREE.Object3D) => {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose?.();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material?.dispose?.();
      }
    });
  };

  const fallbackGeometry = new THREE.CapsuleGeometry(2.1375, 3.0375, 7, 16);
  const fallbackMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xddd6fe,
    roughness: 0.34,
    metalness: 0.12,
    emissive: 0x581c87,
    emissiveIntensity: 0.18,
  });
  const hitboxGeometry = new THREE.CapsuleGeometry(2.8125, 4.32, 7, 14);
  const hitboxMaterialTemplate = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const smokeGeometry = new THREE.SphereGeometry(1, 12, 10);
  const smokeMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0x7a8597,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    emissive: 0x111827,
    emissiveIntensity: 0.24,
  });
  extraGeometries.add(fallbackGeometry);
  extraGeometries.add(hitboxGeometry);
  extraGeometries.add(smokeGeometry);
  extraMaterials.add(fallbackMaterialTemplate);
  extraMaterials.add(hitboxMaterialTemplate);
  extraMaterials.add(smokeMaterialTemplate);

  const bosses: BossEntry[] = [];
  const entranceSmokeParticles: EntranceSmokeParticle[] = [];
  const attackTargets: PlayerAttackTarget[] = [];

  let spawnedMonsters = 0;
  let aliveMonsters = 0;
  let defeatedMonsters = 0;
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

  const removeAttackTarget = (id: string) => {
    const index = attackTargets.findIndex((target) => target.id === id);
    if (index < 0) return;
    attackTargets.splice(index, 1);
  };

  const clearBossVisual = (entry: BossEntry) => {
    if (entry.model) {
      entry.anchor.remove(entry.model);
      disposeObjectResources(entry.model);
      entry.model = null;
    }
    resetMochiGeneralCombatState(entry);
    if (entry.fallback.parent === entry.anchor) {
      entry.anchor.remove(entry.fallback);
    }
    if (entry.hitbox.parent === entry.anchor) {
      entry.anchor.remove(entry.hitbox);
    }
  };

  const removeBossEntry = (entry: BossEntry) => {
    removeAttackTarget(entry.id);
    clearBossVisual(entry);
    entry.monster.dispose();
    if (entry.anchor.parent === bossesGroup) {
      bossesGroup.remove(entry.anchor);
    }
    const index = bosses.indexOf(entry);
    if (index >= 0) {
      bosses.splice(index, 1);
    }
  };

  const spawnBossEntranceSmoke = (center: THREE.Vector3) => {
    const denseSmokeCount = 96;
    for (let i = 0; i < denseSmokeCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 5.2;
      const outwardSpeed = 2.1 + Math.random() * 6.2;
      const upwardSpeed = 2.6 + Math.random() * 6.8;
      const life = 1.1 + Math.random() * 1.4;
      const startScale = 1.1 + Math.random() * 2.2;
      const endScale = startScale * (2.7 + Math.random() * 1.9);

      const material = smokeMaterialTemplate.clone();
      const brightness = 0.78 + Math.random() * 0.34;
      material.color.multiplyScalar(brightness);
      material.opacity = 0.5 + Math.random() * 0.38;

      const puff = new THREE.Mesh(smokeGeometry, material);
      puff.position.set(
        center.x + Math.cos(angle) * radius,
        groundY + 0.35 + Math.random() * 2.8,
        center.z + Math.sin(angle) * radius
      );
      puff.castShadow = false;
      puff.receiveShadow = false;
      puff.scale.setScalar(startScale);

      const velocity = new THREE.Vector3(
        Math.cos(angle) * outwardSpeed + (Math.random() - 0.5) * 1.2,
        upwardSpeed,
        Math.sin(angle) * outwardSpeed + (Math.random() - 0.5) * 1.2
      );
      const spin = new THREE.Vector3(
        (Math.random() - 0.5) * 2.8,
        (Math.random() - 0.5) * 2.8,
        (Math.random() - 0.5) * 2.8
      );

      smokeGroup.add(puff);
      entranceSmokeParticles.push({
        mesh: puff,
        material,
        velocity,
        spin,
        age: 0,
        life,
        startScale,
        endScale,
      });
    }
  };

  const updateEntranceSmoke = (delta: number) => {
    for (let i = entranceSmokeParticles.length - 1; i >= 0; i -= 1) {
      const particle = entranceSmokeParticles[i];
      particle.age += delta;
      const t = particle.life > 0 ? particle.age / particle.life : 1;

      if (t >= 1) {
        if (particle.mesh.parent) {
          particle.mesh.parent.remove(particle.mesh);
        }
        particle.material.dispose();
        entranceSmokeParticles.splice(i, 1);
        continue;
      }

      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.multiplyScalar(0.986);
      particle.velocity.y += 0.62 * delta;

      particle.mesh.rotation.x += particle.spin.x * delta;
      particle.mesh.rotation.y += particle.spin.y * delta;
      particle.mesh.rotation.z += particle.spin.z * delta;

      const scale = THREE.MathUtils.lerp(
        particle.startScale,
        particle.endScale,
        t
      );
      particle.mesh.scale.setScalar(scale);

      const fade = Math.max(0, 1 - t);
      particle.material.opacity = fade * fade * 0.82;
    }
  };

  const handleBossDefeated = (entry: BossEntry) => {
    if (gameEnded) return;
    aliveMonsters = Math.max(0, aliveMonsters - 1);
    defeatedMonsters += 1;
    removeBossEntry(entry);
    if (defeatedMonsters >= SURGE_TOTAL_MONSTERS) {
      endGame(true);
    } else {
      emitState();
    }
  };

  let mochiGeneralPrototype: THREE.Object3D | null = null;
  const attachPrototypeToBoss = (entry: BossEntry) => {
    if (!mochiGeneralPrototype || entry.model || !entry.monster.isAlive) return;
    const model = cloneSkeleton(mochiGeneralPrototype);
    model.name = `${entry.id}-model`;
    model.visible = true;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.copy(mochiGeneralPrototype.scale);
    trackObject(model);
    entry.anchor.add(model);
    entry.model = model;
    entry.rig = resolveMochiGeneralRig(model);
    entry.fallback.visible = false;
  };

  const spawnBoss = (position: THREE.Vector3) => {
    if (spawnedMonsters >= SURGE_TOTAL_MONSTERS) return;

    const id = `mochi-general-${spawnedMonsters + 1}`;
    const anchor = new THREE.Group();
    anchor.name = `${id}-anchor`;
    anchor.position.copy(position);
    bossesGroup.add(anchor);

    const fallback = new THREE.Mesh(
      fallbackGeometry,
      fallbackMaterialTemplate.clone()
    );
    fallback.name = `${id}-fallback`;
    fallback.position.y = 2.745;
    fallback.castShadow = true;
    fallback.receiveShadow = true;
    anchor.add(fallback);

    const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterialTemplate.clone());
    hitbox.name = `${id}-hitbox`;
    hitbox.position.y = 3.0375;
    hitbox.castShadow = false;
    hitbox.receiveShadow = false;
    anchor.add(hitbox);

    trackMesh(fallback);
    trackMesh(hitbox);

    const monster = new Monster({
      model: anchor,
      profile: mochiGeneralProfile,
      spawn: {
        position: position.clone(),
        yaw: Math.PI,
      },
    });

    const entry: BossEntry = {
      id,
      anchor,
      hitbox,
      fallback,
      model: null,
      monster,
      ...createMochiGeneralCombatState(),
    };

    bosses.push(entry);
    spawnedMonsters += 1;
    aliveMonsters += 1;

    attackTargets.push({
      id,
      object: hitbox,
      isActive: () => !gameEnded && entry.monster.isAlive,
      category: "boss",
      label: mochiGeneralProfile.label,
      getHealth: () => entry.monster.health,
      getMaxHealth: () => entry.monster.maxHealth,
      onHit: (hit) => {
        if (gameEnded || !entry.monster.isAlive) return;
        const applied = entry.monster.takeDamage(hit.damage);
        if (applied <= 0) return;
        if (!entry.monster.isAlive) {
          handleBossDefeated(entry);
        }
      },
    });

    attachPrototypeToBoss(entry);
    spawnBossEntranceSmoke(position);
    emitState();
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
  }: PlayerWorldTickArgs) => {
    if (!playerDead && currentStats.health <= 0) {
      playerDead = true;
      endGame(false);
      return;
    }
    if (!bossSpawned && !gameEnded && now >= bossSpawnAt) {
      bossSpawned = true;
      spawnBoss(bossSpawnPosition);
    }

    for (let i = 0; i < bosses.length; i += 1) {
      const entry = bosses[i];
      if (!entry.monster.isAlive) continue;
      tickMochiGeneralCombat({
        entry,
        delta,
        player,
        gameEnded,
        isBlocked: worldIsBlocked,
      });
    }

    updateEntranceSmoke(delta);
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

      mochiGeneralPrototype = gltf.scene;
      const modelBounds = new THREE.Box3().setFromObject(mochiGeneralPrototype);
      const modelHeight = Math.max(0.001, modelBounds.max.y - modelBounds.min.y);
      const targetHeight = 6.975;
      mochiGeneralPrototype.scale.setScalar(targetHeight / modelHeight);
      mochiGeneralPrototype.updateMatrixWorld(true);

      modelBounds.setFromObject(mochiGeneralPrototype);
      mochiGeneralPrototype.position.y -= modelBounds.min.y;
      mochiGeneralPrototype.updateMatrixWorld(true);

      trackObject(mochiGeneralPrototype);
      for (let i = 0; i < bosses.length; i += 1) {
        attachPrototypeToBoss(bosses[i]);
      }
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
    for (let i = entranceSmokeParticles.length - 1; i >= 0; i -= 1) {
      const particle = entranceSmokeParticles[i];
      if (particle.mesh.parent) {
        particle.mesh.parent.remove(particle.mesh);
      }
      particle.material.dispose();
    }
    entranceSmokeParticles.length = 0;
    while (bosses.length > 0) {
      removeBossEntry(bosses[0]);
    }
    attackTargets.length = 0;
    scene.remove(bossesGroup);
    scene.remove(smokeGroup);
    extraGeometries.forEach((geometry) => geometry.dispose());
    extraMaterials.forEach((material) => material.dispose());
    factorySetup.dispose?.();
  };

  return { world, dispose };
};
