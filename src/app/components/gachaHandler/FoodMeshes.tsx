"use client";

import { useEffect, useMemo, useState } from "react";

// SVG food silhouettes â€” viewBox 0 0 40 40 each
export const FOOD_MESH_SHAPES: { d: string; fill: string }[] = [
  // Strawberry
  {
    d: "M20,36 C11,31 4,22 4,15 C4,9 8,5 13,5 C15,5 17,6 20,9 C23,6 25,5 27,5 C32,5 36,9 36,15 C36,22 29,31 20,36 Z M15,4 C14,-1 20,-2 22,2 C21,3 20,4 20,5 C20,4 19,3 15,4 Z",
    fill: "#f43f5e",
  },
  // Apple
  {
    d: "M20,6 C20,2 25,0 27,3 C32,3 36,8 36,14 C36,24 28,33 20,33 C12,33 4,24 4,14 C4,8 8,3 13,3 C15,0 20,2 20,6 Z",
    fill: "#4ade80",
  },
  // Lemon
  {
    d: "M7,20 C5,15 6,9 10,6 C14,3 19,3 23,6 C28,3 33,3 35,7 C37,12 35,18 31,22 C27,26 20,27 16,25 C12,28 7,26 7,20 Z M20,3 L20,0",
    fill: "#facc15",
  },
  // Cherry
  {
    d: "M12,28 C6,28 2,23 2,17 C2,11 7,8 12,8 C14,8 16,9 18,11 M28,28 C34,28 38,23 38,17 C38,11 33,8 28,8 C26,8 24,9 22,11 M18,11 C19,7 21,3 20,1 C20,1 27,0 26,3 C25,5 22,9 22,11",
    fill: "#dc2626",
  },
  // Cupcake
  {
    d: "M8,18 L11,10 C13,7 16,6 20,6 C24,6 27,7 29,10 L32,18 Z M5,18 L35,18 L32,30 L8,30 Z M14,6 C13,1 27,1 26,6",
    fill: "#fb923c",
  },
  // Ice cream
  {
    d: "M20,4 C12,4 7,9 7,16 C7,22 12,26 20,26 C28,26 33,22 33,16 C33,9 28,4 20,4 Z M13,26 L20,38 L27,26 Z",
    fill: "#c084fc",
  },
  // Cookie
  {
    d: "M20,3 C11,3 3,11 3,20 C3,29 11,37 20,37 C29,37 37,29 37,20 C37,11 29,3 20,3 Z M13,15 C13,14 14,14 14,15 C14,16 13,16 13,15 Z M26,13 C26,12 27,12 27,13 C27,14 26,14 26,13 Z M16,24 C16,23 17,23 17,24 C17,25 16,25 16,24 Z M25,25 C25,24 26,24 26,25 C26,26 25,26 25,25 Z M21,19 C21,18 22,18 22,19 C22,20 21,20 21,19 Z",
    fill: "#d97706",
  },
  // Pizza slice
  {
    d: "M20,3 L36,34 L4,34 Z M14,27 C14,26 15,26 15,27 C15,28 14,28 14,27 Z M24,21 C24,20 25,20 25,21 C25,22 24,22 24,21 Z M20,14 C20,13 21,13 21,14 C21,15 20,15 20,14 Z",
    fill: "#f97316",
  },
  // Mochi
  {
    d: "M20,5 C10,5 4,12 4,20 C4,28 10,35 20,35 C30,35 36,28 36,20 C36,12 30,5 20,5 Z M16,18 C14,16 15,13 18,13 C20,13 21,15 20,17 C22,17 24,15 26,16 C28,18 27,21 25,21 C26,23 25,25 23,24 C22,22 20,22 18,24 C16,25 15,23 16,21 C14,20 14,18 16,18 Z",
    fill: "#f9a8d4",
  },
  // Donut
  {
    d: "M20,3 C11,3 4,10 4,20 C4,30 11,37 20,37 C29,37 36,30 36,20 C36,10 29,3 20,3 Z M20,14 C17,14 14,17 14,20 C14,23 17,26 20,26 C23,26 26,23 26,20 C26,17 23,14 20,14 Z",
    fill: "#a78bfa",
  },
  // Grape bunch
  {
    d: "M16,8 C14,6 14,4 16,3 C18,4 18,6 16,8 Z M22,8 C20,6 20,4 22,3 C24,4 24,6 22,8 Z M13,13 C11,11 11,9 13,8 C15,9 15,11 13,13 Z M19,13 C17,11 17,9 19,8 C21,9 21,11 19,13 Z M25,13 C23,11 23,9 25,8 C27,9 27,11 25,13 Z M16,18 C14,16 14,14 16,13 C18,14 18,16 16,18 Z M22,18 C20,16 20,14 22,13 C24,14 24,16 22,18 Z M19,23 C17,21 17,19 19,18 C21,19 21,21 19,23 Z M19,5 L20,1",
    fill: "#8b5cf6",
  },
  // Watermelon slice
  {
    d: "M4,34 L20,4 L36,34 Z M8,30 L32,30 C32,28 20,10 8,30 Z M14,24 C14,23 15,23 15,24 C15,25 14,25 14,24 Z M21,20 C21,19 22,19 22,20 C22,21 21,21 21,20 Z M17,28 C17,27 18,27 18,28 C18,29 17,29 17,28 Z",
    fill: "#22c55e",
  },
  // Sushi roll
  {
    d: "M20,4 C11,4 4,11 4,20 C4,29 11,36 20,36 C29,36 36,29 36,20 C36,11 29,4 20,4 Z M20,10 C14,10 10,14 10,20 C10,26 14,30 20,30 C26,30 30,26 30,20 C30,14 26,10 20,10 Z M20,15 C17,15 15,17 15,20 C15,23 17,25 20,25 C23,25 25,23 25,20 C25,17 23,15 20,15 Z",
    fill: "#f0abfc",
  },
  // Croissant
  {
    d: "M6,28 C3,22 5,14 10,10 C12,8 15,8 17,10 C19,8 22,7 25,8 C30,10 34,15 33,21 C32,26 28,29 24,28 C21,30 17,30 14,28 C11,30 8,30 6,28 Z",
    fill: "#fbbf24",
  },
  // Taiyaki
  {
    d: "M6,20 C6,14 10,8 16,8 C20,8 24,10 26,14 L34,18 L26,22 C24,26 20,28 16,28 C10,28 6,26 6,20 Z M26,18 C26,17 27,17 27,18 C27,19 26,19 26,18 Z",
    fill: "#fb923c",
  },
  // Candy
  {
    d: "M12,8 C12,5 15,3 20,3 C25,3 28,5 28,8 L28,32 C28,35 25,37 20,37 C15,37 12,35 12,32 Z M8,14 L12,14 M28,14 L32,14 M8,26 L12,26 M28,26 L32,26",
    fill: "#ec4899",
  },
];

