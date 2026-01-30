import { profile as adamProfile } from "./adam/profile.js";
import { createRuntime as createAdamRuntime } from "./adam/runtime.js";
import { profile as baronProfile } from "./baron/profile.js";
import { createRuntime as createBaronRuntime } from "./baron/runtime.js";
import { profile as carrotProfile } from "./carrot/profile.js";
import { createRuntime as createCarrotRuntime } from "./carrot/runtime.js";

const entries = [
  { profile: adamProfile, createRuntime: createAdamRuntime },
  { profile: baronProfile, createRuntime: createBaronRuntime },
  { profile: carrotProfile, createRuntime: createCarrotRuntime },
];
const profiles = entries.map((entry) => entry.profile);

export const getCharacterProfile = (path) => {
  if (!path) return adamProfile;
  return profiles.find((profile) => path.includes(profile.pathToken)) || adamProfile;
};

export const getCharacterEntry = (path) => {
  if (!path) return entries[0];
  return entries.find((entry) => path.includes(entry.profile.pathToken)) || entries[0];
};

export const characterProfiles = profiles;
