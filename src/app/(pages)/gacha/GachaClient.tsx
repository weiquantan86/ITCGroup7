"use client";

import { useEffect, useRef, useState } from "react";
import SnackMixer, { type SnackInventory } from "../../components/gachaHandler/SnackMixer";
import type { GachaRateList } from "../../components/gachaHandler/rateConfig";

type GachaClientProps = {
  inventory: SnackInventory;
  rateList: GachaRateList;
};

const GACHA_STAGE_BASE_WIDTH = 1760;
const GACHA_STAGE_BASE_HEIGHT = 1040;

export default function GachaClient({ inventory, rateList }: GachaClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width <= 0 || height <= 0) return;

      // Calculate scale to fit either width or height
      const scaleW = width / GACHA_STAGE_BASE_WIDTH;
      const scaleH = height / GACHA_STAGE_BASE_HEIGHT;
      
      // We use the smaller scale to ensure it fits completely
      const nextScale = Math.min(scaleW, scaleH, 1);
      
      setStageScale((current) =>
        Math.abs(current - nextScale) < 0.001 ? current : nextScale
      );
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(container);
    window.addEventListener("resize", updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full min-h-0 min-w-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: `${GACHA_STAGE_BASE_WIDTH}px`,
          height: `${GACHA_STAGE_BASE_HEIGHT}px`,
          transform: `translate(-50%, -50%) scale(${stageScale})`,
          transformOrigin: "center center",
        }}
      >
        <SnackMixer inventory={inventory} rateList={rateList} />
      </div>
    </div>
  );
}
