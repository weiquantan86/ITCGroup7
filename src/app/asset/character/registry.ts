import { profile as adamProfile } from "./adam/profile";
import { createRuntime as createAdamRuntime } from "./adam/runtime";
import { profile as baronProfile } from "./baron/profile";
import { createRuntime as createBaronRuntime } from "./baron/runtime";
import { profile as carrotProfile } from "./carrot/profile";
import { createRuntime as createCarrotRuntime } from "./carrot/runtime";
import type { CharacterEntry, CharacterProfile, CharacterStats } from "./types";

const entries: CharacterEntry[] = [
  { profile: adamProfile, createRuntime: createAdamRuntime },
  { profile: baronProfile, createRuntime: createBaronRuntime },
  { profile: carrotProfile, createRuntime: createCarrotRuntime },
];
const defaultStats: CharacterStats = { health: 100, mana: 100 };
const profiles: CharacterProfile[] = entries.map((entry) => entry.profile);

export const resolveCharacterStats = (
  profile?: CharacterProfile
): CharacterStats => ({
  ...defaultStats,
  ...(profile?.stats ?? {}),
});

export const getCharacterProfile = (path?: string) => {
  if (!path) return adamProfile;
  return profiles.find((profile) => path.includes(profile.pathToken)) || adamProfile;
};

export const getCharacterEntry = (path?: string) => {
  if (!path) return entries[0];
  return entries.find((entry) => path.includes(entry.profile.pathToken)) || entries[0];
};

export const characterProfiles = profiles;
