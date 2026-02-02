import * as THREE from "three";
import type {
  CharacterFacing,
  CharacterProfile,
  CharacterRuntime,
  CharacterRuntimeUpdate,
} from "./types";

export const createCharacterRuntime = ({
  avatar,
  profile,
}: {
  avatar: THREE.Object3D;
  profile: CharacterProfile;
}): CharacterRuntime => {
  let currentProfile = profile;
  let isSlashing = false;
  let slashStart = 0;
  let slashFacingYaw = 0;
  let slashFacingPitch = 0;

  const defaultSlashConfig = {
    color: 0xffffff,
    duration: 360,
    shape: "fan",
    radius: 1.1,
    segments: 36,
    thetaStart: -Math.PI / 4,
    thetaLength: Math.PI / 2,
    width: 0.5,
    length: 2.2,
    size: 0.35,
    travel: 1.6,
    rollTurns: 1.5,
    height: 1.15,
    forward: 0.9,
    expandFrom: 0.7,
    expandTo: 1.3,
    opacity: 0.85,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };

  const resolveSlashConfig = (profileValue) => ({
    ...defaultSlashConfig,
    ...(profileValue?.slash?.effect ?? {}),
  });

  let slashConfig = resolveSlashConfig(currentProfile);
  let slashDuration = slashConfig.duration;
  let slashAnchorTarget: THREE.Object3D | null = null;
  let lastAvatarModel: THREE.Object3D | null = null;
  let slashOriginOverride: THREE.Vector3 | null = null;
  let lockFacing = true;
  const scratchVec3 = new THREE.Vector3();
  const scratchVec3Aim = new THREE.Vector3();
  const scratchVec3Origin = new THREE.Vector3();
  const baseForward = new THREE.Vector3(0, 0, 1);
  const basePlaneForward = new THREE.Vector3(0, -1, 0);

  const getSlashHeight = () => (slashOriginOverride ? 0 : slashConfig.height);
  const getSlashForward = () => slashConfig.forward;

  const findSlashAnchorTarget = (model: THREE.Object3D) => {
    const ignorePattern = /head|neck|arm|hand|leg|foot|eye|weapon|gun|sword|blade/i;
    let best: { node: THREE.Object3D; score: number } | null = null;
    model.traverse((child: THREE.Object3D) => {
      if (!child.name) return;
      const name = child.name.toLowerCase();
      if (ignorePattern.test(name)) return;
      let score = 0;
      if (name.includes("chest")) score = 5;
      else if (name.includes("spine")) score = 4;
      else if (name.includes("torso")) score = 4;
      else if (name.includes("upper")) score = 2;
      else if (name.includes("body")) score = 1;
      if (score && (!best || score > best.score)) {
        best = { node: child, score };
      }
    });
    return best?.node ?? null;
  };

  const buildSlashGeometry = (config) => {
    if (config.shape === "rect") {
      return new THREE.PlaneGeometry(config.width, config.length);
    }
    if (config.shape === "cube") {
      return new THREE.BoxGeometry(config.size, config.size, config.size);
    }
    return new THREE.CircleGeometry(
      config.radius,
      config.segments,
      config.thetaStart,
      config.thetaLength
    );
  };

  const slashMaterial = new THREE.MeshBasicMaterial({
    color: currentProfile?.slash?.color ?? defaultSlashConfig.color,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const slashAnchor = new THREE.Object3D();
  avatar.add(slashAnchor);

  const slashMesh = new THREE.Mesh(buildSlashGeometry(slashConfig), slashMaterial);
  slashMesh.visible = false;
  const applySlashBaseTransform = () => {
    slashMesh.position.set(0, getSlashHeight(), getSlashForward());
    slashMesh.rotation.set(
      slashConfig.rotationX,
      slashConfig.rotationY,
      slashConfig.rotationZ
    );
  };
  applySlashBaseTransform();
  slashAnchor.add(slashMesh);

  const updateSlashAnchorPosition = () => {
    if (slashOriginOverride) {
      slashAnchor.position.copy(slashOriginOverride);
      return;
    }
    if (!slashAnchorTarget) {
      slashAnchor.position.set(0, 0, 0);
      return;
    }
    avatar.updateMatrixWorld(true);
    slashAnchor.position.copy(
      avatar.worldToLocal(slashAnchorTarget.getWorldPosition(scratchVec3))
    );
  };

  const setProfile = (nextProfile) => {
    currentProfile = nextProfile;
    slashConfig = resolveSlashConfig(currentProfile);
    slashDuration = slashConfig.duration;
    slashMaterial.color.set(currentProfile?.slash?.color ?? defaultSlashConfig.color);
    slashMesh.geometry.dispose();
    slashMesh.geometry = buildSlashGeometry(slashConfig);
    applySlashBaseTransform();
  };

  const resolveSlashFacing = (facing: CharacterFacing) => {
    if (!facing?.aimWorld) {
      return { yaw: facing.yaw, pitch: facing.pitch };
    }
    if (facing.aimOriginWorld) {
      const direction = scratchVec3Aim
        .copy(facing.aimWorld)
        .sub(facing.aimOriginWorld);
      if (direction.lengthSq() < 0.000001) {
        return { yaw: facing.yaw, pitch: facing.pitch };
      }
      direction.normalize();
      return {
        yaw: Math.atan2(direction.x, direction.z),
        pitch: Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)),
      };
    }
    updateSlashAnchorPosition();
    avatar.updateMatrixWorld(true);
    slashMesh.updateMatrixWorld(true);
    const originWorld = slashMesh.getWorldPosition(scratchVec3Origin);
    const direction = scratchVec3Aim
      .copy(facing.aimWorld)
      .sub(originWorld);
    if (direction.lengthSq() < 0.000001) {
      return { yaw: facing.yaw, pitch: facing.pitch };
    }
    direction.normalize();
    return {
      yaw: Math.atan2(direction.x, direction.z),
      pitch: Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)),
    };
  };

  const triggerSlash = (facing: CharacterFacing) => {
    if (!currentProfile?.slash?.enabled) return;
    const resolvedFacing = resolveSlashFacing(facing);
    const useCameraAim = Boolean(facing.aimOriginWorld && facing.aimWorld);
    isSlashing = true;
    slashStart = performance.now();
    slashFacingYaw = resolvedFacing.yaw;
    slashFacingPitch = resolvedFacing.pitch;
    if (facing.aimOriginWorld) {
      avatar.updateMatrixWorld(true);
      const localOrigin = avatar.worldToLocal(
        scratchVec3Origin.copy(facing.aimOriginWorld)
      );
      if (slashOriginOverride) {
        slashOriginOverride.copy(localOrigin);
      } else {
        slashOriginOverride = localOrigin.clone();
      }
    } else {
      slashOriginOverride = null;
    }
    lockFacing = !useCameraAim;
  };

  const handleRightClick = (facing: CharacterFacing) => {
    const action =
      currentProfile?.controls?.rightClick ??
      (currentProfile?.slash?.enabled ? "slash" : null);
    if (action === "slash") {
      triggerSlash(facing);
    }
  };

  const isFacingLocked = () => isSlashing && lockFacing;

  const updateArmsAndLegs = ({ now, isMoving, arms, legLeft, legRight }) => {
    if (!arms.length || !legLeft || !legRight) return;
    const legSwing = isMoving ? Math.sin(now * 0.008 + Math.PI) * 0.5 : 0;
    if (isSlashing) {
      const rightArm =
        arms.find((arm) => /right/i.test(arm.name)) ?? arms[0];
      const leftArm =
        arms.find((arm) => /left/i.test(arm.name) && arm !== rightArm) ??
        arms.find((arm) => arm !== rightArm) ??
        rightArm;
      const progress = THREE.MathUtils.clamp(
        (now - slashStart) / slashDuration,
        0,
        1
      );
      const punch = Math.sin(progress * Math.PI);
      const rightTargetX = -0.2 - 1.0 * punch;
      const leftTargetX = -0.1 + 0.25 * punch;
      const damp = 0.35;
      rightArm.rotation.x = THREE.MathUtils.lerp(
        rightArm.rotation.x,
        rightTargetX,
        damp
      );
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, damp);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0, damp);
      if (leftArm && leftArm !== rightArm) {
        leftArm.rotation.x = THREE.MathUtils.lerp(
          leftArm.rotation.x,
          leftTargetX,
          damp
        );
        leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, damp);
        leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, 0, damp);
      }
    } else if (currentProfile?.animateArms) {
      currentProfile.animateArms({ arms, isMoving, now, THREE });
    } else {
      const armCount = arms.length;
      for (let i = 0; i < armCount; i += 1) {
        const arm = arms[i];
        const phase = (i / armCount) * Math.PI * 2;
        const armSwing = isMoving ? Math.sin(now * 0.008 + phase) * 1 : 0;
        arm.rotation.x = armSwing - 0.08;
      }
    }
    legLeft.rotation.x = legSwing;
    legRight.rotation.x = -legSwing;
  };

  const updateEffects = ({ now }) => {
    if (isSlashing && currentProfile?.slash?.enabled) {
      const elapsed = now - slashStart;
      const progress = THREE.MathUtils.clamp(elapsed / slashDuration, 0, 1);
      const useCameraAim = Boolean(slashOriginOverride);
      if (!useCameraAim) {
        avatar.rotation.y = slashFacingYaw;
      }
      const slashHeight = getSlashHeight();
      const slashForward = getSlashForward();
      const relativeYaw = useCameraAim
        ? THREE.MathUtils.euclideanModulo(
            slashFacingYaw - avatar.rotation.y + Math.PI,
            Math.PI * 2
          ) - Math.PI
        : 0;
      const dirX = Math.sin(relativeYaw) * Math.cos(slashFacingPitch);
      const dirY = Math.sin(slashFacingPitch);
      const dirZ = Math.cos(relativeYaw) * Math.cos(slashFacingPitch);
      const aimDir = scratchVec3Aim.set(dirX, dirY, dirZ);
      if (aimDir.lengthSq() > 0.000001) {
        aimDir.normalize();
      }
      slashMesh.visible = true;
      slashMaterial.opacity = slashConfig.opacity * (1 - progress);
      if (slashConfig.shape === "cube") {
        const travel = slashConfig.travel;
        const roll = (slashConfig.rollTurns || 1) * Math.PI * 2 * progress;
        const distance = slashForward + travel * progress;
        slashMesh.position.set(
          dirX * distance,
          slashHeight + dirY * distance,
          dirZ * distance
        );
        if (useCameraAim) {
          const forwardAxis =
            slashConfig.shape === "cube" ? baseForward : basePlaneForward;
          slashMesh.quaternion.setFromUnitVectors(forwardAxis, aimDir);
          if (roll) {
            slashMesh.rotateZ(roll);
          }
          if (slashConfig.rotationZ) {
            slashMesh.rotateZ(slashConfig.rotationZ);
          }
        } else {
          slashMesh.rotation.set(
            slashConfig.rotationX + slashFacingPitch + roll,
            slashConfig.rotationY + relativeYaw,
            slashConfig.rotationZ
          );
        }
      } else {
        const scale =
          slashConfig.expandFrom +
          (slashConfig.expandTo - slashConfig.expandFrom) * progress;
        const distance = slashForward;
        slashMesh.scale.set(scale, scale, scale);
        if (useCameraAim) {
          const forwardAxis =
            slashConfig.shape === "cube" ? baseForward : basePlaneForward;
          slashMesh.quaternion.setFromUnitVectors(forwardAxis, aimDir);
          if (slashConfig.rotationZ) {
            slashMesh.rotateZ(slashConfig.rotationZ);
          }
        } else {
          slashMesh.rotation.set(
            slashConfig.rotationX + slashFacingPitch,
            slashConfig.rotationY + relativeYaw,
            slashConfig.rotationZ
          );
        }
        slashMesh.position.set(
          dirX * distance,
          slashHeight + dirY * distance,
          dirZ * distance
        );
      }
      if (progress >= 1) {
        isSlashing = false;
        slashOriginOverride = null;
      }
    } else if (slashMesh.visible) {
      slashMesh.visible = false;
      slashMaterial.opacity = 0;
      slashOriginOverride = null;
    }
  };

  const update = ({
    now,
    isMoving,
    arms,
    legLeft,
    legRight,
    avatarModel,
  }: CharacterRuntimeUpdate) => {
    if (avatarModel && avatarModel !== lastAvatarModel) {
      slashAnchorTarget = findSlashAnchorTarget(avatarModel);
      lastAvatarModel = avatarModel;
    } else if (!avatarModel && lastAvatarModel) {
      slashAnchorTarget = null;
      lastAvatarModel = null;
    }
    updateArmsAndLegs({ now, isMoving, arms, legLeft, legRight });
    if (avatarModel && currentProfile?.animateModel) {
      currentProfile.animateModel({ avatarModel, isMoving, now, THREE });
    }
    updateSlashAnchorPosition();
    updateEffects({ now });
  };

  const dispose = () => {
    slashAnchor.parent?.remove(slashAnchor);
    slashMesh.geometry.dispose();
    slashMaterial.dispose();
  };

  return {
    setProfile,
    triggerSlash,
    handleRightClick,
    update,
    dispose,
    isFacingLocked,
  };
};
