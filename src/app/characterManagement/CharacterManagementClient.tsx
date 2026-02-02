"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import CharacterScene from "./characterScene/CharacterScene";

type CharacterCard = {
  id: string;
  name: string;
  path?: string;
  locked?: boolean;
};

const characterCards: CharacterCard[] = [
  { id: "adam", name: "Adam", path: "/assets/characters/adam/adam.glb" },
  { id: "baron", name: "Baron", path: "/assets/characters/baron/baron.glb" },
  { id: "carrot", name: "Carrot", path: "/assets/characters/carrot/carrot.glb" },
  { id: "locked-1", name: "Unknown", locked: true },
  { id: "locked-2", name: "Unknown", locked: true },
];

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 text-slate-200/70"
    >
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" />
    </svg>
  );
}

type CharacterManagementClientProps = {
  onSelectCharacter?: (id: string) => void;
};

export default function CharacterManagementClient({
  onSelectCharacter,
}: CharacterManagementClientProps) {
  const selectable = useMemo(
    () => characterCards.filter((card) => !card.locked),
    []
  );
  const [selectedId, setSelectedId] = useState(selectable[0]?.id ?? "");
  const selected = characterCards.find((card) => card.id === selectedId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const selectorPanelRef = useRef<HTMLDivElement | null>(null);
  const [scrollbar, setScrollbar] = useState({
    thumbWidth: 100,
    thumbLeft: 0,
  });

  const updateScrollbar = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
    if (maxScroll <= 0) {
      setScrollbar({ thumbWidth: 100, thumbLeft: 0 });
      return;
    }
    const thumbWidth = (scrollEl.clientWidth / scrollEl.scrollWidth) * 100;
    const thumbLeft = (scrollEl.scrollLeft / maxScroll) * (100 - thumbWidth);
    setScrollbar({ thumbWidth, thumbLeft });
  }, []);

  const scrollToRatio = useCallback((ratio: number) => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
    if (maxScroll <= 0) return;
    const clamped = Math.min(Math.max(ratio, 0), 1);
    scrollEl.scrollLeft = clamped * maxScroll;
  }, []);

  const handleTrackPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const trackEl = trackRef.current;
      const scrollEl = scrollRef.current;
      if (!trackEl || !scrollEl) return;
      const rect = trackEl.getBoundingClientRect();
      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      if (maxScroll <= 0) return;
      const thumbWidthPx = (scrollbar.thumbWidth / 100) * rect.width;
      const clickX = event.clientX - rect.left;
      const targetLeft = Math.min(
        Math.max(clickX - thumbWidthPx / 2, 0),
        rect.width - thumbWidthPx
      );
      const ratio = targetLeft / (rect.width - thumbWidthPx || 1);
      scrollToRatio(ratio);
    },
    [scrollToRatio, scrollbar.thumbWidth]
  );

  const handleThumbPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const trackEl = trackRef.current;
      const scrollEl = scrollRef.current;
      if (!trackEl || !scrollEl) return;
      const rect = trackEl.getBoundingClientRect();
      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      if (maxScroll <= 0) return;
      const thumbWidthPx = (scrollbar.thumbWidth / 100) * rect.width;
      const available = rect.width - thumbWidthPx;
      const startX = event.clientX;
      const startScroll = scrollEl.scrollLeft;

      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const ratio = delta / (available || 1);
        const nextScroll = startScroll + ratio * maxScroll;
        scrollEl.scrollLeft = Math.min(Math.max(nextScroll, 0), maxScroll);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [scrollbar.thumbWidth]
  );

  useEffect(() => {
    updateScrollbar();
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(scrollEl);
    return () => observer.disconnect();
  }, [updateScrollbar]);

  useEffect(() => {
    if (!selectedId) return;
    onSelectCharacter?.(selectedId);
  }, [onSelectCharacter, selectedId]);

  useEffect(() => {
    const panel = selectorPanelRef.current;
    if (!panel) return;
    const container = document.getElementById("character-management-shell");
    if (!container) return;

    const updateHeight = () => {
      const height = Math.round(panel.getBoundingClientRect().height);
      container.style.setProperty(
        "--character-selector-height",
        `${height}px`
      );
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      container.style.removeProperty("--character-selector-height");
    };
  }, []);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-6">
      <div className="flex items-center justify-between rounded-[22px] border border-slate-200/25 bg-[#0f151f]/90 px-6 py-5 shadow-[0_0_24px_rgba(90,140,220,0.16)]">
        <div className="h-10 w-10 rounded-full border border-slate-200/30 bg-[#0b1119]/90" />
        <h1 className="text-5xl font-semibold tracking-[0.18em] text-slate-100">
          {selected?.name ?? "Character"}
        </h1>
        <div className="h-10 w-10 rounded-full border border-slate-200/30 bg-[#0b1119]/90" />
      </div>

      <div className="relative flex min-h-0 flex-1 rounded-[28px] border border-slate-200/20 bg-[#0f151f]/90 p-5 shadow-[0_0_30px_rgba(90,140,220,0.18)]">
        <div className="absolute inset-6 rounded-[20px] border border-slate-200/15" />
        <div className="relative z-10 h-full w-full">
          <CharacterScene
            characterPath={selected?.path}
            className="h-full w-full border border-slate-200/15 bg-[#0b1119]/90 shadow-[0_0_24px_rgba(90,140,220,0.18)]"
          />
        </div>
      </div>

      <div
        ref={selectorPanelRef}
        className="rounded-[22px] border border-slate-200/20 bg-[#0f151f]/90 p-5 shadow-[0_0_20px_rgba(90,140,220,0.14)]"
      >
        <div className="flex items-center gap-3">
          <div
            ref={trackRef}
            role="scrollbar"
            aria-controls="character-scroll"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(scrollbar.thumbLeft)}
            className="relative h-2 w-full cursor-pointer rounded-full bg-slate-200/10"
            onPointerDown={handleTrackPointerDown}
          >
            <div
              className="absolute top-0 h-full rounded-full bg-slate-100/40"
              style={{
                width: `${scrollbar.thumbWidth}%`,
                left: `${scrollbar.thumbLeft}%`,
              }}
              onPointerDown={handleThumbPointerDown}
            />
          </div>
          <span className="sr-only">Scroll bar</span>
        </div>
        <div
          id="character-scroll"
          ref={scrollRef}
          onScroll={updateScrollbar}
          className="scrollbar-hidden mt-4 flex max-w-full gap-4 overflow-x-auto pb-2"
        >
          {characterCards.map((card) => {
            const isSelected = card.id === selectedId;
            const isLocked = Boolean(card.locked);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  if (isLocked) return;
                  setSelectedId(card.id);
                }}
                className={`flex min-w-[280px] flex-col items-center justify-center rounded-[16px] border bg-[#0b1119]/90 px-7 py-7 text-xl font-semibold text-slate-100 shadow-[0_0_14px_rgba(90,140,220,0.12)] transition ${
                  isLocked
                    ? "cursor-not-allowed border-slate-200/10 text-slate-400"
                    : "border-slate-200/25 hover:border-slate-100/45"
                } ${isSelected ? "border-sky-400/70 shadow-[0_0_18px_rgba(56,189,248,0.25)]" : ""}`}
              >
                {isLocked ? <LockIcon /> : <span>{card.name}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