type FoodMeshesProps = {
  className?: string;
};

type MeshItem = {
  shape: (typeof FOOD_MESH_SHAPES)[number];
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
};

function seeded01(seed: number): number {
  const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return n - Math.floor(n);
}

function buildUniformZone(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  cols: number,
  rows: number,
  seed: number,
): MeshItem[] {
  const cellW = (x1 - x0) / cols;
  const cellH = (y1 - y0) / rows;

  return Array.from({ length: cols * rows }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const si = seed + row * 97 + col * 31;

    // Keep tiny jitter to preserve a uniform layout while avoiding rigid straight lines.
    const jitterX = (seeded01(si + 0.23) - 0.5) * cellW * 0.28;
    const jitterY = (seeded01(si + 0.79) - 0.5) * cellH * 0.28;

    return {
      shape:
        FOOD_MESH_SHAPES[(row * 5 + col * 3 + seed) % FOOD_MESH_SHAPES.length],
      x: x0 + (col + 0.5) * cellW + jitterX,
      y: y0 + (row + 0.5) * cellH + jitterY,
      size: 52 + ((row + col + seed) % 4) * 10,
      opacity: 0.2 + ((row * 2 + col + seed) % 4) * 0.03,
      rotation: ((row * 41 + col * 67 + seed * 13) % 360 + 360) % 360,
    };
  });
}

export default function FoodMeshes({ className = "" }: FoodMeshesProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Dense and uniform concentration around the snack bag (top/bottom + side flanks).
  const items = useMemo(
    () =>
      [
        ...buildUniformZone(24, 76, 8, 30, 20, 8, 11),
        ...buildUniformZone(24, 76, 70, 92, 20, 8, 71),
        ...buildUniformZone(10, 32, 24, 76, 8, 16, 131),
        ...buildUniformZone(68, 90, 24, 76, 8, 16, 191),
        ...buildUniformZone(30, 40, 34, 66, 6, 10, 251),
        ...buildUniformZone(60, 70, 34, 66, 6, 10, 311),
      ].filter((item) => item.x >= -4 && item.x <= 104 && item.y >= -4 && item.y <= 104),
    [],
  );

  if (!isClient) return null;

  return (
    <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}>
      {items.map((item, i) => (
        <svg
          key={i}
          viewBox="0 0 40 40"
          width={item.size}
          height={item.size}
          className="absolute select-none"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            opacity: item.opacity,
            transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={item.shape.d} fill={item.shape.fill} />
        </svg>
      ))}
    </div>
  );
}

