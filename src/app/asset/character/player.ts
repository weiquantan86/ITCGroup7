import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getCharacterEntry, resolveCharacterStats } from "./registry";
import type { CharacterRuntime, CharacterStats } from "./types";

export interface PlayerWorld {
  groundY: number;
  isBlocked?: (x: number, z: number) => boolean;
  projectileColliders?: THREE.Object3D[];
  bounds?: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export interface PlayerController {
  camera: THREE.PerspectiveCamera;
  miniCamera: THREE.PerspectiveCamera;
  projectiles: Projectile[];
  update: (now: number, delta: number) => void;
  render: (renderer: THREE.WebGLRenderer) => void;
  resize: (width: number, height: number) => void;
  setCharacterPath: (path?: string) => void;
  dispose: () => void;
}

export interface Projectile {
  id: number;
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  radius: number;
  material: THREE.Material;
  ownsMaterial: boolean;
}

type StatusHud = {
  setStats: (current: CharacterStats, max: CharacterStats) => void;
  dispose: () => void;
};

const createStatusHud = (mount?: HTMLElement): StatusHud => {
  if (!mount) {
    return { setStats: () => {}, dispose: () => {} };
  }

  const host = mount.parentElement ?? mount;
  if (!host.style.position) {
    host.style.position = "relative";
  }

  const hud = document.createElement("div");
  hud.style.cssText =
    "position:absolute;left:16px;top:16px;z-index:6;display:flex;" +
    "flex-direction:column;gap:6px;padding:10px 12px;border-radius:12px;" +
    "background:rgba(2,6,23,0.55);border:1px solid rgba(148,163,184,0.25);" +
    "box-shadow:0 10px 28px rgba(2,6,23,0.6);pointer-events:none;";

  const createBar = (label: string, fill: string, glow: string) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;min-width:320px;";
    const text = document.createElement("span");
    text.textContent = label;
    text.style.cssText =
      "width:26px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;" +
      "color:rgba(226,232,240,0.9);";
    const value = document.createElement("span");
    value.textContent = "0/0";
    value.style.cssText =
      "min-width:58px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;" +
      "color:rgba(226,232,240,0.85);";
    const track = document.createElement("div");
    track.style.cssText =
      "position:relative;flex:1;height:10px;border-radius:999px;overflow:hidden;" +
      "background:rgba(15,23,42,0.85);border:1px solid rgba(148,163,184,0.2);";
    const fillBar = document.createElement("div");
    fillBar.style.cssText =
      `height:100%;width:100%;background:${fill};` +
      `box-shadow:0 0 12px ${glow};transition:width 120ms ease;`;
    track.appendChild(fillBar);
    row.append(text, track, value);
    return { row, fillBar, value };
  };

  const healthBar = createBar("HP", "#ef4444", "rgba(239,68,68,0.65)");
  const manaBar = createBar("MP", "#38bdf8", "rgba(56,189,248,0.6)");
  hud.append(healthBar.row, manaBar.row);
  host.appendChild(hud);

  const updateFill = (
    fillBar: HTMLDivElement,
    value: HTMLSpanElement,
    current: number,
    max: number
  ) => {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    fillBar.style.width = `${Math.round(ratio * 100)}%`;
    value.textContent = `${Math.max(0, Math.round(current))}/${Math.max(
      0,
      Math.round(max)
    )}`;
  };

  return {
    setStats: (current: CharacterStats, max: CharacterStats) => {
      updateFill(healthBar.fillBar, healthBar.value, current.health, max.health);
      updateFill(manaBar.fillBar, manaBar.value, current.mana, max.mana);
    },
    dispose: () => {
      hud.parentElement?.removeChild(hud);
    },
  };
};

