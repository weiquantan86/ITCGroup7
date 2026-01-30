import { profile as adamProfile } from "./adam/profile.js";
import { profile as baronProfile } from "./baron/profile.js";
import { profile as carrotProfile } from "./carrot/profile.js";

const profiles = [adamProfile, baronProfile, carrotProfile];

export const getCharacterProfile = (path) => {
  if (!path) return adamProfile;
  return profiles.find((profile) => path.includes(profile.pathToken)) || adamProfile;
};

export const characterProfiles = profiles;
