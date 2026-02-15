import * as THREE from "three";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import type { CharacterRuntimeFactory } from "../general/types";
import { profile } from "./profile";

const minDirectionSq = 0.000001;

type ChargeHud = {
  setVisible: (visible: boolean) => void;
  setRatio: (ratio: number) => void;
  setFlickerMode: (active: boolean) => void;
  update: (now: number) => void;
  dispose: () => void;
};

const createChargeHud = (mount?: HTMLElement): ChargeHud => {
  if (!mount || typeof document === "undefined") {
    return {
      setVisible: () => {},
      setRatio: () => {},
      setFlickerMode: () => {},
      update: () => {},
      dispose: () => {},
    };
  }

  const hudHost = mount.parentElement ?? mount;
  if (!hudHost.style.position) {
    hudHost.style.position = "relative";
  }

  const hud = document.createElement("div");
  hud.style.cssText =
    "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);" +
    "width:220px;height:120px;pointer-events:none;opacity:0;" +
    "transition:opacity 140ms ease;z-index:5;";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 260 140");
  svg.setAttribute("width", "220");
  svg.setAttribute("height", "120");

  const trackLeft = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  const trackRight = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  const fillLeft = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  const fillRight = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  const bridgeTrack = document.createElementNS("http://www.w3.org/2000/svg", "line");
  const bridgeFill = document.createElementNS("http://www.w3.org/2000/svg", "line");
  const templeLeft = document.createElementNS("http://www.w3.org/2000/svg", "line");
  const templeRight = document.createElementNS("http://www.w3.org/2000/svg", "line");

  const setLensCircle = (el: SVGCircleElement, cx: string) => {
    el.setAttribute("cx", cx);
    el.setAttribute("cy", "70");
    el.setAttribute("r", "33");
    el.setAttribute("fill", "none");
    el.setAttribute("stroke-width", "9");
  };

  setLensCircle(trackLeft, "88");
  setLensCircle(trackRight, "172");
  setLensCircle(fillLeft, "88");
  setLensCircle(fillRight, "172");

  fillLeft.setAttribute("transform", "rotate(-90 88 70)");
  fillRight.setAttribute("transform", "rotate(-90 172 70)");

  bridgeTrack.setAttribute("x1", "122");
  bridgeTrack.setAttribute("y1", "70");
  bridgeTrack.setAttribute("x2", "138");
  bridgeTrack.setAttribute("y2", "70");
  bridgeTrack.setAttribute("stroke-width", "7");
  bridgeTrack.setAttribute("stroke-linecap", "round");

  bridgeFill.setAttribute("x1", "122");
  bridgeFill.setAttribute("y1", "70");
  bridgeFill.setAttribute("x2", "138");
  bridgeFill.setAttribute("y2", "70");
  bridgeFill.setAttribute("stroke-width", "7");
  bridgeFill.setAttribute("stroke-linecap", "round");

  templeLeft.setAttribute("x1", "55");
  templeLeft.setAttribute("y1", "70");
  templeLeft.setAttribute("x2", "28");
  templeLeft.setAttribute("y2", "62");
  templeLeft.setAttribute("stroke-width", "6");
  templeLeft.setAttribute("stroke-linecap", "round");

  templeRight.setAttribute("x1", "205");
  templeRight.setAttribute("y1", "70");
  templeRight.setAttribute("x2", "232");
  templeRight.setAttribute("y2", "62");
  templeRight.setAttribute("stroke-width", "6");
  templeRight.setAttribute("stroke-linecap", "round");

  let flickerMode = false;
  let lastFlickerUpdateAt = 0;
  let flickerElapsed = 0;
  let flickerWhite = true;
  const flickerInterval = 0.25;

  const applyDefaultPalette = () => {
    trackLeft.setAttribute("stroke", "rgba(74,222,128,0.30)");
    trackRight.setAttribute("stroke", "rgba(74,222,128,0.30)");
    fillLeft.setAttribute("stroke", "#22c55e");
    fillRight.setAttribute("stroke", "#22c55e");
    fillLeft.style.filter = "drop-shadow(0 0 10px rgba(34,197,94,0.72))";
    fillRight.style.filter = "drop-shadow(0 0 10px rgba(34,197,94,0.72))";
    bridgeTrack.setAttribute("stroke", "rgba(74,222,128,0.32)");
    bridgeFill.setAttribute("stroke", "#22c55e");
    bridgeFill.style.filter = "drop-shadow(0 0 8px rgba(34,197,94,0.72))";
    templeLeft.setAttribute("stroke", "rgba(74,222,128,0.24)");
    templeRight.setAttribute("stroke", "rgba(74,222,128,0.24)");
  };

  const applyMonochromePalette = (white: boolean) => {
    if (white) {
      trackLeft.setAttribute("stroke", "rgba(255,255,255,0.34)");
      trackRight.setAttribute("stroke", "rgba(255,255,255,0.34)");
      fillLeft.setAttribute("stroke", "#ffffff");
      fillRight.setAttribute("stroke", "#ffffff");
      fillLeft.style.filter = "drop-shadow(0 0 10px rgba(255,255,255,0.78))";
      fillRight.style.filter = "drop-shadow(0 0 10px rgba(255,255,255,0.78))";
      bridgeTrack.setAttribute("stroke", "rgba(255,255,255,0.34)");
      bridgeFill.setAttribute("stroke", "#ffffff");
      bridgeFill.style.filter = "drop-shadow(0 0 8px rgba(255,255,255,0.78))";
      templeLeft.setAttribute("stroke", "rgba(255,255,255,0.3)");
      templeRight.setAttribute("stroke", "rgba(255,255,255,0.3)");
      return;
    }
    trackLeft.setAttribute("stroke", "rgba(0,0,0,0.52)");
    trackRight.setAttribute("stroke", "rgba(0,0,0,0.52)");
    fillLeft.setAttribute("stroke", "#000000");
    fillRight.setAttribute("stroke", "#000000");
    fillLeft.style.filter = "drop-shadow(0 0 10px rgba(0,0,0,0.78))";
    fillRight.style.filter = "drop-shadow(0 0 10px rgba(0,0,0,0.78))";
    bridgeTrack.setAttribute("stroke", "rgba(0,0,0,0.52)");
    bridgeFill.setAttribute("stroke", "#000000");
    bridgeFill.style.filter = "drop-shadow(0 0 8px rgba(0,0,0,0.78))";
    templeLeft.setAttribute("stroke", "rgba(0,0,0,0.46)");
    templeRight.setAttribute("stroke", "rgba(0,0,0,0.46)");
  };

  const setFlickerMode = (active: boolean) => {
    if (flickerMode === active) return;
    flickerMode = active;
    lastFlickerUpdateAt = 0;
    flickerElapsed = 0;
    flickerWhite = true;
    if (flickerMode) {
      applyMonochromePalette(true);
      return;
    }
    applyDefaultPalette();
  };

  const update = (now: number) => {
    if (!flickerMode) return;
    const deltaSeconds =
      lastFlickerUpdateAt > 0
        ? THREE.MathUtils.clamp((now - lastFlickerUpdateAt) / 1000, 0, 0.08)
        : 0;
    lastFlickerUpdateAt = now;
    flickerElapsed += deltaSeconds;
    let paletteChanged = false;
    while (flickerElapsed >= flickerInterval) {
      flickerElapsed -= flickerInterval;
      flickerWhite = !flickerWhite;
      paletteChanged = true;
    }
    if (paletteChanged) {
      applyMonochromePalette(flickerWhite);
    }
  };

  applyDefaultPalette();

  svg.appendChild(templeLeft);
  svg.appendChild(trackLeft);
  svg.appendChild(trackRight);
  svg.appendChild(bridgeTrack);
  svg.appendChild(fillLeft);
  svg.appendChild(fillRight);
  svg.appendChild(bridgeFill);
  svg.appendChild(templeRight);
  hud.appendChild(svg);
  hudHost.appendChild(hud);

  let leftPathLength = 0;
  let rightPathLength = 0;
  let bridgePathLength = 0;

  const setRatio = (ratio: number) => {
    if (!leftPathLength) {
      leftPathLength = fillLeft.getTotalLength();
      fillLeft.style.strokeDasharray = `${leftPathLength}`;
    }
    if (!rightPathLength) {
      rightPathLength = fillRight.getTotalLength();
      fillRight.style.strokeDasharray = `${rightPathLength}`;
    }
    if (!bridgePathLength) {
      bridgePathLength = bridgeFill.getTotalLength();
      bridgeFill.style.strokeDasharray = `${bridgePathLength}`;
    }

    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    const leftRatio = THREE.MathUtils.clamp(clamped * 2, 0, 1);
    const rightRatio = THREE.MathUtils.clamp((clamped - 0.5) * 2, 0, 1);
    const bridgeRatio = THREE.MathUtils.clamp((clamped - 0.35) / 0.3, 0, 1);

    fillLeft.style.strokeDashoffset = `${leftPathLength * (1 - leftRatio)}`;
    fillRight.style.strokeDashoffset = `${rightPathLength * (1 - rightRatio)}`;
    bridgeFill.style.strokeDashoffset = `${bridgePathLength * (1 - bridgeRatio)}`;
  };

  const setVisible = (visible: boolean) => {
    hud.style.opacity = visible ? "1" : "0";
  };

  setRatio(0);

  return {
    setVisible,
    setRatio,
    setFlickerMode,
    update,
    dispose: () => {
      hud.parentElement?.removeChild(hud);
    },
  };
};

