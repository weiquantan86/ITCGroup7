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
        "Hold to charge (0.26s-2.4s), then release an orb. Charge scales speed (8-20), lifetime (0.9s-1.8s), and damage. If E is active, this shot is consumed into an empowered split orb whose direct hit damage and explosion damage each scale from 100 to 200 by charge.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        description:
          "After a 2s channel, fire 3 large orbs. If one target is hit twice in the same volley, apply Arc for 5s (periodic damage each second).",
        cost: 100,
        cooldownMs: 10000,
      },
      e: {
        id: "e",
        label: "E",
        description:
          "Arm the next charged Basic for up to 5s. The empowered shot consumes E and starts E cooldown; its direct hit damage and explosion damage each scale from 100 to 200 by charge.",
        cost: 20,
        cooldownMs: 5000,
      },
      r: {
        id: "r",
        label: "R",
        description:
          "Create a sphere for 3s (movement locked). The sphere deals periodic contact damage, blocks projectiles, and gains stacks from hits/blocks. Press E to launch it or Basic to detonate in place; explosion scales with stacks and high stacks add lingering area damage.",
        cost: 30,
        cooldownMs: 10000,
      },
    },
  },
  slash: {
    enabled: true,
    color: 0x22d3ee,
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
