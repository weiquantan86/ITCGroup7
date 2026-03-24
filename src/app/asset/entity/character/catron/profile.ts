import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "catron",
  label: "Catron",
  pathToken: "/catron/",
  rarity: "common",
  starter: false,
  energy: {
    passivePerSecond: 0,
    movingPerSecond: 0,
  },
  camera: {
    miniBehindDistance: 5.8,
    miniUpDistance: 2.05,
    miniLookUpOffset: 0.32,
  },
  kit: {
    basicAttack: {
      id: "basic",
      label: "Basic",
      description:
        "Normal form: hold to charge a long-range phantom punch with charge-scaled damage and resource gain on hit. Demon form: Basic switches to demon shells with explosion and shockwave damage.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        description:
          "Consume all EN to enter Demon Lord form. During demon form Catron scales up, takes reduced damage, and upgrades Basic/E/R. Demon form ends with recovery and returns to normal.",
        cost: "all",
        cooldownMs: 30000,
      },
      e: {
        id: "e",
        label: "E",
        description:
          "Normal form: enter shallow phantom; if hit, auto-transition to deep phantom (full damage immunity). Recast during deep phantom to launch a 5-orb volley. In demon form, E triggers the demon volley variant directly.",
        cost: 20,
        cooldownMs: 7000,
      },
      r: {
        id: "r",
        label: "R",
        description:
          "Cast tornado attack. Normal cast fires one exploding tornado. In deep phantom or demon form, R fires 3 larger lane-split swaying tornadoes.",
        cost: 30,
        cooldownMs: 12000,
      },
    },
  },
  slash: {
    enabled: true,
    color: 0x6d28d9,
    effect: {
      shape: "cube",
      size: 0.45,
      travel: 1.8,
      rollTurns: 1.75,
      height: 0.95,
      forward: 0.6,
      opacity: 0.9,
      duration: 520,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
    },
  },
  animateModel: ({ avatarModel, isMoving, now, THREE }) => {
    const swayTarget = isMoving ? Math.sin(now * 0.006) * 0.12 : 0;
    avatarModel.rotation.z = THREE.MathUtils.lerp(
      avatarModel.rotation.z,
      swayTarget,
      0.1
    );
  },
};
