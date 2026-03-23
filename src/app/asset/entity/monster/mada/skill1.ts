import * as THREE from "three";
import type { PlayerWorldTickArgs } from "../../character/general/player";
import type { ProjectileBlockHitHandler } from "../../../object/projectile/blocking";
import { createMadaSkill1BlastProjectileRuntime } from "../../../object/projectile/projectile/mada/skill1BlastProjectileRuntime";

const MADA_SKILL1_CHARGE_DURATION_MS = 3000;
const MADA_SKILL1_BEFORE_FALLBACK_MS = 420;
const MADA_SKILL1_AFTER_FALLBACK_MS = 560;
const MADA_SKILL1_AFTER_FINISH_GRACE_MS = 120;
const MADA_SKILL1_RING_SPAWN_INTERVAL_MS = 70;
const MADA_SKILL1_RING_LIFE_S = 0.66;
const MADA_SKILL1_CORE_FORWARD_OFFSET = 0.4;
const MADA_SKILL1_CORE_RED_COLOR = 0xff2f1f;
const MADA_SKILL1_CORE_BLACK_COLOR = 0x140808;

type MadaSkill1AnimationBridge = {
  triggerSkill1Before: () => number;
  triggerSkill1During: () => number;
  triggerSkill1After: () => number;
  isSkill1AfterPlaying: () => boolean;
  getHandLFrontWorldPosition: (
    target: THREE.Vector3,
    forwardOffset?: number
  ) => boolean;
};

type ChargeRing = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  spinSpeed: number;
};

type TickArgs = {
  now: number;
  delta: number;
  rig: THREE.Object3D;
  player: PlayerWorldTickArgs["player"];
  applyDamage: PlayerWorldTickArgs["applyDamage"];
  projectileBlockers: PlayerWorldTickArgs["projectileBlockers"];
  handleProjectileBlockHit?: ProjectileBlockHitHandler;
};

const handFrontProbe = new THREE.Vector3();
const playerPositionProbe = new THREE.Vector3();
const fallbackFireOrigin = new THREE.Vector3();
const projectileDirection = new THREE.Vector3();
const ringDirection = new THREE.Vector3();
const ringFrom = new THREE.Vector3();

const randomSigned = () => Math.random() * 2 - 1;

const easeOutCubic = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return 1 - (1 - t) ** 3;
};

