import * as THREE from "three";
import type { SkillKey } from "../types";

export interface PlayerLookState {
  yaw: number;
  pitch: number;
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
  onJump: () => void;
  onPrimaryDown: () => void;
  onPrimaryUp: () => void;
  onPrimaryCancel: () => void;
  onSecondaryDown: () => void;
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
  onJump,
  onPrimaryDown,
  onPrimaryUp,
  onPrimaryCancel,
  onSecondaryDown,
  onSkill,
}: BindPlayerInputArgs) => {
  const maxYawStepPerEvent = 0.28;
  const maxPitchStepPerEvent = 0.2;
  let isPointerLockRequested = false;
  let ignoreMouseMoveCount = 0;

  const handlePointerDown = (event: PointerEvent) => {
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
      onPrimaryDown();
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      onSecondaryDown();
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return;
    onPrimaryUp();
  };

  const handlePointerLockChange = () => {
    if (!mount) return;
    const isLocked = document.pointerLockElement === mount;
    if (!isLocked) {
      isPointerLockRequested = false;
      ignoreMouseMoveCount = 0;
      onPrimaryCancel();
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
    if (document.pointerLockElement !== mount) return;
    if (ignoreMouseMoveCount > 0) {
      ignoreMouseMoveCount -= 1;
      return;
    }
    const safeSensitivity = Math.max(0.000001, Math.abs(lookState.sensitivity));
    const maxMovementX = maxYawStepPerEvent / safeSensitivity;
    const maxMovementY = maxPitchStepPerEvent / safeSensitivity;
    const movementX = THREE.MathUtils.clamp(event.movementX, -maxMovementX, maxMovementX);
    const movementY = THREE.MathUtils.clamp(event.movementY, -maxMovementY, maxMovementY);
    lookState.yaw -= movementX * lookState.sensitivity;
    lookState.pitch = THREE.MathUtils.clamp(
      lookState.pitch - movementY * lookState.sensitivity,
      lookState.minPitch,
      lookState.maxPitch
    );
  };

  const handleContextMenu = (event: Event) => {
    event.preventDefault();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const mapped = keyMap[event.code];
    if (mapped) {
      pressedKeys.add(mapped);
    }
    if (mapped === "space" && isGrounded() && !isMovementLocked()) {
      onJump();
    }
    if (event.repeat) return;

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
    onPrimaryCancel();
  };

  mount.addEventListener("pointerdown", handlePointerDown);
  mount.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("pointerup", handlePointerUp);
  document.addEventListener("pointerlockchange", handlePointerLockChange);
  document.addEventListener("pointerlockerror", handlePointerLockError);
  document.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleBlur);

  return {
    dispose: () => {
      mount.removeEventListener("pointerdown", handlePointerDown);
      mount.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      if (document.pointerLockElement === mount && document.exitPointerLock) {
        document.exitPointerLock();
      }
    },
  };
};


