import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../asset/character/player";
import { Monster } from "../asset/monster/general";

export interface SceneSetupResult {
  world?: PlayerWorld;
  dispose?: () => void;
}

export interface SceneUiState {
  tester?: {
    health: number;
    maxHealth: number;
    alive: boolean;
  };
}

export interface SceneSetupContext {
  onStateChange?: (state: SceneUiState) => void;
}

export interface SceneDefinition {
  id: string;
  setupScene: (scene: THREE.Scene, context?: SceneSetupContext) => SceneSetupResult;
}

const createGrassScene = (scene: THREE.Scene): SceneSetupResult => {
  scene.background = new THREE.Color(0x0b0f1a);
  scene.fog = new THREE.Fog(0x0b0f1a, 10, 32);
  const groundSize = { width: 120, depth: 120 };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize.width, groundSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.98,
      metalness: 0.02,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.4;
  ground.receiveShadow = true;
  scene.add(ground);

  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(26, 64),
    new THREE.MeshStandardMaterial({
      color: 0x1f4d2b,
      roughness: 0.95,
      metalness: 0,
    })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -1.39;
  grass.receiveShadow = true;
  scene.add(grass);

  const trees = new THREE.Group();
  const treeColliders: { position: THREE.Vector3; radius: number }[] = [];
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b2e12,
    roughness: 0.95,
    metalness: 0.05,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f5132,
    roughness: 0.7,
    metalness: 0.1,
  });
  for (let i = 0; i < 28; i += 1) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 2.8, 10),
      trunkMaterial
    );
    trunk.castShadow = true;
    trunk.position.y = 0.0;
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(1.2 + Math.random() * 0.7, 3.4, 12),
      leafMaterial
    );
    canopy.castShadow = true;
    canopy.position.y = 1.8;
    const tree = new THREE.Group();
    tree.add(trunk, canopy);
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 12;
    tree.position.set(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );
    tree.scale.setScalar(1.2 + Math.random() * 0.45);
    trees.add(tree);
    treeColliders.push({
      position: tree.position,
      radius: 1.05 * tree.scale.x,
    });
  }
  scene.add(trees);

  const world: PlayerWorld = {
    groundY: ground.position.y,
    bounds: {
      minX: -groundSize.width / 2 + 3,
      maxX: groundSize.width / 2 - 3,
      minZ: -groundSize.depth / 2 + 3,
      maxZ: groundSize.depth / 2 - 3,
    },
    projectileColliders: [ground, trees],
    isBlocked: (x, z) => {
      for (let i = 0; i < treeColliders.length; i += 1) {
        const collider = treeColliders[i];
        const dx = x - collider.position.x;
        const dz = z - collider.position.z;
        if (dx * dx + dz * dz < (collider.radius + 0.45) ** 2) {
          return true;
        }
      }
      return false;
    },
  };

  const dispose = () => {
    scene.remove(ground);
    scene.remove(grass);
    scene.remove(trees);
    ground.geometry.dispose();
    ground.material.dispose();
    grass.geometry.dispose();
    grass.material.dispose();
    trunkMaterial.dispose();
    leafMaterial.dispose();
    trees.children.forEach((tree) => {
      tree.children.forEach((child) => {
        child.geometry.dispose();
      });
    });
  };

  return { world, dispose };
};

