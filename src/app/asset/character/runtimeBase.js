import * as THREE from "three";

export const createCharacterRuntime = ({ avatar, profile }) => {
  let currentProfile = profile;
  let isSlashing = false;
  let slashStart = 0;
  let slashFacing = 0;

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

  const slashMesh = new THREE.Mesh(buildSlashGeometry(slashConfig), slashMaterial);
  slashMesh.visible = false;
  slashMesh.position.set(0, slashConfig.height, slashConfig.forward);
  slashMesh.rotation.set(
    slashConfig.rotationX,
    slashConfig.rotationY,
    slashConfig.rotationZ
  );
  avatar.add(slashMesh);

  const setProfile = (nextProfile) => {
    currentProfile = nextProfile;
    slashConfig = resolveSlashConfig(currentProfile);
    slashDuration = slashConfig.duration;
    slashMaterial.color.set(currentProfile?.slash?.color ?? defaultSlashConfig.color);
    slashMesh.geometry.dispose();
    slashMesh.geometry = buildSlashGeometry(slashConfig);
    slashMesh.position.set(0, slashConfig.height, slashConfig.forward);
    slashMesh.rotation.set(
      slashConfig.rotationX,
      slashConfig.rotationY,
      slashConfig.rotationZ
    );
  };

  const triggerSlash = (facing) => {
    if (!currentProfile?.slash?.enabled) return;
    isSlashing = true;
    slashStart = performance.now();
    slashFacing = facing;
  };

  const handleRightClick = (facing) => {
    const action =
      currentProfile?.controls?.rightClick ??
      (currentProfile?.slash?.enabled ? "slash" : null);
    if (action === "slash") {
      triggerSlash(facing);
    }
  };

  const isFacingLocked = () => isSlashing;

  const updateArmsAndLegs = ({ now, isMoving, arms, legLeft, legRight }) => {
    if (!arms.length || !legLeft || !legRight) return;
    const legSwing = isMoving ? Math.sin(now * 0.008 + Math.PI) * 0.5 : 0;
    if (isSlashing && currentProfile?.slash?.freezeArms) {
      arms.forEach((arm) => {
        arm.rotation.x = -0.08;
        arm.rotation.y = 0;
        arm.rotation.z = 0;
      });
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
      avatar.rotation.y = slashFacing;
      slashMesh.visible = true;
      slashMaterial.opacity = slashConfig.opacity * (1 - progress);
      if (slashConfig.shape === "cube") {
        const travel = slashConfig.travel;
        const roll = (slashConfig.rollTurns || 1) * Math.PI * 2 * progress;
        slashMesh.position.set(
          0,
          slashConfig.height,
          slashConfig.forward + travel * progress
        );
        slashMesh.rotation.set(
          slashConfig.rotationX + roll,
          slashConfig.rotationY,
          slashConfig.rotationZ
        );
      } else {
        const scale =
          slashConfig.expandFrom +
          (slashConfig.expandTo - slashConfig.expandFrom) * progress;
        slashMesh.scale.set(scale, scale, scale);
        slashMesh.rotation.set(
          slashConfig.rotationX,
          slashConfig.rotationY,
          slashConfig.rotationZ
        );
        slashMesh.position.set(0, slashConfig.height, slashConfig.forward);
      }
      if (progress >= 1) {
        isSlashing = false;
      }
    } else if (slashMesh.visible) {
      slashMesh.visible = false;
      slashMaterial.opacity = 0;
    }
  };

  const update = ({ now, isMoving, arms, legLeft, legRight, avatarModel }) => {
    updateArmsAndLegs({ now, isMoving, arms, legLeft, legRight });
    if (avatarModel && currentProfile?.animateModel) {
      currentProfile.animateModel({ avatarModel, isMoving, now, THREE });
    }
    updateEffects({ now });
  };

  const dispose = () => {
    avatar.remove(slashMesh);
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
