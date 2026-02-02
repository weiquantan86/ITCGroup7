import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getCharacterEntry } from "./registry";

export interface PlayerWorld {
  groundY: number;
  isBlocked?: (x: number, z: number) => boolean;
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
}

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
    bounds: 12,
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
  let characterRuntime = characterEntry.createRuntime({ avatar });

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
    if (characterRuntime) {
      characterRuntime.dispose();
    }
    characterRuntime = nextEntry.createRuntime({ avatar });
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

  const spawnProjectile = (origin: THREE.Vector3, direction: THREE.Vector3) => {
    const mesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
    mesh.position.copy(origin);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const velocity = direction.clone().multiplyScalar(projectileSpeed);
    projectiles.push({
      id: projectileId++,
      mesh,
      velocity,
      life: 0,
      maxLife: projectileLifetime,
      radius: projectileRadius,
    });
  };

  const updateProjectiles = (delta: number) => {
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = projectiles[i];
      projectile.mesh.position.addScaledVector(projectile.velocity, delta);
      projectile.life += delta;
      if (projectile.life >= projectile.maxLife) {
        scene.remove(projectile.mesh);
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

  const triggerProjectileAttack = () => {
    updateAttackAim();
    spawnProjectile(attackAimOrigin, attackAimDirection);
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
      triggerProjectileAttack();
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      triggerPrimaryAttack();
    }
  };

  const handlePointerLockChange = () => {
    if (!mount) return;
    const isLocked = document.pointerLockElement === mount;
    if (!isLocked) {
      isPointerLockRequested = false;
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
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const mapped = keyMap[event.code];
    if (mapped) {
      pressedKeys.delete(mapped);
    }
  };

  const handleBlur = () => {
    pressedKeys.clear();
  };

  mount.addEventListener("pointerdown", handlePointerDown);
  mount.addEventListener("contextmenu", handleContextMenu);
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
      const clampedX = THREE.MathUtils.clamp(
        nextX,
        -moveState.bounds,
        moveState.bounds
      );
      const clampedZ = THREE.MathUtils.clamp(
        nextZ,
        -moveState.bounds,
        moveState.bounds
      );
      if (!isBlocked(clampedX, clampedZ)) {
        avatar.position.x = clampedX;
        avatar.position.z = clampedZ;
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
    projectiles.length = 0;
    projectileGeometry.dispose();
    projectileMaterial.dispose();
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
