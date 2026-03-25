import * as THREE from "three";

type BoundNode = {
  object: THREE.Object3D;
  restRotation: THREE.Euler;
};

const CRAWL_CLIP_NAME_PATTERN = /crawl/i;
const LOOKUP_CLIP_NAME_PATTERN = /look[\s_.-]*up|lookup/i;
const RAGE_CLIP_NAME_PATTERN = /rage/i;
const SHOOT_CLIP_NAME_PATTERN = /shoot/i;
const SKILL1_NAME_PATTERN = /skill[\s_.-]*1|s1/i;
const SKILL2_NAME_PATTERN = /skill[\s_.-]*2|s2/i;
const SKILL3_NAME_PATTERN = /skill[\s_.-]*3|s3/i;
const SKILL4_NAME_PATTERN = /skill[\s_.-]*4|s4/i;
const SKILL5_NAME_PATTERN = /skill[\s_.-]*5|s5/i;
const SKILL1_BEFORE_TOKEN_PATTERN = /before/i;
const SKILL1_DURING_TOKEN_PATTERN = /during/i;
const SKILL1_AFTER_TOKEN_PATTERN = /after/i;
const SKILL2_BEFORE_TOKEN_PATTERN = /before/i;
const SKILL2_DURING_TOKEN_PATTERN = /during/i;
const SKILL2_AFTER_TOKEN_PATTERN = /after/i;
const SKILL3_BEFORE_TOKEN_PATTERN = /before/i;
const SKILL3_DURING_TOKEN_PATTERN = /during/i;
const SKILL3_AFTER_TOKEN_PATTERN = /after/i;
const SKILL4_BEFORE_TOKEN_PATTERN = /before/i;
const SKILL4_DURING_TOKEN_PATTERN = /during/i;
const SKILL4_AFTER_TOKEN_PATTERN = /after/i;
const SKILL5_BEFORE_TOKEN_PATTERN = /before/i;
const SKILL5_DURING_TOKEN_PATTERN = /during/i;
const SKILL5_AFTER_TOKEN_PATTERN = /after/i;
const REFERENCE_NAME_PATTERN = /reference|ref/i;
const TARGET_REFERENCE_NAME_PATTERN = /target|hit|impact|grab|attack/i;
const HAND_LEFT_NAME_PATTERN = /(^|[\s_.-])hand[\s_.-]*l($|[\s_.-])/i;
const HAND_RIGHT_NAME_PATTERN = /(^|[\s_.-])hand[\s_.-]*r($|[\s_.-])/i;

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

const resolveLookupClip = (clips: THREE.AnimationClip[]) =>
  clips.find((candidate) => LOOKUP_CLIP_NAME_PATTERN.test(candidate.name)) ??
  null;

const resolveRageClip = (clips: THREE.AnimationClip[]) =>
  clips.find((candidate) => RAGE_CLIP_NAME_PATTERN.test(candidate.name)) ??
  null;

const resolveShootClip = (clips: THREE.AnimationClip[]) =>
  clips.find((candidate) => SHOOT_CLIP_NAME_PATTERN.test(candidate.name)) ??
  null;

