import type { MonsterProfile } from "../general";

export const mochiSoldierProfile: MonsterProfile = {
  id: "mochiSoldier",
  label: "Mochi Soldier",
  stats: {
    health: 50,
    attack: 20,
    defense: 0,
    speed: 4.5,
    aggroRange: 150,
    attackRange: 1.8,
  },
};

export const mochiSoldierCombatConfig = {
  attackCooldownMs: 600,
};
