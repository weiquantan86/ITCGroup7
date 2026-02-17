import * as THREE from "three";

type TrackObjectOptions = {
  castShadow?: boolean;
  receiveShadow?: boolean;
};

export type SceneResourceTracker = {
  trackGeometry: (geometry: THREE.BufferGeometry | null | undefined) => void;
  trackMaterial: (material: THREE.Material | null | undefined) => void;
  trackMesh: (mesh: THREE.Mesh) => void;
  trackObject: (object: THREE.Object3D, options?: TrackObjectOptions) => void;
  disposeObjectResources: (object: THREE.Object3D) => void;
  disposeTrackedResources: () => void;
};

export const createSceneResourceTracker = (): SceneResourceTracker => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  const trackGeometry = (geometry: THREE.BufferGeometry | null | undefined) => {
    if (!geometry) return;
    geometries.add(geometry);
  };

  const trackMaterial = (material: THREE.Material | null | undefined) => {
    if (!material) return;
    materials.add(material);
  };

  const trackMesh = (mesh: THREE.Mesh) => {
    trackGeometry(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      for (let i = 0; i < mesh.material.length; i += 1) {
        trackMaterial(mesh.material[i]);
      }
      return;
    }
    trackMaterial(mesh.material);
  };

  const trackObject = (object: THREE.Object3D, options?: TrackObjectOptions) => {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (typeof options?.castShadow === "boolean") {
        mesh.castShadow = options.castShadow;
      }
      if (typeof options?.receiveShadow === "boolean") {
        mesh.receiveShadow = options.receiveShadow;
      }
      trackMesh(mesh);
    });
  };

  const disposeObjectResources = (object: THREE.Object3D) => {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose?.();
      if (Array.isArray(mesh.material)) {
        for (let i = 0; i < mesh.material.length; i += 1) {
          mesh.material[i]?.dispose?.();
        }
        return;
      }
      mesh.material?.dispose?.();
    });
  };

  const disposeTrackedResources = () => {
    geometries.forEach((geometry) => geometry.dispose());
    geometries.clear();
    materials.forEach((material) => material.dispose());
    materials.clear();
  };

  return {
    trackGeometry,
    trackMaterial,
    trackMesh,
    trackObject,
    disposeObjectResources,
    disposeTrackedResources,
  };
};

