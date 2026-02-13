import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import type { CharacterRuntimeFactory } from "../general/types";
import { profile } from "./profile";

export const createRuntime: CharacterRuntimeFactory = ({ avatar }) =>
  createCharacterRuntime({ avatar, profile });



