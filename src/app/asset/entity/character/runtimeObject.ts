import type { CharacterRuntime, CharacterRuntimeUpdate } from "./types";

type CharacterRuntimeObjectInit = {
  setProfile: CharacterRuntime["setProfile"];
  triggerSlash: CharacterRuntime["triggerSlash"];
  handleRightClick: CharacterRuntime["handleRightClick"];
  update: (args: CharacterRuntimeUpdate) => void;
  dispose: CharacterRuntime["dispose"];
  isFacingLocked: CharacterRuntime["isFacingLocked"];
  handlePrimaryDown?: CharacterRuntime["handlePrimaryDown"];
  handlePrimaryUp?: CharacterRuntime["handlePrimaryUp"];
  handlePrimaryCancel?: CharacterRuntime["handlePrimaryCancel"];
  handleSkillQ?: CharacterRuntime["handleSkillQ"];
  handleSkillE?: CharacterRuntime["handleSkillE"];
  handleSkillR?: CharacterRuntime["handleSkillR"];
  getProjectileBlockers?: CharacterRuntime["getProjectileBlockers"];
  isMovementLocked?: CharacterRuntime["isMovementLocked"];
  getSkillCooldownRemainingMs?: CharacterRuntime["getSkillCooldownRemainingMs"];
  getSkillCooldownDurationMs?: CharacterRuntime["getSkillCooldownDurationMs"];
  resetState?: CharacterRuntime["resetState"];
};

export class CharacterRuntimeObject implements CharacterRuntime {
  readonly setProfile: CharacterRuntime["setProfile"];
  readonly triggerSlash: CharacterRuntime["triggerSlash"];
  readonly handleRightClick: CharacterRuntime["handleRightClick"];
  readonly update: (args: CharacterRuntimeUpdate) => void;
  readonly dispose: CharacterRuntime["dispose"];
  readonly isFacingLocked: CharacterRuntime["isFacingLocked"];
  readonly handlePrimaryDown?: CharacterRuntime["handlePrimaryDown"];
  readonly handlePrimaryUp?: CharacterRuntime["handlePrimaryUp"];
  readonly handlePrimaryCancel?: CharacterRuntime["handlePrimaryCancel"];
  readonly handleSkillQ?: CharacterRuntime["handleSkillQ"];
  readonly handleSkillE?: CharacterRuntime["handleSkillE"];
  readonly handleSkillR?: CharacterRuntime["handleSkillR"];
  readonly getProjectileBlockers?: CharacterRuntime["getProjectileBlockers"];
  readonly isMovementLocked?: CharacterRuntime["isMovementLocked"];
  readonly getSkillCooldownRemainingMs?: CharacterRuntime["getSkillCooldownRemainingMs"];
  readonly getSkillCooldownDurationMs?: CharacterRuntime["getSkillCooldownDurationMs"];
  readonly resetState?: CharacterRuntime["resetState"];

  constructor(init: CharacterRuntimeObjectInit) {
    this.setProfile = init.setProfile;
    this.triggerSlash = init.triggerSlash;
    this.handleRightClick = init.handleRightClick;
    this.update = init.update;
    this.dispose = init.dispose;
    this.isFacingLocked = init.isFacingLocked;
    this.handlePrimaryDown = init.handlePrimaryDown;
    this.handlePrimaryUp = init.handlePrimaryUp;
    this.handlePrimaryCancel = init.handlePrimaryCancel;
    this.handleSkillQ = init.handleSkillQ;
    this.handleSkillE = init.handleSkillE;
    this.handleSkillR = init.handleSkillR;
    this.getProjectileBlockers = init.getProjectileBlockers;
    this.isMovementLocked = init.isMovementLocked;
    this.getSkillCooldownRemainingMs = init.getSkillCooldownRemainingMs;
    this.getSkillCooldownDurationMs = init.getSkillCooldownDurationMs;
    this.resetState = init.resetState;
  }
}
