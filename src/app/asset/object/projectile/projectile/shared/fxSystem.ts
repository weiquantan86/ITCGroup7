import * as THREE from "three";
import type { Projectile, ProjectileExplosionFragment } from "../../types";

type CreateProjectileFxSystemArgs = {
  scene: THREE.Scene;
};

type SpawnDefaultExplosionFxArgs = {
  projectile: Projectile;
  point: THREE.Vector3;
  direction: THREE.Vector3;
};

export const createProjectileFxSystem = ({ scene }: CreateProjectileFxSystemArgs) => {
  const fragments: ProjectileExplosionFragment[] = [];
  const explosionOrigin = new THREE.Vector3();
  const explosionDirection = new THREE.Vector3();
  const projectileExplosionGeometry = new THREE.IcosahedronGeometry(0.09, 0);
  const projectileExplosionMaterial = new THREE.MeshStandardMaterial({
    color: 0x86efac,
    roughness: 0.22,
    metalness: 0.18,
    emissive: 0x22c55e,
    emissiveIntensity: 0.7,
  });

  const spawnDefaultExplosionFx = ({
    projectile,
    point,
    direction,
  }: SpawnDefaultExplosionFxArgs) => {
    const baseExplosionRadius = 3.6;
    explosionOrigin.copy(point);
    explosionDirection.copy(direction);
    if (explosionDirection.lengthSq() < 0.000001) {
      explosionDirection.set(0, 0, 1);
    } else {
      explosionDirection.normalize();
    }

    const visualFactor = THREE.MathUtils.clamp(
      projectile.explosionRadius > 0
        ? projectile.explosionRadius / baseExplosionRadius
        : 1,
      0.75,
      5
    );
    const fragmentCount = Math.max(
      14,
      Math.min(42, Math.round(14 * visualFactor))
    );
    const spread = 0.45 * visualFactor;
    const velocityScale = Math.sqrt(visualFactor);
    const minScale = 0.72 * visualFactor;
    const maxScale = 1.08 * visualFactor;
    const useCustomExplosionMaterial =
      projectile.explosionColor != null ||
      projectile.explosionEmissive != null ||
      projectile.explosionEmissiveIntensity != null;

    for (let i = 0; i < fragmentCount; i += 1) {
      const fragmentMaterial = useCustomExplosionMaterial
        ? new THREE.MeshStandardMaterial({
            color: projectile.explosionColor ?? 0x86efac,
            roughness: 0.22,
            metalness: 0.18,
            emissive: projectile.explosionEmissive ?? 0x22c55e,
            emissiveIntensity: projectile.explosionEmissiveIntensity ?? 0.7,
          })
        : projectileExplosionMaterial;
      const mesh = new THREE.Mesh(projectileExplosionGeometry, fragmentMaterial);
      const baseScale = THREE.MathUtils.lerp(minScale, maxScale, Math.random());
      mesh.scale.setScalar(baseScale);
      mesh.position.copy(explosionOrigin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread
        )
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4.6 * velocityScale,
        (1.5 + Math.random() * 2.8) * velocityScale,
        (Math.random() - 0.5) * 4.6 * velocityScale
      ).addScaledVector(explosionDirection, -2.2 * velocityScale);
      fragments.push({
        mesh,
        velocity,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 7.4,
          (Math.random() - 0.5) * 7.4,
          (Math.random() - 0.5) * 7.4
        ),
        life: 0,
        maxLife: (0.55 + Math.random() * 0.2) * velocityScale,
        baseScale,
        material: fragmentMaterial,
        ownsMaterial: useCustomExplosionMaterial,
      });
    }
  };

  const clear = () => {
    for (let i = 0; i < fragments.length; i += 1) {
      const fragment = fragments[i];
      scene.remove(fragment.mesh);
      if (fragment.ownsMaterial) {
        fragment.material.dispose();
      }
    }
    fragments.length = 0;
  };

  const update = (delta: number) => {
    for (let i = fragments.length - 1; i >= 0; i -= 1) {
      const fragment = fragments[i];
      fragment.velocity.y -= 11.5 * delta;
      fragment.mesh.position.addScaledVector(fragment.velocity, delta);
      fragment.mesh.rotation.x += fragment.spin.x * delta;
      fragment.mesh.rotation.y += fragment.spin.y * delta;
      fragment.mesh.rotation.z += fragment.spin.z * delta;
      fragment.life += delta;
      const lifeRatio = Math.max(0, 1 - fragment.life / fragment.maxLife);
      fragment.mesh.scale.setScalar(
        Math.max(0.08, fragment.baseScale * lifeRatio)
      );
      if (fragment.life >= fragment.maxLife) {
        scene.remove(fragment.mesh);
        if (fragment.ownsMaterial) {
          fragment.material.dispose();
        }
        fragments.splice(i, 1);
      }
    }
  };

  const dispose = () => {
    clear();
    projectileExplosionGeometry.dispose();
    projectileExplosionMaterial.dispose();
  };

  return {
    spawnDefaultExplosionFx,
    clear,
    update,
    dispose,
  };
};
