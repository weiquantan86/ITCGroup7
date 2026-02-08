import * as THREE from "three";

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

  private healthValue: number;
  private aliveValue: boolean;
  private behavior?: MonsterBehavior;
  private target: THREE.Object3D | null = null;
  private readonly scratch = new THREE.Vector3();
  private readonly scratchTarget = new THREE.Vector3();

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
    this.healthValue = this.stats.health;
    this.aliveValue = this.healthValue > 0;
    this.behavior = behavior;

    if (spawn?.position) {
      this.model.position.copy(spawn.position);
    }
    if (typeof spawn?.yaw === "number") {
      this.model.rotation.y = spawn.yaw;
    }
  }

  get health() {
    return this.healthValue;
  }

  get maxHealth() {
    return this.stats.health;
  }

  get isAlive() {
    return this.aliveValue;
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

  takeDamage(amount: number) {
    if (!this.aliveValue || amount <= 0) return 0;
    const mitigated = Math.max(0, amount - this.stats.defense);
    if (mitigated <= 0) return 0;
    this.healthValue = Math.max(0, this.healthValue - mitigated);
    if (this.healthValue === 0) {
      this.aliveValue = false;
    }
    return mitigated;
  }

  heal(amount: number) {
    if (!this.aliveValue || amount <= 0) return 0;
    const before = this.healthValue;
    this.healthValue = Math.min(this.stats.health, this.healthValue + amount);
    return this.healthValue - before;
  }

  revive(ratio = 1) {
    const clamped = Math.max(0, Math.min(1, ratio));
    this.healthValue = Math.round(this.stats.health * clamped);
    this.aliveValue = this.healthValue > 0;
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
    if (!this.aliveValue) return;
    const resolvedTarget = target ?? this.target ?? null;
    if (this.behavior) {
      this.behavior({ monster: this, now, delta, target: resolvedTarget });
    }
  }

  dispose() {}
}