export const createPlayer = ({
  scene,
  mount,
  characterPath,
  world,
  hideLocalHead = true,
  hideLocalBody = false,
}: {
  scene: THREE.Scene;
  mount: HTMLElement;
  characterPath?: string;
  world?: PlayerWorld;
  hideLocalHead?: boolean;
  hideLocalBody?: boolean;
}): PlayerController => {
  const resolvedWorld: PlayerWorld = {
    groundY: world?.groundY ?? -1.4,
    isBlocked: world?.isBlocked,
    projectileColliders: world?.projectileColliders,
    bounds: world?.bounds,
  };

  const camera = new THREE.PerspectiveCamera(
    70,
    mount.clientWidth / mount.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 4.5, 10);

  const miniCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
  miniCamera.position.set(0, 6, 6);
  if (hideLocalHead) {
    miniCamera.layers.enable(1);
  }
  if (hideLocalBody) {
    miniCamera.layers.enable(2);
  }

  const pressedKeys = new Set<string>();
  const keyMap: Record<string, string> = {
    KeyW: "w",
    KeyA: "a",
    KeyS: "s",
    KeyD: "d",
    ArrowUp: "up",
    ArrowLeft: "left",
    ArrowDown: "down",
    ArrowRight: "right",
    ShiftLeft: "shift",
    ShiftRight: "shift",
    Space: "space",
  };

  const lookState = {
    yaw: 0,
    pitch: 0,
    minPitch: -1.2,
    maxPitch: 1.1,
    sensitivity: 0.002,
  };

  const moveState = {
    baseSpeed: 5,
    sprintMultiplier: 1.6,
  };

  const cameraTarget = new THREE.Vector3();
  const cameraLookDir = new THREE.Vector3();
  const cameraLookAt = new THREE.Vector3();
  const miniTarget = new THREE.Vector3();
  const miniOffset = new THREE.Vector3();
  const moveDir = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const attackAimOrigin = new THREE.Vector3();
  const attackAimDirection = new THREE.Vector3();
  const attackAimPoint = new THREE.Vector3();
  const attackAimOffset = new THREE.Vector3(0, -0.2, 0);
  const attackAimForwardOffset = 0.4;
  const attackAimDistance = 30;
  const projectileSpeed = 18;
  const projectileLifetime = 2.2;
  const projectileRadius = 0.12;
  const projectileGravity = -12;

  let velocityY = 0;
  let isGrounded = true;
  let eyeHeight = 1.6;
  let modelFootOffset = 0;
  const gravity = -18;
  const jumpVelocity = 6.5;
  const miniViewport = { size: 0, margin: 14 };
  const headLayer = 1;
  const bodyLayer = 2;
  let isPointerLockRequested = false;
  let projectileId = 0;
  const projectiles: Projectile[] = [];
  const projectileColliders = resolvedWorld.projectileColliders ?? [];
  const projectileRaycaster = new THREE.Raycaster();
  const projectileRayDir = new THREE.Vector3();
  const projectileNextPos = new THREE.Vector3();
  const projectileGeometry = new THREE.SphereGeometry(projectileRadius, 12, 12);
  const projectileMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x93c5fd,
    emissiveIntensity: 0.6,
    roughness: 0.35,
    metalness: 0.1,
  });

  const isHeadRelated = (obj: THREE.Object3D | null) => {
    let current = obj;
    while (current) {
      if (/head|eye|face|hair/i.test(current.name)) return true;
      current = current.parent;
    }
    return false;
  };

  const isArmRelated = (obj: THREE.Object3D | null) => {
    let current = obj;
    while (current) {
      if (/arm|hand|weapon|gun|sword|blade/i.test(current.name)) return true;
      current = current.parent;
    }
    return false;
  };

  const avatar = new THREE.Group();
  const lookPivot = new THREE.Group();
  avatar.add(lookPivot);
  const avatarBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 1.1, 6, 16),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.2,
    })
  );
  avatarBody.castShadow = true;
  avatarBody.position.y = 0.9;
  const avatarGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 20, 20),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.9,
    })
  );
  avatarGlow.position.set(0, 1.65, 0);
  lookPivot.add(avatarBody, avatarGlow);
  avatar.position.set(0, resolvedWorld.groundY, 6);
  if (hideLocalBody) {
    avatarBody.layers.set(bodyLayer);
    avatarGlow.layers.set(bodyLayer);
  }
  scene.add(avatar);

  const loader = new GLTFLoader();
  let isMounted = true;
  let avatarModel: THREE.Object3D | null = null;
  let arms: THREE.Object3D[] = [];
  let legLeft: THREE.Object3D | null = null;
  let legRight: THREE.Object3D | null = null;
  let headBone: THREE.Object3D | null = null;
  let headBoneRest: THREE.Quaternion | null = null;

  const defaultCharacterPath = "/assets/characters/adam/adam.glb";
  let characterEntry = getCharacterEntry(characterPath || defaultCharacterPath);
  let characterRuntime: CharacterRuntime | null = null;
  let fireProjectile: (args?: {
    speed?: number;
    lifetime?: number;
    color?: number;
    emissive?: number;
    emissiveIntensity?: number;
    scale?: number;
  }) => void = () => {};
  const statusHud = createStatusHud(mount);
  let maxStats: CharacterStats = resolveCharacterStats(characterEntry.profile);
  let currentStats: CharacterStats = { ...maxStats };
  let statsDirty = true;

  const syncStatsHud = () => {
    if (!statsDirty) return;
    statusHud.setStats(currentStats, maxStats);
    statsDirty = false;
  };

  const applyStatsFromProfile = () => {
    const resolved = resolveCharacterStats(characterEntry.profile);
    maxStats = { ...resolved };
    currentStats = { ...resolved };
    statsDirty = true;
    syncStatsHud();
  };

  const disposeAvatarModel = (model: THREE.Object3D) => {
    model.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
  };

  const loadCharacter = (path?: string) => {
    const resolvedPath = path || defaultCharacterPath;
    const nextEntry = getCharacterEntry(resolvedPath);
    characterEntry = nextEntry;
    applyStatsFromProfile();
    if (characterRuntime) {
      characterRuntime.dispose();
    }
    characterRuntime = nextEntry.createRuntime({ avatar, mount, fireProjectile });
    loader.load(
      resolvedPath,
      (gltf) => {
        if (!isMounted || !gltf?.scene) return;
        if (avatarModel) {
          lookPivot.remove(avatarModel);
          disposeAvatarModel(avatarModel);
        }
        avatarModel = gltf.scene;
        avatarModel.scale.setScalar(1.15);
        avatarModel.position.set(0, 0, 0);
        arms = [];
        legLeft = null;
        legRight = null;
        headBone = null;
        headBoneRest = null;
        const meshes: THREE.Mesh[] = [];
        const skinnedMeshes: THREE.SkinnedMesh[] = [];
        let foundHeadMesh = false;
        avatarModel.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            meshes.push(mesh);
            if (isHeadRelated(mesh)) {
              foundHeadMesh = true;
            }
            if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
              skinnedMeshes.push(mesh as THREE.SkinnedMesh);
            }
          }
          if (child.name && child.name.startsWith("arm")) arms.push(child);
          if (child.name === "legLeft") legLeft = child;
          if (child.name === "legRight") legRight = child;
          if (!headBone && /head/i.test(child.name)) {
            headBone = child;
            headBoneRest = child.quaternion.clone();
          }
        });

        if (!headBone) {
          for (let i = 0; i < skinnedMeshes.length; i += 1) {
            const mesh = skinnedMeshes[i];
            const bones = mesh.skeleton?.bones || [];
            const bone = bones.find((item) => /head/i.test(item.name));
            if (bone) {
              headBone = bone;
              headBoneRest = bone.quaternion.clone();
              break;
            }
          }
        }

        const useHideBody =
          hideLocalBody || (hideLocalHead && !foundHeadMesh);
        if (useHideBody) {
          miniCamera.layers.enable(bodyLayer);
        }

        meshes.forEach((mesh) => {
          mesh.castShadow = true;
          if (useHideBody) {
            if (isArmRelated(mesh)) {
              mesh.layers.set(0);
            } else if (hideLocalHead && isHeadRelated(mesh)) {
              mesh.layers.set(headLayer);
            } else {
              mesh.layers.set(bodyLayer);
            }
          } else if (hideLocalHead && isHeadRelated(mesh)) {
            mesh.layers.set(headLayer);
          } else {
            mesh.layers.set(0);
          }
        });
        lookPivot.remove(avatarBody, avatarGlow);
        lookPivot.add(avatarModel);
        avatar.updateMatrixWorld(true);
        const modelBounds = new THREE.Box3().setFromObject(avatarModel);
        modelFootOffset = avatar.position.y - modelBounds.min.y;
        const modelHeight = modelBounds.max.y - modelBounds.min.y;
        eyeHeight = THREE.MathUtils.clamp(modelHeight * 0.85, 1.4, 2.1);
        avatar.position.y = resolvedWorld.groundY + modelFootOffset;
      },
      undefined,
      () => {
        // Keep placeholder if model fails to load.
      }
    );
  };

  const updateMiniViewport = (width: number, height: number) => {
    const minEdge = Math.min(width, height);
    miniViewport.size = Math.max(120, Math.floor(minEdge * 0.25));
    miniCamera.aspect = 16 / 9;
    miniCamera.updateProjectionMatrix();
  };

  const resolveInputDirection = (out: THREE.Vector3) => {
    const inputX =
      (pressedKeys.has("a") || pressedKeys.has("left") ? 1 : 0) +
      (pressedKeys.has("d") || pressedKeys.has("right") ? -1 : 0);
    const inputZ =
      (pressedKeys.has("w") || pressedKeys.has("up") ? 1 : 0) +
      (pressedKeys.has("s") || pressedKeys.has("down") ? -1 : 0);
    if (inputX === 0 && inputZ === 0) return false;
    const length = Math.hypot(inputX, inputZ) || 1;
    const dirX = inputX / length;
    const dirZ = inputZ / length;
    forward.set(Math.sin(lookState.yaw), 0, Math.cos(lookState.yaw));
    right.set(forward.z, 0, -forward.x);
    out.set(
      right.x * dirX + forward.x * dirZ,
      0,
      right.z * dirX + forward.z * dirZ
    );
    return true;
  };

  const isBlocked = (x: number, z: number) =>
    resolvedWorld.isBlocked ? resolvedWorld.isBlocked(x, z) : false;

  const clampToBounds = (x: number, z: number) => {
    if (!resolvedWorld.bounds) return { x, z };
    return {
      x: THREE.MathUtils.clamp(
        x,
        resolvedWorld.bounds.minX,
        resolvedWorld.bounds.maxX
      ),
      z: THREE.MathUtils.clamp(
        z,
        resolvedWorld.bounds.minZ,
        resolvedWorld.bounds.maxZ
      ),
    };
  };

  const spawnProjectile = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number = projectileSpeed,
    lifetime: number = projectileLifetime,
    options?: {
      color?: number;
      emissive?: number;
      emissiveIntensity?: number;
      scale?: number;
    }
  ) => {
    const useCustomMaterial =
      options?.color !== undefined ||
      options?.emissive !== undefined ||
      options?.emissiveIntensity !== undefined;
    const material = useCustomMaterial
      ? new THREE.MeshStandardMaterial({
          color: options?.color ?? 0xe2e8f0,
          emissive: options?.emissive ?? 0x93c5fd,
          emissiveIntensity: options?.emissiveIntensity ?? 0.6,
          roughness: 0.35,
          metalness: 0.1,
        })
      : projectileMaterial;
    const mesh = new THREE.Mesh(projectileGeometry, material);
    mesh.position.copy(origin);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (options?.scale) {
      mesh.scale.setScalar(options.scale);
    }
    scene.add(mesh);
    const velocity = direction.clone().multiplyScalar(speed);
    projectiles.push({
      id: projectileId++,
      mesh,
      velocity,
      life: 0,
      maxLife: lifetime,
      radius: projectileRadius * (options?.scale ?? 1),
      material,
      ownsMaterial: useCustomMaterial,
    });
  };

  const updateProjectiles = (delta: number) => {
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = projectiles[i];
      projectile.velocity.y += projectileGravity * delta;
      projectileNextPos
        .copy(projectile.mesh.position)
        .addScaledVector(projectile.velocity, delta);

      if (projectileColliders.length) {
        projectileRayDir.copy(projectileNextPos).sub(projectile.mesh.position);
        const travelDistance = projectileRayDir.length();
        if (travelDistance > 0.000001) {
          projectileRayDir.divideScalar(travelDistance);
          projectileRaycaster.set(projectile.mesh.position, projectileRayDir);
          projectileRaycaster.far = travelDistance + projectile.radius;
          const hits = projectileRaycaster.intersectObjects(
            projectileColliders,
            true
          );
          if (hits.length) {
            projectile.mesh.position
              .copy(hits[0].point)
              .addScaledVector(projectileRayDir, -projectile.radius);
            scene.remove(projectile.mesh);
            if (projectile.ownsMaterial) {
              projectile.material.dispose();
            }
            projectiles.splice(i, 1);
            continue;
          }
        }
      }

      projectile.mesh.position.copy(projectileNextPos);
      projectile.life += delta;
      if (
        projectile.life >= projectile.maxLife ||
        projectile.mesh.position.y <=
          resolvedWorld.groundY + projectile.radius * 0.4
      ) {
        scene.remove(projectile.mesh);
        if (projectile.ownsMaterial) {
          projectile.material.dispose();
        }
        projectiles.splice(i, 1);
      }
    }
  };

  const updateAttackAim = () => {
    camera.getWorldPosition(attackAimOrigin);
    camera.getWorldDirection(attackAimDirection);
    attackAimOrigin.add(attackAimOffset);
    attackAimOrigin.addScaledVector(attackAimDirection, attackAimForwardOffset);
    attackAimPoint
      .copy(attackAimOrigin)
      .addScaledVector(attackAimDirection, attackAimDistance);
  };

