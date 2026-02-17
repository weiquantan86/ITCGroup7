import * as THREE from "three";
import { createSceneResourceTracker } from "../general/resourceTracker";
import type { SceneSetupResult } from "../general/sceneTypes";

type BoxCollider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const createMochiFactoryScene = (scene: THREE.Scene): SceneSetupResult => {
  scene.background = new THREE.Color(0x080c16);
  scene.fog = new THREE.Fog(0x080c16, 36, 128);

  const groundY = -1.4;
  const factorySize = { width: 112, depth: 112 };
  const bounds = {
    minX: -factorySize.width / 2 + 3,
    maxX: factorySize.width / 2 - 3,
    minZ: -factorySize.depth / 2 + 3,
    maxZ: factorySize.depth / 2 - 3,
  };
  const fieldSize = { width: 48, depth: 48 };

  const resourceTracker = createSceneResourceTracker();
  const { trackMesh, disposeTrackedResources } = resourceTracker;
  const colliders: BoxCollider[] = [];

  const factoryGroup = new THREE.Group();
  factoryGroup.name = "mochiFactoryScene";
  scene.add(factoryGroup);

  const addCollider = (
    x: number,
    z: number,
    width: number,
    depth: number,
    padding = 0.6
  ) => {
    colliders.push({
      minX: x - width / 2 - padding,
      maxX: x + width / 2 + padding,
      minZ: z - depth / 2 - padding,
      maxZ: z + depth / 2 + padding,
    });
  };

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(factorySize.width, factorySize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x101827,
      roughness: 0.94,
      metalness: 0.08,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = groundY;
  floor.receiveShadow = true;
  factoryGroup.add(floor);
  trackMesh(floor);

  const innerField = new THREE.Mesh(
    new THREE.PlaneGeometry(fieldSize.width, fieldSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x2a3c2a,
      roughness: 0.84,
      metalness: 0.08,
      emissive: 0x102010,
      emissiveIntensity: 0.16,
    })
  );
  innerField.rotation.x = -Math.PI / 2;
  innerField.position.y = groundY + 0.02;
  innerField.receiveShadow = true;
  factoryGroup.add(innerField);
  trackMesh(innerField);

  const fieldRing = new THREE.Mesh(
    new THREE.RingGeometry(25.4, 27.6, 64),
    new THREE.MeshStandardMaterial({
      color: 0xc39b3a,
      roughness: 0.38,
      metalness: 0.82,
      emissive: 0x4c360e,
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
    })
  );
  fieldRing.rotation.x = -Math.PI / 2;
  fieldRing.position.y = groundY + 0.035;
  fieldRing.receiveShadow = true;
  factoryGroup.add(fieldRing);
  trackMesh(fieldRing);

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a465b,
    roughness: 0.52,
    metalness: 0.58,
  });
  const conveyorMaterial = new THREE.MeshStandardMaterial({
    color: 0x172033,
    roughness: 0.72,
    metalness: 0.22,
  });
  const beltLightMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.48,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.24,
  });

  const buildConveyorLane = (x: number, z: number, width: number, depth: number) => {
    const lane = new THREE.Group();
    lane.position.set(x, 0, z);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.44, depth),
      conveyorMaterial
    );
    belt.position.y = groundY + 0.22;
    belt.castShadow = true;
    belt.receiveShadow = true;
    lane.add(belt);
    trackMesh(belt);

    const railLeft = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.28, 0.22),
      railMaterial
    );
    railLeft.position.set(0, groundY + 0.44, depth / 2 - 0.14);
    railLeft.castShadow = true;
    railLeft.receiveShadow = true;
    lane.add(railLeft);
    trackMesh(railLeft);

    const railRight = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.28, 0.22),
      railMaterial
    );
    railRight.position.set(0, groundY + 0.44, -depth / 2 + 0.14);
    railRight.castShadow = true;
    railRight.receiveShadow = true;
    lane.add(railRight);
    trackMesh(railRight);

    for (let i = 0; i < 4; i += 1) {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.06, Math.max(1.2, depth * 0.4)),
        beltLightMaterial
      );
      marker.position.set(-width / 2 + 1.4 + i * ((width - 2.8) / 3), groundY + 0.47, 0);
      marker.castShadow = true;
      marker.receiveShadow = true;
      lane.add(marker);
      trackMesh(marker);
    }

    factoryGroup.add(lane);
    addCollider(x, z, width, depth, 0.7);
  };

  const factoryWallMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c2436,
    roughness: 0.82,
    metalness: 0.2,
  });
  const factoryAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0xc6a14a,
    roughness: 0.32,
    metalness: 0.84,
    emissive: 0x4f390d,
    emissiveIntensity: 0.2,
  });
  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b556a,
    roughness: 0.52,
    metalness: 0.62,
  });
  const tankMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.56,
    metalness: 0.5,
  });
  const mochiFluidMaterial = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.16,
    metalness: 0.08,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.26,
  });

  const createFactoryBlock = (
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number
  ) => {
    const block = new THREE.Group();
    block.position.set(x, 0, z);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      factoryWallMaterial
    );
    base.position.y = groundY + height / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    block.add(base);
    trackMesh(base);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.96, 0.34, depth * 0.96),
      factoryAccentMaterial
    );
    roof.position.y = groundY + height + 0.18;
    roof.castShadow = true;
    roof.receiveShadow = true;
    block.add(roof);
    trackMesh(roof);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.96, 0.22, 0.24),
      factoryAccentMaterial
    );
    stripe.position.set(0, groundY + height * 0.58, depth / 2 + 0.13);
    stripe.castShadow = true;
    stripe.receiveShadow = true;
    block.add(stripe);
    trackMesh(stripe);

    factoryGroup.add(block);
    addCollider(x, z, width, depth, 0.7);
  };

  const createTank = (x: number, z: number, radius: number, height: number) => {
    const tankGroup = new THREE.Group();
    tankGroup.position.set(x, 0, z);

    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 24),
      tankMaterial
    );
    shell.position.y = groundY + height / 2;
    shell.castShadow = true;
    shell.receiveShadow = true;
    tankGroup.add(shell);
    trackMesh(shell);

    const fluid = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.84, radius * 0.84, height * 0.46, 24),
      mochiFluidMaterial
    );
    fluid.position.y = groundY + height * 0.22;
    fluid.castShadow = true;
    fluid.receiveShadow = true;
    tankGroup.add(fluid);
    trackMesh(fluid);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, 0.28, 24),
      factoryAccentMaterial
    );
    cap.position.y = groundY + height + 0.14;
    cap.castShadow = true;
    cap.receiveShadow = true;
    tankGroup.add(cap);
    trackMesh(cap);

    factoryGroup.add(tankGroup);
    addCollider(x, z, radius * 2.1, radius * 2.1, 0.6);
  };

  const createPipe = (
    x: number,
    y: number,
    z: number,
    length: number,
    horizontal = true
  ) => {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, length, 12),
      pipeMaterial
    );
    pipe.position.set(x, y, z);
    pipe.rotation.z = horizontal ? Math.PI / 2 : 0;
    pipe.castShadow = true;
    pipe.receiveShadow = true;
    factoryGroup.add(pipe);
    trackMesh(pipe);
  };

  const edgeStripZ = [-39, -19, 1, 21];
  for (let i = 0; i < edgeStripZ.length; i += 1) {
    const z = edgeStripZ[i];
    createFactoryBlock(-42, z, 12, 14, 6.2 + (i % 2) * 1.3);
    createFactoryBlock(42, z, 12, 14, 6.4 + ((i + 1) % 2) * 1.1);
  }

  const edgeStripX = [-26, 0, 26];
  for (let i = 0; i < edgeStripX.length; i += 1) {
    const x = edgeStripX[i];
    createFactoryBlock(x, -42, 14, 10, 7.2);
    createFactoryBlock(x, 42, 14, 10, 7.2);
  }

  buildConveyorLane(-40, -32, 10, 8);
  buildConveyorLane(-40, 32, 10, 8);
  buildConveyorLane(40, -32, 10, 8);
  buildConveyorLane(40, 32, 10, 8);

  createTank(-26, -43, 2.7, 6.2);
  createTank(26, -43, 2.7, 6.2);
  createTank(-26, 43, 2.7, 6.2);
  createTank(26, 43, 2.7, 6.2);

  createPipe(-41.5, groundY + 7.1, -9, 20, false);
  createPipe(41.5, groundY + 7.1, 9, 20, false);
  createPipe(0, groundY + 6.4, -44, 44, true);
  createPipe(0, groundY + 6.4, 44, 44, true);
  createPipe(-23.5, groundY + 5.2, -42.5, 18, true);
  createPipe(23.5, groundY + 5.2, 42.5, 18, true);

  const boundaryWallGeometry = new THREE.BoxGeometry(factorySize.width - 8, 4.4, 1.2);
  const wallTop = new THREE.Mesh(boundaryWallGeometry, factoryWallMaterial);
  wallTop.position.set(0, groundY + 2.2, bounds.minZ - 0.8);
  wallTop.castShadow = true;
  wallTop.receiveShadow = true;
  factoryGroup.add(wallTop);
  trackMesh(wallTop);
  addCollider(wallTop.position.x, wallTop.position.z, factorySize.width - 8, 1.2, 0.2);

  const wallBottom = new THREE.Mesh(boundaryWallGeometry, factoryWallMaterial);
  wallBottom.position.set(0, groundY + 2.2, bounds.maxZ + 0.8);
  wallBottom.castShadow = true;
  wallBottom.receiveShadow = true;
  factoryGroup.add(wallBottom);
  trackMesh(wallBottom);
  addCollider(
    wallBottom.position.x,
    wallBottom.position.z,
    factorySize.width - 8,
    1.2,
    0.2
  );

  const boundarySideGeometry = new THREE.BoxGeometry(1.2, 4.4, factorySize.depth - 8);
  const wallLeft = new THREE.Mesh(boundarySideGeometry, factoryWallMaterial);
  wallLeft.position.set(bounds.minX - 0.8, groundY + 2.2, 0);
  wallLeft.castShadow = true;
  wallLeft.receiveShadow = true;
  factoryGroup.add(wallLeft);
  trackMesh(wallLeft);
  addCollider(wallLeft.position.x, wallLeft.position.z, 1.2, factorySize.depth - 8, 0.2);

  const wallRight = new THREE.Mesh(boundarySideGeometry, factoryWallMaterial);
  wallRight.position.set(bounds.maxX + 0.8, groundY + 2.2, 0);
  wallRight.castShadow = true;
  wallRight.receiveShadow = true;
  factoryGroup.add(wallRight);
  trackMesh(wallRight);
  addCollider(wallRight.position.x, wallRight.position.z, 1.2, factorySize.depth - 8, 0.2);

  const playerSpawn = new THREE.Vector3(0, groundY, fieldSize.depth * 0.3);

  const world = {
    sceneId: "mochiFactory",
    groundY,
    playerSpawn,
    bounds,
    projectileColliders: [factoryGroup] as THREE.Object3D[],
    isBlocked: (x: number, z: number) => {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
        return true;
      }
      for (let i = 0; i < colliders.length; i += 1) {
        const collider = colliders[i];
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
  };

  const dispose = () => {
    scene.remove(factoryGroup);
    disposeTrackedResources();
  };

  return { world, dispose };
};
