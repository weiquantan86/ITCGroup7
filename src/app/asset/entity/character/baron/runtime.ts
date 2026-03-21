import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { pickArm } from "../general/runtime/armSelection";
import {
  createNoopChargeHud,
  createSvgHudElements,
} from "../general/runtime/domHud";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import {
  tryReflectLinearProjectile,
  type ProjectileReflector,
} from "../../../object/projectile/reflection";
import { characterGltfAnimationClipsKey } from "../general/engine/characterLoader";
import type { CharacterRuntime, CharacterRuntimeFactory } from "../general/types";
import {
  applyDamageToBaronCloneThreatTarget,
  createBaronCloneThreatTarget,
  registerBaronCloneThreatTarget,
  unregisterBaronCloneThreatTarget,
  type BaronCloneThreatTarget,
} from "./cloneThreat";
import { profile } from "./profile";

type ChargeHud = {
  setVisible: (visible: boolean) => void;
  setRatio: (ratio: number) => void;
  dispose: () => void;
};

type SkillQDarknessOverlay = {
  update: (targetOpacity: number, deltaSeconds: number) => void;
  reset: () => void;
  dispose: () => void;
};

const createNoopSkillQDarknessOverlay = (): SkillQDarknessOverlay => ({
  update: () => {},
  reset: () => {},
  dispose: () => {},
});

const createSkillQDarknessOverlay = (mount?: HTMLElement): SkillQDarknessOverlay => {
  if (typeof document === "undefined" || !mount) {
    return createNoopSkillQDarknessOverlay();
  }

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.background = "#000";
  overlay.style.opacity = "0";
  overlay.style.zIndex = "2";
  mount.appendChild(overlay);

  let currentOpacity = 0;

  return {
    update: (targetOpacity, deltaSeconds) => {
      const target = THREE.MathUtils.clamp(targetOpacity, 0, 1);
      const blend = THREE.MathUtils.clamp(deltaSeconds * 8.5, 0, 1);
      currentOpacity = THREE.MathUtils.lerp(currentOpacity, target, blend);
      overlay.style.opacity = currentOpacity.toFixed(3);
    },
    reset: () => {
      currentOpacity = 0;
      overlay.style.opacity = "0";
    },
    dispose: () => {
      overlay.parentElement?.removeChild(overlay);
    },
  };
};

const createShurikenChargeHud = (mount?: HTMLElement): ChargeHud => {
  const elements = createSvgHudElements({
    mount,
    containerStyle:
      "position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);" +
      "width:196px;height:196px;pointer-events:none;opacity:0;" +
      "transition:opacity 140ms ease;z-index:6;",
    viewBox: "0 0 180 180",
    width: "196",
    height: "196",
  });
  if (!elements) {
    return createNoopChargeHud();
  }

  const { container: hud, svg } = elements;

  const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  track.setAttribute("cx", "90");
  track.setAttribute("cy", "90");
  track.setAttribute("r", "68");
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "rgba(148,163,184,0.3)");
  track.setAttribute("stroke-width", "12");

  const fill = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  fill.setAttribute("cx", "90");
  fill.setAttribute("cy", "90");
  fill.setAttribute("r", "68");
  fill.setAttribute("fill", "none");
  fill.setAttribute("stroke", "#38bdf8");
  fill.setAttribute("stroke-width", "12");
  fill.setAttribute("stroke-linecap", "round");
  fill.setAttribute("transform", "rotate(-90 90 90)");
  fill.setAttribute("style", "filter:drop-shadow(0 0 12px rgba(56,189,248,0.7));");

  const shurikenGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  const shuriken = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  const shurikenFillBase = "rgba(148,163,184,0.28)";
  const shurikenStrokeBase = "rgba(186,230,253,0.95)";
  const shurikenCoreFillBase = "rgba(186,230,253,0.85)";
  const shurikenCoreStrokeBase = "rgba(59,130,246,0.9)";
  shuriken.setAttribute(
    "points",
    "90,24 106,70 154,90 106,110 90,156 74,110 26,90 74,70"
  );
  shuriken.setAttribute("fill", shurikenFillBase);
  shuriken.setAttribute("stroke", shurikenStrokeBase);
  shuriken.setAttribute("stroke-width", "4");

  const shurikenCore = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  shurikenCore.setAttribute("cx", "90");
  shurikenCore.setAttribute("cy", "90");
  shurikenCore.setAttribute("r", "14");
  shurikenCore.setAttribute("fill", shurikenCoreFillBase);
  shurikenCore.setAttribute("stroke", shurikenCoreStrokeBase);
  shurikenCore.setAttribute("stroke-width", "3");

  shurikenGroup.appendChild(shuriken);
  shurikenGroup.appendChild(shurikenCore);
  svg.appendChild(track);
  svg.appendChild(fill);
  svg.appendChild(shurikenGroup);

  let ringLength = 0;
  const setRatio = (ratio: number) => {
    if (!ringLength) {
      ringLength = fill.getTotalLength();
      fill.style.strokeDasharray = `${ringLength}`;
    }
    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    const fullGlow = THREE.MathUtils.smoothstep(clamped, 0.98, 1);
    fill.style.strokeDashoffset = `${ringLength * (1 - clamped)}`;
    shurikenGroup.setAttribute(
      "transform",
      `translate(90 90) rotate(${clamped * 300}) scale(${0.9 + clamped * 0.12}) translate(-90 -90)`
    );
    shurikenCore.setAttribute("r", `${14 + clamped * 4}`);
    shuriken.setAttribute(
      "fill",
      fullGlow > 0
        ? `rgba(186,230,253,${(0.32 + fullGlow * 0.22).toFixed(3)})`
        : shurikenFillBase
    );
    shuriken.setAttribute(
      "stroke",
      fullGlow > 0
        ? `rgba(224,242,254,${(0.95 + fullGlow * 0.05).toFixed(3)})`
        : shurikenStrokeBase
    );
    shurikenCore.setAttribute(
      "fill",
      fullGlow > 0
        ? `rgba(224,242,254,${(0.88 + fullGlow * 0.12).toFixed(3)})`
        : shurikenCoreFillBase
    );
    shurikenCore.setAttribute(
      "stroke",
      fullGlow > 0
        ? `rgba(125,211,252,${(0.9 + fullGlow * 0.1).toFixed(3)})`
        : shurikenCoreStrokeBase
    );
    shurikenGroup.setAttribute(
      "style",
      fullGlow > 0
        ? `filter:drop-shadow(0 0 ${(8 + fullGlow * 6).toFixed(2)}px rgba(125,211,252,${(0.45 + fullGlow * 0.28).toFixed(3)}));`
        : ""
    );
  };

  const setVisible = (visible: boolean) => {
    hud.style.opacity = visible ? "1" : "0";
  };

  setRatio(0);

  return {
    setVisible,
    setRatio,
    dispose: () => {
      hud.parentElement?.removeChild(hud);
    },
  };
};

type DrawSwordFx = {
  attachTo: (arm: THREE.Object3D | null) => void;
  setVisible: (visible: boolean) => void;
  setDrawRatio: (ratio: number) => void;
  dispose: () => void;
};

const createNoopDrawSwordFx = (): DrawSwordFx => ({
  attachTo: () => {},
  setVisible: () => {},
  setDrawRatio: () => {},
  dispose: () => {},
});

type HeldShurikenFx = {
  attachTo: (arm: THREE.Object3D | null) => void;
  setVisible: (visible: boolean) => void;
  setChargeRatio: (ratio: number) => void;
  getCenterWorld: (target: THREE.Vector3) => THREE.Vector3;
  dispose: () => void;
};

const createDrawSwordFx = (avatar: THREE.Object3D): DrawSwordFx => {
  const group = new THREE.Group();
  group.visible = false;

  const handleGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.3, 10);
  const guardGeometry = new THREE.BoxGeometry(0.2, 0.03, 0.08);
  const bladeGeometry = new THREE.BoxGeometry(0.05, 1.1, 0.12);
  const auraGeometry = new THREE.BoxGeometry(0.08, 1.08, 0.2);

  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.5,
    metalness: 0.25,
  });
  const guardMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.26,
    metalness: 0.62,
  });
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.2,
    metalness: 0.78,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.28,
  });
  const auraMaterial = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const handle = new THREE.Mesh(handleGeometry, handleMaterial);
  const guard = new THREE.Mesh(guardGeometry, guardMaterial);
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  const aura = new THREE.Mesh(auraGeometry, auraMaterial);

  handle.castShadow = true;
  guard.castShadow = true;
  blade.castShadow = true;
  blade.receiveShadow = true;

  handle.position.y = 0;
  guard.position.y = 0.12;
  blade.position.y = 0.34;
  aura.position.y = 0.34;

  group.add(handle, guard, blade, aura);
  avatar.add(group);

  const attachTo = (arm: THREE.Object3D | null) => {
    const parent = arm ?? avatar;
    if (group.parent !== parent) {
      group.removeFromParent();
      parent.add(group);
    }
    if (!arm) {
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      return;
    }
    group.position.set(0.19, -0.86, -0.06);
    group.rotation.set(-1.2, 0.46, Math.PI * 0.68);
  };

  const setDrawRatio = (ratio: number) => {
    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    blade.position.y = 0.26 + clamped * 0.52;
    aura.position.y = blade.position.y;
    aura.scale.y = 0.65 + clamped * 0.55;
    auraMaterial.opacity = 0.06 + clamped * 0.18;
    bladeMaterial.emissiveIntensity = 0.28 + clamped * 0.66;
    group.position.x = 0.19 + clamped * 0.18;
    group.position.y = -0.86 + clamped * 0.04;
    group.position.z = -0.06 - clamped * 0.18;
  };

  const setVisible = (visible: boolean) => {
    group.visible = visible;
  };

  return {
    attachTo,
    setVisible,
    setDrawRatio,
    dispose: () => {
      group.removeFromParent();
      handleGeometry.dispose();
      guardGeometry.dispose();
      bladeGeometry.dispose();
      auraGeometry.dispose();
      handleMaterial.dispose();
      guardMaterial.dispose();
      bladeMaterial.dispose();
      auraMaterial.dispose();
    },
  };
};

const createHeldShurikenFx = (avatar: THREE.Object3D): HeldShurikenFx => {
  const group = new THREE.Group();
  group.visible = false;

  const bladeGeometry = createShurikenGeometry();
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.24,
    metalness: 0.5,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.85,
  });
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.castShadow = true;
  blade.receiveShadow = true;

  const auraGeometry = new THREE.RingGeometry(0.11, 0.2, 28);
  const auraMaterial = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const aura = new THREE.Mesh(auraGeometry, auraMaterial);
  aura.position.z = -0.03;

  group.add(blade, aura);
  group.scale.setScalar(0.52);
  avatar.add(group);

  const attachTo = (arm: THREE.Object3D | null) => {
    const parent = arm ?? avatar;
    if (group.parent !== parent) {
      group.removeFromParent();
      parent.add(group);
    }
    if (!arm) {
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      return;
    }
    group.position.set(0.04, -0.95, 0.18);
    group.rotation.set(Math.PI * 0.52, 0.2, Math.PI * 0.22);
  };

  const setChargeRatio = (ratio: number) => {
    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    const scale = 0.84 + clamped * 0.3;
    blade.scale.setScalar(scale);
    aura.scale.setScalar(0.92 + clamped * 0.46);
    auraMaterial.opacity = 0.2 + clamped * 0.5;
    bladeMaterial.emissiveIntensity = 0.85 + clamped * 0.95;
    blade.rotation.z = clamped * Math.PI * 0.5;
  };

  const setVisible = (visible: boolean) => {
    group.visible = visible;
  };

  return {
    attachTo,
    setVisible,
    setChargeRatio,
    getCenterWorld: (target: THREE.Vector3) => group.getWorldPosition(target),
    dispose: () => {
      group.removeFromParent();
      bladeGeometry.dispose();
      auraGeometry.dispose();
      bladeMaterial.dispose();
      auraMaterial.dispose();
    },
  };
};

type SwordWaveEntry = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  baseScale: number;
  spinDirection: number;
};

type ChargedSwordWaveEntry = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  spinDirection: 1 | -1;
};

type SkillRDanceWaveEntry = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  active: boolean;
  launchedAt: number;
  maxLifeMs: number;
  speed: number;
  side: number;
  spinRate: number;
  baseScale: number;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  right: THREE.Vector3;
};

type ShurikenEntry = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  trailGeometry: THREE.BufferGeometry;
  trailMaterial: THREE.LineBasicMaterial;
  trailPositions: Float32Array;
  trailPositionAttribute: THREE.BufferAttribute;
  arcA: THREE.Mesh;
  arcB: THREE.Mesh;
  arcGeometryA: THREE.TorusGeometry;
  arcGeometryB: THREE.TorusGeometry;
  arcMaterialA: THREE.MeshBasicMaterial;
  arcMaterialB: THREE.MeshBasicMaterial;
  electricActive: boolean;
  spinPhase: number;
  spinRate: number;
};

type CloneHeldShurikenFx = {
  group: THREE.Group;
  blade: THREE.Mesh;
  aura: THREE.Mesh;
  bladeMaterial: THREE.MeshStandardMaterial;
  auraMaterial: THREE.MeshBasicMaterial;
};

type CloneSmokePuff = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  spin: THREE.Vector3;
  baseScale: number;
};

type BaronClone = {
  root: THREE.Group;
  model: THREE.Object3D | null;
  chargeFx: THREE.Group;
  heldShuriken: CloneHeldShurikenFx;
  throwArm: THREE.Object3D | null;
  throwArmBase: THREE.Quaternion | null;
  legLeft: THREE.Object3D | null;
  legRight: THREE.Object3D | null;
  walkPhase: number;
  threatTarget: BaronCloneThreatTarget;
  hp: number;
  speed: number;
  direction: THREE.Vector3;
  nextTurnAt: number;
  animation: CloneAnimationState | null;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

type SkillRAfterImage = {
  root: THREE.Object3D;
  materials: THREE.Material[];
  spawnedAt: number;
  lifeMs: number;
  baseOpacity: number;
};

type ActionBinding = {
  clipName: string;
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
};

type CloneAnimationState = {
  mixer: THREE.AnimationMixer;
  walkBinding: ActionBinding | null;
  runBinding: ActionBinding | null;
  skillEHoldBinding: ActionBinding | null;
  skillESuperHoldBinding: ActionBinding | null;
  skillEShootBinding: ActionBinding | null;
  skillESuperShootBinding: ActionBinding | null;
  skillQBeforeBinding: ActionBinding | null;
  skillQAfterBinding: ActionBinding | null;
  shootEndsAt: number;
  shootSuper: boolean;
};

type SkillQSuperStage =
  | "idle"
  | "before"
  | "cloneSlash"
  | "hostSlash"
  | "after";

type SkillQSuperSlashState = {
  kind: "clone" | "host";
  cloneIndex: number;
  startedAt: number;
  endsAt: number;
  originPosition: THREE.Vector3;
  originQuaternion: THREE.Quaternion;
  slashPosition: THREE.Vector3;
  slashQuaternion: THREE.Quaternion;
  slashDirection: THREE.Vector3;
};

type SkillRSlashEvent = {
  timeSec: number;
};

type SkillQTiming = {
  durationSec: number;
  signEndSec: number;
  summonStartSec: number;
  summonEndSec: number;
};

type SkillQSealGlyphEntry = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  spawnedAt: number;
  lifeMs: number;
  baseScale: number;
  origin: THREE.Vector3;
  drift: THREE.Vector3;
};

type SkillQSuperHitFxEntry = {
  root: THREE.Group;
  slashA: THREE.Mesh;
  slashB: THREE.Mesh;
  ring: THREE.Mesh;
  slashMaterialA: THREE.MeshBasicMaterial;
  slashMaterialB: THREE.MeshBasicMaterial;
  ringMaterial: THREE.MeshBasicMaterial;
  active: boolean;
  spawnedAt: number;
  lifeMs: number;
  baseScale: number;
};

type SkillRShadowMaterialState = {
  material: THREE.Material;
  color: THREE.Color | null;
  emissive: THREE.Color | null;
  emissiveIntensity: number | null;
};

type WeaponFirstPersonProxyEntry = {
  sourceMesh: THREE.SkinnedMesh;
  proxyMesh: THREE.SkinnedMesh;
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
};

const walkClipName = "walk";
const runClipName = "run";
const holdClipName = "hold";
const normalAttackClipName = "normalAttack";
const skillEHoldClipName = "skillEHold";
const skillEShootClipName = "skillEShoot";
const skillESuperHoldClipName = "skillESuperHold";
const skillESuperShootClipName = "skillESuperShoot";
const skillQClipName = "skillQ";
const skillQBeforeClipName = "skillQBefore";
const skillQAfterClipName = "skillQAfter";
const skillRClipName = "skillR";

const createSwordWaveEntry = (
  geometry: THREE.BufferGeometry
): SwordWaveEntry => {
  const material = new THREE.MeshStandardMaterial({
    color: 0x060606,
    roughness: 0.64,
    metalness: 0.08,
    emissive: 0x000000,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
  material.depthWrite = false;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 7;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  return {
    mesh,
    material,
    baseScale: 1,
    spinDirection: 1,
  };
};

const createChargedSwordWaveEntry = (
  geometry: THREE.BufferGeometry
): ChargedSwordWaveEntry => {
  const material = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.14,
    metalness: 0.2,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  material.depthWrite = false;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 8;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  return {
    mesh,
    material,
    spinDirection: Math.random() > 0.5 ? 1 : -1,
  };
};

const createSkillRDanceWaveEntry = (
  geometry: THREE.BufferGeometry
): SkillRDanceWaveEntry => {
  const material = new THREE.MeshStandardMaterial({
    color: 0x090909,
    roughness: 0.68,
    metalness: 0.1,
    emissive: 0x000000,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
  material.depthWrite = false;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 8;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  return {
    mesh,
    material,
    active: false,
    launchedAt: 0,
    maxLifeMs: 420,
    speed: 8.3,
    side: 1,
    spinRate: 7.2,
    baseScale: 1,
    origin: new THREE.Vector3(),
    direction: new THREE.Vector3(0, 0, 1),
    right: new THREE.Vector3(1, 0, 0),
  };
};

const createShurikenGeometry = () => {
  const shape = new THREE.Shape();
  const spikes = 4;
  const outerRadius = 0.36;
  const innerRadius = 0.14;

  for (let i = 0; i < spikes * 2; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, 0.075, 0, Math.PI * 2, true);
  shape.holes.push(centerHole);

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateZ(Math.PI / 4);
  return geometry;
};

const createShurikenEntry = (
  geometry: THREE.BufferGeometry
): ShurikenEntry => {
  const material = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.28,
    metalness: 0.46,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 8;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const trailPointCount = 10;
  const trailPositions = new Float32Array(trailPointCount * 3);
  const trailPositionAttribute = new THREE.BufferAttribute(trailPositions, 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute("position", trailPositionAttribute);
  trailGeometry.setDrawRange(0, trailPointCount);
  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.64,
    blending: THREE.AdditiveBlending,
  });
  trailMaterial.depthWrite = false;
  const trail = new THREE.Line(trailGeometry, trailMaterial);
  trail.visible = false;
  trail.renderOrder = 6;
  trail.frustumCulled = false;

  const arcGeometryA = new THREE.TorusGeometry(0.26, 0.014, 7, 24, Math.PI * 1.34);
  const arcGeometryB = new THREE.TorusGeometry(0.2, 0.013, 7, 20, Math.PI * 1.2);
  const arcMaterialA = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const arcMaterialB = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const arcA = new THREE.Mesh(arcGeometryA, arcMaterialA);
  const arcB = new THREE.Mesh(arcGeometryB, arcMaterialB);
  arcA.visible = false;
  arcB.visible = false;
  arcA.position.z = 0.01;
  arcB.position.z = -0.01;
  arcB.rotation.y = Math.PI * 0.55;
  mesh.add(arcA);
  mesh.add(arcB);

  return {
    mesh,
    material,
    trail,
    trailGeometry,
    trailMaterial,
    trailPositions,
    trailPositionAttribute,
    arcA,
    arcB,
    arcGeometryA,
    arcGeometryB,
    arcMaterialA,
    arcMaterialB,
    electricActive: false,
    spinPhase: 0,
    spinRate: 0,
  };
};

const createSwordWaveGeometry = () => {
  const shape = new THREE.Shape();
  const startAngle = THREE.MathUtils.degToRad(-146);
  const endAngle = THREE.MathUtils.degToRad(24);
  const outerRadiusBase = 1.2;
  const maxThickness = 0.62;
  const segments = 34;
  const volumeDepth = 0.24;

  const resolveOuterRadius = (t: number) =>
    outerRadiusBase * (0.9 + Math.sin(Math.PI * t) * 0.1);

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const radius = resolveOuterRadius(t);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.88;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }

  for (let i = segments; i >= 0; i -= 1) {
    const t = i / segments;
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const outerRadius = resolveOuterRadius(t);
    const thickness = maxThickness * Math.sin(Math.PI * t);
    const innerRadius = Math.max(0.08, outerRadius - thickness);
    const x = Math.cos(angle) * innerRadius;
    const y = Math.sin(angle) * innerRadius * 0.88;
    shape.lineTo(x, y);
  }

  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    curveSegments: 28,
    steps: 1,
    depth: volumeDepth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.035,
    bevelOffset: 0,
    bevelSegments: 2,
  });
  // Center the thickness around local Z so swing pivot stays visually stable.
  geometry.translate(0, 0, -volumeDepth * 0.5);
  geometry.rotateZ(THREE.MathUtils.degToRad(8));
  geometry.computeVertexNormals();
  return geometry;
};

const createSkillRDanceWaveGeometry = () => {
  const shape = new THREE.Shape();
  const startAngle = THREE.MathUtils.degToRad(-164);
  const endAngle = THREE.MathUtils.degToRad(36);
  const segments = 32;
  const outerRadiusBase = 1.05;
  const maxThickness = 0.34;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const edgeFactor = Math.pow(Math.sin(Math.PI * t), 0.68);
    const outerRadius = outerRadiusBase * (0.93 + Math.sin(Math.PI * t) * 0.11);
    const x = Math.cos(angle) * outerRadius;
    const y = Math.sin(angle) * outerRadius * 0.84;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
    if (edgeFactor <= 0.0001 && i > 0 && i < segments) {
      // Keep ends pointed to read more like a slash than a ring.
      shape.lineTo(x * 0.98, y * 0.98);
    }
  }

  for (let i = segments; i >= 0; i -= 1) {
    const t = i / segments;
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const edgeFactor = Math.pow(Math.sin(Math.PI * t), 0.68);
    const outerRadius = outerRadiusBase * (0.93 + Math.sin(Math.PI * t) * 0.11);
    const thickness = maxThickness * (0.2 + edgeFactor * 0.8);
    const innerRadius = Math.max(0.2, outerRadius - thickness);
    const x = Math.cos(angle) * innerRadius;
    const y = Math.sin(angle) * innerRadius * 0.84;
    shape.lineTo(x, y);
  }

  shape.closePath();
  const depth = 0.16;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    curveSegments: 26,
    steps: 1,
    depth,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.03,
    bevelOffset: 0,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, -depth * 0.5);
  geometry.rotateZ(THREE.MathUtils.degToRad(12));
  geometry.computeVertexNormals();
  return geometry;
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

const isRightArmOrWeaponTrack = (trackName: string) =>
  /(?:ArmRoot[._]?R|UpperArm[._]?R|LowerArm[._]?R|Hand[._]?R|RightHand|Weapon)/i.test(
    trackName
  );

const isLeftArmOrWeaponTrack = (trackName: string) =>
  /(?:ArmRoot[._]?L|UpperArm[._]?L|LowerArm[._]?L|Hand[._]?L|LeftHand|Weapon)/i.test(
    trackName
  );

const resolveModelNode = (
  model: THREE.Object3D,
  matchers: Array<{ pattern: RegExp; score: number }>
) => {
  let bestNode: THREE.Object3D | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  model.traverse((child) => {
    if (!child.name) return;
    const name = child.name.trim();
    if (!name) return;
    let score = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < matchers.length; i += 1) {
      const matcher = matchers[i];
      if (!matcher.pattern.test(name)) continue;
      score = Math.max(score, matcher.score);
    }
    if (score > bestScore) {
      bestScore = score;
      bestNode = child;
    }
  });
  return bestNode;
};

const resolveRightHandNode = (model: THREE.Object3D) =>
  resolveModelNode(model, [
    { pattern: /^HandR$/i, score: 100 },
    { pattern: /^RightHand$/i, score: 95 },
    { pattern: /right.?hand/i, score: 90 },
    { pattern: /hand.?r/i, score: 88 },
    { pattern: /wrist.?r/i, score: 82 },
    { pattern: /^LowerArmR$/i, score: 78 },
    { pattern: /lower.?arm.?r/i, score: 76 },
    { pattern: /^UpperArmR$/i, score: 66 },
    { pattern: /upper.?arm.?r/i, score: 64 },
    { pattern: /^ArmRootR$/i, score: 52 },
    { pattern: /arm.?root.?r/i, score: 50 },
  ]);

const resolveWeaponNode = (model: THREE.Object3D) =>
  resolveModelNode(model, [
    { pattern: /^Weapon$/i, score: 100 },
    { pattern: /weapon/i, score: 95 },
    { pattern: /sword/i, score: 90 },
    { pattern: /blade/i, score: 88 },
  ]);

const vertexInfluencedByBone = (
  skinIndex: THREE.BufferAttribute,
  skinWeight: THREE.BufferAttribute,
  vertexIndex: number,
  boneIndex: number
) => {
  const i0 = Math.floor(skinIndex.getX(vertexIndex));
  const i1 = Math.floor(skinIndex.getY(vertexIndex));
  const i2 = Math.floor(skinIndex.getZ(vertexIndex));
  const i3 = Math.floor(skinIndex.getW(vertexIndex));
  const w0 = skinWeight.getX(vertexIndex);
  const w1 = skinWeight.getY(vertexIndex);
  const w2 = skinWeight.getZ(vertexIndex);
  const w3 = skinWeight.getW(vertexIndex);

  let dominantIndex = i0;
  let dominantWeight = w0;
  if (w1 > dominantWeight) {
    dominantIndex = i1;
    dominantWeight = w1;
  }
  if (w2 > dominantWeight) {
    dominantIndex = i2;
    dominantWeight = w2;
  }
  if (w3 > dominantWeight) {
    dominantIndex = i3;
    dominantWeight = w3;
  }

  return dominantIndex === boneIndex && dominantWeight >= 0.2;
};

