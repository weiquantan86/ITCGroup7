import type { MonsterProfile } from "../general";

export const mochiSoldierProfile: MonsterProfile = {
  id: "mochiSoldier",
  label: "Mochi Soldier",
  pathToken: "/mochiSoldier/",
  stats: {
    health: 50,
    attack: 20,
    defense: 0,
    speed: 3,
    aggroRange: 60,
    attackRange: 1.8,
  },
};

export const mochiSoldierCombatConfig = {
  attackCooldownMs: 950,
};
