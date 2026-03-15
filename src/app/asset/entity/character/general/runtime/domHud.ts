export type BasicChargeHud = {
  setVisible: (visible: boolean) => void;
  setRatio: (ratio: number) => void;
  dispose: () => void;
};

type SvgHudElementsArgs = {
  mount?: HTMLElement;
  containerStyle: string;
  viewBox: string;
  width: string;
  height: string;
};

export const createNoopChargeHud = <T extends object = {}>(extras?: T) =>
  ({
    setVisible: () => {},
    setRatio: () => {},
    dispose: () => {},
    ...(extras ?? {}),
  }) as BasicChargeHud & T;

export const createSvgHudElements = ({
  mount,
  containerStyle,
  viewBox,
  width,
  height,
}: SvgHudElementsArgs) => {
  if (!mount || typeof document === "undefined") {
    return null;
  }

  const host = mount.parentElement ?? mount;
  if (!host.style.position) {
    host.style.position = "relative";
  }

  const container = document.createElement("div");
  container.style.cssText = containerStyle;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  container.appendChild(svg);
  host.appendChild(container);

  return { container, svg };
};
