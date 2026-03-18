import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "adam",
  label: "Adam",
  pathToken: "/adam/",
  rarity: "common",
  starter: true,
  energy: {
    passivePerSecond: 0,
    movingPerSecond: 0,
    hitGain: 4,
    damageTakenRatio: 0,
  },
  mana: {
    passivePerSecond: 2,
  },
  kit: {
    basicAttack: {
      id: "basic",
      label: "Basic",
      description:
        "Hold to charge an orb (min 0.26s, max 2.4s), then release to fire. Charge level scales projectile speed and travel time. If E is active, the next charged shot becomes an empowered explosive orb and consumes E.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        description:
          "After a 2s charge-up, fire a 3-orb spread volley. Hitting the same target twice in one volley applies a 5s Arc debuff that deals periodic damage.",
        cost: 100,
        cooldownMs: 10000,
      },
      e: {
        id: "e",
        label: "E",
        description:
          "Enter empowerment for up to 5s. Your next charged Basic turns into a large explosive orb (split + explosion) and then E goes on cooldown.",
        cost: 20,
        cooldownMs: 5000,
      },
      r: {
        id: "r",
        label: "R",
        description:
          "Create a sphere around Adam for 3s. While active, Adam is locked in place, the sphere deals periodic contact damage and gains stacks from hits and projectile blocks. Press E to launch the sphere as a combo projectile, or press Basic to detonate it in place; explosion damage scales with stacks.",
        cost: 30,
        cooldownMs: 10000,
      },
    },
  },
  slash: {
    enabled: true,
    color: 0x8bc34a,
    freezeArms: true,
    effect: {
      radius: 1.5,
      segments: 36,
      thetaStart: (-3 * Math.PI) / 4,
      thetaLength: Math.PI / 2,
      height: 1.15,
      forward: 0.9,
      expandFrom: 0.7,
      expandTo: 1.3,
      opacity: 0.85,
      rotationX: -Math.PI / 2,
      rotationY: 0,
      rotationZ: 0,
    },
  },
};
