import * as THREE from "three";
import { HpPool } from "../../hpPool";

export interface MonsterStats {
  health: number;
  attack: number;
  defense: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
}

export interface MonsterProfile {
  id: string;
  label: string;
  pathToken: string;
  stats?: Partial<MonsterStats>;
  tag?: string;
}

export interface MonsterSpawn {
  position?: THREE.Vector3;
  yaw?: number;
}

export interface MonsterUpdateArgs {
  now: number;
  delta: number;
  target?: THREE.Object3D | null;
}

export type MonsterBehavior = (args: {
  monster: Monster;
  now: number;
  delta: number;
  target?: THREE.Object3D | null;
}) => void;

const defaultMonsterStats: MonsterStats = {
  health: 80,
  attack: 8,
  defense: 2,
  speed: 1.6,
  aggroRange: 10,
  attackRange: 1.6,
};

export const resolveMonsterStats = (profile?: MonsterProfile): MonsterStats => ({
  ...defaultMonsterStats,
  ...(profile?.stats ?? {}),
});

export class Monster {
  readonly model: THREE.Object3D;
  readonly profile: MonsterProfile;
  readonly stats: MonsterStats;

  private readonly hp: HpPool;
  private behavior?: MonsterBehavior;
  private target: THREE.Object3D | null = null;
  private readonly scratch = new THREE.Vector3();
  private readonly scratchTarget = new THREE.Vector3();
  private readonly hitFlashColor = new THREE.Color(0xff3b30);
  private readonly hitFlashDurationMs = 110;
  private readonly hitFlashOriginalState = new Map<
    THREE.Material,
    {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    }
  >();
  private readonly activeHitFlashMaterials = new Set<THREE.Material>();
  private cachedHitFlashMaterials: THREE.Material[] | null = null;
  private hitFlashUntil = 0;
  private hitFlashTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({
    model,
    profile,
    behavior,
    spawn,
  }: {
    model: THREE.Object3D;
    profile: MonsterProfile;
    behavior?: MonsterBehavior;
    spawn?: MonsterSpawn;
  }) {
    this.model = model;
    this.profile = profile;
    this.stats = resolveMonsterStats(profile);
    this.hp = new HpPool({
      max: this.stats.health,
      current: this.stats.health,
      resolveDamage: ({ amount }) => Math.max(0, amount - this.stats.defense),
    });
    this.behavior = behavior;

    if (spawn?.position) {
      this.model.position.copy(spawn.position);
    }
    if (typeof spawn?.yaw === "number") {
      this.model.rotation.y = spawn.yaw;
    }
  }

  get health() {
    return this.hp.current;
  }

  get maxHealth() {
    return this.hp.max;
  }

  get isAlive() {
    return this.hp.isAlive;
  }

  get currentTarget() {
    return this.target;
  }

  setBehavior(next?: MonsterBehavior) {
    this.behavior = next;
  }

  setTarget(next: THREE.Object3D | null) {
    this.target = next;
  }

  clearTarget() {
    this.target = null;
  }

  invalidateHitFlashMaterialCache() {
    this.cachedHitFlashMaterials = null;
  }

  takeDamage(amount: number) {
    const applied = this.hp.takeDamage(amount);
    if (applied > 0) {
      this.triggerHitFlash();
    }
    return applied;
  }

  heal(amount: number) {
    return this.hp.heal(amount);
  }

  revive(ratio = 1) {
    this.hp.revive(ratio);
    this.clearHitFlash();
  }

  distanceTo(target: THREE.Object3D) {
    target.getWorldPosition(this.scratchTarget);
    this.model.getWorldPosition(this.scratch);
    return this.scratch.distanceTo(this.scratchTarget);
  }

  faceTarget(target: THREE.Object3D) {
    target.getWorldPosition(this.scratchTarget);
    this.model.getWorldPosition(this.scratch);
    this.scratchTarget.y = this.scratch.y;
    this.model.lookAt(this.scratchTarget);
  }

