import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  PlayerAttackTarget,
  PlayerWorldTickArgs,
} from "../../character/general/player";
import {
  createMadaPresentationController,
  type MadaPresentationState,
} from "./presentation";
import { createMadaAnimationController } from "./animation";
import { createMadaCrawlEffect } from "./crawlEffect";
import { createMadaVanishManager } from "./vanishManager";
import {
  MADA_CRAWL_DAMAGE_RATIO,
  MADA_CRAWL_DETECTION_RANGE,
  MADA_CRAWL_EMIT_INTERVAL_MS,
  isMadaCrawlDamageHit,
  isMadaCrawlStrikeWindow,
  resolveMadaCrawlRuntimeValues,
} from "./skillCrawl";
import { createMadaSkill1Runtime } from "./skill1";
import { createMadaSkill2Runtime } from "./skill2";
import { createMadaSkill3Runtime } from "./skill3";
import { createMadaSkill4Runtime } from "./skill4";
import { createMadaSkill5Runtime } from "./skill5";
import { createMadaSkillShootRuntime } from "./skillShoot";
import { createMadaRageManager } from "./rageManager";
import {
  applyDamageToSlimluThreatOrPlayer,
  resolveSlimluThreatTargetForEnemy,
} from "../../character/slimlu/threatRegistry";
import { normalizeModelToHeight, removeAttackTargetById } from "../unified/runtimeUtils";
import type {
  UnifiedMonsterRuntime,
  UnifiedMonsterRuntimeHost,
  UnifiedMonsterState,
} from "../unified/types";

const MADA_MAX_HEALTH = 2800;
const MADA_RESPAWN_DELAY_MS = 1800;

type MadaCompletenessTier = 1 | 2 | 3;
type MadaRevealSkillName =
  | "shoot"
  | "skill1"
  | "skill2"
  | "skill3"
  | "skill4"
  | "skill5";

const MADA_COMPLETENESS_TIER_DEFAULT: MadaCompletenessTier = 1;

const MADA_COMPLETENESS_CONFIG: Record<
  MadaCompletenessTier,
  {
    vanishIntervalMs: number;
    revealSkillPool: readonly MadaRevealSkillName[];
    baseSpeedMultiplier: number;
    enableRage: boolean;
  }
> = {
  1: {
    vanishIntervalMs: 15_000,
    revealSkillPool: ["shoot"],
    baseSpeedMultiplier: 1,
    enableRage: false,
  },
  2: {
    vanishIntervalMs: 10_000,
    revealSkillPool: ["skill1", "skill3", "shoot"],
    baseSpeedMultiplier: 1,
    enableRage: false,
  },
  3: {
    vanishIntervalMs: 5_000,
    revealSkillPool: ["skill1", "skill2", "skill3", "skill4", "skill5"],
    baseSpeedMultiplier: 1.1,
    enableRage: true,
  },
};

const normalizePositiveMultiplier = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const normalizeMadaCompletenessTier = (value: unknown): MadaCompletenessTier => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MADA_COMPLETENESS_TIER_DEFAULT;
  if (parsed >= 3) return 3;
  if (parsed >= 2) return 2;
  return 1;
};

