import * as THREE from "three";
import type { SceneUiState } from "@/app/asset/scenes/general/sceneTypes";

type AgmaRingSeed = {
  mesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  phase: number;
  cycleSpeed: number;
  orbitSpeed: number;
  startRadius: number;
  spinOffset: number;
  spinSpeed: number;
};

type MadaOrbSeed = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  phase: number;
  polarOffset: number;
  radius: number;
  baseScale: number;
};

const LEFT_HAND_BONE_NAME_CANDIDATES = [
  "HandL",
  "Hand.L",
  "hand_l",
  "LeftHand",
  "mixamorigLeftHand",
] as const;
const LEFT_HAND_BONE_FALLBACK_PATTERN = /hand[._-]?l|left.?hand/i;
const AGMA_ROOT_NAME_CANDIDATES = ["Armature_agma", "armature_agma"] as const;
const MADA_ROOT_NAME_CANDIDATES = ["Armature_Mada", "armature_mada"] as const;
const SCENE2_AGMA_RING_COUNT = 22;
const SCENE2_MADA_ORB_COUNT = 170;
const SCENE2_AGMA_FORWARD_OFFSET = 0;
const SCENE2_MADA_FORWARD_OFFSET = 0;
const SCENE2_HAND_UP_OFFSET = 0;
const MADA_SPHERE_SPIRAL_SPIN_SPEED = 1.95;
const MADA_SPHERE_SPIRAL_PITCH = 1.42;
const MADA_SPHERE_SPIRAL_CORE_FORWARD = 0.05;
const MADA_SPHERE_SPIRAL_CORE_UP = 0.02;
const SCENE2_EFFECT_FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
const SCENE2_EFFECT_UP_AXIS = new THREE.Vector3(0, 1, 0);
const RESOLVE_BONE_INTERVAL_MS = 300;

const seededRandom = (seed: number) => {
  const value = Math.sin(seed * 91.31 + 317.19) * 43758.5453;
  return value - Math.floor(value);
};

const resolveNodeByExactNames = (
  root: THREE.Object3D,
  names: readonly string[]
) => {
  for (let i = 0; i < names.length; i += 1) {
    const matched = root.getObjectByName(names[i]);
    if (matched) {
      return matched;
    }
  }
  return null;
};

const resolveActorRoot = (scene: THREE.Scene, actor: "agma" | "mada") => {
  const names =
    actor === "agma" ? AGMA_ROOT_NAME_CANDIDATES : MADA_ROOT_NAME_CANDIDATES;
  const exact = resolveNodeByExactNames(scene, names);
  if (exact) {
    return exact;
  }
  const targetToken = actor === "agma" ? "armature_agma" : "armature_mada";
  let fallback: THREE.Object3D | null = null;
  scene.traverse((node) => {
    if (fallback || !node.name) {
      return;
    }
    if (node.name.trim().toLowerCase().includes(targetToken)) {
      fallback = node;
    }
  });
  return fallback;
};

const resolveLeftHandBone = (root: THREE.Object3D | null) => {
  if (!root) {
    return null;
  }
  const exact = resolveNodeByExactNames(root, LEFT_HAND_BONE_NAME_CANDIDATES);
  if (exact) {
    return exact;
  }

  let fallback: THREE.Object3D | null = null;
  root.traverse((node) => {
    if (fallback || !node.name) {
      return;
    }
    if (LEFT_HAND_BONE_FALLBACK_PATTERN.test(node.name)) {
      fallback = node;
    }
  });
  return fallback;
};

const resolveHandEffectTarget = (
  handBone: THREE.Object3D | null,
  forwardOffset: number,
  upOffset: number,
  outTarget: THREE.Vector3,
  outForward: THREE.Vector3
) => {
  if (!handBone) {
    return false;
  }
  handBone.getWorldPosition(outTarget);
  handBone.getWorldDirection(outForward);
  if (outForward.lengthSq() < 0.000001) {
    outForward.copy(SCENE2_EFFECT_FORWARD_AXIS);
  } else {
    outForward.normalize();
  }
  outTarget
    .addScaledVector(outForward, forwardOffset)
    .addScaledVector(SCENE2_EFFECT_UP_AXIS, upOffset);
  return true;
};

