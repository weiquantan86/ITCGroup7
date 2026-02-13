import * as THREE from "three";
import type { PlayerLookState } from "./input";

type CreatePlayerCameraRigArgs = {
  mount: HTMLElement;
  hideLocalHead: boolean;
  hideLocalBody: boolean;
  showMiniMap: boolean;
};

type UpdatePlayerCameraRigArgs = {
  avatar: THREE.Object3D;
  eyeHeight: number;
  lookState: PlayerLookState;
  followHeadBone: boolean;
  miniBehindDistance: number;
  miniUpDistance: number;
  miniLookUpOffset: number;
  headBone: THREE.Object3D | null;
};

export const createPlayerCameraRig = ({
  mount,
  hideLocalHead,
  hideLocalBody,
  showMiniMap,
}: CreatePlayerCameraRigArgs) => {
  const camera = new THREE.PerspectiveCamera(
    70,
    mount.clientWidth / mount.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 4.5, 10);

  const miniCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
  miniCamera.position.set(0, 6, 6);
  if (hideLocalHead) {
    miniCamera.layers.enable(1);
  }
  if (hideLocalBody) {
    miniCamera.layers.enable(2);
  }

  const miniViewport = { size: 0, margin: 14 };
  const cameraTarget = new THREE.Vector3();
  const cameraLookDir = new THREE.Vector3();
  const cameraLookAt = new THREE.Vector3();
  const headWorldTarget = new THREE.Vector3();
  const miniTarget = new THREE.Vector3();
  const miniOffset = new THREE.Vector3();

  const updateMiniViewport = (width: number, height: number) => {
    if (!showMiniMap) {
      miniViewport.size = 0;
      return;
    }
    const minEdge = Math.min(width, height);
    miniViewport.size = Math.max(120, Math.floor(minEdge * 0.25));
    miniCamera.aspect = 16 / 9;
    miniCamera.updateProjectionMatrix();
  };

  const update = ({
    avatar,
    eyeHeight,
    lookState,
    followHeadBone,
    miniBehindDistance,
    miniUpDistance,
    miniLookUpOffset,
    headBone,
  }: UpdatePlayerCameraRigArgs) => {
    if (followHeadBone && headBone) {
      headBone.getWorldPosition(headWorldTarget);
      cameraTarget.copy(headWorldTarget);
    } else {
      cameraTarget.set(
        avatar.position.x,
        avatar.position.y + eyeHeight,
        avatar.position.z
      );
    }
    cameraLookDir.set(
      Math.sin(lookState.yaw) * Math.cos(lookState.pitch),
      Math.sin(lookState.pitch),
      Math.cos(lookState.yaw) * Math.cos(lookState.pitch)
    );
    camera.position.copy(cameraTarget).addScaledVector(cameraLookDir, 0.05);
    cameraLookAt.copy(cameraTarget).add(cameraLookDir);
    camera.lookAt(cameraLookAt);

    miniTarget.set(
      avatar.position.x,
      avatar.position.y + eyeHeight * 0.6 + miniLookUpOffset,
      avatar.position.z
    );
    const behindDistance = Math.max(1, miniBehindDistance);
    const upDistance = Math.max(0.2, miniUpDistance);
    miniOffset.set(
      -Math.sin(lookState.yaw) * behindDistance,
      upDistance,
      -Math.cos(lookState.yaw) * behindDistance
    );
    miniCamera.position.copy(miniTarget).add(miniOffset);
    miniCamera.lookAt(miniTarget);
    return cameraLookDir;
  };

  const render = (renderer: THREE.WebGLRenderer, scene: THREE.Scene) => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setViewport(0, 0, width, height);
    renderer.render(scene, camera);
    if (!showMiniMap) return;

    const miniSize = miniViewport.size;
    const miniWidth = Math.floor(miniSize * 1.6);
    const miniHeight = miniSize;
    const miniLeft = width - miniWidth - miniViewport.margin;
    const miniBottom = height - miniHeight - miniViewport.margin;
    renderer.setScissorTest(true);
    renderer.clearDepth();
    renderer.setViewport(miniLeft, miniBottom, miniWidth, miniHeight);
    renderer.setScissor(miniLeft, miniBottom, miniWidth, miniHeight);
    renderer.render(scene, miniCamera);
    renderer.setScissorTest(false);
  };

  const resize = (width: number, height: number) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateMiniViewport(width, height);
  };

  return {
    camera,
    miniCamera,
    update,
    render,
    resize,
    updateMiniViewport,
  };
};
