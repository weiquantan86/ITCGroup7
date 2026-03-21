import * as THREE from "three";
import { createStandardProjectileHooks } from "../../shared/standardHooks";
import type { ProjectileTypeDefinition } from "../../types";

const defaultScale = 6.2;
const fallbackColor = 0x22093f;
const fallbackEmissive = 0x120a2f;
const fallbackEmissiveIntensity = 1.05;
const shockwaveRingMajorRadius = 1;
const shockwaveRingTubeRadius = 0.11;
const shockwaveRingOuterRadiusFactor = shockwaveRingMajorRadius + shockwaveRingTubeRadius;
const shockwaveRingBaseAxis = new THREE.Vector3(0, 0, 1);
const shockwaveUpAxis = new THREE.Vector3(0, 1, 0);
const shockwaveForwardFlat = new THREE.Vector3();
const shockwaveLateralAxis = new THREE.Vector3();

type ShockwaveRingStyle = {
  color: number;
  emissive: number;
  emissiveIntensity: number;
  opacity: number;
  lifeSec: number;
  startScale: number;
  endScale: number;
  lateralSpeed: number;
};

const spawnShockwaveRingFx = ({
  scene,
  point,
  travelDirection,
  style,
}: {
  scene: THREE.Object3D;
  point: THREE.Vector3;
  travelDirection: THREE.Vector3;
  style: ShockwaveRingStyle;
}) => {
  const geometry = new THREE.TorusGeometry(
    shockwaveRingMajorRadius,
    shockwaveRingTubeRadius,
    10,
    52
  );
  const material = new THREE.MeshStandardMaterial({
    color: style.color,
    roughness: 0.34,
    metalness: 0.14,
    emissive: style.emissive,
    emissiveIntensity: style.emissiveIntensity,
    transparent: true,
    opacity: THREE.MathUtils.clamp(style.opacity, 0.06, 1),
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.castShadow = false;
  ring.receiveShadow = false;
  ring.renderOrder = 4;
  ring.position.copy(point);
  ring.position.y += 0.08;
  const resolvedTravelDirection = travelDirection.lengthSq() < 0.000001
    ? new THREE.Vector3(1, 0, 0)
    : travelDirection.clone().setY(0).normalize();
  ring.quaternion.setFromUnitVectors(shockwaveRingBaseAxis, shockwaveUpAxis);
  ring.scale.setScalar(Math.max(0.05, style.startScale));
  scene.add(ring);

  const bornAt = performance.now();
  let lastUpdateAt = bornAt;
  const maxLifeMs = Math.max(80, style.lifeSec * 1000);
  const baseOpacity = material.opacity;
  const baseEmissiveIntensity = material.emissiveIntensity;
  const liftStep = new THREE.Vector3();

  const cleanup = () => {
    ring.onBeforeRender = () => {};
    ring.parent?.remove(ring);
    geometry.dispose();
    material.dispose();
  };

  ring.onBeforeRender = () => {
    const now = performance.now();
    const elapsedMs = now - bornAt;
    const progress = THREE.MathUtils.clamp(elapsedMs / maxLifeMs, 0, 1);
    const fade = 1 - progress;
    const deltaSec = Math.max(0, Math.min(0.05, (now - lastUpdateAt) / 1000));
    lastUpdateAt = now;
    ring.scale.setScalar(
      THREE.MathUtils.lerp(style.startScale, style.endScale, progress)
    );
    liftStep.copy(resolvedTravelDirection).multiplyScalar(style.lateralSpeed * deltaSec);
    ring.position.add(liftStep);
    material.opacity = baseOpacity * fade * fade;
    material.emissiveIntensity = baseEmissiveIntensity * fade;
    if (progress >= 1 || !ring.parent) {
      cleanup();
    }
  };
};

const standardHooks = createStandardProjectileHooks({
  defaultMeshColor: fallbackColor,
  defaultMeshEmissive: fallbackEmissive,
  defaultMeshEmissiveIntensity: fallbackEmissiveIntensity,
});

export const catronDemonVolleyOrbProjectileType: ProjectileTypeDefinition = {
  id: "catronDemonVolleyOrb",
  defaults: {
    speed: 19.5,
    lifetime: 1.7,
    radius: 0.12,
    targetHitRadius: 0,
    gravity: 0,
    damageBase: 13,
    damagePerSpeed: 0,
    energyGainOnHit: null,
    manaGainOnHit: null,
    splitOnImpact: false,
    explosionRadius: 0,
    explosionDamage: 0,
    explosionColor: null,
    explosionEmissive: null,
    explosionEmissiveIntensity: null,
  },
  rules: {
    grantEnergyOnTargetHit: true,
    explodeOnTargetHit: true,
    explodeOnWorldHit: true,
    explodeOnExpire: false,
    removeOnTargetHit: true,
    removeOnWorldHit: true,
  },
  hooks: {
    ...standardHooks,
    spawnExplosionFx: ({ projectile, point, direction, spawnDefaultExplosionFx }) => {
      if (projectile.explosionRadius <= 0) return;
      spawnDefaultExplosionFx();
      const scene = projectile.mesh.parent;
      if (!scene) return;
      const damageRadius = Math.max(0.05, projectile.explosionRadius);
      const visualEndScale = Math.max(
        0.05,
        damageRadius / shockwaveRingOuterRadiusFactor
      );
      const visualStartScalePrimary = Math.max(0.05, visualEndScale * 0.26);
      const visualStartScaleSecondary = Math.max(0.05, visualEndScale * 0.38);
      shockwaveForwardFlat.set(direction.x, 0, direction.z);
      if (shockwaveForwardFlat.lengthSq() < 0.000001) {
        shockwaveForwardFlat.set(0, 0, 1);
      } else {
        shockwaveForwardFlat.normalize();
      }
      shockwaveLateralAxis
        .crossVectors(shockwaveUpAxis, shockwaveForwardFlat)
        .setY(0);
      if (shockwaveLateralAxis.lengthSq() < 0.000001) {
        shockwaveLateralAxis.set(1, 0, 0);
      } else {
        shockwaveLateralAxis.normalize();
      }
      spawnShockwaveRingFx({
        scene,
        point,
        travelDirection: shockwaveLateralAxis,
        style: {
          color: projectile.explosionColor ?? 0xd8b4fe,
          emissive: projectile.explosionEmissive ?? 0x9333ea,
          emissiveIntensity: Math.max(
            0.8,
            projectile.explosionEmissiveIntensity ?? 1.2
          ),
          opacity: 0.76,
          lifeSec: 0.42,
          startScale: visualStartScalePrimary,
          endScale: visualEndScale,
          lateralSpeed: 0,
        },
      });
      spawnShockwaveRingFx({
        scene,
        point,
        travelDirection: shockwaveLateralAxis.clone().multiplyScalar(-1),
        style: {
          color: 0xf5d0fe,
          emissive: projectile.explosionEmissive ?? 0x9333ea,
          emissiveIntensity: Math.max(
            0.55,
            (projectile.explosionEmissiveIntensity ?? 1.2) * 0.75
          ),
          opacity: 0.52,
          lifeSec: 0.6,
          startScale: visualStartScaleSecondary,
          endScale: visualEndScale,
          lateralSpeed: 0,
        },
      });
    },
    createMesh: ({ visual, buildDefaultSphereMesh }) => {
      const resolvedVisual = {
        ...visual,
        scale: visual?.scale ?? defaultScale,
        color: visual?.color ?? fallbackColor,
        emissive: visual?.emissive ?? fallbackEmissive,
        emissiveIntensity:
          visual?.emissiveIntensity ?? fallbackEmissiveIntensity,
      };
      return buildDefaultSphereMesh({
        visual: resolvedVisual,
        fallbackColor,
        fallbackEmissive,
        fallbackEmissiveIntensity,
      });
    },
  },
};
