import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  applyCharacterModelVisibility,
  createVisibleModelBounds,
  filterCharacterArmControls,
  shouldHideCharacterNode,
} from "./modelVisibility";

export const characterGltfAnimationClipsKey = "__characterGltfAnimationClips";

const isHeadRelated = (obj: THREE.Object3D | null) => {
  let current = obj;
  while (current) {
    if (
      /head|eye|face|hair|hat|cap|hood|helmet|visor|mask|headset|cover/i.test(
        current.name
      )
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const isArmRelated = (obj: THREE.Object3D | null) => {
  let current = obj;
  while (current) {
    const nodeName = current.name.trim().toLowerCase();
    if (nodeName !== "armature" && /arm|hand|weapon|gun|sword|blade/i.test(nodeName)) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const isArmControlNodeName = (name: string) => {
  const normalized = name.trim().toLowerCase();
  return (
    normalized.startsWith("arm") ||
    (normalized.startsWith("hand") && normalized.endsWith("root"))
  );
};

export type CharacterVisualState = {
  avatarModel: THREE.Object3D | null;
  arms: THREE.Object3D[];
  legLeft: THREE.Object3D | null;
  legRight: THREE.Object3D | null;
  headBone: THREE.Object3D | null;
  headBoneRest: THREE.Quaternion | null;
  eyeHeight: number;
  modelFootOffset: number;
};

type CreateCharacterLoaderArgs = {
  loader: GLTFLoader;
  avatar: THREE.Group;
  lookPivot: THREE.Group;
  avatarBody: THREE.Mesh;
  avatarGlow: THREE.Mesh;
  miniCamera: THREE.PerspectiveCamera;
  hideLocalHead: boolean;
  hideLocalBody: boolean;
  headLayer: number;
  bodyLayer: number;
  isMounted: () => boolean;
};

type LoadCharacterVisualArgs = {
  path: string;
  groundY: number;
  hideLocalHead?: boolean;
  hideLocalBody?: boolean;
  previousModel: THREE.Object3D | null;
  onLoaded: (state: CharacterVisualState) => void;
};

export const createCharacterLoader = ({
  loader,
  avatar,
  lookPivot,
  avatarBody,
  avatarGlow,
  miniCamera,
  hideLocalHead,
  hideLocalBody,
  headLayer,
  bodyLayer,
  isMounted,
}: CreateCharacterLoaderArgs) => {
  const disposeAvatarModel = (model: THREE.Object3D) => {
    model.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose?.();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    });
  };

  const loadCharacterVisual = ({
    path,
    groundY,
    hideLocalHead: hideLocalHeadOverride,
    hideLocalBody: hideLocalBodyOverride,
    previousModel,
    onLoaded,
  }: LoadCharacterVisualArgs) => {
    const resolvedHideLocalHead = hideLocalHeadOverride ?? hideLocalHead;
    const resolvedHideLocalBody = hideLocalBodyOverride ?? hideLocalBody;
    loader.load(
      path,
      (gltf) => {
        if (!isMounted() || !gltf?.scene) return;
        if (previousModel) {
          lookPivot.remove(previousModel);
          disposeAvatarModel(previousModel);
        }

        const avatarModel = gltf.scene;
        avatarModel.userData[characterGltfAnimationClipsKey] = gltf.animations;
        avatarModel.scale.setScalar(1.15);
        avatarModel.position.set(0, 0, 0);
        applyCharacterModelVisibility(avatarModel, path);

        const arms: THREE.Object3D[] = [];
        let legLeft: THREE.Object3D | null = null;
        let legRight: THREE.Object3D | null = null;
        let headBone: THREE.Object3D | null = null;
        let headBoneRest: THREE.Quaternion | null = null;
        const meshes: THREE.Mesh[] = [];
        const skinnedMeshes: THREE.SkinnedMesh[] = [];
        let foundHeadMesh = false;

        avatarModel.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            meshes.push(mesh);
            if (!mesh.visible) {
              return;
            }
            if (isHeadRelated(mesh)) {
              foundHeadMesh = true;
            }
            if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
              skinnedMeshes.push(mesh as THREE.SkinnedMesh);
            }
          }
          if (
            child.name &&
            !mesh.isMesh &&
            isArmControlNodeName(child.name) &&
            !shouldHideCharacterNode(path, child.name)
          ) {
            arms.push(child);
          }
          if (child.name === "legLeft") legLeft = child;
          if (child.name === "legRight") legRight = child;
          if (!headBone && /head/i.test(child.name)) {
            headBone = child;
            headBoneRest = child.quaternion.clone();
          }
        });

        if (!headBone) {
          for (let i = 0; i < skinnedMeshes.length; i += 1) {
            const mesh = skinnedMeshes[i];
            const bones = mesh.skeleton?.bones || [];
            const bone = bones.find((item) => /head/i.test(item.name));
            if (!bone) continue;
            headBone = bone;
            headBoneRest = bone.quaternion.clone();
            break;
          }
        }

        if (!arms.length) {
          const seenArmIds = new Set<number>();
          for (let i = 0; i < skinnedMeshes.length; i += 1) {
            const bones = skinnedMeshes[i].skeleton?.bones ?? [];
            for (let boneIndex = 0; boneIndex < bones.length; boneIndex += 1) {
              const bone = bones[boneIndex];
              if (!isArmControlNodeName(bone.name) || seenArmIds.has(bone.id)) continue;
              seenArmIds.add(bone.id);
              arms.push(bone);
            }
          }
        }

        const visibleArms = filterCharacterArmControls(arms, path);
        const useHideBody =
          resolvedHideLocalBody || (resolvedHideLocalHead && !foundHeadMesh);
        if (useHideBody) {
          miniCamera.layers.enable(bodyLayer);
        }

        meshes.forEach((mesh) => {
          if (!mesh.visible) return;
          mesh.castShadow = true;
          if (useHideBody) {
            if (isArmRelated(mesh)) {
              mesh.layers.set(0);
            } else if (resolvedHideLocalHead && isHeadRelated(mesh)) {
              mesh.layers.set(headLayer);
            } else {
              mesh.layers.set(bodyLayer);
            }
          } else if (resolvedHideLocalHead && isHeadRelated(mesh)) {
            mesh.layers.set(headLayer);
          } else {
            mesh.layers.set(0);
          }
        });

        lookPivot.remove(avatarBody, avatarGlow);
        lookPivot.add(avatarModel);
        avatar.updateMatrixWorld(true);
        const modelBounds = createVisibleModelBounds(avatarModel);
        const modelFootOffset = avatar.position.y - modelBounds.min.y;
        const modelHeight = modelBounds.max.y - modelBounds.min.y;
        const eyeHeight = THREE.MathUtils.clamp(modelHeight * 0.85, 1.4, 2.1);
        avatar.position.y = groundY + modelFootOffset;

        onLoaded({
          avatarModel,
          arms: visibleArms,
          legLeft,
          legRight,
          headBone,
          headBoneRest,
          eyeHeight,
          modelFootOffset,
        });
      },
      undefined,
      () => {
        // Keep placeholder if model fails to load.
      }
    );
  };

  return {
    disposeAvatarModel,
    loadCharacterVisual,
  };
};
