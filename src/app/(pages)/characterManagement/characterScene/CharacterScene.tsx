"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  applyCharacterModelVisibility,
  createVisibleModelBounds,
} from "../../../asset/entity/character/general/engine/modelVisibility";

type CharacterSceneProps = {
  characterPath?: string;
  className?: string;
};

const createColorfulBackgroundTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createLinearGradient(0, 0, 1024, 1024);
  gradient.addColorStop(0, "#0a2f8f");
  gradient.addColorStop(0.45, "#4b1d9e");
  gradient.addColorStop(1, "#9f2b55");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 1024);

  const glowA = context.createRadialGradient(240, 180, 20, 240, 180, 420);
  glowA.addColorStop(0, "rgba(56,189,248,0.28)");
  glowA.addColorStop(1, "rgba(56,189,248,0)");
  context.fillStyle = glowA;
  context.fillRect(0, 0, 1024, 1024);

  const glowB = context.createRadialGradient(820, 760, 30, 820, 760, 460);
  glowB.addColorStop(0, "rgba(251,191,36,0.2)");
  glowB.addColorStop(1, "rgba(251,191,36,0)");
  context.fillStyle = glowB;
  context.fillRect(0, 0, 1024, 1024);

  context.fillStyle = "rgba(2,6,23,0.24)";
  context.fillRect(0, 0, 1024, 1024);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const withDevCacheBust = (path: string) => {
  if (process.env.NODE_ENV !== "development") return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${Date.now()}`;
};

export default function CharacterScene({
  characterPath,
  className = "",
}: CharacterSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const backgroundTexture = createColorfulBackgroundTexture();
    scene.background = backgroundTexture ?? new THREE.Color(0x0b1119);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.6, 4.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.5;
    controls.maxDistance = 9;
    controls.target.set(0, 1.1, 0);
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight(0x94a3b8, 0.6);
    const keyLight = new THREE.DirectionalLight(0xe2e8f0, 1.2);
    keyLight.position.set(3, 6, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    rimLight.position.set(-4, 3, -2);
    const fillLight = new THREE.DirectionalLight(0xcbd5f5, 0.4);
    fillLight.position.set(-2, 4, 2);
    scene.add(ambient, keyLight, rimLight, fillLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.8, 64),
      new THREE.MeshStandardMaterial({
        color: 0x2a1b52,
        roughness: 0.9,
        metalness: 0.08,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    loaderRef.current = new GLTFLoader();

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameRef.current = window.requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(mount);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      backgroundTexture?.dispose();
      scene.clear();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const loader = loaderRef.current;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!scene || !loader || !controls || !camera) return;

    const disposeModel = (model: THREE.Object3D) => {
      model.traverse((child) => {
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

    if (modelRef.current) {
      scene.remove(modelRef.current);
      disposeModel(modelRef.current);
      modelRef.current = null;
    }

    const resolvedPath = characterPath || "/assets/characters/adam/adam.glb";
    const loadPath = withDevCacheBust(resolvedPath);
    let cancelled = false;

    loader.load(
      loadPath,
      (gltf) => {
        if (cancelled || !gltf?.scene) return;
        const model = gltf.scene;
        applyCharacterModelVisibility(model, resolvedPath);
        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.visible) {
            mesh.castShadow = true;
          }
        });

        const box = createVisibleModelBounds(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxAxis = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.6 / maxAxis;
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);

        const meshBounds = createVisibleModelBounds(model);

        const center = new THREE.Vector3();
        meshBounds.getCenter(center);
        model.position.set(-center.x, -meshBounds.min.y, -center.z);
        model.updateMatrixWorld(true);

        scene.add(model);
        modelRef.current = model;

        const height = meshBounds.max.y - meshBounds.min.y;
        controls.target.set(0, height * 0.55, 0);
        const distance = THREE.MathUtils.clamp(height * 1.6, 2.8, 7.5);
        camera.position.set(0, height * 0.8, distance);
        controls.update();
      },
      undefined,
      () => {
        // Keep empty if model fails to load.
      }
    );

    return () => {
      cancelled = true;
    };
  }, [characterPath]);

  return (
    <div
      ref={mountRef}
      className={`h-full w-full overflow-hidden rounded-[20px] ${className}`}
    />
  );
}
