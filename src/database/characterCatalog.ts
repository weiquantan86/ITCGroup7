const ALL_CHARACTER_NAMES = [
  "Adam",
  "Baron",
  "Carrot",
  "Dakota",
  "Harper",
  "Flare",
] as const;

const STARTER_CHARACTER_NAMES = ["Adam", "Flare"] as const;

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};

export const ensureCharacterCatalog = async (db: Queryable) => {
  const placeholders = ALL_CHARACTER_NAMES.map(
    (_name, index) => `($${index + 1})`
  ).join(", ");

  await db.query(
    `
      INSERT INTO characters (name)
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING;
    `,
    [...ALL_CHARACTER_NAMES]
  );
};

export const assignCharactersToUser = async (
  db: Queryable,
  userId: number,
  characterNames: readonly string[]
) => {
  if (characterNames.length === 0) return;

  await db.query(
    `
      INSERT INTO user_characters (user_id, character_id)
      SELECT $1, c.id
      FROM characters c
      WHERE c.name = ANY($2::varchar[])
      ON CONFLICT DO NOTHING;
    `,
    [userId, [...characterNames]]
  );
};

export const assignStarterCharacters = async (db: Queryable, userId: number) =>
  assignCharactersToUser(db, userId, STARTER_CHARACTER_NAMES);

export { ALL_CHARACTER_NAMES, STARTER_CHARACTER_NAMES };
