import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LinearProjectileUpdater } from "../../object/projectile/linearUpdater";
import { tryReflectLinearProjectile } from "../../object/projectile/reflection";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../../entity/character/general/player";
import { Monster } from "../../entity/monster/general";
import type { SceneSetupContext, SceneSetupResult } from "../general/sceneTypes";

export const createTrainingScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext
): SceneSetupResult => {
  scene.background = new THREE.Color(0x111a2e);
  scene.fog = new THREE.Fog(0x111a2e, 18, 58);

  const groundY = -1.4;
  const arenaSize = { width: 40, depth: 46 };
  const bounds = {
    minX: -arenaSize.width / 2 + 1.6,
    maxX: arenaSize.width / 2 - 1.6,
    minZ: -arenaSize.depth / 2 + 1.6,
    maxZ: arenaSize.depth / 2 - 1.6,
  };
  const manaPadSize = 3.2;
  const hpPadSize = 3.2;
  const energyPadSize = 3.2;
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
  const energyCenter = new THREE.Vector3(
    (manaCenter.x + hpCenter.x) / 2,
    groundY + 0.03,
    (manaCenter.z + hpCenter.z) / 2
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

  const trainingAmbientLight = new THREE.AmbientLight(0xf1f5ff, 0.36);
  const trainingHemisphereLight = new THREE.HemisphereLight(
    0xf8fafc,
    0x1e293b,
    0.62
  );
  const trainingKeyLight = new THREE.DirectionalLight(0xffffff, 0.86);
  trainingKeyLight.position.set(-9, 12, 7);
  const trainingFillLight = new THREE.DirectionalLight(0xbfdbfe, 0.5);
  trainingFillLight.position.set(11, 8, -8);
  trainingGroup.add(
    trainingAmbientLight,
    trainingHemisphereLight,
    trainingKeyLight,
    trainingFillLight
  );

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(arenaSize.width, arenaSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x1b263c,
      roughness: 0.88,
      metalness: 0.1,
      emissive: 0x111827,
      emissiveIntensity: 0.12,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = groundY;
  floor.receiveShadow = true;
  trainingGroup.add(floor);
  trackMesh(floor);

  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.45,
    metalness: 0.35,
    emissive: 0x1e293b,
    emissiveIntensity: 0.24,
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
  const energyPad = createRecoveryPad({
    center: energyCenter,
    size: energyPadSize,
    color: 0x052e16,
    emissive: 0x22c55e,
  });

  const launcherHeightOffset = 1.2;
  const launcherPosition = new THREE.Vector3(
    bounds.minX + 1.1,
    groundY + launcherHeightOffset,
    0
  );
  const breakableTargetPosition = new THREE.Vector3(
    bounds.minX + 1.1,
    groundY + 0.9,
    -8
  );
  const triggerPadCenter = new THREE.Vector3(
    launcherPosition.x + 8,
    groundY + 0.05,
    launcherPosition.z
  );
  const triggerPadSize = { width: 2.2, depth: 2.2 };

  const breakableTargetMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0x71717a,
      roughness: 0.36,
      metalness: 0.2,
      emissive: 0x0f172a,
      emissiveIntensity: 0.1,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x71717a,
      roughness: 0.36,
      metalness: 0.2,
      emissive: 0x0f172a,
      emissiveIntensity: 0.1,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xa1a1aa,
      roughness: 0.28,
      metalness: 0.24,
      emissive: 0x111827,
      emissiveIntensity: 0.14,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x52525b,
      roughness: 0.42,
      metalness: 0.18,
      emissive: 0x0f172a,
      emissiveIntensity: 0.08,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.24,
      metalness: 0.3,
      emissive: 0x1e293b,
      emissiveIntensity: 0.2,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x7c7f87,
      roughness: 0.34,
      metalness: 0.2,
      emissive: 0x0f172a,
      emissiveIntensity: 0.1,
    }),
  ];

  const breakableTarget = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.8, 2.2),
    breakableTargetMaterials
  );
  breakableTarget.position.copy(breakableTargetPosition);
  breakableTarget.castShadow = true;
  breakableTarget.receiveShadow = true;
  trainingGroup.add(breakableTarget);
  trackMesh(breakableTarget);

  const launcherBaseMaterial = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.75,
    metalness: 0.2,
  });
  const launcherBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.32,
    metalness: 0.48,
    emissive: 0x0f172a,
    emissiveIntensity: 0.24,
  });
  const launcherAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.68,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.32,
  });

  const launcherBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.22, 1.1),
    launcherBaseMaterial
  );
  launcherBase.position.set(
    launcherPosition.x,
    launcherPosition.y - 0.49,
    launcherPosition.z
  );
  launcherBase.castShadow = true;
  launcherBase.receiveShadow = true;
  trainingGroup.add(launcherBase);
  trackMesh(launcherBase);

  const launcherBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.82, 1.08),
    launcherBodyMaterial
  );
  launcherBody.position.copy(launcherPosition);
  launcherBody.castShadow = true;
  launcherBody.receiveShadow = true;
  trainingGroup.add(launcherBody);
  trackMesh(launcherBody);

  const launcherBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 1, 14),
    launcherAccentMaterial
  );
  launcherBarrel.position.set(
    launcherPosition.x + 0.48,
    launcherPosition.y + 0.13,
    launcherPosition.z
  );
  launcherBarrel.rotation.z = Math.PI / 2;
  launcherBarrel.castShadow = true;
  launcherBarrel.receiveShadow = true;
  trainingGroup.add(launcherBarrel);
  trackMesh(launcherBarrel);

  const launcherMuzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 14),
    launcherAccentMaterial
  );
  launcherMuzzle.position.set(
    launcherPosition.x + 0.95,
    launcherPosition.y + 0.13,
    launcherPosition.z
  );
  launcherMuzzle.castShadow = true;
  launcherMuzzle.receiveShadow = true;
  trainingGroup.add(launcherMuzzle);
  trackMesh(launcherMuzzle);

  const launcherSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.16, 0.16),
    launcherBaseMaterial
  );
  launcherSpine.position.set(
    launcherPosition.x + 0.06,
    launcherPosition.y + 0.48,
    launcherPosition.z
  );
  launcherSpine.castShadow = true;
  launcherSpine.receiveShadow = true;
  trainingGroup.add(launcherSpine);
  trackMesh(launcherSpine);

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
        health: 1000,
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
    testerRespawnAt = now + 2000;
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
  const launcherArrowUpdater = new LinearProjectileUpdater();
  geometries.add(launcherArrowGeometry);
  materials.add(launcherArrowMaterial);
  const launcherOrigin = new THREE.Vector3();
  const launcherAimDirection = new THREE.Vector3();
  const launcherArrowForward = new THREE.Vector3(0, 0, 1);
  const launcherReflectedDirection = new THREE.Vector3();
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

  const isObjectOnLauncherTriggerPad = (object: THREE.Object3D) =>
    Math.abs(object.position.x - triggerPadCenter.x) <= triggerPadSize.width / 2 &&
    Math.abs(object.position.z - triggerPadCenter.z) <= triggerPadSize.depth / 2;

  const isOnLauncherTriggerPad = (
    player: THREE.Object3D,
    projectileBlockers: THREE.Object3D[]
  ) => {
    if (isObjectOnLauncherTriggerPad(player)) return true;
    for (let i = 0; i < projectileBlockers.length; i += 1) {
      const blocker = projectileBlockers[i];
      if (!blocker.parent || !blocker.visible) continue;
      const blockerUserData = blocker.userData as {
        switchActivator?: boolean;
      };
      if (!blockerUserData.switchActivator) continue;
      if (isObjectOnLauncherTriggerPad(blocker)) return true;
    }
    return false;
  };

  const tryReflectLauncherArrow = ({
    arrow,
    blockerHit,
    now,
    origin,
    direction,
    travelDistance,
    nextPosition,
  }: {
    arrow: LauncherArrow;
    blockerHit: THREE.Intersection;
    now: number;
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    travelDistance: number;
    nextPosition: THREE.Vector3;
  }) => {
    const reflected = tryReflectLinearProjectile({
      blockerHit,
      now,
      origin,
      direction,
      travelDistance,
      nextPosition,
      velocity: arrow.velocity,
      radius: arrow.radius,
      outDirection: launcherReflectedDirection,
    });
    if (!reflected) return false;

    arrow.mesh.quaternion.setFromUnitVectors(
      launcherArrowForward,
      launcherReflectedDirection
    );
    return true;
  };

  const updateLauncherArrows = (
    now: number,
    delta: number,
    player: THREE.Object3D,
    applyDamage: (amount: number) => number,
    projectileBlockers: THREE.Object3D[]
  ) => {
    for (let i = 0; i < projectileBlockers.length; i += 1) {
      projectileBlockers[i].updateMatrixWorld(true);
    }

    playerChest.copy(player.position);
    playerChest.y += 1.2;
    launcherArrowUpdater.update(launcherArrows, now, delta, {
      getObject: (arrow) => arrow.mesh,
      onTravel: (
        arrow,
        travelNow,
        _travelDelta,
        origin,
        nextPosition,
        direction,
        distance,
        raycaster,
        remove
      ) => {
        if (!projectileBlockers.length) return;
        raycaster.set(origin, direction);
        raycaster.far = distance + arrow.radius;
        const hits = raycaster.intersectObjects(projectileBlockers, true);
        if (!hits.length) return;
        const reflected = tryReflectLauncherArrow({
          arrow,
          blockerHit: hits[0],
          now: travelNow,
          origin,
          direction,
          travelDistance: distance,
          nextPosition,
        });
        if (!reflected) {
          remove();
        }
      },
      shouldExpire: (arrow) => arrow.mesh.position.y <= groundY + 0.05,
      onAfterMove: (arrow, _stepNow, _stepDelta, remove) => {
        const hitRadius = arrow.radius + 0.48;
        if (
          arrow.mesh.position.distanceToSquared(playerChest) <=
          hitRadius * hitRadius
        ) {
          applyDamage(14);
          remove();
        }
      },
      onRemove: (arrow) => {
        arrow.mesh.removeFromParent();
      },
    });
  };

  const worldTick = ({
    now,
    delta,
    player,
    applyDamage,
    projectileBlockers,
  }: PlayerWorldTickArgs) => {
    updateTesterLifecycle(now, player);

    if (targetBroken && now >= targetRespawnAt) {
      targetBroken = false;
      trainingGroup.add(breakableTarget);
    }

    updateTargetDebrisPieces(delta);
    updateTesterExplosionPieces(delta);

    if (isOnLauncherTriggerPad(player, projectileBlockers) && now >= launcherCooldownUntil) {
      spawnLauncherArrow(player, now);
    }

    updateLauncherArrows(now, delta, player, applyDamage, projectileBlockers);
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
    energyPad.pad,
    energyPad.frame,
    hpPad.pad,
    hpPad.frame,
    launcherBase,
    launcherBody,
    launcherSpine,
    launcherBarrel,
    launcherMuzzle,
    triggerPad,
  ];

  const world: PlayerWorld = {
    sceneId: "training",
    groundY,
    playerSpawn,
    onPlayerDeath: ({ gameMode, resetPlayer }) => {
      if (gameMode !== "training") return "ignore";
      resetPlayer();
      return "handled";
    },
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
      {
        id: "training-energy-zone",
        type: "energy",
        minX: energyCenter.x - energyPadSize / 2,
        maxX: energyCenter.x + energyPadSize / 2,
        minZ: energyCenter.z - energyPadSize / 2,
        maxZ: energyCenter.z + energyPadSize / 2,
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
