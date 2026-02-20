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
  const explosionOffset = new THREE.Vector3();
  const explosionOutward = new THREE.Vector3();
  const projectileExplosionGeometry = new THREE.IcosahedronGeometry(0.09, 0);
  const projectileShockwaveGeometry = new THREE.SphereGeometry(1, 20, 14);
  const projectileExplosionMaterial = new THREE.MeshStandardMaterial({
    color: 0x86efac,
    roughness: 0.22,
    metalness: 0.18,
    emissive: 0x22c55e,
    emissiveIntensity: 0.7,
  });
  const hasAdjustableOpacity = (
    material: THREE.Material
  ): material is THREE.Material & { opacity: number; transparent: boolean } =>
    typeof (
      material as THREE.Material & { opacity?: number; transparent?: boolean }
    ).opacity === "number";

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

    const configuredRadius =
      projectile.explosionRadius > 0
        ? projectile.explosionRadius
        : baseExplosionRadius;
    const visualRadius = Math.max(0.75, configuredRadius);
    const visualFactor = THREE.MathUtils.clamp(
      visualRadius / baseExplosionRadius,
      0.65,
      8
    );
    const velocityScale = Math.sqrt(visualFactor);
    const minScale = 0.72 * visualFactor;
    const maxScale = 1.08 * visualFactor;
    const useCustomExplosionMaterial =
      projectile.explosionColor != null ||
      projectile.explosionEmissive != null ||
      projectile.explosionEmissiveIntensity != null;
    const isBlackWhiteExplosion =
      projectile.explosionColor === 0x000000 &&
      projectile.explosionEmissive === 0xffffff;
    const isCrimsonExplosion =
      projectile.explosionColor === 0x2a0407 &&
      projectile.explosionEmissive === 0xff2020;
    const prefersHeavyExplosion = isCrimsonExplosion || visualRadius >= 6;
    const baseFragmentCount = Math.max(
      14,
      Math.min(54, Math.round(16 * visualFactor))
    );
    const fireFragmentCount = isBlackWhiteExplosion
      ? Math.max(52, Math.min(140, Math.round(34 * visualFactor + 24)))
      : isCrimsonExplosion
        ? Math.max(56, Math.min(156, Math.round(40 * visualFactor + 26)))
        : baseFragmentCount;
    const smokeFragmentCount = prefersHeavyExplosion
      ? Math.max(12, Math.min(64, Math.round(13 * visualFactor)))
      : 0;
    const resolvedSpread = visualRadius;
    const hotEmissive = projectile.explosionEmissive ?? 0x22c55e;

    if (projectile.explosionRadius > 0) {
      const shockwaveStartScale = Math.max(0.12, visualRadius * 0.18);
      const shockwaveEndScale = visualRadius;
      const shockwaveMaterial = new THREE.MeshBasicMaterial({
        color: hotEmissive,
        transparent: true,
        opacity: isCrimsonExplosion ? 0.82 : 0.64,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const shockwaveMesh = new THREE.Mesh(
        projectileShockwaveGeometry,
        shockwaveMaterial
      );
      shockwaveMesh.position.copy(explosionOrigin);
      shockwaveMesh.scale.setScalar(shockwaveStartScale);
      shockwaveMesh.userData.startScaleMultiplier = 1;
      shockwaveMesh.userData.endScaleMultiplier =
        shockwaveEndScale / shockwaveStartScale;
      shockwaveMesh.userData.gravity = 0;
      shockwaveMesh.userData.drag = 0;
      shockwaveMesh.userData.baseOpacity = shockwaveMaterial.opacity;
      shockwaveMesh.userData.opacityStart = shockwaveMaterial.opacity;
      shockwaveMesh.userData.opacityPeak = shockwaveMaterial.opacity;
      shockwaveMesh.userData.opacityEnd = 0;
      shockwaveMesh.userData.opacityPeakAt = 0.08;
      scene.add(shockwaveMesh);
      fragments.push({
        mesh: shockwaveMesh,
        velocity: new THREE.Vector3(),
        spin: new THREE.Vector3(0, 0, 0),
        life: 0,
        maxLife: isCrimsonExplosion ? 0.34 : 0.26,
        baseScale: 1,
        material: shockwaveMaterial,
        ownsMaterial: true,
      });
    }

    for (let i = 0; i < fireFragmentCount + smokeFragmentCount; i += 1) {
      const isSmokeFragment = i >= fireFragmentCount;
      const fragmentMaterial =
        isSmokeFragment
          ? new THREE.MeshStandardMaterial({
              color: 0x111827,
              roughness: 0.92,
              metalness: 0,
              emissive: isCrimsonExplosion ? 0x450a0a : 0x111827,
              emissiveIntensity: isCrimsonExplosion ? 0.14 : 0.06,
              transparent: true,
              opacity: 0,
            })
          : useCustomExplosionMaterial
            ? isBlackWhiteExplosion
              ? new THREE.MeshStandardMaterial({
                  color: i % 2 === 0 ? 0xf8fafc : 0x020617,
                  roughness: 0.2,
                  metalness: 0.28,
                  emissive: i % 2 === 0 ? 0xffffff : 0x0a0a0a,
                  emissiveIntensity: projectile.explosionEmissiveIntensity ?? 1.2,
                })
              : isCrimsonExplosion
                ? (() => {
                    const hotness = Math.random();
                    const color =
                      hotness > 0.78
                        ? 0xfb923c
                        : hotness > 0.42
                          ? 0xdc2626
                          : 0x7f1d1d;
                    return new THREE.MeshStandardMaterial({
                      color,
                      roughness: 0.2,
                      metalness: 0.16,
                      emissive: 0x7f1d1d,
                      emissiveIntensity:
                        (projectile.explosionEmissiveIntensity ?? 1.1) *
                        (0.76 + Math.random() * 0.42),
                      transparent: true,
                      opacity: 0.9,
                    });
                  })()
                : new THREE.MeshStandardMaterial({
                    color: projectile.explosionColor ?? 0x86efac,
                    roughness: 0.22,
                    metalness: 0.18,
                    emissive: projectile.explosionEmissive ?? 0x22c55e,
                    emissiveIntensity: projectile.explosionEmissiveIntensity ?? 0.7,
                  })
            : projectileExplosionMaterial;
      const mesh = new THREE.Mesh(projectileExplosionGeometry, fragmentMaterial);
      const baseScale = isSmokeFragment
        ? THREE.MathUtils.lerp(0.36 * visualFactor, 0.86 * visualFactor, Math.random())
        : isBlackWhiteExplosion
          ? THREE.MathUtils.lerp(
              0.86 * visualFactor,
              1.92 * visualFactor,
              Math.random()
            )
          : isCrimsonExplosion
            ? THREE.MathUtils.lerp(
                0.62 * visualFactor,
                1.78 * visualFactor,
                Math.random()
              )
            : THREE.MathUtils.lerp(minScale, maxScale, Math.random());
      mesh.scale.setScalar(baseScale);

      explosionOffset.set(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      );
      if (explosionOffset.lengthSq() < 0.000001) {
        explosionOffset.set(1, 0, 0);
      } else {
        explosionOffset.normalize();
      }
      const spawnRadius = isSmokeFragment
        ? Math.random() * resolvedSpread * 0.56
        : Math.pow(Math.random(), 0.68) * resolvedSpread;
      mesh.position.copy(explosionOrigin).addScaledVector(explosionOffset, spawnRadius);

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const velocity = isSmokeFragment
        ? new THREE.Vector3()
            .copy(explosionOffset)
            .multiplyScalar((0.34 + Math.random() * 0.58) * visualRadius)
            .setY((0.42 + Math.random() * 0.78) * visualRadius)
        : isBlackWhiteExplosion
          ? (() => {
              explosionOutward.copy(mesh.position).sub(explosionOrigin);
              explosionOutward.y = 0;
              if (explosionOutward.lengthSq() < 0.000001) {
                explosionOutward.set(
                  Math.random() - 0.5,
                  0,
                  Math.random() - 0.5
                );
              }
              if (explosionOutward.lengthSq() < 0.000001) {
                explosionOutward.set(1, 0, 0);
              } else {
                explosionOutward.normalize();
              }
              const radialSpeed =
                (1 + Math.random() * 1.2) * Math.max(2.8, visualRadius * 1.35);
              const upSpeed =
                (1 + Math.random() * 1.6) * Math.max(1.8, visualRadius * 0.72);
              return new THREE.Vector3()
                .copy(explosionOutward)
                .multiplyScalar(radialSpeed)
                .addScaledVector(explosionDirection, -0.8)
                .setY(upSpeed);
            })()
          : isCrimsonExplosion
            ? new THREE.Vector3()
                .copy(explosionOffset)
                .multiplyScalar(
                  (0.86 + Math.random() * 1.6) * Math.max(3.2, visualRadius * 1.2)
                )
                .addScaledVector(explosionDirection, -0.42)
                .setY((0.9 + Math.random() * 1.4) * Math.max(2.6, visualRadius * 0.9))
            : new THREE.Vector3(
                (Math.random() - 0.5) * 4.6 * velocityScale,
                (1.5 + Math.random() * 2.8) * velocityScale,
                (Math.random() - 0.5) * 4.6 * velocityScale
              ).addScaledVector(explosionDirection, -2.2 * velocityScale);

      if (isSmokeFragment) {
        mesh.userData.gravity = 2.2;
        mesh.userData.drag = 2.6;
        mesh.userData.startScaleMultiplier = 0.3;
        mesh.userData.endScaleMultiplier = 3;
        mesh.userData.baseOpacity = 0.62;
        mesh.userData.opacityStart = 0;
        mesh.userData.opacityPeak = 0.62;
        mesh.userData.opacityEnd = 0;
        mesh.userData.opacityPeakAt = 0.32;
      } else if (isCrimsonExplosion) {
        mesh.userData.gravity = 8.2;
        mesh.userData.drag = 1.35;
        mesh.userData.startScaleMultiplier = 1.06;
        mesh.userData.endScaleMultiplier = 0.1;
        mesh.userData.baseOpacity = 0.9;
        mesh.userData.opacityStart = 0.9;
        mesh.userData.opacityPeak = 1;
        mesh.userData.opacityEnd = 0;
        mesh.userData.opacityPeakAt = 0.1;
      }

      fragments.push({
        mesh,
        velocity,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * (isSmokeFragment ? 2.8 : 7.4),
          (Math.random() - 0.5) * (isSmokeFragment ? 2.8 : 7.4),
          (Math.random() - 0.5) * (isSmokeFragment ? 2.8 : 7.4)
        ),
        life: 0,
        maxLife: isSmokeFragment
          ? 1.05 + Math.random() * 0.5
          : isBlackWhiteExplosion
            ? 0.95 + Math.random() * 0.35
            : isCrimsonExplosion
              ? 0.68 + Math.random() * 0.32
              : (0.55 + Math.random() * 0.2) * velocityScale,
        baseScale,
        material: fragmentMaterial,
        ownsMaterial: useCustomExplosionMaterial || isSmokeFragment || isCrimsonExplosion,
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
      const gravity =
        (fragment.mesh.userData.gravity as number | undefined) ?? 11.5;
      const drag = (fragment.mesh.userData.drag as number | undefined) ?? 0;
      fragment.velocity.y -= gravity * delta;
      if (drag > 0) {
        fragment.velocity.multiplyScalar(Math.max(0, 1 - drag * delta));
      }
      fragment.mesh.position.addScaledVector(fragment.velocity, delta);
      fragment.mesh.rotation.x += fragment.spin.x * delta;
      fragment.mesh.rotation.y += fragment.spin.y * delta;
      fragment.mesh.rotation.z += fragment.spin.z * delta;
      fragment.life += delta;
      const lifeProgress = THREE.MathUtils.clamp(
        fragment.life / fragment.maxLife,
        0,
        1
      );
      const lifeRatio = Math.max(0, 1 - lifeProgress);
      const startScaleMultiplier =
        (fragment.mesh.userData.startScaleMultiplier as number | undefined) ?? 1;
      const endScaleMultiplier =
        (fragment.mesh.userData.endScaleMultiplier as number | undefined) ?? 0.08;
      fragment.mesh.scale.setScalar(
        Math.max(
          0.08,
          fragment.baseScale *
            THREE.MathUtils.lerp(
              startScaleMultiplier,
              endScaleMultiplier,
              lifeProgress
            )
        )
      );
      if (
        fragment.ownsMaterial &&
        hasAdjustableOpacity(fragment.material) &&
        fragment.material.transparent
      ) {
        const baseOpacity =
          (fragment.mesh.userData.baseOpacity as number | undefined) ??
          fragment.material.opacity;
        const opacityStart =
          (fragment.mesh.userData.opacityStart as number | undefined) ?? baseOpacity;
        const opacityPeak =
          (fragment.mesh.userData.opacityPeak as number | undefined) ?? baseOpacity;
        const opacityEnd =
          (fragment.mesh.userData.opacityEnd as number | undefined) ?? 0;
        const opacityPeakAt = THREE.MathUtils.clamp(
          (fragment.mesh.userData.opacityPeakAt as number | undefined) ?? 0.12,
          0.01,
          0.99
        );
        const opacity =
          lifeProgress <= opacityPeakAt
            ? THREE.MathUtils.lerp(
                opacityStart,
                opacityPeak,
                lifeProgress / opacityPeakAt
              )
            : THREE.MathUtils.lerp(
                opacityPeak,
                opacityEnd,
                (lifeProgress - opacityPeakAt) / (1 - opacityPeakAt)
              );
        fragment.material.opacity = Math.max(0, opacity * lifeRatio * 1.04);
      }
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
    projectileShockwaveGeometry.dispose();
    projectileExplosionMaterial.dispose();
  };

  return {
    spawnDefaultExplosionFx,
    clear,
    update,
    dispose,
  };
};
