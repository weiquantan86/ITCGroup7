import * as THREE from "three";
import type {
  LinearProjectileHooks,
  LinearProjectileState,
} from "./types";

export class LinearProjectileUpdater {
  private readonly raycaster = new THREE.Raycaster();
  private readonly origin = new THREE.Vector3();
  private readonly nextPosition = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();

  update<TProjectile extends LinearProjectileState>(
    projectiles: TProjectile[],
    now: number,
    delta: number,
    hooks: LinearProjectileHooks<TProjectile>
  ) {
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = projectiles[i];
      if (!projectile) {
        // External systems may clear/splice the array during callbacks.
        continue;
      }
      const object = hooks.getObject(projectile);
      hooks.applyForces?.(projectile, delta);

      this.origin.copy(object.position);
      this.nextPosition
        .copy(object.position)
        .addScaledVector(projectile.velocity, delta);

      let removed = false;
      const remove = () => {
        removed = true;
      };

      this.direction.copy(this.nextPosition).sub(this.origin);
      const travelDistance = this.direction.length();
      if (travelDistance > 0.000001) {
        this.direction.divideScalar(travelDistance);
        hooks.onTravel?.(
          projectile,
          now,
          delta,
          this.origin,
          this.nextPosition,
          this.direction,
          travelDistance,
          this.raycaster,
          remove
        );
      }

      if (removed) {
        hooks.onRemove?.(projectile);
        projectiles.splice(i, 1);
        continue;
      }

      object.position.copy(this.nextPosition);
      projectile.life += delta;

      if (
        projectile.life >= projectile.maxLife ||
        hooks.shouldExpire?.(projectile, now, delta)
      ) {
        hooks.onRemove?.(projectile);
        projectiles.splice(i, 1);
        continue;
      }

      hooks.onAfterMove?.(projectile, now, delta, remove);
      if (removed) {
        hooks.onRemove?.(projectile);
        projectiles.splice(i, 1);
      }
    }
  }
}