const pickArm = (
  arms: THREE.Object3D[],
  side: "right" | "left",
  exclude?: THREE.Object3D | null
) => {
  if (!arms.length) return null;
  let best: THREE.Object3D | null = arms[0];
  let bestScore = -Infinity;
  for (let i = 0; i < arms.length; i += 1) {
    const arm = arms[i];
    if (exclude && arm === exclude) continue;
    const name = (arm.name || "").toLowerCase();
    let score = 0;
    if (name.includes(side)) score += 10;
    if (name.includes("arm")) score += 4;
    if (name.includes("hand") || name.includes("fore") || name.includes("lower")) {
      score -= 4;
    }
    if (score > bestScore) {
      bestScore = score;
      best = arm;
    }
  }
  return best;
};

type FootParticleFxUpdateArgs = {
  deltaSeconds: number;
  active: boolean;
  isMoving: boolean;
  legLeft: THREE.Object3D | null;
  legRight: THREE.Object3D | null;
};

type FootParticleFx = {
  update: (args: FootParticleFxUpdateArgs) => void;
  clear: () => void;
  dispose: () => void;
};

const createFootParticleFx = (avatar: THREE.Object3D): FootParticleFx => {
  const worldRoot = avatar.parent ?? avatar;
  const particleGeometry = new THREE.SphereGeometry(0.026, 8, 6);
  const particles = Array.from({ length: 72 }, () => {
    const material = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(particleGeometry, material);
    mesh.visible = false;
    mesh.renderOrder = 7;
    worldRoot.add(mesh);
    return {
      mesh,
      material,
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
    };
  });

  let spawnCarry = 0;
  let spawnSide = 0;
  const legOffset = new THREE.Vector3(0, -0.72, 0.12);
  const legWorldPos = new THREE.Vector3();
  const legWorldQuat = new THREE.Quaternion();
  const avatarWorldPos = new THREE.Vector3();
  const spawnPos = new THREE.Vector3();
  const spawnOffset = new THREE.Vector3();
  const outwardDir = new THREE.Vector3();
  const radialDir = new THREE.Vector3();

  const resolveFootPosition = (leg: THREE.Object3D | null, out: THREE.Vector3) => {
    if (!leg) {
      avatar.getWorldPosition(out);
      out.y += 0.1;
      return out;
    }
    leg.getWorldPosition(legWorldPos);
    leg.getWorldQuaternion(legWorldQuat);
    out.copy(legOffset).applyQuaternion(legWorldQuat).add(legWorldPos);
    return out;
  };

  const spawnAt = (position: THREE.Vector3) => {
    const slot = particles.find((entry) => entry.life <= 0);
    if (!slot) return;
    slot.maxLife = 0.46 + Math.random() * 0.36;
    slot.life = slot.maxLife;
    slot.mesh.visible = true;
    spawnOffset.set(
      (Math.random() - 0.5) * 0.16,
      Math.random() * 0.06,
      (Math.random() - 0.5) * 0.16
    );
    slot.mesh.position.copy(position).add(spawnOffset);
    slot.mesh.scale.setScalar(0.72 + Math.random() * 0.55);

    avatar.getWorldPosition(avatarWorldPos);
    outwardDir.copy(slot.mesh.position).sub(avatarWorldPos);
    outwardDir.y = 0;
    if (outwardDir.lengthSq() < 0.000001) {
      const thetaFallback = Math.random() * Math.PI * 2;
      outwardDir.set(Math.cos(thetaFallback), 0, Math.sin(thetaFallback));
    } else {
      outwardDir.normalize();
    }
    const theta = Math.random() * Math.PI * 2;
    radialDir.set(Math.cos(theta), 0, Math.sin(theta));
    outwardDir.lerp(radialDir, 0.4).normalize();
    const horizontalSpeed = 1.35 + Math.random() * 1.45;
    const verticalSpeed = 1.35 + Math.random() * 1.15;
    slot.velocity.copy(outwardDir).multiplyScalar(horizontalSpeed);
    slot.velocity.y = verticalSpeed;
    slot.material.opacity = 0.85;
  };

  const clear = () => {
    for (let i = 0; i < particles.length; i += 1) {
      const entry = particles[i];
      entry.life = 0;
      entry.maxLife = 0;
      entry.mesh.visible = false;
      entry.material.opacity = 0;
    }
    spawnCarry = 0;
  };

  return {
    update: ({ deltaSeconds, active, isMoving, legLeft, legRight }) => {
      const dt = THREE.MathUtils.clamp(deltaSeconds, 0, 0.06);
      if (active) {
        const spawnRate = isMoving ? 92 : 56;
        spawnCarry += spawnRate * dt;
        while (spawnCarry >= 1) {
          spawnCarry -= 1;
          spawnSide = 1 - spawnSide;
          const useLeft = spawnSide === 0;
          resolveFootPosition(useLeft ? legLeft : legRight, spawnPos);
          spawnAt(spawnPos);
        }
      } else {
        spawnCarry = 0;
      }

      for (let i = 0; i < particles.length; i += 1) {
        const entry = particles[i];
        if (entry.life <= 0) continue;
        entry.life -= dt;
        if (entry.life <= 0) {
          entry.life = 0;
          entry.mesh.visible = false;
          entry.material.opacity = 0;
          continue;
        }
        entry.velocity.multiplyScalar(1 - dt * 0.18);
        entry.velocity.y += 0.82 * dt;
        entry.mesh.position.addScaledVector(entry.velocity, dt);
        const ratio = THREE.MathUtils.clamp(entry.life / entry.maxLife, 0, 1);
        entry.material.opacity = ratio * 0.9;
      }
    },
    clear,
    dispose: () => {
      clear();
      for (let i = 0; i < particles.length; i += 1) {
        const entry = particles[i];
        entry.mesh.removeFromParent();
        entry.material.dispose();
      }
      particleGeometry.dispose();
    },
  };
};

