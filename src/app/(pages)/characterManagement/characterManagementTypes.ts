export type CharacterManagementCharacter = {
  id: string;
  name: string;
  path: string;
  skills: Record<"q" | "e" | "r", string>;
};
