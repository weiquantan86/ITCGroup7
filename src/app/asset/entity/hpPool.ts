export interface HpResolveArgs {
  amount: number;
  current: number;
  max: number;
  isAlive: boolean;
  metadata?: unknown;
}

export type HpAmountResolver = (args: HpResolveArgs) => number;

export interface HpPoolConfig {
  max: number;
  current?: number;
  allowDamageWhenDead?: boolean;
  allowHealWhenDead?: boolean;
  resolveDamage?: HpAmountResolver;
  resolveHeal?: HpAmountResolver;
}

export class HpPool {
  private maxValue: number;
  private currentValue: number;
  private aliveValue: boolean;
  private resolveDamageValue: HpAmountResolver;
  private resolveHealValue: HpAmountResolver;
  private readonly allowDamageWhenDead: boolean;
  private readonly allowHealWhenDead: boolean;

  constructor(config: HpPoolConfig) {
    this.maxValue = this.normalizeBound(config.max);
    this.currentValue = this.clampToBounds(
      config.current ?? this.maxValue,
      this.maxValue
    );
    this.aliveValue = this.currentValue > 0;
    this.resolveDamageValue = config.resolveDamage ?? ((args) => args.amount);
    this.resolveHealValue = config.resolveHeal ?? ((args) => args.amount);
    this.allowDamageWhenDead = Boolean(config.allowDamageWhenDead);
    this.allowHealWhenDead = Boolean(config.allowHealWhenDead);
  }

  get current() {
    return this.currentValue;
  }

  get max() {
    return this.maxValue;
  }

  get isAlive() {
    return this.aliveValue;
  }

  get ratio() {
    if (this.maxValue <= 0) return 0;
    return this.currentValue / this.maxValue;
  }

  setResolvers({
    damage,
    heal,
  }: {
    damage?: HpAmountResolver;
    heal?: HpAmountResolver;
  }) {
    if (damage) {
      this.resolveDamageValue = damage;
    }
    if (heal) {
      this.resolveHealValue = heal;
    }
  }

  setMax(nextMax: number, options?: { keepRatio?: boolean }) {
    const keepRatio = Boolean(options?.keepRatio);
    const ratioBefore = this.ratio;
    const resolvedMax = this.normalizeBound(nextMax);
    this.maxValue = resolvedMax;
    if (keepRatio) {
      this.currentValue = this.clampToBounds(resolvedMax * ratioBefore, resolvedMax);
    } else {
      this.currentValue = this.clampToBounds(this.currentValue, resolvedMax);
    }
    this.aliveValue = this.currentValue > 0;
  }

  setCurrent(nextCurrent: number) {
    this.currentValue = this.clampToBounds(nextCurrent, this.maxValue);
    this.aliveValue = this.currentValue > 0;
  }

  reset(max: number, current = max) {
    this.maxValue = this.normalizeBound(max);
    this.currentValue = this.clampToBounds(current, this.maxValue);
    this.aliveValue = this.currentValue > 0;
  }

  takeDamage(amount: number, metadata?: unknown) {
    if (!this.aliveValue && !this.allowDamageWhenDead) return 0;
    const resolvedAmount = this.resolveAmount(
      this.resolveDamageValue,
      amount,
      metadata
    );
    if (resolvedAmount <= 0) return 0;
    const before = this.currentValue;
    this.currentValue = Math.max(0, this.currentValue - resolvedAmount);
    const applied = before - this.currentValue;
    if (this.currentValue <= 0) {
      this.aliveValue = false;
    }
    return applied;
  }

  heal(amount: number, metadata?: unknown) {
    if (!this.aliveValue && !this.allowHealWhenDead) return 0;
    const resolvedAmount = this.resolveAmount(
      this.resolveHealValue,
      amount,
      metadata
    );
    if (resolvedAmount <= 0) return 0;
    const before = this.currentValue;
    this.currentValue = Math.min(this.maxValue, this.currentValue + resolvedAmount);
    const applied = this.currentValue - before;
    if (this.currentValue > 0) {
      this.aliveValue = true;
    }
    return applied;
  }

  restoreFull() {
    if (this.currentValue >= this.maxValue) return 0;
    const before = this.currentValue;
    this.currentValue = this.maxValue;
    if (this.currentValue > 0) {
      this.aliveValue = true;
    }
    return this.currentValue - before;
  }

  revive(ratio = 1) {
    const clampedRatio = Math.max(0, Math.min(1, this.normalizeAmount(ratio)));
    this.currentValue = Math.round(this.maxValue * clampedRatio);
    this.aliveValue = this.currentValue > 0;
  }

  private resolveAmount(
    resolver: HpAmountResolver,
    amount: number,
    metadata?: unknown
  ) {
    const inputAmount = this.normalizeAmount(amount);
    if (inputAmount <= 0) return 0;
    const resolved = resolver({
      amount: inputAmount,
      current: this.currentValue,
      max: this.maxValue,
      isAlive: this.aliveValue,
      metadata,
    });
    return this.normalizeAmount(resolved);
  }

  private normalizeAmount(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, value);
  }

  private normalizeBound(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, value);
  }

  private clampToBounds(value: number, max: number) {
    const normalizedValue = this.normalizeAmount(value);
    return Math.min(max, normalizedValue);
  }
}