const resolveSkillClip = (
  clips: THREE.AnimationClip[],
  skillNamePattern: RegExp,
  tokenPattern: RegExp
) => {
  const targeted =
    clips.find(
      (candidate) =>
        skillNamePattern.test(candidate.name) &&
        tokenPattern.test(candidate.name)
    ) ?? null;
  if (targeted) return targeted;
  return clips.find((candidate) => tokenPattern.test(candidate.name)) ?? null;
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
  let handLeftNode: THREE.Object3D | null = null;
  let handRightNode: THREE.Object3D | null = null;
  let boundModel: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let crawlAction: THREE.AnimationAction | null = null;
  let lookupAction: THREE.AnimationAction | null = null;
  let rageAction: THREE.AnimationAction | null = null;
  let shootAction: THREE.AnimationAction | null = null;
  let skill1BeforeAction: THREE.AnimationAction | null = null;
  let skill1DuringAction: THREE.AnimationAction | null = null;
  let skill1AfterAction: THREE.AnimationAction | null = null;
  let skill2BeforeAction: THREE.AnimationAction | null = null;
  let skill2DuringAction: THREE.AnimationAction | null = null;
  let skill2AfterAction: THREE.AnimationAction | null = null;
  let skill3BeforeAction: THREE.AnimationAction | null = null;
  let skill3DuringAction: THREE.AnimationAction | null = null;
  let skill3AfterAction: THREE.AnimationAction | null = null;
  let skill4BeforeAction: THREE.AnimationAction | null = null;
  let skill4DuringAction: THREE.AnimationAction | null = null;
  let skill4AfterAction: THREE.AnimationAction | null = null;
  let skill5BeforeAction: THREE.AnimationAction | null = null;
  let skill5DuringAction: THREE.AnimationAction | null = null;
  let skill5AfterAction: THREE.AnimationAction | null = null;
  let crawlEnabled = false;
  let lookupEnabled = false;
  let rageEnabled = false;
  let shootEnabled = false;
  let skill1BeforeEnabled = false;
  let skill1DuringEnabled = false;
  let skill1AfterEnabled = false;
  let skill2BeforeEnabled = false;
  let skill2DuringEnabled = false;
  let skill2AfterEnabled = false;
  let skill3BeforeEnabled = false;
  let skill3DuringEnabled = false;
  let skill3AfterEnabled = false;
  let skill4BeforeEnabled = false;
  let skill4DuringEnabled = false;
  let skill4AfterEnabled = false;
  let skill5BeforeEnabled = false;
  let skill5DuringEnabled = false;
  let skill5AfterEnabled = false;
  let grabReferenceNode: THREE.Object3D | null = null;
  const headLocalTarget = new THREE.Vector3();
  const headDelta = new THREE.Vector3();
  const handLeftWorldPosition = new THREE.Vector3();
  const handLeftWorldForward = new THREE.Vector3();
  const handRightWorldPosition = new THREE.Vector3();
  const handRightWorldForward = new THREE.Vector3();

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

  const stopLookup = () => {
    if (!lookupAction) {
      lookupEnabled = false;
      return;
    }
    lookupAction.stop();
    lookupAction.enabled = false;
    lookupAction.time = 0;
    lookupEnabled = false;
  };

  const stopRage = () => {
    if (!rageAction) {
      rageEnabled = false;
      return;
    }
    rageAction.stop();
    rageAction.enabled = false;
    rageAction.time = 0;
    rageEnabled = false;
  };

  const stopShoot = () => {
    if (!shootAction) {
      shootEnabled = false;
      return;
    }
    shootAction.stop();
    shootAction.enabled = false;
    shootAction.time = 0;
    shootEnabled = false;
  };

  const stopSkill1Before = () => {
    if (!skill1BeforeAction) {
      skill1BeforeEnabled = false;
      return;
    }
    skill1BeforeAction.stop();
    skill1BeforeAction.enabled = false;
    skill1BeforeAction.time = 0;
    skill1BeforeEnabled = false;
  };

  const stopSkill1During = () => {
    if (!skill1DuringAction) {
      skill1DuringEnabled = false;
      return;
    }
    skill1DuringAction.stop();
    skill1DuringAction.enabled = false;
    skill1DuringAction.time = 0;
    skill1DuringEnabled = false;
  };

  const stopSkill1After = () => {
    if (!skill1AfterAction) {
      skill1AfterEnabled = false;
      return;
    }
    skill1AfterAction.stop();
    skill1AfterAction.enabled = false;
    skill1AfterAction.time = 0;
    skill1AfterEnabled = false;
  };

  const stopSkill1 = () => {
    stopSkill1Before();
    stopSkill1During();
    stopSkill1After();
  };

  const stopSkill2Before = () => {
    if (!skill2BeforeAction) {
      skill2BeforeEnabled = false;
      return;
    }
    skill2BeforeAction.stop();
    skill2BeforeAction.enabled = false;
    skill2BeforeAction.time = 0;
    skill2BeforeEnabled = false;
  };

  const stopSkill2During = () => {
    if (!skill2DuringAction) {
      skill2DuringEnabled = false;
      return;
    }
    skill2DuringAction.stop();
    skill2DuringAction.enabled = false;
    skill2DuringAction.time = 0;
    skill2DuringEnabled = false;
  };

  const stopSkill2After = () => {
    if (!skill2AfterAction) {
      skill2AfterEnabled = false;
      return;
    }
    skill2AfterAction.stop();
    skill2AfterAction.enabled = false;
    skill2AfterAction.time = 0;
    skill2AfterEnabled = false;
  };

  const stopSkill2 = () => {
    stopSkill2Before();
    stopSkill2During();
    stopSkill2After();
  };

  const stopSkill3Before = () => {
    if (!skill3BeforeAction) {
      skill3BeforeEnabled = false;
      return;
    }
    skill3BeforeAction.stop();
    skill3BeforeAction.enabled = false;
    skill3BeforeAction.time = 0;
    skill3BeforeEnabled = false;
  };

  const stopSkill3During = () => {
    if (!skill3DuringAction) {
      skill3DuringEnabled = false;
      return;
    }
    skill3DuringAction.stop();
    skill3DuringAction.enabled = false;
    skill3DuringAction.time = 0;
    skill3DuringEnabled = false;
  };

  const stopSkill3After = () => {
    if (!skill3AfterAction) {
      skill3AfterEnabled = false;
      return;
    }
    skill3AfterAction.stop();
    skill3AfterAction.enabled = false;
    skill3AfterAction.time = 0;
    skill3AfterEnabled = false;
  };

  const stopSkill3 = () => {
    stopSkill3Before();
    stopSkill3During();
    stopSkill3After();
  };

  const stopSkill4Before = () => {
    if (!skill4BeforeAction) {
      skill4BeforeEnabled = false;
      return;
    }
    skill4BeforeAction.stop();
    skill4BeforeAction.enabled = false;
    skill4BeforeAction.time = 0;
    skill4BeforeEnabled = false;
  };

  const stopSkill4During = () => {
    if (!skill4DuringAction) {
      skill4DuringEnabled = false;
      return;
    }
    skill4DuringAction.stop();
    skill4DuringAction.enabled = false;
    skill4DuringAction.time = 0;
    skill4DuringEnabled = false;
  };

  const stopSkill4After = () => {
    if (!skill4AfterAction) {
      skill4AfterEnabled = false;
      return;
    }
    skill4AfterAction.stop();
    skill4AfterAction.enabled = false;
    skill4AfterAction.time = 0;
    skill4AfterEnabled = false;
  };

  const stopSkill4 = () => {
    stopSkill4Before();
    stopSkill4During();
    stopSkill4After();
  };

  const stopSkill5Before = () => {
    if (!skill5BeforeAction) {
      skill5BeforeEnabled = false;
      return;
    }
    skill5BeforeAction.stop();
    skill5BeforeAction.enabled = false;
    skill5BeforeAction.time = 0;
    skill5BeforeEnabled = false;
  };

  const stopSkill5During = () => {
    if (!skill5DuringAction) {
      skill5DuringEnabled = false;
      return;
    }
    skill5DuringAction.stop();
    skill5DuringAction.enabled = false;
    skill5DuringAction.time = 0;
    skill5DuringEnabled = false;
  };

  const stopSkill5After = () => {
    if (!skill5AfterAction) {
      skill5AfterEnabled = false;
      return;
    }
    skill5AfterAction.stop();
    skill5AfterAction.enabled = false;
    skill5AfterAction.time = 0;
    skill5AfterEnabled = false;
  };

  const stopSkill5 = () => {
    stopSkill5Before();
    stopSkill5During();
    stopSkill5After();
  };

  const clearClipBindings = () => {
    stopCrawl();
    stopLookup();
    stopRage();
    stopShoot();
    stopSkill1();
    stopSkill2();
    stopSkill3();
    stopSkill4();
    stopSkill5();
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
    crawlAction = null;
    lookupAction = null;
    rageAction = null;
    shootAction = null;
    skill1BeforeAction = null;
    skill1DuringAction = null;
    skill1AfterAction = null;
    skill2BeforeAction = null;
    skill2DuringAction = null;
    skill2AfterAction = null;
    skill3BeforeAction = null;
    skill3DuringAction = null;
    skill3AfterAction = null;
    skill4BeforeAction = null;
    skill4DuringAction = null;
    skill4AfterAction = null;
    skill5BeforeAction = null;
    skill5DuringAction = null;
    skill5AfterAction = null;
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

  const resolveHandLeftNode = (model: THREE.Object3D | null) => {
    if (!model) return null;
    const directNode =
      model.getObjectByName("Hand.L") ??
      model.getObjectByName("hand.L") ??
      model.getObjectByName("hand_l");
    if (directNode) return directNode;

    let matchedNode: THREE.Object3D | null = null;
    model.traverse((node) => {
      if (matchedNode || !node.name) return;
      if (HAND_LEFT_NAME_PATTERN.test(node.name)) {
        matchedNode = node;
      }
    });
    return matchedNode;
  };

  const resolveHandRightNode = (model: THREE.Object3D | null) => {
    if (!model) return null;
    const directNode =
      model.getObjectByName("Hand.R") ??
      model.getObjectByName("hand.R") ??
      model.getObjectByName("hand_r");
    if (directNode) return directNode;

    let matchedNode: THREE.Object3D | null = null;
    model.traverse((node) => {
      if (matchedNode || !node.name) return;
      if (HAND_RIGHT_NAME_PATTERN.test(node.name)) {
        matchedNode = node;
      }
    });
    return matchedNode;
  };

  const resetPose = () => {
    applyRotationOffset(bodyGroupNode);
    applyRotationOffset(feetGroupNode);
    applyRotationOffset(handGroupNode);
    applyRotationOffset(armLeftNode);
    applyRotationOffset(armRightNode);
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
    handLeftNode = resolveHandLeftNode(model);
    handRightNode = resolveHandRightNode(model);
    resetPose();
    applyHeadLook(null);
  };

  const bindAnimations = (clips: THREE.AnimationClip[] | null | undefined) => {
    clearClipBindings();
    if (!boundModel || !clips?.length) return;
    const crawlClip = resolveCrawlClip(clips);
    const lookupClip = resolveLookupClip(clips);
    const rageClip = resolveRageClip(clips);
    const shootClip = resolveShootClip(clips);
    const skill1BeforeClip = resolveSkillClip(
      clips,
      SKILL1_NAME_PATTERN,
      SKILL1_BEFORE_TOKEN_PATTERN
    );
    const skill1DuringClip = resolveSkillClip(
      clips,
      SKILL1_NAME_PATTERN,
      SKILL1_DURING_TOKEN_PATTERN
    );
    const skill1AfterClip = resolveSkillClip(
      clips,
      SKILL1_NAME_PATTERN,
      SKILL1_AFTER_TOKEN_PATTERN
    );
    const skill2BeforeClip = resolveSkillClip(
      clips,
      SKILL2_NAME_PATTERN,
      SKILL2_BEFORE_TOKEN_PATTERN
    );
    const skill2DuringClip = resolveSkillClip(
      clips,
      SKILL2_NAME_PATTERN,
      SKILL2_DURING_TOKEN_PATTERN
    );
    const skill2AfterClip = resolveSkillClip(
      clips,
      SKILL2_NAME_PATTERN,
      SKILL2_AFTER_TOKEN_PATTERN
    );
    const skill3BeforeClip = resolveSkillClip(
      clips,
      SKILL3_NAME_PATTERN,
      SKILL3_BEFORE_TOKEN_PATTERN
    );
    const skill3DuringClip = resolveSkillClip(
      clips,
      SKILL3_NAME_PATTERN,
      SKILL3_DURING_TOKEN_PATTERN
    );
    const skill3AfterClip = resolveSkillClip(
      clips,
      SKILL3_NAME_PATTERN,
      SKILL3_AFTER_TOKEN_PATTERN
    );
    const skill4BeforeClip = resolveSkillClip(
      clips,
      SKILL4_NAME_PATTERN,
      SKILL4_BEFORE_TOKEN_PATTERN
    );
    const skill4DuringClip = resolveSkillClip(
      clips,
      SKILL4_NAME_PATTERN,
      SKILL4_DURING_TOKEN_PATTERN
    );
    const skill4AfterClip = resolveSkillClip(
      clips,
      SKILL4_NAME_PATTERN,
      SKILL4_AFTER_TOKEN_PATTERN
    );
    const skill5BeforeClip = resolveSkillClip(
      clips,
      SKILL5_NAME_PATTERN,
      SKILL5_BEFORE_TOKEN_PATTERN
    );
    const skill5DuringClip = resolveSkillClip(
      clips,
      SKILL5_NAME_PATTERN,
      SKILL5_DURING_TOKEN_PATTERN
    );
    const skill5AfterClip = resolveSkillClip(
      clips,
      SKILL5_NAME_PATTERN,
      SKILL5_AFTER_TOKEN_PATTERN
    );
    if (
      !crawlClip &&
      !lookupClip &&
      !rageClip &&
      !shootClip &&
      !skill1BeforeClip &&
      !skill1DuringClip &&
      !skill1AfterClip &&
      !skill2BeforeClip &&
      !skill2DuringClip &&
      !skill2AfterClip &&
      !skill3BeforeClip &&
      !skill3DuringClip &&
      !skill3AfterClip &&
      !skill4BeforeClip &&
      !skill4DuringClip &&
      !skill4AfterClip &&
      !skill5BeforeClip &&
      !skill5DuringClip &&
      !skill5AfterClip
    ) {
      return;
    }
    mixer = new THREE.AnimationMixer(boundModel);
    if (crawlClip) {
      crawlAction = mixer.clipAction(crawlClip);
      crawlAction.loop = THREE.LoopOnce;
      crawlAction.clampWhenFinished = true;
      crawlAction.repetitions = 1;
      crawlAction.enabled = false;
    }
    if (lookupClip) {
      lookupAction = mixer.clipAction(lookupClip);
      lookupAction.loop = THREE.LoopOnce;
      lookupAction.clampWhenFinished = true;
      lookupAction.repetitions = 1;
      lookupAction.enabled = false;
    }
    if (rageClip) {
      rageAction = mixer.clipAction(rageClip);
      rageAction.loop = THREE.LoopOnce;
      rageAction.clampWhenFinished = true;
      rageAction.repetitions = 1;
      rageAction.enabled = false;
    }
    if (shootClip) {
      shootAction = mixer.clipAction(shootClip);
      shootAction.loop = THREE.LoopOnce;
      shootAction.clampWhenFinished = true;
      shootAction.repetitions = 1;
      shootAction.enabled = false;
    }
    if (skill1BeforeClip) {
      skill1BeforeAction = mixer.clipAction(skill1BeforeClip);
      skill1BeforeAction.loop = THREE.LoopOnce;
      skill1BeforeAction.clampWhenFinished = true;
      skill1BeforeAction.repetitions = 1;
      skill1BeforeAction.enabled = false;
    }
    if (skill1DuringClip) {
      skill1DuringAction = mixer.clipAction(skill1DuringClip);
      skill1DuringAction.loop = THREE.LoopRepeat;
      skill1DuringAction.clampWhenFinished = false;
      skill1DuringAction.repetitions = Infinity;
      skill1DuringAction.enabled = false;
    }
    if (skill1AfterClip) {
      skill1AfterAction = mixer.clipAction(skill1AfterClip);
      skill1AfterAction.loop = THREE.LoopOnce;
      skill1AfterAction.clampWhenFinished = true;
      skill1AfterAction.repetitions = 1;
      skill1AfterAction.enabled = false;
    }
    if (skill2BeforeClip) {
      skill2BeforeAction = mixer.clipAction(skill2BeforeClip);
      skill2BeforeAction.loop = THREE.LoopOnce;
      skill2BeforeAction.clampWhenFinished = true;
      skill2BeforeAction.repetitions = 1;
      skill2BeforeAction.enabled = false;
    }
    if (skill2DuringClip) {
      skill2DuringAction = mixer.clipAction(skill2DuringClip);
      skill2DuringAction.loop = THREE.LoopRepeat;
      skill2DuringAction.clampWhenFinished = false;
      skill2DuringAction.repetitions = Infinity;
      skill2DuringAction.enabled = false;
    }
    if (skill2AfterClip) {
      skill2AfterAction = mixer.clipAction(skill2AfterClip);
      skill2AfterAction.loop = THREE.LoopOnce;
      skill2AfterAction.clampWhenFinished = true;
      skill2AfterAction.repetitions = 1;
      skill2AfterAction.enabled = false;
    }
    if (skill3BeforeClip) {
      skill3BeforeAction = mixer.clipAction(skill3BeforeClip);
      skill3BeforeAction.loop = THREE.LoopOnce;
      skill3BeforeAction.clampWhenFinished = true;
      skill3BeforeAction.repetitions = 1;
      skill3BeforeAction.enabled = false;
    }
    if (skill3DuringClip) {
      skill3DuringAction = mixer.clipAction(skill3DuringClip);
      skill3DuringAction.loop = THREE.LoopRepeat;
      skill3DuringAction.clampWhenFinished = false;
      skill3DuringAction.repetitions = Infinity;
      skill3DuringAction.enabled = false;
    }
    if (skill3AfterClip) {
      skill3AfterAction = mixer.clipAction(skill3AfterClip);
      skill3AfterAction.loop = THREE.LoopOnce;
      skill3AfterAction.clampWhenFinished = true;
      skill3AfterAction.repetitions = 1;
      skill3AfterAction.enabled = false;
    }
    if (skill4BeforeClip) {
      skill4BeforeAction = mixer.clipAction(skill4BeforeClip);
      skill4BeforeAction.loop = THREE.LoopOnce;
      skill4BeforeAction.clampWhenFinished = true;
      skill4BeforeAction.repetitions = 1;
      skill4BeforeAction.enabled = false;
    }
    if (skill4DuringClip) {
      skill4DuringAction = mixer.clipAction(skill4DuringClip);
      skill4DuringAction.loop = THREE.LoopRepeat;
      skill4DuringAction.clampWhenFinished = false;
      skill4DuringAction.repetitions = Infinity;
      skill4DuringAction.enabled = false;
    }
    if (skill4AfterClip) {
      skill4AfterAction = mixer.clipAction(skill4AfterClip);
      skill4AfterAction.loop = THREE.LoopOnce;
      skill4AfterAction.clampWhenFinished = true;
      skill4AfterAction.repetitions = 1;
      skill4AfterAction.enabled = false;
    }
    if (skill5BeforeClip) {
      skill5BeforeAction = mixer.clipAction(skill5BeforeClip);
      skill5BeforeAction.loop = THREE.LoopOnce;
      skill5BeforeAction.clampWhenFinished = true;
      skill5BeforeAction.repetitions = 1;
      skill5BeforeAction.enabled = false;
    }
    if (skill5DuringClip) {
      skill5DuringAction = mixer.clipAction(skill5DuringClip);
      skill5DuringAction.loop = THREE.LoopOnce;
      skill5DuringAction.clampWhenFinished = true;
      skill5DuringAction.repetitions = 1;
      skill5DuringAction.enabled = false;
    }
    if (skill5AfterClip) {
      skill5AfterAction = mixer.clipAction(skill5AfterClip);
      skill5AfterAction.loop = THREE.LoopOnce;
      skill5AfterAction.clampWhenFinished = true;
      skill5AfterAction.repetitions = 1;
      skill5AfterAction.enabled = false;
    }
  };

  /**
   * Force-restart the crawl animation from frame 0.
   * Returns the clip duration in seconds (0 if no clip is bound).
   */
  const triggerCrawl = (): number => {
    if (!crawlAction || !mixer) return 0;
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    crawlAction.stop();
    crawlAction.reset();
    crawlAction.enabled = true;
    crawlAction.setEffectiveWeight(1);
    crawlAction.setEffectiveTimeScale(1);
    crawlAction.play();
    crawlEnabled = true;
    return crawlAction.getClip().duration;
  };

  const triggerLookup = (): number => {
    if (!lookupAction || !mixer) return 0;
    if (crawlEnabled) {
      stopCrawl();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    lookupAction.stop();
    lookupAction.reset();
    lookupAction.enabled = true;
    lookupAction.setEffectiveWeight(1);
    lookupAction.setEffectiveTimeScale(1);
    lookupAction.play();
    lookupEnabled = true;
    return lookupAction.getClip().duration;
  };

  const triggerRage = (): number => {
    if (!rageAction || !mixer) return 0;
    if (crawlEnabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    stopRage();
    rageAction.stop();
    rageAction.reset();
    rageAction.enabled = true;
    rageAction.setEffectiveWeight(1);
    rageAction.setEffectiveTimeScale(1);
    rageAction.play();
    rageEnabled = true;
    return rageAction.getClip().duration;
  };

  const getCrawlDuration = (): number =>
    crawlAction?.getClip().duration ?? 0;

  const triggerShoot = (): number => {
    if (!shootAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    shootAction.stop();
    shootAction.reset();
    shootAction.enabled = true;
    shootAction.setEffectiveWeight(1);
    shootAction.setEffectiveTimeScale(1);
    shootAction.play();
    shootEnabled = true;
    return shootAction.getClip().duration;
  };

  const setCrawlEnabled = (enabled: boolean) => {
    if (!crawlAction || !mixer) {
      crawlEnabled = false;
      return;
    }

    if (enabled) {
      if (lookupEnabled || lookupAction?.enabled) {
        stopLookup();
      }
      if (shootEnabled || shootAction?.enabled) {
        stopShoot();
      }
      if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
        stopSkill1();
      }
      if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
        stopSkill2();
      }
      if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
        stopSkill3();
      }
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

  const triggerSkill1Before = (): number => {
    if (!skill1BeforeAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    stopSkill1();
    skill1BeforeAction.stop();
    skill1BeforeAction.reset();
    skill1BeforeAction.enabled = true;
    skill1BeforeAction.setEffectiveWeight(1);
    skill1BeforeAction.setEffectiveTimeScale(1);
    skill1BeforeAction.play();
    skill1BeforeEnabled = true;
    return skill1BeforeAction.getClip().duration;
  };

  const triggerSkill1During = (): number => {
    if (!skill1DuringAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    stopSkill1Before();
    stopSkill1After();
    skill1DuringAction.stop();
    skill1DuringAction.reset();
    skill1DuringAction.enabled = true;
    skill1DuringAction.setEffectiveWeight(1);
    skill1DuringAction.setEffectiveTimeScale(1);
    skill1DuringAction.play();
    skill1DuringEnabled = true;
    return skill1DuringAction.getClip().duration;
  };

  const triggerSkill1After = (): number => {
    if (!skill1AfterAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    stopSkill1Before();
    stopSkill1During();
    skill1AfterAction.stop();
    skill1AfterAction.reset();
    skill1AfterAction.enabled = true;
    skill1AfterAction.setEffectiveWeight(1);
    skill1AfterAction.setEffectiveTimeScale(1);
    skill1AfterAction.play();
    skill1AfterEnabled = true;
    return skill1AfterAction.getClip().duration;
  };

  const triggerSkill2Before = (): number => {
    if (!skill2BeforeAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    stopSkill2();
    skill2BeforeAction.stop();
    skill2BeforeAction.reset();
    skill2BeforeAction.enabled = true;
    skill2BeforeAction.setEffectiveWeight(1);
    skill2BeforeAction.setEffectiveTimeScale(1);
    skill2BeforeAction.play();
    skill2BeforeEnabled = true;
    return skill2BeforeAction.getClip().duration;
  };

  const triggerSkill2During = (): number => {
    if (!skill2DuringAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    stopSkill2Before();
    stopSkill2After();
    skill2DuringAction.stop();
    skill2DuringAction.reset();
    skill2DuringAction.enabled = true;
    skill2DuringAction.setEffectiveWeight(1);
    skill2DuringAction.setEffectiveTimeScale(1);
    skill2DuringAction.play();
    skill2DuringEnabled = true;
    return skill2DuringAction.getClip().duration;
  };

  const triggerSkill2After = (): number => {
    if (!skill2AfterAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    if (skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled) {
      stopSkill5();
    }
    stopSkill2Before();
    stopSkill2During();
    skill2AfterAction.stop();
    skill2AfterAction.reset();
    skill2AfterAction.enabled = true;
    skill2AfterAction.setEffectiveWeight(1);
    skill2AfterAction.setEffectiveTimeScale(1);
    skill2AfterAction.play();
    skill2AfterEnabled = true;
    return skill2AfterAction.getClip().duration;
  };

  const triggerSkill3Before = (): number => {
    if (!skill3BeforeAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    stopSkill3();
    skill3BeforeAction.stop();
    skill3BeforeAction.reset();
    skill3BeforeAction.enabled = true;
    skill3BeforeAction.setEffectiveWeight(1);
    skill3BeforeAction.setEffectiveTimeScale(1);
    skill3BeforeAction.play();
    skill3BeforeEnabled = true;
    return skill3BeforeAction.getClip().duration;
  };

  const triggerSkill3During = (): number => {
    if (!skill3DuringAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    stopSkill3Before();
    stopSkill3After();
    skill3DuringAction.stop();
    skill3DuringAction.reset();
    skill3DuringAction.enabled = true;
    skill3DuringAction.setEffectiveWeight(1);
    skill3DuringAction.setEffectiveTimeScale(1);
    skill3DuringAction.play();
    skill3DuringEnabled = true;
    return skill3DuringAction.getClip().duration;
  };

  const triggerSkill3After = (): number => {
    if (!skill3AfterAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    stopSkill3Before();
    stopSkill3During();
    skill3AfterAction.stop();
    skill3AfterAction.reset();
    skill3AfterAction.enabled = true;
    skill3AfterAction.setEffectiveWeight(1);
    skill3AfterAction.setEffectiveTimeScale(1);
    skill3AfterAction.play();
    skill3AfterEnabled = true;
    return skill3AfterAction.getClip().duration;
  };

  const triggerSkill4Before = (): number => {
    if (!skill4BeforeAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    stopSkill4();
    skill4BeforeAction.stop();
    skill4BeforeAction.reset();
    skill4BeforeAction.enabled = true;
    skill4BeforeAction.setEffectiveWeight(1);
    skill4BeforeAction.setEffectiveTimeScale(1);
    skill4BeforeAction.play();
    skill4BeforeEnabled = true;
    return skill4BeforeAction.getClip().duration;
  };

  const triggerSkill4During = (): number => {
    if (!skill4DuringAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    stopSkill4Before();
    stopSkill4After();
    skill4DuringAction.stop();
    skill4DuringAction.reset();
    skill4DuringAction.enabled = true;
    skill4DuringAction.setEffectiveWeight(1);
    skill4DuringAction.setEffectiveTimeScale(1);
    skill4DuringAction.play();
    skill4DuringEnabled = true;
    return skill4DuringAction.getClip().duration;
  };

  const triggerSkill4After = (): number => {
    if (!skill4AfterAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    stopSkill4Before();
    stopSkill4During();
    skill4AfterAction.stop();
    skill4AfterAction.reset();
    skill4AfterAction.enabled = true;
    skill4AfterAction.setEffectiveWeight(1);
    skill4AfterAction.setEffectiveTimeScale(1);
    skill4AfterAction.play();
    skill4AfterEnabled = true;
    return skill4AfterAction.getClip().duration;
  };

  const triggerSkill5Before = (): number => {
    if (!skill5BeforeAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    stopSkill5();
    skill5BeforeAction.stop();
    skill5BeforeAction.reset();
    skill5BeforeAction.enabled = true;
    skill5BeforeAction.setEffectiveWeight(1);
    skill5BeforeAction.setEffectiveTimeScale(1);
    skill5BeforeAction.play();
    skill5BeforeEnabled = true;
    return skill5BeforeAction.getClip().duration;
  };

  const triggerSkill5During = (): number => {
    if (!skill5DuringAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    stopSkill5Before();
    stopSkill5After();
    skill5DuringAction.stop();
    skill5DuringAction.reset();
    skill5DuringAction.enabled = true;
    skill5DuringAction.setEffectiveWeight(1);
    skill5DuringAction.setEffectiveTimeScale(1);
    skill5DuringAction.play();
    skill5DuringEnabled = true;
    return skill5DuringAction.getClip().duration;
  };

  const setSkill5BeforeTimeScale = (timeScale: number) => {
    if (!skill5BeforeAction) return;
    const resolved = Number.isFinite(timeScale)
      ? Math.max(0, timeScale)
      : 1;
    skill5BeforeAction.setEffectiveTimeScale(resolved);
  };

  const setSkill5DuringTimeScale = (timeScale: number) => {
    if (!skill5DuringAction) return;
    const resolved = Number.isFinite(timeScale)
      ? Math.max(0, timeScale)
      : 1;
    skill5DuringAction.setEffectiveTimeScale(resolved);
  };

  const triggerSkill5After = (): number => {
    if (!skill5AfterAction || !mixer) return 0;
    if (crawlEnabled || crawlAction?.enabled) {
      stopCrawl();
    }
    if (lookupEnabled || lookupAction?.enabled) {
      stopLookup();
    }
    if (shootEnabled || shootAction?.enabled) {
      stopShoot();
    }
    if (skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled) {
      stopSkill1();
    }
    if (skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled) {
      stopSkill2();
    }
    if (skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled) {
      stopSkill3();
    }
    if (skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled) {
      stopSkill4();
    }
    stopSkill5Before();
    stopSkill5During();
    skill5AfterAction.stop();
    skill5AfterAction.reset();
    skill5AfterAction.enabled = true;
    skill5AfterAction.setEffectiveWeight(1);
    skill5AfterAction.setEffectiveTimeScale(1);
    skill5AfterAction.play();
    skill5AfterEnabled = true;
    return skill5AfterAction.getClip().duration;
  };

  const update = (delta: number) => {
    if (
      !mixer ||
      (!crawlEnabled &&
        !lookupEnabled &&
        !rageEnabled &&
        !shootEnabled &&
        !skill1BeforeEnabled &&
        !skill1DuringEnabled &&
        !skill1AfterEnabled &&
        !skill2BeforeEnabled &&
        !skill2DuringEnabled &&
        !skill2AfterEnabled &&
        !skill3BeforeEnabled &&
        !skill3DuringEnabled &&
        !skill3AfterEnabled &&
        !skill4BeforeEnabled &&
        !skill4DuringEnabled &&
        !skill4AfterEnabled &&
        !skill5BeforeEnabled &&
        !skill5DuringEnabled &&
        !skill5AfterEnabled)
    ) {
      return;
    }
    if (!Number.isFinite(delta) || delta <= 0) return;
    mixer.update(delta);
    if (lookupEnabled && lookupAction) {
      const clipDuration = lookupAction.getClip().duration;
      if (
        clipDuration > 0 &&
        lookupAction.time >= clipDuration - 0.0001
      ) {
        stopLookup();
      }
    }
    if (rageEnabled && rageAction) {
      const clipDuration = rageAction.getClip().duration;
      if (
        clipDuration > 0 &&
        rageAction.time >= clipDuration - 0.0001
      ) {
        stopRage();
      }
    }
    if (shootEnabled && shootAction) {
      const clipDuration = shootAction.getClip().duration;
      if (
        clipDuration > 0 &&
        shootAction.time >= clipDuration - 0.0001
      ) {
        stopShoot();
      }
    }
    if (skill1BeforeEnabled && skill1BeforeAction) {
      const clipDuration = skill1BeforeAction.getClip().duration;
      if (
        clipDuration > 0 &&
        skill1BeforeAction.time >= clipDuration - 0.0001
      ) {
        stopSkill1Before();
      }
    }
    if (skill1AfterEnabled && skill1AfterAction) {
      const clipDuration = skill1AfterAction.getClip().duration;
      if (
        clipDuration > 0 &&
        skill1AfterAction.time >= clipDuration - 0.0001
      ) {
        stopSkill1After();
      }
    }
    if (skill2BeforeEnabled && skill2BeforeAction) {
      const clipDuration = skill2BeforeAction.getClip().duration;
      if (
        clipDuration > 0 &&
        skill2BeforeAction.time >= clipDuration - 0.0001
      ) {
        stopSkill2Before();
      }
    }
    if (skill2AfterEnabled && skill2AfterAction) {
      const clipDuration = skill2AfterAction.getClip().duration;
      if (
        clipDuration > 0 &&
        skill2AfterAction.time >= clipDuration - 0.0001
      ) {
        stopSkill2After();
      }
    }
    if (skill3BeforeEnabled && skill3BeforeAction) {
      const clipDuration = skill3BeforeAction.getClip().duration;
      if (
        clipDuration > 0 &&
        skill3BeforeAction.time >= clipDuration - 0.0001
      ) {
        stopSkill3Before();
      }
    }
    if (skill3AfterEnabled && skill3AfterAction) {
      const clipDuration = skill3AfterAction.getClip().duration;
      if (
        clipDuration > 0 &&
        skill3AfterAction.time >= clipDuration - 0.0001
      ) {
        stopSkill3After();
      }
    }
    if (skill4BeforeEnabled && skill4BeforeAction) {
      const clipDuration = skill4BeforeAction.getClip().duration;
      if (
        clipDuration > 0 &&
        skill4BeforeAction.time >= clipDuration - 0.0001
      ) {
        stopSkill4Before();
      }
    }
    if (skill4AfterEnabled && skill4AfterAction) {
      const clipDuration = skill4AfterAction.getClip().duration;
      if (
        clipDuration > 0 &&
        skill4AfterAction.time >= clipDuration - 0.0001
      ) {
        stopSkill4After();
      }
    }
    if (skill5AfterEnabled && skill5AfterAction) {
      const clipDuration = skill5AfterAction.getClip().duration;
      if (
        clipDuration > 0 &&
        skill5AfterAction.time >= clipDuration - 0.0001
      ) {
        stopSkill5After();
      }
    }
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

  const getBodyWorldPosition = (target: THREE.Vector3) => {
    if (!bodyGroupNode) return false;
    bodyGroupNode.object.getWorldPosition(target);
    return true;
  };

  const getHandLFrontWorldPosition = (
    target: THREE.Vector3,
    forwardOffset = 0.34
  ) => {
    if (!handLeftNode) return false;
    handLeftNode.getWorldPosition(handLeftWorldPosition);
    handLeftWorldForward
      .set(0, 0, 1)
      .transformDirection(handLeftNode.matrixWorld);
    if (handLeftWorldForward.lengthSq() <= 0.00001) return false;
    handLeftWorldForward.normalize();
    target.copy(handLeftWorldPosition).addScaledVector(handLeftWorldForward, forwardOffset);
    return true;
  };

  const getHandRFrontWorldPosition = (
    target: THREE.Vector3,
    forwardOffset = 0.34
  ) => {
    if (!handRightNode) return false;
    handRightNode.getWorldPosition(handRightWorldPosition);
    handRightWorldForward
      .set(0, 0, 1)
      .transformDirection(handRightNode.matrixWorld);
    if (handRightWorldForward.lengthSq() <= 0.00001) return false;
    handRightWorldForward.normalize();
    target
      .copy(handRightWorldPosition)
      .addScaledVector(handRightWorldForward, forwardOffset);
    return true;
  };

  bindModel(null);

  return {
    bindModel,
    bindAnimations,
    resetPose,
    applyHeadLook,
    triggerCrawl,
    getCrawlDuration,
    triggerLookup,
    isLookupPlaying: () => lookupEnabled,
    canPlayRage: () => Boolean(rageAction),
    triggerRage,
    isRagePlaying: () => rageEnabled,
    stopRage,
    triggerShoot,
    isShootPlaying: () => shootEnabled,
    stopShoot,
    canPlaySkill1: () =>
      Boolean(skill1BeforeAction && skill1DuringAction && skill1AfterAction),
    triggerSkill1Before,
    triggerSkill1During,
    triggerSkill1After,
    isSkill1Playing: () =>
      skill1BeforeEnabled || skill1DuringEnabled || skill1AfterEnabled,
    isSkill1AfterPlaying: () => skill1AfterEnabled,
    stopSkill1,
    canPlaySkill2: () =>
      Boolean(skill2BeforeAction && skill2DuringAction && skill2AfterAction),
    triggerSkill2Before,
    triggerSkill2During,
    triggerSkill2After,
    isSkill2Playing: () =>
      skill2BeforeEnabled || skill2DuringEnabled || skill2AfterEnabled,
    isSkill2AfterPlaying: () => skill2AfterEnabled,
    stopSkill2,
    canPlaySkill3: () =>
      Boolean(skill3BeforeAction && skill3DuringAction && skill3AfterAction),
    triggerSkill3Before,
    triggerSkill3During,
    triggerSkill3After,
    isSkill3Playing: () =>
      skill3BeforeEnabled || skill3DuringEnabled || skill3AfterEnabled,
    isSkill3AfterPlaying: () => skill3AfterEnabled,
    stopSkill3,
    canPlaySkill4: () =>
      Boolean(skill4BeforeAction && skill4DuringAction && skill4AfterAction),
    triggerSkill4Before,
    triggerSkill4During,
    triggerSkill4After,
    isSkill4Playing: () =>
      skill4BeforeEnabled || skill4DuringEnabled || skill4AfterEnabled,
    isSkill4AfterPlaying: () => skill4AfterEnabled,
    stopSkill4,
    canPlaySkill5: () =>
      Boolean(skill5BeforeAction && skill5DuringAction && skill5AfterAction),
    triggerSkill5Before,
    setSkill5BeforeTimeScale,
    triggerSkill5During,
    setSkill5DuringTimeScale,
    triggerSkill5After,
    isSkill5Playing: () =>
      skill5BeforeEnabled || skill5DuringEnabled || skill5AfterEnabled,
    isSkill5AfterPlaying: () => skill5AfterEnabled,
    stopSkill5,
    stopTransientAnimations: () => {
      stopCrawl();
      stopLookup();
      stopRage();
      stopShoot();
      stopSkill1();
      stopSkill2();
      stopSkill3();
      stopSkill4();
      stopSkill5();
    },
    setCrawlEnabled,
    update,
    getRightClawWorldPosition,
    getBodyWorldPosition,
    getGrabReferenceWorldPosition,
    getHandLFrontWorldPosition,
    getHandRFrontWorldPosition,
  };
};


