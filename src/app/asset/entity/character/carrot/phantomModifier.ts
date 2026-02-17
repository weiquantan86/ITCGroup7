import * as THREE from "three";
import type {
  CharacterRuntime,
  FireProjectileArgs,
  SkillKey,
} from "../general/types";

type CreateCarrotPhantomModifierArgs = {
  avatar: THREE.Object3D;
  fireProjectile?: (args?: FireProjectileArgs) => void;
  applyHealth?: (amount: number) => number;
  applyEnergy?: (amount: number) => number;
  applyMana?: (amount: number) => number;
};

type PhantomPhase = "idle" | "shallow" | "deep";

type MaterialSnapshot = {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  blending: THREE.Blending;
};

type DeepWisp = {
  mesh: THREE.Mesh;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
};

type BurstParticle = {
  mesh: THREE.Mesh;
  direction: THREE.Vector3;
  speed: number;
  spin: THREE.Vector3;
  delayMs: number;
  baseRotation: THREE.Vector3;
};

type DeepVolleyOrbParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
};

type DeepVolleyOrbStyle = "deepPhantom" | "demon";

type DeepVolleyOrb = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  particles: DeepVolleyOrbParticle[];
  style: DeepVolleyOrbStyle;
};

type DeepVolleyShotFx = {
  mesh: THREE.Mesh;
  update: (deltaSec: number) => void;
  dispose: () => void;
};

type DeepVolleyTriggerOptions = {
  projectileType?: string;
  summonScaleMultiplier?: number;
  projectileScale?: number;
};

