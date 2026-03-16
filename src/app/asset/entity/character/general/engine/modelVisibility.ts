import * as THREE from "three";

const harperHiddenNodePattern = /^weapon(root)?$/i;

const isHarperPath = (characterPath?: string) =>
  Boolean(characterPath && /\/harper\//i.test(characterPath));

export const shouldHideCharacterNode = (
  characterPath: string | undefined,
  nodeName: string
) => isHarperPath(characterPath) && harperHiddenNodePattern.test(nodeName.trim());

export const applyCharacterModelVisibility = (
  avatarModel: THREE.Object3D,
  characterPath?: string
) => {
  avatarModel.traverse((node) => {
    if (!shouldHideCharacterNode(characterPath, node.name || "")) return;
    node.visible = false;
  });
};

export const filterCharacterArmControls = (
  arms: THREE.Object3D[],
  characterPath?: string
) => arms.filter((arm) => !shouldHideCharacterNode(characterPath, arm.name || ""));

export const createVisibleModelBounds = (root: THREE.Object3D) => {
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  let hasVisibleMesh = false;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    meshBounds.setFromObject(mesh);
    if (!hasVisibleMesh) {
      bounds.copy(meshBounds);
      hasVisibleMesh = true;
    } else {
      bounds.union(meshBounds);
    }
  });

  if (!hasVisibleMesh) {
    bounds.setFromObject(root);
  }

  return bounds;
};
