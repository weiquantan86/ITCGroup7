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

const CRAWL_CLIP_NAME_PATTERN = /crawl/i;
const REFERENCE_NAME_PATTERN = /reference|ref/i;
const TARGET_REFERENCE_NAME_PATTERN = /target|hit|impact|grab|attack/i;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const copyRotation = (rotation: THREE.Euler) =>
  new THREE.Euler(rotation.x, rotation.y, rotation.z, rotation.order);

const resolveCrawlClip = (clips: THREE.AnimationClip[]) => {
  const named = clips.find((candidate) =>
    CRAWL_CLIP_NAME_PATTERN.test(candidate.name)
  );
  if (named) return named;
  if (!clips.length) return null;
  let fallback = clips[0];
  for (let i = 1; i < clips.length; i += 1) {
    if (clips[i].duration > fallback.duration) {
      fallback = clips[i];
    }
  }
  return fallback;
};

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
  let boundModel: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let crawlAction: THREE.AnimationAction | null = null;
  let crawlEnabled = false;
  let grabReferenceNode: THREE.Object3D | null = null;
  const headLocalTarget = new THREE.Vector3();
  const headDelta = new THREE.Vector3();

  const stopCrawl = () => {
    if (!crawlAction) {
      crawlEnabled = false;
      return;
    }
    crawlAction.stop();
    crawlAction.enabled = false;
    crawlAction.time = 0;
    crawlEnabled = false;
  };

  const clearClipBindings = () => {
    stopCrawl();
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
    crawlAction = null;
  };

  const resolveGrabReferenceNode = (model: THREE.Object3D | null) => {
    if (!model) return null;

    const candidates: THREE.Object3D[] = [];
    model.traverse((node) => {
      if (!node.name || !REFERENCE_NAME_PATTERN.test(node.name)) return;
      candidates.push(node);
    });
    if (!candidates.length) return null;

    const targetedCandidate =
      candidates.find((node) => TARGET_REFERENCE_NAME_PATTERN.test(node.name)) ??
      null;
    return targetedCandidate ?? candidates[0];
  };

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
    boundModel = model;
    clearClipBindings();
    grabReferenceNode = resolveGrabReferenceNode(model);
    resetPose();
    applyHeadLook(null);
  };

  const bindAnimations = (clips: THREE.AnimationClip[] | null | undefined) => {
    clearClipBindings();
    if (!boundModel || !clips?.length) return;
    const clip = resolveCrawlClip(clips);
    if (!clip) return;
    mixer = new THREE.AnimationMixer(boundModel);
    crawlAction = mixer.clipAction(clip);
    crawlAction.loop = THREE.LoopOnce;
    crawlAction.clampWhenFinished = true;
    crawlAction.repetitions = 1;
    crawlAction.enabled = false;
  };

  const setCrawlEnabled = (enabled: boolean) => {
    if (!crawlAction || !mixer) {
      crawlEnabled = false;
      return;
    }

    if (enabled) {
      if (!crawlEnabled) {
        crawlAction.reset();
        crawlAction.enabled = true;
        crawlAction.setEffectiveWeight(1);
        crawlAction.setEffectiveTimeScale(1);
        crawlAction.play();
      }
      crawlEnabled = true;
      return;
    }

    if (crawlEnabled) {
      stopCrawl();
    }
  };

  const update = (delta: number) => {
    if (!mixer || !crawlEnabled) return;
    if (!Number.isFinite(delta) || delta <= 0) return;
    mixer.update(delta);
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

  const getGrabReferenceWorldPosition = (target: THREE.Vector3) => {
    if (!grabReferenceNode) return false;
    grabReferenceNode.getWorldPosition(target);
    return true;
  };

  bindModel(null);

  return {
    bindModel,
    bindAnimations,
    applyGrabAnimation,
    resetPose,
    applyHeadLook,
    setCrawlEnabled,
    update,
    getRightClawWorldPosition,
    getGrabReferenceWorldPosition,
  };
};
