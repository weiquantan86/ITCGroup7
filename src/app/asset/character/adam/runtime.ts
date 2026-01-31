import { createCharacterRuntime } from "../runtimeBase";
import { profile } from "./profile";

export const createRuntime = ({ avatar }) =>
  createCharacterRuntime({ avatar, profile });