fireProjectile = (args?: {
  speed?: number;
  lifetime?: number;
  color?: number;
  emissive?: number;
  emissiveIntensity?: number;
  scale?: number;
}) => {
  updateAttackAim();
  spawnProjectile(
    attackAimOrigin,
    attackAimDirection,
    args?.speed ?? projectileSpeed,
    args?.lifetime ?? projectileLifetime,
    args
  );
};

  const triggerPrimaryAttack = () => {
    if (!characterRuntime) return;
    updateAttackAim();
    characterRuntime.handleRightClick({
      yaw: lookState.yaw,
      pitch: lookState.pitch,
      aimWorld: attackAimPoint,
      aimOriginWorld: attackAimOrigin,
    });
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button === 0) {
      if (mount?.requestPointerLock) {
        if (document.pointerLockElement !== mount && !isPointerLockRequested) {
          isPointerLockRequested = true;
          mount.requestPointerLock();
        }
      }
      if (characterRuntime?.handlePrimaryDown) {
        characterRuntime.handlePrimaryDown();
      } else {
        fireProjectile();
      }
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      triggerPrimaryAttack();
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return;
    characterRuntime?.handlePrimaryUp?.();
  };

  const handlePointerLockChange = () => {
    if (!mount) return;
    const isLocked = document.pointerLockElement === mount;
    if (!isLocked) {
      isPointerLockRequested = false;
      characterRuntime?.handlePrimaryCancel?.();
    }
    mount.style.cursor = isLocked ? "none" : "";
  };

  const handlePointerLockError = () => {
    isPointerLockRequested = false;
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== mount) return;
    lookState.yaw -= event.movementX * lookState.sensitivity;
    lookState.pitch = THREE.MathUtils.clamp(
      lookState.pitch - event.movementY * lookState.sensitivity,
      lookState.minPitch,
      lookState.maxPitch
    );
  };

  const handleContextMenu = (event: Event) => {
    event.preventDefault();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const mapped = keyMap[event.code];
    if (mapped) {
      pressedKeys.add(mapped);
    }
    if (mapped === "space" && isGrounded) {
      velocityY = jumpVelocity;
      isGrounded = false;
    }
    if (event.code === "KeyE" && !event.repeat) {
      const skillCost = characterEntry.profile.kit?.skills?.e?.cost ?? 0;
      if (skillCost > 0 && currentStats.mana < skillCost) return;
      const didTrigger = characterRuntime?.handleSkillE?.() ?? false;
      if (didTrigger && skillCost > 0) {
        currentStats.mana = Math.max(0, currentStats.mana - skillCost);
        statsDirty = true;
        syncStatsHud();
      }
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const mapped = keyMap[event.code];
    if (mapped) {
      pressedKeys.delete(mapped);
    }
  };

  const handleBlur = () => {
    pressedKeys.clear();
    characterRuntime?.handlePrimaryCancel?.();
  };

  mount.addEventListener("pointerdown", handlePointerDown);
  mount.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("pointerup", handlePointerUp);
  document.addEventListener("pointerlockchange", handlePointerLockChange);
  document.addEventListener("pointerlockerror", handlePointerLockError);
  document.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleBlur);

  loadCharacter(characterPath);
  updateMiniViewport(mount.clientWidth, mount.clientHeight);

  const update = (now: number, delta: number) => {
    const hasMoveInput = resolveInputDirection(moveDir);
    let isMoving = false;
    if (hasMoveInput) {
      const speedBoost = pressedKeys.has("shift")
        ? moveState.sprintMultiplier
        : 1;
      const moveSpeed = moveState.baseSpeed * speedBoost * delta;
      const nextX = avatar.position.x + moveDir.x * moveSpeed;
      const nextZ = avatar.position.z + moveDir.z * moveSpeed;
      const clamped = clampToBounds(nextX, nextZ);
      if (!isBlocked(clamped.x, clamped.z)) {
        avatar.position.x = clamped.x;
        avatar.position.z = clamped.z;
        isMoving = true;
      }
    }

    velocityY += gravity * delta;
    avatar.position.y += velocityY * delta;
    const groundY = resolvedWorld.groundY + modelFootOffset;
    if (avatar.position.y <= groundY) {
      avatar.position.y = groundY;
      velocityY = 0;
      isGrounded = true;
    } else {
      isGrounded = false;
    }

    if (!characterRuntime?.isFacingLocked?.()) {
      avatar.rotation.y = lookState.yaw;
    }

    const headPitch = THREE.MathUtils.clamp(-lookState.pitch, -0.8, 0.8);
    if (headBone) {
      if (headBoneRest) {
        headBone.quaternion.copy(headBoneRest);
        headBone.rotateX(headPitch);
      } else {
        headBone.rotation.x = headPitch;
      }
      lookPivot.rotation.x = 0;
    } else {
      lookPivot.rotation.x = headPitch * 0.35;
    }

    cameraTarget.set(
      avatar.position.x,
      avatar.position.y + eyeHeight,
      avatar.position.z
    );
    cameraLookDir.set(
      Math.sin(lookState.yaw) * Math.cos(lookState.pitch),
      Math.sin(lookState.pitch),
      Math.cos(lookState.yaw) * Math.cos(lookState.pitch)
    );
    camera.position.copy(cameraTarget).addScaledVector(cameraLookDir, 0.05);
    cameraLookAt.copy(cameraTarget).add(cameraLookDir);
    camera.lookAt(cameraLookAt);

    miniTarget.set(
      avatar.position.x,
      avatar.position.y + eyeHeight * 0.6,
      avatar.position.z
    );
    const behindDistance = 3.6;
    const upDistance = 3.4;
    miniOffset.set(
      -Math.sin(lookState.yaw) * behindDistance,
      upDistance,
      -Math.cos(lookState.yaw) * behindDistance
    );
    miniCamera.position.copy(miniTarget).add(miniOffset);
    miniCamera.lookAt(miniTarget);

    if (characterRuntime) {
      characterRuntime.update({
        now,
        isMoving,
        arms,
        legLeft,
        legRight,
        avatarModel,
      });
    }
    updateProjectiles(delta);
    syncStatsHud();
  };

  const render = (renderer: THREE.WebGLRenderer) => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setViewport(0, 0, width, height);
    renderer.render(scene, camera);

    const miniSize = miniViewport.size;
    const miniWidth = Math.floor(miniSize * 1.6);
    const miniHeight = miniSize;
    const miniLeft = width - miniWidth - miniViewport.margin;
    const miniBottom = height - miniHeight - miniViewport.margin;
    renderer.setScissorTest(true);
    renderer.clearDepth();
    renderer.setViewport(miniLeft, miniBottom, miniWidth, miniHeight);
    renderer.setScissor(miniLeft, miniBottom, miniWidth, miniHeight);
    renderer.render(scene, miniCamera);
    renderer.setScissorTest(false);
  };

  const resize = (width: number, height: number) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateMiniViewport(width, height);
  };

  const setCharacterPath = (path?: string) => {
    loadCharacter(path);
  };

  const dispose = () => {
    isMounted = false;
    mount.removeEventListener("pointerdown", handlePointerDown);
    mount.removeEventListener("contextmenu", handleContextMenu);
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    document.removeEventListener("pointerlockerror", handlePointerLockError);
    document.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleBlur);
    if (document.pointerLockElement === mount && document.exitPointerLock) {
      document.exitPointerLock();
    }
    avatarBody.geometry.dispose();
    avatarBody.material.dispose();
    avatarGlow.geometry.dispose();
    avatarGlow.material.dispose();
    if (avatarModel) {
      disposeAvatarModel(avatarModel);
    }
    scene.remove(avatar);
    if (characterRuntime) {
      characterRuntime.dispose();
    }
    projectiles.forEach((projectile) => scene.remove(projectile.mesh));
    projectiles.forEach((projectile) => {
      if (projectile.ownsMaterial) {
        projectile.material.dispose();
      }
    });
    projectiles.length = 0;
    projectileGeometry.dispose();
    projectileMaterial.dispose();
    statusHud.dispose();
  };

  return {
    camera,
    miniCamera,
    projectiles,
    update,
    render,
    resize,
    setCharacterPath,
    dispose,
  };
};