const resolveSkeletonBoneIndex = (
  skeleton: THREE.Skeleton,
  targetBone: THREE.Object3D
) => {
  const byReference = skeleton.bones.findIndex((bone) => bone === targetBone);
  if (byReference >= 0) return byReference;
  const targetName = (targetBone.name || "").trim().toLowerCase();
  if (!targetName) return -1;
  return skeleton.bones.findIndex(
    (bone) => (bone.name || "").trim().toLowerCase() === targetName
  );
};

const buildWeaponOnlyTriangleIndex = (
  geometry: THREE.BufferGeometry,
  weaponBoneIndex: number
) => {
  const position = geometry.getAttribute("position") as
    | THREE.BufferAttribute
    | undefined;
  const skinIndex = geometry.getAttribute("skinIndex") as
    | THREE.BufferAttribute
    | undefined;
  const skinWeight = geometry.getAttribute("skinWeight") as
    | THREE.BufferAttribute
    | undefined;
  if (!position || !skinIndex || !skinWeight) return [];

  const sourceIndex = geometry.index;
  const triangleIndices: number[] = [];
  if (sourceIndex) {
    for (let i = 0; i < sourceIndex.count; i += 1) {
      triangleIndices.push(sourceIndex.getX(i));
    }
  } else {
    for (let i = 0; i < position.count; i += 1) {
      triangleIndices.push(i);
    }
  }

  const filtered: number[] = [];
  for (let i = 0; i + 2 < triangleIndices.length; i += 3) {
    const a = triangleIndices[i];
    const b = triangleIndices[i + 1];
    const c = triangleIndices[i + 2];
    const keepA = vertexInfluencedByBone(skinIndex, skinWeight, a, weaponBoneIndex);
    const keepB = vertexInfluencedByBone(skinIndex, skinWeight, b, weaponBoneIndex);
    const keepC = vertexInfluencedByBone(skinIndex, skinWeight, c, weaponBoneIndex);
    if (!keepA || !keepB || !keepC) continue;
    filtered.push(a, b, c);
  }
  return filtered;
};

const createWeaponFirstPersonProxyEntries = (
  model: THREE.Object3D,
  weaponNode: THREE.Object3D | null
): WeaponFirstPersonProxyEntry[] => {
  if (!weaponNode) return [];
  const entries: WeaponFirstPersonProxyEntry[] = [];

  model.traverse((child) => {
    const sourceMesh = child as THREE.SkinnedMesh;
    if (!sourceMesh.isSkinnedMesh || !sourceMesh.skeleton) return;
    // Only build proxy for meshes hidden from main camera by first-person body masking.
    if (sourceMesh.layers.isEnabled(0)) return;

    const weaponBoneIndex = resolveSkeletonBoneIndex(sourceMesh.skeleton, weaponNode);
    if (weaponBoneIndex < 0) return;

    const filteredIndex = buildWeaponOnlyTriangleIndex(
      sourceMesh.geometry,
      weaponBoneIndex
    );
    if (!filteredIndex.length) return;

    const proxyGeometry = sourceMesh.geometry.clone();
    proxyGeometry.setIndex(filteredIndex);
    proxyGeometry.computeBoundingBox();
    proxyGeometry.computeBoundingSphere();

    const sourceMaterial = sourceMesh.material;
    const proxyMaterials = Array.isArray(sourceMaterial)
      ? sourceMaterial.map((material) => material.clone())
      : [sourceMaterial.clone()];
    const proxyMaterial = Array.isArray(sourceMaterial)
      ? proxyMaterials
      : proxyMaterials[0];

    const proxyMesh = new THREE.SkinnedMesh(proxyGeometry, proxyMaterial);
    proxyMesh.name = `${sourceMesh.name || "baronMesh"}__weaponOnlyFirstPerson`;
    proxyMesh.position.copy(sourceMesh.position);
    proxyMesh.quaternion.copy(sourceMesh.quaternion);
    proxyMesh.scale.copy(sourceMesh.scale);
    proxyMesh.castShadow = sourceMesh.castShadow;
    proxyMesh.receiveShadow = sourceMesh.receiveShadow;
    proxyMesh.frustumCulled = sourceMesh.frustumCulled;
    proxyMesh.renderOrder = sourceMesh.renderOrder + 1;
    proxyMesh.bindMode = sourceMesh.bindMode;
    proxyMesh.visible = sourceMesh.visible;
    proxyMesh.layers.set(0);
    if (sourceMesh.parent) {
      sourceMesh.parent.add(proxyMesh);
      proxyMesh.bind(sourceMesh.skeleton, sourceMesh.bindMatrix);
    }
    if (
      sourceMesh.morphTargetInfluences &&
      sourceMesh.morphTargetInfluences.length > 0
    ) {
      proxyMesh.morphTargetDictionary = sourceMesh.morphTargetDictionary;
      proxyMesh.morphTargetInfluences = sourceMesh.morphTargetInfluences.slice();
    }

    entries.push({
      sourceMesh,
      proxyMesh,
      geometry: proxyGeometry,
      materials: proxyMaterials,
    });
  });

  return entries;
};

const resolveSkillRSlashEvents = (
  clip: THREE.AnimationClip | null
): SkillRSlashEvent[] => {
  if (!clip) return [];
  const quatTrack = clip.tracks.find((track) =>
    /(?:^|[.:])weapon\.quaternion$/i.test(track.name)
  ) as THREE.QuaternionKeyframeTrack | undefined;
  const posTrack = clip.tracks.find((track) =>
    /(?:^|[.:])weapon\.position$/i.test(track.name)
  ) as THREE.VectorKeyframeTrack | undefined;
  if (!quatTrack || !posTrack) return [];

  const sampleCount = Math.min(quatTrack.times.length, posTrack.times.length);
  if (sampleCount < 3) return [];

  const prevQuat = new THREE.Quaternion();
  const nextQuat = new THREE.Quaternion();
  const prevPos = new THREE.Vector3();
  const nextPos = new THREE.Vector3();
  const samples: Array<{ timeSec: number; score: number }> = [];

  for (let i = 1; i < sampleCount; i += 1) {
    const dt = quatTrack.times[i] - quatTrack.times[i - 1];
    if (dt <= 0) continue;
    prevQuat.fromArray(quatTrack.values, (i - 1) * 4);
    nextQuat.fromArray(quatTrack.values, i * 4);
    const dot = THREE.MathUtils.clamp(Math.abs(prevQuat.dot(nextQuat)), 0, 1);
    const angle = 2 * Math.acos(dot);
    const angularSpeed = angle / dt;
    prevPos.fromArray(posTrack.values, (i - 1) * 3);
    nextPos.fromArray(posTrack.values, i * 3);
    const linearSpeed = prevPos.distanceTo(nextPos) / dt;
    const score = angularSpeed * 0.75 + linearSpeed * 0.25;
    if (!Number.isFinite(score)) continue;
    samples.push({
      timeSec: quatTrack.times[i],
      score,
    });
  }
  if (samples.length < 3) return [];

  const peaks: Array<{ timeSec: number; score: number }> = [];
  for (let i = 1; i < samples.length - 1; i += 1) {
    if (
      samples[i].score >= samples[i - 1].score &&
      samples[i].score > samples[i + 1].score
    ) {
      peaks.push(samples[i]);
    }
  }
  if (!peaks.length) return [];

  const minTimeSec = 0.4;
  // Exclude ending sheath/settle frames from hit-event extraction.
  const maxTimeSec = Math.max(minTimeSec + 0.2, clip.duration - 0.6);
  const activePeaks = peaks.filter(
    (peak) => peak.timeSec >= minTimeSec && peak.timeSec <= maxTimeSec
  );
  if (!activePeaks.length) return [];

  const meanScore =
    activePeaks.reduce((sum, peak) => sum + peak.score, 0) / activePeaks.length;
  const variance =
    activePeaks.reduce(
      (sum, peak) => sum + Math.pow(peak.score - meanScore, 2),
      0
    ) / activePeaks.length;
  const stdDev = Math.sqrt(Math.max(0, variance));
  const anchorThreshold = meanScore + stdDev * 0.35;
  const anchorPeaks = activePeaks
    .filter((peak) => peak.score >= anchorThreshold)
    .sort((a, b) => a.timeSec - b.timeSec);

  const attackStartSec = anchorPeaks[0]?.timeSec ?? minTimeSec;
  const attackEndSec =
    anchorPeaks.length > 0
      ? anchorPeaks[anchorPeaks.length - 1].timeSec
      : maxTimeSec;
  const denseThreshold = meanScore - stdDev * 0.6;
  const filtered = activePeaks
    .filter(
      (peak) =>
        peak.timeSec >= attackStartSec &&
        peak.timeSec <= attackEndSec &&
        peak.score >= denseThreshold
    )
    .sort((a, b) => a.timeSec - b.timeSec);
  if (!filtered.length) {
    return anchorPeaks.map((peak) => ({ timeSec: peak.timeSec }));
  }

  // Keep one strike event roughly every 2~3 keyframes (24fps clip).
  const minSpacingSec = 0.1;
  const selected: Array<{ timeSec: number; score: number }> = [];
  for (let i = 0; i < filtered.length; i += 1) {
    const peak = filtered[i];
    const last = selected[selected.length - 1];
    if (!last || peak.timeSec - last.timeSec >= minSpacingSec) {
      selected.push(peak);
      continue;
    }
    if (peak.score > last.score) {
      selected[selected.length - 1] = peak;
    }
  }

  if (!selected.length) {
    return anchorPeaks.map((peak) => ({ timeSec: peak.timeSec }));
  }
  return selected.map((peak) => ({ timeSec: peak.timeSec }));
};

const resolveSkillQTiming = (clip: THREE.AnimationClip | null): SkillQTiming => {
  const durationSec = Math.max(0.24, clip?.duration ?? 2.25);
  const fallbackSignEndSec = THREE.MathUtils.clamp(
    durationSec * 0.72,
    0.12,
    Math.max(0.12, durationSec - 0.2)
  );
  const fallbackSummonStartSec = THREE.MathUtils.clamp(
    durationSec * 0.8,
    fallbackSignEndSec + 0.04,
    Math.max(fallbackSignEndSec + 0.04, durationSec - 0.08)
  );
  const fallbackSummonEndSec = THREE.MathUtils.clamp(
    durationSec * 0.93,
    fallbackSummonStartSec + 0.06,
    durationSec
  );
  if (!clip) {
    return {
      durationSec,
      signEndSec: fallbackSignEndSec,
      summonStartSec: fallbackSummonStartSec,
      summonEndSec: fallbackSummonEndSec,
    };
  }

  const armQuatTracks = clip.tracks.filter(
    (track): track is THREE.QuaternionKeyframeTrack =>
      track instanceof THREE.QuaternionKeyframeTrack &&
      /(?:^|[.:])(?:UpperArm|LowerArm|Hand)(?:[._]?L|[._]?R)\.quaternion$/i.test(
        track.name
      )
  );
  if (armQuatTracks.length === 0) {
    return {
      durationSec,
      signEndSec: fallbackSignEndSec,
      summonStartSec: fallbackSummonStartSec,
      summonEndSec: fallbackSummonEndSec,
    };
  }

  const scoreByTime = new Map<number, number>();
  const prevQuat = new THREE.Quaternion();
  const nextQuat = new THREE.Quaternion();
  for (let trackIndex = 0; trackIndex < armQuatTracks.length; trackIndex += 1) {
    const track = armQuatTracks[trackIndex];
    const sampleCount = track.times.length;
    if (sampleCount < 2) continue;
    for (let sampleIndex = 1; sampleIndex < sampleCount; sampleIndex += 1) {
      const dt = track.times[sampleIndex] - track.times[sampleIndex - 1];
      if (dt <= 0) continue;
      prevQuat.fromArray(track.values, (sampleIndex - 1) * 4);
      nextQuat.fromArray(track.values, sampleIndex * 4);
      const dot = THREE.MathUtils.clamp(Math.abs(prevQuat.dot(nextQuat)), 0, 1);
      const angle = 2 * Math.acos(dot);
      const angularSpeed = angle / dt;
      if (!Number.isFinite(angularSpeed)) continue;
      const timeKey = Number(track.times[sampleIndex].toFixed(4));
      scoreByTime.set(timeKey, (scoreByTime.get(timeKey) ?? 0) + angularSpeed);
    }
  }

  const samples = Array.from(scoreByTime.entries())
    .map(([timeSec, score]) => ({ timeSec, score }))
    .sort((a, b) => a.timeSec - b.timeSec);
  if (samples.length < 4) {
    return {
      durationSec,
      signEndSec: fallbackSignEndSec,
      summonStartSec: fallbackSummonStartSec,
      summonEndSec: fallbackSummonEndSec,
    };
  }

  const meanScore =
    samples.reduce((sum, sample) => sum + sample.score, 0) / samples.length;
  const variance =
    samples.reduce(
      (sum, sample) => sum + Math.pow(sample.score - meanScore, 2),
      0
    ) / samples.length;
  const stdDev = Math.sqrt(Math.max(0, variance));
  const highMotionThreshold = meanScore + stdDev * 0.4;
  const lowMotionThreshold = Math.max(0, meanScore - stdDev * 0.45);
  const tailCutoffSec = durationSec * 0.93;
  const activeWindowSamples = samples.filter(
    (sample) =>
      sample.timeSec >= durationSec * 0.08 &&
      sample.timeSec <= tailCutoffSec &&
      sample.score >= highMotionThreshold
  );
  const lastActiveTimeSec =
    activeWindowSamples[activeWindowSamples.length - 1]?.timeSec ??
    fallbackSignEndSec;
  const quietScanStartSec = THREE.MathUtils.clamp(
    lastActiveTimeSec + 0.01,
    durationSec * 0.2,
    tailCutoffSec
  );

  let bestQuietStartSec = 0;
  let bestQuietEndSec = 0;
  let cursorStartSec: number | null = null;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    if (sample.timeSec < quietScanStartSec || sample.timeSec > tailCutoffSec) {
      continue;
    }
    if (sample.score <= lowMotionThreshold) {
      if (cursorStartSec === null) {
        cursorStartSec = sample.timeSec;
      }
      continue;
    }
    if (cursorStartSec !== null) {
      const segmentDurationSec = sample.timeSec - cursorStartSec;
      if (segmentDurationSec > bestQuietEndSec - bestQuietStartSec) {
        bestQuietStartSec = cursorStartSec;
        bestQuietEndSec = sample.timeSec;
      }
      cursorStartSec = null;
    }
  }
  if (cursorStartSec !== null) {
    const finalQuietEndSec =
      samples[samples.length - 1]?.timeSec ?? Math.min(durationSec, tailCutoffSec);
    const segmentDurationSec = finalQuietEndSec - cursorStartSec;
    if (segmentDurationSec > bestQuietEndSec - bestQuietStartSec) {
      bestQuietStartSec = cursorStartSec;
      bestQuietEndSec = finalQuietEndSec;
    }
  }

  const hasQuietWindow = bestQuietEndSec - bestQuietStartSec >= 0.08;
  const summonStartSec = hasQuietWindow
    ? THREE.MathUtils.clamp(bestQuietStartSec, 0.12, durationSec)
    : fallbackSummonStartSec;
  const summonEndSec = hasQuietWindow
    ? THREE.MathUtils.clamp(
        bestQuietEndSec,
        summonStartSec + 0.05,
        Math.min(durationSec, tailCutoffSec + 0.08)
      )
    : fallbackSummonEndSec;
  const signEndSec = THREE.MathUtils.clamp(
    hasQuietWindow
      ? Math.min(summonStartSec, lastActiveTimeSec + 0.06)
      : fallbackSignEndSec,
    0.12,
    summonStartSec
  );

  return {
    durationSec,
    signEndSec,
    summonStartSec,
    summonEndSec,
  };
};

const resolveClip = (clips: THREE.AnimationClip[], clipName: string) => {
  const lowerClipName = clipName.toLowerCase();
  return (
    clips.find((clip) => clip.name === clipName) ??
    clips.find((clip) => clip.name.toLowerCase() === lowerClipName) ??
    null
  );
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
  return { clipName, clip, action };
};

const createLoopBinding = (
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip | null,
  clipName: string
) => {
  if (!clip) return null;
  const action = mixer.clipAction(clip);
  action.clampWhenFinished = false;
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.enabled = true;
  action.paused = true;
  action.setEffectiveWeight(0);
  return { clipName, clip, action };
};

