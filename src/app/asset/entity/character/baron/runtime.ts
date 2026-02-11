import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createCharacterRuntime } from "../player/runtimeBase";
import { CharacterRuntimeObject } from "../player/runtimeObject";
import {
  tryReflectLinearProjectile,
  type ProjectileReflector,
} from "../../../object/projectile/reflection";
import type { CharacterRuntime, CharacterRuntimeFactory } from "../types";
import { profile } from "./profile";

type ChargeHud = {
  setVisible: (visible: boolean) => void;
  setRatio: (ratio: number) => void;
  dispose: () => void;
};

const createShurikenChargeHud = (mount?: HTMLElement): ChargeHud => {
  if (!mount) {
    return {
      setVisible: () => {},
      setRatio: () => {},
      dispose: () => {},
    };
  }

  const hudHost = mount.parentElement ?? mount;
  if (!hudHost.style.position) {
    hudHost.style.position = "relative";
  }

  const hud = document.createElement("div");
  hud.style.cssText =
    "position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);" +
    "width:196px;height:196px;pointer-events:none;opacity:0;" +
    "transition:opacity 140ms ease;z-index:6;";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 180 180");
  svg.setAttribute("width", "196");
  svg.setAttribute("height", "196");

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
  shuriken.setAttribute(
    "points",
    "90,24 106,70 154,90 106,110 90,156 74,110 26,90 74,70"
  );
  shuriken.setAttribute("fill", "rgba(148,163,184,0.28)");
  shuriken.setAttribute("stroke", "rgba(186,230,253,0.95)");
  shuriken.setAttribute("stroke-width", "4");

  const shurikenCore = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  shurikenCore.setAttribute("cx", "90");
  shurikenCore.setAttribute("cy", "90");
  shurikenCore.setAttribute("r", "14");
  shurikenCore.setAttribute("fill", "rgba(186,230,253,0.85)");
  shurikenCore.setAttribute("stroke", "rgba(59,130,246,0.9)");
  shurikenCore.setAttribute("stroke-width", "3");

  shurikenGroup.appendChild(shuriken);
  shurikenGroup.appendChild(shurikenCore);
  svg.appendChild(track);
  svg.appendChild(fill);
  svg.appendChild(shurikenGroup);
  hud.appendChild(svg);
  hudHost.appendChild(hud);

  let ringLength = 0;
  const setRatio = (ratio: number) => {
    if (!ringLength) {
      ringLength = fill.getTotalLength();
      fill.style.strokeDasharray = `${ringLength}`;
    }
    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    fill.style.strokeDashoffset = `${ringLength * (1 - clamped)}`;
    shurikenGroup.setAttribute(
      "transform",
      `translate(90 90) rotate(${clamped * 300}) scale(${0.9 + clamped * 0.12}) translate(-90 -90)`
    );
    shurikenCore.setAttribute("r", `${14 + clamped * 4}`);
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
  hp: number;
  speed: number;
  direction: THREE.Vector3;
  nextTurnAt: number;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

const createSwordWaveEntry = (
  geometry: THREE.BufferGeometry
): SwordWaveEntry => {
  const material = new THREE.MeshStandardMaterial({
    color: 0xbfe8ff,
    roughness: 0.2,
    metalness: 0.14,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
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

const createSkillRDanceWaveEntry = (
  geometry: THREE.BufferGeometry
): SkillRDanceWaveEntry => {
  const material = new THREE.MeshStandardMaterial({
    color: 0xf0fdff,
    roughness: 0.16,
    metalness: 0.34,
    emissive: 0x67e8f9,
    emissiveIntensity: 1.45,
    transparent: true,
    opacity: 0.8,
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
  const hud = createShurikenChargeHud(mount);
  const drawSword = createDrawSwordFx(avatar);
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
    minFxScale: 0.58,
    maxFxScale: 1.12,
    minReflectSpeedMultiplier: 1.05,
    maxReflectSpeedMultiplier: 2.35,
    energyGainOnReflect: 15,
    energyGainOnHit: 30,
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
  const cloneArmQuatX = new THREE.Quaternion();
  const cloneArmQuatY = new THREE.Quaternion();
  const cloneArmQuatZ = new THREE.Quaternion();
  const swingOrigin = new THREE.Vector3();
  const swingForward = new THREE.Vector3();
  const swingRight = new THREE.Vector3();
  const swingUp = new THREE.Vector3(0, 1, 0);
  const swingFacing = new THREE.Quaternion();

  const swordWaveGeometry = createSwordWaveGeometry();
  const swordWavePool: SwordWaveEntry[] = Array.from({ length: 8 }, () =>
    createSwordWaveEntry(swordWaveGeometry)
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
    waveMinScale: 0.85,
    waveMaxScale: 1.28,
  };
  const skillRState = {
    active: false,
    startedAt: 0,
    endsAt: 0,
    nextMeleeAt: 0,
    nextWaveSide: 1 as 1 | -1,
  };
  const cloneConfig = {
    count: 5,
    durationMs: 10000,
    hpRatio: 1 / 3,
    speedRatio: 1 / 3,
    minTurnIntervalMs: 420,
    maxTurnIntervalMs: 1350,
    spawnRadiusMin: 1.25,
    spawnRadiusMax: 2.65,
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
  };
  const cloneState = {
    active: false,
    startedAt: 0,
    endsAt: 0,
    clones: [] as BaronClone[],
  };
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
  let runtimeLastUpdateAt = 0;
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
    minArcHeight: 0.24,
    maxArcHeight: 2.35,
    minOutwardPhaseScale: 1,
    maxOutwardPhaseScale: 1.95,
    minOutwardBiasScale: 1,
    maxOutwardBiasScale: 1.7,
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
    lifetime: 0.62,
    damage: 17,
    radius: 0.26,
    targetHitRadius: 0.32,
    forwardSpawn: 0.34,
    lateralSpawn: 0.28,
    verticalSpawn: 0,
    spreadRad: THREE.MathUtils.degToRad(16),
    outwardLateralBias: 0.28,
    outwardPhaseRatio: 0.36,
    turnRateMin: 4.8,
    turnRateMax: 9.2,
    focusDistance: 8.8,
    focusHeight: 0,
    convergeSnapPadding: 0.12,
    explosionRadius: 5.2,
    explosionDamage: 48,
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
    focusPoint: new THREE.Vector3(),
    speed: skillEConfig.speed,
    lifetime: skillEConfig.lifetime,
    radius: skillEConfig.radius,
    targetHitRadius: skillEConfig.targetHitRadius,
    shurikenScale: 1,
    outwardPhaseRatio: skillEConfig.outwardPhaseRatio,
    outwardLateralBias: skillEConfig.outwardLateralBias,
    arcHeight: skillEChargeConfig.minArcHeight,
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

  const scoreArmCandidate = (
    arm: THREE.Object3D,
    side: "right" | "left"
  ) => {
    const name = (arm.name || "").toLowerCase();
    let score = 0;
    if (name.includes(side)) score += 10;
    if (name.includes("arm")) score += 5;
    if (name.includes("upper") || name.includes("shoulder")) score += 3;
    if (name.includes("hand") || name.includes("fore") || name.includes("lower")) {
      score -= 6;
    }
    if (name === `arm${side}` || name === `${side}arm`) score += 6;
    return score;
  };

  const pickArm = (arms: THREE.Object3D[], side: "right" | "left") => {
    let best: THREE.Object3D | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < arms.length; i += 1) {
      const arm = arms[i];
      const score = scoreArmCandidate(arm, side);
      if (score > bestScore) {
        best = arm;
        bestScore = score;
      }
    }
    return best;
  };

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

  const isCloneShurikenBuffActive = () =>
    cloneState.active && cloneState.clones.length > 0;

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

  const clearClone = (clone: BaronClone, spawnSmoke: boolean) => {
    if (spawnSmoke && clone.root.parent && clone.root.visible) {
      clone.root.updateMatrixWorld(true);
      clone.root.getWorldPosition(cloneScratchTemp);
      spawnCloneSmokeBurst(cloneScratchTemp, 6);
    }
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

  const clearAllClones = (spawnSmoke: boolean = false) => {
    for (let i = 0; i < cloneState.clones.length; i += 1) {
      clearClone(cloneState.clones[i], spawnSmoke);
    }
    cloneState.clones.length = 0;
    cloneState.active = false;
    cloneState.startedAt = 0;
    cloneState.endsAt = 0;
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
        hp: Math.max(1, baseHealth * cloneConfig.hpRatio),
        speed: cloneBaseSpeed * THREE.MathUtils.lerp(0.85, 1.18, Math.random()),
        direction: cloneScratchDirection.clone(),
        nextTurnAt: now + THREE.MathUtils.lerp(300, 900, Math.random()),
        materials,
        geometries,
      };
      cloneAnchor.add(root);
      cloneState.clones.push(clone);
      spawnCloneSmokeBurst(root.position, 5);
    }

    cloneState.active = cloneState.clones.length > 0;
    cloneState.startedAt = now;
    cloneState.endsAt = now + cloneConfig.durationMs;
    if (cloneState.active) {
      spawnCloneSmokeBurst(cloneScratchOrigin, 12);
    }
  };

  const updateClones = (
    now: number,
    deltaSeconds: number,
    eChargeActive: boolean,
    eChargeRatio: number
  ) => {
    if (!cloneState.active) return;
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
      const isCloneMoving = !preparingThrow;
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
        preparingThrow ? 0.38 : 0.22
      );
      const crouchDepth = preparingThrow
        ? THREE.MathUtils.lerp(
            cloneConfig.preparingCrouchDepthMin,
            cloneConfig.preparingCrouchDepthMax,
            eChargeRatio
          )
        : 0;
      const leanForward = preparingThrow
        ? THREE.MathUtils.lerp(
            cloneConfig.preparingLeanMin,
            cloneConfig.preparingLeanMax,
            eChargeRatio
          )
        : 0;
      const legBend = preparingThrow
        ? THREE.MathUtils.lerp(
            cloneConfig.preparingLegBendMin,
            cloneConfig.preparingLegBendMax,
            eChargeRatio
          )
        : 0;
      const legSpread = preparingThrow
        ? THREE.MathUtils.lerp(
            cloneConfig.preparingLegSpreadMin,
            cloneConfig.preparingLegSpreadMax,
            eChargeRatio
          )
        : 0;
      const legTwist = preparingThrow
        ? THREE.MathUtils.lerp(
            cloneConfig.preparingLegTwistMin,
            cloneConfig.preparingLegTwistMax,
            eChargeRatio
          )
        : 0;
      const handLiftY = preparingThrow
        ? THREE.MathUtils.lerp(
            cloneConfig.preparingHandLiftYMin,
            cloneConfig.preparingHandLiftYMax,
            eChargeRatio
          )
        : 0;
      const handForward = preparingThrow
        ? THREE.MathUtils.lerp(
            cloneConfig.preparingHandForwardMin,
            cloneConfig.preparingHandForwardMax,
            eChargeRatio
          )
        : 0;
      const bodySquash = preparingThrow
        ? THREE.MathUtils.lerp(
            cloneConfig.preparingBodySquashMin,
            cloneConfig.preparingBodySquashMax,
            eChargeRatio
          )
        : 1;
      const bodyWiden = preparingThrow
        ? THREE.MathUtils.lerp(
            cloneConfig.preparingBodyWidenMin,
            cloneConfig.preparingBodyWidenMax,
            eChargeRatio
          )
        : 1;

      if (clone.model) {
        profile.animateModel?.({
          avatarModel: clone.model,
          isMoving: isCloneMoving,
          isSprinting: false,
          now,
          THREE,
        });
        clone.walkPhase += deltaSeconds * (isCloneMoving ? 4.2 + clone.speed * 0.3 : 1.6);
        clone.model.position.y = THREE.MathUtils.lerp(
          clone.model.position.y,
          isCloneMoving ? Math.sin(clone.walkPhase + i * 0.45) * 0.055 : -crouchDepth,
          isCloneMoving ? 0.24 : preparingThrow ? 0.28 : 0.16
        );
        clone.model.rotation.x = THREE.MathUtils.lerp(
          clone.model.rotation.x,
          preparingThrow ? leanForward : 0,
          preparingThrow ? 0.3 : 0.16
        );
        clone.model.rotation.z = THREE.MathUtils.lerp(
          clone.model.rotation.z,
          0,
          preparingThrow ? 0.28 : 0.14
        );
        clone.model.scale.x = THREE.MathUtils.lerp(
          clone.model.scale.x,
          bodyWiden,
          preparingThrow ? 0.26 : 0.14
        );
        clone.model.scale.y = THREE.MathUtils.lerp(
          clone.model.scale.y,
          bodySquash,
          preparingThrow ? 0.26 : 0.14
        );
        clone.model.scale.z = THREE.MathUtils.lerp(
          clone.model.scale.z,
          bodyWiden,
          preparingThrow ? 0.26 : 0.14
        );
      }

      if (clone.legLeft && clone.legRight) {
        const stride = isCloneMoving ? Math.sin(clone.walkPhase) * 0.52 : 0;
        const baseLegAngle = preparingThrow ? -0.2 - legBend : -0.16;
        const legStanceLerp = preparingThrow ? 0.34 : 0.18;
        clone.legLeft.rotation.x = THREE.MathUtils.lerp(
          clone.legLeft.rotation.x,
          baseLegAngle + stride,
          preparingThrow ? 0.36 : 0.26
        );
        clone.legRight.rotation.x = THREE.MathUtils.lerp(
          clone.legRight.rotation.x,
          baseLegAngle - stride,
          preparingThrow ? 0.36 : 0.26
        );
        clone.legLeft.rotation.z = THREE.MathUtils.lerp(
          clone.legLeft.rotation.z,
          preparingThrow ? legSpread : 0,
          legStanceLerp
        );
        clone.legRight.rotation.z = THREE.MathUtils.lerp(
          clone.legRight.rotation.z,
          preparingThrow ? -legSpread : 0,
          legStanceLerp
        );
        clone.legLeft.rotation.y = THREE.MathUtils.lerp(
          clone.legLeft.rotation.y,
          preparingThrow ? legTwist : 0,
          legStanceLerp
        );
        clone.legRight.rotation.y = THREE.MathUtils.lerp(
          clone.legRight.rotation.y,
          preparingThrow ? -legTwist : 0,
          legStanceLerp
        );
      }

      if (clone.throwArm && clone.throwArmBase) {
        if (preparingThrow) {
          const chargeTilt = THREE.MathUtils.lerp(0.7, 1.45, eChargeRatio);
          const chargeTwist = THREE.MathUtils.lerp(0.18, 0.8, eChargeRatio);
          const chargeRoll = THREE.MathUtils.lerp(-0.12, -0.62, eChargeRatio);
          cloneArmQuatX.setFromAxisAngle(axisX, -chargeTilt);
          cloneArmQuatY.setFromAxisAngle(axisY, chargeTwist);
          cloneArmQuatZ.setFromAxisAngle(axisZ, chargeRoll);
          clone.throwArm.quaternion
            .copy(clone.throwArmBase)
            .premultiply(cloneArmQuatX)
            .premultiply(cloneArmQuatY)
            .premultiply(cloneArmQuatZ);
        } else {
          clone.throwArm.quaternion.slerp(clone.throwArmBase, 0.28);
        }
      }

      clone.chargeFx.visible = preparingThrow;
      if (preparingThrow) {
        const pulse = 0.9 + Math.sin(now * 0.018 + i * 0.8) * 0.12;
        clone.chargeFx.scale.setScalar((0.82 + eChargeRatio * 0.7) * pulse);
        clone.chargeFx.rotation.y += deltaSeconds * (2.8 + i * 0.22);
      } else {
        clone.chargeFx.scale.setScalar(1);
        clone.chargeFx.rotation.y = 0;
      }

      const held = clone.heldShuriken;
      held.group.visible = preparingThrow;
      if (preparingThrow) {
        held.group.position.set(0.04, -0.95 + handLiftY, 0.18 + handForward);
        const pulse = 0.92 + Math.sin(now * 0.02 + i * 0.65) * 0.11;
        const chargeScale =
          (1.02 + eChargeRatio * 1.1) * cloneConfig.preparingHeldScaleBoost;
        held.group.scale.setScalar(0.52 * chargeScale * pulse);
        held.group.rotation.y += deltaSeconds * (3.7 + i * 0.18);
        held.blade.rotation.z += deltaSeconds * (5.3 + i * 0.26);
        held.aura.rotation.z -= deltaSeconds * (3.4 + i * 0.2);
        held.auraMaterial.opacity = 0.42 + eChargeRatio * 0.5;
        held.bladeMaterial.emissiveIntensity = 1.2 + eChargeRatio * 1.0;
      } else {
        held.group.position.set(0.04, -0.95, 0.18);
        held.group.scale.setScalar(0.52);
        held.group.rotation.set(Math.PI * 0.52, 0.2, Math.PI * 0.22);
        held.blade.rotation.set(0, 0, 0);
        held.aura.rotation.set(0, 0, 0);
        held.auraMaterial.opacity = 0.3;
        held.bladeMaterial.emissiveIntensity = 1.0;
      }
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
    entry.material.opacity = 0.8;
    entry.material.emissiveIntensity = 1.45;
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
    entry.side = skillRState.nextWaveSide;
    skillRState.nextWaveSide = (skillRState.nextWaveSide * -1) as 1 | -1;
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
    entry.material.opacity = 0.84;
    entry.material.emissiveIntensity = 1.52;
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
      entry.material.opacity = THREE.MathUtils.lerp(0.84, 0.06, progress);
      entry.material.emissiveIntensity = THREE.MathUtils.lerp(1.52, 0.24, progress);
    }
  };

  const applySkillRDanceBodyMotion = (
    now: number,
    avatarModel: THREE.Object3D | null,
    legLeft: THREE.Object3D | null,
    legRight: THREE.Object3D | null
  ) => {
    const active = skillRState.active;
    const phase = (now - skillRState.startedAt) * 0.015;
    if (avatarModel) {
      const targetOffsetX = active ? Math.sin(phase * 1.8) * 0.08 : 0;
      const targetOffsetY = active
        ? Math.max(0, Math.sin(phase * 2.6)) * 0.1
        : 0;
      const targetOffsetZ = active ? Math.cos(phase * 1.4) * 0.035 : 0;
      avatarModel.position.x = THREE.MathUtils.lerp(
        avatarModel.position.x,
        targetOffsetX,
        active ? 0.3 : 0.14
      );
      avatarModel.position.y = THREE.MathUtils.lerp(
        avatarModel.position.y,
        targetOffsetY,
        active ? 0.3 : 0.14
      );
      avatarModel.position.z = THREE.MathUtils.lerp(
        avatarModel.position.z,
        targetOffsetZ,
        active ? 0.3 : 0.14
      );

      const targetPitch = active ? -0.04 + Math.sin(phase * 2.5) * 0.12 : 0;
      const targetYaw = active ? Math.sin(phase * 2.2) * 0.35 : 0;
      const targetRoll = active ? Math.cos(phase * 2.8) * 0.16 : 0;
      avatarModel.rotation.x = THREE.MathUtils.lerp(
        avatarModel.rotation.x,
        targetPitch,
        active ? 0.32 : 0.16
      );
      avatarModel.rotation.y = THREE.MathUtils.lerp(
        avatarModel.rotation.y,
        targetYaw,
        active ? 0.32 : 0.16
      );
      avatarModel.rotation.z = THREE.MathUtils.lerp(
        avatarModel.rotation.z,
        targetRoll,
        active ? 0.32 : 0.16
      );
    }

    if (!active || !legLeft || !legRight) return;
    const legStride = Math.sin(phase * 2.3) * 0.62;
    const legTwist = Math.cos(phase * 1.9) * 0.2;
    const leftLift = Math.max(0, Math.sin(phase * 2.3)) * 0.2;
    const rightLift = Math.max(0, Math.sin(phase * 2.3 + Math.PI)) * 0.2;
    legLeft.rotation.x = THREE.MathUtils.lerp(
      legLeft.rotation.x,
      -0.18 + legStride + leftLift,
      0.36
    );
    legRight.rotation.x = THREE.MathUtils.lerp(
      legRight.rotation.x,
      -0.18 - legStride + rightLift,
      0.36
    );
    legLeft.rotation.y = THREE.MathUtils.lerp(
      legLeft.rotation.y,
      0.12 + legTwist,
      0.34
    );
    legRight.rotation.y = THREE.MathUtils.lerp(
      legRight.rotation.y,
      -0.12 - legTwist,
      0.34
    );
    legLeft.rotation.z = THREE.MathUtils.lerp(
      legLeft.rotation.z,
      0.06 + Math.sin(phase * 2.1 + 0.7) * 0.14,
      0.34
    );
    legRight.rotation.z = THREE.MathUtils.lerp(
      legRight.rotation.z,
      -0.06 + Math.sin(phase * 2.1 + 2.2) * 0.14,
      0.34
    );
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

  const clearSkillR = () => {
    skillRState.active = false;
    skillRState.startedAt = 0;
    skillRState.endsAt = 0;
    skillRState.nextMeleeAt = 0;
    skillRState.nextWaveSide = 1;
    skillRReflectVolume.visible = false;
    skillRReflectVolume.position.set(0, 0, 0);
    skillRReflectVolume.scale.set(1, 1, 1);
  };

  const startSkillR = (now: number) => {
    skillRState.active = true;
    skillRState.startedAt = now;
    skillRState.endsAt = now + skillRConfig.durationMs;
    skillRState.nextMeleeAt = now;
    skillRState.nextWaveSide = 1;
    skillRReflectVolume.visible = true;
    skillRReflectVolume.position.set(0, skillRConfig.reflectCenterY, 0);
    skillRReflectVolume.scale.setScalar(skillRConfig.reflectRadius);
  };

  const updateSkillR = (now: number) => {
    if (!skillRState.active) return;
    if (now >= skillRState.endsAt) {
      clearSkillR();
      return;
    }

    const danceProgress = THREE.MathUtils.clamp(
      (now - skillRState.startedAt) / skillRConfig.durationMs,
      0,
      1
    );
    const pulse = 1 + Math.sin(now * 0.02) * 0.08;
    skillRReflectVolume.visible = true;
    skillRReflectVolume.position.set(
      0,
      skillRConfig.reflectCenterY + Math.sin(danceProgress * Math.PI * 2) * 0.05,
      0
    );
    skillRReflectVolume.scale.setScalar(skillRConfig.reflectRadius * pulse);

    while (now >= skillRState.nextMeleeAt) {
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
      startPrimarySwing(now, 0.92, {
        variant: "rDance",
        direction: skillRState.nextWaveSide,
        yawOffset: THREE.MathUtils.randFloatSpread(0.7),
        pitchOffset: THREE.MathUtils.randFloatSpread(0.5),
        rollFrom: THREE.MathUtils.randFloat(-1.75, -0.68),
        rollTo: THREE.MathUtils.randFloat(0.74, 1.92),
        phase: Math.random() * Math.PI * 2,
      });
      skillRState.nextWaveSide = (skillRState.nextWaveSide * -1) as 1 | -1;
      skillRState.nextMeleeAt += skillRConfig.meleeIntervalMs;
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
      });
      if (reflected) {
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
      });
      if (reflected) {
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

  const resolveSkillEChargeRatio = (now: number) =>
    THREE.MathUtils.clamp(
      (now - skillEChargeState.startTime) / skillEChargeConfig.maxHoldMs,
      0,
      1
    );

  const configureSkillEVolleyForCharge = (ratio: number) => {
    const distanceScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minDistanceScale,
      skillEChargeConfig.maxDistanceScale,
      ratio
    );
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
    const arcHeight = THREE.MathUtils.lerp(
      skillEChargeConfig.minArcHeight,
      skillEChargeConfig.maxArcHeight,
      ratio
    );
    const outwardPhaseScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minOutwardPhaseScale,
      skillEChargeConfig.maxOutwardPhaseScale,
      ratio
    );
    const outwardBiasScale = THREE.MathUtils.lerp(
      skillEChargeConfig.minOutwardBiasScale,
      skillEChargeConfig.maxOutwardBiasScale,
      ratio
    );

    skillEVolley.speed = skillEConfig.speed * speedScale;
    skillEVolley.lifetime = skillEConfig.lifetime * lifetimeScale;
    skillEVolley.radius = skillEConfig.radius * radiusScale;
    skillEVolley.targetHitRadius = skillEConfig.targetHitRadius * radiusScale;
    skillEVolley.shurikenScale = shurikenScale;
    skillEVolley.outwardPhaseRatio = THREE.MathUtils.clamp(
      skillEConfig.outwardPhaseRatio * outwardPhaseScale,
      0.12,
      0.72
    );
    skillEVolley.outwardLateralBias =
      skillEConfig.outwardLateralBias * outwardBiasScale;
    skillEVolley.arcHeight = arcHeight;
    skillEVolley.explosionRadius = skillEConfig.explosionRadius * explosionScale;
    skillEVolley.explosionDamage = Math.round(
      skillEConfig.explosionDamage * explosionDamageScale
    );
    skillEVolley.focusPoint
      .copy(skillEOrigin)
      .addScaledVector(skillEBaseDirection, skillEConfig.focusDistance * distanceScale);
    skillEVolley.focusPoint.y += skillEConfig.focusHeight;
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
    const focusPoint = skillEVolley.focusPoint.clone();
    const speed = skillEVolley.speed;
    const lifetime = skillEVolley.lifetime;
    const outwardPhaseRatio = skillEVolley.outwardPhaseRatio;
    const outwardLateralBias = skillEVolley.outwardLateralBias;
    const arcHeight = skillEVolley.arcHeight;

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
    const outwardDirection = skillEShotDirection
      .clone()
      .addScaledVector(baseRight, side * outwardLateralBias)
      .addScaledVector(skillEUp, arcHeight * 0.14)
      .normalize();
    const currentDirection = new THREE.Vector3();
    const desiredDirection = new THREE.Vector3();
    const toFocus = new THREE.Vector3();
    const trailHead = new THREE.Vector3();
    const launchAt = performance.now();
    let convergeRemovalRequested = false;
    let explodeOnRemove = false;

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
      mesh: entry.mesh,
      origin: skillEShotOrigin,
      direction: skillEShotDirection,
      speed,
      lifetime,
      radius: skillEVolley.radius * scaleMultiplier,
      targetHitRadius: skillEVolley.targetHitRadius * scaleMultiplier,
      damage: Math.round(skillEConfig.damage * damageMultiplier),
      energyGainOnHit: 4,
      splitOnImpact: true,
      explosionRadius: skillEVolley.explosionRadius,
      explosionDamage: skillEVolley.explosionDamage,
      explosionColor: 0x60a5fa,
      explosionEmissive: 0x2563eb,
      explosionEmissiveIntensity: 1.05,
      lifecycle: {
        applyForces: ({ velocity, delta, removeProjectile }) => {
          if (velocity.lengthSq() < 0.000001) return;

          const ageRatio = THREE.MathUtils.clamp(
            (performance.now() - launchAt) / (lifetime * 1000),
            0,
            1
          );

          currentDirection.copy(velocity).normalize();
          const arcLift = Math.sin(ageRatio * Math.PI) * arcHeight;
          toFocus.copy(focusPoint);
          toFocus.y += arcLift;
          toFocus.sub(entry.mesh.position);
          const distanceToFocus = toFocus.length();
          const snapDistance = speed * delta + skillEConfig.convergeSnapPadding;
          if (distanceToFocus <= snapDistance) {
            if (!convergeRemovalRequested) {
              convergeRemovalRequested = true;
              explodeOnRemove = true;
              removeProjectile("expired");
            }
            return;
          }

          if (distanceToFocus > 0.000001) {
            desiredDirection.copy(toFocus).multiplyScalar(1 / distanceToFocus);
          } else {
            desiredDirection.copy(currentDirection);
          }

          const outwardPhaseProgress = THREE.MathUtils.clamp(
            ageRatio / Math.max(0.0001, outwardPhaseRatio),
            0,
            1
          );
          const outwardWeight =
            side === 0
              ? 0
              : THREE.MathUtils.smoothstep(1 - outwardPhaseProgress, 0, 1);
          if (outwardWeight > 0) {
            desiredDirection
              .lerp(outwardDirection, THREE.MathUtils.clamp(outwardWeight, 0, 1))
              .normalize();
          }
          const phaseTurnRate = THREE.MathUtils.lerp(
            skillEConfig.turnRateMin,
            skillEConfig.turnRateMax,
            1 - outwardWeight
          );
          const steer = 1 - Math.exp(-phaseTurnRate * delta);
          currentDirection
            .lerp(desiredDirection, THREE.MathUtils.clamp(steer, 0, 1))
            .normalize();
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
        onRemove: ({ reason, triggerExplosion }) => {
          if (reason !== "impact" && (explodeOnRemove || reason === "expired")) {
            entry.mesh.position.copy(focusPoint);
            triggerExplosion();
          }
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
    const shotDamage = Math.round(skillEConfig.damage * 1.5);
    const shotRadius = skillEVolley.radius * 2;
    const shotHitRadius = skillEVolley.targetHitRadius * 2;
    const shotSpeed = skillEVolley.speed * 0.96;
    const shotLifetime = skillEVolley.lifetime * 1.12;

    for (let i = 0; i < cloneState.clones.length; i += 1) {
      const clone = cloneState.clones[i];
      if (!clone.root.parent || !clone.root.visible) continue;
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
      const trailHead = new THREE.Vector3();
      fireProjectile({
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
        explosionDamage: skillEVolley.explosionDamage,
        explosionColor: 0x60a5fa,
        explosionEmissive: 0x2563eb,
        explosionEmissiveIntensity: 1.05,
        lifecycle: {
          applyForces: ({ velocity, delta }) => {
            if (velocity.lengthSq() < 0.000001) return;
            currentDirection.copy(velocity).normalize();
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
          onRemove: ({ reason, triggerExplosion }) => {
            if (reason === "expired") {
              triggerExplosion();
            }
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

    // Consumes clones on synchronized throw.
    if (didFireCloneShuriken) {
      clearAllClones(true);
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
    heldShuriken.getCenterWorld(skillEOrigin);
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
    skillEVolley.focusPoint.set(0, 0, 0);
    skillEVolley.speed = skillEConfig.speed;
    skillEVolley.lifetime = skillEConfig.lifetime;
    skillEVolley.radius = skillEConfig.radius;
    skillEVolley.targetHitRadius = skillEConfig.targetHitRadius;
    skillEVolley.shurikenScale = 1;
    skillEVolley.outwardPhaseRatio = skillEConfig.outwardPhaseRatio;
    skillEVolley.outwardLateralBias = skillEConfig.outwardLateralBias;
    skillEVolley.arcHeight = skillEChargeConfig.minArcHeight;
    skillEVolley.explosionRadius = skillEConfig.explosionRadius;
    skillEVolley.explosionDamage = skillEConfig.explosionDamage;
  };

  const applyBasicSlashHit = () => {
    const hitCount =
      performMeleeAttack?.({
        damage: 18,
        maxDistance: 8,
        hitRadius: 0.35,
        maxHits: 1,
      }) ?? 0;
    if (hitCount <= 0) return;
    const energyGainOnHit = Math.max(0, profile.energy?.hitGain ?? 0);
    if (energyGainOnHit > 0) {
      applyEnergy?.(energyGainOnHit);
    }
    applyMana?.(manaGainOnReflectOrBasicDamage);
  };

  const handleRightClick: CharacterRuntime["handleRightClick"] = (facing) => {
    if (skillRState.active) return;
    baseRuntime.handleRightClick(facing);
    applyBasicSlashHit();
  };

  const getMovementSpeedMultiplier = () =>
    skillRState.active ? skillRConfig.movementSpeedMultiplier : 1;

  const isBasicAttackLocked = () => skillRState.active;

  const handleSkillE = () => {
    if (skillRState.active) return false;
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
    if (skillRState.active || !chargeState.isCharging) return;
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
    }

    startPrimarySwing(now, ratio);
  };

  const resetState = () => {
    runtimeLastUpdateAt = 0;
    runtimeAvatarModelRef = null;
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
    clearSkillR();
    clearSkillRDanceWaves();
    clearAllClones();
    clearCloneSmoke();
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
    if (skillRState.active) return false;
    if ((getCurrentStats?.().energy ?? 1) <= 0) return false;

    cancelCharge();
    cancelSkillECharge();
    resetSkillEVolleyState();
    clearPrimarySwing();
    requestArmPoseReset();
    spawnClones(performance.now());
    return cloneState.active;
  };

  const handleSkillR = () => {
    if (skillRState.active) return false;
    cancelCharge();
    cancelSkillECharge();
    resetSkillEVolleyState();
    clearPrimarySwing();
    clearSkillRDanceWaves();
    requestArmPoseReset();
    startSkillR(performance.now());
    return true;
  };

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handleRightClick,
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
    isMovementLocked: baseRuntime.isMovementLocked,
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    resetState,
    update: (args) => {
      baseRuntime.update(args);
      runtimeAvatarModelRef = args.avatarModel;
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
      updateSkillR(args.now);
      updateClones(
        args.now,
        deltaSeconds,
        skillEChargeState.isCharging,
        skillEChargeState.ratio
      );
      updateCloneSmoke(deltaSeconds);
      applySkillRDanceBodyMotion(
        args.now,
        args.avatarModel,
        args.legLeft,
        args.legRight
      );

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
        return;
      }

      const releaseActive = chargeState.releaseUntil > args.now;
      const releaseProgress = releaseActive
        ? THREE.MathUtils.clamp(
            1 - (chargeState.releaseUntil - args.now) / chargeConfig.releaseMs,
            0,
            1
          )
        : 0;
      const danceActive = skillRState.active;
      const skillEHandActive = skillEChargeState.isCharging;
      const cloneChargeBoostActive = skillEHandActive && isCloneShurikenBuffActive();
      const dancePhase = (args.now - skillRState.startedAt) * 0.018;
      const danceDraw = danceActive
        ? THREE.MathUtils.clamp(0.62 + Math.sin(dancePhase) * 0.18, 0.4, 0.88)
        : 0;
      const skillEDraw = skillEHandActive
        ? THREE.MathUtils.lerp(
            cloneChargeBoostActive ? 0.45 : 0.28,
            cloneChargeBoostActive ? 1 : 0.78,
            skillEChargeState.ratio
          )
        : 0;
      const targetDraw = chargeState.isCharging
        ? chargeState.ratio
        : releaseActive
          ? chargeState.ratio * (1 - releaseProgress)
          : danceActive
            ? danceDraw
            : skillEDraw;
      const damp = chargeState.isCharging
        ? 0.28
        : danceActive
          ? 0.24
          : skillEHandActive
            ? 0.26
            : 0.18;
      armAnim.draw = THREE.MathUtils.lerp(armAnim.draw, targetDraw, damp);

      const leftArm = pickArm(args.arms, "left") ?? args.arms[0];
      const rightArm =
        pickArm(args.arms.filter((arm) => arm !== leftArm), "right") ??
        args.arms.find((arm) => arm !== leftArm) ??
        leftArm;

      captureArmNeutralIfNeeded(rightArm, leftArm);
      applyArmPoseResetIfRequested(rightArm, leftArm);
      heldShuriken.attachTo(skillEHandActive ? rightArm : null);
      heldShuriken.setVisible(skillEHandActive);
      heldShuriken.setChargeRatio(
        THREE.MathUtils.clamp(
          skillEChargeState.ratio * (cloneChargeBoostActive ? 1.25 : 1),
          0,
          1
        )
      );

      const poseActive =
        danceActive ||
        chargeState.isCharging ||
        releaseActive ||
        skillEHandActive ||
        armAnim.draw > 0.02;
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

      const showDrawSword = danceActive || chargeState.isCharging || releaseActive;
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
      const skillEBackSwing =
        skillEHandActive &&
        !danceActive &&
        !chargeState.isCharging &&
        !releaseActive
          ? -0.26 - skillEChargeState.ratio * (cloneChargeBoostActive ? 0.58 : 0.34)
          : 0;
      const skillETwistSwing =
        skillEHandActive &&
        !danceActive &&
        !chargeState.isCharging &&
        !releaseActive
          ? 0.14 + skillEChargeState.ratio * (cloneChargeBoostActive ? 0.48 : 0.26)
          : 0;
      const skillERollSwing =
        skillEHandActive &&
        !danceActive &&
        !chargeState.isCharging &&
        !releaseActive
          ? -0.08 - skillEChargeState.ratio * (cloneChargeBoostActive ? 0.34 : 0.2)
          : 0;
      const releaseSnap = releaseActive
        ? Math.sin(releaseProgress * Math.PI) * 0.48
        : 0;
      const danceBackSwing = danceActive
        ? -0.46 + Math.sin(dancePhase * 1.5) * 0.34
        : 0;
      const danceTwistSwing = danceActive
        ? Math.cos(dancePhase * 1.2) * 0.52
        : 0;
      const danceRollSwing = danceActive
        ? Math.sin(dancePhase * 2.1) * 0.36
        : 0;
      rightQuatX.setFromAxisAngle(
        axisX,
        drawBackAngle + releaseSnap + danceBackSwing + skillEBackSwing
      );
      rightQuatY.setFromAxisAngle(axisY, drawTwist + danceTwistSwing + skillETwistSwing);
      rightQuatZ.setFromAxisAngle(axisZ, drawRoll + danceRollSwing + skillERollSwing);
      rightArm.quaternion
        .copy(armBase.right)
        .premultiply(rightQuatX)
        .premultiply(rightQuatY)
        .premultiply(rightQuatZ);

      const leftGuard =
        -0.06 +
        armAnim.draw * 0.22 +
        (danceActive ? 0.28 + Math.sin(dancePhase * 1.7 + 0.4) * 0.24 : 0) +
        (skillEHandActive && !danceActive ? skillEChargeState.ratio * 0.16 : 0);
      const leftRoll =
        0.05 +
        armAnim.draw * 0.09 +
        (danceActive ? -0.22 + Math.cos(dancePhase * 1.45 + 0.8) * 0.2 : 0) +
        (skillEHandActive && !danceActive ? -skillEChargeState.ratio * 0.1 : 0);
      leftQuatX.setFromAxisAngle(axisX, leftGuard);
      leftQuatZ.setFromAxisAngle(axisZ, leftRoll);
      leftArm.quaternion
        .copy(armBase.left)
        .premultiply(leftQuatX)
        .premultiply(leftQuatZ);
    },
    dispose: () => {
      if (canBindWindowEvents) {
        window.removeEventListener("keyup", handleSkillEKeyUp);
        window.removeEventListener("blur", handleSkillEBlur);
      }
      resetState();
      clearAllClones();
      clearCloneSmoke();
      cloneAnchor.removeFromParent();
      hud.dispose();
      drawSword.dispose();
      heldShuriken.dispose();
      primaryReflectVolume.removeFromParent();
      primaryReflectVolumeGeometry.dispose();
      primaryReflectVolumeMaterial.dispose();
      skillRReflectVolume.removeFromParent();
      skillRReflectVolumeGeometry.dispose();
      skillRReflectVolumeMaterial.dispose();
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

