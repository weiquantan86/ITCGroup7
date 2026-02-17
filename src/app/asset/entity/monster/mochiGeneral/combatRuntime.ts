import * as THREE from "three";
import type { MochiGeneralCombatEntry } from "./combatBehavior";
import { tickMochiGeneralCombat } from "./combatBehavior";
import { createMochiGeneralSkill1Runtime } from "./skill1Runtime";
import { createMochiGeneralSkill2Runtime } from "./skill2Runtime";
import { createMochiGeneralSkill3Runtime } from "./skill3Runtime";
import { createMochiGeneralSkill4Runtime } from "./skill4Runtime";
import type { ProjectileBlockHitHandler } from "../../../object/projectile/blocking";
import type { StatusEffectApplication } from "../../character/general/types";

type SwordThrustState = {
  active: boolean;
  hitPlayer: boolean;
};

export type MochiGeneralCombatRuntime = {
  tickBoss: (args: {
    entry: MochiGeneralCombatEntry;
    delta: number;
    player: THREE.Object3D;
    gameEnded: boolean;
    isBlocked: (x: number, z: number) => boolean;
    applyDamage: (amount: number) => number;
    summonSkill3Soldier: (args: {
      entry: MochiGeneralCombatEntry;
      position: THREE.Vector3;
    }) => void;
  }) => void;
  update: (args: {
    now: number;
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    applyStatusEffect: (effect: StatusEffectApplication) => boolean;
    gameEnded: boolean;
    projectileBlockers: THREE.Object3D[];
    handleProjectileBlockHit?: ProjectileBlockHitHandler;
  }) => void;
  onBossRemoved: (entry: MochiGeneralCombatEntry) => void;
  dispose: () => void;
};

const BOSS_SWORD_THRUST_DAMAGE = 30;
const BOSS_SWORD_THRUST_ATTACK_WEIGHT_THRESHOLD = 0.2;
const BOSS_SWORD_THRUST_SWING_THRESHOLD = 0.02;
const BOSS_SWORD_THRUST_BLADE_RADIUS = 0.5;
const BOSS_SWORD_THRUST_PLAYER_RADIUS = 0.55;
const BOSS_SWORD_THRUST_PLAYER_HEIGHT_OFFSET = 0.95;
const BOSS_SWORD_THRUST_RANGE_MULTIPLIER = 1.5;

const swordBaseWorld = new THREE.Vector3();
const swordTipWorld = new THREE.Vector3();
const swordClosestPoint = new THREE.Vector3();
const playerHitProbeWorld = new THREE.Vector3();
const swordBladeSegment = new THREE.Line3();

export const createMochiGeneralCombatRuntime = (
  scene: THREE.Scene
): MochiGeneralCombatRuntime => {
  const skill1Runtime = createMochiGeneralSkill1Runtime(scene);
  const skill2Runtime = createMochiGeneralSkill2Runtime(scene);
  const skill3Runtime = createMochiGeneralSkill3Runtime();
  const skill4Runtime = createMochiGeneralSkill4Runtime(scene);
  const swordThrustStateByEntry = new WeakMap<
    MochiGeneralCombatEntry,
    SwordThrustState
  >();

  const resolveSwordThrustState = (
    entry: MochiGeneralCombatEntry
  ): SwordThrustState => {
    let state = swordThrustStateByEntry.get(entry);
    if (state) return state;
    state = { active: false, hitPlayer: false };
    swordThrustStateByEntry.set(entry, state);
    return state;
  };

  const updateSwordThrustCollision = ({
    entry,
    player,
    applyDamage,
  }: {
    entry: MochiGeneralCombatEntry;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
  }) => {
    const thrustActive =
      entry.swordAttackPoseWeight >= BOSS_SWORD_THRUST_ATTACK_WEIGHT_THRESHOLD &&
      entry.swordHandSwing >= BOSS_SWORD_THRUST_SWING_THRESHOLD &&
      !entry.skill4WindupActive &&
      !entry.skill4SwordActive;
    const state = resolveSwordThrustState(entry);

    if (!thrustActive) {
      state.active = false;
      return;
    }

    if (!state.active) {
      state.active = true;
      state.hitPlayer = false;
    }

    if (state.hitPlayer) return;

    const sword = entry.rig?.sword;
    const swordTip = entry.rig?.swordTip;
    if (!sword || !swordTip) return;

    sword.getWorldPosition(swordBaseWorld);
    swordTip.getWorldPosition(swordTipWorld);
    if (swordBaseWorld.distanceToSquared(swordTipWorld) <= 0.00001) return;

    player.getWorldPosition(playerHitProbeWorld);
    playerHitProbeWorld.y += BOSS_SWORD_THRUST_PLAYER_HEIGHT_OFFSET;

    swordBladeSegment.set(swordBaseWorld, swordTipWorld);
    swordBladeSegment.closestPointToPoint(
      playerHitProbeWorld,
      true,
      swordClosestPoint
    );

    const collisionDistance =
      (BOSS_SWORD_THRUST_BLADE_RADIUS + BOSS_SWORD_THRUST_PLAYER_RADIUS) *
      BOSS_SWORD_THRUST_RANGE_MULTIPLIER;
    if (
      swordClosestPoint.distanceToSquared(playerHitProbeWorld) >
      collisionDistance * collisionDistance
    ) {
      return;
    }

    state.hitPlayer = true;
    applyDamage(BOSS_SWORD_THRUST_DAMAGE);
  };

  return {
    tickBoss: ({
      entry,
      delta,
      player,
      gameEnded,
      isBlocked,
      applyDamage,
      summonSkill3Soldier,
    }) => {
      tickMochiGeneralCombat({
        entry,
        delta,
        player,
        gameEnded,
        isBlocked,
      });
      skill1Runtime.onBossTick(entry, delta, gameEnded);
      skill2Runtime.onBossTick({
        entry,
        delta,
        player,
        gameEnded,
      });
      skill3Runtime.onBossTick({
        entry,
        gameEnded,
        isBlocked,
        summonAt: summonSkill3Soldier,
      });
      skill4Runtime.onBossTick({
        entry,
        gameEnded,
      });
      updateSwordThrustCollision({
        entry,
        player,
        applyDamage,
      });
    },
    update: ({
      now,
      delta,
      player,
      applyDamage,
      applyStatusEffect,
      gameEnded,
      projectileBlockers,
      handleProjectileBlockHit,
    }) => {
      skill1Runtime.update({
        now,
        delta,
        player,
        applyDamage,
        projectileBlockers,
        handleProjectileBlockHit,
      });
      skill2Runtime.update({
        delta,
        player,
        applyDamage,
        applyStatusEffect,
        gameEnded,
      });
      skill4Runtime.update({
        delta,
        player,
        applyDamage,
        gameEnded,
      });
    },
    onBossRemoved: (entry) => {
      skill1Runtime.onBossRemoved(entry);
      skill2Runtime.onBossRemoved(entry);
      skill3Runtime.onBossRemoved(entry);
      skill4Runtime.onBossRemoved(entry);
      swordThrustStateByEntry.delete(entry);
    },
    dispose: () => {
      skill1Runtime.dispose();
      skill2Runtime.dispose();
      skill3Runtime.dispose();
      skill4Runtime.dispose();
    },
  };
};