export const createMadaSkill1Runtime = ({
  scene,
  animation,
}: {
  scene: THREE.Scene;
  animation: MadaSkill1AnimationBridge;
}) => {
  const projectileRuntime = createMadaSkill1BlastProjectileRuntime(scene);

  const ringGeometry = new THREE.TorusGeometry(0.68, 0.055, 8, 26);
  const coreGeometry = new THREE.SphereGeometry(0.22, 14, 12);
  const coreRedMaterial = new THREE.MeshBasicMaterial({
    color: MADA_SKILL1_CORE_RED_COLOR,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const coreBlackMaterial = new THREE.MeshBasicMaterial({
    color: MADA_SKILL1_CORE_BLACK_COLOR,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const coreRedMesh = new THREE.Mesh(coreGeometry, coreRedMaterial);
  const coreBlackMesh = new THREE.Mesh(coreGeometry, coreBlackMaterial);
  coreBlackMesh.scale.setScalar(1.35);
  const coreGroup = new THREE.Group();
  coreGroup.visible = false;
  coreGroup.add(coreBlackMesh, coreRedMesh);
  scene.add(coreGroup);

  const rings: ChargeRing[] = [];

  let phase: "idle" | "before" | "during" | "after" = "idle";
  let beforeEndsAt = 0;
  let duringEndsAt = 0;
  let afterEndsAt = 0;
  let ringSpawnCarryMs = 0;
  let hasCoreAnchor = false;
  const coreAnchor = new THREE.Vector3();

  const removeRingAt = (index: number) => {
    const ring = rings[index];
    if (!ring) return;
    ring.mesh.removeFromParent();
    ring.material.dispose();
    rings.splice(index, 1);
  };

  const clearRings = () => {
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      removeRingAt(i);
    }
  };

  const resolveCoreAnchor = (rig: THREE.Object3D) => {
    if (animation.getHandLFrontWorldPosition(handFrontProbe, MADA_SKILL1_CORE_FORWARD_OFFSET)) {
      coreAnchor.copy(handFrontProbe);
      hasCoreAnchor = true;
      return;
    }
    rig.getWorldPosition(coreAnchor);
    coreAnchor.y += 1.45;
    hasCoreAnchor = true;
  };

  const spawnChargeRing = () => {
    if (!hasCoreAnchor) return;
    ringDirection.set(randomSigned(), randomSigned(), randomSigned());
    if (ringDirection.lengthSq() <= 0.0001) {
      ringDirection.set(0.8, 0.35, -0.52);
    }
    ringDirection.normalize();
    const startDistance = 1.1 + Math.random() * 2.1;
    ringFrom.copy(coreAnchor).addScaledVector(ringDirection, startDistance);

    const material = new THREE.MeshBasicMaterial({
      color: Math.random() < 0.5 ? MADA_SKILL1_CORE_RED_COLOR : MADA_SKILL1_CORE_BLACK_COLOR,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(ringGeometry, material);
    mesh.position.copy(ringFrom);
    mesh.scale.setScalar(1.2 + Math.random() * 1.9);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(mesh);
    rings.push({
      mesh,
      material,
      from: ringFrom.clone(),
      to: coreAnchor.clone(),
      life: 0,
      maxLife: MADA_SKILL1_RING_LIFE_S * (0.86 + Math.random() * 0.4),
      startScale: mesh.scale.x,
      endScale: 0.18 + Math.random() * 0.18,
      spinSpeed: (2.4 + Math.random() * 3.8) * (Math.random() < 0.5 ? -1 : 1),
    });
  };

  const updateChargeVisuals = (now: number, delta: number, rig: THREE.Object3D) => {
    if (phase !== "during") {
      coreGroup.visible = false;
      return;
    }

    resolveCoreAnchor(rig);
    coreGroup.visible = true;
    coreGroup.position.copy(coreAnchor);

    const pulse = 1 + 0.28 * Math.sin(now * 0.014);
    const altPulse = 1 + 0.22 * Math.cos(now * 0.012 + 0.6);
    coreRedMesh.scale.setScalar(0.9 * pulse);
    coreBlackMesh.scale.setScalar(1.35 * altPulse);
    coreRedMaterial.opacity = 0.64 + (pulse - 1) * 0.55;
    coreBlackMaterial.opacity = 0.52 + (altPulse - 1) * 0.42;

    ringSpawnCarryMs += delta * 1000;
    while (ringSpawnCarryMs >= MADA_SKILL1_RING_SPAWN_INTERVAL_MS) {
      ringSpawnCarryMs -= MADA_SKILL1_RING_SPAWN_INTERVAL_MS;
      spawnChargeRing();
    }
  };

  const updateRings = (delta: number) => {
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const ring = rings[i];
      ring.life += delta;
      const t = ring.life / ring.maxLife;
      if (t >= 1) {
        removeRingAt(i);
        continue;
      }
      const k = easeOutCubic(t);
      ring.mesh.position.lerpVectors(ring.from, ring.to, k);
      const scale = THREE.MathUtils.lerp(ring.startScale, ring.endScale, k);
      ring.mesh.scale.setScalar(scale);
      ring.mesh.rotateY(ring.spinSpeed * delta);
      ring.material.opacity = Math.max(0.02, 0.74 * (1 - t) * (1 - t));
    }
  };

  const fireAfterProjectile = (rig: THREE.Object3D, player: THREE.Object3D) => {
    let hasOrigin = animation.getHandLFrontWorldPosition(
      handFrontProbe,
      MADA_SKILL1_CORE_FORWARD_OFFSET
    );
    if (!hasOrigin) {
      rig.getWorldPosition(fallbackFireOrigin);
      fallbackFireOrigin.y += 1.45;
      handFrontProbe.copy(fallbackFireOrigin);
      hasOrigin = true;
    }
    if (!hasOrigin) return;

    player.getWorldPosition(playerPositionProbe);
    playerPositionProbe.y += 1.2;
    projectileDirection.copy(playerPositionProbe).sub(handFrontProbe);
    if (projectileDirection.lengthSq() <= 0.00001) {
      projectileDirection
        .set(Math.sin(rig.rotation.y), 0.05, Math.cos(rig.rotation.y))
        .normalize();
    } else {
      projectileDirection.normalize();
    }
    projectileRuntime.spawnProjectile({
      origin: handFrontProbe,
      direction: projectileDirection,
    });
  };

  const switchToDuring = (now: number) => {
    animation.triggerSkill1During();
    phase = "during";
    duringEndsAt = now + MADA_SKILL1_CHARGE_DURATION_MS;
    ringSpawnCarryMs = 0;
  };

  const switchToAfter = (now: number, rig: THREE.Object3D, player: THREE.Object3D) => {
    const afterDurationS = animation.triggerSkill1After();
    fireAfterProjectile(rig, player);
    phase = "after";
    afterEndsAt =
      now +
      Math.max(
        MADA_SKILL1_AFTER_FALLBACK_MS,
        afterDurationS * 1000 + MADA_SKILL1_AFTER_FINISH_GRACE_MS
      );
    coreGroup.visible = false;
  };

  return {
    beginCast: (now: number) => {
      const beforeDurationS = animation.triggerSkill1Before();
      if (beforeDurationS > 0) {
        phase = "before";
        beforeEndsAt =
          now +
          Math.max(MADA_SKILL1_BEFORE_FALLBACK_MS, beforeDurationS * 1000);
        return true;
      }

      const duringDurationS = animation.triggerSkill1During();
      if (duringDurationS <= 0) {
        phase = "idle";
        return false;
      }
      phase = "during";
      duringEndsAt = now + MADA_SKILL1_CHARGE_DURATION_MS;
      ringSpawnCarryMs = 0;
      return true;
    },
    isCasting: () => phase !== "idle",
    tick: ({
      now,
      delta,
      rig,
      player,
      applyDamage,
      projectileBlockers,
      handleProjectileBlockHit,
    }: TickArgs) => {
      if (phase === "before" && now >= beforeEndsAt) {
        switchToDuring(now);
      }

      if (phase === "during" && now >= duringEndsAt) {
        switchToAfter(now, rig, player);
      }

      if (phase === "after" && now >= afterEndsAt && !animation.isSkill1AfterPlaying()) {
        phase = "idle";
      }

      updateChargeVisuals(now, delta, rig);
      updateRings(delta);

      projectileRuntime.update({
        now,
        delta,
        player,
        applyDamage,
        projectileBlockers,
        handleProjectileBlockHit,
      });
    },
    reset: () => {
      phase = "idle";
      beforeEndsAt = 0;
      duringEndsAt = 0;
      afterEndsAt = 0;
      ringSpawnCarryMs = 0;
      hasCoreAnchor = false;
      coreGroup.visible = false;
      clearRings();
      projectileRuntime.clear();
    },
    dispose: () => {
      clearRings();
      projectileRuntime.dispose();
      coreGroup.removeFromParent();
      ringGeometry.dispose();
      coreGeometry.dispose();
      coreRedMaterial.dispose();
      coreBlackMaterial.dispose();
    },
  };
};

