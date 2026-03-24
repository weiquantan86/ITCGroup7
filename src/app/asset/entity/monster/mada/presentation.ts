import * as THREE from "three";

export type MadaMode = "inactive" | "active" | "vanishing" | "vanished";

export type MadaPresentationState = {
  mode: MadaMode;
  fadeAlpha: number;
};

export type ResolveMadaPresentationStateArgs = {
  activated: boolean;
  transitionActive: boolean;
  released: boolean;
  hasVanished: boolean;
  fadeAlpha?: number;
};

type MadaEyeMaterialState = {
  material: THREE.Material;
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
  baseColor?: THREE.Color;
  baseEmissive?: THREE.Color;
  baseEmissiveIntensity?: number;
};

type MadaBodyMaterialState = {
  material: THREE.Material;
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
  baseColor?: THREE.Color;
  baseEmissive?: THREE.Color;
  baseEmissiveIntensity?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const MADA_HIT_FLASH_DURATION_MS = 110;
const MADA_HIT_FLASH_COLOR = new THREE.Color(0xff3b30);

const isColorMaterial = (
  material: THREE.Material
): material is THREE.Material & { color: THREE.Color } =>
  Boolean(
    (material as THREE.Material & { color?: THREE.Color }).color?.isColor
  );

const isEmissiveMaterial = (
  material: THREE.Material
): material is THREE.Material & {
  emissive: THREE.Color;
  emissiveIntensity: number;
} => {
  const candidate = material as THREE.Material & {
    emissive?: THREE.Color;
    emissiveIntensity?: number;
  };
  return Boolean(candidate.emissive?.isColor);
};

export const resolveMadaPresentationState = ({
  activated,
  transitionActive,
  released,
  hasVanished,
  fadeAlpha = 1,
}: ResolveMadaPresentationStateArgs): MadaPresentationState => {
  if (hasVanished) {
    return {
      mode: "vanished",
      fadeAlpha: 0,
    };
  }

  if (transitionActive) {
    if (!released) {
      return {
        mode: "inactive",
        fadeAlpha: 1,
      };
    }

    const clampedFadeAlpha = clamp(fadeAlpha, 0, 1);
    if (clampedFadeAlpha < 0.999) {
      return {
        mode: "vanishing",
        fadeAlpha: clampedFadeAlpha,
      };
    }

    return {
      mode: "active",
      fadeAlpha: 1,
    };
  }

  return {
    mode: activated ? "active" : "inactive",
    fadeAlpha: 1,
  };
};

export const createMadaPresentationController = ({
  rig,
  modelRoot,
}: {
  rig: THREE.Group;
  modelRoot: THREE.Group;
}) => {
  let eyeNodes: THREE.Object3D[] = [];
  let eyeMaterials: MadaEyeMaterialState[] = [];
  let bodyMaterials: MadaBodyMaterialState[] = [];
  let hitFlashUntil = 0;
  let hitFlashResetTimer: ReturnType<typeof setTimeout> | null = null;
  let currentState: MadaPresentationState = {
    mode: "inactive",
    fadeAlpha: 1,
  };

  const isDescendantOfEyeNode = (object: THREE.Object3D) => {
    for (let i = 0; i < eyeNodes.length; i += 1) {
      if (eyeNodes[i] === object || eyeNodes[i].getObjectById(object.id)) {
        return true;
      }
    }
    return false;
  };

  const captureMaterialState = (material: THREE.Material) => ({
    material,
    baseOpacity: material.opacity,
    baseTransparent: material.transparent,
    baseDepthWrite: material.depthWrite,
    baseColor: isColorMaterial(material) ? material.color.clone() : undefined,
    baseEmissive: isEmissiveMaterial(material)
      ? material.emissive.clone()
      : undefined,
    baseEmissiveIntensity: isEmissiveMaterial(material)
      ? material.emissiveIntensity
      : undefined,
  });

  const refreshEyeMaterials = () => {
    const trackedMaterials = new Set<THREE.Material>();
    eyeMaterials = [];
    for (let i = 0; i < eyeNodes.length; i += 1) {
      eyeNodes[i].traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (let materialIndex = 0; materialIndex < materials.length; materialIndex += 1) {
          const material = materials[materialIndex];
          if (!material || trackedMaterials.has(material)) continue;
          trackedMaterials.add(material);
          eyeMaterials.push(captureMaterialState(material));
        }
      });
    }
  };

  const refreshBodyMaterials = () => {
    const trackedMaterials = new Set<THREE.Material>();
    bodyMaterials = [];
    modelRoot.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (isDescendantOfEyeNode(child)) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (let i = 0; i < materials.length; i += 1) {
        const material = materials[i];
        if (!material || trackedMaterials.has(material)) continue;
        trackedMaterials.add(material);
        bodyMaterials.push(captureMaterialState(material));
      }
    });
  };

  const applyEyeAlpha = (alpha: number) => {
    const resolvedAlpha = clamp(alpha, 0, 1);
    const visible = resolvedAlpha > 0.001;
    for (let i = 0; i < eyeNodes.length; i += 1) {
      eyeNodes[i].visible = visible;
    }
    for (let i = 0; i < eyeMaterials.length; i += 1) {
      const entry = eyeMaterials[i];
      const nextOpacity = entry.baseOpacity * resolvedAlpha;
      const nextTransparent = entry.baseTransparent || resolvedAlpha < 0.999;
      const nextDepthWrite = nextOpacity > 0.02 ? entry.baseDepthWrite : false;
      const opacityChanged = Math.abs(entry.material.opacity - nextOpacity) > 0.001;
      const transparentChanged = entry.material.transparent !== nextTransparent;
      const depthWriteChanged = entry.material.depthWrite !== nextDepthWrite;
      entry.material.opacity = nextOpacity;
      entry.material.transparent = nextTransparent;
      entry.material.depthWrite = nextDepthWrite;
      if (entry.baseColor && isColorMaterial(entry.material)) {
        entry.material.color.copy(entry.baseColor);
      }
      if (entry.baseEmissive && isEmissiveMaterial(entry.material)) {
        entry.material.emissive.copy(entry.baseEmissive);
        entry.material.emissiveIntensity = entry.baseEmissiveIntensity ?? 0;
      }
      if (opacityChanged || transparentChanged || depthWriteChanged) {
        entry.material.needsUpdate = true;
      }
    }
  };

  const applyBodyState = (
    alpha: number,
    forcePureBlack: boolean,
    hitFlashActive: boolean
  ) => {
    const resolvedAlpha = clamp(alpha, 0, 1);
    for (let i = 0; i < bodyMaterials.length; i += 1) {
      const entry = bodyMaterials[i];
      const nextOpacity = entry.baseOpacity * resolvedAlpha;
      const nextTransparent = entry.baseTransparent || resolvedAlpha < 0.999;
      const nextDepthWrite = nextOpacity > 0.02 ? entry.baseDepthWrite : false;
      const opacityChanged = Math.abs(entry.material.opacity - nextOpacity) > 0.001;
      const transparentChanged = entry.material.transparent !== nextTransparent;
      const depthWriteChanged = entry.material.depthWrite !== nextDepthWrite;
      entry.material.opacity = nextOpacity;
      entry.material.transparent = nextTransparent;
      entry.material.depthWrite = nextDepthWrite;
      if (entry.baseColor && isColorMaterial(entry.material)) {
        if (forcePureBlack) {
          entry.material.color.setRGB(0, 0, 0);
        } else if (hitFlashActive) {
          entry.material.color.copy(MADA_HIT_FLASH_COLOR);
        } else {
          entry.material.color.copy(entry.baseColor);
        }
      }
      if (entry.baseEmissive && isEmissiveMaterial(entry.material)) {
        if (forcePureBlack) {
          entry.material.emissive.setRGB(0, 0, 0);
          entry.material.emissiveIntensity = 0;
        } else if (hitFlashActive) {
          entry.material.emissive.copy(MADA_HIT_FLASH_COLOR);
          entry.material.emissiveIntensity = Math.max(
            entry.baseEmissiveIntensity ?? 0,
            0.75
          );
        } else {
          entry.material.emissive.copy(entry.baseEmissive);
          entry.material.emissiveIntensity = entry.baseEmissiveIntensity ?? 0;
        }
      }
      if (opacityChanged || transparentChanged || depthWriteChanged) {
        entry.material.needsUpdate = true;
      }
    }
  };

  const applyState = (
    state: MadaPresentationState,
    now = performance.now()
  ) => {
    currentState = {
      mode: state.mode,
      fadeAlpha: clamp(state.fadeAlpha, 0, 1),
    };

    let eyeAlpha = 0;
    let bodyAlpha = 1;
    let forcePureBlack = false;

    if (currentState.mode === "active") {
      eyeAlpha = 1;
    } else if (currentState.mode === "inactive") {
      forcePureBlack = true;
    } else if (currentState.mode === "vanishing") {
      eyeAlpha = currentState.fadeAlpha;
      bodyAlpha = currentState.fadeAlpha;
      // Keep the body as a black silhouette while fading out.
      forcePureBlack = true;
    } else if (currentState.mode === "vanished") {
      eyeAlpha = 0;
      bodyAlpha = 0;
    }

    const hitFlashActive = now < hitFlashUntil;
    applyEyeAlpha(eyeAlpha);
    applyBodyState(bodyAlpha, forcePureBlack, hitFlashActive);
    rig.visible = eyeAlpha > 0.001 || bodyAlpha > 0.001;
  };

  const scheduleHitFlashReset = () => {
    if (hitFlashResetTimer !== null) {
      clearTimeout(hitFlashResetTimer);
      hitFlashResetTimer = null;
    }
    const delayMs = Math.max(
      0,
      Math.ceil(hitFlashUntil - performance.now())
    );
    hitFlashResetTimer = setTimeout(() => {
      hitFlashResetTimer = null;
      applyState(currentState);
    }, delayMs + 1);
  };

  const bindModel = (model: THREE.Object3D | null) => {
    eyeNodes = [];
    if (model) {
      const eyeGroup = model.getObjectByName("eyeGroup");
      if (eyeGroup) {
        eyeNodes.push(eyeGroup);
      } else {
        const eyeLeft = model.getObjectByName("eyeLeft");
        const eyeRight = model.getObjectByName("eyeRight");
        if (eyeLeft) eyeNodes.push(eyeLeft);
        if (eyeRight) eyeNodes.push(eyeRight);
      }
    }
    refreshEyeMaterials();
    refreshBodyMaterials();
    applyState(currentState);
  };

  bindModel(null);

  return {
    bindModel,
    applyState,
    triggerHitFlash: (now = performance.now()) => {
      hitFlashUntil = now + MADA_HIT_FLASH_DURATION_MS;
      applyState(currentState, now);
      scheduleHitFlashReset();
    },
    getState: () => currentState,
  };
};