type GunChargeFx = {
  attachTo: (arm: THREE.Object3D | null) => void;
  setGravityMode: (active: boolean) => void;
  setActive: (active: boolean) => void;
  setRatio: (ratio: number) => void;
  update: (now: number) => void;
  dispose: () => void;
};

type GravityStateFx = {
  setActive: (active: boolean) => void;
  update: (now: number) => void;
  dispose: () => void;
};

type BackpackPulseFx = {
  setActive: (active: boolean) => void;
  update: (now: number) => void;
  dispose: () => void;
};

type FaceGlassesPulseFx = {
  setActive: (active: boolean) => void;
  update: (now: number) => void;
  dispose: () => void;
};

const createGunChargeFx = (avatar: THREE.Object3D): GunChargeFx => {
  const group = new THREE.Group();
  group.visible = false;
  let currentRatio = 0;
  let gravityMode = false;
  let lastUpdateAt = 0;

  const coreGeometry = new THREE.SphereGeometry(0.07, 16, 12);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.22,
    metalness: 0.08,
    emissive: 0x16a34a,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.88,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);

  const ringGeometry = new THREE.TorusGeometry(0.1, 0.012, 8, 24);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x86efac,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.01;

  const particleGeometry = new THREE.SphereGeometry(0.018, 8, 8);
  const particleGroup = new THREE.Group();
  particleGroup.visible = false;

  const gravityParticleCount = 42;
  const particles = Array.from({ length: gravityParticleCount }, (_, index) => {
    const isWhite = index % 2 === 0;
    const material = new THREE.MeshBasicMaterial({
      color: isWhite ? 0xf8fafc : 0x0a0a0a,
      transparent: true,
      opacity: isWhite ? 0.86 : 0.62,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(particleGeometry, material);
    mesh.visible = false;
    particleGroup.add(mesh);
    return {
      mesh,
      material,
      angle: (index / gravityParticleCount) * Math.PI * 2 + Math.random() * 0.4,
      spinSpeed: 2.2 + Math.random() * 2.1,
      streamSpeed: 0.75 + Math.random() * 0.6,
      orbitRadius: 0.34 + Math.random() * 0.34,
      orbitHeight: 0.5 + Math.random() * 0.52,
      depthOffset: 0.12 + Math.random() * 0.34,
      flowOffset: Math.random(),
      direction: index % 4 < 2 ? 1 : -1,
      baseOpacity: isWhite ? 0.86 : 0.62,
    };
  });

  const applyModePalette = () => {
    if (gravityMode) {
      coreMaterial.color.set(0xf8fafc);
      coreMaterial.emissive.set(0xffffff);
      ringMaterial.color.set(0xf8fafc);
      return;
    }
    coreMaterial.color.set(0x22c55e);
    coreMaterial.emissive.set(0x16a34a);
    ringMaterial.color.set(0x86efac);
  };

  group.add(core, ring, particleGroup);
  avatar.add(group);

  return {
    attachTo: (arm) => {
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
      group.position.set(0.02, -0.92, 0.25);
      group.rotation.set(0, 0, 0);
    },
    setGravityMode: (active) => {
      gravityMode = active;
      particleGroup.visible = gravityMode && group.visible;
      if (!gravityMode) {
        for (let i = 0; i < particles.length; i += 1) {
          particles[i].mesh.visible = false;
        }
      }
      applyModePalette();
    },
    setActive: (active) => {
      group.visible = active;
      particleGroup.visible = active && gravityMode;
      if (!active) {
        lastUpdateAt = 0;
        for (let i = 0; i < particles.length; i += 1) {
          particles[i].mesh.visible = false;
        }
      }
    },
    setRatio: (ratio) => {
      const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
      currentRatio = clamped;
      const coreScale = 0.75 + clamped * 1.3;
      core.scale.setScalar(coreScale);
      ring.scale.setScalar(0.82 + clamped * 1.25);
      coreMaterial.emissiveIntensity = gravityMode
        ? 0.82 + clamped * 1.7
        : 0.6 + clamped * 1.4;
      ringMaterial.opacity = gravityMode
        ? 0.5 + clamped * 0.46
        : 0.38 + clamped * 0.55;
    },
    update: (now) => {
      if (!group.visible) return;
      const deltaSeconds =
        lastUpdateAt > 0
          ? THREE.MathUtils.clamp((now - lastUpdateAt) / 1000, 0, 0.06)
          : 0;
      lastUpdateAt = now;

      const pulse = 1 + Math.sin(now * 0.02) * 0.08;
      ring.rotation.z += gravityMode ? 0.11 : 0.07;
      const baseRingScale = 0.82 + currentRatio * 1.25;
      ring.scale.setScalar(baseRingScale * pulse);
      if (!gravityMode) {
        particleGroup.visible = false;
        return;
      }

      particleGroup.visible = true;
      const pullStrength = 0.26 + currentRatio * 0.64;
      const outerRadiusScale = 1.28 - currentRatio * 0.26;

      for (let i = 0; i < particles.length; i += 1) {
        const entry = particles[i];
        entry.angle += deltaSeconds * entry.spinSpeed * entry.direction;
        const streamT = (now * 0.001 * entry.streamSpeed + entry.flowOffset) % 1;
        const smoothT = THREE.MathUtils.smoothstep(streamT, 0, 1);
        const radius = THREE.MathUtils.lerp(
          entry.orbitRadius * outerRadiusScale,
          0.06,
          smoothT
        );
        const swirl = entry.angle + streamT * Math.PI * 2.6 * entry.direction;
        const x = Math.cos(swirl) * radius;
        const y =
          Math.sin(swirl * 1.18 + entry.flowOffset * Math.PI * 2) *
          radius *
          entry.orbitHeight;
        const z = THREE.MathUtils.lerp(-0.45 - entry.depthOffset, 0.14, smoothT);
        entry.mesh.position.set(x, y, z);
        const scale = (0.46 + (1 - smoothT) * 0.44 + currentRatio * 0.2) * pullStrength;
        entry.mesh.scale.setScalar(scale);
        entry.material.opacity = entry.baseOpacity * (0.52 + (1 - smoothT) * 0.48);
        entry.mesh.visible = true;
      }
    },
    dispose: () => {
      group.removeFromParent();
      for (let i = 0; i < particles.length; i += 1) {
        const entry = particles[i];
        entry.mesh.removeFromParent();
        entry.material.dispose();
      }
      coreGeometry.dispose();
      ringGeometry.dispose();
      particleGeometry.dispose();
      coreMaterial.dispose();
      ringMaterial.dispose();
    },
  };
};

const createGravityStateFx = (avatar: THREE.Object3D): GravityStateFx => {
  const group = new THREE.Group();
  group.visible = false;
  const coreGeometry = new THREE.SphereGeometry(0.06, 12, 10);
  const haloGeometry = new THREE.RingGeometry(0.08, 0.15, 30);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x0a0a0a,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.rotation.y = Math.PI / 2;
  group.add(halo, core);
  avatar.add(group);
  const headMicTopFallbackOffset = new THREE.Vector3(-0.5, 0.46, 0);
  const micTopOffset = new THREE.Vector3(0, 0.19, 0);
  let anchor: THREE.Object3D | null = null;
  let useHeadFallbackOffset = true;
  let lastUpdateAt = 0;
  let flickerElapsed = 0;
  let whiteDominant = true;
  const flickerInterval = 0.1;

  const resolveAnchor = () => {
    if (anchor && anchor.parent) return;
    let micCandidate: THREE.Object3D | null = null;
    let headCandidate: THREE.Object3D | null = null;
    avatar.traverse((node) => {
      const nodeName = (node.name || "").toLowerCase();
      if (
        !micCandidate &&
        (nodeName === "headsetmic" ||
          (nodeName.includes("headset") && nodeName.includes("mic")) ||
          nodeName.includes("microphone"))
      ) {
        micCandidate = node;
      }
      if (!headCandidate && nodeName === "head") {
        headCandidate = node;
      }
    });
    anchor = micCandidate ?? headCandidate ?? avatar;
    useHeadFallbackOffset = anchor !== micCandidate;
    if (group.parent !== anchor) {
      group.removeFromParent();
      anchor.add(group);
    }
    group.position.copy(useHeadFallbackOffset ? headMicTopFallbackOffset : micTopOffset);
  };

  const applyPalette = () => {
    if (whiteDominant) {
      coreMaterial.color.set(0xf8fafc);
      haloMaterial.color.set(0x0a0a0a);
      return;
    }
    coreMaterial.color.set(0x0a0a0a);
    haloMaterial.color.set(0xf8fafc);
  };

  return {
    setActive: (active) => {
      group.visible = active;
      if (active) {
        resolveAnchor();
      }
      if (!active) {
        lastUpdateAt = 0;
        flickerElapsed = 0;
        whiteDominant = true;
      }
      applyPalette();
    },
    update: (now) => {
      if (!group.visible) return;
      resolveAnchor();
      const deltaSeconds =
        lastUpdateAt > 0
          ? THREE.MathUtils.clamp((now - lastUpdateAt) / 1000, 0, 0.08)
          : 0;
      lastUpdateAt = now;

      flickerElapsed += deltaSeconds;
      while (flickerElapsed >= flickerInterval) {
        flickerElapsed -= flickerInterval;
        whiteDominant = !whiteDominant;
        applyPalette();
      }

      const pulse = 1 + Math.sin(now * 0.016) * 0.18;
      core.scale.setScalar(pulse);
      halo.scale.setScalar(1.02 + Math.cos(now * 0.014) * 0.2);
      halo.rotation.z += 0.14;
      coreMaterial.opacity = 0.78 + Math.sin(now * 0.02) * 0.18;
      haloMaterial.opacity = 0.58 + Math.cos(now * 0.023) * 0.2;
    },
    dispose: () => {
      group.removeFromParent();
      coreGeometry.dispose();
      haloGeometry.dispose();
      coreMaterial.dispose();
      haloMaterial.dispose();
    },
  };
};

const createBackpackPulseFx = (avatar: THREE.Object3D): BackpackPulseFx => {
  let active = false;
  let lastUpdateAt = 0;
  let flickerElapsed = 0;
  let isWhite = true;
  const flickerInterval = 0.1;
  let targetMesh: THREE.Mesh | null = null;
  const materialEntries: Array<{
    material: THREE.Material & {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    };
    baseColor?: THREE.Color;
    baseEmissive?: THREE.Color;
    baseEmissiveIntensity: number;
  }> = [];

  const clearMaterials = () => {
    for (let i = 0; i < materialEntries.length; i += 1) {
      materialEntries[i].material.dispose();
    }
    materialEntries.length = 0;
  };

  const resolveTarget = () => {
    if (targetMesh?.parent && materialEntries.length > 0) return;
    targetMesh = null;
    clearMaterials();
    let pocketCandidate: THREE.Mesh | null = null;
    let backpackCandidate: THREE.Mesh | null = null;
    avatar.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = (node.name || "").toLowerCase();
      if (!pocketCandidate && name === "backpackpocket") {
        pocketCandidate = node;
        return;
      }
      if (!backpackCandidate && name === "backpack") {
        backpackCandidate = node;
      }
    });
    targetMesh = pocketCandidate ?? backpackCandidate;
    if (!targetMesh) return;

    const sourceMaterials = Array.isArray(targetMesh.material)
      ? targetMesh.material
      : [targetMesh.material];
    if (!sourceMaterials.length) return;

    const clonedMaterials = sourceMaterials.map(
      (material) =>
        material.clone() as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
          emissiveIntensity?: number;
        }
    );
    targetMesh.material = Array.isArray(targetMesh.material)
      ? clonedMaterials
      : clonedMaterials[0];

    for (let i = 0; i < clonedMaterials.length; i += 1) {
      const material = clonedMaterials[i];
      materialEntries.push({
        material,
        baseColor: material.color?.clone(),
        baseEmissive: material.emissive?.clone(),
        baseEmissiveIntensity: material.emissiveIntensity ?? 0,
      });
    }
  };

  const applyPalette = () => {
    if (!materialEntries.length) return;
    if (active) {
      if (isWhite) {
        for (let i = 0; i < materialEntries.length; i += 1) {
          const entry = materialEntries[i];
          entry.material.color?.set(0xffffff);
          entry.material.emissive?.set(0xffffff);
          entry.material.emissiveIntensity = 0.9;
        }
      } else {
        for (let i = 0; i < materialEntries.length; i += 1) {
          const entry = materialEntries[i];
          entry.material.color?.set(0x000000);
          entry.material.emissive?.set(0x000000);
          entry.material.emissiveIntensity = 0;
        }
      }
      return;
    }
    for (let i = 0; i < materialEntries.length; i += 1) {
      const entry = materialEntries[i];
      if (entry.baseColor) {
        entry.material.color?.copy(entry.baseColor);
      }
      if (entry.baseEmissive) {
        entry.material.emissive?.copy(entry.baseEmissive);
      }
      entry.material.emissiveIntensity = entry.baseEmissiveIntensity;
    }
  };

  return {
    setActive: (nextActive) => {
      active = nextActive;
      if (!active) {
        lastUpdateAt = 0;
        flickerElapsed = 0;
        isWhite = true;
      }
      resolveTarget();
      applyPalette();
    },
    update: (now) => {
      if (!active) return;
      resolveTarget();
      const deltaSeconds =
        lastUpdateAt > 0
          ? THREE.MathUtils.clamp((now - lastUpdateAt) / 1000, 0, 0.08)
          : 0;
      lastUpdateAt = now;
      flickerElapsed += deltaSeconds;
      while (flickerElapsed >= flickerInterval) {
        flickerElapsed -= flickerInterval;
        isWhite = !isWhite;
      }
      applyPalette();
    },
    dispose: () => {
      clearMaterials();
      targetMesh = null;
    },
  };
};

