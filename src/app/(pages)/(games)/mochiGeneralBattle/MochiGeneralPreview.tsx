"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const PREVIEW_PATH = "/assets/monsters/mochiGeneral/mochiGeneral.glb";

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

export default function MochiGeneralPreview() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a0a0a);
    const camera = new THREE.PerspectiveCamera(
      36,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.4, 2.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xfff1f2, 0.86);
    const key = new THREE.DirectionalLight(0xfffbeb, 1.36);
    key.position.set(2.4, 3.4, 2.1);
    const rim = new THREE.DirectionalLight(0xf97316, 0.64);
    rim.position.set(-2.2, 2.2, -1.8);
    scene.add(ambient, key, rim);

    const loader = new GLTFLoader();
    const clock = new THREE.Clock();
    const bounds = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    const sphere = new THREE.Sphere();
    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let frame = 0;
    let cancelled = false;
    let framedRadius = 1.2;

    const frameCamera = () => {
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distanceByHeight = framedRadius / Math.tan(verticalFov / 2);
      const distanceByWidth = framedRadius / Math.tan(horizontalFov / 2);
      const distance = Math.max(distanceByHeight, distanceByWidth) * 0.82;
      camera.position.set(0, framedRadius * 0.14, distance);
      camera.lookAt(0, 0, 0);
    };

    const animate = () => {
      const delta = clock.getDelta();
      if (mixer) {
        mixer.update(delta);
      } else if (model) {
        model.rotation.y += delta * 0.7;
      }
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
          if (mesh.isMesh) {
            mesh.castShadow = false;
            mesh.receiveShadow = false;
          }
        });

        bounds.copy(resolveRenderableBounds(model));
        bounds.getSize(size);
        const maxAxis = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.1 / maxAxis;
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);

        bounds.copy(resolveRenderableBounds(model));
        bounds.getCenter(center);
        model.position.set(-center.x, -center.y, -center.z);
        model.updateMatrixWorld(true);
        bounds.copy(resolveRenderableBounds(model));
        bounds.getBoundingSphere(sphere);
        framedRadius = Math.max(0.28, sphere.radius);
        frameCamera();

        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(gltf.animations[0]);
          action.reset();
          action.play();
        }

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
      mixer?.stopAllAction();
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
