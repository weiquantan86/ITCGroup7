import { createCharacterRuntime } from "../runtimeBase";
import type { CharacterRuntimeFactory } from "../types";
import { profile } from "./profile";

export const createRuntime: CharacterRuntimeFactory = ({ avatar }) =>
  createCharacterRuntime({ avatar, profile });