  moveToward(target: THREE.Object3D, delta: number, speedMultiplier = 1) {
    target.getWorldPosition(this.scratchTarget);
    this.model.getWorldPosition(this.scratch);
    const dx = this.scratchTarget.x - this.scratch.x;
    const dz = this.scratchTarget.z - this.scratch.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.000001) return;
    const step = this.stats.speed * speedMultiplier * delta;
    const ratio = Math.min(step / length, 1);
    this.model.position.x += dx * ratio;
    this.model.position.z += dz * ratio;
  }

  update({ now, delta, target }: MonsterUpdateArgs) {
    if (!this.hp.isAlive) return;
    const resolvedTarget = target ?? this.target ?? null;
    if (this.behavior) {
      this.behavior({ monster: this, now, delta, target: resolvedTarget });
    }
  }

  private isColorMaterial(
    material: THREE.Material
  ): material is THREE.Material & { color: THREE.Color } {
    return Boolean(
      (material as THREE.Material & { color?: THREE.Color }).color?.isColor
    );
  }

  private isEmissiveMaterial(
    material: THREE.Material
  ): material is THREE.Material & {
    emissive: THREE.Color;
    emissiveIntensity: number;
  } {
    const mat = material as THREE.Material & {
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    };
    return Boolean(mat.emissive?.isColor);
  }

  private collectMeshMaterials(): THREE.Material[] {
    if (this.cachedHitFlashMaterials) {
      return this.cachedHitFlashMaterials;
    }
    const materials = new Set<THREE.Material>();
    this.model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        for (let i = 0; i < mesh.material.length; i += 1) {
          const material = mesh.material[i];
          if (material) materials.add(material);
        }
      } else if (mesh.material) {
        materials.add(mesh.material);
      }
    });
    this.cachedHitFlashMaterials = Array.from(materials);
    return this.cachedHitFlashMaterials;
  }

  private saveMaterialState(material: THREE.Material) {
    if (this.hitFlashOriginalState.has(material)) return;
    const state: {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    } = {};
    if (this.isColorMaterial(material)) {
      state.color = material.color.clone();
    }
    if (this.isEmissiveMaterial(material)) {
      state.emissive = material.emissive.clone();
      state.emissiveIntensity = material.emissiveIntensity;
    }
    this.hitFlashOriginalState.set(material, state);
  }

  private applyMaterialHitFlash(material: THREE.Material) {
    this.saveMaterialState(material);
    if (this.isColorMaterial(material)) {
      material.color.copy(this.hitFlashColor);
    }
    if (this.isEmissiveMaterial(material)) {
      material.emissive.copy(this.hitFlashColor);
      material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.75);
    }
    this.activeHitFlashMaterials.add(material);
  }

  private restoreHitFlashMaterials() {
    this.activeHitFlashMaterials.forEach((material) => {
      const saved = this.hitFlashOriginalState.get(material);
      if (!saved) return;
      if (saved.color && this.isColorMaterial(material)) {
        material.color.copy(saved.color);
      }
      if (saved.emissive && this.isEmissiveMaterial(material)) {
        material.emissive.copy(saved.emissive);
        if (typeof saved.emissiveIntensity === "number") {
          material.emissiveIntensity = saved.emissiveIntensity;
        }
      }
    });
    this.activeHitFlashMaterials.clear();
  }

  private scheduleHitFlashRestore() {
    if (this.hitFlashTimer) {
      clearTimeout(this.hitFlashTimer);
      this.hitFlashTimer = null;
    }
    const delay = Math.max(0, this.hitFlashUntil - performance.now());
    this.hitFlashTimer = setTimeout(() => {
      this.hitFlashTimer = null;
      if (performance.now() < this.hitFlashUntil) {
        this.scheduleHitFlashRestore();
        return;
      }
      this.restoreHitFlashMaterials();
    }, delay);
  }

  private triggerHitFlash() {
    const materials = this.collectMeshMaterials();
    if (!materials.length) return;
    for (let i = 0; i < materials.length; i += 1) {
      this.applyMaterialHitFlash(materials[i]);
    }
    this.hitFlashUntil = performance.now() + this.hitFlashDurationMs;
    this.scheduleHitFlashRestore();
  }

  private clearHitFlash() {
    if (this.hitFlashTimer) {
      clearTimeout(this.hitFlashTimer);
      this.hitFlashTimer = null;
    }
    this.hitFlashUntil = 0;
    this.restoreHitFlashMaterials();
  }

  dispose() {
    this.clearHitFlash();
    this.hitFlashOriginalState.clear();
    this.cachedHitFlashMaterials = null;
  }
}
