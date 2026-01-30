import { createCharacterRuntime } from "../runtimeBase.js";
import { profile } from "./profile.js";

export const createRuntime = ({ avatar }) =>
  createCharacterRuntime({ avatar, profile });
