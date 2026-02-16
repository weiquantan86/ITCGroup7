import type { CharacterStats, SkillKey } from "../types";

export type StatusHud = {
  setStats: (current: CharacterStats, max: CharacterStats) => void;
  setSkillCooldowns: (
    cooldowns: Record<SkillKey, number>,
    durations: Record<SkillKey, number>
  ) => void;
  triggerDamageFlash: () => void;
  dispose: () => void;
};

export const createStatusHud = (
  mount?: HTMLElement,
  options?: { showMiniMap?: boolean }
): StatusHud => {
  if (!mount) {
    return {
      setStats: () => {},
      setSkillCooldowns: () => {},
      triggerDamageFlash: () => {},
      dispose: () => {},
    };
  }

  const host = mount.parentElement ?? mount;
  if (!host.style.position) {
    host.style.position = "relative";
  }

  const hud = document.createElement("div");
  hud.style.cssText =
    "position:absolute;left:16px;top:16px;z-index:6;display:flex;" +
    "flex-direction:column;gap:6px;padding:10px 12px;border-radius:12px;" +
    "background:rgba(2,6,23,0.55);border:1px solid rgba(148,163,184,0.25);" +
    "box-shadow:0 10px 28px rgba(2,6,23,0.6);pointer-events:none;";

  const createBar = (label: string, fill: string, glow: string) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;min-width:320px;";
    const text = document.createElement("span");
    text.textContent = label;
    text.style.cssText =
      "width:26px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;" +
      "color:rgba(226,232,240,0.9);";
    const value = document.createElement("span");
    value.textContent = "0/0";
    value.style.cssText =
      "min-width:58px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;" +
      "color:rgba(226,232,240,0.85);";
    const track = document.createElement("div");
    track.style.cssText =
      "position:relative;flex:1;height:10px;border-radius:999px;overflow:hidden;" +
      "background:rgba(15,23,42,0.85);border:1px solid rgba(148,163,184,0.2);";
    const fillBar = document.createElement("div");
    fillBar.style.cssText =
      `height:100%;width:100%;background:${fill};` +
      `box-shadow:0 0 12px ${glow};transition:width 120ms ease;`;
    track.appendChild(fillBar);
    row.append(text, track, value);
    return { row, fillBar, value };
  };

  const healthBar = createBar("HP", "#ef4444", "rgba(239,68,68,0.65)");
  const manaBar = createBar("MP", "#38bdf8", "rgba(56,189,248,0.6)");
  const energyBar = createBar("EN", "#22c55e", "rgba(34,197,94,0.62)");
  hud.append(healthBar.row, manaBar.row, energyBar.row);

  const cooldownPanel = document.createElement("div");
  cooldownPanel.style.cssText =
    "position:absolute;right:16px;z-index:6;display:flex;flex-direction:column;" +
    "gap:8px;padding:9px;border-radius:14px;" +
    "background:rgba(2,6,23,0.52);border:1px solid rgba(148,163,184,0.24);" +
    "box-shadow:0 10px 24px rgba(2,6,23,0.58);pointer-events:none;";

  const createCooldownCard = (label: SkillKey) => {
    const shell = document.createElement("div");
    shell.style.cssText =
      "position:relative;width:52px;height:52px;border-radius:14px;overflow:hidden;" +
      "border:1px solid rgba(148,163,184,0.28);background:rgba(15,23,42,0.75);";

    const fan = document.createElement("div");
    fan.style.cssText =
      "position:absolute;inset:0;opacity:0;border-radius:14px;" +
      "background:conic-gradient(from -90deg, rgba(2,6,23,0.86) 360deg, rgba(2,6,23,0.05) 360deg);";

    const keyLabel = document.createElement("span");
    keyLabel.textContent = label.toUpperCase();
    keyLabel.style.cssText =
      "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);" +
      "z-index:1;font-size:22px;letter-spacing:0.08em;line-height:1;font-weight:800;" +
      "color:rgba(191,219,254,0.95);text-shadow:0 0 12px rgba(59,130,246,0.4);";

    const time = document.createElement("span");
    time.style.cssText =
      "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);" +
      "z-index:2;font-size:15px;font-variant-numeric:tabular-nums;font-weight:700;color:#f8fafc;";

    shell.append(fan, time, keyLabel);
    cooldownPanel.appendChild(shell);
    return { shell, fan, keyLabel, time };
  };

  const cooldownCards = {
    q: createCooldownCard("q"),
    e: createCooldownCard("e"),
    r: createCooldownCard("r"),
  };

  const miniMapMargin = 14;
  const cooldownGapBelowMini = 16;
  const updateCooldownPanelPosition = () => {
    if (options?.showMiniMap === false) {
      cooldownPanel.style.top = "16px";
      return;
    }
    const minEdge = Math.min(host.clientWidth || 0, host.clientHeight || 0);
    const miniSize = Math.max(120, Math.floor(minEdge * 0.25));
    const top = miniMapMargin + miniSize + cooldownGapBelowMini;
    cooldownPanel.style.top = `${top}px`;
  };

  const handleResize = () => {
    updateCooldownPanelPosition();
  };

  window.addEventListener("resize", handleResize);
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      updateCooldownPanelPosition();
    });
    resizeObserver.observe(host);
  }

  const damageOverlay = document.createElement("div");
  damageOverlay.style.cssText =
    "position:absolute;inset:0;z-index:7;pointer-events:none;background:#ef4444;opacity:0;";

  host.append(hud, cooldownPanel, damageOverlay);
  updateCooldownPanelPosition();

  const updateFill = (
    fillBar: HTMLDivElement,
    value: HTMLSpanElement,
    current: number,
    max: number
  ) => {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    fillBar.style.width = `${Math.round(ratio * 100)}%`;
    value.textContent = `${Math.max(0, Math.round(current))}/${Math.max(
      0,
      Math.round(max)
    )}`;
  };

  const formatCooldownText = (remaining: number) => {
    if (remaining <= 0.04) return "";
    if (remaining >= 10) {
      return `${Math.ceil(remaining)}`;
    }
    return (Math.ceil(remaining * 10) / 10).toFixed(1).replace(/\.0$/, "");
  };

  const setCooldownCard = (
    key: SkillKey,
    remaining: number,
    duration: number
  ) => {
    const card = cooldownCards[key];
    if (!card) return;
    const resolvedRemaining = Math.max(0, remaining);
    const resolvedDuration = Math.max(0, duration);
    const ratio =
      resolvedDuration > 0
        ? Math.min(1, resolvedRemaining / resolvedDuration)
        : resolvedRemaining > 0
        ? 1
        : 0;

    if (ratio <= 0.001) {
      card.fan.style.opacity = "0";
      card.time.textContent = "";
      card.keyLabel.style.opacity = "1";
      card.shell.style.borderColor = "rgba(74,222,128,0.45)";
      return;
    }

    const sweep = Math.max(1, Math.round(ratio * 360));
    card.fan.style.opacity = "1";
    card.fan.style.background =
      `conic-gradient(from -90deg, rgba(2,6,23,0.86) 0deg ${sweep}deg, ` +
      `rgba(2,6,23,0.08) ${sweep}deg 360deg)`;
    card.keyLabel.style.opacity = "0.42";
    card.time.textContent = formatCooldownText(resolvedRemaining);
    card.shell.style.borderColor = `rgba(251,146,60,${0.32 + ratio * 0.45})`;
  };

  const triggerDamageFlash = () => {
    damageOverlay.style.transition = "opacity 0ms linear";
    damageOverlay.style.opacity = "0.2";
    void damageOverlay.offsetHeight;
    damageOverlay.style.transition = "opacity 140ms ease-out";
    damageOverlay.style.opacity = "0";
  };

  return {
    setStats: (current: CharacterStats, max: CharacterStats) => {
      updateFill(healthBar.fillBar, healthBar.value, current.health, max.health);
      updateFill(manaBar.fillBar, manaBar.value, current.mana, max.mana);
      updateFill(energyBar.fillBar, energyBar.value, current.energy, max.energy);
    },
    setSkillCooldowns: (cooldowns, durations) => {
      setCooldownCard("q", cooldowns.q, durations.q);
      setCooldownCard("e", cooldowns.e, durations.e);
      setCooldownCard("r", cooldowns.r, durations.r);
    },
    triggerDamageFlash,
    dispose: () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
      hud.parentElement?.removeChild(hud);
      cooldownPanel.parentElement?.removeChild(cooldownPanel);
      damageOverlay.parentElement?.removeChild(damageOverlay);
    },
  };
};
