"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getCharacterEntry } from "../asset/character/registry.js";

export default function ThreeScene({ characterPath }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f1a);
    scene.fog = new THREE.Fog(0x0b0f1a, 10, 32);

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 4.5, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.35);
    const keyLight = new THREE.SpotLight(0xe2e8f0, 1.0, 40, Math.PI / 4, 0.45, 1);
    keyLight.position.set(4, 8, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const hemiLight = new THREE.HemisphereLight(0x1e293b, 0x0b0f1a, 0.5);
    scene.add(ambientLight, keyLight, hemiLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
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
    const groundCollider = {
      y: ground.position.y,
    };

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
    const treeColliders = [];
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

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let rightButtonDown = false;
    let yaw = 0;
    let pitch = -0.2;
    let zoomTarget = camera.position.z;
    let velocityY = 0;
    let isGrounded = true;
    const gravity = -18;
    const jumpVelocity = 6.5;

    const avatar = new THREE.Group();
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
    avatar.add(avatarBody, avatarGlow);
    avatar.position.set(0, -1.4, 6);
    scene.add(avatar);

    const defaultCharacterPath = "/assets/characters/adam/adam.glb";
    let characterEntry = getCharacterEntry(
      characterPath || defaultCharacterPath
    );
    let characterRuntime = characterEntry.createRuntime({ avatar });

    let avatarModel = null;
    let arms = [];
    let legLeft = null;
    let legRight = null;
    let modelFootOffset = 0;

    const loader = new GLTFLoader();
    let isMounted = true;
    const selectProfile = (path) => {
      const nextEntry = getCharacterEntry(path);
      characterEntry = nextEntry;
      if (characterRuntime) {
        characterRuntime.dispose();
      }
      characterRuntime = nextEntry.createRuntime({ avatar });
    };
    const loadCharacter = (path) => {
      if (!path) return;
      selectProfile(path);
      loader.load(
        path,
        (gltf) => {
          if (!isMounted || !gltf?.scene) return;
          if (avatarModel) {
            avatar.remove(avatarModel);
          }
          avatarModel = gltf.scene;
          avatarModel.scale.setScalar(1.15);
          avatarModel.position.set(0, 0, 0);
          arms = [];
          legLeft = null;
          legRight = null;
          avatarModel.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
            }
            if (child.name && child.name.startsWith("arm")) arms.push(child);
            if (child.name === "legLeft") legLeft = child;
            if (child.name === "legRight") legRight = child;
          });
          avatar.remove(avatarBody, avatarGlow);
          avatar.add(avatarModel);
          avatar.updateMatrixWorld(true);
          const modelBounds = new THREE.Box3().setFromObject(avatarModel);
          modelFootOffset = avatar.position.y - modelBounds.min.y;
          avatar.position.y = groundCollider.y + modelFootOffset;
          velocityY = 0;
          isGrounded = true;
        },
        undefined,
        () => {
          // Keep placeholder if model fails to load.
        }
      );
    };
    loadCharacter(characterPath || defaultCharacterPath);

    const pressedKeys = new Set();
    const keyMap = {
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
    let animationId;
    let lastTime = 0;
    const animate = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000 || 0.016;
      lastTime = now;

      const moveX =
        (pressedKeys.has("d") || pressedKeys.has("right") ? 1 : 0) +
        (pressedKeys.has("a") || pressedKeys.has("left") ? -1 : 0);
      const moveZ =
        (pressedKeys.has("s") || pressedKeys.has("down") ? 1 : 0) +
        (pressedKeys.has("w") || pressedKeys.has("up") ? -1 : 0);
      const isMoving = moveX !== 0 || moveZ !== 0;
      if (isMoving) {
        const speedBoost = pressedKeys.has("shift") ? 1.8 : 1;
        const moveSpeed = 3.2 * speedBoost * delta;
        const length = Math.hypot(moveX, moveZ) || 1;
        const dirX = moveX / length;
        const dirZ = moveZ / length;
        const angle = Math.atan2(dirX, dirZ) + yaw;
        if (!characterRuntime?.isFacingLocked?.()) {
          avatar.rotation.y = angle;
        }
        const nextX = avatar.position.x + Math.sin(angle) * moveSpeed;
        const nextZ = avatar.position.z + Math.cos(angle) * moveSpeed;
        const clampedX = THREE.MathUtils.clamp(nextX, -12, 12);
        const clampedZ = THREE.MathUtils.clamp(nextZ, -12, 12);
        let blocked = false;
        for (let i = 0; i < treeColliders.length; i += 1) {
          const collider = treeColliders[i];
          const dx = clampedX - collider.position.x;
          const dz = clampedZ - collider.position.z;
          if (dx * dx + dz * dz < (collider.radius + 0.45) ** 2) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          avatar.position.x = clampedX;
          avatar.position.z = clampedZ;
        }
      }

      velocityY += gravity * delta;
      avatar.position.y += velocityY * delta;
      const groundY = groundCollider.y + modelFootOffset;
      if (avatar.position.y <= groundY) {
        avatar.position.y = groundY;
        velocityY = 0;
        isGrounded = true;
      } else {
        isGrounded = false;
      }

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

      const cameraOffset = new THREE.Vector3(
        Math.sin(yaw) * (zoomTarget - 5),
        2.6 + pitch * 2.2,
        Math.cos(yaw) * (zoomTarget - 5)
      );
      const cameraTarget = new THREE.Vector3(
        avatar.position.x,
        1.2,
        avatar.position.z
      );
      camera.position.copy(cameraTarget).add(cameraOffset);
      camera.lookAt(cameraTarget);

      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    const triggerRightClick = () => {
      if (!characterRuntime) return;
      characterRuntime.handleRightClick(getFacing());
    };

    const handlePointerMove = (event) => {
      const rightDown = (event.buttons & 2) === 2;
      if (rightDown && !rightButtonDown) {
        rightButtonDown = true;
        triggerRightClick();
      } else if (!rightDown && rightButtonDown) {
        rightButtonDown = false;
      }
      if (!isDragging) return;
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      yaw -= deltaX * 0.004;
      pitch -= deltaY * 0.003;
      pitch = THREE.MathUtils.clamp(pitch, -0.7, 0.6);
    };

    const getFacing = () => {
      const moveX =
        (pressedKeys.has("d") || pressedKeys.has("right") ? 1 : 0) +
        (pressedKeys.has("a") || pressedKeys.has("left") ? -1 : 0);
      const moveZ =
        (pressedKeys.has("s") || pressedKeys.has("down") ? 1 : 0) +
        (pressedKeys.has("w") || pressedKeys.has("up") ? -1 : 0);
      if (moveX !== 0 || moveZ !== 0) {
        const length = Math.hypot(moveX, moveZ) || 1;
        const dirX = moveX / length;
        const dirZ = moveZ / length;
        return Math.atan2(dirX, dirZ) + yaw;
      }
      return avatar.rotation.y;
    };

    const handlePointerDown = (event) => {
      if (event.button === 2) {
        event.preventDefault();
        if (!rightButtonDown) {
          rightButtonDown = true;
          triggerRightClick();
        }
        return;
      }
      if (event.button !== 0) return;
      isDragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const handlePointerUp = (event) => {
      if (event.button === 2) {
        rightButtonDown = false;
      }
      if ((event.buttons & 2) !== 2) {
        rightButtonDown = false;
      }
      if (event.button === 0 || (event.buttons & 1) !== 1) {
        isDragging = false;
      }
    };

    const handleWheel = (event) => {
      zoomTarget = THREE.MathUtils.clamp(
        zoomTarget + Math.sign(event.deltaY) * 0.6,
        7,
        14
      );
    };
    const handleContextMenu = (event) => {
      event.preventDefault();
    };

    const handleKeyDown = (event) => {
      const mapped = keyMap[event.code];
      if (mapped) {
        pressedKeys.add(mapped);
      }
      if (mapped === "space" && isGrounded) {
        velocityY = jumpVelocity;
        isGrounded = false;
      }
    };

    const handleKeyUp = (event) => {
      const mapped = keyMap[event.code];
      if (mapped) {
        pressedKeys.delete(mapped);
      }
    };

    const handleBlur = () => {
      pressedKeys.clear();
      rightButtonDown = false;
      isDragging = false;
    };

    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("pointerdown", handlePointerDown);
    mount.addEventListener("pointerup", handlePointerUp);
    mount.addEventListener("pointerleave", handlePointerUp);
    mount.addEventListener("contextmenu", handleContextMenu);
    mount.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      isMounted = false;
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("pointerdown", handlePointerDown);
      mount.removeEventListener("pointerup", handlePointerUp);
      mount.removeEventListener("pointerleave", handlePointerUp);
      mount.removeEventListener("contextmenu", handleContextMenu);
      mount.removeEventListener("wheel", handleWheel);
      avatarBody.geometry.dispose();
      avatarBody.material.dispose();
      avatarGlow.geometry.dispose();
      avatarGlow.material.dispose();
      if (avatarModel) {
        avatarModel.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });
      }
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
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      if (characterRuntime) {
        characterRuntime.dispose();
      }
    };
  }, [characterPath]);

  return (
    <div
      className="relative h-[520px] w-full overflow-hidden rounded-[32px] border border-white/5 bg-[#0b0f1a] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]"
      aria-label="Interactive 3D scene"
    >
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
}
