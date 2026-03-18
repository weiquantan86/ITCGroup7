export type CharacterManagementSkillInfo = {
  description: string;
  cooldownMs: number | null;
  manaCost: number | "all" | null;
};

export type CharacterManagementCharacter = {
  id: string;
  name: string;
  path: string;
  skills: Record<"n" | "e" | "r" | "q", CharacterManagementSkillInfo>;
};
