import type { CharacterStats } from "../types";

export type StatusHud = {
  setStats: (current: CharacterStats, max: CharacterStats) => void;
  dispose: () => void;
};

export const createStatusHud = (mount?: HTMLElement): StatusHud => {
  if (!mount) {
    return { setStats: () => {}, dispose: () => {} };
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
  hud.append(healthBar.row, manaBar.row);
  host.appendChild(hud);

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

  return {
    setStats: (current: CharacterStats, max: CharacterStats) => {
      updateFill(healthBar.fillBar, healthBar.value, current.health, max.health);
      updateFill(manaBar.fillBar, manaBar.value, current.mana, max.mana);
    },
    dispose: () => {
      hud.parentElement?.removeChild(hud);
    },
  };
};
