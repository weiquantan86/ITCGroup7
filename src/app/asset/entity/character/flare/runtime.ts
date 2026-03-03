import * as THREE from "three";
import { characterGltfAnimationClipsKey } from "../general/engine/characterLoader";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import type {
  CharacterRuntimeFactory,
  CharacterRuntimeUpdate,
} from "../general/types";
import { profile } from "./profile";

const walkClipName = "walk";
const skillEClipName = "skillE";
const skillRClipName = "skillR";
const rootPositionTrackName = "Root.position";
const comboContinueWindowMs = 420;
const legTrackPattern = /shoe|leg|foot/i;
const secondaryBurnFallbackLocalOffset = new THREE.Vector3(0, 2.6, 0);
const secondaryBurnTipNudge = -0.06;
const secondaryBurnTipBandRatio = 0.04;
const secondaryBurnLandingMinTravel = 0.14;
const secondaryBurnLandingRecoveryDistance = 0.012;
const secondaryBurnLandingProgressFloor = 0.22;
const secondaryBurnLateTriggerProgress = 0.72;
const secondaryBurnImpactPulseMs = 360;

const attackCombo = [
  {
    clipName: "normalAttack1",
    damage: 18,
    hitStart: 0.18,
    hitEnd: 0.58,
    collisionRadius: 1.05,
    maxHits: 3,
  },
  {
    clipName: "normalAttack2",
    damage: 24,
    hitStart: 0.16,
    hitEnd: 0.6,
    collisionRadius: 1.12,
    maxHits: 3,
  },
  {
    clipName: "normalAttack3",
    damage: 32,
    hitStart: 0.12,
    hitEnd: 0.72,
    collisionRadius: 1.2,
    maxHits: 4,
  },
] as const;

const skillRConfig = {
  damage: 46,
  hitStart: 0.28,
  hitEnd: 0.68,
  collisionRadius: 1.12,
  maxHits: 4,
} as const;

type ActionBinding = {
  clipName: string;
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
};

type WeaponHitConfig = {
  damage: number;
  collisionRadius: number;
  maxHits: number;
};

type AttackClipBinding = ActionBinding & {
  config: (typeof attackCombo)[number];
};

type WeaponSampleState = {
  hasWeaponSample: boolean;
};

type SecondaryBurnEmber = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
  scale: number;
};

type SecondaryBurnTongue = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  orbitRadius: number;
  orbitSpeed: number;
  baseScale: THREE.Vector3;
  tilt: number;
};

type SecondaryBurnSmoke = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
  scale: number;
};

type SecondaryBurnSpark = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  orbitRadius: number;
  orbitSpeed: number;
  lift: number;
  scale: number;
};

const isMeshObject = (
  object: THREE.Object3D | null
): object is THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> =>
  Boolean((object as THREE.Mesh | null)?.isMesh);

const isSkinnedMeshObject = (
  object: THREE.Object3D | null
): object is THREE.SkinnedMesh =>
  Boolean((object as THREE.SkinnedMesh | null)?.isSkinnedMesh);

const getAnimationClips = (model: THREE.Object3D) => {
  const clips = model.userData[characterGltfAnimationClipsKey];
  return Array.isArray(clips) ? (clips as THREE.AnimationClip[]) : [];
};

const resolveInPlaceClip = (model: THREE.Object3D, clipName: string) => {
  const clip = getAnimationClips(model).find(
    (entry) => entry.name.trim().toLowerCase() === clipName.trim().toLowerCase()
  );
  if (!clip) return null;
  const tracks = clip.tracks
    .filter((track) => track.name !== rootPositionTrackName)
    .map((track) => track.clone());
  if (!tracks.length) return null;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
};

const filterClipTracks = (
  clip: THREE.AnimationClip | null,
  includeTrack: (track: THREE.KeyframeTrack) => boolean
) => {
  if (!clip) return null;
  const tracks = clip.tracks.filter(includeTrack).map((track) => track.clone());
  if (!tracks.length) return null;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
};

const makeLoopSeamlessClip = (clip: THREE.AnimationClip | null) => {
  if (!clip) return null;

  let startTime = Infinity;
  let endTime = 0;
  for (let i = 0; i < clip.tracks.length; i += 1) {
    const track = clip.tracks[i];
    if (track.times.length === 0) continue;
    startTime = Math.min(startTime, track.times[0]);
    endTime = Math.max(endTime, track.times[track.times.length - 1]);
  }

  if (!Number.isFinite(startTime)) {
    return clip.clone();
  }

  const normalizedStartTime = Math.max(0, startTime);
  const normalizedDuration = Math.max(
    0.001,
    (endTime || clip.duration) - normalizedStartTime
  );

  const tracks = clip.tracks.map((track) => {
    const clonedTrack = track.clone();
    if (normalizedStartTime > 0) {
      for (let i = 0; i < clonedTrack.times.length; i += 1) {
        clonedTrack.times[i] = Math.max(0, clonedTrack.times[i] - normalizedStartTime);
      }
    }
    const valueSize = clonedTrack.getValueSize();
    if (valueSize <= 0 || clonedTrack.values.length < valueSize * 2) {
      return clonedTrack;
    }

    const firstOffset = 0;
    const lastOffset = clonedTrack.values.length - valueSize;
    for (let i = 0; i < valueSize; i += 1) {
      clonedTrack.values[lastOffset + i] = clonedTrack.values[firstOffset + i];
    }

    return clonedTrack;
  });

  return new THREE.AnimationClip(clip.name, normalizedDuration, tracks);
};

const findWeaponNode = (model: THREE.Object3D) => {
  let exactBone: THREE.Object3D | null = null;
  let exactMesh: THREE.Object3D | null = null;

  model.traverse((child) => {
    if (child.name !== "Weapon") return;
    if ((child as THREE.Mesh).isMesh) {
      if (!exactMesh) {
        exactMesh = child;
      }
      return;
    }
    if (!exactBone) {
      exactBone = child;
    }
  });

  if (exactBone) return exactBone;
  if (exactMesh) return exactMesh;

  let fallback: THREE.Object3D | null = null;
  model.traverse((child) => {
    if (fallback || !child.name) return;
    if (/weapon/i.test(child.name)) {
      fallback = child;
    }
  });
  return fallback;
};

