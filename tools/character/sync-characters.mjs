import { access, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const charactersRoot = path.join(
  projectRoot,
  "src",
  "app",
  "asset",
  "entity",
  "character"
);
const registryPath = path.join(
  projectRoot,
  "src",
  "app",
  "asset",
  "entity",
  "character",
  "general",
  "player",
  "registry.ts"
);
const characterCatalogPath = path.join(
  projectRoot,
  "src",
  "database",
  "characterCatalog.ts"
);

const validRarities = new Set(["common", "rare", "epic", "legendary"]);

const toPascalCase = (value) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");

const escapeSingleQuote = (value) => value.replaceAll("'", "\\'");

const writeIfChanged = async (filePath, nextContent) => {
  let currentContent = "";
  try {
    currentContent = await readFile(filePath, "utf8");
  } catch {
    currentContent = "";
  }
  if (currentContent === nextContent) return false;
  await writeFile(filePath, nextContent, "utf8");
  return true;
};

const readRequiredFile = async (filePath) => {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    throw new Error(`Missing file: ${filePath}`);
  }
};

const matchTopLevelString = (source, fieldName, profilePath) => {
  const match = source.match(new RegExp(`^\\s{2}${fieldName}:\\s*"([^"]+)"`, "m"));
  if (!match) {
    throw new Error(`Missing top-level string field '${fieldName}' in ${profilePath}`);
  }
  return match[1].trim();
};

const matchTopLevelBoolean = (source, fieldName, profilePath) => {
  const match = source.match(new RegExp(`^\\s{2}${fieldName}:\\s*(true|false)`, "m"));
  if (!match) {
    throw new Error(`Missing top-level boolean field '${fieldName}' in ${profilePath}`);
  }
  return match[1] === "true";
};

const parseCharacterDefinition = async (directoryName) => {
  const characterDir = path.join(charactersRoot, directoryName);
  const profilePath = path.join(characterDir, "profile.ts");
  const runtimePath = path.join(characterDir, "runtime.ts");

  await access(profilePath).catch(() => {
    throw new Error(`Missing file for '${directoryName}': ${profilePath}`);
  });
  await access(runtimePath).catch(() => {
    throw new Error(`Missing file for '${directoryName}': ${runtimePath}`);
  });

  const profileSource = await readRequiredFile(profilePath);
  const id = matchTopLevelString(profileSource, "id", profilePath).toLowerCase();
  const label = matchTopLevelString(profileSource, "label", profilePath);
  const pathToken = matchTopLevelString(profileSource, "pathToken", profilePath);
  const rarity = matchTopLevelString(profileSource, "rarity", profilePath).toLowerCase();
  const starter = matchTopLevelBoolean(profileSource, "starter", profilePath);

  if (id !== directoryName) {
    throw new Error(
      `Profile id '${id}' in ${profilePath} must match directory '${directoryName}'.`
    );
  }
  if (!/^[a-z0-9_-]+$/.test(id)) {
    throw new Error(`Character id '${id}' must use [a-z0-9_-].`);
  }
  if (!label) {
    throw new Error(`Character label is required in ${profilePath}.`);
  }
  if (pathToken !== `/${id}/`) {
    throw new Error(
      `Character pathToken '${pathToken}' in ${profilePath} must equal '/${id}/'.`
    );
  }
  if (!validRarities.has(rarity)) {
    throw new Error(
      `Character rarity '${rarity}' in ${profilePath} must be one of ${Array.from(
        validRarities
      ).join(", ")}.`
    );
  }

  return { id, label, rarity, starter };
};

const readCharacterDefinitions = async () => {
  const entries = await readdir(charactersRoot, { withFileTypes: true });
  const characterDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "general")
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (!characterDirs.length) {
    throw new Error("No character directories found.");
  }

  const seenIds = new Set();
  const seenLabels = new Set();
  const characters = [];

  for (const directoryName of characterDirs) {
    const character = await parseCharacterDefinition(directoryName);
    if (seenIds.has(character.id)) {
      throw new Error(`Duplicate character id: ${character.id}`);
    }
    if (seenLabels.has(character.label.toLowerCase())) {
      throw new Error(`Duplicate character label: ${character.label}`);
    }
    seenIds.add(character.id);
    seenLabels.add(character.label.toLowerCase());
    characters.push(character);
  }

  return characters;
};