export const createChapter3BurningFactoryScene2HandEffects = (scene: THREE.Scene) => {
  const effectRoot = new THREE.Group();
  effectRoot.name = "chapter3BurningFactoryScene2HandEffects";
  scene.add(effectRoot);

  const agmaRingVfxGroup = new THREE.Group();
  agmaRingVfxGroup.name = "chapter3AgmaRingFx";
  agmaRingVfxGroup.visible = false;
  effectRoot.add(agmaRingVfxGroup);

  const madaOrbVfxGroup = new THREE.Group();
  madaOrbVfxGroup.name = "chapter3MadaOrbFx";
  madaOrbVfxGroup.visible = false;
  effectRoot.add(madaOrbVfxGroup);

  const agmaRingGeometry = new THREE.TorusGeometry(0.72, 0.1, 12, 60);
  const agmaRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x4af8ff,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const agmaRings: AgmaRingSeed[] = [];
  for (let i = 0; i < SCENE2_AGMA_RING_COUNT; i += 1) {
    const mesh = new THREE.Mesh(agmaRingGeometry, agmaRingMaterial);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    agmaRingVfxGroup.add(mesh);
    agmaRings.push({
      mesh,
      phase: seededRandom(2600 + i) * Math.PI * 2,
      cycleSpeed: 0.52 + seededRandom(2700 + i) * 1.12,
      orbitSpeed: 1.9 + seededRandom(2800 + i) * 3.4,
      startRadius: 0.82 + seededRandom(2900 + i) * 1.0,
      spinOffset: seededRandom(3000 + i) * Math.PI * 2,
      spinSpeed: 1.4 + seededRandom(3100 + i) * 3.2,
    });
  }

  const madaOrbGeometry = new THREE.SphereGeometry(0.33, 12, 10);
  const madaOrbDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x15070a,
    emissive: 0x2c0306,
    emissiveIntensity: 0.82,
    roughness: 0.56,
    metalness: 0.08,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const madaOrbRedMaterial = new THREE.MeshStandardMaterial({
    color: 0x8f0d18,
    emissive: 0xd4142b,
    emissiveIntensity: 2.1,
    roughness: 0.34,
    metalness: 0.15,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const madaOrbs: MadaOrbSeed[] = [];
  for (let i = 0; i < SCENE2_MADA_ORB_COUNT; i += 1) {
    const isRedOrb = i % 3 !== 0;
    const mesh = new THREE.Mesh(
      madaOrbGeometry,
      isRedOrb ? madaOrbRedMaterial : madaOrbDarkMaterial
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = isRedOrb ? 12 : 11;
    madaOrbVfxGroup.add(mesh);
    madaOrbs.push({
      mesh,
      phase: seededRandom(3200 + i) * Math.PI * 2,
      polarOffset: (seededRandom(3300 + i) - 0.5) * Math.PI * 0.96,
      radius: 1.05 + seededRandom(3500 + i) * 2.6,
      baseScale: 0.36 + seededRandom(3800 + i) * 0.54,
    });
  }

  let currentFightStage = "";
  let agmaActorRoot: THREE.Object3D | null = null;
  let madaActorRoot: THREE.Object3D | null = null;
  let agmaLeftHandBone: THREE.Object3D | null = null;
  let madaLeftHandBone: THREE.Object3D | null = null;
  let lastResolveAt = -Infinity;

  const agmaHandEffectTarget = new THREE.Vector3();
  const agmaHandEffectForward = new THREE.Vector3();
  const madaHandEffectTarget = new THREE.Vector3();
  const madaHandEffectForward = new THREE.Vector3();
  const handEffectAlignQuaternion = new THREE.Quaternion();

  const resolveBones = (now: number) => {
    if (now - lastResolveAt < RESOLVE_BONE_INTERVAL_MS) {
      return;
    }
    lastResolveAt = now;

    if (!agmaActorRoot || !agmaActorRoot.parent) {
      agmaActorRoot = resolveActorRoot(scene, "agma");
    }
    if (!madaActorRoot || !madaActorRoot.parent) {
      madaActorRoot = resolveActorRoot(scene, "mada");
    }
    if (!agmaLeftHandBone || !agmaLeftHandBone.parent) {
      agmaLeftHandBone = resolveLeftHandBone(agmaActorRoot);
    }
    if (!madaLeftHandBone || !madaLeftHandBone.parent) {
      madaLeftHandBone = resolveLeftHandBone(madaActorRoot);
    }
  };

  const setHidden = () => {
    agmaRingVfxGroup.visible = false;
    madaOrbVfxGroup.visible = false;
  };

  return {
    handleSceneState(state: SceneUiState) {
      const nextStage = state.burningFactoryFightStage;
      if (typeof nextStage === "string") {
        currentFightStage = nextStage;
      }
    },
    onTick(now: number) {
      if (currentFightStage !== "scene2") {
        setHidden();
        return;
      }

      resolveBones(now);
      const t = now * 0.001;

      const hasAgmaTarget = resolveHandEffectTarget(
        agmaLeftHandBone,
        SCENE2_AGMA_FORWARD_OFFSET,
        SCENE2_HAND_UP_OFFSET,
        agmaHandEffectTarget,
        agmaHandEffectForward
      );
      if (hasAgmaTarget) {
        agmaRingVfxGroup.visible = true;
        agmaRingVfxGroup.position.copy(agmaHandEffectTarget);
        handEffectAlignQuaternion.setFromUnitVectors(
          SCENE2_EFFECT_FORWARD_AXIS,
          agmaHandEffectForward
        );
        agmaRingVfxGroup.quaternion.copy(handEffectAlignQuaternion);
        agmaRingMaterial.opacity = THREE.MathUtils.clamp(
          0.7 + Math.sin(t * 6.6) * 0.18,
          0.34,
          0.94
        );
        for (let i = 0; i < agmaRings.length; i += 1) {
          const ring = agmaRings[i];
          const cycle = ((t * ring.cycleSpeed + ring.phase) % 1 + 1) % 1;
          const converge = THREE.MathUtils.smoothstep(cycle, 0, 1);
          const orbitAngle = t * ring.orbitSpeed + ring.phase * Math.PI * 2;
          const radius = THREE.MathUtils.lerp(ring.startRadius, 0.17, converge);
          const swirl = radius * 0.24;
          ring.mesh.position.set(
            Math.cos(orbitAngle) * swirl,
            Math.sin(orbitAngle) * swirl,
            THREE.MathUtils.lerp(0.92, 0.03, converge)
          );
          ring.mesh.scale.setScalar(radius);
          ring.mesh.rotation.set(
            Math.PI * 0.5 + Math.sin(orbitAngle * 0.65) * 0.2,
            orbitAngle * 0.38,
            ring.spinOffset + t * ring.spinSpeed
          );
        }
      } else {
        agmaRingVfxGroup.visible = false;
      }

      const hasMadaTarget = resolveHandEffectTarget(
        madaLeftHandBone,
        SCENE2_MADA_FORWARD_OFFSET,
        SCENE2_HAND_UP_OFFSET,
        madaHandEffectTarget,
        madaHandEffectForward
      );
      if (hasMadaTarget) {
        madaOrbVfxGroup.visible = true;
        madaOrbVfxGroup.position.copy(madaHandEffectTarget);
        handEffectAlignQuaternion.setFromUnitVectors(
          SCENE2_EFFECT_FORWARD_AXIS,
          madaHandEffectForward
        );
        madaOrbVfxGroup.quaternion.copy(handEffectAlignQuaternion);
        madaOrbDarkMaterial.opacity = 0.9;
        madaOrbRedMaterial.opacity = 0.96;
        madaOrbRedMaterial.emissiveIntensity = 2.1;

        for (let i = 0; i < madaOrbs.length; i += 1) {
          const orb = madaOrbs[i];
          const theta = orb.phase + t * MADA_SPHERE_SPIRAL_SPIN_SPEED;
          const phi = orb.polarOffset + theta * MADA_SPHERE_SPIRAL_PITCH;
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);
          const cosTheta = Math.cos(theta);
          const sinTheta = Math.sin(theta);
          const side = orb.radius * sinPhi * cosTheta;
          const up = orb.radius * cosPhi + MADA_SPHERE_SPIRAL_CORE_UP;
          const forward =
            orb.radius * sinPhi * sinTheta + MADA_SPHERE_SPIRAL_CORE_FORWARD;
          orb.mesh.position.set(
            side,
            up,
            forward
          );
          orb.mesh.scale.setScalar(orb.baseScale);
        }
      } else {
        madaOrbVfxGroup.visible = false;
      }
    },
    dispose() {
      setHidden();
      effectRoot.removeFromParent();
      agmaRingGeometry.dispose();
      agmaRingMaterial.dispose();
      madaOrbGeometry.dispose();
      madaOrbDarkMaterial.dispose();
      madaOrbRedMaterial.dispose();
      agmaRings.length = 0;
      madaOrbs.length = 0;
      agmaActorRoot = null;
      madaActorRoot = null;
      agmaLeftHandBone = null;
      madaLeftHandBone = null;
      currentFightStage = "";
    },
  };
};
