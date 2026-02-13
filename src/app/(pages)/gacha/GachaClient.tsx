"use client";

import { useState } from "react";
import CharacterScene from "../characterManagement/characterScene/CharacterScene";
import { RARITY_CONFIG, Rarity } from "../../asset/entity/character/gacha/gachaConfig";

type GachaResult = {
  id: string;
  name: string;
  rarity: Rarity;
  rarityLabel: string;
  rarityColor: string;
  pathToken: string;
} | null;

export default function GachaClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GachaResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRoll = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setResult(null);

    try {
      const res = await fetch("/api/gacha/roll", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to roll");
      }

      if (data.allUnlocked) {
        setMessage(data.message);
      } else if (data.success && data.character) {
        setResult(data.character);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-[22px] border border-slate-200/25 bg-[#0f151f]/90 px-6 py-5 shadow-[0_0_24px_rgba(90,140,220,0.16)]">
        <div className="h-10 w-10 rounded-full border border-slate-200/30 bg-[#0b1119]/90" />
        <h1 className="text-5xl font-semibold tracking-[0.18em] text-slate-100">
          RECRUIT
        </h1>
        <div className="h-10 w-10 rounded-full border border-slate-200/30 bg-[#0b1119]/90" />
      </div>

      {/* Main Display */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center rounded-[28px] border border-slate-200/20 bg-[#0f151f]/90 p-5 shadow-[0_0_30px_rgba(90,140,220,0.18)] overflow-hidden">
        
        {/* Result Scene */}
        {result ? (
          <div className="relative h-full w-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
            <div className="absolute inset-0 z-0">
               <CharacterScene
                  characterPath={`/assets/characters${result.pathToken}${result.id}.glb`}
                  className="h-full w-full"
                />
            </div>
            
            <div className="z-10 mt-auto mb-10 flex flex-col items-center gap-2">
                <div 
                  className="px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider shadow-lg border border-white/20"
                  style={{ backgroundColor: result.rarityColor, color: '#000' }}
                >
                    {result.rarityLabel}
                </div>
                <h2 className="text-6xl font-bold text-white drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                    {result.name}
                </h2>
                <p className="text-slate-300 font-medium tracking-widest uppercase text-sm bg-black/50 px-3 py-1 rounded-md backdrop-blur-sm">
                    New Character Unlocked
                </p>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4 z-10">
             <div className="text-slate-400 text-lg">
                {loading ? "Initiating neural link..." : message || "Ready to recruit new agents."}
             </div>
             {loading && (
                 <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"/>
             )}
          </div>
        )}

        {/* Background Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:40px_40px]" />
      </div>

      {/* Controls */}
      <div className="flex justify-center p-4">
        <button
          onClick={handleRoll}
          disabled={loading || !!message}
          className={`
            relative group overflow-hidden rounded-full px-12 py-4 font-bold tracking-widest text-lg transition-all duration-300
            ${loading || message 
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700" 
                : "bg-white text-black hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] border border-white"
            }
          `}
        >
          <span className="relative z-10">
            {loading ? "SCANNING..." : message ? "COMPLETE" : "RECRUIT AGENT"}
          </span>
          {!loading && !message && (
             <div className="absolute inset-0 bg-sky-300/0 group-hover:bg-sky-300/20 transition-colors" />
          )}
        </button>
      </div>
      
      {/* Error Toast */}
      {error && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-xl backdrop-blur-md border border-red-400/50">
          {error}
        </div>
      )}
    </div>
  );
}

