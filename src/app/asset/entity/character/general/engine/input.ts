import * as THREE from "three";
import type { SkillKey } from "../types";

export interface PlayerLookState {
  yaw: number;
  pitch: number;
  pendingYawDelta: number;
  pendingPitchDelta: number;
  minPitch: number;
  maxPitch: number;
  sensitivity: number;
}

type BindPlayerInputArgs = {
  mount: HTMLElement;
  pressedKeys: Set<string>;
  lookState: PlayerLookState;
  isGrounded: () => boolean;
  isMovementLocked: () => boolean;
  isInputLocked: () => boolean;
  onJump: () => void;
  onDash: (now: number) => void;
  onPrimaryDown: () => void;
  onPrimaryUp: () => void;
  onPrimaryCancel: () => void;
  onSkill: (skillKey: SkillKey, now: number) => void;
};

const keyMap: Record<string, string> = {
  KeyW: "w",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  KeyZ: "z",
  KeyX: "x",
  KeyC: "c",
  KeyV: "v",
  KeyB: "b",
  KeyN: "n",
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowRight: "right",
  ShiftLeft: "shift",
  ShiftRight: "shift",
  Space: "space",
};

const skillCodeMap: Record<string, SkillKey> = {
  KeyQ: "q",
  KeyE: "e",
  KeyR: "r",
};

export const bindPlayerInput = ({
  mount,
  pressedKeys,
  lookState,
  isGrounded,
  isMovementLocked,
  isInputLocked,
  onJump,
  onDash,
  onPrimaryDown,
  onPrimaryUp,
  onPrimaryCancel,
  onSkill,
}: BindPlayerInputArgs) => {
  const maxYawStepPerEvent = 0.28;
  const maxPitchStepPerEvent = 0.2;
  let isPointerLockRequested = false;
  let ignoreMouseMoveCount = 0;
  let primaryPressed = false;

  const releasePrimary = (cancel = false) => {
    if (!primaryPressed && cancel) {
      onPrimaryCancel();
      return;
    }
    primaryPressed = false;
    if (cancel) {
      onPrimaryCancel();
    } else {
      onPrimaryUp();
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (isInputLocked()) return;
    if (event.button === 0) {
      if (mount?.requestPointerLock) {
        if (document.pointerLockElement !== mount && !isPointerLockRequested) {
          isPointerLockRequested = true;
          try {
            const lockRequest = mount.requestPointerLock() as void | Promise<void>;
            if (lockRequest instanceof Promise) {
              lockRequest.catch(() => {
                isPointerLockRequested = false;
              });
            }
          } catch {
            isPointerLockRequested = false;
          }
        }
      }
      primaryPressed = true;
      onPrimaryDown();
      return;
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return;
    releasePrimary(false);
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (event.button !== 0) return;
    releasePrimary(false);
  };

  const handlePointerCancel = (event: PointerEvent) => {
    if (event.button !== 0) return;
    releasePrimary(true);
  };

  const handlePointerLockChange = () => {
    if (!mount) return;
    const isLocked = document.pointerLockElement === mount;
    if (!isLocked) {
      isPointerLockRequested = false;
      ignoreMouseMoveCount = 0;
      lookState.pendingYawDelta = 0;
      lookState.pendingPitchDelta = 0;
      releasePrimary(true);
    } else {
      // Ignore the first mouse delta after lock to avoid occasional jump spikes.
      ignoreMouseMoveCount = 1;
    }
    mount.style.cursor = isLocked ? "none" : "";
  };

  const handlePointerLockError = () => {
    isPointerLockRequested = false;
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== mount || isInputLocked()) return;
    if (primaryPressed && (event.buttons & 1) === 0) {
      releasePrimary(true);
    }
    if (ignoreMouseMoveCount > 0) {
      ignoreMouseMoveCount -= 1;
      return;
    }
    const safeSensitivity = Math.max(0.000001, Math.abs(lookState.sensitivity));
    const maxMovementX = maxYawStepPerEvent / safeSensitivity;
    const maxMovementY = maxPitchStepPerEvent / safeSensitivity;
    const movementX = THREE.MathUtils.clamp(event.movementX, -maxMovementX, maxMovementX);
    const movementY = THREE.MathUtils.clamp(event.movementY, -maxMovementY, maxMovementY);
    lookState.pendingYawDelta -= movementX * lookState.sensitivity;
    lookState.pendingPitchDelta -= movementY * lookState.sensitivity;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (isInputLocked()) {
      const mapped = keyMap[event.code];
      if (mapped) {
        pressedKeys.delete(mapped);
      }
      return;
    }
    const mapped = keyMap[event.code];
    if (mapped) {
      pressedKeys.add(mapped);
    }
    if (mapped === "space" && isGrounded() && !isMovementLocked()) {
      onJump();
    }
    if (event.repeat) return;

    if (event.code === "KeyF") {
      onDash(performance.now());
      return;
    }

    const skillKey = skillCodeMap[event.code];
    if (!skillKey) return;
    onSkill(skillKey, performance.now());
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const mapped = keyMap[event.code];
    if (mapped) {
      pressedKeys.delete(mapped);
    }
  };

  const handleBlur = () => {
    pressedKeys.clear();
    lookState.pendingYawDelta = 0;
    lookState.pendingPitchDelta = 0;
    releasePrimary(true);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "hidden") return;
    pressedKeys.clear();
    lookState.pendingYawDelta = 0;
    lookState.pendingPitchDelta = 0;
    releasePrimary(true);
  };

  mount.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("pointercancel", handlePointerCancel);
  document.addEventListener("pointerlockchange", handlePointerLockChange);
  document.addEventListener("pointerlockerror", handlePointerLockError);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleBlur);

  return {
    syncLockState: () => {
      if (!isInputLocked()) return;
      pressedKeys.clear();
      releasePrimary(true);
      if (document.pointerLockElement === mount && document.exitPointerLock) {
        document.exitPointerLock();
      }
    },
    dispose: () => {
      mount.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      if (document.pointerLockElement === mount && document.exitPointerLock) {
        document.exitPointerLock();
      }
    },
  };
};


