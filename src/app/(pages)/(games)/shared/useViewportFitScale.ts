"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

type UseViewportFitScaleOptions = {
  enabled?: boolean;
  minScale?: number;
  maxScale?: number;
};

type UseViewportFitScaleResult = {
  viewportRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  scale: number;
  scaledStyle: CSSProperties;
};

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export const useViewportFitScale = (
  options?: UseViewportFitScaleOptions
): UseViewportFitScaleResult => {
  const enabled = options?.enabled ?? true;
  const minScale = options?.minScale ?? 0.45;
  const maxScale = options?.maxScale ?? 1;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!enabled) {
      setScale(1);
      return;
    }

    let rafId = 0;
    const updateScale = () => {
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content) return;
      const availableHeight = viewport.clientHeight;
      const contentHeight = content.scrollHeight;
      if (availableHeight <= 0 || contentHeight <= 0) {
        setScale(1);
        return;
      }
      const nextScale = clamp(availableHeight / contentHeight, minScale, maxScale);
      setScale((previous) =>
        Math.abs(previous - nextScale) < 0.001 ? previous : nextScale
      );
    };

    const scheduleUpdate = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(updateScale);
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleUpdate();
          })
        : null;

    if (viewportRef.current) resizeObserver?.observe(viewportRef.current);
    if (contentRef.current) resizeObserver?.observe(contentRef.current);
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [enabled, maxScale, minScale]);

  const scaledStyle = useMemo<CSSProperties>(
    () => ({
      transform: `scale(${scale})`,
      transformOrigin: "top center",
      willChange: enabled ? "transform" : undefined,
    }),
    [enabled, scale]
  );

  return {
    viewportRef,
    contentRef,
    scale,
    scaledStyle,
  };
};
