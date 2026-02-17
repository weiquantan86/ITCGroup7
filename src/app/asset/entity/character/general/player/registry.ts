import { profile as adamProfile } from "../../adam/profile";
import { createRuntime as createAdamRuntime } from "../../adam/runtime";
import { profile as baronProfile } from "../../baron/profile";
import { createRuntime as createBaronRuntime } from "../../baron/runtime";
import { profile as carrotProfile } from "../../carrot/profile";
import { createRuntime as createCarrotRuntime } from "../../carrot/runtime";
import { profile as dakotaProfile } from "../../dakota/profile";
import { createRuntime as createDakotaRuntime } from "../../dakota/runtime";
import { profile as eliProfile } from "../../eli/profile";
import { createRuntime as createEliRuntime } from "../../eli/runtime";
import { profile as felixProfile } from "../../felix/profile";
import { createRuntime as createFelixRuntime } from "../../felix/runtime";
import { profile as grantProfile } from "../../grant/profile";
import { createRuntime as createGrantRuntime } from "../../grant/runtime";
import { profile as harperProfile } from "../../harper/profile";
import { createRuntime as createHarperRuntime } from "../../harper/runtime";
import type { CharacterEntry, CharacterProfile, CharacterStats } from "../types";

const entries: CharacterEntry[] = [
  { profile: adamProfile, createRuntime: createAdamRuntime },
  { profile: baronProfile, createRuntime: createBaronRuntime },
  { profile: carrotProfile, createRuntime: createCarrotRuntime },
  { profile: dakotaProfile, createRuntime: createDakotaRuntime },
  { profile: eliProfile, createRuntime: createEliRuntime },
  { profile: felixProfile, createRuntime: createFelixRuntime },
  { profile: grantProfile, createRuntime: createGrantRuntime },
  { profile: harperProfile, createRuntime: createHarperRuntime },
];
const defaultStats: CharacterStats = {
  health: 100,
  stamina: 100,
  mana: 100,
  energy: 100,
};
const profiles: CharacterProfile[] = entries.map((entry) => entry.profile);

export const resolveCharacterStats = (
  profile?: CharacterProfile
): CharacterStats => ({
  ...defaultStats,
  ...(profile?.stats ?? {}),
});

export const getCharacterProfile = (path?: string) => {
  const fallbackProfile = profiles[0];
  if (!fallbackProfile) {
    throw new Error("No character profiles registered.");
  }
  if (!path) return fallbackProfile;
  return profiles.find((profile) => path.includes(profile.pathToken)) || fallbackProfile;
};

export const getCharacterEntry = (path?: string) => {
  const fallbackEntry = entries[0];
  if (!fallbackEntry) {
    throw new Error("No character entries registered.");
  }
  if (!path) return fallbackEntry;
  return entries.find((entry) => path.includes(entry.profile.pathToken)) || fallbackEntry;
};

export const characterProfiles = profiles;



