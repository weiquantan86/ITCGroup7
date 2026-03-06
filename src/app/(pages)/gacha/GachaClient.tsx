"use client";

import SnackMixer, { type SnackInventory } from "../../components/gachaHandler/SnackMixer";
import type { GachaRateList } from "../../components/gachaHandler/rateConfig";

type GachaClientProps = {
  inventory: SnackInventory;
  rateList: GachaRateList;
};

export default function GachaClient({ inventory, rateList }: GachaClientProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex-1 min-h-0">
        <SnackMixer inventory={inventory} rateList={rateList} />
      </div>
    </div>
  );
}
