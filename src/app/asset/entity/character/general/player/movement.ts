import * as THREE from "three";
import type { PlayerLookState } from "../engine/input";

type ResolveInputDirectionArgs = {
  pressedKeys: Set<string>;
  lookState: PlayerLookState;
  out: THREE.Vector3;
  forward: THREE.Vector3;
  right: THREE.Vector3;
};

export const resolveInputDirection = ({
  pressedKeys,
  lookState,
  out,
  forward,
  right,
}: ResolveInputDirectionArgs) => {
  const inputX =
    (pressedKeys.has("a") || pressedKeys.has("left") ? 1 : 0) +
    (pressedKeys.has("d") || pressedKeys.has("right") ? -1 : 0);
  const inputZ =
    (pressedKeys.has("w") || pressedKeys.has("up") ? 1 : 0) +
    (pressedKeys.has("s") || pressedKeys.has("down") ? -1 : 0);
  if (inputX === 0 && inputZ === 0) return false;
  const length = Math.hypot(inputX, inputZ) || 1;
  const dirX = inputX / length;
  const dirZ = inputZ / length;
  forward.set(Math.sin(lookState.yaw), 0, Math.cos(lookState.yaw));
  right.set(forward.z, 0, -forward.x);
  out.set(
    right.x * dirX + forward.x * dirZ,
    0,
    right.z * dirX + forward.z * dirZ
  );
  return true;
};

export const clampToBounds = (
  bounds:
    | {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
      }
    | undefined,
  x: number,
  z: number
) => {
  if (!bounds) return { x, z };
  return {
    x: THREE.MathUtils.clamp(x, bounds.minX, bounds.maxX),
    z: THREE.MathUtils.clamp(z, bounds.minZ, bounds.maxZ),
  };
};

