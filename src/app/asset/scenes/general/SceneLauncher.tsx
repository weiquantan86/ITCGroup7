"use client";

import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { createPlayer, type PlayerUiState } from "../../entity/character/general/player";
import { loadSceneDefinition } from "../registry";
import type { SceneSetupResult, SceneUiState } from "./sceneTypes";

export default function SceneLauncher({
  sceneId = "grass",
  gameMode = "default",
  characterPath,
  decorations,
  className,
  hideLocalHead = true,
  hideLocalBody = false,
  showMiniMap = true,
  infiniteFire = false,
  onSceneStateChange,
  onPlayerStateChange,
}: {
  sceneId?: string;
  gameMode?: string;
  characterPath?: string;
  decorations?: ReactNode;
  className?: string;
  hideLocalHead?: boolean;
  hideLocalBody?: boolean;
  showMiniMap?: boolean;
  infiniteFire?: boolean;
  onSceneStateChange?: (state: SceneUiState) => void;
  onPlayerStateChange?: (state: PlayerUiState) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    let animationId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let sceneSetup: SceneSetupResult | null = null;
    let player: ReturnType<typeof createPlayer> | null = null;
    let isDisposed = false;
    let lastTime = 0;

    const handleResize = () => {
      if (!mount || !renderer || !player) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      player.resize(mount.clientWidth, mount.clientHeight);
    };

    const initialize = async () => {
      try {
        const sceneDefinition = await loadSceneDefinition(sceneId);
        if (isDisposed) return;

        sceneSetup = sceneDefinition?.setupScene?.(scene, {
          onStateChange: onSceneStateChange,
        });

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mount.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.8);
        const keyLight = new THREE.SpotLight(
          0xe2e8f0,
          1.5,
          40,
          Math.PI / 4,
          0.45,
          1
        );
        keyLight.position.set(4, 8, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        const hemiLight = new THREE.HemisphereLight(0x1e293b, 0x0b0f1a, 0.85);
        const fillLight = new THREE.DirectionalLight(0xcbd5f5, 0.6);
        fillLight.position.set(-4, 6, -2);
        scene.add(ambientLight, keyLight, hemiLight, fillLight);

        player = createPlayer({
          scene,
          mount,
          characterPath,
          world: sceneSetup?.world,
          gameMode,
          hideLocalHead,
          hideLocalBody,
          showMiniMap,
          infiniteFire,
          onUiStateChange: onPlayerStateChange,
        });

        const animate = () => {
          if (isDisposed || !player || !renderer) return;
          const now = performance.now();
          const delta = (now - lastTime) / 1000 || 0.016;
          lastTime = now;
          player.update(now, delta);
          player.render(renderer);
          animationId = window.requestAnimationFrame(animate);
        };
        animate();
        window.addEventListener("resize", handleResize);
      } catch (error) {
        console.error("Failed to initialize scene", error);
      }
    };
    void initialize();

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      sceneSetup?.dispose?.();
      player?.dispose();
      renderer?.dispose();
      if (renderer?.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [
    characterPath,
    sceneId,
    gameMode,
    hideLocalHead,
    hideLocalBody,
    showMiniMap,
    infiniteFire,
    onSceneStateChange,
    onPlayerStateChange,
  ]);

  return (
    <div
      className={
        className
          ? `relative overflow-hidden ${className}`
          : `relative h-[70vh] min-h-[800px] w-full max-w-[1600px] mx-auto translate-x-20 overflow-hidden rounded-[32px] border border-white/5 bg-[#0b0f1a] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]`
      }
      aria-label="Interactive 3D scene"
    >
      <div ref={mountRef} className="h-full w-full" />
      {decorations ? (
        <div className="pointer-events-none absolute inset-0">
          {decorations}
        </div>
      ) : null}
    </div>
  );
}