export const createMadaUnifiedRuntime = (
  host: UnifiedMonsterRuntimeHost
): UnifiedMonsterRuntime => {
  const {
    scene,
    hostGroup,
    resourceTracker,
    spawnPosition,
    bounds,
    isBlocked,
    attackTargets,
    monster,
    runtimeOptions,
  } = host;
  const allowRespawn = runtimeOptions?.respawnOnDefeat !== false;
  const isGameEnded = runtimeOptions?.isGameEnded ?? (() => false);
  const madaConfig = runtimeOptions?.mada;
  const healthMultiplier = normalizePositiveMultiplier(
    madaConfig?.healthMultiplier,
    1
  );
  const damageMultiplier = normalizePositiveMultiplier(
    madaConfig?.damageMultiplier,
    1
  );
  const strikeRangeMultiplier = normalizePositiveMultiplier(
    madaConfig?.strikeRangeMultiplier,
    1
  );
  const completenessTier = normalizeMadaCompletenessTier(
    madaConfig?.completenessTier
  );
  const completenessConfig = MADA_COMPLETENESS_CONFIG[completenessTier];
  const baseSpeedMultiplier = normalizePositiveMultiplier(
    completenessConfig.baseSpeedMultiplier,
    1
  );
  const enableRage = completenessConfig.enableRage;
  const resolvedMaxHealth = Math.max(
    1,
    Math.floor(MADA_MAX_HEALTH * healthMultiplier)
  );
  const {
    damage: resolvedCrawlDamage,
    damageRange: resolvedCrawlDamageRange,
    cooldownMs: resolvedCrawlCooldownMs,
  } = resolveMadaCrawlRuntimeValues({
    strikeRangeMultiplier,
  });

  const runtimeGroup = new THREE.Group();
  runtimeGroup.name = "unified-mada-runtime";
  hostGroup.add(runtimeGroup);

  const madaRig = new THREE.Group();
  madaRig.position.copy(spawnPosition);
  madaRig.name = "unified-mada-rig";
  runtimeGroup.add(madaRig);

  const modelRoot = new THREE.Group();
  modelRoot.name = "unified-mada-model-root";
  madaRig.add(modelRoot);

  const fallbackBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.2, 2.6, 6, 12),
    new THREE.MeshStandardMaterial({
      color: 0x352930,
      roughness: 0.72,
      metalness: 0.08,
    })
  );
  fallbackBody.position.y = 2.5;
  modelRoot.add(fallbackBody);
  resourceTracker.trackMesh(fallbackBody);

  const hitbox = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.25, 2.9, 6, 14),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  hitbox.position.y = 2.5;
  madaRig.add(hitbox);
  resourceTracker.trackMesh(hitbox);

  const madaPresentation = createMadaPresentationController({
    rig: madaRig,
    modelRoot,
  });
  const madaAnimation = createMadaAnimationController({
    rig: madaRig,
  });

  const toTarget = new THREE.Vector3();
  const crawlTraceCurrent = new THREE.Vector3();
  const crawlTracePrevious = new THREE.Vector3();
  const crawlSwipeDirection = new THREE.Vector3();
  let health = resolvedMaxHealth;
  let respawnAt = 0;

  // Crawl skill
  let crawlStartedAt = -1;
  let crawlDurationMs = 0;
  let crawlNextAvailableAt = 0;
  let crawlDamageApplied = false;
  let crawlLastEmitAt = 0;
  let crawlHasTraceSample = false;

  const crawlEffect = createMadaCrawlEffect(scene);
  const skill1Runtime = createMadaSkill1Runtime({
    scene,
    animation: madaAnimation,
  });
  const skill2Runtime = createMadaSkill2Runtime({
    scene,
    animation: madaAnimation,
  });
  const skill3Runtime = createMadaSkill3Runtime({
    scene,
    animation: madaAnimation,
    bounds,
  });
  const skill4Runtime = createMadaSkill4Runtime({
    scene,
    animation: madaAnimation,
  });
  const skill5Runtime = createMadaSkill5Runtime({
    scene,
    animation: madaAnimation,
    bounds,
    isBlocked,
    groundY: spawnPosition.y,
  });
  const shootRuntime = createMadaSkillShootRuntime(scene);
  const vanishManager = createMadaVanishManager({
    bounds,
    isBlocked,
    vanishIntervalMs: completenessConfig.vanishIntervalMs,
  });
  const rageManager = createMadaRageManager({
    scene,
    rig: madaRig,
    maxHealth: resolvedMaxHealth,
    animation: {
      canPlayRage: () => madaAnimation.canPlayRage(),
      triggerRage: () => madaAnimation.triggerRage(),
      isRagePlaying: () => madaAnimation.isRagePlaying(),
    },
  });

  const applyPresentationState = (state: MadaPresentationState) => {
    madaPresentation.applyState(state);
  };

  const tryStartRevealSkill = (
    skill: MadaRevealSkillName,
    revealNow: number
  ): boolean => {
    switch (skill) {
      case "shoot": {
        const shootDurationS = madaAnimation.triggerShoot();
        if (shootDurationS <= 0) return false;
        shootRuntime.beginCast({
          now: revealNow,
          durationMs: shootDurationS * 1000,
        });
        return true;
      }
      case "skill1":
        if (!madaAnimation.canPlaySkill1()) return false;
        return skill1Runtime.beginCast(revealNow);
      case "skill2":
        if (!madaAnimation.canPlaySkill2()) return false;
        return skill2Runtime.beginCast(revealNow, madaRig);
      case "skill3":
        if (!madaAnimation.canPlaySkill3()) return false;
        return skill3Runtime.beginCast(revealNow);
      case "skill4":
        if (!madaAnimation.canPlaySkill4()) return false;
        return skill4Runtime.beginCast(revealNow, madaRig);
      case "skill5":
        if (!madaAnimation.canPlaySkill5()) return false;
        return skill5Runtime.beginCast(revealNow, madaRig);
      default:
        return false;
    }
  };

  const castRevealSkillFromPool = (
    revealNow: number
  ): MadaRevealSkillName | null => {
    const shuffledPool = [...completenessConfig.revealSkillPool];
    for (let i = shuffledPool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffledPool[i];
      shuffledPool[i] = shuffledPool[j];
      shuffledPool[j] = temp;
    }
    for (let i = 0; i < shuffledPool.length; i += 1) {
      const skill = shuffledPool[i];
      if (tryStartRevealSkill(skill, revealNow)) {
        return skill;
      }
    }
    return null;
  };

  applyPresentationState({ mode: "active", fadeAlpha: 1 });

  const resetCrawlState = (now: number) => {
    if (crawlStartedAt >= 0) {
      madaAnimation.setCrawlEnabled(false);
    }
    crawlStartedAt = -1;
    crawlDurationMs = 0;
    crawlNextAvailableAt = now;
    crawlDamageApplied = false;
    crawlLastEmitAt = 0;
    crawlHasTraceSample = false;
  };

  const reset = (now: number) => {
    void now;
    health = resolvedMaxHealth;
    respawnAt = 0;
    madaRig.visible = true;
    madaRig.position.copy(spawnPosition);
    madaRig.rotation.set(0, 0, 0);
    rageManager.reset();
    vanishManager.reset(0);
    resetCrawlState(0);
    skill1Runtime.reset();
    skill2Runtime.reset();
    skill3Runtime.reset();
    skill4Runtime.reset();
    skill5Runtime.reset();
    shootRuntime.reset();
    madaAnimation.resetPose();
    madaAnimation.applyHeadLook(null);
    applyPresentationState({ mode: "active", fadeAlpha: 1 });
  };

  const onDown = (now: number) => {
    health = 0;
    respawnAt = allowRespawn ? now + MADA_RESPAWN_DELAY_MS : 0;
    rageManager.reset();
    vanishManager.reset(0);
    madaRig.visible = false;
    resetCrawlState(0);
    skill1Runtime.reset();
    skill2Runtime.reset();
    skill3Runtime.reset();
    skill4Runtime.reset();
    skill5Runtime.reset();
    shootRuntime.reset();
    applyPresentationState({ mode: "vanished", fadeAlpha: 0 });
  };

  const attackTargetId = "unified-mada";
  const attackTarget: PlayerAttackTarget = {
    id: attackTargetId,
    object: hitbox,
    category: "boss",
    label: monster.label,
    isActive: () => health > 0 && vanishManager.getPhase() !== "hidden",
    getHealth: () => health,
    getMaxHealth: () => resolvedMaxHealth,
    onHit: (hit) => {
      if (health <= 0) return;
      if (enableRage && rageManager.shouldIgnoreIncomingDamage()) return;
      madaPresentation.triggerHitFlash(hit.now);
      health = Math.max(0, health - Math.max(1, Math.floor(hit.damage)));
      if (health <= 0) {
        onDown(hit.now);
        return;
      }
      if (enableRage) {
        rageManager.onHealthChanged(health);
      }
    },
  };
  attackTargets.push(attackTarget);

  const loader = new GLTFLoader();
  let isDisposed = false;
  loader.load(
    monster.path,
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        resourceTracker.disposeObjectResources(gltf.scene);
        return;
      }

      const model = gltf.scene;
      normalizeModelToHeight(model, 5.6);
      while (modelRoot.children.length > 0) {
        modelRoot.remove(modelRoot.children[0]);
      }
      modelRoot.add(model);
      madaPresentation.bindModel(model);
      madaAnimation.bindModel(model);
      madaAnimation.bindAnimations(gltf.animations ?? []);
      resourceTracker.trackObject(model, {
        castShadow: true,
        receiveShadow: true,
      });
    },
    undefined,
    () => {}
  );

  return {
    tick: ({
      now,
      delta,
      player,
      applyDamage,
      projectileBlockers,
      handleProjectileBlockHit,
    }: PlayerWorldTickArgs) => {
      if (health <= 0) {
        rageManager.updateParticles(delta, false);
        crawlEffect.update(delta);
        if (allowRespawn && respawnAt > 0 && now >= respawnAt) {
          reset(now);
        }
        return;
      }
      if (isGameEnded()) {
        skill1Runtime.reset();
        skill2Runtime.reset();
        skill3Runtime.reset();
        skill4Runtime.reset();
        skill5Runtime.reset();
        shootRuntime.reset();
        madaAnimation.stopTransientAnimations();
        madaAnimation.resetPose();
        madaAnimation.applyHeadLook(null);
        rageManager.updateParticles(delta, false);
        madaAnimation.update(delta);
        crawlEffect.update(delta);
        return;
      }

      const { scaledDelta, now: combatNow } =
        rageManager.advanceCombatTime(delta * baseSpeedMultiplier);
      const resolvedTarget = resolveSlimluThreatTargetForEnemy({
        fallbackTarget: player,
        enemyObject: madaRig,
      });
      const applyMadaDamage = (amount: number) => {
        const scaledDamage = Math.max(
          1,
          Math.floor((Number.isFinite(amount) ? amount : 0) * damageMultiplier)
        );
        const resolved = enableRage
          ? rageManager.resolveDamage(scaledDamage)
          : scaledDamage;
        return applyDamageToSlimluThreatOrPlayer({
          target: resolvedTarget,
          amount: Math.max(1, Math.floor(resolved)),
          applyPlayerDamage: applyDamage,
        });
      };

      resolvedTarget.getWorldPosition(toTarget);
      const dx = toTarget.x - madaRig.position.x;
      const dz = toTarget.z - madaRig.position.z;
      if (Math.abs(dx) > 0.0001 || Math.abs(dz) > 0.0001) {
        madaRig.rotation.y = Math.atan2(dx, dz);
      }

      const planarDistance = Math.hypot(dx, dz);

      // Crawl skill
      let crawlElapsedMs = crawlStartedAt >= 0 ? combatNow - crawlStartedAt : -1;
      let crawlActive = crawlElapsedMs >= 0 && crawlElapsedMs < crawlDurationMs;
      let skill1Active = skill1Runtime.isCasting();
      let skill2Active = skill2Runtime.isCasting();
      let skill3Active = skill3Runtime.isCasting();
      let skill4Active = skill4Runtime.isCasting();
      let skill5Active = skill5Runtime.isCasting();
      let shootActive = shootRuntime.isCasting();
      let ragePlaying = enableRage && rageManager.isRagePlaying();

      // Auto-end crawl when its clip finishes
      if (!crawlActive && crawlStartedAt >= 0) {
        madaAnimation.setCrawlEnabled(false);
        crawlStartedAt = -1;
        crawlDamageApplied = false;
      }

      const vanishState = vanishManager.update({
        now: combatNow,
        skillActive:
          crawlActive ||
          skill1Active ||
          skill2Active ||
          skill3Active ||
          skill4Active ||
          skill5Active ||
          shootActive ||
          ragePlaying ||
          (enableRage && rageManager.blocksSkillStart()),
        fallbackPosition: madaRig.position,
        groundY: spawnPosition.y,
        playLookup: () => madaAnimation.triggerLookup(),
        isLookupPlaying: () => madaAnimation.isLookupPlaying(),
        hide: () => {
          madaAnimation.stopTransientAnimations();
          resetCrawlState(combatNow);
          skill1Runtime.reset();
          skill2Runtime.reset();
          skill3Runtime.reset();
          skill4Runtime.reset();
          skill5Runtime.reset();
          shootRuntime.reset();
          madaAnimation.applyHeadLook(null);
        },
        revealAt: (position, revealNow) => {
          madaRig.position.copy(position);
          madaRig.rotation.set(0, 0, 0);
          madaAnimation.stopTransientAnimations();
          madaAnimation.resetPose();
          madaAnimation.applyHeadLook(null);
          if (enableRage && rageManager.onReveal()) {
            return;
          }
          const revealSkill = castRevealSkillFromPool(revealNow);
          if (revealSkill === "shoot") {
            shootActive = true;
          } else if (revealSkill === "skill1") {
            skill1Active = true;
          } else if (revealSkill === "skill2") {
            skill2Active = true;
          } else if (revealSkill === "skill3") {
            skill3Active = true;
          } else if (revealSkill === "skill4") {
            skill4Active = true;
          } else if (revealSkill === "skill5") {
            skill5Active = true;
          }
        },
      });

      if (vanishState.phase === "fading") {
        applyPresentationState({
          mode: "vanishing",
          fadeAlpha: vanishState.fadeAlpha,
        });
      } else if (vanishState.hidden) {
        applyPresentationState({ mode: "vanished", fadeAlpha: 0 });
      } else {
        applyPresentationState({ mode: "active", fadeAlpha: 1 });
      }

      if (enableRage) {
        rageManager.updateSequence({
          allowAnimationTrigger: !vanishState.hidden,
          requestVanish: () =>
            vanishManager.requestVanishNow(combatNow, { skipLookup: true }),
        });
      }
      ragePlaying = enableRage && rageManager.isRagePlaying();

      if (vanishState.hidden) {
        madaAnimation.applyHeadLook(null);
        rageManager.updateParticles(scaledDelta, false);
        madaAnimation.update(scaledDelta);
        skill1Runtime.tick({
          now: combatNow,
          delta: scaledDelta,
          rig: madaRig,
          player: resolvedTarget,
          applyDamage: applyMadaDamage,
          projectileBlockers,
          handleProjectileBlockHit,
        });
        skill2Runtime.tick({
          now: combatNow,
          delta: scaledDelta,
          rig: madaRig,
          player: resolvedTarget,
          applyDamage: applyMadaDamage,
        });
        skill3Runtime.tick({
          now: combatNow,
          delta: scaledDelta,
          rig: madaRig,
          player: resolvedTarget,
          applyDamage: applyMadaDamage,
        });
        skill4Runtime.tick({
          now: combatNow,
          delta: scaledDelta,
          rig: madaRig,
          player: resolvedTarget,
          applyDamage: applyMadaDamage,
        });
        skill5Runtime.tick({
          now: combatNow,
          delta: scaledDelta,
          rig: madaRig,
          player: resolvedTarget,
          applyDamage: applyMadaDamage,
        });
        if (skill5Runtime.consumeCastFailed()) {
          vanishManager.requestVanishNow(combatNow);
        }
        shootRuntime.tick({
          now: combatNow,
          delta: scaledDelta,
          rig: madaRig,
          player: resolvedTarget,
          applyDamage: applyMadaDamage,
          projectileBlockers,
          handleProjectileBlockHit,
          getHandLFrontWorldPosition: (target, forwardOffset) =>
            madaAnimation.getHandLFrontWorldPosition(target, forwardOffset),
          isShootPlaying: () => madaAnimation.isShootPlaying(),
        });
        crawlEffect.update(scaledDelta);
        return;
      }

      const lookupActive = madaAnimation.isLookupPlaying();
      const shootPlaying = madaAnimation.isShootPlaying();
      const skill1Playing = madaAnimation.isSkill1Playing();
      const skill2Playing = madaAnimation.isSkill2Playing();
      const skill3Playing = madaAnimation.isSkill3Playing();
      const skill4Playing = madaAnimation.isSkill4Playing();
      const skill5Playing = madaAnimation.isSkill5Playing();
      ragePlaying = enableRage && rageManager.isRagePlaying();
      if (
        lookupActive ||
        shootPlaying ||
        skill1Playing ||
        skill2Playing ||
        skill3Playing ||
        skill4Playing ||
        skill5Playing ||
        ragePlaying
      ) {
        madaAnimation.applyHeadLook(null);
      } else {
        toTarget.y += 1.45;
        madaAnimation.applyHeadLook(toTarget);
      }

      // Trigger crawl: player detected within range, cooldown expired
      if (
        !vanishState.blockNewSkills &&
        !lookupActive &&
        !skill1Playing &&
        !skill2Playing &&
        !skill3Playing &&
        !skill4Playing &&
        !skill5Playing &&
        !ragePlaying &&
        !shootPlaying &&
        !skill1Active &&
        !skill2Active &&
        !skill3Active &&
        !skill4Active &&
        !skill5Active &&
        !shootActive &&
        !crawlActive &&
        combatNow >= crawlNextAvailableAt &&
        planarDistance <= MADA_CRAWL_DETECTION_RANGE
      ) {
        const dur = madaAnimation.triggerCrawl();
        if (dur > 0) {
          crawlStartedAt = combatNow;
          crawlDurationMs = dur * 1000;
          crawlNextAvailableAt = combatNow + resolvedCrawlCooldownMs;
          crawlDamageApplied = false;
          crawlLastEmitAt = 0;
          crawlHasTraceSample = false;
          crawlElapsedMs = 0;
          crawlActive = true;
        }
      }

      // Crawl clip owns the skeleton while active.
      if (
        !crawlActive &&
        !lookupActive &&
        !shootPlaying &&
        !skill1Playing &&
        !skill2Playing &&
        !skill3Playing &&
        !skill4Playing &&
        !skill5Playing &&
        !ragePlaying
      ) {
        madaAnimation.resetPose();
      }

      rageManager.updateParticles(
        scaledDelta,
        enableRage && rageManager.isRageActive()
      );
      madaAnimation.update(scaledDelta);
      madaRig.updateMatrixWorld(true);
      skill1Runtime.tick({
        now: combatNow,
        delta: scaledDelta,
        rig: madaRig,
        player: resolvedTarget,
        applyDamage: applyMadaDamage,
        projectileBlockers,
        handleProjectileBlockHit,
      });
      skill2Runtime.tick({
        now: combatNow,
        delta: scaledDelta,
        rig: madaRig,
        player: resolvedTarget,
        applyDamage: applyMadaDamage,
      });
      skill3Runtime.tick({
        now: combatNow,
        delta: scaledDelta,
        rig: madaRig,
        player: resolvedTarget,
        applyDamage: applyMadaDamage,
      });
      skill4Runtime.tick({
        now: combatNow,
        delta: scaledDelta,
        rig: madaRig,
        player: resolvedTarget,
        applyDamage: applyMadaDamage,
      });
      skill5Runtime.tick({
        now: combatNow,
        delta: scaledDelta,
        rig: madaRig,
        player: resolvedTarget,
        applyDamage: applyMadaDamage,
      });
      if (skill5Runtime.consumeCastFailed()) {
        vanishManager.requestVanishNow(combatNow);
      }
      shootRuntime.tick({
        now: combatNow,
        delta: scaledDelta,
        rig: madaRig,
        player: resolvedTarget,
        applyDamage: applyMadaDamage,
        projectileBlockers,
        handleProjectileBlockHit,
        getHandLFrontWorldPosition: (target, forwardOffset) =>
          madaAnimation.getHandLFrontWorldPosition(target, forwardOffset),
        isShootPlaying: () => madaAnimation.isShootPlaying(),
      });

      // Crawl VFX + damage
      if (crawlActive && crawlDurationMs > 0) {
        const progress = crawlElapsedMs / crawlDurationMs;

        if (isMadaCrawlStrikeWindow(progress)) {
          // Emit slash/tear VFX from the right claw, throttled by interval
          if (combatNow - crawlLastEmitAt >= MADA_CRAWL_EMIT_INTERVAL_MS) {
            const hasHandLTrace = madaAnimation.getHandLFrontWorldPosition(
              crawlTraceCurrent
            );
            if (hasHandLTrace && crawlHasTraceSample) {
              crawlSwipeDirection
                .copy(crawlTraceCurrent)
                .sub(crawlTracePrevious);
              const traceDistance = crawlSwipeDirection.length();
              if (traceDistance > 0.0001) {
                crawlSwipeDirection.multiplyScalar(1 / traceDistance);
                crawlEffect.emitTearTrail(
                  crawlTracePrevious,
                  crawlTraceCurrent,
                  crawlSwipeDirection
                );
              }
              crawlTracePrevious.copy(crawlTraceCurrent);
            } else if (hasHandLTrace) {
              // First trace sample during strike window: cache only.
              crawlTracePrevious.copy(crawlTraceCurrent);
            }
            crawlHasTraceSample = hasHandLTrace;
            crawlLastEmitAt = combatNow;
          }

          // Damage once per crawl – delayed to mid-strike for better feel.
          // Uses the reference bone world position as the hit-check origin.
          if (!crawlDamageApplied && progress >= MADA_CRAWL_DAMAGE_RATIO) {
            const refPos = new THREE.Vector3();
            const checkPos = new THREE.Vector3();
            if (madaAnimation.getGrabReferenceWorldPosition(refPos)) {
              checkPos.copy(refPos);
            } else {
              madaAnimation.getRightClawWorldPosition(checkPos);
            }
            resolvedTarget.getWorldPosition(toTarget);
            if (
              isMadaCrawlDamageHit({
                strikeOrigin: checkPos,
                target: toTarget,
                maxRange: resolvedCrawlDamageRange,
              })
            ) {
              applyMadaDamage(resolvedCrawlDamage);
            }
            crawlDamageApplied = true;
          }
        }
      }

      crawlEffect.update(scaledDelta);
    },
    reset,
    getState: (): UnifiedMonsterState => ({
      monsterId: monster.id,
      monsterLabel: monster.label,
      monsterHealth: Math.max(0, Math.floor(health)),
      monsterMaxHealth: resolvedMaxHealth,
      monsterAlive: health > 0,
    }),
    dispose: () => {
      isDisposed = true;
      removeAttackTargetById(attackTargets, attackTargetId);
      rageManager.dispose();
      crawlEffect.dispose();
      skill1Runtime.dispose();
      skill2Runtime.dispose();
      skill3Runtime.dispose();
      skill4Runtime.dispose();
      skill5Runtime.dispose();
      shootRuntime.dispose();
      if (runtimeGroup.parent) {
        runtimeGroup.parent.remove(runtimeGroup);
      }
    },
  };
};
