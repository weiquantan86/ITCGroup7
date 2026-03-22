const directGlbMonsterIds = new Set(["mada"]);

export const isDirectGlbMonster = (monsterId: string) =>
  directGlbMonsterIds.has(monsterId);

