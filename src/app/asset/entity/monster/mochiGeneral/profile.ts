import type { MonsterProfile } from "../general";

export const mochiGeneralProfile: MonsterProfile = {
  id: "mochiGeneral",
  label: "Mochi General",
  pathToken: "/mochiGeneral/",
  stats: {
    health: 10000,
    attack: 30,
    defense: 4,
    speed: 2.8,
    aggroRange: 200,
    attackRange: 2.2,
  },
};
