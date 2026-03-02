import * as THREE from "three";

export type MadaGrabAnimationState = {
  revealProgress?: number;
  windupProgress?: number;
  strikeProgress?: number;
  recoverProgress?: number;
};

type BoundNode = {
  object: THREE.Object3D;
  restRotation: THREE.Euler;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const copyRotation = (rotation: THREE.Euler) =>
  new THREE.Euler(rotation.x, rotation.y, rotation.z, rotation.order);

const createBoundNode = (object: THREE.Object3D | null): BoundNode | null =>
  object
    ? {
        object,
        restRotation: copyRotation(object.rotation),
      }
    : null;

const applyRotationOffset = (
  boundNode: BoundNode | null,
  x = 0,
  y = 0,
  z = 0
) => {
  if (!boundNode) return;
  boundNode.object.rotation.set(
    boundNode.restRotation.x + x,
    boundNode.restRotation.y + y,
    boundNode.restRotation.z + z,
    boundNode.restRotation.order
  );
};

export const createMadaAnimationController = ({
  rig,
}: {
  rig: THREE.Group;
}) => {
  let bodyGroupNode: BoundNode | null = null;
  let feetGroupNode: BoundNode | null = null;
  let handGroupNode: BoundNode | null = null;
  let armLeftNode: BoundNode | null = null;
  let armRightNode: BoundNode | null = null;
  let headGroupNode: BoundNode | null = null;
  const headLocalTarget = new THREE.Vector3();
  const headDelta = new THREE.Vector3();

  const applyGrabAnimation = ({
    revealProgress = 0,
    windupProgress = 0,
    strikeProgress = 0,
    recoverProgress = 0,
  }: MadaGrabAnimationState = {}) => {
    const reveal = clamp(revealProgress, 0, 1);
    const windup = clamp(windupProgress, 0, 1);
    const strike = clamp(strikeProgress, 0, 1);
    const recover = clamp(recoverProgress, 0, 1);

    applyRotationOffset(
      bodyGroupNode,
      -0.1 * reveal - 0.34 * windup + 0.44 * strike - 0.1 * recover,
      0.08 * reveal + 0.3 * windup - 0.42 * strike + 0.12 * recover,
      0.04 * reveal + 0.24 * windup - 0.32 * strike + 0.08 * recover
    );
    applyRotationOffset(
      feetGroupNode,
      0.04 * windup - 0.08 * strike + 0.04 * recover,
      -0.06 * windup + 0.08 * strike,
      -0.04 * windup + 0.04 * strike
    );
    applyRotationOffset(
      handGroupNode,
      -0.16 * reveal - 1.08 * windup + 1.24 * strike - 0.16 * recover,
      0.04 * reveal + 0.18 * windup - 0.26 * strike,
      0.1 * reveal + 0.26 * windup - 0.34 * strike + 0.08 * recover
    );
    applyRotationOffset(
      armLeftNode,
      -0.08 * reveal - 0.22 * windup + 0.12 * strike - 0.08 * recover,
      -0.04 * reveal - 0.08 * windup + 0.04 * strike,
      0.14 * reveal + 0.18 * windup - 0.06 * strike
    );
    applyRotationOffset(
      armRightNode,
      -0.38 * reveal - 3.35 * windup + 3.02 * strike + 0.14 * recover,
      0.12 * reveal + 0.38 * windup - 0.36 * strike,
      0.22 * reveal + 1.98 * windup - 1.06 * strike - 0.14 * recover
    );
  };

  const resetPose = () => {
    applyGrabAnimation();
  };

  const applyHeadLook = (targetWorld: THREE.Vector3 | null) => {
    if (!headGroupNode) return;
    if (!targetWorld || !headGroupNode.object.parent) {
      applyRotationOffset(headGroupNode);
      return;
    }
    headLocalTarget.copy(targetWorld);
    headGroupNode.object.parent.worldToLocal(headLocalTarget);
    headDelta.copy(headLocalTarget).sub(headGroupNode.object.position);
    const horizontalDistance = Math.max(
      0.001,
      Math.hypot(headDelta.x, headDelta.z)
    );
    const yaw = clamp(Math.atan2(headDelta.x, headDelta.z), -0.7, 0.7);
    const pitch = clamp(
      -Math.atan2(headDelta.y, horizontalDistance),
      -0.45,
      0.35
    );
    applyRotationOffset(headGroupNode, pitch, yaw, 0);
  };

  const bindModel = (model: THREE.Object3D | null) => {
    bodyGroupNode = createBoundNode(model?.getObjectByName("bodyGroup") ?? null);
    feetGroupNode = createBoundNode(model?.getObjectByName("feetGroup") ?? null);
    handGroupNode = createBoundNode(model?.getObjectByName("handGroup") ?? null);
    armLeftNode = createBoundNode(model?.getObjectByName("armLeft") ?? null);
    armRightNode = createBoundNode(model?.getObjectByName("armRight") ?? null);
    headGroupNode = createBoundNode(model?.getObjectByName("headGroup") ?? null);
    resetPose();
    applyHeadLook(null);
  };

  const getRightClawWorldPosition = (target: THREE.Vector3) => {
    if (armRightNode) {
      return armRightNode.object.localToWorld(target.set(0, -1.08, 0));
    }
    if (handGroupNode) {
      return handGroupNode.object.localToWorld(target.set(0.5, -1.08, 0.18));
    }
    return rig.localToWorld(target.set(0.78, 3, 0.42));
  };

  bindModel(null);

  return {
    bindModel,
    applyGrabAnimation,
    resetPose,
    applyHeadLook,
    getRightClawWorldPosition,
  };
};
