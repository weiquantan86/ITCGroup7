"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const PREVIEW_PATH = "/assets/monsters/mada/mada.glb";

const withDevCacheBust = (path: string) => {
  if (process.env.NODE_ENV !== "development") return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${Date.now()}`;
};

const disposeObjectResources = (object: THREE.Object3D) => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose?.();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
      return;
    }
    mesh.material?.dispose?.();
  });
};

const resolveRenderableBounds = (object: THREE.Object3D) => {
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  let hasMesh = false;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshBounds.setFromObject(mesh);
    if (!hasMesh) {
      bounds.copy(meshBounds);
      hasMesh = true;
    } else {
      bounds.union(meshBounds);
    }
  });
  if (!hasMesh) {
    bounds.setFromObject(object);
  }
  return bounds;
};

export default function MadaPreview() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061217);

    const camera = new THREE.PerspectiveCamera(
      34,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.2, 2.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xd9fffb, 0.78);
    const key = new THREE.DirectionalLight(0xe6fff6, 1.35);
    key.position.set(2.8, 3.8, 2.1);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.92);
    rim.position.set(-2.4, 2.6, -1.6);
    const floorGlow = new THREE.PointLight(0x34d399, 1.8, 8);
    floorGlow.position.set(0, -0.8, 1.4);
    scene.add(ambient, key, rim, floorGlow);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0b1c22,
        roughness: 0.46,
        metalness: 0.58,
        emissive: 0x0f766e,
        emissiveIntensity: 0.22,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.25;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.06, 12, 56),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.64,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.18;
    scene.add(ring);

    const loader = new GLTFLoader();
    const clock = new THREE.Clock();
    const bounds = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    const sphere = new THREE.Sphere();
    let model: THREE.Object3D | null = null;
    let frame = 0;
    let cancelled = false;
    let framedRadius = 1.2;

    const frameCamera = () => {
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distanceByHeight = framedRadius / Math.tan(verticalFov / 2);
      const distanceByWidth = framedRadius / Math.tan(horizontalFov / 2);
      const distance = Math.max(distanceByHeight, distanceByWidth) * 0.94;
      camera.position.set(0, framedRadius * 0.1, distance);
      camera.lookAt(0, 0.08, 0);
    };

    const animate = () => {
      const delta = clock.getDelta();
      if (model) {
        model.rotation.y += delta * 0.42;
      }
      ring.rotation.z += delta * 0.9;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    loader.load(
      withDevCacheBust(PREVIEW_PATH),
      (gltf) => {
        if (cancelled || !gltf?.scene) {
          if (gltf?.scene) {
            disposeObjectResources(gltf.scene);
          }
          return;
        }

        model = gltf.scene;
        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        });

        bounds.copy(resolveRenderableBounds(model));
        bounds.getSize(size);
        const maxAxis = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.2 / maxAxis;
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);

        bounds.copy(resolveRenderableBounds(model));
        bounds.getCenter(center);
        model.position.set(-center.x, -center.y, -center.z);
        model.updateMatrixWorld(true);
        bounds.copy(resolveRenderableBounds(model));
        bounds.getBoundingSphere(sphere);
        framedRadius = Math.max(0.32, sphere.radius);
        frameCamera();

        scene.add(model);
      },
      undefined,
      () => {
        if (cancelled) return;
        setLoadError("Preview load failed");
      }
    );

    const handleResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      frameCamera();
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(mount);
    animate();

    return () => {
      cancelled = true;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      if (model) {
        scene.remove(model);
        disposeObjectResources(model);
      }
      floor.geometry.dispose();
      if (Array.isArray(floor.material)) {
        floor.material.forEach((material) => material.dispose());
      } else {
        floor.material.dispose();
      }
      ring.geometry.dispose();
      if (Array.isArray(ring.material)) {
        ring.material.forEach((material) => material.dispose());
      } else {
        ring.material.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      scene.clear();
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mountRef} className="h-full w-full" />
      {loadError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/80 px-3 text-center text-xs text-rose-200">
          {loadError}
        </div>
      ) : null}
    </div>
  );
}