const createFaceGlassesPulseFx = (
  avatar: THREE.Object3D
): FaceGlassesPulseFx => {
  let active = false;
  let lastUpdateAt = 0;
  let flickerElapsed = 0;
  let isWhite = true;
  const flickerInterval = 0.2;
  let targetMesh: THREE.Mesh | null = null;
  const materialEntries: Array<{
    material: THREE.Material & {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    };
    baseColor?: THREE.Color;
    baseEmissive?: THREE.Color;
    baseEmissiveIntensity: number;
  }> = [];

  const clearMaterials = () => {
    for (let i = 0; i < materialEntries.length; i += 1) {
      materialEntries[i].material.dispose();
    }
    materialEntries.length = 0;
  };

  const resolveTarget = () => {
    if (targetMesh?.parent && materialEntries.length > 0) return;
    targetMesh = null;
    clearMaterials();
    let glassesCandidate: THREE.Mesh | null = null;
    avatar.traverse((node) => {
      if (glassesCandidate || !(node instanceof THREE.Mesh)) return;
      const name = (node.name || "").toLowerCase();
      if (name === "faceglasses" || name.includes("glasses")) {
        glassesCandidate = node;
      }
    });
    targetMesh = glassesCandidate;
    if (!targetMesh) return;

    const sourceMaterials = Array.isArray(targetMesh.material)
      ? targetMesh.material
      : [targetMesh.material];
    if (!sourceMaterials.length) return;

    const clonedMaterials = sourceMaterials.map(
      (material) =>
        material.clone() as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
          emissiveIntensity?: number;
        }
    );
    targetMesh.material = Array.isArray(targetMesh.material)
      ? clonedMaterials
      : clonedMaterials[0];

    for (let i = 0; i < clonedMaterials.length; i += 1) {
      const material = clonedMaterials[i];
      materialEntries.push({
        material,
        baseColor: material.color?.clone(),
        baseEmissive: material.emissive?.clone(),
        baseEmissiveIntensity: material.emissiveIntensity ?? 0,
      });
    }
  };

  const applyPalette = () => {
    if (!materialEntries.length) return;
    if (active) {
      if (isWhite) {
        for (let i = 0; i < materialEntries.length; i += 1) {
          const entry = materialEntries[i];
          entry.material.color?.set(0xffffff);
          entry.material.emissive?.set(0xffffff);
          entry.material.emissiveIntensity = 0.9;
        }
      } else {
        for (let i = 0; i < materialEntries.length; i += 1) {
          const entry = materialEntries[i];
          entry.material.color?.set(0x000000);
          entry.material.emissive?.set(0x000000);
          entry.material.emissiveIntensity = 0;
        }
      }
      return;
    }
    for (let i = 0; i < materialEntries.length; i += 1) {
      const entry = materialEntries[i];
      if (entry.baseColor) {
        entry.material.color?.copy(entry.baseColor);
      }
      if (entry.baseEmissive) {
        entry.material.emissive?.copy(entry.baseEmissive);
      }
      entry.material.emissiveIntensity = entry.baseEmissiveIntensity;
    }
  };

  return {
    setActive: (nextActive) => {
      active = nextActive;
      if (!active) {
        lastUpdateAt = 0;
        flickerElapsed = 0;
        isWhite = true;
      }
      resolveTarget();
      applyPalette();
    },
    update: (now) => {
      if (!active) return;
      resolveTarget();
      const deltaSeconds =
        lastUpdateAt > 0
          ? THREE.MathUtils.clamp((now - lastUpdateAt) / 1000, 0, 0.08)
          : 0;
      lastUpdateAt = now;
      flickerElapsed += deltaSeconds;
      while (flickerElapsed >= flickerInterval) {
        flickerElapsed -= flickerInterval;
        isWhite = !isWhite;
      }
      applyPalette();
    },
    dispose: () => {
      clearMaterials();
      targetMesh = null;
    },
  };
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  mount,
  fireProjectile,
  spendEnergy,
  getCurrentStats,
}) => {
  const hud = createChargeHud(mount);
  const footParticleFx = createFootParticleFx(avatar);
  const gunChargeFx = createGunChargeFx(avatar);
  const gravityStateFx = createGravityStateFx(avatar);
  const backpackPulseFx = createBackpackPulseFx(avatar);
  const faceGlassesPulseFx = createFaceGlassesPulseFx(avatar);

  const chargeConfig = {
    defaultDurationMs: 700,
    gravityDurationMs: 2000,
    projectileSpeed: 24,
    projectileLifetime: 1.45,
    projectileRadius: 0.16,
  };
  const skillEConfig = {
    durationMs: 10000,
    movementMultiplier: 1.2,
    burstShots: 2,
    burstIntervalMs: 95,
  };
  const skillRConfig = {
    durationMs: 10000,
    movementMultiplier: 0.5,
    explosiveRadius: 5,
    directDamage: 85,
    minExplosionDamage: 40,
  };
  const skillQConfig = {
    minActivationEnergy: 70,
    energyDrainPerSecond: 5,
    movementMultiplier: 1.2,
    burstShots: 2,
  };
  const sprintLeanRad = THREE.MathUtils.degToRad(10);
  const gravityShellFlickerInterval = 0.05;

  const chargeState = {
    isCharging: false,
    startAt: 0,
    ratio: 0,
  };
  const skillEState = {
    active: false,
    expiresAt: 0,
  };
  const skillQState = {
    active: false,
  };
  const skillRState = {
    active: false,
    expiresAt: 0,
  };
  const burstState = {
    active: false,
    nextAt: 0,
    remaining: 0,
    origin: new THREE.Vector3(),
    direction: new THREE.Vector3(0, 0, 1),
  };

  const armState = {
    raise: 0,
  };
  const armPose = {
    captured: false,
    rightId: "",
    leftId: "",
    rightX: 0,
    rightY: 0,
    rightZ: 0,
    leftX: 0,
    leftY: 0,
    leftZ: 0,
    swingStartAt: 0,
    restartRequested: false,
    wasMoving: false,
  };

  const runtimeProfile = {
    ...profile,
    animateArms: ({
      arms,
      isMoving,
      now,
    }: {
      arms: THREE.Object3D[];
      isMoving: boolean;
      now: number;
    }) => {
      if (!arms.length) return;
      const rightArm = pickArm(arms, "right");
      if (!rightArm) return;
      const leftArm =
        pickArm(arms, "left", rightArm) ??
        arms.find((arm) => arm !== rightArm) ??
        rightArm;

      const shouldCapturePose =
        !armPose.captured ||
        armPose.rightId !== rightArm.uuid ||
        armPose.leftId !== leftArm.uuid;
      if (shouldCapturePose) {
        armPose.captured = true;
        armPose.rightId = rightArm.uuid;
        armPose.leftId = leftArm.uuid;
        armPose.rightX = -0.08;
        armPose.rightY = rightArm.rotation.y;
        armPose.rightZ = rightArm.rotation.z;
        armPose.leftX = -0.08;
        armPose.leftY = leftArm.rotation.y;
        armPose.leftZ = leftArm.rotation.z;
        armPose.swingStartAt = now;
        armPose.restartRequested = false;
        armPose.wasMoving = false;
      }

      rightArm.rotation.y = armPose.rightY;
      rightArm.rotation.z = armPose.rightZ;
      leftArm.rotation.y = armPose.leftY;
      leftArm.rotation.z = armPose.leftZ;

      if (chargeState.isCharging) {
        rightArm.rotation.x = armPose.rightX;
        leftArm.rotation.x = armPose.leftX;
        armPose.wasMoving = false;
        return;
      }

      if (armPose.restartRequested || (isMoving && !armPose.wasMoving)) {
        armPose.swingStartAt = now;
        armPose.restartRequested = false;
      }
      armPose.wasMoving = isMoving;

      if (!isMoving) {
        rightArm.rotation.x = armPose.rightX;
        leftArm.rotation.x = armPose.leftX;
        return;
      }

      const swingTime = (now - armPose.swingStartAt) * 0.008;
      const rightSwing = Math.sin(swingTime) * 1;
      const leftSwing = Math.sin(swingTime + Math.PI) * 1;
      rightArm.rotation.x = armPose.rightX + rightSwing;
      leftArm.rotation.x = armPose.leftX + leftSwing;
    },
    animateModel: ({
      avatarModel,
      isSprinting = false,
      THREE,
    }: {
      avatarModel: THREE.Object3D;
      isSprinting?: boolean;
      THREE: typeof import("three");
    }) => {
      const targetPitch = isSprinting ? sprintLeanRad : 0;
      const damp = isSprinting ? 0.24 : 0.16;
      avatarModel.rotation.x = THREE.MathUtils.lerp(
        avatarModel.rotation.x,
        targetPitch,
        damp
      );
    },
  };

  const baseRuntime = createCharacterRuntime({ avatar, profile: runtimeProfile });

  const aimDirection = new THREE.Vector3(0, 0, 1);
  const aimOrigin = new THREE.Vector3();
  const fallbackForward = new THREE.Vector3();
  const muzzleOrigin = new THREE.Vector3();
  const shotOrigin = new THREE.Vector3();
  const shotDirection = new THREE.Vector3();
  const projectileForwardAxis = new THREE.Vector3(0, 0, 1);

  const projectileGeometry = new THREE.SphereGeometry(0.095, 16, 14);
  const projectileMaterial = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 0.95,
    roughness: 0.28,
    metalness: 0.08,
  });
  let lastUpdateAt = 0;

  const clearBurstQueue = () => {
    burstState.active = false;
    burstState.nextAt = 0;
    burstState.remaining = 0;
  };

  const getCurrentChargeDurationMs = () =>
    skillRState.active ? chargeConfig.gravityDurationMs : chargeConfig.defaultDurationMs;

  const deactivateSkillE = () => {
    skillEState.active = false;
    skillEState.expiresAt = 0;
  };

  const deactivateSkillQ = () => {
    skillQState.active = false;
    backpackPulseFx.setActive(false);
    faceGlassesPulseFx.setActive(false);
  };

  const deactivateSkillR = () => {
    skillRState.active = false;
    skillRState.expiresAt = 0;
    gravityStateFx.setActive(false);
  };

  const queueBurstShots = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    now: number,
    totalShots: number
  ) => {
    const extraShots = Math.max(0, totalShots - 1);
    if (extraShots <= 0) return;
    burstState.active = true;
    burstState.remaining = extraShots;
    burstState.nextAt = now + skillEConfig.burstIntervalMs;
    burstState.origin.copy(origin);
    burstState.direction.copy(direction);
  };

  const resolveShotPose = (origin: THREE.Vector3, direction: THREE.Vector3) => {
    direction.copy(aimDirection);
    if (direction.lengthSq() < minDirectionSq) {
      fallbackForward.set(0, 0, 1).applyQuaternion(avatar.quaternion);
      direction.copy(fallbackForward);
    }
    if (direction.lengthSq() < minDirectionSq) {
      direction.set(0, 0, 1);
    } else {
      direction.normalize();
    }

    origin.copy(muzzleOrigin);
    if (origin.lengthSq() < minDirectionSq) {
      origin.copy(aimOrigin);
      origin.y -= 0.2;
      origin.addScaledVector(direction, 0.4);
    }
  };

  const resetChargeState = () => {
    chargeState.isCharging = false;
    chargeState.startAt = 0;
    chargeState.ratio = 0;
    armState.raise = 0;
    armPose.restartRequested = true;
    armPose.wasMoving = false;
    hud.setFlickerMode(false);
    gunChargeFx.setGravityMode(false);
    gunChargeFx.setActive(false);
    gunChargeFx.setRatio(0);
    gunChargeFx.attachTo(null);
  };

  const fireChargedProjectile = (
    originInput?: THREE.Vector3,
    directionInput?: THREE.Vector3
  ) => {
    if (!fireProjectile) return;

    const isExplosiveShell = skillRState.active || skillQState.active;
    const gravityShellMaterial = isExplosiveShell
      ? (projectileMaterial.clone() as THREE.MeshStandardMaterial)
      : null;
    if (gravityShellMaterial) {
      gravityShellMaterial.color.set(0xffffff);
      gravityShellMaterial.emissive.set(0xffffff);
      gravityShellMaterial.emissiveIntensity = 1.15;
    }
    const mesh = new THREE.Mesh(
      projectileGeometry,
      gravityShellMaterial ?? projectileMaterial
    );
    mesh.scale.set(
      isExplosiveShell ? 0.94 : 0.78,
      isExplosiveShell ? 0.94 : 0.78,
      isExplosiveShell ? 2.45 : 2.2
    );

    if (originInput && directionInput) {
      shotOrigin.copy(originInput);
      shotDirection.copy(directionInput);
      if (shotDirection.lengthSq() < minDirectionSq) {
        shotDirection.set(0, 0, 1);
      } else {
        shotDirection.normalize();
      }
    } else {
      resolveShotPose(shotOrigin, shotDirection);
    }

    mesh.quaternion.setFromUnitVectors(projectileForwardAxis, shotDirection);

    fireProjectile({
      projectileType: "abilityOrb",
      origin: shotOrigin,
      direction: shotDirection,
      mesh,
      radius: chargeConfig.projectileRadius,
      speed: isExplosiveShell ? 20 : chargeConfig.projectileSpeed,
      lifetime: isExplosiveShell ? 1.8 : chargeConfig.projectileLifetime,
      gravity: 0,
      energyGainOnHit: 6,
      damage: isExplosiveShell ? skillRConfig.directDamage : undefined,
      splitOnImpact: isExplosiveShell,
      explodeOnExpire: isExplosiveShell,
      explosionRadius: isExplosiveShell ? skillRConfig.explosiveRadius : undefined,
      explosionDamage: isExplosiveShell ? skillRConfig.directDamage : undefined,
      explosionMinDamage: isExplosiveShell
        ? skillRConfig.minExplosionDamage
        : undefined,
      explosionColor: isExplosiveShell ? 0x000000 : undefined,
      explosionEmissive: isExplosiveShell ? 0xffffff : undefined,
      explosionEmissiveIntensity: isExplosiveShell ? 1.3 : undefined,
      lifecycle: {
        applyForces: ({ velocity, delta }) => {
          if (velocity.lengthSq() < minDirectionSq) return;
          shotDirection.copy(velocity).normalize();
          mesh.quaternion.setFromUnitVectors(projectileForwardAxis, shotDirection);
          if (!gravityShellMaterial) return;
          let elapsed = (mesh.userData.gravityFlickerElapsed as number) ?? 0;
          elapsed += delta;
          while (elapsed >= gravityShellFlickerInterval) {
            elapsed -= gravityShellFlickerInterval;
            const isWhite =
              !Boolean(mesh.userData.gravityFlickerWhite ?? false);
            mesh.userData.gravityFlickerWhite = isWhite;
            if (isWhite) {
              gravityShellMaterial.color.set(0xffffff);
              gravityShellMaterial.emissive.set(0xffffff);
            } else {
              gravityShellMaterial.color.set(0x0a0a0a);
              gravityShellMaterial.emissive.set(0x0a0a0a);
            }
          }
          mesh.userData.gravityFlickerElapsed = elapsed;
        },
        onRemove: () => {
          gravityShellMaterial?.dispose();
        },
      },
    });
  };

  const processBurstQueue = (now: number) => {
    if (!burstState.active) return;
    while (burstState.remaining > 0 && now >= burstState.nextAt) {
      fireChargedProjectile(burstState.origin, burstState.direction);
      burstState.remaining -= 1;
      burstState.nextAt += skillEConfig.burstIntervalMs;
    }
    if (burstState.remaining <= 0) {
      burstState.active = false;
      burstState.nextAt = 0;
    }
  };

  const beginCharge = () => {
    if (chargeState.isCharging) return;
    chargeState.isCharging = true;
    chargeState.startAt = performance.now();
    chargeState.ratio = 0;
    hud.setVisible(true);
    hud.setRatio(0);
  };

  const cancelCharge = () => {
    resetChargeState();
    hud.setVisible(false);
    hud.setRatio(0);
  };

  const releaseCharge = () => {
    if (!chargeState.isCharging) return;
    const now = performance.now();
    const elapsed = now - chargeState.startAt;
    const ratio = THREE.MathUtils.clamp(
      elapsed / getCurrentChargeDurationMs(),
      0,
      1
    );
    resetChargeState();
    hud.setVisible(false);
    hud.setRatio(0);
    if (ratio < 1) return;
    resolveShotPose(shotOrigin, shotDirection);
    fireChargedProjectile(shotOrigin, shotDirection);
    const burstShots = skillQState.active
      ? skillQConfig.burstShots
      : skillEState.active
        ? skillEConfig.burstShots
        : 1;
    if (burstShots > 1) {
      queueBurstShots(shotOrigin, shotDirection, now, burstShots);
    }
  };

  const handleSkillQ = () => {
    if (skillQState.active) {
      deactivateSkillQ();
      clearBurstQueue();
      return true;
    }
    const currentEnergy = getCurrentStats?.().energy ?? 0;
    if (currentEnergy < skillQConfig.minActivationEnergy) {
      return false;
    }
    cancelCharge();
    clearBurstQueue();
    if (skillEState.active) {
      deactivateSkillE();
    }
    if (skillRState.active) {
      deactivateSkillR();
    }
    skillQState.active = true;
    backpackPulseFx.setActive(true);
    faceGlassesPulseFx.setActive(true);
    return true;
  };

  const handleSkillE = () => {
    const now = performance.now();
    if (skillQState.active) {
      deactivateSkillQ();
      clearBurstQueue();
    }
    if (skillRState.active) {
      deactivateSkillR();
    }
    if (skillEState.active && now < skillEState.expiresAt) {
      return false;
    }
    skillEState.active = true;
    skillEState.expiresAt = now + skillEConfig.durationMs;
    return true;
  };

  const handleSkillR = () => {
    const now = performance.now();
    if (skillQState.active) {
      deactivateSkillQ();
      clearBurstQueue();
    }
    if (skillEState.active) {
      deactivateSkillE();
      clearBurstQueue();
    }
    if (skillRState.active && now < skillRState.expiresAt) {
      return false;
    }
    cancelCharge();
    clearBurstQueue();
    skillRState.active = true;
    skillRState.expiresAt = now + skillRConfig.durationMs;
    gravityStateFx.setActive(true);
    return true;
  };

  const resetState = () => {
    cancelCharge();
    armPose.restartRequested = true;
    armPose.wasMoving = false;
    deactivateSkillE();
    deactivateSkillQ();
    deactivateSkillR();
    clearBurstQueue();
    footParticleFx.clear();
    gravityStateFx.setActive(false);
    backpackPulseFx.setActive(false);
    gunChargeFx.setActive(false);
    gunChargeFx.attachTo(null);
    gunChargeFx.setRatio(0);
    hud.setVisible(false);
    hud.setRatio(0);
    baseRuntime.resetState?.();
  };

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handleRightClick: (facing) => {
      if (chargeState.isCharging) return;
      baseRuntime.handleRightClick(facing);
    },
    handlePrimaryDown: beginCharge,
    handlePrimaryUp: releaseCharge,
    handlePrimaryCancel: cancelCharge,
    handleSkillQ,
    handleSkillE,
    handleSkillR,
    getMovementSpeedMultiplier: () => {
      if (skillRState.active) {
        return skillRConfig.movementMultiplier;
      }
      if (skillQState.active) {
        return skillQConfig.movementMultiplier;
      }
      if (skillEState.active) {
        return skillEConfig.movementMultiplier;
      }
      return 1;
    },
    beforeSkillUse: ({ key }) => {
      if ((key === "e" || key === "r") && skillQState.active) {
        deactivateSkillQ();
        clearBurstQueue();
        return;
      }
      if (key !== "q") return;
      if (skillQState.active) {
        return { ignoreCostAndCooldown: true };
      }
      const currentEnergy = getCurrentStats?.().energy ?? 0;
      if (currentEnergy < skillQConfig.minActivationEnergy) {
        return { allow: false, ignoreCostAndCooldown: true };
      }
      return { ignoreResource: true };
    },
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    isBasicAttackLocked: () => chargeState.isCharging,
    resetState,
    update: (args) => {
      baseRuntime.update(args);
      const deltaSeconds =
        lastUpdateAt > 0
          ? THREE.MathUtils.clamp((args.now - lastUpdateAt) / 1000, 0, 0.12)
          : 0;
      lastUpdateAt = args.now;

      if (args.aimOriginWorld) {
        aimOrigin.copy(args.aimOriginWorld);
      }
      if (args.aimDirectionWorld && args.aimDirectionWorld.lengthSq() > minDirectionSq) {
        aimDirection.copy(args.aimDirectionWorld).normalize();
      }
      if (skillEState.active && args.now >= skillEState.expiresAt) {
        deactivateSkillE();
      }
      if (skillRState.active && args.now >= skillRState.expiresAt) {
        deactivateSkillR();
      }
      gravityStateFx.setActive(skillRState.active);
      gravityStateFx.update(args.now);
      backpackPulseFx.update(args.now);
      faceGlassesPulseFx.update(args.now);
      processBurstQueue(args.now);
      if (skillQState.active) {
        const drainAmount = skillQConfig.energyDrainPerSecond * deltaSeconds;
        if (drainAmount > 0) {
          const spent = spendEnergy?.(drainAmount) ?? drainAmount;
          if (spent + 0.0001 < drainAmount) {
            const remainEnergy = getCurrentStats?.().energy ?? 0;
            if (remainEnergy <= 0.0001) {
              deactivateSkillQ();
              clearBurstQueue();
            }
          }
        }
      }
      footParticleFx.update({
        deltaSeconds,
        active: skillEState.active,
        isMoving: Boolean(args.isMoving || args.isSprinting),
        legLeft: args.legLeft,
        legRight: args.legRight,
      });

      if (chargeState.isCharging) {
        const elapsed = args.now - chargeState.startAt;
        chargeState.ratio = THREE.MathUtils.clamp(
          elapsed / getCurrentChargeDurationMs(),
          0,
          1
        );
        hud.setVisible(true);
        hud.setRatio(chargeState.ratio);
        hud.setFlickerMode(skillQState.active);
        hud.update(args.now);
      } else {
        hud.setFlickerMode(false);
      }

      const targetRaise = chargeState.isCharging ? 0.35 + chargeState.ratio * 0.65 : 0;
      armState.raise = chargeState.isCharging
        ? THREE.MathUtils.lerp(armState.raise, targetRaise, 0.32)
        : 0;

      if (!args.arms.length) return;
      const rightArm = pickArm(args.arms, "right");
      if (!rightArm) {
        gunChargeFx.setGravityMode(false);
        gunChargeFx.setActive(false);
        gunChargeFx.attachTo(null);
        return;
      }

      rightArm.getWorldPosition(muzzleOrigin);
      muzzleOrigin.addScaledVector(aimDirection, 0.38);

      if (chargeState.isCharging) {
        gunChargeFx.attachTo(rightArm);
        gunChargeFx.setGravityMode(skillRState.active);
        gunChargeFx.setActive(true);
        gunChargeFx.setRatio(chargeState.ratio);
        gunChargeFx.update(args.now);
      } else {
        gunChargeFx.setGravityMode(false);
        gunChargeFx.setActive(false);
        gunChargeFx.attachTo(null);
      }

      if (!chargeState.isCharging) return;

      const baseX =
        armPose.captured && armPose.rightId === rightArm.uuid
          ? armPose.rightX
          : rightArm.rotation.x;
      const baseY =
        armPose.captured && armPose.rightId === rightArm.uuid
          ? armPose.rightY
          : rightArm.rotation.y;
      const baseZ =
        armPose.captured && armPose.rightId === rightArm.uuid
          ? armPose.rightZ
          : rightArm.rotation.z;

      // During charge, override right arm to raised gun pose from the initial base pose.
      rightArm.rotation.set(
        baseX + (-0.28 - armState.raise * 1.1),
        baseY + -0.08 * armState.raise,
        baseZ + -0.26 * armState.raise
      );
    },
    dispose: () => {
      resetChargeState();
      deactivateSkillE();
      deactivateSkillQ();
      deactivateSkillR();
      clearBurstQueue();
      footParticleFx.dispose();
      gravityStateFx.dispose();
      backpackPulseFx.dispose();
      faceGlassesPulseFx.dispose();
      gunChargeFx.dispose();
      lastUpdateAt = 0;
      hud.dispose();
      projectileGeometry.dispose();
      projectileMaterial.dispose();
      baseRuntime.dispose();
    },
    isFacingLocked: baseRuntime.isFacingLocked,
  });
};