const stopActionBinding = (binding: ActionBinding | null) => {
  if (!binding) return;
  binding.action.stop();
  binding.action.paused = true;
  binding.action.enabled = true;
  binding.action.setEffectiveWeight(0);
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  mount,
  fireProjectile,
  performMeleeAttack,
  applyEnergy,
  applyMana,
  getCurrentStats,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const skillQDarknessOverlay = createSkillQDarknessOverlay(mount);
  const hud = createShurikenChargeHud(mount);
  const drawSword = createNoopDrawSwordFx();
  const heldShuriken = createHeldShurikenFx(avatar);

  const chargeConfig = {
    maxHoldMs: 1800,
    minHoldMs: 180,
    releaseMs: 210,
  };
  const manaGainOnReflectOrBasicDamage = 5;
  const primarySwingConfig = {
    durationMs: 240,
    minDamage: 20,
    maxDamage: 46,
    minRange: 2.05,
    maxRange: 4.55,
    minHitRadius: 0.9,
    maxHitRadius: 2.25,
    minFxScale: 1.74,
    maxFxScale: 3.36,
    minReflectSpeedMultiplier: 1.05,
    maxReflectSpeedMultiplier: 2.35,
    energyGainOnReflect: 15,
    energyGainOnHit: 10,
  };
  const chargedSwordWaveConfig = {
    fullChargeThreshold: 0.999,
    damageMultiplier: 2,
    speed: 24,
    lifetime: 0.92,
    radius: 0.42,
    targetHitRadius: 0.56,
    spawnForward: 1.26,
    spawnHeight: 1.24,
  };
  const primaryReflectVolumeConfig = {
    minDepth: 1.55,
    maxDepth: 3.05,
    minWidth: 2.8,
    maxWidth: 6.9,
    minHeight: 2.0,
    maxHeight: 3.4,
    centerY: 1.28,
  };
  const chargeState = {
    isCharging: false,
    startTime: 0,
    ratio: 0,
    releaseUntil: 0,
  };
  const armAnim = {
    draw: 0,
  };
  const armBase = {
    captured: false,
    rightId: "",
    leftId: "",
    right: new THREE.Quaternion(),
    left: new THREE.Quaternion(),
  };
  const armNeutral = {
    captured: false,
    rightId: "",
    leftId: "",
    right: new THREE.Quaternion(),
    left: new THREE.Quaternion(),
  };
  const armPoseResetState = {
    requested: false,
  };

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const rightQuatX = new THREE.Quaternion();
  const rightQuatY = new THREE.Quaternion();
  const rightQuatZ = new THREE.Quaternion();
  const leftQuatX = new THREE.Quaternion();
  const leftQuatZ = new THREE.Quaternion();
  const swingOrigin = new THREE.Vector3();
  const swingForward = new THREE.Vector3();
  const swingRight = new THREE.Vector3();
  const swingUp = new THREE.Vector3(0, 1, 0);
  const swingFacing = new THREE.Quaternion();

  const swordWaveGeometry = createSwordWaveGeometry();
  const swordWavePool: SwordWaveEntry[] = Array.from({ length: 8 }, () =>
    createSwordWaveEntry(swordWaveGeometry)
  );
  const chargedSwordWaveGeometry = createSwordWaveGeometry();
  const chargedSwordWavePool: ChargedSwordWaveEntry[] = Array.from(
    { length: 4 },
    () => createChargedSwordWaveEntry(chargedSwordWaveGeometry)
  );
  const skillRDanceWaveGeometry = createSkillRDanceWaveGeometry();
  const skillRDanceWavePool: SkillRDanceWaveEntry[] = Array.from(
    { length: 12 },
    () => createSkillRDanceWaveEntry(skillRDanceWaveGeometry)
  );
  const shurikenGeometry = createShurikenGeometry();
  const shurikenPool: ShurikenEntry[] = Array.from({ length: 12 }, () =>
    createShurikenEntry(shurikenGeometry)
  );
  const skillQSuperHitSlashGeometry = new THREE.PlaneGeometry(4.26, 0.48);
  const skillQSuperHitRingGeometry = new THREE.RingGeometry(0.78, 1.68, 24);
  const skillQSuperHitFxPool: SkillQSuperHitFxEntry[] = [];
  const projectileForward = new THREE.Vector3(0, 0, 1);
  const skillRDanceWaveOrigin = new THREE.Vector3();
  const skillRDanceWaveDirection = new THREE.Vector3();
  const skillRDanceWaveRight = new THREE.Vector3();
  const skillRDanceWaveUp = new THREE.Vector3(0, 1, 0);
  const skillRDanceWaveFacing = new THREE.Quaternion();
  const skillRReflectFacing = new THREE.Quaternion();
  const skillRReflectForward = new THREE.Vector3();
  const skillRReflectIncoming = new THREE.Vector3();
  const mergedProjectileBlockers: THREE.Object3D[] = [];
  const primaryReflectVolumeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const primaryReflectVolumeMaterial = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const primaryReflectVolume = new THREE.Mesh(
    primaryReflectVolumeGeometry,
    primaryReflectVolumeMaterial
  );
  primaryReflectVolume.visible = false;
  primaryReflectVolume.frustumCulled = false;
  primaryReflectVolume.renderOrder = 4;
  avatar.add(primaryReflectVolume);
  const primarySwingState = {
    entry: null as SwordWaveEntry | null,
    startedAt: 0,
    endsAt: 0,
    ratio: 0,
    baseScale: 1,
    reflectSpeedMultiplier: 1,
    rotationVariant: "default" as "default" | "rDance",
    rotationDirection: 1 as 1 | -1,
    rotationYawOffset: 0,
    rotationPitchOffset: 0,
    rotationRollFrom: -1.25,
    rotationRollTo: 1.04,
    rotationPhase: 0,
  };
  const skillRConfig = {
    durationMs: 5000,
    movementSpeedMultiplier: 1 / 3,
    meleeIntervalMs: 220,
    meleeDamage: 24,
    meleeRange: 4.5,
    meleeHitRadius: 2.35,
    meleeMaxHits: 8,
    energyGainOnReflect: 10,
    energyGainOnHit: 20,
    reflectSpeedMultiplier: 1.28,
    reflectRadius: 2.45,
    reflectCenterY: 1.2,
    reflectFrontDotMax: 0,
    waveMinSpeed: 7.8,
    waveMaxSpeed: 11.6,
    waveLifeMs: 460,
    waveMinScale: 2.55,
    waveMaxScale: 3.84,
  };
  const skillRState = {
    active: false,
    startedAt: 0,
    endsAt: 0,
    nextSlashIndex: 0,
  };
  const skillQConfig = {
    glyphSpawnIntervalMs: 110,
    glyphLifeMs: 520,
    glyphScaleMin: 0.58,
    glyphScaleMax: 0.84,
    glyphLateralSpread: 0.8,
    glyphFrontMin: 0.95,
    glyphFrontMax: 1.25,
    glyphHeightMin: 1.35,
    glyphHeightMax: 2.25,
  };
  const skillQState = {
    active: false,
    startedAt: 0,
    endsAt: 0,
    signEndsAt: 0,
    summonWindowStartAt: 0,
    summonWindowEndAt: 0,
    nextGlyphSpawnAt: 0,
    clonesSummoned: false,
  };
  const skillQSuperConfig = {
    cloneSlashDurationMs: 300,
    hostSlashDurationMs: 600,
    strikeDamage: 150,
    strikeRadius: 100,
    strikeMaxHits: 96,
    cloneDashDistance: 2.4,
    hostDashDistance: 3.2,
  };
  const skillQSuperState = {
    active: false,
    stage: "idle" as SkillQSuperStage,
    startedAt: 0,
    beforeEndsAt: 0,
    afterEndsAt: 0,
    nextCloneIndex: 0,
    slash: null as SkillQSuperSlashState | null,
    hostReturnReady: false,
    hostReturnPosition: new THREE.Vector3(),
  };
  let skillRDanceWaveNextSide: 1 | -1 = 1;
  const cloneConfig = {
    count: 5,
    durationMs: 10000,
    hpRatio: 1 / 3,
    speedRatio: 1 / 3,
    minTurnIntervalMs: 420,
    maxTurnIntervalMs: 1350,
    spawnRadiusMin: 2.1,
    spawnRadiusMax: 4.2,
    wanderRadius: 8.6,
    chargeYOffset: 1.55,
    eThrowOriginYOffset: 1.15,
    preparingCrouchDepthMin: 0.22,
    preparingCrouchDepthMax: 0.5,
    preparingLeanMin: 0,
    preparingLeanMax: 0,
    preparingLegBendMin: 0.04,
    preparingLegBendMax: 0.22,
    preparingLegSpreadMin: 0.16,
    preparingLegSpreadMax: 0.34,
    preparingLegTwistMin: 0.02,
    preparingLegTwistMax: 0.1,
    preparingBodySquashMin: 0.94,
    preparingBodySquashMax: 0.84,
    preparingBodyWidenMin: 1.02,
    preparingBodyWidenMax: 1.12,
    preparingHandLiftYMin: 0.06,
    preparingHandLiftYMax: 0.2,
    preparingHandForwardMin: 0.02,
    preparingHandForwardMax: 0.1,
    preparingHeldScaleBoost: 1.4,
    eShurikenHomingRadius: 5,
    eShurikenHomingTurnRate: 4.2,
  };
  const cloneState = {
    active: false,
    startedAt: 0,
    endsAt: 0,
    consumePending: false,
    consumeAfterShootAt: 0,
    clones: [] as BaronClone[],
  };
  let cloneThreatIdCounter = 0;
  const cloneAnchor = new THREE.Group();
  cloneAnchor.name = "baron-clones";
  (avatar.parent ?? avatar).add(cloneAnchor);
  const cloneScratchOrigin = new THREE.Vector3();
  const cloneScratchDirection = new THREE.Vector3();
  const cloneScratchTarget = new THREE.Vector3();
  const cloneScratchTemp = new THREE.Vector3();
  const cloneSmokeScratch = new THREE.Vector3();
  const cloneUp = new THREE.Vector3(0, 1, 0);
  const cloneBaseSpeed =
    Math.max(0.1, profile.movement?.baseSpeed ?? 5) * cloneConfig.speedRatio;
  const cloneSmokeGeometry = new THREE.SphereGeometry(0.32, 8, 8);
  const cloneSmokePuffs: CloneSmokePuff[] = [];
  let runtimeAnimationClips: THREE.AnimationClip[] = [];
  const skillQSealGlyphChars = ["甲", "乙", "丙", "丁"] as const;
  const skillQSealGlyphEntries: SkillQSealGlyphEntry[] = [];
  const skillQSealGlyphTextureCache = new Map<string, THREE.CanvasTexture>();
  let runtimeLastUpdateAt = 0;
  let runtimeAnimationModel: THREE.Object3D | null = null;
  let runtimeAnimationMixer: THREE.AnimationMixer | null = null;
  let runtimeWalkBinding: ActionBinding | null = null;
  let runtimeRunBinding: ActionBinding | null = null;
  let runtimeWalkNoRightArmBinding: ActionBinding | null = null;
  let runtimeRunNoRightArmBinding: ActionBinding | null = null;
  let runtimeWalkNoLeftArmBinding: ActionBinding | null = null;
  let runtimeRunNoLeftArmBinding: ActionBinding | null = null;
  let runtimeHoldBinding: ActionBinding | null = null;
  let runtimeHoldRightArmBinding: ActionBinding | null = null;
  let runtimeSkillEHoldBinding: ActionBinding | null = null;
  let runtimeSkillESuperHoldBinding: ActionBinding | null = null;
  let runtimeSkillEShootBinding: ActionBinding | null = null;
  let runtimeSkillESuperShootBinding: ActionBinding | null = null;
  let runtimeSkillEShootEndsAt = 0;
  let runtimeSkillEShootSuper = false;
  let runtimeNormalAttackBinding: ActionBinding | null = null;
  let runtimeNormalAttackRightArmBinding: ActionBinding | null = null;
  let runtimeSkillQBinding: ActionBinding | null = null;
  let runtimeSkillQBeforeBinding: ActionBinding | null = null;
  let runtimeSkillQAfterBinding: ActionBinding | null = null;
  let runtimeSkillQTiming = resolveSkillQTiming(null);
  let runtimeSkillRBinding: ActionBinding | null = null;
  let runtimeSkillRSlashEvents: SkillRSlashEvent[] = [];
  const runtimeWeaponFirstPersonProxyEntries: WeaponFirstPersonProxyEntry[] = [];
  let runtimeNormalAttackEndsAt = 0;
  let runtimeIsMoving = false;
  let runtimeIsSprinting = false;
  let runtimeWeaponConstraintHand: THREE.Object3D | null = null;
  let runtimeWeaponConstraintWeapon: THREE.Object3D | null = null;
  let runtimeWeaponConstraintOffsetReady = false;
  let runtimePreferredGripOffsetReady = false;
  const runtimeWeaponConstraintHandToWeapon = new THREE.Matrix4();
  const runtimePreferredGripHandToWeapon = new THREE.Matrix4();
  const runtimeWeaponConstraintHandWorld = new THREE.Matrix4();
  const runtimeWeaponConstraintTargetWorld = new THREE.Matrix4();
  const runtimeWeaponConstraintParentInverse = new THREE.Matrix4();
  const runtimeWeaponConstraintLocal = new THREE.Matrix4();
  const runtimeWeaponConstraintLocalPosition = new THREE.Vector3();
  const runtimeWeaponConstraintLocalQuaternion = new THREE.Quaternion();
  const runtimeWeaponConstraintLocalScale = new THREE.Vector3();
  const skillQSuperSlashOrigin = new THREE.Vector3();
  const skillQSuperSlashQuaternion = new THREE.Quaternion();
  const skillQSuperSlashForward = new THREE.Vector3();
  const skillQSuperSlashTarget = new THREE.Vector3();
  const skillQSuperSlashCurrentPosition = new THREE.Vector3();
  const skillQSuperParentQuaternion = new THREE.Quaternion();
  const skillQSuperHitQuaternion = new THREE.Quaternion();
  const skillRReflectVolumeGeometry = new THREE.SphereGeometry(1, 22, 14);
  const skillRReflectVolumeMaterial = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const skillRReflectVolume = new THREE.Mesh(
    skillRReflectVolumeGeometry,
    skillRReflectVolumeMaterial
  );
  skillRReflectVolume.visible = false;
  skillRReflectVolume.frustumCulled = false;
  skillRReflectVolume.renderOrder = 4;
  avatar.add(skillRReflectVolume);
  const skillEChargeConfig = {
    maxHoldMs: 1300,
    minDistanceScale: 0.9,
    maxDistanceScale: 2.35,
    minShurikenScale: 0.78,
    maxShurikenScale: 1.55,
    minRadiusScale: 0.8,
    maxRadiusScale: 1.42,
    minLifetimeScale: 0.95,
    maxLifetimeScale: 1.75,
    minSpeedScale: 0.95,
    maxSpeedScale: 1.22,
    minExplosionScale: 0.88,
    maxExplosionScale: 1.28,
    minExplosionDamageScale: 0.9,
    maxExplosionDamageScale: 1.2,
  };
  const skillEChargeState = {
    isCharging: false,
    startTime: 0,
    ratio: 0,
  };
  const skillEConfig = {
    shotCount: 3,
    shotIntervalMs: 72,
    speed: 20,
    lifetime: 1.24,
    damage: 17,
    radius: 0.27,
    targetHitRadius: 0,
    forwardSpawn: 0.34,
    lateralSpawn: 0.28,
    verticalSpawn: 0,
    spreadRad: THREE.MathUtils.degToRad(16),
    focusDistance: 8.8,
    superHomingSearchRadius: 9,
    superHomingTurnRate: 7.2,
    explosionRadius: 5.2,
    explosionDamage: 48,
  };
  const skillEHitCutConfig = {
    lifeMs: 340,
    minSpeed: 2.2,
    maxSpeed: 3.9,
    minScale: 0.58,
    maxScale: 0.92,
    forwardOffset: 0.08,
    lateralOffset: 0.14,
    yOffset: 0.24,
  };
  const skillESideOffsets = [-1, 0, 1];
  const skillEVolley = {
    active: false,
    cloneBoosted: false,
    firedCount: 0,
    nextShotAt: 0,
    origin: new THREE.Vector3(),
    baseDirection: new THREE.Vector3(0, 0, 1),
    right: new THREE.Vector3(1, 0, 0),
    speed: skillEConfig.speed,
    lifetime: skillEConfig.lifetime,
    radius: skillEConfig.radius,
    targetHitRadius: skillEConfig.targetHitRadius,
    shurikenScale: 1,
    explosionRadius: skillEConfig.explosionRadius,
    explosionDamage: skillEConfig.explosionDamage,
  };
  const skillEAimDirection = new THREE.Vector3(0, 0, 1);
  const skillEOrigin = new THREE.Vector3();
  const skillEBaseDirection = new THREE.Vector3();
  const skillERight = new THREE.Vector3();
  const skillEShotDirection = new THREE.Vector3();
  const skillEShotOrigin = new THREE.Vector3();
  const skillEUp = new THREE.Vector3(0, 1, 0);
  const chargedSwordWaveOrigin = new THREE.Vector3();
  const chargedSwordWaveDirection = new THREE.Vector3();
  const chargedSwordWaveVelocityDirection = new THREE.Vector3();
  const reflectedProjectileDirection = new THREE.Vector3();
  const reflectedProjectileHitPoint = new THREE.Vector3();

  const captureArmNeutralIfNeeded = (
    rightArm: THREE.Object3D,
    leftArm: THREE.Object3D
  ) => {
    const sameTargets =
      armNeutral.rightId === rightArm.uuid && armNeutral.leftId === leftArm.uuid;
    if (armNeutral.captured && sameTargets) return;
    armNeutral.captured = true;
    armNeutral.rightId = rightArm.uuid;
    armNeutral.leftId = leftArm.uuid;
    armNeutral.right.copy(rightArm.quaternion);
    armNeutral.left.copy(leftArm.quaternion);
  };

  const restoreArmNeutralPose = (
    rightArm: THREE.Object3D,
    leftArm: THREE.Object3D
  ) => {
    if (!armNeutral.captured) return;
    const sameTargets =
      armNeutral.rightId === rightArm.uuid && armNeutral.leftId === leftArm.uuid;
    if (!sameTargets) return;
    rightArm.quaternion.copy(armNeutral.right);
    leftArm.quaternion.copy(armNeutral.left);
  };

  const requestArmPoseReset = () => {
    armPoseResetState.requested = true;
    armAnim.draw = 0;
    drawSword.setVisible(false);
    drawSword.attachTo(null);
  };

  const applyArmPoseResetIfRequested = (
    rightArm: THREE.Object3D,
    leftArm: THREE.Object3D
  ) => {
    if (!armPoseResetState.requested) return;

    const sameTargets =
      armBase.captured &&
      armBase.rightId === rightArm.uuid &&
      armBase.leftId === leftArm.uuid;
    if (sameTargets) {
      rightArm.quaternion.copy(armBase.right);
      leftArm.quaternion.copy(armBase.left);
    }
    restoreArmNeutralPose(rightArm, leftArm);
    armBase.captured = false;
    armPoseResetState.requested = false;
  };

  const resolveRuntimeDeltaSeconds = (now: number) => {
    if (runtimeLastUpdateAt <= 0) {
      runtimeLastUpdateAt = now;
      return 0;
    }
    const deltaSeconds = THREE.MathUtils.clamp(
      (now - runtimeLastUpdateAt) * 0.001,
      0,
      0.05
    );
    runtimeLastUpdateAt = now;
    return deltaSeconds;
  };

  const clearRuntimeWeaponFirstPersonProxies = () => {
    for (let i = 0; i < runtimeWeaponFirstPersonProxyEntries.length; i += 1) {
      const entry = runtimeWeaponFirstPersonProxyEntries[i];
      entry.proxyMesh.removeFromParent();
      entry.geometry.dispose();
      for (let matIndex = 0; matIndex < entry.materials.length; matIndex += 1) {
        entry.materials[matIndex].dispose();
      }
    }
    runtimeWeaponFirstPersonProxyEntries.length = 0;
  };

  const syncRuntimeWeaponFirstPersonProxies = () => {
    for (let i = 0; i < runtimeWeaponFirstPersonProxyEntries.length; i += 1) {
      const entry = runtimeWeaponFirstPersonProxyEntries[i];
      entry.proxyMesh.visible = entry.sourceMesh.visible;
      if (
        entry.sourceMesh.morphTargetInfluences &&
        entry.proxyMesh.morphTargetInfluences &&
        entry.proxyMesh.morphTargetInfluences.length ===
          entry.sourceMesh.morphTargetInfluences.length
      ) {
        for (
          let morphIndex = 0;
          morphIndex < entry.sourceMesh.morphTargetInfluences.length;
          morphIndex += 1
        ) {
          entry.proxyMesh.morphTargetInfluences[morphIndex] =
            entry.sourceMesh.morphTargetInfluences[morphIndex];
        }
      }
    }
  };

  const clearRuntimeAnimationBindings = () => {
    restoreSkillRShadowForm();
    stopActionBinding(runtimeWalkBinding);
    stopActionBinding(runtimeRunBinding);
    stopActionBinding(runtimeWalkNoRightArmBinding);
    stopActionBinding(runtimeRunNoRightArmBinding);
    stopActionBinding(runtimeWalkNoLeftArmBinding);
    stopActionBinding(runtimeRunNoLeftArmBinding);
    stopActionBinding(runtimeHoldBinding);
    stopActionBinding(runtimeHoldRightArmBinding);
    stopActionBinding(runtimeSkillEHoldBinding);
    stopActionBinding(runtimeSkillESuperHoldBinding);
    stopActionBinding(runtimeSkillEShootBinding);
    stopActionBinding(runtimeSkillESuperShootBinding);
    stopActionBinding(runtimeNormalAttackBinding);
    stopActionBinding(runtimeNormalAttackRightArmBinding);
    stopActionBinding(runtimeSkillQBinding);
    stopActionBinding(runtimeSkillQBeforeBinding);
    stopActionBinding(runtimeSkillQAfterBinding);
    stopActionBinding(runtimeSkillRBinding);
    clearRuntimeWeaponFirstPersonProxies();
    if (runtimeAnimationMixer && runtimeAnimationModel) {
      runtimeAnimationMixer.stopAllAction();
      runtimeAnimationMixer.uncacheRoot(runtimeAnimationModel);
    }
    runtimeAnimationModel = null;
    runtimeAnimationMixer = null;
    runtimeWalkBinding = null;
    runtimeRunBinding = null;
    runtimeWalkNoRightArmBinding = null;
    runtimeRunNoRightArmBinding = null;
    runtimeWalkNoLeftArmBinding = null;
    runtimeRunNoLeftArmBinding = null;
    runtimeHoldBinding = null;
    runtimeHoldRightArmBinding = null;
    runtimeSkillEHoldBinding = null;
    runtimeSkillESuperHoldBinding = null;
    runtimeSkillEShootBinding = null;
    runtimeSkillESuperShootBinding = null;
    runtimeSkillEShootEndsAt = 0;
    runtimeSkillEShootSuper = false;
    runtimeNormalAttackBinding = null;
    runtimeNormalAttackRightArmBinding = null;
    runtimeSkillQBinding = null;
    runtimeSkillQBeforeBinding = null;
    runtimeSkillQAfterBinding = null;
    runtimeSkillQTiming = resolveSkillQTiming(null);
    runtimeSkillRBinding = null;
    runtimeSkillRSlashEvents = [];
    runtimeAnimationClips = [];
    runtimeNormalAttackEndsAt = 0;
    runtimeIsMoving = false;
    runtimeIsSprinting = false;
    runtimeWeaponConstraintHand = null;
    runtimeWeaponConstraintWeapon = null;
    runtimeWeaponConstraintOffsetReady = false;
    runtimePreferredGripOffsetReady = false;
    runtimeWeaponConstraintHandToWeapon.identity();
    runtimePreferredGripHandToWeapon.identity();
  };

  const resetRuntimeAnimationPlayback = () => {
    restoreSkillRShadowForm();
    stopActionBinding(runtimeWalkBinding);
    stopActionBinding(runtimeRunBinding);
    stopActionBinding(runtimeWalkNoRightArmBinding);
    stopActionBinding(runtimeRunNoRightArmBinding);
    stopActionBinding(runtimeWalkNoLeftArmBinding);
    stopActionBinding(runtimeRunNoLeftArmBinding);
    stopActionBinding(runtimeHoldBinding);
    stopActionBinding(runtimeHoldRightArmBinding);
    stopActionBinding(runtimeSkillEHoldBinding);
    stopActionBinding(runtimeSkillESuperHoldBinding);
    stopActionBinding(runtimeSkillEShootBinding);
    stopActionBinding(runtimeSkillESuperShootBinding);
    stopActionBinding(runtimeNormalAttackBinding);
    stopActionBinding(runtimeNormalAttackRightArmBinding);
    stopActionBinding(runtimeSkillQBinding);
    stopActionBinding(runtimeSkillQBeforeBinding);
    stopActionBinding(runtimeSkillQAfterBinding);
    stopActionBinding(runtimeSkillRBinding);
    runtimeSkillEShootEndsAt = 0;
    runtimeSkillEShootSuper = false;
    runtimeNormalAttackEndsAt = 0;
    runtimeIsMoving = false;
    runtimeIsSprinting = false;
  };

  const bindRuntimeAnimationModel = (model: THREE.Object3D | null) => {
    if (runtimeAnimationModel === model) return;
    clearRuntimeAnimationBindings();
    if (!model) return;

    const clips =
      model.userData[characterGltfAnimationClipsKey] as
        | THREE.AnimationClip[]
        | undefined;
    if (!Array.isArray(clips) || clips.length === 0) {
      return;
    }

    const mixer = new THREE.AnimationMixer(model);
    runtimeAnimationModel = model;
    runtimeAnimationMixer = mixer;
    runtimeAnimationClips = clips;
    const walkClip = resolveClip(clips, walkClipName);
    const runClip = resolveClip(clips, runClipName);
    const holdClip = resolveClip(clips, holdClipName);
    const normalAttackClip = resolveClip(clips, normalAttackClipName);
    const skillEHoldClip = resolveClip(clips, skillEHoldClipName);
    const skillEShootClip = resolveClip(clips, skillEShootClipName);
    const skillESuperHoldClip = resolveClip(clips, skillESuperHoldClipName);
    const skillESuperShootClip = resolveClip(clips, skillESuperShootClipName);
    const skillQClip = resolveClip(clips, skillQClipName);
    const skillQBeforeClip = resolveClip(clips, skillQBeforeClipName) ?? skillQClip;
    const skillQAfterClip = resolveClip(clips, skillQAfterClipName) ?? skillQClip;
    const skillRClip = resolveClip(clips, skillRClipName);
    runtimeWalkBinding = createLoopBinding(
      mixer,
      walkClip,
      walkClipName
    );
    runtimeRunBinding = createLoopBinding(
      mixer,
      runClip,
      runClipName
    );
    runtimeWalkNoRightArmBinding = createLoopBinding(
      mixer,
      filterClipTracks(walkClip, (track) => !isRightArmOrWeaponTrack(track.name)),
      `${walkClipName}-no-right-arm`
    );
    runtimeRunNoRightArmBinding = createLoopBinding(
      mixer,
      filterClipTracks(runClip, (track) => !isRightArmOrWeaponTrack(track.name)),
      `${runClipName}-no-right-arm`
    );
    runtimeWalkNoLeftArmBinding = createLoopBinding(
      mixer,
      filterClipTracks(walkClip, (track) => !isLeftArmOrWeaponTrack(track.name)),
      `${walkClipName}-no-left-arm`
    );
    runtimeRunNoLeftArmBinding = createLoopBinding(
      mixer,
      filterClipTracks(runClip, (track) => !isLeftArmOrWeaponTrack(track.name)),
      `${runClipName}-no-left-arm`
    );
    runtimeHoldBinding = createLoopBinding(
      mixer,
      holdClip,
      holdClipName
    );
    runtimeHoldRightArmBinding = createLoopBinding(
      mixer,
      filterClipTracks(holdClip, (track) => isRightArmOrWeaponTrack(track.name)),
      `${holdClipName}-right-arm`
    );
    runtimeSkillEHoldBinding = createLoopBinding(
      mixer,
      filterClipTracks(skillEHoldClip, (track) =>
        isLeftArmOrWeaponTrack(track.name)
      ),
      `${skillEHoldClipName}-left-arm`
    );
    runtimeSkillESuperHoldBinding = createLoopBinding(
      mixer,
      filterClipTracks(skillESuperHoldClip, (track) =>
        isRightArmOrWeaponTrack(track.name)
      ),
      `${skillESuperHoldClipName}-right-arm`
    );
    runtimeSkillEShootBinding = createOneShotBinding(
      mixer,
      filterClipTracks(skillEShootClip, (track) =>
        isLeftArmOrWeaponTrack(track.name)
      ),
      `${skillEShootClipName}-left-arm`
    );
    runtimeSkillESuperShootBinding = createOneShotBinding(
      mixer,
      filterClipTracks(skillESuperShootClip, (track) =>
        isRightArmOrWeaponTrack(track.name)
      ),
      `${skillESuperShootClipName}-right-arm`
    );
    runtimeNormalAttackBinding = createOneShotBinding(
      mixer,
      normalAttackClip,
      normalAttackClipName
    );
    runtimeNormalAttackRightArmBinding = createOneShotBinding(
      mixer,
      filterClipTracks(normalAttackClip, (track) =>
        isRightArmOrWeaponTrack(track.name)
      ),
      `${normalAttackClipName}-right-arm`
    );
    runtimeSkillQBinding = createOneShotBinding(
      mixer,
      skillQClip,
      skillQClipName
    );
    runtimeSkillQBeforeBinding = createOneShotBinding(
      mixer,
      skillQBeforeClip,
      skillQBeforeClipName
    );
    runtimeSkillQAfterBinding = createOneShotBinding(
      mixer,
      skillQAfterClip,
      skillQAfterClipName
    );
    runtimeSkillQTiming = resolveSkillQTiming(skillQClip);
    runtimeSkillRBinding = createOneShotBinding(
      mixer,
      skillRClip,
      skillRClipName
    );
    runtimeSkillRSlashEvents = resolveSkillRSlashEvents(skillRClip);

    runtimeWeaponConstraintHand = resolveRightHandNode(model);
    runtimeWeaponConstraintWeapon = resolveWeaponNode(model);
    runtimeWeaponConstraintOffsetReady = false;
    runtimePreferredGripOffsetReady = false;
    runtimeWeaponConstraintHandToWeapon.identity();
    runtimePreferredGripHandToWeapon.identity();
    clearRuntimeWeaponFirstPersonProxies();
    const weaponProxyEntries = createWeaponFirstPersonProxyEntries(
      model,
      runtimeWeaponConstraintWeapon
    );
    for (let i = 0; i < weaponProxyEntries.length; i += 1) {
      runtimeWeaponFirstPersonProxyEntries.push(weaponProxyEntries[i]);
    }
  };

  const applyLoopBindingState = (
    binding: ActionBinding | null,
    active: boolean,
    timeScale: number
  ) => {
    if (!binding) return;
    const action = binding.action;
    if (active) {
      action.enabled = true;
      action.paused = false;
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(timeScale);
      if (!action.isRunning()) {
        action.play();
      }
      return;
    }
    action.setEffectiveWeight(0);
    action.paused = true;
  };

  const applyOneShotBindingState = (
    binding: ActionBinding | null,
    active: boolean
  ) => {
    if (!binding) return;
    const action = binding.action;
    action.setEffectiveWeight(active ? 1 : 0);
    action.paused = !active;
    if (active) {
      action.enabled = true;
      if (!action.isRunning() && action.time <= 0.0001) {
        action.play();
      }
    }
  };

  const startSkillEShootAnimation = (now: number, superMode: boolean) => {
    const preferred = superMode
      ? runtimeSkillESuperShootBinding ?? runtimeSkillEShootBinding
      : runtimeSkillEShootBinding ?? runtimeSkillESuperShootBinding;
    if (!preferred) {
      runtimeSkillEShootEndsAt = 0;
      runtimeSkillEShootSuper = false;
      return;
    }
    runtimeSkillEShootSuper = preferred === runtimeSkillESuperShootBinding;
    runtimeSkillEShootEndsAt =
      now + Math.max(120, preferred.clip.duration * 1000);
    const action = preferred.action;
    action.reset();
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    action.play();
  };

  const createCloneAnimationState = (
    model: THREE.Object3D | null,
    clips: THREE.AnimationClip[]
  ): CloneAnimationState | null => {
    if (!model || clips.length === 0) return null;
    const mixer = new THREE.AnimationMixer(model);
    const walkClip = resolveClip(clips, walkClipName);
    const runClip = resolveClip(clips, runClipName);
    const skillEHoldClip = resolveClip(clips, skillEHoldClipName);
    const skillESuperHoldClip = resolveClip(clips, skillESuperHoldClipName);
    const skillEShootClip = resolveClip(clips, skillEShootClipName);
    const skillESuperShootClip = resolveClip(clips, skillESuperShootClipName);
    const skillQClip = resolveClip(clips, skillQClipName);
    const skillQBeforeClip = resolveClip(clips, skillQBeforeClipName) ?? skillQClip;
    const skillQAfterClip = resolveClip(clips, skillQAfterClipName) ?? skillQClip;
    return {
      mixer,
      walkBinding: createLoopBinding(mixer, walkClip, `clone-${walkClipName}`),
      runBinding: createLoopBinding(mixer, runClip, `clone-${runClipName}`),
      skillEHoldBinding: createLoopBinding(
        mixer,
        filterClipTracks(skillEHoldClip, (track) =>
          isLeftArmOrWeaponTrack(track.name)
        ),
        `clone-${skillEHoldClipName}`
      ),
      skillESuperHoldBinding: createLoopBinding(
        mixer,
        filterClipTracks(skillESuperHoldClip, (track) =>
          isRightArmOrWeaponTrack(track.name)
        ),
        `clone-${skillESuperHoldClipName}`
      ),
      skillEShootBinding: createOneShotBinding(
        mixer,
        filterClipTracks(skillEShootClip, (track) =>
          isLeftArmOrWeaponTrack(track.name)
        ),
        `clone-${skillEShootClipName}`
      ),
      skillESuperShootBinding: createOneShotBinding(
        mixer,
        filterClipTracks(skillESuperShootClip, (track) =>
          isRightArmOrWeaponTrack(track.name)
        ),
        `clone-${skillESuperShootClipName}`
      ),
      skillQBeforeBinding: createOneShotBinding(
        mixer,
        skillQBeforeClip,
        `clone-${skillQBeforeClipName}`
      ),
      skillQAfterBinding: createOneShotBinding(
        mixer,
        skillQAfterClip,
        `clone-${skillQAfterClipName}`
      ),
      shootEndsAt: 0,
      shootSuper: false,
    };
  };

  const disposeCloneAnimationState = (clone: BaronClone) => {
    const state = clone.animation;
    if (!state) return;
    stopActionBinding(state.walkBinding);
    stopActionBinding(state.runBinding);
    stopActionBinding(state.skillEHoldBinding);
    stopActionBinding(state.skillESuperHoldBinding);
    stopActionBinding(state.skillEShootBinding);
    stopActionBinding(state.skillESuperShootBinding);
    stopActionBinding(state.skillQBeforeBinding);
    stopActionBinding(state.skillQAfterBinding);
    state.mixer.stopAllAction();
    state.mixer.uncacheRoot(clone.model ?? clone.root);
    clone.animation = null;
  };

  const playOneShotBinding = (binding: ActionBinding | null, timeScale = 1) => {
    if (!binding) return;
    const action = binding.action;
    action.reset();
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(timeScale);
    action.play();
  };

  const startCloneSkillEShootAnimation = (
    clone: BaronClone,
    now: number,
    superMode: boolean
  ) => {
    const state = clone.animation;
    if (!state) return;
    const preferred = superMode
      ? state.skillESuperShootBinding ?? state.skillEShootBinding
      : state.skillEShootBinding ?? state.skillESuperShootBinding;
    if (!preferred) {
      state.shootEndsAt = 0;
      state.shootSuper = false;
      return;
    }
    state.shootSuper = preferred === state.skillESuperShootBinding;
    state.shootEndsAt = now + Math.max(120, preferred.clip.duration * 1000);
    playOneShotBinding(preferred);
  };

  const clearCloneLocomotionAndShurikenLayers = (state: CloneAnimationState) => {
    state.shootEndsAt = 0;
    state.shootSuper = false;
    stopActionBinding(state.walkBinding);
    stopActionBinding(state.runBinding);
    stopActionBinding(state.skillEHoldBinding);
    stopActionBinding(state.skillESuperHoldBinding);
    stopActionBinding(state.skillEShootBinding);
    stopActionBinding(state.skillESuperShootBinding);
  };

  const startCloneSkillQBeforeAnimation = (clone: BaronClone) => {
    const state = clone.animation;
    if (!state) return;
    clearCloneLocomotionAndShurikenLayers(state);
    stopActionBinding(state.skillQAfterBinding);
    playOneShotBinding(state.skillQBeforeBinding);
  };

  const startCloneSkillQAfterAnimation = (clone: BaronClone) => {
    const state = clone.animation;
    if (!state) return;
    clearCloneLocomotionAndShurikenLayers(state);
    stopActionBinding(state.skillQBeforeBinding);
    playOneShotBinding(state.skillQAfterBinding);
  };

  const updateCloneAnimationState = (
    clone: BaronClone,
    now: number,
    deltaSeconds: number,
    isMoving: boolean,
    isSprinting: boolean,
    eHoldActive: boolean,
    superMode: boolean
  ) => {
    const state = clone.animation;
    if (!state) return;
    const shootActive = state.shootEndsAt > now;
    const holdActive = eHoldActive && !shootActive && !isMoving;
    const runActive = isMoving && isSprinting;
    const walkActive = isMoving && !isSprinting;
    const regularHoldActive = holdActive && !superMode;
    const superHoldActive = holdActive && superMode;
    const regularShootActive = shootActive && !state.shootSuper;
    const superShootActive = shootActive && state.shootSuper;

    applyLoopBindingState(state.runBinding, runActive, 1);
    applyLoopBindingState(state.walkBinding, walkActive, 1);
    applyLoopBindingState(state.skillEHoldBinding, regularHoldActive, 1);
    applyLoopBindingState(state.skillESuperHoldBinding, superHoldActive, 1);
    applyOneShotBindingState(state.skillEShootBinding, regularShootActive);
    applyOneShotBindingState(state.skillESuperShootBinding, superShootActive);
    state.mixer.update(deltaSeconds);
  };

  const startPrimaryNormalAttackAnimation = (
    now: number,
    rightArmOnly: boolean
  ) => {
    const binding = rightArmOnly
      ? runtimeNormalAttackRightArmBinding ?? runtimeNormalAttackBinding
      : runtimeNormalAttackBinding ?? runtimeNormalAttackRightArmBinding;
    if (!binding) return;
    const action = binding.action;
    runtimeNormalAttackEndsAt = now + Math.max(120, binding.clip.duration * 1000);
    action.reset();
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    action.play();
  };

  const startSkillQAnimation = () => {
    playOneShotBinding(runtimeSkillQBinding);
  };

  const startSkillQBeforeAnimation = () => {
    playOneShotBinding(runtimeSkillQBeforeBinding ?? runtimeSkillQBinding);
  };

  const startSkillQAfterAnimation = () => {
    playOneShotBinding(runtimeSkillQAfterBinding ?? runtimeSkillQBinding);
  };

  const startSkillRAnimation = () => {
    playOneShotBinding(runtimeSkillRBinding);
  };

  const resolveRuntimeSkillRDurationMs = () => {
    if (!runtimeSkillRBinding) return skillRConfig.durationMs;
    return Math.max(240, runtimeSkillRBinding.clip.duration * 1000);
  };

  const resolveRuntimeSkillQDurationMs = () =>
    Math.max(
      240,
      runtimeSkillQBinding
        ? runtimeSkillQBinding.clip.duration * 1000
        : runtimeSkillQTiming.durationSec * 1000
    );

  const resolveRuntimeSkillQBeforeDurationMs = () =>
    Math.max(
      240,
      runtimeSkillQBeforeBinding
        ? runtimeSkillQBeforeBinding.clip.duration * 1000
        : resolveRuntimeSkillQDurationMs()
    );

  const resolveRuntimeSkillQAfterDurationMs = () =>
    Math.max(
      240,
      runtimeSkillQAfterBinding
        ? runtimeSkillQAfterBinding.clip.duration * 1000
        : resolveRuntimeSkillQDurationMs() * 0.64
    );

  const applyWeaponGripConstraint = (active: boolean) => {
    if (!active) {
      runtimeWeaponConstraintOffsetReady = false;
      runtimeWeaponConstraintHandToWeapon.identity();
      return;
    }
    if (
      !runtimeAnimationModel ||
      !runtimeWeaponConstraintHand ||
      !runtimeWeaponConstraintWeapon
    ) {
      return;
    }
    const weaponParent = runtimeWeaponConstraintWeapon.parent;
    if (!weaponParent) return;

    runtimeAnimationModel.updateMatrixWorld(true);
    if (!runtimeWeaponConstraintOffsetReady) {
      if (runtimePreferredGripOffsetReady) {
        runtimeWeaponConstraintHandToWeapon.copy(runtimePreferredGripHandToWeapon);
      } else {
        runtimeWeaponConstraintHandWorld
          .copy(runtimeWeaponConstraintHand.matrixWorld)
          .invert();
        runtimeWeaponConstraintHandToWeapon.multiplyMatrices(
          runtimeWeaponConstraintHandWorld,
          runtimeWeaponConstraintWeapon.matrixWorld
        );
      }
      runtimeWeaponConstraintOffsetReady = true;
    }
    runtimeWeaponConstraintHandWorld.copy(runtimeWeaponConstraintHand.matrixWorld);
    runtimeWeaponConstraintTargetWorld.multiplyMatrices(
      runtimeWeaponConstraintHandWorld,
      runtimeWeaponConstraintHandToWeapon
    );
    runtimeWeaponConstraintParentInverse.copy(weaponParent.matrixWorld).invert();
    runtimeWeaponConstraintLocal.multiplyMatrices(
      runtimeWeaponConstraintParentInverse,
      runtimeWeaponConstraintTargetWorld
    );
    runtimeWeaponConstraintLocal.decompose(
      runtimeWeaponConstraintLocalPosition,
      runtimeWeaponConstraintLocalQuaternion,
      runtimeWeaponConstraintLocalScale
    );
    runtimeWeaponConstraintWeapon.position.copy(runtimeWeaponConstraintLocalPosition);
    runtimeWeaponConstraintWeapon.quaternion.copy(
      runtimeWeaponConstraintLocalQuaternion
    );
  };

  const capturePreferredGripOffset = (active: boolean) => {
    if (
      !active ||
      !runtimeAnimationModel ||
      !runtimeWeaponConstraintHand ||
      !runtimeWeaponConstraintWeapon
    ) {
      return;
    }
    runtimeAnimationModel.updateMatrixWorld(true);
    runtimeWeaponConstraintHandWorld
      .copy(runtimeWeaponConstraintHand.matrixWorld)
      .invert();
    runtimePreferredGripHandToWeapon.multiplyMatrices(
      runtimeWeaponConstraintHandWorld,
      runtimeWeaponConstraintWeapon.matrixWorld
    );
    runtimePreferredGripOffsetReady = true;
  };

  const updateRuntimeAnimationState = ({
    now,
    deltaSeconds,
    isMoving,
    isSprinting,
  }: {
    now: number;
    deltaSeconds: number;
    isMoving: boolean;
    isSprinting: boolean;
  }) => {
    syncRuntimeWeaponFirstPersonProxies();
    if (!runtimeAnimationMixer) return;

    if (runtimeSkillQBinding) {
      const action = runtimeSkillQBinding.action;
      const skillQAnimationActive = skillQState.active;
      action.setEffectiveWeight(skillQAnimationActive ? 1 : 0);
      action.paused = !skillQAnimationActive;
      if (skillQAnimationActive) {
        action.enabled = true;
        if (!action.isRunning() && action.time <= 0.0001) {
          action.play();
        }
      }
    }

    if (runtimeSkillRBinding) {
      const action = runtimeSkillRBinding.action;
      const skillRAnimationActive = skillRState.active;
      action.setEffectiveWeight(skillRAnimationActive ? 1 : 0);
      action.paused = !skillRAnimationActive;
      if (skillRAnimationActive) {
        action.enabled = true;
        // If model binding becomes ready after R already started, kick off the clip once.
        if (!action.isRunning() && action.time <= 0.0001) {
          action.play();
        }
      }
    }

    const cloneBuffActive = isCloneShurikenBuffActive();
    const eShootActive = runtimeSkillEShootEndsAt > now;
    const eUseSuper = cloneBuffActive;
    const eHoldActive = skillEChargeState.isCharging && !eShootActive;
    const regularEHoldActive = eHoldActive && !eUseSuper;
    const superEHoldActive = eHoldActive && eUseSuper;
    const regularEShootActive = eShootActive && !runtimeSkillEShootSuper;
    const superEShootActive = eShootActive && runtimeSkillEShootSuper;
    let eActiveArmSide: "left" | "right" | null = null;
    if (eShootActive) {
      eActiveArmSide = runtimeSkillEShootSuper ? "right" : "left";
    } else if (eHoldActive) {
      eActiveArmSide = eUseSuper ? "right" : "left";
    }
    applyLoopBindingState(runtimeSkillEHoldBinding, regularEHoldActive, 1);
    applyLoopBindingState(runtimeSkillESuperHoldBinding, superEHoldActive, 1);
    applyOneShotBindingState(runtimeSkillEShootBinding, regularEShootActive);
    applyOneShotBindingState(runtimeSkillESuperShootBinding, superEShootActive);

    const holdActive = chargeState.isCharging;
    const skillPoseActive =
      skillQState.active || skillQSuperState.active || skillRState.active;
    const skillPoseBlocksLocomotion = skillQSuperState.active || skillRState.active;
    const normalAttackActive = runtimeNormalAttackEndsAt > now;
    const stationaryChargeState = holdActive && !isMoving && !skillPoseActive;
    const movingChargeState = holdActive && isMoving && !skillPoseActive;

    const useRightArmOnlyPrimary = isMoving && !skillPoseActive;
    const useRightArmHoldOnly =
      movingChargeState && Boolean(runtimeHoldRightArmBinding);
    const useRightArmAttackOnly =
      useRightArmOnlyPrimary && Boolean(runtimeNormalAttackRightArmBinding);
    const fullBodyNormalAttackActive =
      normalAttackActive && !useRightArmAttackOnly;
    const rightArmNormalAttackActive =
      normalAttackActive && useRightArmAttackOnly;
    if (runtimeNormalAttackBinding) {
      runtimeNormalAttackBinding.action.setEffectiveWeight(
        fullBodyNormalAttackActive ? 1 : 0
      );
      runtimeNormalAttackBinding.action.paused = !fullBodyNormalAttackActive;
      if (fullBodyNormalAttackActive) {
        runtimeNormalAttackBinding.action.enabled = true;
      }
    }
    if (runtimeNormalAttackRightArmBinding) {
      runtimeNormalAttackRightArmBinding.action.setEffectiveWeight(
        rightArmNormalAttackActive ? 1 : 0
      );
      runtimeNormalAttackRightArmBinding.action.paused = !rightArmNormalAttackActive;
      if (rightArmNormalAttackActive) {
        runtimeNormalAttackRightArmBinding.action.enabled = true;
      }
    }

    const blockLocomotion =
      skillPoseBlocksLocomotion || (!isMoving && (holdActive || normalAttackActive));
    const forceWalkOnly =
      skillQState.active && !skillQSuperState.active && !skillRState.active;
    const runActive = !blockLocomotion && !forceWalkOnly && isMoving && isSprinting;
    const walkActive = !blockLocomotion && isMoving && (!isSprinting || forceWalkOnly);
    const fullBodyHoldActive =
      holdActive && !normalAttackActive && !useRightArmHoldOnly;
    const rightArmHoldActive =
      holdActive && !normalAttackActive && useRightArmHoldOnly;
    const rightArmMaskedLocomotionActive =
      movingChargeState || (eActiveArmSide === "right" && isMoving);
    const leftArmMaskedLocomotionActive = eActiveArmSide === "left" && isMoving;
    const keepRightHandLocked = movingChargeState;
    const runUseNoRightArm =
      rightArmMaskedLocomotionActive &&
      runActive &&
      Boolean(runtimeRunNoRightArmBinding);
    const walkUseNoRightArm =
      rightArmMaskedLocomotionActive &&
      walkActive &&
      Boolean(runtimeWalkNoRightArmBinding);
    const runUseNoLeftArm =
      leftArmMaskedLocomotionActive &&
      runActive &&
      Boolean(runtimeRunNoLeftArmBinding);
    const walkUseNoLeftArm =
      leftArmMaskedLocomotionActive &&
      walkActive &&
      Boolean(runtimeWalkNoLeftArmBinding);
    applyLoopBindingState(
      runtimeRunBinding,
      runActive && !runUseNoRightArm && !runUseNoLeftArm,
      1
    );
    applyLoopBindingState(
      runtimeWalkBinding,
      walkActive && !walkUseNoRightArm && !walkUseNoLeftArm,
      1
    );
    applyLoopBindingState(runtimeRunNoRightArmBinding, runUseNoRightArm, 1);
    applyLoopBindingState(runtimeWalkNoRightArmBinding, walkUseNoRightArm, 1);
    applyLoopBindingState(runtimeRunNoLeftArmBinding, runUseNoLeftArm, 1);
    applyLoopBindingState(runtimeWalkNoLeftArmBinding, walkUseNoLeftArm, 1);
    applyLoopBindingState(runtimeHoldBinding, fullBodyHoldActive, 1);
    applyLoopBindingState(runtimeHoldRightArmBinding, rightArmHoldActive, 1);

    runtimeAnimationMixer.update(deltaSeconds);
    capturePreferredGripOffset(stationaryChargeState);
    applyWeaponGripConstraint(keepRightHandLocked);
  };

  const isCloneShurikenBuffActive = () =>
    cloneState.active && !cloneState.consumePending && cloneState.clones.length > 0;

  const createCloneChargeFx = (
    materials: THREE.Material[],
    geometries: THREE.BufferGeometry[]
  ) => {
    const group = new THREE.Group();
    group.visible = false;

    const coreGeometry = new THREE.OctahedronGeometry(0.09, 0);
    geometries.push(coreGeometry);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materials.push(coreMaterial);
    const core = new THREE.Mesh(coreGeometry, coreMaterial);

    const ringGeometry = new THREE.TorusGeometry(0.16, 0.012, 8, 28);
    geometries.push(ringGeometry);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materials.push(ringMaterial);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI * 0.5;

    group.add(core, ring);
    return group;
  };

  const createCloneHeldShurikenFx = (
    materials: THREE.Material[],
    geometries: THREE.BufferGeometry[]
  ): CloneHeldShurikenFx => {
    const group = new THREE.Group();
    group.visible = false;

    const bladeGeometry = createShurikenGeometry();
    geometries.push(bladeGeometry);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.24,
      metalness: 0.5,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
      side: THREE.DoubleSide,
    });
    materials.push(bladeMaterial);
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.castShadow = false;
    blade.receiveShadow = false;

    const auraGeometry = new THREE.RingGeometry(0.12, 0.22, 24);
    geometries.push(auraGeometry);
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    materials.push(auraMaterial);
    const aura = new THREE.Mesh(auraGeometry, auraMaterial);
    aura.position.z = -0.015;

    group.add(blade, aura);
    group.scale.setScalar(0.52);
    group.position.set(0.04, -0.95, 0.18);
    group.rotation.set(Math.PI * 0.52, 0.2, Math.PI * 0.22);

    return {
      group,
      blade,
      aura,
      bladeMaterial,
      auraMaterial,
    };
  };

  const resolveCloneLegBones = (model: THREE.Object3D | null) => {
    let legLeft: THREE.Object3D | null = null;
    let legRight: THREE.Object3D | null = null;
    if (!model) {
      return { legLeft, legRight };
    }

    const scoreLegCandidate = (
      leg: THREE.Object3D,
      side: "left" | "right"
    ) => {
      const name = (leg.name || "").toLowerCase();
      let score = 0;
      if (name.includes(side)) score += 10;
      if (name.includes("leg")) score += 6;
      if (name.includes("thigh") || name.includes("upper")) score += 4;
      if (name.includes("hip")) score += 1;
      if (
        name.includes("lower") ||
        name.includes("calf") ||
        name.includes("knee") ||
        name.includes("foot") ||
        name.includes("toe") ||
        name.includes("ankle") ||
        name.includes("end")
      ) {
        score -= 8;
      }
      if (name === `leg${side}` || name === `${side}leg`) score += 6;
      return score;
    };

    const leftCandidates: THREE.Object3D[] = [];
    const rightCandidates: THREE.Object3D[] = [];
    model.traverse((child: THREE.Object3D) => {
      const name = (child.name || "").toLowerCase();
      if (!name.includes("leg") && !name.includes("thigh")) return;
      if (name.includes("left")) leftCandidates.push(child);
      if (name.includes("right")) rightCandidates.push(child);
    });

    const pickBestLeg = (
      candidates: THREE.Object3D[],
      side: "left" | "right"
    ) => {
      let best: THREE.Object3D | null = null;
      let bestScore = -Infinity;
      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const score = scoreLegCandidate(candidate, side);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      return best;
    };

    legLeft = pickBestLeg(leftCandidates, "left");
    legRight = pickBestLeg(rightCandidates, "right");

    return { legLeft, legRight };
  };

  const resolveCloneThrowArm = (model: THREE.Object3D | null) => {
    if (!model) return null;
    const arms: THREE.Object3D[] = [];
    model.traverse((child: THREE.Object3D) => {
      const name = (child.name || "").toLowerCase();
      if (name.includes("arm") || name.includes("hand")) {
        arms.push(child);
      }
    });
    if (!arms.length) return null;
    const leftArm = pickArm(arms, "left") ?? arms[0];
    return (
      pickArm(
        arms.filter((arm) => arm !== leftArm),
        "right"
      ) ??
      arms.find((arm) => arm !== leftArm) ??
      leftArm
    );
  };

  const clearCloneSmoke = () => {
    for (let i = 0; i < cloneSmokePuffs.length; i += 1) {
      const puff = cloneSmokePuffs[i];
      puff.mesh.removeFromParent();
      puff.material.dispose();
    }
    cloneSmokePuffs.length = 0;
  };

  const spawnCloneSmokeBurst = (origin: THREE.Vector3, amount: number) => {
    const host = avatar.parent ?? avatar;
    for (let i = 0; i < amount; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x9ca3af,
        transparent: true,
        opacity: 0.54 + Math.random() * 0.18,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(cloneSmokeGeometry, material);
      const baseScale = THREE.MathUtils.lerp(0.45, 1.1, Math.random());
      mesh.scale.setScalar(baseScale);
      mesh.position
        .copy(origin)
        .add(
          cloneSmokeScratch.set(
            THREE.MathUtils.randFloatSpread(0.9),
            THREE.MathUtils.randFloat(0.25, 1.35),
            THREE.MathUtils.randFloatSpread(0.9)
          )
        );
      mesh.renderOrder = 5;
      host.add(mesh);
      cloneSmokePuffs.push({
        mesh,
        material,
        velocity: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(1.1),
          THREE.MathUtils.lerp(0.8, 2.2, Math.random()),
          THREE.MathUtils.randFloatSpread(1.1)
        ),
        life: 0,
        maxLife: THREE.MathUtils.lerp(0.5, 1.1, Math.random()),
        spin: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(2),
          THREE.MathUtils.randFloatSpread(2),
          THREE.MathUtils.randFloatSpread(2)
        ),
        baseScale,
      });
    }
  };

  const updateCloneSmoke = (deltaSeconds: number) => {
    for (let i = cloneSmokePuffs.length - 1; i >= 0; i -= 1) {
      const puff = cloneSmokePuffs[i];
      puff.life += deltaSeconds;
      if (puff.life >= puff.maxLife) {
        puff.mesh.removeFromParent();
        puff.material.dispose();
        cloneSmokePuffs.splice(i, 1);
        continue;
      }
      const lifeRatio = THREE.MathUtils.clamp(puff.life / puff.maxLife, 0, 1);
      puff.velocity.multiplyScalar(1 - deltaSeconds * 0.9);
      puff.velocity.y += deltaSeconds * 0.32;
      puff.mesh.position.addScaledVector(puff.velocity, deltaSeconds);
      puff.mesh.rotation.x += puff.spin.x * deltaSeconds;
      puff.mesh.rotation.y += puff.spin.y * deltaSeconds;
      puff.mesh.rotation.z += puff.spin.z * deltaSeconds;
      puff.mesh.scale.setScalar(puff.baseScale * (1 + lifeRatio * 0.85));
      puff.material.opacity = THREE.MathUtils.lerp(0.62, 0, lifeRatio);
    }
  };

  const buildCloneModel = (
    avatarModel: THREE.Object3D | null,
    materials: THREE.Material[],
    geometries: THREE.BufferGeometry[]
  ) => {
    if (avatarModel) {
      const cloned = skeletonClone(avatarModel);
      cloned.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Always render clone parts on main camera layer so head is visible.
        mesh.layers.set(0);
        const source = mesh.material;
        if (Array.isArray(source)) {
          const nextMaterials = source.map((mat) => {
            const next = mat.clone();
            materials.push(next);
            return next;
          });
          mesh.material = nextMaterials;
        } else if (source) {
          const next = source.clone();
          mesh.material = next;
          materials.push(next);
        }
      });
      return cloned;
    }

    const fallbackGeometry = new THREE.CapsuleGeometry(0.3, 1.0, 4, 10);
    geometries.push(fallbackGeometry);
    const fallbackMaterial = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.45,
      roughness: 0.34,
      metalness: 0.18,
      transparent: true,
      opacity: 0.42,
    });
    materials.push(fallbackMaterial);
    const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
    fallbackMesh.position.y = 0.95;
    fallbackMesh.castShadow = false;
    fallbackMesh.receiveShadow = false;
    return fallbackMesh;
  };

  const resetCloneStateWhenEmpty = () => {
    if (cloneState.clones.length > 0) return;
    cloneState.active = false;
    cloneState.startedAt = 0;
    cloneState.endsAt = 0;
    cloneState.consumePending = false;
    cloneState.consumeAfterShootAt = 0;
  };

  const clearClone = (clone: BaronClone, spawnSmoke: boolean) => {
    clone.threatTarget.active = false;
    clone.threatTarget.health = 0;
    unregisterBaronCloneThreatTarget(clone.threatTarget.id);
    clone.hp = 0;
    if (spawnSmoke && clone.root.parent && clone.root.visible) {
      clone.root.updateMatrixWorld(true);
      clone.root.getWorldPosition(cloneScratchTemp);
      spawnCloneSmokeBurst(cloneScratchTemp, 6);
    }
    disposeCloneAnimationState(clone);
    clone.root.removeFromParent();
    for (let i = 0; i < clone.materials.length; i += 1) {
      clone.materials[i].dispose();
    }
    for (let i = 0; i < clone.geometries.length; i += 1) {
      clone.geometries[i].dispose();
    }
    clone.materials.length = 0;
    clone.geometries.length = 0;
  };

  const removeCloneFromState = (clone: BaronClone, spawnSmoke: boolean) => {
    clearClone(clone, spawnSmoke);
    const cloneIndex = cloneState.clones.indexOf(clone);
    if (cloneIndex >= 0) {
      cloneState.clones.splice(cloneIndex, 1);
    }
    resetCloneStateWhenEmpty();
  };

  const clearAllClones = (spawnSmoke: boolean = false) => {
    for (let i = 0; i < cloneState.clones.length; i += 1) {
      clearClone(cloneState.clones[i], spawnSmoke);
    }
    cloneState.clones.length = 0;
    resetCloneStateWhenEmpty();
  };

  const applyDamageToClone = (clone: BaronClone, amount: number) => {
    if (amount <= 0) return 0;
    if (!clone.root.parent || clone.hp <= 0 || !clone.threatTarget.active) return 0;
    const requested = Math.min(clone.hp, Math.max(0, amount));
    if (requested <= 0) return 0;
    const applied = applyDamageToBaronCloneThreatTarget(clone.threatTarget, requested);
    if (applied <= 0) return 0;
    clone.hp = Math.max(0, clone.hp - applied);
    if (clone.hp <= 0) {
      if (skillQSuperState.active) {
        clearClone(clone, true);
      } else {
        removeCloneFromState(clone, true);
      }
    }
    return applied;
  };

  const updateCloneDirection = (clone: BaronClone, now: number) => {
    if (now < clone.nextTurnAt) return;
    avatar.getWorldPosition(cloneScratchOrigin);
    cloneScratchDirection
      .copy(cloneScratchOrigin)
      .sub(clone.root.position);
    cloneScratchDirection.y = 0;
    const farFromCenter =
      cloneScratchDirection.lengthSq() >
      cloneConfig.wanderRadius * cloneConfig.wanderRadius;
    if (farFromCenter && cloneScratchDirection.lengthSq() > 0.000001) {
      cloneScratchDirection.normalize();
      cloneScratchDirection.x += THREE.MathUtils.randFloatSpread(0.8);
      cloneScratchDirection.z += THREE.MathUtils.randFloatSpread(0.8);
    } else {
      cloneScratchDirection.set(
        THREE.MathUtils.randFloatSpread(2),
        0,
        THREE.MathUtils.randFloatSpread(2)
      );
    }
    if (cloneScratchDirection.lengthSq() < 0.000001) {
      cloneScratchDirection.set(0, 0, 1);
    } else {
      cloneScratchDirection.normalize();
    }
    clone.direction.copy(cloneScratchDirection);
    clone.nextTurnAt =
      now +
      THREE.MathUtils.lerp(
        cloneConfig.minTurnIntervalMs,
        cloneConfig.maxTurnIntervalMs,
        Math.random()
      );
  };

  let runtimeAvatarModelRef: THREE.Object3D | null = null;
  const skillRShadowColor = new THREE.Color(0x030303);
  const skillRShadowMaterials: SkillRShadowMaterialState[] = [];
  let skillRShadowActive = false;
  let skillRShadowBlend = 0;
  const skillRShadowFadeInLambda = 16;
  const skillRShadowFadeOutLambda = 10;
  const skillRAfterImageConfig = {
    lifeMs: 420,
    baseOpacity: 0.72,
    scaleBoost: 0.06,
  };
  const skillRAfterImageTint = new THREE.Color(0x000000);
  const skillRAfterImages: SkillRAfterImage[] = [];
  const skillRAfterImageWorldPosition = new THREE.Vector3();
  const skillRAfterImageWorldQuaternion = new THREE.Quaternion();
  const skillRAfterImageWorldScale = new THREE.Vector3();
  const skillRAfterImageParentQuaternion = new THREE.Quaternion();
  const isColorMaterial = (
    material: THREE.Material
  ): material is THREE.Material & { color: THREE.Color } =>
    Boolean((material as THREE.Material & { color?: THREE.Color }).color?.isColor);
  const isEmissiveMaterial = (
    material: THREE.Material
  ): material is THREE.Material & {
    emissive: THREE.Color;
    emissiveIntensity: number;
  } =>
    Boolean(
      (
        material as THREE.Material & {
          emissive?: THREE.Color;
          emissiveIntensity?: number;
        }
      ).emissive?.isColor
    );

  const restoreSkillRShadowForm = () => {
    if (!skillRShadowMaterials.length) {
      skillRShadowActive = false;
      skillRShadowBlend = 0;
      return;
    }
    for (let i = 0; i < skillRShadowMaterials.length; i += 1) {
      const entry = skillRShadowMaterials[i];
      const material = entry.material;
      if (entry.color && isColorMaterial(material)) {
        material.color.copy(entry.color);
      }
      if (entry.emissive && isEmissiveMaterial(material)) {
        material.emissive.copy(entry.emissive);
        if (entry.emissiveIntensity !== null) {
          material.emissiveIntensity = entry.emissiveIntensity;
        }
      }
    }
    skillRShadowMaterials.length = 0;
    skillRShadowActive = false;
    skillRShadowBlend = 0;
  };

  const captureSkillRShadowMaterials = () => {
    if (skillRShadowActive || !runtimeAvatarModelRef) return;
    const visited = new Set<THREE.Material>();
    const captureMaterial = (material: THREE.Material) => {
      if (visited.has(material)) return;
      visited.add(material);
      const state: SkillRShadowMaterialState = {
        material,
        color: null,
        emissive: null,
        emissiveIntensity: null,
      };
      let changed = false;
      if (isColorMaterial(material)) {
        state.color = material.color.clone();
        changed = true;
      }
      if (isEmissiveMaterial(material)) {
        state.emissive = material.emissive.clone();
        state.emissiveIntensity = material.emissiveIntensity;
        changed = true;
      }
      if (!changed) return;
      skillRShadowMaterials.push(state);
    };

    runtimeAvatarModelRef.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        for (let i = 0; i < mesh.material.length; i += 1) {
          const material = mesh.material[i];
          if (!material) continue;
          captureMaterial(material);
        }
        return;
      }
      if (mesh.material) {
        captureMaterial(mesh.material);
      }
    });
    skillRShadowActive = skillRShadowMaterials.length > 0;
  };

  const applySkillRShadowBlend = (blend: number) => {
    const clampedBlend = THREE.MathUtils.clamp(blend, 0, 1);
    for (let i = 0; i < skillRShadowMaterials.length; i += 1) {
      const entry = skillRShadowMaterials[i];
      const material = entry.material;
      if (entry.color && isColorMaterial(material)) {
        material.color.copy(entry.color).lerp(skillRShadowColor, clampedBlend);
      }
      if (entry.emissive && isEmissiveMaterial(material)) {
        material.emissive.copy(entry.emissive).lerp(skillRShadowColor, clampedBlend);
        if (entry.emissiveIntensity !== null) {
          material.emissiveIntensity = THREE.MathUtils.lerp(
            entry.emissiveIntensity,
            0,
            clampedBlend
          );
        }
      }
    }
  };

  const updateSkillRShadowForm = (active: boolean, deltaSeconds: number) => {
    if (active) {
      captureSkillRShadowMaterials();
    }
    if (!skillRShadowActive && skillRShadowBlend <= 0.0001) return;

    skillRShadowBlend = THREE.MathUtils.damp(
      skillRShadowBlend,
      active ? 1 : 0,
      active ? skillRShadowFadeInLambda : skillRShadowFadeOutLambda,
      Math.max(0, deltaSeconds)
    );

    if (!active && skillRShadowBlend <= 0.001) {
      restoreSkillRShadowForm();
      return;
    }
    applySkillRShadowBlend(skillRShadowBlend);
  };

  const clearSkillRAfterImages = () => {
    for (let i = 0; i < skillRAfterImages.length; i += 1) {
      const entry = skillRAfterImages[i];
      entry.root.removeFromParent();
      for (let matIndex = 0; matIndex < entry.materials.length; matIndex += 1) {
        entry.materials[matIndex].dispose();
      }
    }
    skillRAfterImages.length = 0;
  };

  const spawnSkillRAfterImage = (
    now: number,
    options?: {
      sourceModel?: THREE.Object3D | null;
      lifeMs?: number;
      baseOpacity?: number;
      scaleBoost?: number;
      attachTo?: THREE.Object3D | null;
      preserveWorldTransform?: boolean;
    }
  ) => {
    const sourceModel = options?.sourceModel ?? runtimeAvatarModelRef;
    const snapshotParent = options?.attachTo ?? sourceModel?.parent ?? null;
    if (!sourceModel || !snapshotParent) return;
    const lifeMs = Math.max(80, options?.lifeMs ?? skillRAfterImageConfig.lifeMs);
    const baseOpacity = THREE.MathUtils.clamp(
      options?.baseOpacity ?? skillRAfterImageConfig.baseOpacity,
      0.08,
      1
    );
    const scaleBoost = options?.scaleBoost ?? skillRAfterImageConfig.scaleBoost;

    sourceModel.updateMatrixWorld(true);
    const sourceMeshLayerMasks: number[] = [];
    sourceModel.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      sourceMeshLayerMasks.push(mesh.layers.mask);
    });
    const snapshot = skeletonClone(sourceModel);
    const materials: THREE.Material[] = [];
    let meshLayerIndex = 0;
    snapshot.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = mesh.material;
      if (Array.isArray(source)) {
        const cloned = source.map((material) => {
          const next = material.clone();
          next.transparent = true;
          next.opacity = baseOpacity;
          next.depthWrite = false;
          next.blending = THREE.NormalBlending;
          if (isColorMaterial(next)) {
            next.color.copy(skillRAfterImageTint);
          }
          if (isEmissiveMaterial(next)) {
            next.emissive.copy(skillRAfterImageTint);
            next.emissiveIntensity = 0;
          }
          materials.push(next);
          return next;
        });
        mesh.material = cloned;
      } else if (source) {
        const next = source.clone();
        next.transparent = true;
        next.opacity = baseOpacity;
        next.depthWrite = false;
        next.blending = THREE.NormalBlending;
        if (isColorMaterial(next)) {
          next.color.copy(skillRAfterImageTint);
        }
        if (isEmissiveMaterial(next)) {
          next.emissive.copy(skillRAfterImageTint);
          next.emissiveIntensity = 0;
        }
        mesh.material = next;
        materials.push(next);
      }
      mesh.layers.mask = sourceMeshLayerMasks[meshLayerIndex] ?? mesh.layers.mask;
      meshLayerIndex += 1;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    if (options?.preserveWorldTransform) {
      sourceModel.getWorldPosition(skillRAfterImageWorldPosition);
      sourceModel.getWorldQuaternion(skillRAfterImageWorldQuaternion);
      sourceModel.getWorldScale(skillRAfterImageWorldScale);
      snapshotParent.updateMatrixWorld(true);
      snapshot.position.copy(skillRAfterImageWorldPosition);
      snapshotParent.worldToLocal(snapshot.position);
      snapshotParent
        .getWorldQuaternion(skillRAfterImageParentQuaternion)
        .invert();
      snapshot.quaternion
        .copy(skillRAfterImageParentQuaternion)
        .multiply(skillRAfterImageWorldQuaternion);
      snapshot.scale.copy(skillRAfterImageWorldScale).multiplyScalar(1 + scaleBoost);
    } else {
      snapshot.scale.multiplyScalar(1 + scaleBoost);
    }
    snapshotParent.add(snapshot);
    skillRAfterImages.push({
      root: snapshot,
      materials,
      spawnedAt: now,
      lifeMs,
      baseOpacity,
    });
  };

  const updateSkillRAfterImages = (now: number) => {
    for (let i = skillRAfterImages.length - 1; i >= 0; i -= 1) {
      const entry = skillRAfterImages[i];
      const progress = THREE.MathUtils.clamp(
        (now - entry.spawnedAt) / entry.lifeMs,
        0,
        1
      );
      const fade = 1 - THREE.MathUtils.smoothstep(progress, 0.15, 1);
      const opacity = entry.baseOpacity * fade;
      for (let matIndex = 0; matIndex < entry.materials.length; matIndex += 1) {
        const material = entry.materials[matIndex];
        material.transparent = true;
        material.opacity = opacity;
      }
      if (progress < 1) continue;
      entry.root.removeFromParent();
      for (let matIndex = 0; matIndex < entry.materials.length; matIndex += 1) {
        entry.materials[matIndex].dispose();
      }
      skillRAfterImages.splice(i, 1);
    }
  };

  const getSkillQSealGlyphTexture = (
    character: string,
    tone: "black" | "white"
  ) => {
    const textureKey = `${character}:${tone}`;
    const cached = skillQSealGlyphTextureCache.get(textureKey);
    if (cached) return cached;
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    const isBlackTone = tone === "black";
    context.shadowColor = isBlackTone
      ? "rgba(248,250,252,0.6)"
      : "rgba(15,23,42,0.7)";
    context.shadowBlur = 26;
    context.font =
      "900 168px 'Noto Serif SC','Source Han Serif SC','Microsoft YaHei','PingFang SC',serif";
    context.lineWidth = 20;
    context.strokeStyle = isBlackTone
      ? "rgba(248,250,252,0.98)"
      : "rgba(15,23,42,0.98)";
    context.strokeText(character, 128, 132);
    context.fillStyle = isBlackTone
      ? "rgba(15,23,42,1)"
      : "rgba(248,250,252,1)";
    context.fillText(character, 128, 132);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    skillQSealGlyphTextureCache.set(textureKey, texture);
    return texture;
  };

  const clearSkillQSealGlyphEntries = () => {
    for (let i = 0; i < skillQSealGlyphEntries.length; i += 1) {
      const entry = skillQSealGlyphEntries[i];
      entry.sprite.removeFromParent();
      entry.material.dispose();
    }
    skillQSealGlyphEntries.length = 0;
  };

  const disposeSkillQSealGlyphTextures = () => {
    for (const texture of skillQSealGlyphTextureCache.values()) {
      texture.dispose();
    }
    skillQSealGlyphTextureCache.clear();
  };

  const spawnSkillQSealGlyphBurst = (now: number) => {
    const shuffledCharacters = [...skillQSealGlyphChars].sort(
      () => Math.random() - 0.5
    );
    for (let i = 0; i < shuffledCharacters.length; i += 1) {
      const tone = i % 2 === 0 ? "black" : "white";
      const texture = getSkillQSealGlyphTexture(shuffledCharacters[i], tone);
      if (!texture) continue;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: true,
      });
      material.toneMapped = false;
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 12;
      const baseScale = THREE.MathUtils.lerp(
        skillQConfig.glyphScaleMin,
        skillQConfig.glyphScaleMax,
        Math.random()
      );
      sprite.scale.set(baseScale * 0.82, baseScale, 1);
      const lateralOffset = THREE.MathUtils.randFloatSpread(
        skillQConfig.glyphLateralSpread * 2
      );
      const heightOffset = THREE.MathUtils.lerp(
        skillQConfig.glyphHeightMin,
        skillQConfig.glyphHeightMax,
        Math.random()
      );
      const frontOffset = THREE.MathUtils.lerp(
        skillQConfig.glyphFrontMin,
        skillQConfig.glyphFrontMax,
        Math.random()
      );
      sprite.position.set(lateralOffset, heightOffset, frontOffset);
      avatar.add(sprite);
      skillQSealGlyphEntries.push({
        sprite,
        material,
        spawnedAt: now,
        lifeMs: skillQConfig.glyphLifeMs,
        baseScale,
        origin: sprite.position.clone(),
        drift: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(0.12) + lateralOffset * 0.08,
          THREE.MathUtils.lerp(0.18, 0.38, Math.random()),
          THREE.MathUtils.lerp(0.06, 0.18, Math.random())
        ),
      });
    }
  };

  const updateSkillQSealGlyphEntries = (now: number) => {
    for (let i = skillQSealGlyphEntries.length - 1; i >= 0; i -= 1) {
      const entry = skillQSealGlyphEntries[i];
      const progress = THREE.MathUtils.clamp(
        (now - entry.spawnedAt) / entry.lifeMs,
        0,
        1
      );
      if (progress >= 1) {
        entry.sprite.removeFromParent();
        entry.material.dispose();
        skillQSealGlyphEntries.splice(i, 1);
        continue;
      }
      const easedProgress = THREE.MathUtils.smoothstep(progress, 0, 1);
      entry.sprite.position
        .copy(entry.origin)
        .addScaledVector(entry.drift, easedProgress);
      const scale = entry.baseScale * (1 + easedProgress * 0.36);
      entry.sprite.scale.set(scale * 0.82, scale, 1);
      entry.material.opacity = Math.pow(1 - progress, 1.45);
    }
  };

  const spawnClones = (now: number) => {
    clearAllClones(true);
    const host = avatar.parent ?? avatar;
    if (cloneAnchor.parent !== host) {
      cloneAnchor.removeFromParent();
      host.add(cloneAnchor);
    }
    avatar.getWorldPosition(cloneScratchOrigin);
    const baseHealth =
      getCurrentStats?.().health ??
      profile.stats?.health ??
      100;

    for (let i = 0; i < cloneConfig.count; i += 1) {
      const materials: THREE.Material[] = [];
      const geometries: THREE.BufferGeometry[] = [];
      const root = new THREE.Group();
      root.name = `baron-clone-${i + 1}`;
      const rootUserData = root.userData as {
        switchActivator?: boolean;
        worldOnlyBlocker?: boolean;
      };
      rootUserData.switchActivator = true;
      rootUserData.worldOnlyBlocker = true;
      const angle = (Math.PI * 2 * i) / cloneConfig.count + Math.random() * 0.44;
      const radius = THREE.MathUtils.lerp(
        cloneConfig.spawnRadiusMin,
        cloneConfig.spawnRadiusMax,
        Math.random()
      );
      root.position
        .copy(cloneScratchOrigin)
        .add(
          new THREE.Vector3(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
          )
        );
      root.position.y = avatar.position.y;

      const model = buildCloneModel(runtimeAvatarModelRef, materials, geometries);
      root.add(model);
      const { legLeft, legRight } = resolveCloneLegBones(model);
      const throwArm = resolveCloneThrowArm(model);

      const chargeFx = createCloneChargeFx(materials, geometries);
      chargeFx.position.y = cloneConfig.chargeYOffset;
      root.add(chargeFx);
      const heldShuriken = createCloneHeldShurikenFx(materials, geometries);
      if (throwArm) {
        throwArm.add(heldShuriken.group);
      } else {
        root.add(heldShuriken.group);
        heldShuriken.group.position.set(0.24, cloneConfig.chargeYOffset - 0.24, 0.22);
      }

      cloneScratchDirection.set(
        THREE.MathUtils.randFloatSpread(2),
        0,
        THREE.MathUtils.randFloatSpread(2)
      );
      if (cloneScratchDirection.lengthSq() < 0.000001) {
        cloneScratchDirection.set(0, 0, 1);
      } else {
        cloneScratchDirection.normalize();
      }

      const cloneHp = Math.max(1, baseHealth * cloneConfig.hpRatio);
      const threatTarget = createBaronCloneThreatTarget({
        id: `baron-clone-threat-${++cloneThreatIdCounter}`,
        object: root,
        maxHealth: cloneHp,
        spawnedAt: now,
        lifetimeMs: cloneConfig.durationMs,
      });

      const clone: BaronClone = {
        root,
        model,
        chargeFx,
        heldShuriken,
        throwArm,
        throwArmBase: throwArm ? throwArm.quaternion.clone() : null,
        legLeft,
        legRight,
        walkPhase: Math.random() * Math.PI * 2,
        threatTarget,
        hp: cloneHp,
        speed: cloneBaseSpeed * THREE.MathUtils.lerp(0.85, 1.18, Math.random()),
        direction: cloneScratchDirection.clone(),
        nextTurnAt: now + THREE.MathUtils.lerp(300, 900, Math.random()),
        animation: createCloneAnimationState(model, runtimeAnimationClips),
        materials,
        geometries,
      };
      cloneAnchor.add(root);
      cloneState.clones.push(clone);
      registerBaronCloneThreatTarget(clone.threatTarget, (amount) =>
        applyDamageToClone(clone, amount)
      );
      spawnCloneSmokeBurst(root.position, 5);
    }

    cloneState.active = cloneState.clones.length > 0;
    cloneState.startedAt = now;
    cloneState.endsAt = now + cloneConfig.durationMs;
    cloneState.consumePending = false;
    cloneState.consumeAfterShootAt = 0;
    if (cloneState.active) {
      spawnCloneSmokeBurst(cloneScratchOrigin, 12);
    }
  };

  const updateClones = (
    now: number,
    deltaSeconds: number,
    eChargeActive: boolean,
    eChargeRatio: number,
    hostIsMoving: boolean,
    hostIsSprinting: boolean
  ) => {
    if (skillQSuperState.active) return;
    if (!cloneState.active) return;
    if (cloneState.consumePending && now >= cloneState.consumeAfterShootAt) {
      clearAllClones(true);
      return;
    }
    if (now >= cloneState.endsAt) {
      clearAllClones(true);
      return;
    }

    avatar.getWorldPosition(cloneScratchOrigin);
    const cloneGroundY = avatar.position.y;
    const preparingThrow = eChargeActive;
    if (preparingThrow) {
      resolveSkillEBaseDirection();
      const distanceScale = THREE.MathUtils.lerp(
        skillEChargeConfig.minDistanceScale,
        skillEChargeConfig.maxDistanceScale,
        eChargeRatio
      );
      cloneScratchTarget
        .copy(cloneScratchOrigin)
        .addScaledVector(cloneUp, cloneConfig.eThrowOriginYOffset)
        .addScaledVector(skillEBaseDirection, skillEConfig.focusDistance * distanceScale);
    }

    for (let i = 0; i < cloneState.clones.length; i += 1) {
      const clone = cloneState.clones[i];
      const mimicMovingDuringCharge = preparingThrow && hostIsMoving;
      const useChargeStance = preparingThrow && !mimicMovingDuringCharge;
      const isCloneMoving = cloneState.consumePending
        ? false
        : !preparingThrow || mimicMovingDuringCharge;
      if (isCloneMoving) {
        updateCloneDirection(clone, now);
        clone.root.position.addScaledVector(clone.direction, clone.speed * deltaSeconds);
      } else {
        cloneScratchDirection
          .copy(cloneScratchTarget)
          .sub(clone.root.position);
        cloneScratchDirection.y = 0;
        if (cloneScratchDirection.lengthSq() > 0.000001) {
          cloneScratchDirection.normalize();
          clone.direction.lerp(cloneScratchDirection, 0.45);
          if (clone.direction.lengthSq() > 0.000001) {
            clone.direction.normalize();
          } else {
            clone.direction.copy(cloneScratchDirection);
          }
        }
      }

      clone.root.position.y = cloneGroundY;
      const targetYaw = Math.atan2(clone.direction.x, clone.direction.z);
      clone.root.rotation.y = THREE.MathUtils.lerp(
        clone.root.rotation.y,
        targetYaw,
        useChargeStance ? 0.38 : 0.22
      );
      clone.chargeFx.visible = false;
      clone.heldShuriken.group.visible = false;

      updateCloneAnimationState(
        clone,
        now,
        deltaSeconds,
        isCloneMoving,
        isCloneMoving && hostIsSprinting,
        preparingThrow,
        true
      );
    }
  };

  const acquireSwordWave = () => {
    for (let i = 0; i < swordWavePool.length; i += 1) {
      const entry = swordWavePool[i];
      if (!entry.mesh.parent) return entry;
    }
    const entry = createSwordWaveEntry(swordWaveGeometry);
    swordWavePool.push(entry);
    return entry;
  };

  const acquireChargedSwordWave = () => {
    for (let i = 0; i < chargedSwordWavePool.length; i += 1) {
      const entry = chargedSwordWavePool[i];
      if (!entry.mesh.parent) return entry;
    }
    const entry = createChargedSwordWaveEntry(chargedSwordWaveGeometry);
    chargedSwordWavePool.push(entry);
    return entry;
  };

  const acquireShuriken = () => {
    for (let i = 0; i < shurikenPool.length; i += 1) {
      const entry = shurikenPool[i];
      if (!entry.mesh.parent) return entry;
    }
    const entry = createShurikenEntry(shurikenGeometry);
    shurikenPool.push(entry);
    return entry;
  };

  const clearSkillRDanceWaveEntry = (entry: SkillRDanceWaveEntry) => {
    entry.active = false;
    entry.launchedAt = 0;
    entry.maxLifeMs = skillRConfig.waveLifeMs;
    entry.speed = skillRConfig.waveMinSpeed;
    entry.side = 1;
    entry.spinRate = 7.2;
    entry.baseScale = 1;
    entry.origin.set(0, 0, 0);
    entry.direction.set(0, 0, 1);
    entry.right.set(1, 0, 0);
    entry.mesh.removeFromParent();
    entry.mesh.visible = false;
    entry.mesh.position.set(0, 0, 0);
    entry.mesh.rotation.set(0, 0, 0);
    entry.mesh.scale.setScalar(1);
    entry.material.opacity = 0.92;
    entry.material.emissiveIntensity = 0;
  };

  const acquireSkillRDanceWave = () => {
    for (let i = 0; i < skillRDanceWavePool.length; i += 1) {
      const entry = skillRDanceWavePool[i];
      if (!entry.active && !entry.mesh.parent) return entry;
    }
    for (let i = 0; i < skillRDanceWavePool.length; i += 1) {
      const entry = skillRDanceWavePool[i];
      if (!entry.active) return entry;
    }
    const entry = createSkillRDanceWaveEntry(skillRDanceWaveGeometry);
    skillRDanceWavePool.push(entry);
    return entry;
  };

  const clearSkillRDanceWaves = () => {
    for (let i = 0; i < skillRDanceWavePool.length; i += 1) {
      clearSkillRDanceWaveEntry(skillRDanceWavePool[i]);
    }
  };

  const launchSkillRDanceWave = (now: number) => {
    const entry = acquireSkillRDanceWave();
    clearSkillRDanceWaveEntry(entry);
    entry.active = true;
    entry.launchedAt = now;
    entry.maxLifeMs = skillRConfig.waveLifeMs;
    entry.speed = THREE.MathUtils.lerp(
      skillRConfig.waveMinSpeed,
      skillRConfig.waveMaxSpeed,
      Math.random()
    );
    entry.baseScale = THREE.MathUtils.lerp(
      skillRConfig.waveMinScale,
      skillRConfig.waveMaxScale,
      Math.random()
    );
    entry.side = skillRDanceWaveNextSide;
    skillRDanceWaveNextSide = (skillRDanceWaveNextSide * -1) as 1 | -1;
    entry.spinRate = THREE.MathUtils.lerp(5.8, 10.2, Math.random());

    avatar.updateMatrixWorld(true);
    avatar.getWorldPosition(skillRDanceWaveOrigin);
    avatar.getWorldQuaternion(skillRDanceWaveFacing);

    skillRDanceWaveDirection.set(0, 0, 1).applyQuaternion(skillRDanceWaveFacing);
    skillRDanceWaveDirection.y = 0;
    if (skillRDanceWaveDirection.lengthSq() < 0.000001) {
      skillRDanceWaveDirection.set(0, 0, 1);
    } else {
      skillRDanceWaveDirection.normalize();
    }
    skillRDanceWaveRight.crossVectors(skillRDanceWaveUp, skillRDanceWaveDirection);
    if (skillRDanceWaveRight.lengthSq() < 0.000001) {
      skillRDanceWaveRight.set(1, 0, 0);
    } else {
      skillRDanceWaveRight.normalize();
    }

    entry.direction.copy(skillRDanceWaveDirection);
    entry.right.copy(skillRDanceWaveRight);
    entry.origin
      .copy(skillRDanceWaveOrigin)
      .addScaledVector(skillRDanceWaveDirection, 0.98)
      .addScaledVector(skillRDanceWaveRight, entry.side * 0.18);
    entry.origin.y += 1.24;

    const host = avatar.parent ?? avatar;
    if (entry.mesh.parent !== host) {
      entry.mesh.removeFromParent();
      host.add(entry.mesh);
    }
    entry.mesh.visible = true;
    entry.mesh.position.copy(entry.origin);
    entry.mesh.quaternion.setFromUnitVectors(projectileForward, entry.direction);
    entry.mesh.rotateZ(entry.side * 0.26);
    entry.mesh.scale.setScalar(entry.baseScale * 0.66);
    entry.material.opacity = 0.94;
    entry.material.emissiveIntensity = 0;
  };

  const updateSkillRDanceWaves = (now: number) => {
    for (let i = 0; i < skillRDanceWavePool.length; i += 1) {
      const entry = skillRDanceWavePool[i];
      if (!entry.active) continue;
      const elapsed = now - entry.launchedAt;
      if (elapsed >= entry.maxLifeMs) {
        clearSkillRDanceWaveEntry(entry);
        continue;
      }

      const progress = THREE.MathUtils.clamp(elapsed / entry.maxLifeMs, 0, 1);
      const elapsedSeconds = elapsed * 0.001;
      const lateralDrift =
        Math.sin(progress * Math.PI) * entry.side * (0.3 + entry.baseScale * 0.12);
      entry.mesh.position
        .copy(entry.origin)
        .addScaledVector(entry.direction, entry.speed * elapsedSeconds)
        .addScaledVector(entry.right, lateralDrift);
      entry.mesh.position.y += 0.05 + Math.sin(progress * Math.PI) * 0.24;
      entry.mesh.quaternion.setFromUnitVectors(projectileForward, entry.direction);
      entry.mesh.rotateZ(entry.side * THREE.MathUtils.lerp(0.22, -0.88, progress));
      entry.mesh.rotateY(progress * entry.spinRate * 0.45);
      entry.mesh.scale.setScalar(
        entry.baseScale * THREE.MathUtils.lerp(0.66, 1.22, progress)
      );
      entry.material.opacity = THREE.MathUtils.lerp(0.94, 0.08, progress);
      entry.material.emissiveIntensity = 0;
    }
  };

  const resetSkillQSuperHitFxEntry = (entry: SkillQSuperHitFxEntry) => {
    entry.active = false;
    entry.spawnedAt = 0;
    entry.lifeMs = 0;
    entry.baseScale = 1;
    entry.root.removeFromParent();
    entry.root.visible = false;
    entry.root.position.set(0, 0, 0);
    entry.root.rotation.set(0, 0, 0);
    entry.root.scale.setScalar(1);
    entry.slashMaterialA.opacity = 0.96;
    entry.slashMaterialB.opacity = 0.9;
    entry.ringMaterial.opacity = 0.84;
  };

  const createSkillQSuperHitFxEntry = () => {
    const slashMaterialA = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    const slashMaterialB = new THREE.MeshBasicMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    const slashA = new THREE.Mesh(skillQSuperHitSlashGeometry, slashMaterialA);
    const slashB = new THREE.Mesh(skillQSuperHitSlashGeometry, slashMaterialB);
    const ring = new THREE.Mesh(skillQSuperHitRingGeometry, ringMaterial);
    slashA.renderOrder = 24;
    slashB.renderOrder = 24;
    ring.renderOrder = 23;
    slashA.rotation.z = Math.PI * 0.25;
    slashB.rotation.z = -Math.PI * 0.25;
    ring.rotation.x = Math.PI * 0.5;
    const root = new THREE.Group();
    root.visible = false;
    root.add(slashA, slashB, ring);

    return {
      root,
      slashA,
      slashB,
      ring,
      slashMaterialA,
      slashMaterialB,
      ringMaterial,
      active: false,
      spawnedAt: 0,
      lifeMs: 0,
      baseScale: 1,
    } as SkillQSuperHitFxEntry;
  };

  const acquireSkillQSuperHitFxEntry = () => {
    for (let i = 0; i < skillQSuperHitFxPool.length; i += 1) {
      const entry = skillQSuperHitFxPool[i];
      if (!entry.active && !entry.root.parent) return entry;
    }
    const entry = createSkillQSuperHitFxEntry();
    skillQSuperHitFxPool.push(entry);
    return entry;
  };

  const clearSkillQSuperHitFx = () => {
    for (let i = 0; i < skillQSuperHitFxPool.length; i += 1) {
      resetSkillQSuperHitFxEntry(skillQSuperHitFxPool[i]);
    }
  };

  const disposeSkillQSuperHitFx = () => {
    for (let i = 0; i < skillQSuperHitFxPool.length; i += 1) {
      const entry = skillQSuperHitFxPool[i];
      entry.root.removeFromParent();
      entry.slashMaterialA.dispose();
      entry.slashMaterialB.dispose();
      entry.ringMaterial.dispose();
    }
    skillQSuperHitFxPool.length = 0;
  };

  const spawnSkillQSuperHitFx = (
    now: number,
    point: THREE.Vector3,
    direction: THREE.Vector3,
    targetObject?: THREE.Object3D | null
  ) => {
    const entry = acquireSkillQSuperHitFxEntry();
    resetSkillQSuperHitFxEntry(entry);
    entry.active = true;
    entry.spawnedAt = now;
    entry.lifeMs = THREE.MathUtils.lerp(260, 380, Math.random());
    entry.baseScale = THREE.MathUtils.lerp(2.22, 3.66, Math.random());
    entry.root.visible = true;

    const host =
      targetObject && targetObject.parent ? targetObject : avatar.parent ?? avatar;
    if (entry.root.parent !== host) {
      entry.root.removeFromParent();
      host.add(entry.root);
    }
    const safeDirection = direction.lengthSq() > 0.000001
      ? direction.clone().normalize()
      : projectileForward;
    skillQSuperHitQuaternion.setFromUnitVectors(projectileForward, safeDirection);
    setObjectWorldPose(entry.root, point, skillQSuperHitQuaternion);
    entry.root.rotateZ(THREE.MathUtils.randFloatSpread(Math.PI * 0.62));
    entry.root.scale.setScalar(entry.baseScale);
  };

  const updateSkillQSuperHitFx = (now: number) => {
    for (let i = 0; i < skillQSuperHitFxPool.length; i += 1) {
      const entry = skillQSuperHitFxPool[i];
      if (!entry.active) continue;
      const progress = THREE.MathUtils.clamp(
        (now - entry.spawnedAt) / Math.max(1, entry.lifeMs),
        0,
        1
      );
      if (progress >= 1) {
        resetSkillQSuperHitFxEntry(entry);
        continue;
      }
      const fade = 1 - THREE.MathUtils.smoothstep(progress, 0.06, 1);
      const pulse = 1 + Math.sin(progress * Math.PI) * 0.22;
      entry.root.scale.setScalar(
        entry.baseScale * THREE.MathUtils.lerp(0.96, 1.4, progress) * pulse
      );
      entry.slashMaterialA.opacity = 0.96 * fade;
      entry.slashMaterialB.opacity = 0.9 * fade;
      entry.ringMaterial.opacity = 0.84 * fade;
      entry.ring.rotation.z = progress * Math.PI * 1.6;
    }
  };

  const launchSkillEHitCutWave = (
    now: number,
    point: THREE.Vector3,
    direction: THREE.Vector3,
    scaleMultiplier = 1
  ) => {
    // Intentionally disabled: E hit should no longer leave crescent-shaped object.
    void now;
    void point;
    void direction;
    void scaleMultiplier;
  };

  const reflectProjectileByPrimarySwing: ProjectileReflector = () => {
    if (skillRState.active) {
      applyEnergy?.(skillRConfig.energyGainOnReflect);
      applyMana?.(manaGainOnReflectOrBasicDamage);
      return {
        speedMultiplier: skillRConfig.reflectSpeedMultiplier,
      };
    }
    applyEnergy?.(primarySwingConfig.energyGainOnReflect);
    applyMana?.(manaGainOnReflectOrBasicDamage);
    return {
      speedMultiplier: primarySwingState.reflectSpeedMultiplier,
    };
  };

  const skillRReflectUserData = skillRReflectVolume.userData as {
    projectileReflector?: ProjectileReflector;
  };
  skillRReflectUserData.projectileReflector = () => {
    if (!skillRState.active) return false;
    applyEnergy?.(skillRConfig.energyGainOnReflect);
    applyMana?.(manaGainOnReflectOrBasicDamage);
    return {
      speedMultiplier: skillRConfig.reflectSpeedMultiplier,
    };
  };

  const updatePrimaryReflectVolume = (ratio: number, progress: number) => {
    const depth =
      THREE.MathUtils.lerp(
        primaryReflectVolumeConfig.minDepth,
        primaryReflectVolumeConfig.maxDepth,
        ratio
      ) *
      (1 + progress * 0.04);
    const width =
      THREE.MathUtils.lerp(
        primaryReflectVolumeConfig.minWidth,
        primaryReflectVolumeConfig.maxWidth,
        ratio
      ) *
      (1 + progress * 0.08);
    const height = THREE.MathUtils.lerp(
      primaryReflectVolumeConfig.minHeight,
      primaryReflectVolumeConfig.maxHeight,
      ratio
    );
    const forwardOffset = depth * THREE.MathUtils.lerp(0.46, 0.54, progress);
    primaryReflectVolume.position.set(
      0,
      primaryReflectVolumeConfig.centerY + Math.sin(progress * Math.PI) * 0.08,
      forwardOffset
    );
    primaryReflectVolume.scale.set(width, height, depth);
  };

  const clearPrimarySwing = () => {
    primaryReflectVolume.visible = false;
    primaryReflectVolume.position.set(0, 0, 0);
    primaryReflectVolume.scale.set(1, 1, 1);

    const entry = primarySwingState.entry;
    if (entry) {
      entry.mesh.removeFromParent();
      entry.mesh.visible = false;
      entry.mesh.rotation.set(0, 0, 0);
      entry.mesh.scale.setScalar(1);
      entry.material.opacity = 0.8;
      entry.material.emissiveIntensity = 0.9;
    }
    primarySwingState.entry = null;
    primarySwingState.startedAt = 0;
    primarySwingState.endsAt = 0;
    primarySwingState.ratio = 0;
    primarySwingState.baseScale = 1;
    primarySwingState.reflectSpeedMultiplier = 1;
    primarySwingState.rotationVariant = "default";
    primarySwingState.rotationDirection = 1;
    primarySwingState.rotationYawOffset = 0;
    primarySwingState.rotationPitchOffset = 0;
    primarySwingState.rotationRollFrom = -1.25;
    primarySwingState.rotationRollTo = 1.04;
    primarySwingState.rotationPhase = 0;
  };

  const clearSkillQ = () => {
    skillQState.active = false;
    skillQState.startedAt = 0;
    skillQState.endsAt = 0;
    skillQState.signEndsAt = 0;
    skillQState.summonWindowStartAt = 0;
    skillQState.summonWindowEndAt = 0;
    skillQState.nextGlyphSpawnAt = 0;
    skillQState.clonesSummoned = false;
    clearSkillQSealGlyphEntries();
    stopActionBinding(runtimeSkillQBinding);
    stopActionBinding(runtimeSkillQBeforeBinding);
    stopActionBinding(runtimeSkillQAfterBinding);
    requestArmPoseReset();
  };

  const startSkillQ = (now: number) => {
    const durationMs = resolveRuntimeSkillQDurationMs();
    const signEndAt =
      now +
      THREE.MathUtils.clamp(runtimeSkillQTiming.signEndSec * 1000, 80, durationMs);
    const summonStartAt =
      now +
      THREE.MathUtils.clamp(
        runtimeSkillQTiming.summonStartSec * 1000,
        Math.min(durationMs - 32, 80),
        durationMs
      );
    const summonEndAt =
      now +
      THREE.MathUtils.clamp(
        runtimeSkillQTiming.summonEndSec * 1000,
        Math.min(durationMs, (summonStartAt - now) + 64),
        durationMs
      );
    skillQState.active = true;
    skillQState.startedAt = now;
    skillQState.endsAt = now + durationMs;
    skillQState.signEndsAt = Math.min(signEndAt, skillQState.endsAt);
    skillQState.summonWindowStartAt = Math.min(
      Math.max(skillQState.signEndsAt, summonStartAt),
      skillQState.endsAt
    );
    skillQState.summonWindowEndAt = Math.min(
      Math.max(skillQState.summonWindowStartAt + 40, summonEndAt),
      skillQState.endsAt
    );
    skillQState.nextGlyphSpawnAt = now;
    skillQState.clonesSummoned = false;
    clearSkillQSealGlyphEntries();
    startSkillQAnimation();
  };

  const updateSkillQ = (now: number) => {
    updateSkillQSealGlyphEntries(now);
    if (!skillQState.active) return;
    if (now >= skillQState.endsAt) {
      if (!skillQState.clonesSummoned) {
        spawnClones(now);
        skillQState.clonesSummoned = true;
      }
      clearSkillQ();
      return;
    }

    if (now <= skillQState.signEndsAt) {
      let guard = 0;
      while (skillQState.nextGlyphSpawnAt <= now && guard < 16) {
        spawnSkillQSealGlyphBurst(skillQState.nextGlyphSpawnAt);
        skillQState.nextGlyphSpawnAt += skillQConfig.glyphSpawnIntervalMs;
        guard += 1;
      }
    }

    if (
      !skillQState.clonesSummoned &&
      now >= skillQState.summonWindowStartAt
    ) {
      spawnClones(now);
      skillQState.clonesSummoned = true;
    }
  };

  const setObjectWorldPose = (
    object: THREE.Object3D,
    worldPosition: THREE.Vector3,
    worldQuaternion: THREE.Quaternion
  ) => {
    const parent = object.parent;
    if (!parent) {
      object.position.copy(worldPosition);
      object.quaternion.copy(worldQuaternion);
      return;
    }
    parent.updateMatrixWorld(true);
    object.position.copy(worldPosition);
    parent.worldToLocal(object.position);
    parent.getWorldQuaternion(skillQSuperParentQuaternion).invert();
    object.quaternion.copy(skillQSuperParentQuaternion).multiply(worldQuaternion);
  };

  const setObjectWorldPosition = (
    object: THREE.Object3D,
    worldPosition: THREE.Vector3
  ) => {
    const parent = object.parent;
    if (!parent) {
      object.position.copy(worldPosition);
      return;
    }
    parent.updateMatrixWorld(true);
    object.position.copy(worldPosition);
    parent.worldToLocal(object.position);
  };

  const restoreSkillQSuperSlashPose = (slash: SkillQSuperSlashState | null) => {
    if (!slash) return;
    if (slash.kind === "host") {
      setObjectWorldPosition(avatar, slash.originPosition);
      return;
    }
    const clone = cloneState.clones[slash.cloneIndex];
    if (!clone || !clone.root.parent) return;
    setObjectWorldPose(clone.root, slash.originPosition, slash.originQuaternion);
  };

  const captureSkillQSuperPreSlashPose = () => {
    avatar.updateMatrixWorld(true);
    avatar.getWorldPosition(skillQSuperState.hostReturnPosition);
    skillQSuperState.hostReturnReady = true;
  };

  const restoreSkillQSuperPreSlashPose = () => {
    if (!skillQSuperState.hostReturnReady) return;
    setObjectWorldPosition(avatar, skillQSuperState.hostReturnPosition);
  };

  const clearSkillQSuper = () => {
    restoreSkillQSuperSlashPose(skillQSuperState.slash);
    skillQSuperState.slash = null;
    skillQSuperState.active = false;
    skillQSuperState.stage = "idle";
    skillQSuperState.startedAt = 0;
    skillQSuperState.beforeEndsAt = 0;
    skillQSuperState.afterEndsAt = 0;
    skillQSuperState.nextCloneIndex = 0;
    skillQSuperState.hostReturnReady = false;
    skillQSuperState.hostReturnPosition.set(0, 0, 0);
    stopActionBinding(runtimeSkillQBeforeBinding);
    stopActionBinding(runtimeSkillQAfterBinding);
    for (let i = 0; i < cloneState.clones.length; i += 1) {
      const animation = cloneState.clones[i].animation;
      if (!animation) continue;
      clearCloneLocomotionAndShurikenLayers(animation);
      stopActionBinding(animation.skillQBeforeBinding);
      stopActionBinding(animation.skillQAfterBinding);
    }
    clearSkillQSuperHitFx();
    clearPrimarySwing();
    clearSkillRDanceWaves();
    requestArmPoseReset();
  };

  const resolveSkillQSuperSlashPosition = (
    slash: SkillQSuperSlashState,
    now: number,
    out: THREE.Vector3
  ) => {
    const duration = Math.max(1, slash.endsAt - slash.startedAt);
    const progress = THREE.MathUtils.clamp((now - slash.startedAt) / duration, 0, 1);
    if (slash.kind === "host") {
      const advanceEnd = 0.42;
      const returnStart = 0.68;
      if (progress <= advanceEnd) {
        const t = THREE.MathUtils.smootherstep(progress / advanceEnd, 0, 1);
        out.copy(slash.originPosition).lerp(slash.slashPosition, t);
        return out;
      }
      if (progress < returnStart) {
        out.copy(slash.slashPosition);
        return out;
      }
      const t = THREE.MathUtils.smootherstep(
        (progress - returnStart) / Math.max(0.0001, 1 - returnStart),
        0,
        1
      );
      out.copy(slash.slashPosition).lerp(slash.originPosition, t);
      return out;
    }
    const t = THREE.MathUtils.smootherstep(progress, 0, 1);
    out.copy(slash.originPosition).lerp(slash.slashPosition, t);
    return out;
  };

  const startSkillQSuperSlash = (
    now: number,
    kind: "clone" | "host",
    cloneIndex: number
  ) => {
    const durationMs =
      kind === "host"
        ? skillQSuperConfig.hostSlashDurationMs
        : skillQSuperConfig.cloneSlashDurationMs;
    let slashObject: THREE.Object3D | null = null;
    let slashModel: THREE.Object3D | null = null;

    if (kind === "host") {
      slashObject = avatar;
      slashModel = runtimeAvatarModelRef ?? avatar;
    } else {
      const clone = cloneState.clones[cloneIndex];
      if (!clone || !clone.root.parent) return false;
      slashObject = clone.root;
      slashModel = clone.model ?? clone.root;
    }
    if (!slashObject || !slashObject.parent) return false;

    slashObject.updateMatrixWorld(true);
    slashObject.getWorldPosition(skillQSuperSlashOrigin);
    slashObject.getWorldQuaternion(skillQSuperSlashQuaternion);

    skillQSuperSlashForward.set(0, 0, 1).applyQuaternion(skillQSuperSlashQuaternion);
    skillQSuperSlashForward.y = 0;
    if (kind === "host" && skillEAimDirection.lengthSq() > 0.000001) {
      skillQSuperSlashForward.copy(skillEAimDirection);
      skillQSuperSlashForward.y = 0;
    }
    if (kind === "clone") {
      const clone = cloneState.clones[cloneIndex];
      if (clone && clone.direction.lengthSq() > 0.000001) {
        skillQSuperSlashForward.copy(clone.direction);
      }
    }
    if (skillQSuperSlashForward.lengthSq() < 0.000001) {
      skillQSuperSlashForward.set(0, 0, 1);
    } else {
      skillQSuperSlashForward.normalize();
    }

    const dashDistance =
      kind === "host"
        ? skillQSuperConfig.hostDashDistance
        : skillQSuperConfig.cloneDashDistance;
    skillQSuperSlashTarget
      .copy(skillQSuperSlashOrigin)
      .addScaledVector(skillQSuperSlashForward, dashDistance);
    skillQSuperSlashTarget.y = skillQSuperSlashOrigin.y;

    spawnSkillRAfterImage(now, {
      sourceModel: slashModel,
      lifeMs: durationMs + 120,
      baseOpacity: 0.92,
      scaleBoost: 0.01,
      attachTo: avatar.parent ?? avatar,
      preserveWorldTransform: true,
    });
    spawnSkillRAfterImage(now, {
      sourceModel: slashModel,
      lifeMs: Math.max(120, durationMs * 0.55),
      baseOpacity: kind === "host" ? 1 : 0.9,
      scaleBoost: kind === "host" ? 0.12 : 0.08,
      attachTo: avatar.parent ?? avatar,
      preserveWorldTransform: true,
    });

    const slashDamage =
      kind === "host"
        ? skillQSuperConfig.strikeDamage * 2
        : skillQSuperConfig.strikeDamage;

    performMeleeAttack?.({
      damage: slashDamage,
      maxDistance: skillQSuperConfig.strikeRadius,
      hitRadius: skillQSuperConfig.strikeRadius,
      maxHits: skillQSuperConfig.strikeMaxHits,
      origin: skillQSuperSlashTarget,
      direction: skillQSuperSlashForward,
      contactCenter: skillQSuperSlashTarget,
      contactRadius: skillQSuperConfig.strikeRadius,
      onHitTargetResolved: ({ point, direction: hitDirection, targetObject, now: hitNow }) => {
        spawnSkillQSuperHitFx(hitNow, point, hitDirection, targetObject);
      },
    });

    if (kind === "host") {
      startPrimarySwing(now, 1);
      launchSkillRDanceWave(now);
      launchSkillRDanceWave(now);
    } else {
      spawnCloneSmokeBurst(skillQSuperSlashOrigin, 6);
      spawnCloneSmokeBurst(skillQSuperSlashTarget, 10);
    }

    skillQSuperState.slash = {
      kind,
      cloneIndex,
      startedAt: now,
      endsAt: now + durationMs,
      originPosition: skillQSuperSlashOrigin.clone(),
      originQuaternion: skillQSuperSlashQuaternion.clone(),
      slashPosition: skillQSuperSlashTarget.clone(),
      slashQuaternion: skillQSuperSlashQuaternion.clone(),
      slashDirection: skillQSuperSlashForward.clone(),
    };
    return true;
  };

  const startSkillQSuper = (now: number) => {
    if (!cloneState.active || !cloneState.clones.length || cloneState.consumePending) {
      return false;
    }
    skillQSuperState.hostReturnReady = false;
    cancelCharge();
    cancelSkillECharge();
    resetSkillEVolleyState();
    clearPrimarySwing();
    clearSkillQ();
    requestArmPoseReset();

    skillQSuperState.active = true;
    skillQSuperState.stage = "before";
    skillQSuperState.startedAt = now;
    skillQSuperState.beforeEndsAt = now + resolveRuntimeSkillQBeforeDurationMs();
    skillQSuperState.afterEndsAt = 0;
    skillQSuperState.nextCloneIndex = 0;
    skillQSuperState.slash = null;

    startSkillQBeforeAnimation();
    for (let i = 0; i < cloneState.clones.length; i += 1) {
      startCloneSkillQBeforeAnimation(cloneState.clones[i]);
    }
    return true;
  };

  const updateSkillQSuper = (now: number, deltaSeconds: number) => {
    if (!skillQSuperState.active) return;

    for (let i = 0; i < cloneState.clones.length; i += 1) {
      const animation = cloneState.clones[i].animation;
      if (!animation) continue;
      animation.mixer.update(deltaSeconds);
    }

    const slash = skillQSuperState.slash;
    if (slash) {
      resolveSkillQSuperSlashPosition(slash, now, skillQSuperSlashCurrentPosition);
      if (slash.kind === "host") {
        setObjectWorldPosition(avatar, skillQSuperSlashCurrentPosition);
      } else {
        const clone = cloneState.clones[slash.cloneIndex];
        if (clone && clone.root.parent) {
          setObjectWorldPose(
            clone.root,
            skillQSuperSlashCurrentPosition,
            slash.slashQuaternion
          );
        }
      }
    }

    if (skillQSuperState.stage === "before") {
      if (now < skillQSuperState.beforeEndsAt) return;
      skillQSuperState.stage = "cloneSlash";
      skillQSuperState.nextCloneIndex = 0;
      skillQSuperState.slash = null;
    }

    if (skillQSuperState.stage === "cloneSlash") {
      if (!skillQSuperState.slash) {
        let slashStarted = false;
        while (skillQSuperState.nextCloneIndex < cloneState.clones.length) {
          const cloneIndex = skillQSuperState.nextCloneIndex;
          skillQSuperState.nextCloneIndex += 1;
          if (startSkillQSuperSlash(now, "clone", cloneIndex)) {
            slashStarted = true;
            break;
          }
        }
        if (!slashStarted) {
          captureSkillQSuperPreSlashPose();
          skillQSuperState.stage = "hostSlash";
          const hostSlashStarted = startSkillQSuperSlash(now, "host", -1);
          if (!hostSlashStarted) {
            restoreSkillQSuperPreSlashPose();
            skillQSuperState.hostReturnReady = false;
            startSkillQAfterAnimation();
            skillQSuperState.stage = "after";
            skillQSuperState.afterEndsAt = now + resolveRuntimeSkillQAfterDurationMs();
          }
        }
        return;
      }

      if (now < skillQSuperState.slash.endsAt) return;
      if (skillQSuperState.slash.kind === "clone") {
        const clone = cloneState.clones[skillQSuperState.slash.cloneIndex];
        if (clone) {
          clearClone(clone, true);
        }
      } else {
        restoreSkillQSuperSlashPose(skillQSuperState.slash);
      }
      skillQSuperState.slash = null;
      return;
    }

    if (skillQSuperState.stage === "hostSlash") {
      if (!skillQSuperState.slash || now < skillQSuperState.slash.endsAt) return;
      restoreSkillQSuperPreSlashPose();
      skillQSuperState.hostReturnReady = false;
      skillQSuperState.slash = null;
      startSkillQAfterAnimation();
      skillQSuperState.stage = "after";
      skillQSuperState.afterEndsAt = now + resolveRuntimeSkillQAfterDurationMs();
      return;
    }

    if (skillQSuperState.stage === "after" && now >= skillQSuperState.afterEndsAt) {
      clearAllClones(true);
      clearSkillQSuper();
    }
  };

  const clearSkillR = () => {
    skillRState.active = false;
    skillRState.startedAt = 0;
    skillRState.endsAt = 0;
    skillRState.nextSlashIndex = 0;
    skillRDanceWaveNextSide = 1;
    skillRReflectVolume.visible = false;
    skillRReflectVolume.position.set(0, 0, 0);
    skillRReflectVolume.scale.set(1, 1, 1);
    if (runtimeSkillRBinding) {
      runtimeSkillRBinding.action.setEffectiveWeight(0);
      runtimeSkillRBinding.action.paused = true;
    }
    requestArmPoseReset();
  };

  const startSkillR = (now: number) => {
    skillRState.active = true;
    skillRState.startedAt = now;
    skillRState.endsAt = now + resolveRuntimeSkillRDurationMs();
    skillRState.nextSlashIndex = 0;
    skillRDanceWaveNextSide = 1;
    skillRReflectVolume.visible = true;
    skillRReflectVolume.position.set(0, skillRConfig.reflectCenterY, 0);
    skillRReflectVolume.scale.setScalar(skillRConfig.reflectRadius);
    startSkillRAnimation();
  };

  const updateSkillR = (now: number) => {
    if (!skillRState.active) return;
    if (now >= skillRState.endsAt) {
      clearSkillR();
      return;
    }

    skillRReflectVolume.visible = true;
    skillRReflectVolume.position.set(0, skillRConfig.reflectCenterY, 0);
    skillRReflectVolume.scale.setScalar(skillRConfig.reflectRadius);

    const elapsedSec = Math.max(0, (now - skillRState.startedAt) * 0.001);
    if (runtimeSkillRSlashEvents.length > 0) {
      while (
        skillRState.nextSlashIndex < runtimeSkillRSlashEvents.length &&
        elapsedSec >= runtimeSkillRSlashEvents[skillRState.nextSlashIndex].timeSec
      ) {
        const hitCount =
          performMeleeAttack?.({
            damage: skillRConfig.meleeDamage,
            maxDistance: skillRConfig.meleeRange,
            hitRadius: skillRConfig.meleeHitRadius,
            maxHits: skillRConfig.meleeMaxHits,
          }) ?? 0;
        if (hitCount > 0) {
          applyEnergy?.(hitCount * skillRConfig.energyGainOnHit);
        }
        spawnSkillRAfterImage(now);
        startPrimarySwing(now, 0.92);
        skillRState.nextSlashIndex += 1;
      }
      return;
    }

    const fallbackSlashCount = Math.floor(
      (now - skillRState.startedAt) / skillRConfig.meleeIntervalMs
    );
    while (skillRState.nextSlashIndex <= fallbackSlashCount) {
      const hitCount =
        performMeleeAttack?.({
          damage: skillRConfig.meleeDamage,
          maxDistance: skillRConfig.meleeRange,
          hitRadius: skillRConfig.meleeHitRadius,
          maxHits: skillRConfig.meleeMaxHits,
        }) ?? 0;
      if (hitCount > 0) {
        applyEnergy?.(hitCount * skillRConfig.energyGainOnHit);
      }
      spawnSkillRAfterImage(now);
      startPrimarySwing(now, 0.92);
      skillRState.nextSlashIndex += 1;
    }
  };

  const updatePrimarySwing = (now: number) => {
    const entry = primarySwingState.entry;
    if (!entry) return;
    if (now >= primarySwingState.endsAt) {
      clearPrimarySwing();
      return;
    }

    const ratio = primarySwingState.ratio;
    const progress = THREE.MathUtils.clamp(
      (now - primarySwingState.startedAt) / primarySwingConfig.durationMs,
      0,
      1
    );

    avatar.updateMatrixWorld(true);
    avatar.getWorldPosition(swingOrigin);
    avatar.getWorldQuaternion(swingFacing);

    swingForward.set(0, 0, 1).applyQuaternion(swingFacing);
    swingForward.y = 0;
    if (swingForward.lengthSq() < 0.000001) {
      swingForward.set(0, 0, 1);
    } else {
      swingForward.normalize();
    }

    swingRight.crossVectors(swingUp, swingForward);
    if (swingRight.lengthSq() < 0.000001) {
      swingRight.set(1, 0, 0);
    } else {
      swingRight.normalize();
    }

    const forwardDistance = THREE.MathUtils.lerp(
      0.78,
      1.15 + ratio * 1.2,
      progress
    );
    const lateralDistance =
      THREE.MathUtils.lerp(-0.82, 0.86, progress) * (0.75 + ratio * 0.7);
    const arcHeight = 1.14 + Math.sin(progress * Math.PI) * 0.32;

    entry.mesh.position
      .copy(swingOrigin)
      .addScaledVector(swingForward, forwardDistance)
      .addScaledVector(swingRight, lateralDistance);
    entry.mesh.position.y += arcHeight;
    if (primarySwingState.rotationVariant === "rDance") {
      entry.mesh.position.addScaledVector(
        swingRight,
        primarySwingState.rotationYawOffset * 0.34
      );
      entry.mesh.position.y += primarySwingState.rotationPitchOffset * 0.24;
    }
    entry.mesh.quaternion.setFromUnitVectors(projectileForward, swingForward);
    if (primarySwingState.rotationVariant === "rDance") {
      const direction = primarySwingState.rotationDirection;
      const phase = primarySwingState.rotationPhase;
      entry.mesh.rotateZ(
        THREE.MathUtils.lerp(
          primarySwingState.rotationRollFrom,
          primarySwingState.rotationRollTo,
          progress
        ) * direction
      );
      entry.mesh.rotateY(
        (Math.sin(progress * Math.PI * 1.9 + phase) * 0.24 +
          primarySwingState.rotationYawOffset * 0.42) *
          direction
      );
      entry.mesh.rotateX(
        Math.sin(progress * Math.PI * 1.2 + phase * 0.5) * 0.16 +
          primarySwingState.rotationPitchOffset * 0.32
      );
    } else {
      entry.mesh.rotateZ(THREE.MathUtils.lerp(-1.25, 1.04, progress));
      entry.mesh.rotateY(Math.sin(progress * Math.PI) * 0.08);
    }

    const pulse = 1 + Math.sin(progress * Math.PI) * 0.06;
    entry.mesh.scale.setScalar(
      primarySwingState.baseScale * pulse * (1 + progress * 0.2)
    );
    entry.material.opacity = THREE.MathUtils.lerp(0.86, 0.06, progress);
    entry.material.emissiveIntensity = THREE.MathUtils.lerp(
      1.1 + ratio * 0.9,
      0.2,
      progress
    );
  };

  const startPrimarySwing = (
    now: number,
    ratio: number,
    options?: {
      variant?: "default" | "rDance";
      direction?: 1 | -1;
      yawOffset?: number;
      pitchOffset?: number;
      rollFrom?: number;
      rollTo?: number;
      phase?: number;
    }
  ) => {
    clearPrimarySwing();

    const entry = acquireSwordWave();
    const swingReflectUserData = entry.mesh.userData as {
      projectileReflector?: ProjectileReflector;
    };
    swingReflectUserData.projectileReflector = reflectProjectileByPrimarySwing;
    entry.mesh.visible = true;
    entry.mesh.rotation.set(0, 0, 0);
    entry.baseScale = THREE.MathUtils.lerp(
      primarySwingConfig.minFxScale,
      primarySwingConfig.maxFxScale,
      ratio
    );
    entry.mesh.scale.setScalar(entry.baseScale);
    entry.material.opacity = 0.86;
    entry.material.emissiveIntensity = THREE.MathUtils.lerp(1.1, 1.9, ratio);

    const swingHost = avatar.parent ?? avatar;
    if (entry.mesh.parent !== swingHost) {
      entry.mesh.removeFromParent();
      swingHost.add(entry.mesh);
    }

    primarySwingState.entry = entry;
    primarySwingState.startedAt = now;
    primarySwingState.endsAt = now + primarySwingConfig.durationMs;
    primarySwingState.ratio = ratio;
    primarySwingState.baseScale = entry.baseScale;
    primarySwingState.reflectSpeedMultiplier = THREE.MathUtils.lerp(
      primarySwingConfig.minReflectSpeedMultiplier,
      primarySwingConfig.maxReflectSpeedMultiplier,
      ratio
    );
    primarySwingState.rotationVariant = options?.variant ?? "default";
    primarySwingState.rotationDirection = options?.direction ?? 1;
    primarySwingState.rotationYawOffset = options?.yawOffset ?? 0;
    primarySwingState.rotationPitchOffset = options?.pitchOffset ?? 0;
    primarySwingState.rotationRollFrom = options?.rollFrom ?? -1.25;
    primarySwingState.rotationRollTo = options?.rollTo ?? 1.04;
    primarySwingState.rotationPhase = options?.phase ?? 0;

    updatePrimarySwing(now);
  };

  const getProjectileBlockers = () => {
    const baseBlockers = baseRuntime.getProjectileBlockers?.() ?? [];
    const skillRReflectActive =
      skillRState.active &&
      skillRReflectVolume.visible &&
      Boolean(skillRReflectVolume.parent);
    const swingMesh = primarySwingState.entry?.mesh;
    const swingMeshActive =
      Boolean(swingMesh) && Boolean(swingMesh?.visible) && Boolean(swingMesh?.parent);
    const cloneBlockerActive =
      cloneState.active &&
      cloneState.clones.some((clone) => Boolean(clone.root.parent) && clone.root.visible);
    if (!skillRReflectActive && !swingMeshActive && !cloneBlockerActive) {
      return baseBlockers;
    }
    mergedProjectileBlockers.length = 0;
    for (let i = 0; i < baseBlockers.length; i += 1) {
      mergedProjectileBlockers.push(baseBlockers[i]);
    }
    if (skillRReflectActive) {
      mergedProjectileBlockers.push(skillRReflectVolume);
    }
    if (swingMeshActive && swingMesh) {
      mergedProjectileBlockers.push(swingMesh);
    }
    if (cloneBlockerActive) {
      for (let i = 0; i < cloneState.clones.length; i += 1) {
        const clone = cloneState.clones[i];
        if (!clone.root.parent || !clone.root.visible) continue;
        mergedProjectileBlockers.push(clone.root);
      }
    }
    return mergedProjectileBlockers;
  };

  const isDescendantOf = (
    object: THREE.Object3D | null,
    ancestor: THREE.Object3D
  ) => {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  };

  const isPrimarySwingBlocker = (object: THREE.Object3D | null) => {
    const swingMesh = primarySwingState.entry?.mesh;
    return Boolean(
      swingMesh &&
        swingMesh.visible &&
        swingMesh.parent &&
        isDescendantOf(object, swingMesh)
    );
  };

  const isSkillRReflectBlocker = (object: THREE.Object3D | null) =>
    Boolean(
      skillRState.active &&
        skillRReflectVolume.visible &&
        skillRReflectVolume.parent &&
        isDescendantOf(object, skillRReflectVolume)
    );

  const isSkillRFrontReflectionHit = (incomingDirection: THREE.Vector3) => {
    avatar.getWorldQuaternion(skillRReflectFacing);
    skillRReflectForward.set(0, 0, 1).applyQuaternion(skillRReflectFacing);
    skillRReflectForward.y = 0;
    if (skillRReflectForward.lengthSq() < 0.000001) {
      skillRReflectForward.set(0, 0, 1);
    } else {
      skillRReflectForward.normalize();
    }

    skillRReflectIncoming.copy(incomingDirection);
    skillRReflectIncoming.y = 0;
    if (skillRReflectIncoming.lengthSq() < 0.000001) {
      return false;
    }
    skillRReflectIncoming.normalize();

    // Incoming direction must be in the front hemisphere (dot <= 0) to be reflected.
    return (
      skillRReflectIncoming.dot(skillRReflectForward) <= skillRConfig.reflectFrontDotMax
    );
  };

  const convertReflectedProjectileToChargedWave = ({
    projectile,
    nextPosition,
    hitPoint,
    reflectedDirection,
  }: {
    projectile: {
      velocity: THREE.Vector3;
      radius: number;
    };
    nextPosition: THREE.Vector3;
    hitPoint: THREE.Vector3;
    reflectedDirection: THREE.Vector3;
  }) => {
    launchReflectedChargedSwordWave(hitPoint, reflectedDirection);

    const mutableProjectile = projectile as typeof projectile & {
      life?: number;
      maxLife?: number;
      damage?: number;
      targetHitRadius?: number;
      splitOnImpact?: boolean;
      explodeOnTargetHit?: boolean;
      explodeOnWorldHit?: boolean;
      explodeOnExpire?: boolean;
      grantEnergyOnTargetHit?: boolean;
      grantManaOnTargetHit?: boolean;
      removeOnTargetHit?: boolean;
      removeOnWorldHit?: boolean;
      energyGainOnHit?: number | null;
      manaGainOnHit?: number | null;
    };
    mutableProjectile.damage = 0;
    mutableProjectile.targetHitRadius = 0;
    mutableProjectile.splitOnImpact = false;
    mutableProjectile.explodeOnTargetHit = false;
    mutableProjectile.explodeOnWorldHit = false;
    mutableProjectile.explodeOnExpire = false;
    mutableProjectile.grantEnergyOnTargetHit = false;
    mutableProjectile.grantManaOnTargetHit = false;
    mutableProjectile.removeOnTargetHit = true;
    mutableProjectile.removeOnWorldHit = true;
    mutableProjectile.energyGainOnHit = 0;
    mutableProjectile.manaGainOnHit = 0;

    projectile.velocity.set(0, -220, 0);
    projectile.radius = Math.min(projectile.radius, 0.05);
    nextPosition.copy(hitPoint).addScaledVector(reflectedDirection, 0.05);
    nextPosition.y = Math.min(nextPosition.y, avatar.position.y - 8);

    if (
      typeof mutableProjectile.life === "number" &&
      typeof mutableProjectile.maxLife === "number"
    ) {
      mutableProjectile.life = mutableProjectile.maxLife;
    }
  };

  const handleProjectileBlockHit: NonNullable<
    CharacterRuntime["handleProjectileBlockHit"]
  > = ({
    now,
    projectile,
    blockerHit,
    origin,
    direction,
    travelDistance,
    nextPosition,
  }) => {
    if (isPrimarySwingBlocker(blockerHit.object)) {
      const reflected = tryReflectLinearProjectile({
        blockerHit,
        now,
        origin,
        direction,
        travelDistance,
        nextPosition,
        velocity: projectile.velocity,
        radius: projectile.radius,
        outDirection: reflectedProjectileDirection,
      });
      if (reflected) {
        reflectedProjectileHitPoint.copy(blockerHit.point);
        convertReflectedProjectileToChargedWave({
          projectile,
          nextPosition,
          hitPoint: reflectedProjectileHitPoint,
          reflectedDirection: reflectedProjectileDirection,
        });
        return true;
      }
    }

    if (isSkillRReflectBlocker(blockerHit.object)) {
      if (!isSkillRFrontReflectionHit(direction)) {
        // Rear-side hits are ignored so R only reflects projectiles from the front.
        return true;
      }
      const reflected = tryReflectLinearProjectile({
        blockerHit,
        now,
        origin,
        direction,
        travelDistance,
        nextPosition,
        velocity: projectile.velocity,
        radius: projectile.radius,
        outDirection: reflectedProjectileDirection,
      });
      if (reflected) {
        reflectedProjectileHitPoint.copy(blockerHit.point);
        convertReflectedProjectileToChargedWave({
          projectile,
          nextPosition,
          hitPoint: reflectedProjectileHitPoint,
          reflectedDirection: reflectedProjectileDirection,
        });
        return true;
      }
      return true;
    }

    return (
      baseRuntime.handleProjectileBlockHit?.({
        now,
        projectile,
        blockerHit,
        origin,
        direction,
        travelDistance,
        nextPosition,
      }) ?? false
    );
  };

  const resetShurikenTrail = (entry: ShurikenEntry, point: THREE.Vector3) => {
    for (let i = 0; i < entry.trailPositions.length; i += 3) {
      entry.trailPositions[i] = point.x;
      entry.trailPositions[i + 1] = point.y;
      entry.trailPositions[i + 2] = point.z;
    }
    entry.trailPositionAttribute.needsUpdate = true;
    entry.trailGeometry.computeBoundingSphere();
  };

  const pushShurikenTrailPoint = (entry: ShurikenEntry, point: THREE.Vector3) => {
    for (let i = entry.trailPositions.length - 1; i >= 3; i -= 1) {
      entry.trailPositions[i] = entry.trailPositions[i - 3];
      entry.trailPositions[i - 1] = entry.trailPositions[i - 4];
      entry.trailPositions[i - 2] = entry.trailPositions[i - 5];
    }
    entry.trailPositions[0] = point.x;
    entry.trailPositions[1] = point.y;
    entry.trailPositions[2] = point.z;
    entry.trailPositionAttribute.needsUpdate = true;
    entry.trailGeometry.computeBoundingSphere();
  };

  const resolveSkillEBaseDirection = () => {
    skillEBaseDirection.copy(skillEAimDirection);
    if (skillEBaseDirection.lengthSq() < 0.000001) {
      skillEBaseDirection.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    }
    skillEBaseDirection.normalize();

    skillERight.crossVectors(skillEUp, skillEBaseDirection);
    if (skillERight.lengthSq() < 0.000001) {
      skillERight.set(1, 0, 0).applyQuaternion(avatar.quaternion);
    }
    if (skillERight.lengthSq() < 0.000001) {
      skillERight.set(1, 0, 0);
    } else {
      skillERight.normalize();
    }
  };

  const resolveSkillEOriginWorld = (target: THREE.Vector3) => {
    if (runtimeWeaponConstraintWeapon) {
      runtimeWeaponConstraintWeapon.getWorldPosition(target);
      return target;
    }
    if (runtimeWeaponConstraintHand) {
      runtimeWeaponConstraintHand.getWorldPosition(target);
      return target;
    }
    return heldShuriken.getCenterWorld(target);
  };

  const resolveSkillEChargeRatio = (now: number) =>
    THREE.MathUtils.clamp(
      (now - skillEChargeState.startTime) / skillEChargeConfig.maxHoldMs,
      0,
      1
    );

  const configureSkillEVolleyForCharge = (ratio: number) => {
    const shurikenScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minShurikenScale,
      skillEChargeConfig.maxShurikenScale,
      ratio
    );
    const radiusScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minRadiusScale,
      skillEChargeConfig.maxRadiusScale,
      ratio
    );
    const lifetimeScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minLifetimeScale,
      skillEChargeConfig.maxLifetimeScale,
      ratio
    );
    const speedScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minSpeedScale,
      skillEChargeConfig.maxSpeedScale,
      ratio
    );
    const explosionScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minExplosionScale,
      skillEChargeConfig.maxExplosionScale,
      ratio
    );
    const explosionDamageScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minExplosionDamageScale,
      skillEChargeConfig.maxExplosionDamageScale,
      ratio
    );

    skillEVolley.speed = skillEConfig.speed * speedScale;
    skillEVolley.lifetime = skillEConfig.lifetime * lifetimeScale;
    skillEVolley.radius = skillEConfig.radius * radiusScale;
    skillEVolley.targetHitRadius = skillEConfig.targetHitRadius * radiusScale;
    skillEVolley.shurikenScale = shurikenScale;
    skillEVolley.explosionRadius = skillEConfig.explosionRadius * explosionScale;
    skillEVolley.explosionDamage = Math.round(
      skillEConfig.explosionDamage * explosionDamageScale
    );
  };

  const setShurikenElectricState = (
    entry: ShurikenEntry,
    active: boolean,
    scaleMultiplier: number
  ) => {
    entry.electricActive = active;
    entry.arcA.visible = active;
    entry.arcB.visible = active;
    if (!active) {
      entry.arcMaterialA.opacity = 0;
      entry.arcMaterialB.opacity = 0;
      entry.arcA.rotation.set(0, 0, 0);
      entry.arcB.rotation.set(0, Math.PI * 0.55, 0);
      return;
    }
    const arcScale = Math.max(0.9, scaleMultiplier);
    entry.arcA.scale.setScalar(arcScale);
    entry.arcB.scale.setScalar(arcScale * 0.92);
    entry.arcMaterialA.opacity = 0.6;
    entry.arcMaterialB.opacity = 0.5;
    entry.arcA.rotation.set(0, 0, Math.random() * Math.PI * 2);
    entry.arcB.rotation.set(0, Math.PI * 0.55, Math.random() * Math.PI * 2);
  };

  const animateShurikenElectricArc = (
    entry: ShurikenEntry,
    now: number,
    delta: number
  ) => {
    if (!entry.electricActive) return;
    entry.arcA.rotation.z += delta * 13.5;
    entry.arcA.rotation.y += delta * 7.5;
    entry.arcB.rotation.z -= delta * 11.3;
    entry.arcB.rotation.x += delta * 6.2;
    const flicker = 0.5 + Math.sin(now * 0.045 + entry.spinPhase) * 0.25;
    entry.arcMaterialA.opacity = 0.46 + flicker * 0.46;
    entry.arcMaterialB.opacity = 0.38 + flicker * 0.42;
    entry.material.emissiveIntensity = 1.1 + flicker * 0.85;
  };

  const fireSkillEShuriken = (shotIndex: number) => {
    if (!fireProjectile) return;

    const cloneBuffActive = skillEVolley.cloneBoosted;
    const scaleMultiplier = cloneBuffActive ? 2 : 1;
    const damageMultiplier = cloneBuffActive ? 1.5 : 1;
    const side =
      skillESideOffsets[Math.min(shotIndex, skillESideOffsets.length - 1)];
    const baseDirection = skillEVolley.baseDirection.clone();
    const baseRight = skillEVolley.right.clone();
    const speed = skillEVolley.speed;
    const lifetime = skillEVolley.lifetime;

    skillEShotDirection
      .copy(baseDirection)
      .applyAxisAngle(skillEUp, side * skillEConfig.spreadRad)
      .normalize();
    skillEShotOrigin
      .copy(skillEVolley.origin)
      .addScaledVector(baseDirection, skillEConfig.forwardSpawn)
      .addScaledVector(baseRight, side * skillEConfig.lateralSpawn);
    skillEShotOrigin.y += skillEConfig.verticalSpawn;

    const entry = acquireShuriken();
    entry.mesh.visible = true;
    entry.mesh.rotation.set(0, 0, 0);
    entry.mesh.scale.setScalar(skillEVolley.shurikenScale * scaleMultiplier);
    entry.material.emissiveIntensity = cloneBuffActive ? 1.5 : 0.85;
    setShurikenElectricState(entry, cloneBuffActive, scaleMultiplier);
    entry.spinPhase = Math.random() * Math.PI * 2;
    entry.spinRate = 14 + Math.random() * 6 + skillEChargeState.ratio * 3.5;
    const currentDirection = new THREE.Vector3();
    const homingDirection = new THREE.Vector3();
    const trailHead = new THREE.Vector3();

    const trailHost = avatar.parent ?? avatar;
    if (entry.trail.parent !== trailHost) {
      entry.trail.removeFromParent();
      trailHost.add(entry.trail);
    }
    entry.trail.visible = true;
    entry.trailMaterial.opacity = cloneBuffActive
      ? THREE.MathUtils.lerp(0.56, 0.98, skillEChargeState.ratio)
      : THREE.MathUtils.lerp(0.42, 0.9, skillEChargeState.ratio);
    entry.trailMaterial.color.set(cloneBuffActive ? 0x60a5fa : 0x7dd3fc);
    resetShurikenTrail(entry, skillEShotOrigin);

    fireProjectile({
      projectileType: "shuriken",
      mesh: entry.mesh,
      origin: skillEShotOrigin,
      direction: skillEShotDirection,
      speed,
      lifetime,
      radius: skillEVolley.radius * scaleMultiplier,
      targetHitRadius: skillEVolley.targetHitRadius * scaleMultiplier,
      damage: Math.round(skillEConfig.damage * damageMultiplier),
      energyGainOnHit: 4,
      splitOnImpact: false,
      explodeOnTargetHit: false,
      explodeOnWorldHit: false,
      explodeOnExpire: false,
      removeOnTargetHit: true,
      removeOnWorldHit: true,
      lifecycle: {
        onTargetHit: ({ now, point, direction }) => {
          launchSkillEHitCutWave(now, point, direction, cloneBuffActive ? 1.18 : 1);
        },
        applyForces: ({ velocity, position, delta, findNearestTarget }) => {
          if (velocity.lengthSq() < 0.000001) return;
          currentDirection.copy(velocity).normalize();

          if (cloneBuffActive) {
            const nearestTarget = findNearestTarget?.({
              center: position,
              radius: skillEConfig.superHomingSearchRadius,
            });
            if (nearestTarget) {
              homingDirection.copy(nearestTarget.point).sub(position);
              if (homingDirection.lengthSq() > 0.000001) {
                homingDirection.normalize();
                const steer =
                  1 -
                  Math.exp(
                    -Math.max(0.01, skillEConfig.superHomingTurnRate) * delta
                  );
                currentDirection
                  .lerp(homingDirection, THREE.MathUtils.clamp(steer, 0, 1))
                  .normalize();
              }
            }
          }

          velocity.copy(currentDirection).multiplyScalar(speed);
          entry.spinPhase += entry.spinRate * delta;
          entry.mesh.quaternion.setFromUnitVectors(
            projectileForward,
            currentDirection
          );
          entry.mesh.rotateZ(entry.spinPhase);
          animateShurikenElectricArc(entry, performance.now(), delta);
          trailHead.copy(entry.mesh.position).addScaledVector(velocity, delta);
          pushShurikenTrailPoint(entry, trailHead);
        },
        onRemove: () => {
          entry.trail.visible = false;
          entry.trail.removeFromParent();
          resetShurikenTrail(entry, entry.mesh.position);
          entry.mesh.visible = false;
          entry.mesh.rotation.set(0, 0, 0);
          entry.mesh.scale.setScalar(1);
          setShurikenElectricState(entry, false, 1);
          entry.material.emissiveIntensity = 0.85;
          entry.trailMaterial.color.set(0x7dd3fc);
          entry.spinPhase = 0;
        },
      },
    });
  };

  const fireCloneSynchronizedShurikens = (ratio: number) => {
    if (!fireProjectile) return;
    if (!cloneState.active || !cloneState.clones.length) return;
    let didFireCloneShuriken = false;
    const fireAt = performance.now();

    const distanceScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minDistanceScale,
      skillEChargeConfig.maxDistanceScale,
      ratio
    );
    const targetDistance = skillEConfig.focusDistance * distanceScale;
    cloneScratchTarget
      .copy(skillEOrigin)
      .addScaledVector(skillEBaseDirection, targetDistance);
    const shotScale = skillEVolley.shurikenScale * 2;
    const shotDamage = 50;
    const shotRadius = skillEVolley.radius * 2;
    const shotHitRadius = skillEVolley.targetHitRadius * 2;
    const shotExplosionDamage = 85;
    const shotExplosionMinDamage = 40;
    const shotSpeed = skillEVolley.speed * 0.96;
    const shotLifetime = skillEVolley.lifetime * 1.12;

    for (let i = 0; i < cloneState.clones.length; i += 1) {
      const clone = cloneState.clones[i];
      if (!clone.root.parent || !clone.root.visible) continue;
      startCloneSkillEShootAnimation(clone, fireAt, true);
      clone.root.updateMatrixWorld(true);
      clone.heldShuriken.group.visible = false;
      const entry = acquireShuriken();
      entry.mesh.visible = true;
      entry.mesh.rotation.set(0, 0, 0);
      entry.mesh.scale.setScalar(shotScale);
      entry.material.emissiveIntensity = 1.58;
      setShurikenElectricState(entry, true, 2);
      entry.spinPhase = Math.random() * Math.PI * 2;
      entry.spinRate = 12.5 + Math.random() * 4;

      clone.root.getWorldPosition(cloneScratchTemp);
      clone.heldShuriken.group.getWorldPosition(skillEShotOrigin);
      if (!Number.isFinite(skillEShotOrigin.x + skillEShotOrigin.y + skillEShotOrigin.z)) {
        skillEShotOrigin.copy(cloneScratchTemp);
      }
      // Clamp launch height so clone shurikens do not spawn near/under ground on some arm poses.
      const minSpawnY = cloneScratchTemp.y + cloneConfig.eThrowOriginYOffset;
      if (skillEShotOrigin.y < minSpawnY) {
        skillEShotOrigin.y = minSpawnY;
      }
      cloneScratchDirection.copy(cloneScratchTarget).sub(skillEShotOrigin);
      if (cloneScratchDirection.lengthSq() < 0.000001) {
        cloneScratchDirection.copy(skillEBaseDirection);
      } else {
        cloneScratchDirection.normalize();
      }
      // Push spawn point slightly forward to avoid immediate overlap with clone meshes.
      skillEShotOrigin.addScaledVector(cloneScratchDirection, 0.34);

      const trailHost = avatar.parent ?? avatar;
      if (entry.trail.parent !== trailHost) {
        entry.trail.removeFromParent();
        trailHost.add(entry.trail);
      }
      entry.trail.visible = true;
      entry.trailMaterial.opacity = 0.84;
      entry.trailMaterial.color.set(0x60a5fa);
      resetShurikenTrail(entry, skillEShotOrigin);

      const currentDirection = new THREE.Vector3();
      const homingDirection = new THREE.Vector3();
      const trailHead = new THREE.Vector3();
      fireProjectile({
        projectileType: "shuriken",
        mesh: entry.mesh,
        origin: skillEShotOrigin,
        direction: cloneScratchDirection,
        speed: shotSpeed,
        lifetime: shotLifetime,
        radius: shotRadius,
        targetHitRadius: shotHitRadius,
        damage: shotDamage,
        energyGainOnHit: 0,
        splitOnImpact: true,
        explosionRadius: skillEVolley.explosionRadius,
        explosionDamage: shotExplosionDamage,
        explosionMinDamage: shotExplosionMinDamage,
        explodeOnTargetHit: false,
        explodeOnWorldHit: true,
        explodeOnExpire: false,
        removeOnTargetHit: true,
        removeOnWorldHit: true,
        lifecycle: {
          onTargetHit: ({ now, point, direction, triggerExplosion }) => {
            launchSkillEHitCutWave(now, point, direction, 1.22);
            triggerExplosion(null);
          },
          applyForces: ({ velocity, position, delta, findNearestTarget }) => {
            if (velocity.lengthSq() < 0.000001) return;
            currentDirection.copy(velocity).normalize();
            const nearestTarget = findNearestTarget?.({
              center: position,
              radius: cloneConfig.eShurikenHomingRadius,
            });
            if (nearestTarget) {
              homingDirection.copy(nearestTarget.point).sub(position);
              if (homingDirection.lengthSq() > 0.000001) {
                homingDirection.normalize();
                const steer =
                  1 -
                  Math.exp(
                    -Math.max(0.01, cloneConfig.eShurikenHomingTurnRate) * delta
                  );
                currentDirection
                  .lerp(homingDirection, THREE.MathUtils.clamp(steer, 0, 1))
                  .normalize();
              }
            }
            velocity.copy(currentDirection).multiplyScalar(shotSpeed);
            entry.spinPhase += entry.spinRate * delta;
            entry.mesh.quaternion.setFromUnitVectors(
              projectileForward,
              currentDirection
            );
            entry.mesh.rotateZ(entry.spinPhase);
            animateShurikenElectricArc(entry, performance.now(), delta);
            trailHead.copy(entry.mesh.position).addScaledVector(velocity, delta);
            pushShurikenTrailPoint(entry, trailHead);
          },
          onRemove: () => {
            entry.trail.visible = false;
            entry.trail.removeFromParent();
            resetShurikenTrail(entry, entry.mesh.position);
            entry.mesh.visible = false;
            entry.mesh.rotation.set(0, 0, 0);
            entry.mesh.scale.setScalar(1);
            setShurikenElectricState(entry, false, 1);
            entry.material.emissiveIntensity = 0.85;
            entry.trailMaterial.color.set(0x7dd3fc);
            entry.spinPhase = 0;
          },
        },
      });
      didFireCloneShuriken = true;
    }

    if (didFireCloneShuriken) {
      cloneState.consumePending = true;
      cloneState.consumeAfterShootAt = fireAt + 220;
    }
  };

  const updateSkillEVolley = (now: number) => {
    if (!skillEVolley.active) return;
    while (
      skillEVolley.firedCount < skillEConfig.shotCount &&
      now >= skillEVolley.nextShotAt
    ) {
      fireSkillEShuriken(skillEVolley.firedCount);
      skillEVolley.firedCount += 1;
      skillEVolley.nextShotAt += skillEConfig.shotIntervalMs;
    }
    if (skillEVolley.firedCount >= skillEConfig.shotCount) {
      skillEVolley.active = false;
      skillEVolley.cloneBoosted = false;
    }
  };

  const beginSkillECharge = (now: number) => {
    if (skillEChargeState.isCharging) return;
    skillEChargeState.isCharging = true;
    skillEChargeState.startTime = now;
    skillEChargeState.ratio = 0;
    hud.setVisible(true);
    hud.setRatio(0);
  };

  const cancelSkillECharge = () => {
    skillEChargeState.isCharging = false;
    skillEChargeState.startTime = 0;
    skillEChargeState.ratio = 0;
    if (!chargeState.isCharging && chargeState.releaseUntil === 0) {
      hud.setVisible(false);
      hud.setRatio(0);
    }
  };

  const releaseSkillECharge = (now: number = performance.now()) => {
    if (!fireProjectile) return;
    if (!skillEChargeState.isCharging) return;
    if (skillEVolley.active) {
      cancelSkillECharge();
      return;
    }

    const ratio = resolveSkillEChargeRatio(now);
    avatar.updateMatrixWorld(true);
    resolveSkillEOriginWorld(skillEOrigin);
    if (!Number.isFinite(skillEOrigin.x + skillEOrigin.y + skillEOrigin.z)) {
      avatar.getWorldPosition(skillEOrigin);
    }
    resolveSkillEBaseDirection();
    skillEVolley.origin.copy(skillEOrigin);
    skillEVolley.baseDirection.copy(skillEBaseDirection);
    skillEVolley.right.copy(skillERight);
    configureSkillEVolleyForCharge(ratio);

    skillEChargeState.isCharging = false;
    skillEChargeState.startTime = 0;
    skillEChargeState.ratio = ratio;
    if (!chargeState.isCharging && chargeState.releaseUntil === 0) {
      hud.setVisible(false);
      hud.setRatio(0);
    }

    skillEVolley.active = true;
    skillEVolley.cloneBoosted = isCloneShurikenBuffActive();
    skillEVolley.firedCount = 0;
    skillEVolley.nextShotAt = now;
    startSkillEShootAnimation(now, skillEVolley.cloneBoosted);
    fireCloneSynchronizedShurikens(ratio);
  };

  const handleSkillEKeyUp = (event: KeyboardEvent) => {
    if (event.code !== "KeyE") return;
    releaseSkillECharge(performance.now());
  };
  const handleSkillEBlur = () => {
    if (!skillEChargeState.isCharging) return;
    releaseSkillECharge(performance.now());
  };
  const canBindWindowEvents = typeof window !== "undefined";
  if (canBindWindowEvents) {
    window.addEventListener("keyup", handleSkillEKeyUp);
    window.addEventListener("blur", handleSkillEBlur);
  }

  const resetSkillEVolleyState = () => {
    skillEVolley.active = false;
    skillEVolley.cloneBoosted = false;
    skillEVolley.firedCount = 0;
    skillEVolley.nextShotAt = 0;
    skillEVolley.origin.set(0, 0, 0);
    skillEVolley.baseDirection.set(0, 0, 1);
    skillEVolley.right.set(1, 0, 0);
    skillEVolley.speed = skillEConfig.speed;
    skillEVolley.lifetime = skillEConfig.lifetime;
    skillEVolley.radius = skillEConfig.radius;
    skillEVolley.targetHitRadius = skillEConfig.targetHitRadius;
    skillEVolley.shurikenScale = 1;
    skillEVolley.explosionRadius = skillEConfig.explosionRadius;
    skillEVolley.explosionDamage = skillEConfig.explosionDamage;
  };

  const launchChargedSwordWaveProjectile = ({
    origin,
    direction,
    baseDamage,
  }: {
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    baseDamage: number;
  }) => {
    if (!fireProjectile) return;
    const resolvedBaseDamage = Math.max(1, Math.round(baseDamage));
    const entry = acquireChargedSwordWave();
    const resolvedDirection = direction.clone();
    if (resolvedDirection.lengthSq() < 0.000001) {
      resolvedDirection.set(0, 0, 1);
    } else {
      resolvedDirection.normalize();
    }

    entry.mesh.visible = true;
    entry.mesh.position.copy(origin);
    entry.mesh.scale.setScalar(1.02);
    entry.mesh.quaternion.setFromUnitVectors(
      projectileForward,
      resolvedDirection
    );
    entry.material.opacity = 0.78;
    entry.material.emissiveIntensity = 1.34;
    entry.spinDirection = Math.random() > 0.5 ? 1 : -1;

    fireProjectile({
      projectileType: "shuriken",
      mesh: entry.mesh,
      origin,
      direction: resolvedDirection,
      speed: chargedSwordWaveConfig.speed,
      lifetime: chargedSwordWaveConfig.lifetime,
      gravity: 0,
      radius: chargedSwordWaveConfig.radius,
      targetHitRadius: chargedSwordWaveConfig.targetHitRadius,
      damage: Math.round(
        resolvedBaseDamage * chargedSwordWaveConfig.damageMultiplier
      ),
      splitOnImpact: false,
      explodeOnTargetHit: false,
      explodeOnWorldHit: false,
      explodeOnExpire: false,
      removeOnTargetHit: false,
      removeOnWorldHit: true,
      singleHitPerTarget: true,
      grantEnergyOnTargetHit: false,
      grantManaOnTargetHit: false,
      energyGainOnHit: 0,
      manaGainOnHit: 0,
      lifecycle: {
        applyForces: ({ velocity, delta }) => {
          if (velocity.lengthSq() < 0.000001) return;
          chargedSwordWaveVelocityDirection.copy(velocity).normalize();
          entry.mesh.quaternion.setFromUnitVectors(
            projectileForward,
            chargedSwordWaveVelocityDirection
          );
          entry.mesh.rotateZ(entry.spinDirection * delta * 2.2);
          entry.mesh.rotation.y += delta * 0.95;
          entry.material.emissiveIntensity =
            1.22 + Math.sin(performance.now() * 0.02) * 0.18;
        },
        onRemove: () => {
          entry.mesh.visible = false;
          entry.mesh.rotation.set(0, 0, 0);
          entry.mesh.scale.setScalar(1);
          entry.material.opacity = 0.78;
          entry.material.emissiveIntensity = 1.2;
        },
      },
    });
  };

  const launchReflectedChargedSwordWave = (
    hitPoint: THREE.Vector3,
    reflectedDirection: THREE.Vector3
  ) => {
    chargedSwordWaveDirection.copy(reflectedDirection);
    if (chargedSwordWaveDirection.lengthSq() < 0.000001) {
      chargedSwordWaveDirection.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    }
    if (chargedSwordWaveDirection.lengthSq() < 0.000001) {
      chargedSwordWaveDirection.set(0, 0, 1);
    } else {
      chargedSwordWaveDirection.normalize();
    }
    const spawnOffset = Math.max(0.18, chargedSwordWaveConfig.radius * 0.7);
    chargedSwordWaveOrigin
      .copy(hitPoint)
      .addScaledVector(chargedSwordWaveDirection, spawnOffset);
    launchChargedSwordWaveProjectile({
      origin: chargedSwordWaveOrigin,
      direction: chargedSwordWaveDirection,
      baseDamage: primarySwingConfig.maxDamage,
    });
  };

  const fireChargedSwordWave = (baseDamage: number) => {
    chargedSwordWaveDirection.copy(skillEAimDirection);
    chargedSwordWaveDirection.y = 0;
    if (chargedSwordWaveDirection.lengthSq() < 0.000001) {
      chargedSwordWaveDirection.set(0, 0, 1).applyQuaternion(avatar.quaternion);
      chargedSwordWaveDirection.y = 0;
    }
    if (chargedSwordWaveDirection.lengthSq() < 0.000001) {
      chargedSwordWaveDirection.set(0, 0, 1);
    } else {
      chargedSwordWaveDirection.normalize();
    }

    avatar.updateMatrixWorld(true);
    avatar.getWorldPosition(chargedSwordWaveOrigin);
    chargedSwordWaveOrigin.y += chargedSwordWaveConfig.spawnHeight;
    chargedSwordWaveOrigin.addScaledVector(
      chargedSwordWaveDirection,
      chargedSwordWaveConfig.spawnForward
    );

    launchChargedSwordWaveProjectile({
      origin: chargedSwordWaveOrigin,
      direction: chargedSwordWaveDirection,
      baseDamage,
    });
  };

  const getMovementSpeedMultiplier = () =>
    skillRState.active
      ? skillRConfig.movementSpeedMultiplier
      : skillQSuperState.active
        ? 0
        : skillQState.active && runtimeIsSprinting
          ? 1 / Math.max(1, profile.movement?.sprintMultiplier ?? 1.6)
        : 1;

  const isBasicAttackLocked = () =>
    skillQState.active || skillQSuperState.active || skillRState.active;

  const handleSkillE = () => {
    if (skillQState.active || skillQSuperState.active || skillRState.active) {
      return false;
    }
    if (!fireProjectile) return false;
    if (skillEVolley.active || skillEChargeState.isCharging) return false;
    if (chargeState.isCharging || chargeState.releaseUntil > performance.now()) {
      return false;
    }
    requestArmPoseReset();
    beginSkillECharge(performance.now());
    return true;
  };

  const beginCharge = () => {
    if (
      skillQState.active ||
      skillQSuperState.active ||
      skillRState.active ||
      chargeState.isCharging ||
      skillEChargeState.isCharging ||
      skillEVolley.active
    ) {
      return;
    }
    requestArmPoseReset();
    chargeState.isCharging = true;
    chargeState.startTime = performance.now();
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    hud.setVisible(true);
    hud.setRatio(0);
  };

  const cancelCharge = () => {
    if (!chargeState.isCharging && chargeState.releaseUntil === 0) return;
    chargeState.isCharging = false;
    chargeState.startTime = 0;
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    requestArmPoseReset();
    if (!skillEChargeState.isCharging) {
      hud.setVisible(false);
      hud.setRatio(0);
    }
  };

  const releaseCharge = () => {
    if (
      skillQState.active ||
      skillQSuperState.active ||
      skillRState.active ||
      !chargeState.isCharging
    ) {
      return;
    }
    const now = performance.now();
    const elapsed = now - chargeState.startTime;
    if (elapsed < chargeConfig.minHoldMs) {
      cancelCharge();
      return;
    }

    const ratio = THREE.MathUtils.clamp(
      elapsed / chargeConfig.maxHoldMs,
      0,
      1
    );
    chargeState.isCharging = false;
    chargeState.ratio = ratio;
    chargeState.releaseUntil = now + chargeConfig.releaseMs;
    hud.setVisible(true);
    hud.setRatio(ratio);

    const damage = Math.round(
      THREE.MathUtils.lerp(
        primarySwingConfig.minDamage,
        primarySwingConfig.maxDamage,
        ratio
      )
    );
    const meleeRange = THREE.MathUtils.lerp(
      primarySwingConfig.minRange,
      primarySwingConfig.maxRange,
      ratio
    );
    const meleeHitRadius = THREE.MathUtils.lerp(
      primarySwingConfig.minHitRadius,
      primarySwingConfig.maxHitRadius,
      ratio
    );
    const hitCount =
      performMeleeAttack?.({
        damage,
        maxDistance: meleeRange,
        hitRadius: meleeHitRadius,
        maxHits: 6,
      }) ?? 0;
    if (hitCount > 0) {
      applyEnergy?.(hitCount * primarySwingConfig.energyGainOnHit);
      applyMana?.(hitCount * manaGainOnReflectOrBasicDamage);
    }
    if (ratio >= chargedSwordWaveConfig.fullChargeThreshold) {
      fireChargedSwordWave(damage);
    }

    startPrimarySwing(now, ratio);
    startPrimaryNormalAttackAnimation(now, runtimeIsMoving);
  };

  const resetState = () => {
    runtimeLastUpdateAt = 0;
    runtimeAvatarModelRef = null;
    resetRuntimeAnimationPlayback();
    chargeState.startTime = 0;
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    cancelSkillECharge();
    resetSkillEVolleyState();
    armAnim.draw = 0;
    armBase.captured = false;
    armNeutral.captured = false;
    armNeutral.rightId = "";
    armNeutral.leftId = "";
    cancelCharge();
    armPoseResetState.requested = false;
    clearPrimarySwing();
    clearSkillQ();
    clearSkillQSuper();
    clearSkillR();
    clearSkillRAfterImages();
    clearSkillQSuperHitFx();
    clearSkillRDanceWaves();
    clearAllClones();
    clearCloneSmoke();
    skillQDarknessOverlay.reset();
    drawSword.setVisible(false);
    drawSword.attachTo(null);
    heldShuriken.setVisible(false);
    heldShuriken.attachTo(null);
    swordWavePool.forEach((entry) => {
      entry.mesh.removeFromParent();
      entry.mesh.visible = false;
      entry.mesh.rotation.set(0, 0, 0);
      entry.mesh.scale.setScalar(1);
    });
    chargedSwordWavePool.forEach((entry) => {
      entry.mesh.removeFromParent();
      entry.mesh.visible = false;
      entry.mesh.rotation.set(0, 0, 0);
      entry.mesh.scale.setScalar(1);
      entry.material.opacity = 0.78;
      entry.material.emissiveIntensity = 1.2;
    });
    shurikenPool.forEach((entry) => {
      entry.mesh.removeFromParent();
      entry.mesh.visible = false;
      entry.mesh.rotation.set(0, 0, 0);
      entry.mesh.scale.setScalar(1);
      entry.trail.visible = false;
      entry.trail.removeFromParent();
      resetShurikenTrail(entry, avatar.position);
      entry.spinPhase = 0;
    });
    baseRuntime.resetState?.();
  };

  const handleSkillQ = () => {
    if (skillQState.active || skillQSuperState.active || skillRState.active) {
      return false;
    }
    const now = performance.now();
    if (cloneState.active && cloneState.clones.length > 0 && !cloneState.consumePending) {
      return startSkillQSuper(now);
    }
    if ((getCurrentStats?.().energy ?? 1) <= 0) return false;

    cancelCharge();
    cancelSkillECharge();
    resetSkillEVolleyState();
    clearPrimarySwing();
    requestArmPoseReset();
    startSkillQ(now);
    return true;
  };

  const handleSkillR = () => {
    if (skillQState.active || skillQSuperState.active || skillRState.active) {
      return false;
    }
    cancelCharge();
    cancelSkillECharge();
    resetSkillEVolleyState();
    clearPrimarySwing();
    clearSkillRDanceWaves();
    requestArmPoseReset();
    startSkillR(performance.now());
    return true;
  };

  const beforeSkillUse: NonNullable<CharacterRuntime["beforeSkillUse"]> = ({
    key,
  }) => {
    if (key !== "q") return;
    if (skillQState.active || skillQSuperState.active || skillRState.active) {
      return { allow: false };
    }
    if (cloneState.active && cloneState.clones.length > 0 && !cloneState.consumePending) {
      // Q recast during clone phase should bypass original Q cooldown/cost.
      return { ignoreCostAndCooldown: true };
    }
  };

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handlePrimaryDown: beginCharge,
    handlePrimaryUp: releaseCharge,
    handlePrimaryCancel: cancelCharge,
    handleSkillQ,
    handleSkillE,
    handleSkillR,
    getProjectileBlockers,
    handleProjectileBlockHit,
    getMovementSpeedMultiplier,
    isBasicAttackLocked,
    beforeSkillUse,
    isMovementLocked: baseRuntime.isMovementLocked,
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    resetState,
    update: (args) => {
      baseRuntime.update(args);
      if (runtimeAvatarModelRef !== args.avatarModel) {
        restoreSkillRShadowForm();
      }
      runtimeAvatarModelRef = args.avatarModel;
      runtimeIsMoving = args.isMoving;
      runtimeIsSprinting = Boolean(args.isSprinting);
      bindRuntimeAnimationModel(args.avatarModel);
      const deltaSeconds = resolveRuntimeDeltaSeconds(args.now);
      if (args.aimDirectionWorld && args.aimDirectionWorld.lengthSq() > 0.000001) {
        skillEAimDirection.copy(args.aimDirectionWorld).normalize();
      }
      if (skillEChargeState.isCharging) {
        const ratio = resolveSkillEChargeRatio(args.now);
        skillEChargeState.ratio = ratio;
        hud.setVisible(true);
        hud.setRatio(ratio);
        if (ratio >= 1) {
          releaseSkillECharge(args.now);
        }
      }
      updateSkillEVolley(args.now);
      updatePrimarySwing(args.now);
      updateSkillRDanceWaves(args.now);
      updateSkillQSuperHitFx(args.now);
      updateSkillQ(args.now);
      updateSkillQSuper(args.now, deltaSeconds);
      skillQDarknessOverlay.update(0, deltaSeconds);
      updateSkillR(args.now);
      const animationDeltaSeconds = deltaSeconds;
      const skillRSwingShadowActive =
        skillRState.active && Boolean(primarySwingState.entry);
      updateSkillRShadowForm(skillRSwingShadowActive, animationDeltaSeconds);
      updateSkillRAfterImages(args.now);
      if (!skillQSuperState.active) {
        updateClones(
          args.now,
          deltaSeconds,
          skillEChargeState.isCharging,
          skillEChargeState.ratio,
          args.isMoving,
          Boolean(args.isSprinting)
        );
      }
      updateCloneSmoke(deltaSeconds);

      if (chargeState.isCharging) {
        const elapsed = args.now - chargeState.startTime;
        const ratio = THREE.MathUtils.clamp(
          elapsed / chargeConfig.maxHoldMs,
          0,
          1
        );
        chargeState.ratio = ratio;
        hud.setVisible(true);
        hud.setRatio(ratio);
      } else if (
        chargeState.releaseUntil > 0 &&
        args.now >= chargeState.releaseUntil
      ) {
        chargeState.releaseUntil = 0;
        requestArmPoseReset();
        hud.setVisible(false);
        hud.setRatio(0);
      }

      if (!args.arms.length) {
        drawSword.setVisible(false);
        drawSword.attachTo(null);
        heldShuriken.setVisible(false);
        heldShuriken.attachTo(null);
        updateRuntimeAnimationState({
          now: args.now,
          deltaSeconds: animationDeltaSeconds,
          isMoving: args.isMoving,
          isSprinting: Boolean(args.isSprinting),
        });
        return;
      }

      const releaseActive = chargeState.releaseUntil > args.now;
      const normalAttackActive = runtimeNormalAttackEndsAt > args.now;
      const targetDraw = 0;
      const damp = 0.2;
      armAnim.draw = THREE.MathUtils.lerp(armAnim.draw, targetDraw, damp);

      const leftArm = pickArm(args.arms, "left") ?? args.arms[0];
      const rightArm =
        pickArm(args.arms.filter((arm) => arm !== leftArm), "right") ??
        args.arms.find((arm) => arm !== leftArm) ??
        leftArm;

      captureArmNeutralIfNeeded(rightArm, leftArm);
      applyArmPoseResetIfRequested(rightArm, leftArm);
      heldShuriken.attachTo(null);
      heldShuriken.setVisible(false);
      heldShuriken.setChargeRatio(0);

      if (skillQState.active || skillQSuperState.active || skillRState.active) {
        armAnim.draw = THREE.MathUtils.lerp(armAnim.draw, 0, 0.24);
        armBase.captured = false;
        drawSword.setVisible(false);
        drawSword.attachTo(null);
        updateRuntimeAnimationState({
          now: args.now,
          deltaSeconds: animationDeltaSeconds,
          isMoving: args.isMoving,
          isSprinting: Boolean(args.isSprinting),
        });
        return;
      }

      const poseActive = armAnim.draw > 0.02;
      if (!poseActive) {
        if (armBase.captured) {
          const sameTargets =
            armBase.rightId === rightArm.uuid && armBase.leftId === leftArm.uuid;
          if (sameTargets) {
            rightArm.quaternion.copy(armBase.right);
            leftArm.quaternion.copy(armBase.left);
          }
        }
        restoreArmNeutralPose(rightArm, leftArm);
        armBase.captured = false;
        drawSword.setVisible(false);
        drawSword.attachTo(null);
        updateRuntimeAnimationState({
          now: args.now,
          deltaSeconds: animationDeltaSeconds,
          isMoving: args.isMoving,
          isSprinting: Boolean(args.isSprinting),
        });
        return;
      }

      if (
        !armBase.captured ||
        armBase.rightId !== rightArm.uuid ||
        armBase.leftId !== leftArm.uuid
      ) {
        armBase.captured = true;
        armBase.rightId = rightArm.uuid;
        armBase.leftId = leftArm.uuid;
        armBase.right.copy(rightArm.quaternion);
        armBase.left.copy(leftArm.quaternion);
      }

      const showDrawSword = chargeState.isCharging || releaseActive;
      if (showDrawSword) {
        drawSword.attachTo(rightArm);
        drawSword.setVisible(true);
        drawSword.setDrawRatio(armAnim.draw);
      } else {
        drawSword.setVisible(false);
        drawSword.attachTo(null);
      }

      const drawBackAngle = -0.32 - armAnim.draw * 1.04;
      const drawTwist = 0.1 + armAnim.draw * 0.52;
      const drawRoll = -0.12 - armAnim.draw * 0.46;
      const releaseSnap = releaseActive
        ? Math.sin(
            THREE.MathUtils.clamp(
              1 - (chargeState.releaseUntil - args.now) / chargeConfig.releaseMs,
              0,
              1
            ) * Math.PI
          ) * 0.48
        : 0;
      rightQuatX.setFromAxisAngle(
        axisX,
        drawBackAngle + releaseSnap
      );
      rightQuatY.setFromAxisAngle(axisY, drawTwist);
      rightQuatZ.setFromAxisAngle(axisZ, drawRoll);
      rightArm.quaternion
        .copy(armBase.right)
        .premultiply(rightQuatX)
        .premultiply(rightQuatY)
        .premultiply(rightQuatZ);

      const movingPrimaryRightArmOnly =
        args.isMoving &&
        (chargeState.isCharging || releaseActive || normalAttackActive);
      if (movingPrimaryRightArmOnly) {
        leftArm.quaternion.copy(armBase.left);
      } else {
        const leftGuard = -0.06 + armAnim.draw * 0.22;
        const leftRoll = 0.05 + armAnim.draw * 0.09;
        leftQuatX.setFromAxisAngle(axisX, leftGuard);
        leftQuatZ.setFromAxisAngle(axisZ, leftRoll);
        leftArm.quaternion
          .copy(armBase.left)
          .premultiply(leftQuatX)
          .premultiply(leftQuatZ);
      }

      updateRuntimeAnimationState({
        now: args.now,
        deltaSeconds: animationDeltaSeconds,
        isMoving: args.isMoving,
        isSprinting: Boolean(args.isSprinting),
      });
    },
    dispose: () => {
      if (canBindWindowEvents) {
        window.removeEventListener("keyup", handleSkillEKeyUp);
        window.removeEventListener("blur", handleSkillEBlur);
      }
      resetState();
      clearRuntimeAnimationBindings();
      clearAllClones();
      clearCloneSmoke();
      cloneAnchor.removeFromParent();
      disposeSkillQSealGlyphTextures();
      skillQDarknessOverlay.dispose();
      hud.dispose();
      drawSword.dispose();
      heldShuriken.dispose();
      primaryReflectVolume.removeFromParent();
      primaryReflectVolumeGeometry.dispose();
      primaryReflectVolumeMaterial.dispose();
      skillRReflectVolume.removeFromParent();
      skillRReflectVolumeGeometry.dispose();
      skillRReflectVolumeMaterial.dispose();
      clearSkillQSuperHitFx();
      disposeSkillQSuperHitFx();
      skillQSuperHitSlashGeometry.dispose();
      skillQSuperHitRingGeometry.dispose();
      clearSkillRDanceWaves();
      skillRDanceWavePool.forEach((entry) => {
        entry.mesh.removeFromParent();
        entry.material.dispose();
      });
      skillRDanceWaveGeometry.dispose();
      swordWavePool.forEach((entry) => {
        entry.mesh.removeFromParent();
        entry.material.dispose();
      });
      swordWaveGeometry.dispose();
      chargedSwordWavePool.forEach((entry) => {
        entry.mesh.removeFromParent();
        entry.material.dispose();
      });
      chargedSwordWaveGeometry.dispose();
      shurikenPool.forEach((entry) => {
        entry.mesh.removeFromParent();
        entry.trail.removeFromParent();
        entry.material.dispose();
        entry.trailMaterial.dispose();
        entry.trailGeometry.dispose();
        entry.arcGeometryA.dispose();
        entry.arcGeometryB.dispose();
        entry.arcMaterialA.dispose();
        entry.arcMaterialB.dispose();
      });
      shurikenGeometry.dispose();
      cloneSmokeGeometry.dispose();
      baseRuntime.dispose();
    },
    isFacingLocked: baseRuntime.isFacingLocked,
  });
};




