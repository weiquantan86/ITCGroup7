import * as THREE from "three";
import type {
  ProjectileBuildDefaultSphereMeshArgs,
  ProjectileMeshBuildResult,
} from "../types";

const defaultSphereRadius = 0.12;

const resolveMeshRadius = (mesh: THREE.Mesh) => {
  const geometry = mesh.geometry;
  if (!geometry.boundingSphere) {
    geometry.computeBoundingSphere();
  }
  const geometryRadius = geometry.boundingSphere?.radius;
  if (!geometryRadius) {
    return undefined;
  }
  const maxScale = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
  return geometryRadius * maxScale;
};

export const createProjectileMeshFactory = () => {
  const defaultSphereGeometry = new THREE.SphereGeometry(defaultSphereRadius, 12, 12);
  const defaultSphereMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x93c5fd,
    emissiveIntensity: 0.6,
    roughness: 0.35,
    metalness: 0.1,
  });

  const createDefaultSphereMesh = (
    args: ProjectileBuildDefaultSphereMeshArgs = {}
  ): ProjectileMeshBuildResult => {
    const visual = args.visual;
    const providedMesh = visual?.mesh;
    const useCustomMaterial =
      !providedMesh &&
      (visual?.color !== undefined ||
        visual?.emissive !== undefined ||
        visual?.emissiveIntensity !== undefined);

    const material = useCustomMaterial
      ? new THREE.MeshStandardMaterial({
          color: visual?.color ?? args.fallbackColor ?? 0xe2e8f0,
          emissive: visual?.emissive ?? args.fallbackEmissive ?? 0x93c5fd,
          emissiveIntensity:
            visual?.emissiveIntensity ?? args.fallbackEmissiveIntensity ?? 0.6,
          roughness: 0.35,
          metalness: 0.1,
        })
      : providedMesh
        ? ((Array.isArray(providedMesh.material)
            ? providedMesh.material[0]
            : providedMesh.material) as THREE.Material)
        : defaultSphereMaterial;

    const mesh = providedMesh ?? new THREE.Mesh(defaultSphereGeometry, material);
    if (mesh.parent) {
      mesh.removeFromParent();
    }
    if (visual?.scale != null) {
      mesh.scale.setScalar(visual.scale);
    }

    return {
      mesh,
      material,
      ownsMaterial: useCustomMaterial && !providedMesh,
      radiusFromMesh: resolveMeshRadius(mesh),
    };
  };

  const dispose = () => {
    defaultSphereGeometry.dispose();
    defaultSphereMaterial.dispose();
  };

  return {
    createDefaultSphereMesh,
    dispose,
  };
};