const createRangeScene = (scene: THREE.Scene): SceneSetupResult => {
  scene.background = new THREE.Color(0x090d15);
  scene.fog = new THREE.Fog(0x090d15, 12, 38);

  const groundY = -1.4;
  const floorSize = { width: 90, depth: 60 };
  const bounds = {
    minX: -floorSize.width / 2 + 2,
    maxX: floorSize.width / 2 - 2,
    minZ: -floorSize.depth / 2 + 2,
    maxZ: floorSize.depth / 2 - 2,
  };

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  const trackMesh = (mesh: THREE.Mesh) => {
    geometries.add(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => materials.add(material));
    } else {
      materials.add(mesh.material);
    }
  };

  const rangeGroup = new THREE.Group();
  scene.add(rangeGroup);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorSize.width, floorSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.95,
      metalness: 0.05,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = groundY;
  floor.receiveShadow = true;
  rangeGroup.add(floor);
  trackMesh(floor);

  const laneMaterial = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.8,
    metalness: 0.25,
    emissive: 0x0b1220,
    emissiveIntensity: 0.3,
  });
  const laneGeometry = new THREE.BoxGeometry(0.18, 0.04, 46);
  [-7, 0, 7].forEach((x) => {
    const lane = new THREE.Mesh(laneGeometry, laneMaterial);
    lane.position.set(x, groundY + 0.02, -2);
    lane.receiveShadow = true;
    rangeGroup.add(lane);
    trackMesh(lane);
  });

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.92,
    metalness: 0.08,
  });
  const sideWallGeometry = new THREE.BoxGeometry(
    2,
    6,
    bounds.maxZ - bounds.minZ + 6
  );
  const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  leftWall.position.set(bounds.minX - 2, groundY + 3, -4);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  rangeGroup.add(leftWall);
  trackMesh(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  rightWall.position.set(bounds.maxX + 2, groundY + 3, -4);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  rangeGroup.add(rightWall);
  trackMesh(rightWall);

  const backWallGeometry = new THREE.BoxGeometry(
    bounds.maxX - bounds.minX + 6,
    7,
    2
  );
  const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
  backWall.position.set(0, groundY + 3.5, bounds.minZ - 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  rangeGroup.add(backWall);
  trackMesh(backWall);

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.7,
    metalness: 0.35,
  });
  const railGeometry = new THREE.BoxGeometry(0.4, 0.6, 46);
  [-3.6, 3.6].forEach((x) => {
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    rail.position.set(x, groundY + 0.3, -2);
    rail.castShadow = true;
    rail.receiveShadow = true;
    rangeGroup.add(rail);
    trackMesh(rail);
  });

  const createTarget = (x: number) => {
    const standMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8,
      metalness: 0.3,
    });
    const boardMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      roughness: 0.85,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
    const group = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.4, 0.6),
      standMaterial
    );
    base.position.set(0, groundY + 0.2, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    trackMesh(base);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 2.6, 12),
      standMaterial
    );
    pole.position.set(0, groundY + 1.55, 0);
    pole.castShadow = true;
    pole.receiveShadow = true;
    group.add(pole);
    trackMesh(pole);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 3.2, 0.2),
      boardMaterial
    );
    board.position.set(0, groundY + 3, 0.3);
    board.castShadow = true;
    board.receiveShadow = true;
    group.add(board);
    trackMesh(board);

    const ringColors = [0x0f172a, 0xe11d48, 0xf8fafc, 0xe11d48, 0xf8fafc];
    const ringSizes = [1.15, 0.9, 0.62, 0.36, 0.16];
    ringSizes.forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 32),
        new THREE.MeshStandardMaterial({
          color: ringColors[index],
          roughness: 0.5,
          metalness: 0.05,
          side: THREE.DoubleSide,
        })
      );
      ring.position.set(0, groundY + 3, 0.42 + index * 0.02);
      group.add(ring);
      trackMesh(ring);
    });

    group.position.set(x, 0, bounds.minZ + 1.2);
    return group;
  };

  [-8, 0, 8].forEach((x) => {
    const target = createTarget(x);
    rangeGroup.add(target);
  });

  const world: PlayerWorld = {
    groundY,
    bounds,
    projectileColliders: [rangeGroup],
    isBlocked: (x, z) =>
      x < bounds.minX ||
      x > bounds.maxX ||
      z < bounds.minZ ||
      z > bounds.maxZ,
  };

  const dispose = () => {
    scene.remove(rangeGroup);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  };

  return { world, dispose };
};

const createTrainingScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext
): SceneSetupResult => {
  scene.background = new THREE.Color(0x03050a);
  scene.fog = new THREE.Fog(0x03050a, 14, 40);

  const groundY = -1.4;
  const arenaSize = { width: 32, depth: 46 };
  const bounds = {
    minX: -arenaSize.width / 2 + 1.6,
    maxX: arenaSize.width / 2 - 1.6,
    minZ: -arenaSize.depth / 2 + 1.6,
    maxZ: arenaSize.depth / 2 - 1.6,
  };
  const manaPadSize = 3.2;
  const hpPadSize = 3.2;
  const manaCenter = new THREE.Vector3(
    bounds.minX + 3.4,
    groundY + 0.03,
    bounds.maxZ - 2.6
  );
  const hpCenter = new THREE.Vector3(
    bounds.maxX - 3.4,
    groundY + 0.03,
    bounds.maxZ - 2.6
  );

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const trackMesh = (mesh: THREE.Mesh) => {
    geometries.add(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => materials.add(material));
    } else {
      materials.add(mesh.material);
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

  const trainingGroup = new THREE.Group();
  scene.add(trainingGroup);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(arenaSize.width, arenaSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x04070f,
      roughness: 0.93,
      metalness: 0.07,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = groundY;
  floor.receiveShadow = true;
  trainingGroup.add(floor);
  trackMesh(floor);

  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.45,
    metalness: 0.35,
    emissive: 0x0f172a,
    emissiveIntensity: 0.2,
  });
  const horizontalBorderGeometry = new THREE.BoxGeometry(
    arenaSize.width,
    0.08,
    0.22
  );
  const verticalBorderGeometry = new THREE.BoxGeometry(
    0.22,
    0.08,
    arenaSize.depth
  );
  const topBorder = new THREE.Mesh(horizontalBorderGeometry, borderMaterial);
  topBorder.position.set(0, groundY + 0.04, bounds.minZ);
  const bottomBorder = new THREE.Mesh(horizontalBorderGeometry, borderMaterial);
  bottomBorder.position.set(0, groundY + 0.04, bounds.maxZ);
  const leftBorder = new THREE.Mesh(verticalBorderGeometry, borderMaterial);
  leftBorder.position.set(bounds.minX, groundY + 0.04, 0);
  const rightBorder = new THREE.Mesh(verticalBorderGeometry, borderMaterial);
  rightBorder.position.set(bounds.maxX, groundY + 0.04, 0);
  trainingGroup.add(topBorder, bottomBorder, leftBorder, rightBorder);
  trackMesh(topBorder);
  trackMesh(bottomBorder);
  trackMesh(leftBorder);
  trackMesh(rightBorder);

  const createRecoveryPad = ({
    center,
    size,
    color,
    emissive,
  }: {
    center: THREE.Vector3;
    size: number;
    color: number;
    emissive: number;
  }) => {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(size, 0.08, size),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.4,
        emissive,
        emissiveIntensity: 0.55,
      })
    );
    pad.position.copy(center);
    pad.receiveShadow = true;
    trainingGroup.add(pad);
    trackMesh(pad);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(size + 0.36, 0.06, size + 0.36),
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.55,
        metalness: 0.25,
      })
    );
    frame.position.set(center.x, center.y - 0.015, center.z);
    frame.receiveShadow = true;
    trainingGroup.add(frame);
    trackMesh(frame);
    return { pad, frame };
  };

  const manaPad = createRecoveryPad({
    center: manaCenter,
    size: manaPadSize,
    color: 0x0f172a,
    emissive: 0x0ea5e9,
  });
  const hpPad = createRecoveryPad({
    center: hpCenter,
    size: hpPadSize,
    color: 0x111827,
    emissive: 0xef4444,
  });

  const launcherPosition = new THREE.Vector3(bounds.minX + 1.1, groundY + 0.6, 0);
  const breakableTargetPosition = new THREE.Vector3(
    bounds.minX + 1.1,
    groundY + 0.6,
    -8
  );
  const triggerPadCenter = new THREE.Vector3(
    launcherPosition.x + 5,
    groundY + 0.05,
    launcherPosition.z
  );
  const triggerPadSize = { width: 2.2, depth: 2.2 };

  const breakableTarget = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.2, 2.2),
    new THREE.MeshStandardMaterial({
      color: 0xa1a1aa,
      roughness: 0.3,
      metalness: 0.25,
      emissive: 0x111827,
      emissiveIntensity: 0.2,
    })
  );
  breakableTarget.position.copy(breakableTargetPosition);
  breakableTarget.castShadow = true;
  breakableTarget.receiveShadow = true;
  trainingGroup.add(breakableTarget);
  trackMesh(breakableTarget);

  const launcherBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.2, 1.2),
    new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      roughness: 0.35,
      metalness: 0.4,
      emissive: 0x0f172a,
      emissiveIntensity: 0.2,
    })
  );
  launcherBody.position.copy(launcherPosition);
  launcherBody.castShadow = true;
  launcherBody.receiveShadow = true;
  trainingGroup.add(launcherBody);
  trackMesh(launcherBody);

  const launcherBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.9, 12),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.2,
      metalness: 0.65,
    })
  );
  launcherBarrel.position.set(
    launcherPosition.x + 0.45,
    launcherPosition.y + 0.2,
    launcherPosition.z
  );
  launcherBarrel.rotation.z = Math.PI / 2;
  launcherBarrel.castShadow = true;
  launcherBarrel.receiveShadow = true;
  trainingGroup.add(launcherBarrel);
  trackMesh(launcherBarrel);

  const triggerPad = new THREE.Mesh(
    new THREE.BoxGeometry(triggerPadSize.width, 0.1, triggerPadSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.55,
      metalness: 0.3,
      emissive: 0xdc2626,
      emissiveIntensity: 0.35,
    })
  );
  triggerPad.position.copy(triggerPadCenter);
  triggerPad.receiveShadow = true;
  trainingGroup.add(triggerPad);
  trackMesh(triggerPad);

  const playerSpawn = new THREE.Vector3(0, groundY, 6);
  const testerSpawn = new THREE.Vector3(0, groundY, bounds.minZ + 5.4);
  const testerDirection = new THREE.Vector3()
    .subVectors(playerSpawn, testerSpawn)
    .setY(0);
  const testerYaw = Math.atan2(testerDirection.x, testerDirection.z);

  const testerAnchor = new THREE.Group();
  testerAnchor.position.copy(testerSpawn);
  testerAnchor.rotation.y = testerYaw;
  trainingGroup.add(testerAnchor);

  const testerFallback = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.75, 1.4, 6, 16),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.2,
      emissive: 0x1e293b,
      emissiveIntensity: 0.55,
    })
  );
  testerFallback.position.y = 1.45;
  testerFallback.castShadow = true;
  testerFallback.receiveShadow = true;
  testerAnchor.add(testerFallback);
  trackMesh(testerFallback);

  const testerHitbox = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.75, 1.4, 6, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  testerHitbox.position.set(0, 1.45, 0);
  testerAnchor.add(testerHitbox);
  trackMesh(testerHitbox);

  const testerMonster = new Monster({
    model: testerAnchor,
    profile: {
      id: "tester",
      label: "Tester",
      pathToken: "/tester/",
      stats: {
        health: 360,
        attack: 0,
        defense: 0,
        speed: 0,
        aggroRange: 0,
        attackRange: 0,
      },
    },
  });

  const emitTesterState = () => {
    context?.onStateChange?.({
      tester: {
        health: testerMonster.health,
        maxHealth: testerMonster.maxHealth,
        alive: testerMonster.isAlive,
      },
    });
  };
  emitTesterState();

  type TesterExplosionPiece = {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    spin: THREE.Vector3;
    life: number;
    maxLife: number;
  };
  const testerExplosionPieces: TesterExplosionPiece[] = [];
  const testerExplosionGeometry = new THREE.IcosahedronGeometry(0.14, 0);
  const testerExplosionMaterial = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.22,
    metalness: 0.15,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.65,
  });
  geometries.add(testerExplosionGeometry);
  materials.add(testerExplosionMaterial);
  const testerExplosionOrigin = new THREE.Vector3();
  const testerExplosionDirection = new THREE.Vector3();
  let testerRespawnAt = 0;

  const spawnTesterExplosion = (direction: THREE.Vector3) => {
    testerExplosionOrigin.copy(testerSpawn);
    testerExplosionOrigin.y += 1.45;
    testerExplosionDirection.copy(direction);
    if (testerExplosionDirection.lengthSq() < 0.000001) {
      testerExplosionDirection.set(0, 0, 1);
    }
    testerExplosionDirection.normalize();

    for (let i = 0; i < 24; i += 1) {
      const piece = new THREE.Mesh(testerExplosionGeometry, testerExplosionMaterial);
      piece.position.copy(testerExplosionOrigin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 1.1,
          (Math.random() - 0.5) * 0.8
        )
      );
      piece.castShadow = true;
      piece.receiveShadow = true;
      trainingGroup.add(piece);
      const burst = new THREE.Vector3(
        (Math.random() - 0.5) * 5.2,
        2.6 + Math.random() * 4.2,
        (Math.random() - 0.5) * 5.2
      ).addScaledVector(testerExplosionDirection, -3.6);
      testerExplosionPieces.push({
        mesh: piece,
        velocity: burst,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 8.2,
          (Math.random() - 0.5) * 8.2,
          (Math.random() - 0.5) * 8.2
        ),
        life: 0,
        maxLife: 0.95 + Math.random() * 0.35,
      });
    }
  };

  const handleTesterDeath = (now: number, direction: THREE.Vector3) => {
    testerRespawnAt = now + 5000;
    testerAnchor.visible = false;
    spawnTesterExplosion(direction);
    emitTesterState();
  };

  type TargetDebris = {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    spin: THREE.Vector3;
    life: number;
  };
  const targetDebrisPieces: TargetDebris[] = [];
  const targetDebrisGeometry = new THREE.BoxGeometry(0.18, 0.2, 0.22);
  const targetDebrisMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.28,
    metalness: 0.22,
  });
  geometries.add(targetDebrisGeometry);
  materials.add(targetDebrisMaterial);
  const targetDebrisOrigin = new THREE.Vector3();
  const targetDebrisDirection = new THREE.Vector3();

  const spawnTargetDebris = (direction: THREE.Vector3) => {
    targetDebrisOrigin.copy(breakableTargetPosition);
    targetDebrisDirection.copy(direction).multiplyScalar(-1);
    if (targetDebrisDirection.lengthSq() < 0.000001) {
      targetDebrisDirection.set(1, 0, 0);
    }
    targetDebrisDirection.normalize();
    for (let i = 0; i < 9; i += 1) {
      const piece = new THREE.Mesh(targetDebrisGeometry, targetDebrisMaterial);
      piece.position.copy(targetDebrisOrigin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.16,
          (Math.random() - 0.5) * 0.42,
          (Math.random() - 0.5) * 1.6
        )
      );
      piece.castShadow = true;
      piece.receiveShadow = true;
      trainingGroup.add(piece);
      targetDebrisPieces.push({
        mesh: piece,
        velocity: new THREE.Vector3(
          targetDebrisDirection.x * (2.8 + Math.random() * 1.8),
          1.4 + Math.random() * 1.8,
          targetDebrisDirection.z * (2.8 + Math.random() * 1.8) +
            (Math.random() - 0.5) * 2.6
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 6.2,
          (Math.random() - 0.5) * 6.2,
          (Math.random() - 0.5) * 6.2
        ),
        life: 0,
      });
    }
  };

  let targetBroken = false;
  let targetRespawnAt = 0;
  const breakTarget = (now: number, direction: THREE.Vector3) => {
    if (targetBroken) return;
    targetBroken = true;
    targetRespawnAt = now + 5000;
    breakableTarget.removeFromParent();
    spawnTargetDebris(direction);
  };

  type LauncherArrow = {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    radius: number;
  };
  const launcherArrows: LauncherArrow[] = [];
  const launcherArrowGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 10);
  launcherArrowGeometry.rotateX(Math.PI / 2);
  const launcherArrowMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
    metalness: 0.72,
    emissive: 0x1e293b,
    emissiveIntensity: 0.35,
  });
  geometries.add(launcherArrowGeometry);
  materials.add(launcherArrowMaterial);
  const launcherOrigin = new THREE.Vector3();
  const launcherAimDirection = new THREE.Vector3();
  const launcherArrowForward = new THREE.Vector3(0, 0, 1);
  const playerChest = new THREE.Vector3();
  let launcherCooldownUntil = 0;

  const spawnLauncherArrow = (player: THREE.Object3D, now: number) => {
    launcherBarrel.getWorldPosition(launcherOrigin);
    playerChest.copy(player.position);
    playerChest.y += 1.2;
    launcherAimDirection.copy(playerChest).sub(launcherOrigin);
    if (launcherAimDirection.lengthSq() < 0.000001) return;
    launcherAimDirection.normalize();

    const arrowMesh = new THREE.Mesh(launcherArrowGeometry, launcherArrowMaterial);
    arrowMesh.position.copy(launcherOrigin);
    arrowMesh.quaternion.setFromUnitVectors(
      launcherArrowForward,
      launcherAimDirection
    );
    arrowMesh.castShadow = true;
    arrowMesh.receiveShadow = true;
    trainingGroup.add(arrowMesh);
    launcherArrows.push({
      mesh: arrowMesh,
      velocity: launcherAimDirection.clone().multiplyScalar(13.5),
      life: 0,
      maxLife: 2.4,
      radius: 0.3,
    });
    launcherCooldownUntil = now + 1100;
  };

  const attackTargets: PlayerAttackTarget[] = [
    {
      id: "training-breakable-target",
      object: breakableTarget,
      isActive: () => !targetBroken,
      onHit: (hit) => {
        breakTarget(hit.now, hit.direction);
      },
    },
    {
      id: "training-tester",
      object: testerHitbox,
      isActive: () => testerMonster.isAlive,
      onHit: (hit) => {
        const dealt = testerMonster.takeDamage(Math.max(1, Math.round(hit.damage)));
        if (dealt <= 0) return;
        if (!testerMonster.isAlive) {
          handleTesterDeath(hit.now, hit.direction);
          return;
        }
        emitTesterState();
      },
    },
  ];

  const updateTesterLifecycle = (now: number, player: THREE.Object3D) => {
    if (testerMonster.isAlive) {
      testerMonster.faceTarget(player);
      return;
    }
    if (testerRespawnAt <= 0 || now < testerRespawnAt) return;
    testerMonster.revive(1);
    testerAnchor.position.copy(testerSpawn);
    testerAnchor.visible = true;
    testerRespawnAt = 0;
    emitTesterState();
  };

  const updateTargetDebrisPieces = (delta: number) => {
    for (let i = targetDebrisPieces.length - 1; i >= 0; i -= 1) {
      const piece = targetDebrisPieces[i];
      piece.velocity.y -= 9.8 * delta;
      piece.mesh.position.addScaledVector(piece.velocity, delta);
      piece.mesh.rotation.x += piece.spin.x * delta;
      piece.mesh.rotation.y += piece.spin.y * delta;
      piece.mesh.rotation.z += piece.spin.z * delta;
      piece.life += delta;
      if (piece.life >= 0.55) {
        piece.mesh.removeFromParent();
        targetDebrisPieces.splice(i, 1);
      }
    }
  };

  const updateTesterExplosionPieces = (delta: number) => {
    for (let i = testerExplosionPieces.length - 1; i >= 0; i -= 1) {
      const piece = testerExplosionPieces[i];
      piece.velocity.y -= 11.5 * delta;
      piece.mesh.position.addScaledVector(piece.velocity, delta);
      piece.mesh.rotation.x += piece.spin.x * delta;
      piece.mesh.rotation.y += piece.spin.y * delta;
      piece.mesh.rotation.z += piece.spin.z * delta;
      piece.life += delta;
      const lifeRatio = Math.max(0, 1 - piece.life / piece.maxLife);
      piece.mesh.scale.setScalar(Math.max(0.05, lifeRatio));
      if (piece.life >= piece.maxLife) {
        piece.mesh.removeFromParent();
        testerExplosionPieces.splice(i, 1);
      }
    }
  };

  const isOnLauncherTriggerPad = (player: THREE.Object3D) =>
    Math.abs(player.position.x - triggerPadCenter.x) <= triggerPadSize.width / 2 &&
    Math.abs(player.position.z - triggerPadCenter.z) <= triggerPadSize.depth / 2;

  const updateLauncherArrows = (
    delta: number,
    player: THREE.Object3D,
    applyDamage: (amount: number) => number
  ) => {
    playerChest.copy(player.position);
    playerChest.y += 1.2;

    for (let i = launcherArrows.length - 1; i >= 0; i -= 1) {
      const arrow = launcherArrows[i];
      arrow.mesh.position.addScaledVector(arrow.velocity, delta);
      arrow.life += delta;
      if (
        arrow.life >= arrow.maxLife ||
        arrow.mesh.position.y <= groundY + 0.05
      ) {
        arrow.mesh.removeFromParent();
        launcherArrows.splice(i, 1);
        continue;
      }

      const hitRadius = arrow.radius + 0.48;
      if (arrow.mesh.position.distanceToSquared(playerChest) <= hitRadius * hitRadius) {
        applyDamage(14);
        arrow.mesh.removeFromParent();
        launcherArrows.splice(i, 1);
      }
    }
  };

  const worldTick = ({
    now,
    delta,
    player,
    applyDamage,
  }: PlayerWorldTickArgs) => {
    updateTesterLifecycle(now, player);

    if (targetBroken && now >= targetRespawnAt) {
      targetBroken = false;
      trainingGroup.add(breakableTarget);
    }

    updateTargetDebrisPieces(delta);
    updateTesterExplosionPieces(delta);

    if (isOnLauncherTriggerPad(player) && now >= launcherCooldownUntil) {
      spawnLauncherArrow(player, now);
    }

    updateLauncherArrows(delta, player, applyDamage);
  };

  const clearTrainingTransientObjects = () => {
    targetDebrisPieces.forEach((piece) => piece.mesh.removeFromParent());
    targetDebrisPieces.length = 0;
    testerExplosionPieces.forEach((piece) => piece.mesh.removeFromParent());
    testerExplosionPieces.length = 0;
    launcherArrows.forEach((arrow) => arrow.mesh.removeFromParent());
    launcherArrows.length = 0;
  };

  const resetTrainingState = () => {
    targetBroken = false;
    targetRespawnAt = 0;
    if (!breakableTarget.parent) {
      trainingGroup.add(breakableTarget);
    }
    launcherCooldownUntil = 0;
    testerRespawnAt = 0;
    testerMonster.revive(1);
    testerAnchor.position.copy(testerSpawn);
    testerAnchor.visible = true;
    clearTrainingTransientObjects();
    emitTesterState();
  };

  let isDisposed = false;
  const loader = new GLTFLoader();
  loader.load(
    "/assets/monsters/tester/tester.glb",
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        disposeObjectResources(gltf.scene);
        return;
      }

      const testerModel = gltf.scene;
      testerAnchor.add(testerModel);
      trackObject(testerModel);

      const modelBounds = new THREE.Box3().setFromObject(testerModel);
      const modelHeight = Math.max(0.001, modelBounds.max.y - modelBounds.min.y);
      const targetHeight = 2.8;
      testerModel.scale.setScalar(targetHeight / modelHeight);
      testerModel.updateMatrixWorld(true);

      modelBounds.setFromObject(testerModel);
      testerModel.position.y += groundY - modelBounds.min.y;
      testerModel.updateMatrixWorld(true);

      testerAnchor.remove(testerFallback);
    },
    undefined,
    () => {}
  );

  const projectileColliders = [
    floor,
    topBorder,
    bottomBorder,
    leftBorder,
    rightBorder,
    manaPad.pad,
    manaPad.frame,
    hpPad.pad,
    hpPad.frame,
    launcherBody,
    launcherBarrel,
    triggerPad,
  ];

  const world: PlayerWorld = {
    groundY,
    playerSpawn,
    resetOnDeath: true,
    bounds,
    projectileColliders,
    attackTargets,
    onTick: worldTick,
    onPlayerReset: resetTrainingState,
    recoveryZones: [
      {
        id: "training-mana-zone",
        type: "mana",
        minX: manaCenter.x - manaPadSize / 2,
        maxX: manaCenter.x + manaPadSize / 2,
        minZ: manaCenter.z - manaPadSize / 2,
        maxZ: manaCenter.z + manaPadSize / 2,
        cooldownMs: 120,
      },
      {
        id: "training-hp-zone",
        type: "health",
        minX: hpCenter.x - hpPadSize / 2,
        maxX: hpCenter.x + hpPadSize / 2,
        minZ: hpCenter.z - hpPadSize / 2,
        maxZ: hpCenter.z + hpPadSize / 2,
        cooldownMs: 120,
      },
    ],
    isBlocked: (x, z) =>
      x < bounds.minX ||
      x > bounds.maxX ||
      z < bounds.minZ ||
      z > bounds.maxZ,
  };

  const dispose = () => {
    isDisposed = true;
    context?.onStateChange?.({});
    clearTrainingTransientObjects();
    scene.remove(trainingGroup);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  };

  return { world, dispose };
};

const createEmptyScene = (): SceneSetupResult => ({
  world: { groundY: -1.4 },
});

const sceneRegistry: Record<string, SceneDefinition> = {
  grass: {
    id: "grass",
    setupScene: createGrassScene,
  },
  range: {
    id: "range",
    setupScene: createRangeScene,
  },
  training: {
    id: "training",
    setupScene: createTrainingScene,
  },
  empty: {
    id: "empty",
    setupScene: createEmptyScene,
  },
};

export const getSceneDefinition = (sceneId?: string): SceneDefinition =>
  sceneRegistry[sceneId || "grass"] || sceneRegistry.grass;
