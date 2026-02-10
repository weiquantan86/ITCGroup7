import * as THREE from "three";
import { createCharacterRuntime } from "../player/runtimeBase";
import { CharacterRuntimeObject } from "../player/runtimeObject";
import type { CharacterRuntimeFactory } from "../types";
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
    group.position.set(0.05, -0.78, 0.12);
    group.rotation.set(-1.12, 0.22, Math.PI * 0.55);
  };

  const setDrawRatio = (ratio: number) => {
    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    blade.position.y = 0.26 + clamped * 0.52;
    aura.position.y = blade.position.y;
    aura.scale.y = 0.65 + clamped * 0.55;
    auraMaterial.opacity = 0.12 + clamped * 0.42;
    bladeMaterial.emissiveIntensity = 0.28 + clamped * 0.66;
    group.position.x = 0.05 + clamped * 0.03;
    group.position.z = 0.12 - clamped * 0.06;
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

type ShurikenEntry = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  trailGeometry: THREE.BufferGeometry;
  trailMaterial: THREE.LineBasicMaterial;
  trailPositions: Float32Array;
  trailPositionAttribute: THREE.BufferAttribute;
  spinPhase: number;
  spinRate: number;
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

  return {
    mesh,
    material,
    trail,
    trailGeometry,
    trailMaterial,
    trailPositions,
    trailPositionAttribute,
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
  const geometry = new THREE.ShapeGeometry(shape, 28);
  geometry.rotateZ(THREE.MathUtils.degToRad(8));
  return geometry;
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  mount,
  fireProjectile,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const hud = createShurikenChargeHud(mount);
  const drawSword = createDrawSwordFx(avatar);
  const heldShuriken = createHeldShurikenFx(avatar);

  const chargeConfig = {
    maxHoldMs: 1800,
    minHoldMs: 180,
    releaseMs: 210,
    minSpeed: 15,
    maxSpeed: 28,
    minLifetime: 0.45,
    maxLifetime: 1.1,
    minDamage: 18,
    maxDamage: 42,
  };
  const swordWaveSpeedScale = 0.75;
  const swordWaveSizeScale = 0.5;
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
    rightY: 0,
    rightZ: 0,
    leftY: 0,
    leftZ: 0,
  };

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const rightQuatX = new THREE.Quaternion();
  const rightQuatY = new THREE.Quaternion();
  const rightQuatZ = new THREE.Quaternion();
  const leftQuatX = new THREE.Quaternion();
  const leftQuatZ = new THREE.Quaternion();

  const swordWaveGeometry = createSwordWaveGeometry();
  const swordWavePool: SwordWaveEntry[] = Array.from({ length: 8 }, () =>
    createSwordWaveEntry(swordWaveGeometry)
  );
  const shurikenGeometry = createShurikenGeometry();
  const shurikenPool: ShurikenEntry[] = Array.from({ length: 12 }, () =>
    createShurikenEntry(shurikenGeometry)
  );
  const projectileForward = new THREE.Vector3(0, 0, 1);
  const projectileDirection = new THREE.Vector3();
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
    forwardSpawn: 1.4,
    lateralSpawn: 0.42,
    verticalSpawn: 1.1,
    spreadRad: THREE.MathUtils.degToRad(16),
    outwardLateralBias: 0.28,
    outwardPhaseRatio: 0.22,
    outwardTurnRate: 8.2,
    focusDistance: 8.8,
    focusHeight: 1.15,
    convergeSnapPadding: 0.12,
    explosionRadius: 5.2,
    explosionDamage: 48,
  };
  const skillESideOffsets = [-1, 0, 1];
  const skillEVolley = {
    active: false,
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
    armNeutral.rightY = rightArm.rotation.y;
    armNeutral.rightZ = rightArm.rotation.z;
    armNeutral.leftY = leftArm.rotation.y;
    armNeutral.leftZ = leftArm.rotation.z;
  };

  const restoreArmNeutralTwist = (
    rightArm: THREE.Object3D,
    leftArm: THREE.Object3D
  ) => {
    if (!armNeutral.captured) return;
    const sameTargets =
      armNeutral.rightId === rightArm.uuid && armNeutral.leftId === leftArm.uuid;
    if (!sameTargets) return;
    rightArm.rotation.y = armNeutral.rightY;
    rightArm.rotation.z = armNeutral.rightZ;
    if (leftArm !== rightArm) {
      leftArm.rotation.y = armNeutral.leftY;
      leftArm.rotation.z = armNeutral.leftZ;
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
    // Keep mostly horizontal; arc comes from curve forces, not vertical aim.
    skillEBaseDirection.y *= 0.2;
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

  const fireSkillEShuriken = (shotIndex: number) => {
    if (!fireProjectile) return;

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
    entry.mesh.scale.setScalar(skillEVolley.shurikenScale);
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
    const canExplode = shotIndex === Math.floor(skillEConfig.shotCount / 2);
    let convergeRemovalRequested = false;
    let explodeOnRemove = false;

    const trailHost = avatar.parent ?? avatar;
    if (entry.trail.parent !== trailHost) {
      entry.trail.removeFromParent();
      trailHost.add(entry.trail);
    }
    entry.trail.visible = true;
    entry.trailMaterial.opacity = THREE.MathUtils.lerp(
      0.42,
      0.9,
      skillEChargeState.ratio
    );
    resetShurikenTrail(entry, skillEShotOrigin);

    fireProjectile({
      mesh: entry.mesh,
      origin: skillEShotOrigin,
      direction: skillEShotDirection,
      speed,
      lifetime,
      radius: skillEVolley.radius,
      targetHitRadius: skillEVolley.targetHitRadius,
      damage: skillEConfig.damage,
      energyGainOnHit: 4,
      splitOnImpact: canExplode,
      explosionRadius: canExplode ? skillEVolley.explosionRadius : 0,
      explosionDamage: canExplode ? skillEVolley.explosionDamage : 0,
      explosionColor: canExplode ? 0x60a5fa : undefined,
      explosionEmissive: canExplode ? 0x2563eb : undefined,
      explosionEmissiveIntensity: canExplode ? 1.05 : undefined,
      lifecycle: {
        applyForces: ({ velocity, delta, removeProjectile }) => {
          if (velocity.lengthSq() < 0.000001) return;

          const ageRatio = THREE.MathUtils.clamp(
            (performance.now() - launchAt) / (lifetime * 1000),
            0,
            1
          );

          currentDirection.copy(velocity).normalize();
          if (ageRatio < outwardPhaseRatio && side !== 0) {
            desiredDirection.copy(outwardDirection);
            const steer = 1 - Math.exp(-skillEConfig.outwardTurnRate * delta);
            currentDirection
              .lerp(desiredDirection, THREE.MathUtils.clamp(steer, 0, 1))
              .normalize();
            velocity.copy(currentDirection).multiplyScalar(speed);
          } else {
            const arcLift = Math.sin(ageRatio * Math.PI) * arcHeight;
            toFocus.copy(focusPoint);
            toFocus.y += arcLift;
            toFocus.sub(entry.mesh.position);
            const distanceToFocus = toFocus.length();
            const snapDistance = speed * delta + skillEConfig.convergeSnapPadding;
            if (distanceToFocus <= 0.000001) {
              velocity.set(0, 0, 0);
              if (!convergeRemovalRequested) {
                convergeRemovalRequested = true;
                if (canExplode) {
                  explodeOnRemove = true;
                }
                removeProjectile("expired");
              }
            } else if (distanceToFocus <= snapDistance) {
              velocity.copy(toFocus).multiplyScalar(1 / Math.max(delta, 0.0001));
              if (!convergeRemovalRequested) {
                convergeRemovalRequested = true;
                if (canExplode) {
                  explodeOnRemove = true;
                }
                removeProjectile("expired");
              }
            } else {
              velocity.copy(toFocus).multiplyScalar(speed / distanceToFocus);
            }
            if (velocity.lengthSq() > 0.000001) {
              currentDirection.copy(velocity).normalize();
            }
          }
          entry.spinPhase += entry.spinRate * delta;
          entry.mesh.quaternion.setFromUnitVectors(
            projectileForward,
            currentDirection
          );
          entry.mesh.rotateZ(entry.spinPhase);
          trailHead.copy(entry.mesh.position).addScaledVector(velocity, delta);
          pushShurikenTrailPoint(entry, trailHead);
        },
        onRemove: ({ reason, triggerExplosion }) => {
          if (canExplode && reason !== "impact" && (explodeOnRemove || reason === "expired")) {
            entry.mesh.position.copy(focusPoint);
            triggerExplosion();
          }
          entry.trail.visible = false;
          entry.trail.removeFromParent();
          resetShurikenTrail(entry, entry.mesh.position);
          entry.mesh.visible = false;
          entry.mesh.rotation.set(0, 0, 0);
          entry.mesh.scale.setScalar(1);
          entry.spinPhase = 0;
        },
      },
    });
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
    avatar.getWorldPosition(skillEOrigin);
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
    skillEVolley.firedCount = 0;
    skillEVolley.nextShotAt = now;
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

  const handleSkillE = () => {
    if (!fireProjectile) return false;
    if (skillEVolley.active || skillEChargeState.isCharging) return false;
    if (chargeState.isCharging || chargeState.releaseUntil > performance.now()) {
      return false;
    }
    beginSkillECharge(performance.now());
    return true;
  };

  const beginCharge = () => {
    if (
      chargeState.isCharging ||
      skillEChargeState.isCharging ||
      skillEVolley.active ||
      !fireProjectile
    ) {
      return;
    }
    chargeState.isCharging = true;
    chargeState.startTime = performance.now();
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    armBase.captured = false;
    hud.setVisible(true);
    hud.setRatio(0);
  };

  const cancelCharge = () => {
    if (!chargeState.isCharging && chargeState.releaseUntil === 0) return;
    chargeState.isCharging = false;
    chargeState.startTime = 0;
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    armAnim.draw = 0;
    armBase.captured = false;
    drawSword.setVisible(false);
    drawSword.attachTo(null);
    if (!skillEChargeState.isCharging) {
      hud.setVisible(false);
      hud.setRatio(0);
    }
  };

  const releaseCharge = () => {
    if (!chargeState.isCharging || !fireProjectile) return;
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

    const speed =
      THREE.MathUtils.lerp(chargeConfig.minSpeed, chargeConfig.maxSpeed, ratio) *
      swordWaveSpeedScale;
    const lifetime = THREE.MathUtils.lerp(
      chargeConfig.minLifetime,
      chargeConfig.maxLifetime,
      ratio
    );
    const damage = Math.round(
      THREE.MathUtils.lerp(chargeConfig.minDamage, chargeConfig.maxDamage, ratio)
    );
    const waveRadius = THREE.MathUtils.lerp(1.2, 2.3, ratio) * swordWaveSizeScale;
    const targetHitRadius =
      THREE.MathUtils.lerp(1.05, 1.9, ratio) * swordWaveSizeScale;
    const entry = acquireSwordWave();
    entry.baseScale = THREE.MathUtils.lerp(1.02, 1.62, ratio) * swordWaveSizeScale;
    entry.spinDirection = Math.random() < 0.5 ? -1 : 1;
    entry.mesh.visible = true;
    entry.mesh.rotation.set(0, 0, 0);
    entry.mesh.scale.setScalar(entry.baseScale);
    entry.material.opacity = THREE.MathUtils.lerp(0.66, 0.9, ratio);
    entry.material.emissiveIntensity = THREE.MathUtils.lerp(0.9, 1.6, ratio);

    fireProjectile({
      mesh: entry.mesh,
      speed,
      lifetime,
      radius: waveRadius,
      targetHitRadius,
      damage,
      energyGainOnHit: 6,
      lifecycle: {
        applyForces: ({ velocity }) => {
          if (velocity.lengthSq() > 0.000001) {
            projectileDirection.copy(velocity).normalize();
            entry.mesh.quaternion.setFromUnitVectors(
              projectileForward,
              projectileDirection
            );
          }
          entry.mesh.rotateZ((0.012 + ratio * 0.01) * entry.spinDirection);
          const pulse =
            1 + Math.sin(performance.now() * 0.022 + ratio * Math.PI) * 0.05;
          entry.mesh.scale.setScalar(entry.baseScale * pulse);
        },
        onRemove: () => {
          entry.mesh.visible = false;
          entry.mesh.rotation.set(0, 0, 0);
          entry.mesh.scale.setScalar(1);
        },
      },
    });
  };

  const resetState = () => {
    chargeState.startTime = 0;
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    cancelSkillECharge();
    skillEVolley.active = false;
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
    armAnim.draw = 0;
    armBase.captured = false;
    armNeutral.captured = false;
    armNeutral.rightId = "";
    armNeutral.leftId = "";
    cancelCharge();
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

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handleRightClick: baseRuntime.handleRightClick,
    handlePrimaryDown: beginCharge,
    handlePrimaryUp: releaseCharge,
    handlePrimaryCancel: cancelCharge,
    handleSkillQ: baseRuntime.handleSkillQ,
    handleSkillE,
    handleSkillR: baseRuntime.handleSkillR,
    getProjectileBlockers: baseRuntime.getProjectileBlockers,
    isMovementLocked: baseRuntime.isMovementLocked,
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    resetState,
    update: (args) => {
      baseRuntime.update(args);
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
      const targetDraw = chargeState.isCharging
        ? chargeState.ratio
        : releaseActive
          ? chargeState.ratio * (1 - releaseProgress)
          : 0;
      const damp = chargeState.isCharging ? 0.28 : 0.18;
      armAnim.draw = THREE.MathUtils.lerp(armAnim.draw, targetDraw, damp);

      const leftArm = pickArm(args.arms, "left") ?? args.arms[0];
      const rightArm =
        pickArm(args.arms.filter((arm) => arm !== leftArm), "right") ??
        args.arms.find((arm) => arm !== leftArm) ??
        leftArm;
      const skillEHandActive = skillEChargeState.isCharging;

      captureArmNeutralIfNeeded(rightArm, leftArm);
      heldShuriken.attachTo(skillEHandActive ? rightArm : null);
      heldShuriken.setVisible(skillEHandActive);
      heldShuriken.setChargeRatio(skillEChargeState.ratio);

      const poseActive =
        chargeState.isCharging || releaseActive || armAnim.draw > 0.02;
      if (!poseActive) {
        if (armBase.captured) {
          const sameTargets =
            armBase.rightId === rightArm.uuid && armBase.leftId === leftArm.uuid;
          if (sameTargets) {
            rightArm.quaternion.copy(armBase.right);
            leftArm.quaternion.copy(armBase.left);
          }
        }
        restoreArmNeutralTwist(rightArm, leftArm);
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

      drawSword.attachTo(rightArm);
      drawSword.setVisible(true);
      drawSword.setDrawRatio(armAnim.draw);

      const drawBackAngle = -0.32 - armAnim.draw * 1.04;
      const drawTwist = 0.1 + armAnim.draw * 0.52;
      const drawRoll = -0.12 - armAnim.draw * 0.46;
      const releaseSnap = releaseActive
        ? Math.sin(releaseProgress * Math.PI) * 0.48
        : 0;
      rightQuatX.setFromAxisAngle(axisX, drawBackAngle + releaseSnap);
      rightQuatY.setFromAxisAngle(axisY, drawTwist);
      rightQuatZ.setFromAxisAngle(axisZ, drawRoll);
      rightArm.quaternion
        .copy(armBase.right)
        .premultiply(rightQuatX)
        .premultiply(rightQuatY)
        .premultiply(rightQuatZ);

      const leftGuard = -0.06 + armAnim.draw * 0.22;
      const leftRoll = 0.05 + armAnim.draw * 0.09;
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
      hud.dispose();
      drawSword.dispose();
      heldShuriken.dispose();
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
      });
      shurikenGeometry.dispose();
      baseRuntime.dispose();
    },
    isFacingLocked: baseRuntime.isFacingLocked,
  });
};