const generateRegistrySource = (characters) => {
  const importLines = [];
  const entryLines = [];

  for (const character of characters) {
    const pascal = toPascalCase(character.id);
    const profileVar = `${character.id}Profile`;
    const runtimeVar = `create${pascal}Runtime`;
    importLines.push(
      `import { profile as ${profileVar} } from "../../${character.id}/profile";`
    );
    importLines.push(
      `import { createRuntime as ${runtimeVar} } from "../../${character.id}/runtime";`
    );
    entryLines.push(
      `  { profile: ${profileVar}, createRuntime: ${runtimeVar} },`
    );
  }

  return `// AUTO-GENERATED by tools/character/sync-characters.mjs. Do not edit manually.
${importLines.join("\n")}
import type { CharacterEntry, CharacterProfile, CharacterStats } from "../types";

const entries: CharacterEntry[] = [
${entryLines.join("\n")}
];
const defaultStats: CharacterStats = {
  health: 100,
  stamina: 100,
  mana: 100,
  energy: 100,
};
const profiles: CharacterProfile[] = entries.map((entry) => entry.profile);
const defaultEntry =
  entries.find((entry) => entry.profile.starter) ?? entries[0];

if (!defaultEntry) {
  throw new Error("No character entries registered.");
}

export const resolveCharacterStats = (
  profile?: CharacterProfile
): CharacterStats => ({
  ...defaultStats,
  ...(profile?.stats ?? {}),
});

export const getCharacterEntry = (path?: string) => {
  if (!path) return defaultEntry;
  return entries.find((entry) => path.includes(entry.profile.pathToken)) || defaultEntry;
};

export const characterEntries = entries;
export const characterProfiles = profiles;
export const defaultCharacterEntry = defaultEntry;
export const defaultCharacterPath = \`/assets/characters\${defaultEntry.profile.pathToken}\${defaultEntry.profile.id}.glb\`;
`;
};

const generateCharacterCatalogSource = (characters) => {
  const allCharacterNameLines = characters.map(
    (character) => `  "${character.label}",`
  );
  const starterNameLines = characters
    .filter((character) => character.starter)
    .map((character) => `"${character.label}"`);

  return `// AUTO-GENERATED by tools/character/sync-characters.mjs. Do not edit manually.
const ALL_CHARACTER_NAMES = [
${allCharacterNameLines.join("\n")}
] as const;

const STARTER_CHARACTER_NAMES = [${starterNameLines.join(", ")}] as const;

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};

export const ensureCharacterCatalog = async (db: Queryable) => {
  const placeholders = ALL_CHARACTER_NAMES.map(
    (_name, index) => \`($\${index + 1})\`
  ).join(", ");

  await db.query(
    \`
      INSERT INTO characters (name)
      VALUES \${placeholders}
      ON CONFLICT DO NOTHING;
    \`,
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
    \`
      INSERT INTO user_characters (user_id, character_id)
      SELECT $1, c.id
      FROM characters c
      WHERE c.name = ANY($2::varchar[])
      ON CONFLICT DO NOTHING;
    \`,
    [userId, [...characterNames]]
  );
};

export const assignStarterCharacters = async (db: Queryable, userId: number) =>
  assignCharactersToUser(db, userId, STARTER_CHARACTER_NAMES);

export { ALL_CHARACTER_NAMES, STARTER_CHARACTER_NAMES };
`;
};

const main = async () => {
  const characters = await readCharacterDefinitions();
  const updatedFiles = [];

  if (await writeIfChanged(registryPath, generateRegistrySource(characters))) {
    updatedFiles.push(path.relative(projectRoot, registryPath));
  }
  if (
    await writeIfChanged(
      characterCatalogPath,
      generateCharacterCatalogSource(characters)
    )
  ) {
    updatedFiles.push(path.relative(projectRoot, characterCatalogPath));
  }

  if (!updatedFiles.length) {
    console.log("Character sync: no file changes.");
    return;
  }

  console.log("Character sync updated files:");
  for (const filePath of updatedFiles) {
    console.log(`- ${escapeSingleQuote(filePath)}`);
  }
};

await main();