export const createCarrotPhantomModifier = ({
  avatar,
  fireProjectile,
  applyHealth,
  applyEnergy,
  applyMana,
}: CreateCarrotPhantomModifierArgs) => {
  const phantomConfig = {
    shallowDurationMs: 75,
    deepDurationMs: 3000,
    shallowParticleDurationMs: 300,
    deepBurstDurationMs: 280,
    deepVolleySummonStepMs: 70,
    deepVolleyLaunchDelayMs: 330,
    deepVolleyLaunchStepMs: 140,
    deepVolleyLaunchExitCount: 3,
    deepVolleyOrbLocalY: 4.1,
    deepVolleyOrbLocalZ: 0.42,
    deepVolleyOrbLocalXOffsets: [-6, -3, 0, 3, 6],
    deepVolleyAimDistance: 50,
    deepVolleyHomingDurationSec: 1.45,
    deepVolleyHomingTurnRate: 4.8,
    deepVolleyHomingMaxBlend: 0.22,
    deepVolleyHomingTargetScanRadius: 15,
    deepVolleyHomingTargetHeightBias: 0.25,
    recoverHp: 15,
    recoverEnergy: 20,
    recoverMana: 30,
    volleyYawOffsets: [-0.28, -0.14, 0, 0.14, 0.28],
    volleyPitchOffsets: [0.07, 0.03, 0, -0.03, -0.07],
    volleyLaneOffsets: [-0.36, -0.18, 0, 0.18, 0.36],
    projectileSpeed: 19.5,
    projectileLifetime: 1.7,
    projectileDamage: 13,
  };

  const phantomState = {
    phase: "idle" as PhantomPhase,
    endsAt: 0,
  };

  const phantomUp = new THREE.Vector3(0, 1, 0);
  const phantomAvatarQuaternion = new THREE.Quaternion();
  const phantomAvatarPosition = new THREE.Vector3();
  const phantomForward = new THREE.Vector3();
  const phantomRight = new THREE.Vector3();
  const phantomDirection = new THREE.Vector3();
  const phantomShotOrigin = new THREE.Vector3();
  const deepVolleyShotOrigin = new THREE.Vector3();
  const deepVolleyAimPoint = new THREE.Vector3();
  const deepVolleyAimDirection = new THREE.Vector3(0, 0, 1);
  const deepVolleyAimOrigin = new THREE.Vector3();

  const shallowTint = new THREE.Color(0x5b21b6);
  const deepBodyColor = new THREE.Color(0x030303);
  const neutralColor = new THREE.Color(0x000000);
  const materialSnapshots = new Map<THREE.Material, MaterialSnapshot>();
  const deepWispStates: DeepWisp[] = [];
  const shallowBurstParticles: BurstParticle[] = [];
  const deepBurstParticles: BurstParticle[] = [];
  const deepPhantomVolleyOrbs: DeepVolleyOrb[] = [];
  const demonVolleyOrbs: DeepVolleyOrb[] = [];
  const deepVolleyState = {
    active: false,
    startedAt: 0,
    spawnedCount: 0,
    launchedCount: 0,
    exitedDeepAt: 0,
    projectileType: "carrotDeepPhantomOrb",
    summonScaleMultiplier: 1,
    projectileScale: null as number | null,
    activeOrbs: deepPhantomVolleyOrbs as DeepVolleyOrb[],
  };
  let hasDeepVolleyAimDirection = false;
  let hasDeepVolleyAimOrigin = false;
  const shallowBurstState = {
    startedAt: -1,
    endsAt: -1,
  };
  const deepBurstState = {
    startedAt: -1,
    endsAt: -1,
  };

  const fxRoot = new THREE.Group();
  fxRoot.userData.carrotPhantomExclude = true;
  fxRoot.visible = false;
  avatar.add(fxRoot);

  const deepFxGroup = new THREE.Group();
  deepFxGroup.userData.carrotPhantomExclude = true;
  deepFxGroup.visible = false;
  fxRoot.add(deepFxGroup);

  const shallowBurstFxGroup = new THREE.Group();
  shallowBurstFxGroup.userData.carrotPhantomExclude = true;
  shallowBurstFxGroup.visible = false;
  fxRoot.add(shallowBurstFxGroup);

  const deepBurstFxGroup = new THREE.Group();
  deepBurstFxGroup.userData.carrotPhantomExclude = true;
  deepBurstFxGroup.visible = false;
  fxRoot.add(deepBurstFxGroup);

  const deepVolleyFxGroup = new THREE.Group();
  deepVolleyFxGroup.userData.carrotPhantomExclude = true;
  deepVolleyFxGroup.visible = false;
  fxRoot.add(deepVolleyFxGroup);

  for (let i = 0; i < 42; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.04 + Math.random() * 0.03, 0),
      new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mesh.userData.carrotPhantomExclude = true;
    mesh.position.set(0, 0.98, 0);
    shallowBurstFxGroup.add(mesh);
    shallowBurstParticles.push({
      mesh,
      direction: new THREE.Vector3(0, 1, 0),
      speed: 0,
      spin: new THREE.Vector3(),
      delayMs: 0,
      baseRotation: new THREE.Vector3(),
    });
  }

  for (let i = 0; i < 5; i += 1) {
    const deepPhantomMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b0764,
      emissive: 0x6d28d9,
      emissiveIntensity: 1.24,
      roughness: 0.35,
      metalness: 0.1,
      transparent: false,
      opacity: 1,
      depthWrite: true,
    });
    const deepPhantomMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 12, 12),
      deepPhantomMaterial
    );
    deepPhantomMesh.userData.carrotPhantomExclude = true;
    deepPhantomMesh.visible = false;
    deepPhantomMesh.position.set(
      phantomConfig.deepVolleyOrbLocalXOffsets[i] ?? 0,
      phantomConfig.deepVolleyOrbLocalY,
      phantomConfig.deepVolleyOrbLocalZ
    );
    deepVolleyFxGroup.add(deepPhantomMesh);
    deepPhantomVolleyOrbs.push({
      mesh: deepPhantomMesh,
      material: deepPhantomMaterial,
      particles: [],
      style: "deepPhantom",
    });

    const demonMaterial = new THREE.MeshStandardMaterial({
      color: 0x22093f,
      emissive: 0x120a2f,
      emissiveIntensity: 0.98,
      roughness: 0.22,
      metalness: 0.12,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const demonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 24), demonMaterial);
    demonMesh.userData.carrotPhantomExclude = true;
    demonMesh.visible = false;
    demonMesh.position.set(
      phantomConfig.deepVolleyOrbLocalXOffsets[i] ?? 0,
      phantomConfig.deepVolleyOrbLocalY,
      phantomConfig.deepVolleyOrbLocalZ
    );
    const demonParticles: DeepVolleyOrbParticle[] = [];
    for (let j = 0; j < 12; j += 1) {
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particleMesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.045 + Math.random() * 0.035, 0),
        particleMaterial
      );
      particleMesh.userData.carrotPhantomExclude = true;
      demonMesh.add(particleMesh);
      demonParticles.push({
        mesh: particleMesh,
        material: particleMaterial,
        phase: (j / 12) * Math.PI * 2 + Math.random() * 0.8,
        radius: 0.95 + Math.random() * 0.45,
        speed: 1.4 + Math.random() * 2.2,
        lift: -0.34 + Math.random() * 0.68,
      });
    }
    deepVolleyFxGroup.add(demonMesh);
    demonVolleyOrbs.push({
      mesh: demonMesh,
      material: demonMaterial,
      particles: demonParticles,
      style: "demon",
    });
  }

  const deepRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.1, 18, 44),
    new THREE.MeshStandardMaterial({
      color: 0x040404,
      emissive: 0x111111,
      emissiveIntensity: 0.18,
      roughness: 0.24,
      metalness: 0.5,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
  );
  deepRing.userData.carrotPhantomExclude = true;
  deepRing.rotation.x = Math.PI / 2;
  deepRing.position.set(0, 0.12, 0);
  deepFxGroup.add(deepRing);

  const deepShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.84, 22, 22),
    new THREE.MeshStandardMaterial({
      color: 0x020202,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.95,
      metalness: 0.02,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    })
  );
  deepShell.userData.carrotPhantomExclude = true;
  deepShell.position.set(0, 0.95, 0);
  deepFxGroup.add(deepShell);

  for (let i = 0; i < 120; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.035 + Math.random() * 0.05, 0),
      new THREE.MeshStandardMaterial({
        color: 0x040404,
        emissive: 0x101010,
        emissiveIntensity: 0.14,
        roughness: 0.48,
        metalness: 0.32,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    mesh.userData.carrotPhantomExclude = true;
    mesh.position.set(0, 0.98, 0);
    deepBurstFxGroup.add(mesh);
    deepBurstParticles.push({
      mesh,
      direction: new THREE.Vector3(0, 1, 0),
      speed: 0,
      spin: new THREE.Vector3(),
      delayMs: 0,
      baseRotation: new THREE.Vector3(),
    });
  }

  for (let i = 0; i < 9; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.08, 0),
      new THREE.MeshStandardMaterial({
        color: 0x050505,
        emissive: 0x101010,
        emissiveIntensity: 0.12,
        roughness: 0.55,
        metalness: 0.35,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      })
    );
    mesh.userData.carrotPhantomExclude = true;
    deepFxGroup.add(mesh);
    deepWispStates.push({
      mesh,
      phase: (i / 9) * Math.PI * 2,
      radius: 0.54 + (i % 3) * 0.16,
      speed: 1.4 + (i % 4) * 0.38,
      lift: 0.58 + (i % 5) * 0.13,
    });
  }

  const forEachDeepVolleyOrb = (callback: (orb: DeepVolleyOrb) => void) => {
    for (let i = 0; i < deepPhantomVolleyOrbs.length; i += 1) {
      callback(deepPhantomVolleyOrbs[i]);
    }
    for (let i = 0; i < demonVolleyOrbs.length; i += 1) {
      callback(demonVolleyOrbs[i]);
    }
  };

  const resolveVolleyOrbSet = (projectileType: string) =>
    projectileType === "carrotDemonVolleyOrb" ? demonVolleyOrbs : deepPhantomVolleyOrbs;

  const hideAllFx = () => {
    fxRoot.visible = false;
    deepFxGroup.visible = false;
    shallowBurstFxGroup.visible = false;
    deepBurstFxGroup.visible = false;
    deepVolleyFxGroup.visible = false;
    deepVolleyState.active = false;
    deepVolleyState.startedAt = 0;
    deepVolleyState.spawnedCount = 0;
    deepVolleyState.launchedCount = 0;
    deepVolleyState.exitedDeepAt = 0;
    deepVolleyState.projectileType = "carrotDeepPhantomOrb";
    deepVolleyState.summonScaleMultiplier = 1;
    deepVolleyState.projectileScale = null;
    deepVolleyState.activeOrbs = deepPhantomVolleyOrbs;
    forEachDeepVolleyOrb((orb) => {
      orb.mesh.visible = false;
      orb.material.opacity = 0;
      orb.mesh.scale.setScalar(0.6);
      for (let j = 0; j < orb.particles.length; j += 1) {
        const particle = orb.particles[j];
        particle.material.opacity = 0;
        particle.mesh.position.set(0, 0, 0);
      }
    });
    shallowBurstState.startedAt = -1;
    shallowBurstState.endsAt = -1;
    deepBurstState.startedAt = -1;
    deepBurstState.endsAt = -1;
  };

  const getMaterialSnapshot = (material: THREE.Material): MaterialSnapshot => {
    const existing = materialSnapshots.get(material);
    if (existing) return existing;

    const target = material as THREE.Material & {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
      roughness?: number;
      metalness?: number;
    };

    const snapshot: MaterialSnapshot = {
      color: target.color ? target.color.clone() : undefined,
      emissive: target.emissive ? target.emissive.clone() : undefined,
      emissiveIntensity:
        typeof target.emissiveIntensity === "number"
          ? target.emissiveIntensity
          : undefined,
      roughness: typeof target.roughness === "number" ? target.roughness : undefined,
      metalness: typeof target.metalness === "number" ? target.metalness : undefined,
      opacity: target.opacity,
      transparent: target.transparent,
      depthWrite: target.depthWrite,
      blending: target.blending,
    };
    materialSnapshots.set(material, snapshot);
    return snapshot;
  };

  const forEachAvatarMaterial = (
    callback: (
      material: THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
        roughness?: number;
        metalness?: number;
      },
      snapshot: MaterialSnapshot
    ) => void
  ) => {
    avatar.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (object.userData?.carrotPhantomExclude) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (let i = 0; i < materials.length; i += 1) {
        const material = materials[i];
        if (!material) continue;
        if (material.userData?.carrotPhantomExclude) continue;
        if (material.userData?.__playerHitFlashActive) continue;
        if (material.blending !== THREE.NormalBlending) continue;
        const snapshot = getMaterialSnapshot(material);
        callback(material, snapshot);
      }
    });
  };

  const restoreAvatarMaterials = () => {
    materialSnapshots.forEach((snapshot, material) => {
      const target = material as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
        roughness?: number;
        metalness?: number;
      };
      if (snapshot.color && target.color) {
        target.color.copy(snapshot.color);
      }
      if (snapshot.emissive && target.emissive) {
        target.emissive.copy(snapshot.emissive);
      }
      if (
        snapshot.emissiveIntensity !== undefined &&
        typeof target.emissiveIntensity === "number"
      ) {
        target.emissiveIntensity = snapshot.emissiveIntensity;
      }
      if (snapshot.roughness !== undefined && typeof target.roughness === "number") {
        target.roughness = snapshot.roughness;
      }
      if (snapshot.metalness !== undefined && typeof target.metalness === "number") {
        target.metalness = snapshot.metalness;
      }
      target.opacity = snapshot.opacity;
      target.transparent = snapshot.transparent;
      target.depthWrite = snapshot.depthWrite;
      target.blending = snapshot.blending;
      target.needsUpdate = true;
    });
    materialSnapshots.clear();
  };

  const applyShallowFlickerLook = (now: number) => {
    const t = now * 0.001;
    const pulse = 0.5 + 0.5 * Math.sin(t * 34);
    const strobe = Math.sin(t * 78) > 0.75 ? 1 : 0;
    forEachAvatarMaterial((material, snapshot) => {
      if (material.color && snapshot.color) {
        material.color.copy(snapshot.color).lerp(shallowTint, 0.28 + pulse * 0.46);
      }
      if (material.emissive) {
        const baseEmissive = snapshot.emissive ?? neutralColor;
        material.emissive.copy(baseEmissive).lerp(shallowTint, 0.55 + pulse * 0.35);
      }
      if (typeof material.emissiveIntensity === "number") {
        const baseIntensity = snapshot.emissiveIntensity ?? 0;
        material.emissiveIntensity = Math.max(baseIntensity, 0.08) + pulse * 0.7 + strobe * 0.45;
      }
      material.transparent = true;
      material.depthWrite = false;
      material.opacity = Math.max(0.2, snapshot.opacity * (0.32 + pulse * 0.68));
      material.needsUpdate = true;
    });
  };

  const applyDeepBlackLook = () => {
    forEachAvatarMaterial((material, snapshot) => {
      if (material.color) {
        material.color.copy(deepBodyColor);
      }
      if (material.emissive) {
        material.emissive.setRGB(0, 0, 0);
      }
      if (typeof material.emissiveIntensity === "number") {
        material.emissiveIntensity = 0;
      }
      if (typeof material.roughness === "number") {
        material.roughness = 0.95;
      }
      if (typeof material.metalness === "number") {
        material.metalness = 0.02;
      }
      material.transparent = snapshot.transparent;
      material.opacity = snapshot.opacity;
      material.depthWrite = snapshot.depthWrite;
      material.needsUpdate = true;
    });
  };

  const updateDeepFx = (now: number) => {
    const t = now * 0.001;
    const pulse = 0.5 + 0.5 * Math.sin(t * 6.2);
    const ringMaterial = deepRing.material as THREE.MeshStandardMaterial;
    const shellMaterial = deepShell.material as THREE.MeshStandardMaterial;
    deepRing.rotation.z = -t * 1.6;
    deepRing.scale.setScalar(0.94 + pulse * 0.1);
    ringMaterial.opacity = 0.55 + pulse * 0.28;
    ringMaterial.emissiveIntensity = 0.1 + pulse * 0.12;
    deepShell.scale.setScalar(0.98 + pulse * 0.08);
    shellMaterial.opacity = 0.24 + pulse * 0.2;
    for (let i = 0; i < deepWispStates.length; i += 1) {
      const wisp = deepWispStates[i];
      const angle = t * wisp.speed + wisp.phase;
      const radius = wisp.radius + Math.sin(t * 3.1 + wisp.phase) * 0.13;
      wisp.mesh.position.set(
        Math.cos(angle) * radius,
        wisp.lift + Math.sin(t * 2.7 + wisp.phase * 0.8) * 0.3,
        Math.sin(angle) * radius
      );
      const wispScale = 0.78 + (0.5 + 0.5 * Math.sin(t * 7.4 + wisp.phase)) * 0.9;
      wisp.mesh.scale.setScalar(wispScale);
      const wispMaterial = wisp.mesh.material as THREE.MeshStandardMaterial;
      wispMaterial.opacity = 0.36 + (0.5 + 0.5 * Math.cos(t * 5.1 + wisp.phase)) * 0.45;
    }
  };

  const triggerShallowBurstFx = (now: number) => {
    shallowBurstState.startedAt = now;
    shallowBurstState.endsAt = now + phantomConfig.shallowParticleDurationMs;
    shallowBurstFxGroup.visible = true;

    for (let i = 0; i < shallowBurstParticles.length; i += 1) {
      const particle = shallowBurstParticles[i];
      const angle = Math.random() * Math.PI * 2;
      const lateral = 0.45 + Math.random() * 0.55;
      const lift = 0.2 + Math.random() * 0.9;
      particle.direction.set(
        Math.cos(angle) * lateral,
        lift,
        Math.sin(angle) * lateral
      );
      particle.direction.normalize();
      particle.speed = 3.8 + Math.random() * 5.6;
      particle.spin.set(
        (Math.random() - 0.5) * 14.4,
        (Math.random() - 0.5) * 14.4,
        (Math.random() - 0.5) * 14.4
      );
      particle.delayMs = Math.random() * 55;
      particle.baseRotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      particle.mesh.position.set(0, 0.98, 0);
      particle.mesh.rotation.copy(particle.baseRotation);
      particle.mesh.scale.setScalar(0.6 + Math.random() * 1.2);
      const particleMaterial = particle.mesh.material as THREE.MeshBasicMaterial;
      particleMaterial.opacity = 0.82;
    }
  };

  const updateShallowBurstFx = (now: number) => {
    if (
      shallowBurstState.startedAt < 0 ||
      now >= shallowBurstState.endsAt ||
      shallowBurstState.endsAt <= shallowBurstState.startedAt
    ) {
      shallowBurstFxGroup.visible = false;
      return;
    }

    shallowBurstFxGroup.visible = true;
    const burstDuration = shallowBurstState.endsAt - shallowBurstState.startedAt;
    for (let i = 0; i < shallowBurstParticles.length; i += 1) {
      const particle = shallowBurstParticles[i];
      const elapsed = now - shallowBurstState.startedAt - particle.delayMs;
      if (elapsed <= 0) {
        const particleMaterial = particle.mesh.material as THREE.MeshBasicMaterial;
        particleMaterial.opacity = 0;
        continue;
      }

      const progress = THREE.MathUtils.clamp(elapsed / burstDuration, 0, 1);
      const fade = 1 - progress;
      const travel = particle.speed * (elapsed * 0.001);
      particle.mesh.position.set(
        particle.direction.x * travel,
        0.98 + particle.direction.y * travel * 0.85,
        particle.direction.z * travel
      );
      particle.mesh.rotation.set(
        particle.baseRotation.x + particle.spin.x * progress,
        particle.baseRotation.y + particle.spin.y * progress,
        particle.baseRotation.z + particle.spin.z * progress
      );
      particle.mesh.scale.setScalar((0.6 + (i % 4) * 0.2) * (0.75 + fade * 0.4));
      const particleMaterial = particle.mesh.material as THREE.MeshBasicMaterial;
      particleMaterial.opacity = fade ** 1.2 * 0.82;
    }
  };

  const triggerDeepBurstFx = (now: number) => {
    deepBurstState.startedAt = now;
    deepBurstState.endsAt = now + phantomConfig.deepBurstDurationMs;
    deepBurstFxGroup.visible = true;

    for (let i = 0; i < deepBurstParticles.length; i += 1) {
      const particle = deepBurstParticles[i];
      const angle = Math.random() * Math.PI * 2;
      const lateral = 0.72 + Math.random() * 0.5;
      const lift = 0.08 + Math.random() * 0.75;
      particle.direction.set(
        Math.cos(angle) * lateral,
        lift,
        Math.sin(angle) * lateral
      );
      particle.direction.normalize();
      particle.speed = 6.5 + Math.random() * 9.5;
      particle.spin.set(
        (Math.random() - 0.5) * 10.4,
        (Math.random() - 0.5) * 10.4,
        (Math.random() - 0.5) * 10.4
      );
      particle.delayMs = Math.random() * 45;
      particle.baseRotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      particle.mesh.position.set(0, 0.98, 0);
      particle.mesh.rotation.copy(particle.baseRotation);
      particle.mesh.scale.setScalar(0.9 + Math.random() * 1.8);
      const particleMaterial = particle.mesh.material as THREE.MeshStandardMaterial;
      particleMaterial.opacity = 0.9;
      particleMaterial.emissiveIntensity = 0.18;
    }
  };

  const updateDeepBurstFx = (now: number) => {
    if (
      deepBurstState.startedAt < 0 ||
      now >= deepBurstState.endsAt ||
      deepBurstState.endsAt <= deepBurstState.startedAt
    ) {
      deepBurstFxGroup.visible = false;
      return;
    }

    deepBurstFxGroup.visible = true;
    const burstDuration = deepBurstState.endsAt - deepBurstState.startedAt;
    for (let i = 0; i < deepBurstParticles.length; i += 1) {
      const particle = deepBurstParticles[i];
      const elapsed = now - deepBurstState.startedAt - particle.delayMs;
      if (elapsed <= 0) {
        const particleMaterial = particle.mesh.material as THREE.MeshStandardMaterial;
        particleMaterial.opacity = 0;
        continue;
      }

      const progress = THREE.MathUtils.clamp(elapsed / burstDuration, 0, 1);
      const fade = 1 - progress;
      const travel = particle.speed * (elapsed * 0.001);
      particle.mesh.position.set(
        particle.direction.x * travel,
        0.98 + particle.direction.y * travel * 0.8,
        particle.direction.z * travel
      );
      particle.mesh.rotation.set(
        particle.baseRotation.x + particle.spin.x * progress,
        particle.baseRotation.y + particle.spin.y * progress,
        particle.baseRotation.z + particle.spin.z * progress
      );
      particle.mesh.scale.setScalar((0.85 + (i % 5) * 0.22) * (0.78 + fade * 0.36));
      const particleMaterial = particle.mesh.material as THREE.MeshStandardMaterial;
      particleMaterial.opacity = fade ** 1.1 * 0.9;
      particleMaterial.emissiveIntensity = fade * 0.2;
    }
  };

  const updateVisuals = (now: number) => {
    if (phantomState.phase === "shallow") {
      applyShallowFlickerLook(now);
      deepFxGroup.visible = false;
    } else if (phantomState.phase === "deep") {
      applyDeepBlackLook();
      deepFxGroup.visible = true;
      updateDeepFx(now);
    } else {
      restoreAvatarMaterials();
      deepFxGroup.visible = false;
    }

    updateShallowBurstFx(now);
    updateDeepBurstFx(now);
    fxRoot.visible =
      phantomState.phase !== "idle" ||
      shallowBurstFxGroup.visible ||
      deepBurstFxGroup.visible ||
      deepVolleyFxGroup.visible;
  };

  const setPhantomPhase = (phase: PhantomPhase, until: number, now: number) => {
    phantomState.phase = phase;
    phantomState.endsAt = until;
    updateVisuals(now);
  };

  const endDeepPhantom = (triggerRecovery: boolean, now: number) => {
    if (triggerRecovery) {
      applyHealth?.(phantomConfig.recoverHp);
      applyEnergy?.(phantomConfig.recoverEnergy);
      applyMana?.(phantomConfig.recoverMana);
    }
    setPhantomPhase("idle", 0, now);
  };

  const updatePhantomPhase = (now: number) => {
    if (phantomState.phase === "idle") return;
    if (now < phantomState.endsAt) return;
    if (phantomState.phase === "deep") {
      endDeepPhantom(true, now);
      return;
    }
    setPhantomPhase("idle", 0, now);
  };

  const enterShallowPhantom = (now: number) => {
    triggerShallowBurstFx(now);
    setPhantomPhase("shallow", now + phantomConfig.shallowDurationMs, now);
  };

  const enterDeepPhantom = (now: number) => {
    setPhantomPhase("deep", now + phantomConfig.deepDurationMs, now);
    triggerDeepBurstFx(now);
    updateVisuals(now);
  };

  const resolveAvatarForward = () => {
    avatar.updateMatrixWorld(true);
    avatar.getWorldQuaternion(phantomAvatarQuaternion);
    phantomForward.set(0, 0, 1).applyQuaternion(phantomAvatarQuaternion);
    phantomForward.y = 0;
    if (phantomForward.lengthSq() < 0.000001) {
      phantomForward.set(0, 0, 1);
    } else {
      phantomForward.normalize();
    }
    phantomRight.crossVectors(phantomUp, phantomForward);
    if (phantomRight.lengthSq() < 0.000001) {
      phantomRight.set(1, 0, 0);
    } else {
      phantomRight.normalize();
    }
  };

  const startDeepVolley = (now: number, options?: DeepVolleyTriggerOptions) => {
    if (deepVolleyState.active) return false;
    deepVolleyState.active = true;
    deepVolleyState.startedAt = now;
    deepVolleyState.spawnedCount = 0;
    deepVolleyState.launchedCount = 0;
    deepVolleyState.exitedDeepAt = 0;
    deepVolleyState.projectileType =
      options?.projectileType ?? "carrotDeepPhantomOrb";
    deepVolleyState.summonScaleMultiplier = THREE.MathUtils.clamp(
      options?.summonScaleMultiplier ?? 1,
      0.2,
      3
    );
    deepVolleyState.projectileScale =
      options?.projectileScale != null ? Math.max(0.1, options.projectileScale) : null;
    deepVolleyState.activeOrbs = resolveVolleyOrbSet(deepVolleyState.projectileType);
    deepVolleyFxGroup.visible = true;
    forEachDeepVolleyOrb((orb) => {
      orb.mesh.visible = false;
      orb.material.opacity = 0;
      for (let j = 0; j < orb.particles.length; j += 1) {
        const particle = orb.particles[j];
        particle.material.opacity = 0;
        particle.mesh.position.set(0, 0, 0);
      }
    });

    for (let i = 0; i < deepVolleyState.activeOrbs.length; i += 1) {
      const orb = deepVolleyState.activeOrbs[i];
      if (!orb) continue;
      const baseScale = orb.style === "deepPhantom" ? 1 : 0.8;
      orb.mesh.scale.setScalar(baseScale * deepVolleyState.summonScaleMultiplier);
      orb.mesh.position.set(
        phantomConfig.deepVolleyOrbLocalXOffsets[i] ?? 0,
        phantomConfig.deepVolleyOrbLocalY,
        phantomConfig.deepVolleyOrbLocalZ
      );
      for (let j = 0; j < orb.particles.length; j += 1) {
        const particle = orb.particles[j];
        particle.material.opacity = 0.72;
        particle.mesh.scale.setScalar(0.85 + Math.random() * 0.4);
      }
    }
    return true;
  };

  const createDeepVolleyShotFx = (): DeepVolleyShotFx => {
    const projectileGeometry = new THREE.SphereGeometry(0.12, 20, 20);
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: 0x22093f,
      emissive: 0x120a2f,
      emissiveIntensity: 1.22,
      roughness: 0.35,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
    mesh.userData.carrotPhantomExclude = true;

    const auraGeometry = new THREE.SphereGeometry(0.18, 14, 14);
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
    auraMesh.userData.carrotPhantomExclude = true;
    mesh.add(auraMesh);

    const particleGeometry = new THREE.IcosahedronGeometry(0.085, 0);
    const particles: DeepVolleyOrbParticle[] = [];
    const particleCount = 20;
    for (let i = 0; i < particleCount; i += 1) {
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
      particleMesh.userData.carrotPhantomExclude = true;
      mesh.add(particleMesh);
      particles.push({
        mesh: particleMesh,
        material: particleMaterial,
        phase: (i / particleCount) * Math.PI * 2 + Math.random() * 0.95,
        radius: 1.08 + Math.random() * 0.62,
        speed: 2 + Math.random() * 3.1,
        lift: -0.46 + Math.random() * 0.92,
      });
    }

    let elapsedSec = Math.random() * 0.35;
    const update = (deltaSec: number) => {
      elapsedSec += Math.max(0, deltaSec);
      mesh.rotation.y += deltaSec * 1.8;
      mesh.rotation.z += deltaSec * 0.9;
      const rootScale = Math.max(
        0.0001,
        Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z)
      );
      const orbitScale = 1 / Math.pow(rootScale, 0.72);
      const pulse = 0.5 + 0.5 * Math.sin(elapsedSec * 6.5);
      auraMesh.scale.setScalar((1.45 + pulse * 0.45) * orbitScale);
      auraMaterial.opacity = 0.34 + pulse * 0.34;
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        const angle = elapsedSec * particle.speed + particle.phase;
        const radius =
          particle.radius + Math.sin(elapsedSec * 4.2 + particle.phase) * 0.11;
        particle.mesh.position.set(
          Math.cos(angle) * radius * orbitScale,
          (particle.lift + Math.sin(elapsedSec * 3.3 + particle.phase * 1.2) * 0.24) *
            orbitScale,
          Math.sin(angle) * radius * orbitScale
        );
        const scale =
          (1.05 + (0.5 + 0.5 * Math.sin(elapsedSec * 7.3 + particle.phase)) * 0.75) *
          orbitScale;
        particle.mesh.scale.setScalar(scale);
        particle.material.opacity = THREE.MathUtils.clamp(
          (0.45 + (0.5 + 0.5 * Math.cos(elapsedSec * 6.1 + particle.phase)) * 0.55) *
            (0.95 + pulse * 0.6),
          0,
          1
        );
      }
    };

    update(0);

    return {
      mesh,
      update,
      dispose: () => {
        for (let i = 0; i < particles.length; i += 1) {
          particles[i].material.dispose();
        }
        auraMaterial.dispose();
        auraGeometry.dispose();
        particleGeometry.dispose();
        projectileMaterial.dispose();
        projectileGeometry.dispose();
      },
    };
  };

  const launchDeepVolleyOrb = (index: number, now: number) => {
    const orb = deepVolleyState.activeOrbs[index];
    if (!orb) return;
    orb.mesh.updateMatrixWorld(true);
    orb.mesh.getWorldPosition(deepVolleyShotOrigin);
    orb.mesh.visible = false;
    orb.material.opacity = 0;
    if (!fireProjectile) return;

    resolveAvatarForward();
    avatar.getWorldPosition(phantomAvatarPosition);

    deepVolleyAimPoint
      .copy(hasDeepVolleyAimOrigin ? deepVolleyAimOrigin : phantomAvatarPosition)
      .addScaledVector(
        hasDeepVolleyAimDirection ? deepVolleyAimDirection : phantomForward,
        phantomConfig.deepVolleyAimDistance
      );
    phantomDirection.copy(deepVolleyAimPoint).sub(deepVolleyShotOrigin);
    if (phantomDirection.lengthSq() < 0.000001) {
      phantomDirection.copy(phantomForward);
    } else {
      phantomDirection.normalize();
    }
    const homingTargetPoint = deepVolleyAimPoint.clone();
    const homingEstimatedPosition = deepVolleyShotOrigin.clone();
    const homingRuntimeTargetPoint = new THREE.Vector3();
    const homingDesiredDirection = new THREE.Vector3();
    const homingCurrentDirection = new THREE.Vector3();
    const shotFx =
      deepVolleyState.projectileType === "carrotDemonVolleyOrb"
        ? createDeepVolleyShotFx()
        : null;
    let hasRuntimeTarget = false;
    let homingElapsed = 0;

    fireProjectile({
      projectileType: deepVolleyState.projectileType,
      origin: deepVolleyShotOrigin.clone(),
      direction: phantomDirection.clone(),
      ...(shotFx ? { mesh: shotFx.mesh } : {}),
      ...(deepVolleyState.projectileScale != null
        ? { scale: deepVolleyState.projectileScale }
        : {}),
      lifecycle: {
        applyForces: ({ velocity, position, delta, findNearestTarget }) => {
          shotFx?.update(delta);
          homingElapsed += delta;
          const speed = velocity.length();
          if (speed <= 0.000001) {
            return;
          }
          homingEstimatedPosition.copy(position);
          if (homingElapsed <= phantomConfig.deepVolleyHomingDurationSec) {
            if (findNearestTarget) {
              const nearest = findNearestTarget({
                center: homingEstimatedPosition,
                radius: phantomConfig.deepVolleyHomingTargetScanRadius,
              });
              if (nearest) {
                homingRuntimeTargetPoint.copy(nearest.point);
                homingRuntimeTargetPoint.y +=
                  phantomConfig.deepVolleyHomingTargetHeightBias;
                hasRuntimeTarget = true;
              }
            }
            homingDesiredDirection
              .copy(hasRuntimeTarget ? homingRuntimeTargetPoint : homingTargetPoint)
              .sub(homingEstimatedPosition);
            if (homingDesiredDirection.lengthSq() > 0.000001) {
              homingDesiredDirection.normalize();
              homingCurrentDirection.copy(velocity).normalize();
              const homingBlend = Math.min(
                phantomConfig.deepVolleyHomingMaxBlend,
                1 - Math.exp(-phantomConfig.deepVolleyHomingTurnRate * delta)
              );
              homingCurrentDirection.lerp(homingDesiredDirection, homingBlend);
              if (homingCurrentDirection.lengthSq() > 0.000001) {
                homingCurrentDirection.normalize();
                velocity.copy(homingCurrentDirection).multiplyScalar(speed);
              }
            }
          }
        },
        onRemove: () => {
          shotFx?.dispose();
        },
      },
    });

    if (
      deepVolleyState.launchedCount >=
        phantomConfig.deepVolleyLaunchExitCount - 1 &&
      !deepVolleyState.exitedDeepAt &&
      phantomState.phase === "deep"
    ) {
      deepVolleyState.exitedDeepAt = now;
      endDeepPhantom(false, now);
    }
  };

  const updateDeepVolleyOrbParticles = (
    orb: DeepVolleyOrb,
    orbIndex: number,
    now: number,
    pulse: number
  ) => {
    const t = now * 0.001;
    for (let i = 0; i < orb.particles.length; i += 1) {
      const particle = orb.particles[i];
      const angle = t * particle.speed + particle.phase + orbIndex * 0.45;
      const radius = particle.radius + Math.sin(t * 4.2 + particle.phase) * 0.11;
      particle.mesh.position.set(
        Math.cos(angle) * radius,
        particle.lift + Math.sin(t * 3.3 + particle.phase * 1.2) * 0.24,
        Math.sin(angle) * radius
      );
      const scale =
        0.75 + (0.5 + 0.5 * Math.sin(t * 7.3 + particle.phase)) * 0.48;
      particle.mesh.scale.setScalar(scale);
      particle.material.opacity =
        (0.28 + (0.5 + 0.5 * Math.cos(t * 6.1 + particle.phase)) * 0.5) *
        (0.72 + pulse * 0.4);
    }
  };

  const updateDeepVolley = (now: number) => {
    if (!deepVolleyState.active) return;
    const activeOrbs = deepVolleyState.activeOrbs;
    const elapsed = now - deepVolleyState.startedAt;

    const spawnTargetCount = Math.min(
      activeOrbs.length,
      Math.max(0, Math.floor(elapsed / phantomConfig.deepVolleySummonStepMs) + 1)
    );
    while (deepVolleyState.spawnedCount < spawnTargetCount) {
      const index = deepVolleyState.spawnedCount;
      const orb = activeOrbs[index];
      if (!orb) break;
      orb.mesh.visible = true;
      if (orb.style === "deepPhantom") {
        orb.material.opacity = 1;
        orb.mesh.scale.setScalar(1 * deepVolleyState.summonScaleMultiplier);
      } else {
        orb.material.opacity = 0.95;
        orb.mesh.scale.setScalar(1.55 * deepVolleyState.summonScaleMultiplier);
      }
      deepVolleyState.spawnedCount += 1;
    }

    if (elapsed >= phantomConfig.deepVolleyLaunchDelayMs) {
      const launchElapsed = elapsed - phantomConfig.deepVolleyLaunchDelayMs;
      const launchTargetCount = Math.min(
        activeOrbs.length,
        Math.floor(launchElapsed / phantomConfig.deepVolleyLaunchStepMs) + 1
      );
      while (deepVolleyState.launchedCount < launchTargetCount) {
        const launchIndex = deepVolleyState.launchedCount;
        launchDeepVolleyOrb(launchIndex, now);
        deepVolleyState.launchedCount += 1;
      }
    }

    for (let i = deepVolleyState.launchedCount; i < deepVolleyState.spawnedCount; i += 1) {
      const orb = activeOrbs[i];
      if (!orb?.mesh.visible) continue;
      if (orb.style === "deepPhantom") {
        orb.mesh.scale.setScalar(1 * deepVolleyState.summonScaleMultiplier);
        orb.material.opacity = 1;
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.012 + i * 0.9);
        orb.mesh.scale.setScalar(
          (1.35 + pulse * 0.55) * deepVolleyState.summonScaleMultiplier
        );
        orb.material.opacity = 0.72 + pulse * 0.26;
        updateDeepVolleyOrbParticles(orb, i, now, pulse);
      }
    }

    if (deepVolleyState.launchedCount >= activeOrbs.length) {
      deepVolleyState.active = false;
      deepVolleyFxGroup.visible = false;
    }
  };

  const setAimDirectionWorld = (
    aimDirectionWorld?: THREE.Vector3,
    aimOriginWorld?: THREE.Vector3
  ) => {
    if (!aimDirectionWorld) return;
    if (aimDirectionWorld.lengthSq() < 0.000001) return;
    deepVolleyAimDirection.copy(aimDirectionWorld).normalize();
    hasDeepVolleyAimDirection = true;
    if (!aimOriginWorld) return;
    deepVolleyAimOrigin.copy(aimOriginWorld);
    hasDeepVolleyAimOrigin = true;
  };

  const isDeepActive = (now: number) =>
    phantomState.phase === "deep" && now < phantomState.endsAt;

  const handleSkillE = () => {
    const now = performance.now();
    updatePhantomPhase(now);
    if (isDeepActive(now)) {
      const didStart = triggerDeepVolley(now);
      return didStart;
    }
    if (phantomState.phase !== "idle") return false;
    enterShallowPhantom(now);
    return true;
  };

  const triggerDeepVolley = (
    now = performance.now(),
    options?: DeepVolleyTriggerOptions
  ) => {
    updatePhantomPhase(now);
    const didStart = startDeepVolley(now, options);
    if (didStart) {
      updateDeepVolley(now);
      updateVisuals(now);
    }
    return didStart;
  };

  const beforeSkillUse: NonNullable<CharacterRuntime["beforeSkillUse"]> = ({
    key,
    now,
  }: {
    key: SkillKey;
    now: number;
  }) => {
    if (key !== "e") return;
    updatePhantomPhase(now);
    if (!isDeepActive(now)) return;
    return {
      ignoreCooldown: true,
      ignoreResource: true,
      ignoreCostAndCooldown: true,
    };
  };

  const beforeDamage: NonNullable<CharacterRuntime["beforeDamage"]> = ({
    amount,
    now,
  }: {
    amount: number;
    now: number;
  }) => {
    if (amount <= 0) return { amount };
    updatePhantomPhase(now);
    if (phantomState.phase === "shallow") {
      enterDeepPhantom(now);
      return { amount: 0 };
    }
    if (isDeepActive(now)) {
      return { amount: 0 };
    }
    return { amount };
  };

  const onTick: NonNullable<CharacterRuntime["onTick"]> = ({ now }) => {
    updatePhantomPhase(now);
    updateDeepVolley(now);
    updateVisuals(now);
  };

  const isDeepPhaseActive = (now = performance.now()) => {
    updatePhantomPhase(now);
    return isDeepActive(now);
  };

  const isStatusImmune = (now = performance.now()) => {
    updatePhantomPhase(now);
    return phantomState.phase === "shallow" || isDeepActive(now);
  };

  const exitDeepPhase = (now = performance.now()) => {
    updatePhantomPhase(now);
    if (!isDeepActive(now)) return false;
    endDeepPhantom(false, now);
    return true;
  };

  const reset = () => {
    phantomState.phase = "idle";
    phantomState.endsAt = 0;
    restoreAvatarMaterials();
    hideAllFx();
  };

  const dispose = () => {
    restoreAvatarMaterials();
    hideAllFx();
    fxRoot.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    });
    fxRoot.parent?.remove(fxRoot);
  };

  return {
    handleSkillE,
    beforeSkillUse,
    beforeDamage,
    onTick,
    isDeepPhaseActive,
    isStatusImmune,
    exitDeepPhase,
    triggerDeepVolley,
    setAimDirectionWorld,
    reset,
    dispose,
  };
};