const isWeaponRenderMesh = (mesh: THREE.Object3D, model: THREE.Object3D) => {
  let current: THREE.Object3D | null = mesh;
  while (current && current !== model) {
    if (/weapon/i.test(current.name)) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const findWeaponMeshes = (model: THREE.Object3D) => {
  const matches: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.Material | THREE.Material[]
  >[] = [];

  model.traverse((child) => {
    if (!isMeshObject(child) || !isWeaponRenderMesh(child, model)) return;
    matches.push(child);
  });

  return matches;
};

const createOneShotBinding = (
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip | null,
  clipName: string
) => {
  if (!clip) return null;

  const action = mixer.clipAction(clip);
  action.clampWhenFinished = true;
  action.setLoop(THREE.LoopOnce, 1);
  action.enabled = true;
  action.paused = true;
  action.setEffectiveWeight(0);

  return {
    clipName,
    clip,
    action,
  };
};

const stopActionBinding = (binding: ActionBinding | null) => {
  if (!binding) return;
  binding.action.stop();
  binding.action.paused = true;
  binding.action.enabled = true;
  binding.action.setEffectiveWeight(0);
};

const playActionBinding = (binding: ActionBinding | null) => {
  if (!binding) return false;
  binding.action.reset();
  binding.action.enabled = true;
  binding.action.paused = false;
  binding.action.setEffectiveTimeScale(1);
  binding.action.setEffectiveWeight(1);
  binding.action.play();
  return true;
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  performMeleeAttack,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const avatarForward = new THREE.Vector3();
  const latestAimDirection = new THREE.Vector3();
  const currentWeaponWorldPosition = new THREE.Vector3();
  const previousWeaponWorldPosition = new THREE.Vector3();
  const swingDelta = new THREE.Vector3();
  const skillRDirection = new THREE.Vector3();
  const secondaryBurnAnchorLocal = secondaryBurnFallbackLocalOffset.clone();
  const secondaryBurnTipCandidate = new THREE.Vector3();
  const secondaryBurnTipBest = new THREE.Vector3();
  const secondaryBurnTipDirection = new THREE.Vector3();
  const secondaryBurnTipRangeMin = new THREE.Vector3(Infinity, Infinity, Infinity);
  const secondaryBurnTipRangeMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const secondaryBurnTipAccum = new THREE.Vector3();
  const secondaryBurnTipSamples: THREE.Vector3[] = [];

  const secondaryBurnFlameGeometry = new THREE.ConeGeometry(0.12, 0.42, 12, 1, true);
  secondaryBurnFlameGeometry.translate(0, 0.21, 0);
  const secondaryBurnHaloGeometry = new THREE.TorusGeometry(0.1, 0.026, 10, 22);
  const secondaryBurnCoronaGeometry = new THREE.TorusGeometry(0.14, 0.015, 10, 28);
  const secondaryBurnGlowGeometry = new THREE.SphereGeometry(0.11, 12, 12);
  const secondaryBurnEmberGeometry = new THREE.SphereGeometry(0.04, 8, 8);
  const secondaryBurnSmokeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
  const secondaryBurnSparkGeometry = new THREE.OctahedronGeometry(0.028, 0);
  const secondaryBurnOuterMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6b1a,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const secondaryBurnInnerMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff1a8,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const secondaryBurnHaloMaterial = new THREE.MeshBasicMaterial({
    color: 0xffa84a,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const secondaryBurnGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const secondaryBurnCoronaMaterial = new THREE.MeshBasicMaterial({
    color: 0xffcf73,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const secondaryBurnOuterCoronaMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7b1f,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const secondaryBurnFxRoot = new THREE.Group();
  secondaryBurnFxRoot.visible = false;
  secondaryBurnFxRoot.position.copy(secondaryBurnAnchorLocal);
  const secondaryBurnLight = new THREE.PointLight(0xff8c33, 1.1, 2.4, 2);
  secondaryBurnLight.position.y = 0.18;
  secondaryBurnLight.visible = false;
  const secondaryBurnOuterFlame = new THREE.Mesh(
    secondaryBurnFlameGeometry,
    secondaryBurnOuterMaterial
  );
  secondaryBurnOuterFlame.position.y = 0;
  secondaryBurnOuterFlame.frustumCulled = false;
  const secondaryBurnInnerFlame = new THREE.Mesh(
    secondaryBurnFlameGeometry,
    secondaryBurnInnerMaterial
  );
  secondaryBurnInnerFlame.position.y = 0.03;
  secondaryBurnInnerFlame.scale.set(0.62, 0.76, 0.62);
  secondaryBurnInnerFlame.frustumCulled = false;
  const secondaryBurnHalo = new THREE.Mesh(
    secondaryBurnHaloGeometry,
    secondaryBurnHaloMaterial
  );
  secondaryBurnHalo.position.y = 0.015;
  secondaryBurnHalo.rotation.x = Math.PI / 2;
  secondaryBurnHalo.frustumCulled = false;
  const secondaryBurnGlow = new THREE.Mesh(
    secondaryBurnGlowGeometry,
    secondaryBurnGlowMaterial
  );
  secondaryBurnGlow.position.y = 0.08;
  secondaryBurnGlow.scale.set(1.1, 0.7, 1.1);
  secondaryBurnGlow.frustumCulled = false;
  const secondaryBurnCorona = new THREE.Mesh(
    secondaryBurnCoronaGeometry,
    secondaryBurnCoronaMaterial
  );
  secondaryBurnCorona.position.y = 0.14;
  secondaryBurnCorona.rotation.set(Math.PI / 2, 0, 0.35);
  secondaryBurnCorona.frustumCulled = false;
  const secondaryBurnOuterCorona = new THREE.Mesh(
    secondaryBurnCoronaGeometry,
    secondaryBurnOuterCoronaMaterial
  );
  secondaryBurnOuterCorona.position.y = 0.18;
  secondaryBurnOuterCorona.rotation.set(Math.PI / 3.2, 0.5, 0);
  secondaryBurnOuterCorona.scale.set(1.18, 1.18, 1.18);
  secondaryBurnOuterCorona.frustumCulled = false;
  secondaryBurnFxRoot.add(
    secondaryBurnOuterFlame,
    secondaryBurnInnerFlame,
    secondaryBurnHalo,
    secondaryBurnGlow,
    secondaryBurnCorona,
    secondaryBurnOuterCorona,
    secondaryBurnLight
  );
  const secondaryBurnTongues: SecondaryBurnTongue[] = Array.from(
    { length: 6 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 3 === 1 ? 0xfff1a8 : index % 2 === 0 ? 0xff7b1f : 0xffa13c,
        transparent: true,
        opacity: index % 3 === 1 ? 0.74 : 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(secondaryBurnFlameGeometry, material);
      mesh.position.y = 0.008 + index * 0.011;
      mesh.scale.set(
        0.44 - index * 0.035,
        0.84 - index * 0.07,
        0.44 - index * 0.035
      );
      mesh.frustumCulled = false;
      secondaryBurnFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 6) * Math.PI * 2,
        orbitRadius: 0.012 + index * 0.008,
        orbitSpeed: 1.6 + index * 0.28,
        baseScale: mesh.scale.clone(),
        tilt: 0.16 + index * 0.035,
      };
    }
  );
  const secondaryBurnEmbers: SecondaryBurnEmber[] = Array.from(
    { length: 9 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 3 === 0 ? 0xfff1a8 : index % 2 === 0 ? 0xffe08a : 0xff7f2a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnEmberGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 9) * Math.PI * 2,
        radius: 0.05 + index * 0.01,
        speed: 1.7 + index * 0.18,
        lift: 0.18 + index * 0.025,
        scale: 0.48 + index * 0.06,
      };
    }
  );
  const secondaryBurnSmokeWisps: SecondaryBurnSmoke[] = Array.from(
    { length: 6 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0x4a3328,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(secondaryBurnSmokeGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 6) * Math.PI * 2,
        radius: 0.018 + index * 0.006,
        speed: 0.42 + index * 0.09,
        lift: 0.2 + index * 0.04,
        scale: 0.58 + index * 0.12,
      };
    }
  );
  const secondaryBurnSparks: SecondaryBurnSpark[] = Array.from(
    { length: 8 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xfff3bf : 0xff9a3a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 8) * Math.PI * 2,
        orbitRadius: 0.09 + index * 0.009,
        orbitSpeed: 2.8 + index * 0.22,
        lift: 0.1 + index * 0.01,
        scale: 0.5 + index * 0.06,
      };
    }
  );

  let boundModel: THREE.Object3D | null = null;
  let boundWeapon: THREE.Object3D | null = null;
  let boundWeaponMeshes: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.Material | THREE.Material[]
  >[] = [];
  let mixer: THREE.AnimationMixer | null = null;
  let walkAction: THREE.AnimationAction | null = null;
  let walkLegsAction: THREE.AnimationAction | null = null;
  let attackBindings: AttackClipBinding[] = [];
  let skillEBinding: ActionBinding | null = null;
  let skillRBinding: ActionBinding | null = null;
  let lastAnimationUpdateAt = 0;
  let lastCompletedAttackIndex = -1;
  let lastCompletedAttackAt = -Infinity;

  const attackState = {
    active: false,
    queuedNext: false,
    currentIndex: -1,
    startedAt: 0,
    durationMs: 0,
    hitTargetIds: new Set<string>(),
    hasWeaponSample: false,
  };

  const skillEState = {
    active: false,
    startedAt: 0,
    durationMs: 0,
    hasWeaponSample: false,
    peakWeaponY: 0,
    lowestWeaponY: 0,
    previousWeaponY: 0,
    flameTriggered: false,
  };

  const skillRState = {
    active: false,
    startedAt: 0,
    durationMs: 0,
    hitTargetIds: new Set<string>(),
    hasWeaponSample: false,
  };

  const secondaryBurnState = {
    active: false,
    activatedAt: 0,
  };

  const stopAllAttackActions = () => {
    for (let i = 0; i < attackBindings.length; i += 1) {
      stopActionBinding(attackBindings[i]);
    }
  };

  const stopAllSkillActions = () => {
    stopActionBinding(skillEBinding);
    stopActionBinding(skillRBinding);
  };

  const resolveSecondaryBurnAnchor = () => {
    secondaryBurnAnchorLocal.copy(secondaryBurnFallbackLocalOffset);
    if (!boundWeapon || boundWeaponMeshes.length === 0) return;

    boundWeapon.updateMatrixWorld(true);

    secondaryBurnTipRangeMin.set(Infinity, Infinity, Infinity);
    secondaryBurnTipRangeMax.set(-Infinity, -Infinity, -Infinity);
    secondaryBurnTipSamples.length = 0;

    for (let meshIndex = 0; meshIndex < boundWeaponMeshes.length; meshIndex += 1) {
      const weaponMesh = boundWeaponMeshes[meshIndex];
      const positionAttribute = weaponMesh.geometry.getAttribute("position");
      if (!positionAttribute) continue;

      weaponMesh.updateMatrixWorld(true);

      for (let i = 0; i < positionAttribute.count; i += 1) {
        secondaryBurnTipCandidate.fromBufferAttribute(positionAttribute, i);
        if (isSkinnedMeshObject(weaponMesh)) {
          weaponMesh.applyBoneTransform(i, secondaryBurnTipCandidate);
        }
        weaponMesh.localToWorld(secondaryBurnTipCandidate);
        secondaryBurnTipBest.copy(boundWeapon.worldToLocal(secondaryBurnTipCandidate));
        secondaryBurnTipSamples.push(secondaryBurnTipBest.clone());
        secondaryBurnTipRangeMin.min(secondaryBurnTipBest);
        secondaryBurnTipRangeMax.max(secondaryBurnTipBest);
      }
    }

    if (!secondaryBurnTipSamples.length) {
      secondaryBurnAnchorLocal.copy(secondaryBurnFallbackLocalOffset);
      return;
    }

    const rangeX = secondaryBurnTipRangeMax.x - secondaryBurnTipRangeMin.x;
    const rangeY = secondaryBurnTipRangeMax.y - secondaryBurnTipRangeMin.y;
    const rangeZ = secondaryBurnTipRangeMax.z - secondaryBurnTipRangeMin.z;
    let majorAxis: "x" | "y" | "z" = "x";
    let majorRange = rangeX;
    if (rangeY > majorRange) {
      majorAxis = "y";
      majorRange = rangeY;
    }
    if (rangeZ > majorRange) {
      majorAxis = "z";
      majorRange = rangeZ;
    }

    const axisMin = secondaryBurnTipRangeMin[majorAxis];
    const axisMax = secondaryBurnTipRangeMax[majorAxis];
    const useAxisMax = Math.abs(axisMax) >= Math.abs(axisMin);
    const extremeValue = useAxisMax ? axisMax : axisMin;
    const bandSize = Math.max(0.02, majorRange * secondaryBurnTipBandRatio);
    secondaryBurnTipAccum.set(0, 0, 0);
    let matchedCount = 0;

    for (let i = 0; i < secondaryBurnTipSamples.length; i += 1) {
      const sample = secondaryBurnTipSamples[i];
      const axisValue = sample[majorAxis];
      const withinTipBand = useAxisMax
        ? axisValue >= extremeValue - bandSize
        : axisValue <= extremeValue + bandSize;
      if (!withinTipBand) continue;
      secondaryBurnTipAccum.add(sample);
      matchedCount += 1;
    }

    if (matchedCount > 0) {
      secondaryBurnAnchorLocal.copy(
        secondaryBurnTipAccum.multiplyScalar(1 / matchedCount)
      );
    } else {
      secondaryBurnAnchorLocal.copy(
        useAxisMax ? secondaryBurnTipRangeMax : secondaryBurnTipRangeMin
      );
    }

    secondaryBurnTipDirection.copy(secondaryBurnAnchorLocal);
    if (secondaryBurnTipDirection.lengthSq() > 0.000001) {
      secondaryBurnAnchorLocal.addScaledVector(
        secondaryBurnTipDirection.normalize(),
        secondaryBurnTipNudge
      );
    }
  };

  const attachSecondaryBurnFx = () => {
    secondaryBurnFxRoot.removeFromParent();
    if (!boundWeapon) return;
    boundWeapon.add(secondaryBurnFxRoot);
    resolveSecondaryBurnAnchor();
    secondaryBurnFxRoot.position.copy(secondaryBurnAnchorLocal);
    secondaryBurnFxRoot.rotation.set(0, 0, 0);
    secondaryBurnFxRoot.scale.setScalar(1);
  };

  const deactivateSecondaryBurn = () => {
    secondaryBurnState.active = false;
    secondaryBurnState.activatedAt = 0;
    secondaryBurnFxRoot.visible = false;
    secondaryBurnLight.visible = false;
    for (let i = 0; i < secondaryBurnEmbers.length; i += 1) {
      const ember = secondaryBurnEmbers[i];
      ember.mesh.visible = false;
      ember.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnSmokeWisps.length; i += 1) {
      const smoke = secondaryBurnSmokeWisps[i];
      smoke.mesh.visible = false;
      smoke.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnSparks.length; i += 1) {
      const spark = secondaryBurnSparks[i];
      spark.mesh.visible = false;
      spark.material.opacity = 0;
    }
  };

  const activateSecondaryBurn = (now: number) => {
    secondaryBurnState.active = true;
    secondaryBurnState.activatedAt = now;
    attachSecondaryBurnFx();
    secondaryBurnFxRoot.visible = true;
  };

  const resetAttackState = () => {
    attackState.active = false;
    attackState.queuedNext = false;
    attackState.currentIndex = -1;
    attackState.startedAt = 0;
    attackState.durationMs = 0;
    attackState.hitTargetIds.clear();
    attackState.hasWeaponSample = false;
  };

  const resetSkillEState = () => {
    skillEState.active = false;
    skillEState.startedAt = 0;
    skillEState.durationMs = 0;
    skillEState.hasWeaponSample = false;
    skillEState.peakWeaponY = 0;
    skillEState.lowestWeaponY = 0;
    skillEState.previousWeaponY = 0;
    skillEState.flameTriggered = false;
  };

  const resetSkillRState = () => {
    skillRState.active = false;
    skillRState.startedAt = 0;
    skillRState.durationMs = 0;
    skillRState.hitTargetIds.clear();
    skillRState.hasWeaponSample = false;
  };

  const clearAnimationBinding = () => {
    stopAllAttackActions();
    stopAllSkillActions();
    if (walkAction) {
      walkAction.stop();
      walkAction = null;
    }
    if (walkLegsAction) {
      walkLegsAction.stop();
      walkLegsAction = null;
    }
    if (mixer && boundModel) {
      mixer.stopAllAction();
      mixer.uncacheRoot(boundModel);
    }
    secondaryBurnFxRoot.removeFromParent();
    mixer = null;
    attackBindings = [];
    skillEBinding = null;
    skillRBinding = null;
    boundModel = null;
    boundWeapon = null;
    boundWeaponMeshes = [];
    lastAnimationUpdateAt = 0;
    resetAttackState();
    resetSkillEState();
    resetSkillRState();
    deactivateSecondaryBurn();
    lastCompletedAttackIndex = -1;
    lastCompletedAttackAt = -Infinity;
  };

  const bindModel = (model: THREE.Object3D | null) => {
    if (model === boundModel) return;
    clearAnimationBinding();
    if (!model) return;

    boundModel = model;
    boundWeapon = findWeaponNode(model);
    boundWeaponMeshes = findWeaponMeshes(model);
    mixer = new THREE.AnimationMixer(model);

    if (boundWeapon) {
      attachSecondaryBurnFx();
    }

    const resolvedWalkClip = makeLoopSeamlessClip(
      resolveInPlaceClip(model, walkClipName)
    );
    if (resolvedWalkClip) {
      walkAction = mixer.clipAction(resolvedWalkClip);
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
      walkAction.enabled = true;
      walkAction.play();
      walkAction.paused = true;
      walkAction.setEffectiveWeight(0);

      const resolvedWalkLegsClip = filterClipTracks(
        resolvedWalkClip,
        (track) => legTrackPattern.test(track.name)
      );
      if (resolvedWalkLegsClip) {
        walkLegsAction = mixer.clipAction(resolvedWalkLegsClip);
        walkLegsAction.setLoop(THREE.LoopRepeat, Infinity);
        walkLegsAction.enabled = true;
        walkLegsAction.play();
        walkLegsAction.paused = true;
        walkLegsAction.setEffectiveWeight(0);
      }
    }

    attackBindings = attackCombo.flatMap((config) => {
      if (!mixer) return [];
      const binding = createOneShotBinding(
        mixer,
        filterClipTracks(
          resolveInPlaceClip(model, config.clipName),
          (track) => !legTrackPattern.test(track.name)
        ),
        config.clipName
      );
      if (!binding) return [];
      return [{ ...binding, config }];
    });

    if (mixer) {
      skillEBinding = createOneShotBinding(
        mixer,
        resolveInPlaceClip(model, skillEClipName),
        skillEClipName
      );
      skillRBinding = createOneShotBinding(
        mixer,
        resolveInPlaceClip(model, skillRClipName),
        skillRClipName
      );
    }
  };

  const getAttackDirection = (target = new THREE.Vector3()) => {
    if (latestAimDirection.lengthSq() > 0.000001) {
      target.copy(latestAimDirection);
    } else {
      target.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    }
    target.y = 0;
    if (target.lengthSq() < 0.000001) {
      target.copy(avatarForward.set(0, 0, 1).applyQuaternion(avatar.quaternion));
      target.y = 0;
    }
    if (target.lengthSq() < 0.000001) {
      target.set(0, 0, 1);
    }
    return target.normalize();
  };

  const syncAttackFacingToAim = () => {
    if (!attackState.active || latestAimDirection.lengthSq() <= 0.000001) {
      return;
    }
    avatar.rotation.y = Math.atan2(latestAimDirection.x, latestAimDirection.z);
  };

  const sampleWeaponPosition = (state: WeaponSampleState) => {
    if (!boundWeapon) return false;
    boundWeapon.updateMatrixWorld(true);
    boundWeapon.getWorldPosition(previousWeaponWorldPosition);
    state.hasWeaponSample = true;
    return true;
  };

  const applyWeaponSweepHit = (
    config: WeaponHitConfig,
    hitTargetIds: Set<string>,
    directionOverride?: THREE.Vector3
  ) => {
    if (!performMeleeAttack || !boundWeapon) return;

    boundWeapon.updateMatrixWorld(true);
    boundWeapon.getWorldPosition(currentWeaponWorldPosition);
    const attackDirection = directionOverride
      ? directionOverride
      : getAttackDirection(avatarForward);

    swingDelta.copy(currentWeaponWorldPosition).sub(previousWeaponWorldPosition);
    const sweepDistance = swingDelta.length();
    const sweepDirection =
      sweepDistance > 0.0001
        ? swingDelta.clone().divideScalar(sweepDistance)
        : attackDirection;

    if (sweepDistance > 0.0001) {
      performMeleeAttack({
        damage: config.damage,
        maxDistance: sweepDistance,
        hitRadius: config.collisionRadius,
        maxHits: config.maxHits,
        origin: previousWeaponWorldPosition.clone(),
        direction: sweepDirection,
        excludeTargetIds: hitTargetIds,
        onHitTarget: (targetId) => {
          hitTargetIds.add(targetId);
        },
      });
    }

    performMeleeAttack({
      damage: config.damage,
      maxDistance: 0.001,
      contactCenter: currentWeaponWorldPosition.clone(),
      contactRadius: config.collisionRadius,
      maxHits: config.maxHits,
      direction: attackDirection,
      excludeTargetIds: hitTargetIds,
      onHitTarget: (targetId) => {
        hitTargetIds.add(targetId);
      },
    });

    previousWeaponWorldPosition.copy(currentWeaponWorldPosition);
  };

  const startAttack = (index: number, now: number) => {
    const binding = attackBindings[index];
    if (!binding) return false;

    stopAllAttackActions();
    attackState.active = true;
    attackState.queuedNext = false;
    attackState.currentIndex = index;
    attackState.startedAt = now;
    attackState.durationMs = Math.max(1, binding.clip.duration * 1000);
    attackState.hitTargetIds.clear();
    attackState.hasWeaponSample = false;

    return playActionBinding(binding);
  };

  const finishAttack = (now: number) => {
    const binding = attackBindings[attackState.currentIndex];
    stopActionBinding(binding ?? null);

    lastCompletedAttackIndex = attackState.currentIndex;
    lastCompletedAttackAt = now;
    resetAttackState();
  };

  const startSkillE = (now: number) => {
    if (!skillEBinding) return false;
    stopAllSkillActions();
    resetSkillEState();
    skillEState.active = true;
    skillEState.startedAt = now;
    skillEState.durationMs = Math.max(1, skillEBinding.clip.duration * 1000);
    return playActionBinding(skillEBinding);
  };

  const finishSkillE = () => {
    stopActionBinding(skillEBinding);
    resetSkillEState();
  };

  const startSkillR = (now: number) => {
    if (!skillRBinding) return false;
    stopAllSkillActions();
    resetSkillRState();
    skillRState.active = true;
    skillRState.startedAt = now;
    skillRState.durationMs = Math.max(1, skillRBinding.clip.duration * 1000);
    getAttackDirection(skillRDirection);
    avatar.rotation.y = Math.atan2(skillRDirection.x, skillRDirection.z);
    return playActionBinding(skillRBinding);
  };

  const finishSkillR = () => {
    stopActionBinding(skillRBinding);
    resetSkillRState();
  };

  const updateAttackState = (now: number) => {
    if (!attackState.active) return;

    const binding = attackBindings[attackState.currentIndex];
    if (!binding) {
      finishAttack(now);
      return;
    }

    const progress = THREE.MathUtils.clamp(
      (now - attackState.startedAt) / attackState.durationMs,
      0,
      1
    );

    if (progress >= binding.config.hitStart && progress <= binding.config.hitEnd) {
      if (!attackState.hasWeaponSample) {
        sampleWeaponPosition(attackState);
      }
      applyWeaponSweepHit(binding.config, attackState.hitTargetIds);
    } else {
      sampleWeaponPosition(attackState);
    }

    if (progress < 0.999) return;

    if (
      attackState.queuedNext &&
      attackState.currentIndex < attackBindings.length - 1
    ) {
      startAttack(attackState.currentIndex + 1, now);
      return;
    }

    finishAttack(now);
  };

  const updateSkillEState = (now: number) => {
    if (!skillEState.active) return;

    const progress = THREE.MathUtils.clamp(
      (now - skillEState.startedAt) / skillEState.durationMs,
      0,
      1
    );

    if (boundWeapon) {
      boundWeapon.updateMatrixWorld(true);
      boundWeapon.getWorldPosition(currentWeaponWorldPosition);

      if (!skillEState.hasWeaponSample) {
        skillEState.hasWeaponSample = true;
        skillEState.peakWeaponY = currentWeaponWorldPosition.y;
        skillEState.lowestWeaponY = currentWeaponWorldPosition.y;
        skillEState.previousWeaponY = currentWeaponWorldPosition.y;
      } else {
        const deltaY = currentWeaponWorldPosition.y - skillEState.previousWeaponY;
        skillEState.peakWeaponY = Math.max(
          skillEState.peakWeaponY,
          currentWeaponWorldPosition.y
        );
        skillEState.lowestWeaponY = Math.min(
          skillEState.lowestWeaponY,
          currentWeaponWorldPosition.y
        );

        const totalDrop = skillEState.peakWeaponY - skillEState.lowestWeaponY;
        const recoveredFromLow =
          currentWeaponWorldPosition.y - skillEState.lowestWeaponY;
        // Ignite on the first clear landing beat instead of a hard-coded clip timestamp.
        const shouldIgnite =
          !skillEState.flameTriggered &&
          progress >= secondaryBurnLandingProgressFloor &&
          totalDrop >= secondaryBurnLandingMinTravel &&
          (deltaY >= 0.002 ||
            recoveredFromLow >= secondaryBurnLandingRecoveryDistance ||
            progress >= secondaryBurnLateTriggerProgress);

        if (shouldIgnite) {
          skillEState.flameTriggered = true;
          activateSecondaryBurn(now);
        }

        skillEState.previousWeaponY = currentWeaponWorldPosition.y;
      }
    } else if (
      !skillEState.flameTriggered &&
      progress >= secondaryBurnLateTriggerProgress
    ) {
      skillEState.flameTriggered = true;
      activateSecondaryBurn(now);
    }

    if (progress < 0.999) return;

    if (!skillEState.flameTriggered) {
      activateSecondaryBurn(now);
    }
    finishSkillE();
  };

  const updateSkillRState = (now: number) => {
    if (!skillRState.active) return;

    const progress = THREE.MathUtils.clamp(
      (now - skillRState.startedAt) / skillRState.durationMs,
      0,
      1
    );

    if (progress >= skillRConfig.hitStart && progress <= skillRConfig.hitEnd) {
      if (!skillRState.hasWeaponSample) {
        sampleWeaponPosition(skillRState);
      }
      applyWeaponSweepHit(skillRConfig, skillRState.hitTargetIds, skillRDirection);
    } else {
      sampleWeaponPosition(skillRState);
    }

    if (progress >= 0.999) {
      finishSkillR();
    }
  };

  const updateSecondaryBurnFx = (now: number) => {
    if (!secondaryBurnState.active || !boundWeapon) {
      secondaryBurnFxRoot.visible = false;
      return;
    }

    secondaryBurnFxRoot.visible = true;
    secondaryBurnLight.visible = true;
    secondaryBurnFxRoot.position.copy(secondaryBurnAnchorLocal);
    const elapsed = Math.max(0, now - secondaryBurnState.activatedAt);
    const impactFade = 1 - THREE.MathUtils.clamp(elapsed / secondaryBurnImpactPulseMs, 0, 1);
    const t = now * 0.001;
    const flamePulse = 0.94 + Math.sin(t * 12.5) * 0.08 + impactFade * 0.18;
    const haloPulse = 0.9 + Math.sin(t * 7.2) * 0.1 + impactFade * 0.24;
    const flameFlicker =
      0.88 + Math.sin(t * 17.5) * 0.08 + Math.cos(t * 9.8) * 0.04 + impactFade * 0.16;
    const flareBloom = 0.86 + Math.sin(t * 6.4) * 0.12 + impactFade * 0.22;

    secondaryBurnOuterFlame.scale.set(1, flamePulse, 1);
    secondaryBurnOuterFlame.rotation.x = Math.sin(t * 5.6) * 0.06;
    secondaryBurnOuterFlame.rotation.z = Math.cos(t * 6.1) * 0.08;
    secondaryBurnInnerFlame.scale.set(
      0.6 + impactFade * 0.08,
      flamePulse * 0.78,
      0.6 + impactFade * 0.08
    );
    secondaryBurnInnerFlame.rotation.x = Math.cos(t * 7.4) * 0.08;
    secondaryBurnInnerFlame.rotation.z = Math.sin(t * 8.3) * 0.1;
    secondaryBurnHalo.scale.setScalar(haloPulse);
    secondaryBurnHalo.rotation.z = t * 1.8;
    secondaryBurnCorona.scale.setScalar(0.92 + flareBloom * 0.16);
    secondaryBurnCorona.rotation.y = t * 1.9;
    secondaryBurnCorona.rotation.z = 0.35 + Math.sin(t * 3.8) * 0.15;
    secondaryBurnOuterCorona.scale.setScalar(1.05 + flareBloom * 0.22);
    secondaryBurnOuterCorona.rotation.x = Math.PI / 3.2 + Math.sin(t * 2.8) * 0.12;
    secondaryBurnOuterCorona.rotation.z = t * -1.35;
    secondaryBurnOuterMaterial.opacity =
      0.5 + flamePulse * 0.18 + flameFlicker * 0.08 + impactFade * 0.08;
    secondaryBurnInnerMaterial.opacity =
      0.66 + flamePulse * 0.16 + flameFlicker * 0.1 + impactFade * 0.06;
    secondaryBurnHaloMaterial.opacity = 0.28 + haloPulse * 0.1 + impactFade * 0.24;
    secondaryBurnGlow.scale.setScalar(0.9 + flamePulse * 0.18 + impactFade * 0.16);
    secondaryBurnGlow.scale.y = 0.6 + flamePulse * 0.08;
    secondaryBurnGlowMaterial.opacity = 0.2 + flameFlicker * 0.14 + impactFade * 0.12;
    secondaryBurnCoronaMaterial.opacity = 0.22 + flareBloom * 0.16 + impactFade * 0.08;
    secondaryBurnOuterCoronaMaterial.opacity =
      0.12 + flareBloom * 0.12 + flameFlicker * 0.06 + impactFade * 0.06;
    secondaryBurnLight.intensity = 1.05 + flamePulse * 0.55 + impactFade * 0.7;
    secondaryBurnLight.distance = 2.35 + flameFlicker * 0.45;

    for (let i = 0; i < secondaryBurnTongues.length; i += 1) {
      const tongue = secondaryBurnTongues[i];
      const swirl = t * (5.2 + tongue.orbitSpeed) + tongue.phase;
      const lick = 0.82 + Math.sin(t * (11 + i * 1.8) + tongue.phase) * 0.16;
      tongue.mesh.position.set(
        Math.cos(swirl) * tongue.orbitRadius,
        0.01 + i * 0.012 + flameFlicker * 0.015,
        Math.sin(swirl) * tongue.orbitRadius
      );
      tongue.mesh.scale.set(
        tongue.baseScale.x * (0.92 + lick * 0.22),
        tongue.baseScale.y * (0.82 + lick * 0.32 + impactFade * 0.1),
        tongue.baseScale.z * (0.92 + lick * 0.22)
      );
      tongue.mesh.rotation.x =
        Math.sin(t * (4.6 + i * 0.7) + tongue.phase) * tongue.tilt;
      tongue.mesh.rotation.y = swirl * 0.35;
      tongue.mesh.rotation.z =
        Math.cos(t * (5.1 + i * 0.8) + tongue.phase) * tongue.tilt;
      tongue.material.opacity =
        0.34 + lick * 0.16 + flameFlicker * 0.12 + impactFade * 0.05;
    }

    for (let i = 0; i < secondaryBurnEmbers.length; i += 1) {
      const ember = secondaryBurnEmbers[i];
      const orbitPhase = t * ember.speed + ember.phase;
      const risePhase = (t * (0.82 + i * 0.12) + ember.phase) % 1;
      const shimmer = 0.55 + 0.45 * Math.sin(t * (7.5 + i) + ember.phase * 2);
      ember.mesh.visible = true;
      ember.mesh.position.set(
        Math.cos(orbitPhase) * ember.radius,
        0.05 + risePhase * ember.lift,
        Math.sin(orbitPhase) * ember.radius
      );
      ember.mesh.scale.setScalar(ember.scale * (0.74 + shimmer * 0.48));
      ember.material.opacity = (1 - risePhase) * (0.26 + shimmer * 0.48);
    }

    for (let i = 0; i < secondaryBurnSparks.length; i += 1) {
      const spark = secondaryBurnSparks[i];
      const spin = t * spark.orbitSpeed + spark.phase;
      const pulse = (t * (1.9 + i * 0.08) + spark.phase * 0.5) % 1;
      const burst = 0.72 + 0.28 * Math.sin(t * (14 + i) + spark.phase);
      spark.mesh.visible = true;
      spark.mesh.position.set(
        Math.cos(spin) * spark.orbitRadius,
        0.07 + pulse * spark.lift,
        Math.sin(spin) * spark.orbitRadius
      );
      spark.mesh.rotation.set(spin * 1.3, spin * 0.7, spin * 1.8);
      spark.mesh.scale.setScalar(spark.scale * (0.8 + burst * 0.55));
      spark.material.opacity = (1 - pulse) * (0.28 + burst * 0.34);
    }

    for (let i = 0; i < secondaryBurnSmokeWisps.length; i += 1) {
      const smoke = secondaryBurnSmokeWisps[i];
      const orbitPhase = t * smoke.speed + smoke.phase;
      const risePhase = (t * (0.24 + i * 0.05) + smoke.phase * 0.3) % 1;
      smoke.mesh.visible = true;
      smoke.mesh.position.set(
        Math.cos(orbitPhase) * smoke.radius,
        0.08 + risePhase * smoke.lift,
        Math.sin(orbitPhase) * smoke.radius
      );
      smoke.mesh.scale.setScalar(smoke.scale * (0.72 + risePhase * 0.9));
      smoke.material.opacity = (1 - risePhase) * 0.12 * flameFlicker;
    }
  };

  const updateAnimations = ({
    now,
    isMoving,
    isSprinting,
  }: {
    now: number;
    isMoving: boolean;
    isSprinting?: boolean;
  }) => {
    if (!mixer) {
      lastAnimationUpdateAt = now;
      return;
    }

    const deltaSeconds =
      lastAnimationUpdateAt > 0 ? Math.max(0, (now - lastAnimationUpdateAt) / 1000) : 0;
    lastAnimationUpdateAt = now;

    if (walkAction) {
      const shouldWalk =
        isMoving &&
        !attackState.active &&
        !skillEState.active &&
        !skillRState.active;
      const currentWeight = walkAction.getEffectiveWeight();
      const nextWeight = THREE.MathUtils.lerp(
        currentWeight,
        shouldWalk ? 1 : 0,
        shouldWalk ? 0.24 : 0.18
      );

      walkAction.paused = false;
      walkAction.setEffectiveWeight(nextWeight);
      walkAction.setEffectiveTimeScale(isSprinting ? 1.45 : 1);

      if (!shouldWalk && nextWeight < 0.001) {
        walkAction.paused = true;
        walkAction.setEffectiveWeight(0);
      }
    }

    if (walkLegsAction) {
      const shouldWalkLegs = isMoving && attackState.active;
      const currentWeight = walkLegsAction.getEffectiveWeight();
      const nextWeight = THREE.MathUtils.lerp(
        currentWeight,
        shouldWalkLegs ? 1 : 0,
        shouldWalkLegs ? 0.26 : 0.18
      );

      walkLegsAction.paused = false;
      walkLegsAction.setEffectiveWeight(nextWeight);
      walkLegsAction.setEffectiveTimeScale(isSprinting ? 1.45 : 1);

      if (!shouldWalkLegs && nextWeight < 0.001) {
        walkLegsAction.paused = true;
        walkLegsAction.setEffectiveWeight(0);
      }
    }

    if (deltaSeconds > 0) {
      mixer.update(deltaSeconds);
    }
  };

  const handlePrimaryDown = () => {
    const now = performance.now();
    if (!attackBindings.length) return;
    if (skillEState.active || skillRState.active) return;

    if (attackState.active) {
      if (attackState.currentIndex < attackBindings.length - 1) {
        attackState.queuedNext = true;
      }
      return;
    }

    const shouldContinueCombo =
      lastCompletedAttackIndex >= 0 &&
      lastCompletedAttackIndex < attackBindings.length - 1 &&
      now - lastCompletedAttackAt <= comboContinueWindowMs;

    startAttack(shouldContinueCombo ? lastCompletedAttackIndex + 1 : 0, now);
  };

  const handleSkillE = () => {
    const now = performance.now();
    if (attackState.active || skillEState.active || skillRState.active) return false;
    return startSkillE(now);
  };

  const handleSkillR = () => {
    const now = performance.now();
    if (attackState.active || skillEState.active || skillRState.active) return false;
    return startSkillR(now);
  };

  const resetState = () => {
    stopAllAttackActions();
    stopAllSkillActions();
    if (walkAction) {
      walkAction.stop();
      walkAction.paused = true;
      walkAction.reset();
      walkAction.setEffectiveWeight(0);
    }
    if (walkLegsAction) {
      walkLegsAction.stop();
      walkLegsAction.paused = true;
      walkLegsAction.reset();
      walkLegsAction.setEffectiveWeight(0);
    }
    resetAttackState();
    resetSkillEState();
    resetSkillRState();
    deactivateSecondaryBurn();
    lastCompletedAttackIndex = -1;
    lastCompletedAttackAt = -Infinity;
    lastAnimationUpdateAt = 0;
    baseRuntime.resetState?.();
  };

  const update = (args: CharacterRuntimeUpdate) => {
    bindModel(args.avatarModel);
    if (args.aimDirectionWorld && args.aimDirectionWorld.lengthSq() > 0.000001) {
      latestAimDirection.copy(args.aimDirectionWorld).normalize();
    }
    baseRuntime.update(args);
    syncAttackFacingToAim();
    updateAnimations(args);
    updateAttackState(args.now);
    updateSkillEState(args.now);
    updateSkillRState(args.now);
    updateSecondaryBurnFx(args.now);
  };

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handlePrimaryDown,
    handlePrimaryUp: baseRuntime.handlePrimaryUp,
    handlePrimaryCancel: baseRuntime.handlePrimaryCancel,
    handleSkillQ: baseRuntime.handleSkillQ,
    handleSkillE,
    handleSkillR,
    getProjectileBlockers: baseRuntime.getProjectileBlockers,
    handleProjectileBlockHit: baseRuntime.handleProjectileBlockHit,
    getMovementSpeedMultiplier: baseRuntime.getMovementSpeedMultiplier,
    getCameraScaleMultiplier: baseRuntime.getCameraScaleMultiplier,
    isBasicAttackLocked: () =>
      Boolean(baseRuntime.isBasicAttackLocked?.()) ||
      skillEState.active ||
      skillRState.active,
    isMovementLocked: () =>
      Boolean(baseRuntime.isMovementLocked?.()) ||
      skillEState.active ||
      skillRState.active,
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    beforeSkillUse: baseRuntime.beforeSkillUse,
    beforeDamage: baseRuntime.beforeDamage,
    beforeStatusApply: baseRuntime.beforeStatusApply,
    isImmuneToStatus: baseRuntime.isImmuneToStatus,
    onTick: baseRuntime.onTick,
    resetState,
    update,
    dispose: () => {
      clearAnimationBinding();
      secondaryBurnFlameGeometry.dispose();
      secondaryBurnHaloGeometry.dispose();
      secondaryBurnEmberGeometry.dispose();
      secondaryBurnOuterMaterial.dispose();
      secondaryBurnInnerMaterial.dispose();
      secondaryBurnHaloMaterial.dispose();
      for (let i = 0; i < secondaryBurnEmbers.length; i += 1) {
        secondaryBurnEmbers[i].material.dispose();
      }
      baseRuntime.dispose();
    },
    isFacingLocked: () =>
      baseRuntime.isFacingLocked() ||
      skillEState.active ||
      skillRState.active,
  });
};
