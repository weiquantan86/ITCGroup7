"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type MonsterRow = {
  id: string;
  inSource: boolean;
  inPublic: boolean;
  glbFiles: string[];
  previewPath: string | null;
};

type AdminMonsterClientProps = {
  monsters: MonsterRow[];
};

const withDevCacheBust = (path: string) => {
  if (process.env.NODE_ENV !== "development") return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${Date.now()}`;
};

const disposeObjectResources = (object: THREE.Object3D) => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose?.();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
      return;
    }
    mesh.material?.dispose?.();
  });
};

function MonsterMeshViewer({ meshPath }: { meshPath: string | null }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const frameRef = useRef<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.8, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.8;
    controls.maxDistance = 10;
    controls.target.set(0, 1.2, 0);
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight(0xe2e8f0, 0.7);
    const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.2);
    keyLight.position.set(3, 6, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    rimLight.position.set(-4, 3, -2);
    scene.add(ambient, keyLight, rimLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.96,
        metalness: 0.06,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    loaderRef.current = new GLTFLoader();

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameRef.current = window.requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(mount);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      controls.dispose();
      if (modelRef.current) {
        scene.remove(modelRef.current);
        disposeObjectResources(modelRef.current);
        modelRef.current = null;
      }
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const loader = loaderRef.current;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!scene || !loader || !controls || !camera) return;

    setLoadError(null);

    if (modelRef.current) {
      scene.remove(modelRef.current);
      disposeObjectResources(modelRef.current);
      modelRef.current = null;
    }

    if (!meshPath) return;

    let cancelled = false;
    loader.load(
      withDevCacheBust(meshPath),
      (gltf) => {
        if (!gltf?.scene) return;
        if (cancelled) {
          disposeObjectResources(gltf.scene);
          return;
        }

        const model = gltf.scene;
        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxAxis = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.8 / maxAxis;
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);

        const modelBounds = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        modelBounds.getCenter(center);
        model.position.set(-center.x, -modelBounds.min.y, -center.z);
        model.updateMatrixWorld(true);

        scene.add(model);
        modelRef.current = model;

        const modelHeight = modelBounds.max.y - modelBounds.min.y;
        controls.target.set(0, modelHeight * 0.5, 0);
        const distance = THREE.MathUtils.clamp(modelHeight * 1.8, 2.8, 7.8);
        camera.position.set(0, modelHeight * 0.85, distance);
        controls.update();
      },
      undefined,
      () => {
        if (!cancelled) {
          setLoadError("Failed to load selected mesh");
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [meshPath]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      <div ref={mountRef} className="h-full w-full" />
      {loadError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/80 px-4 text-center text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminMonsterClient({ monsters }: AdminMonsterClientProps) {
  const firstViewableMonsterId = useMemo(
    () => monsters.find((monster) => Boolean(monster.previewPath))?.id ?? null,
    [monsters]
  );
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(
    firstViewableMonsterId
  );

  useEffect(() => {
    if (!selectedMonsterId) {
      setSelectedMonsterId(firstViewableMonsterId);
      return;
    }
    const exists = monsters.some((monster) => monster.id === selectedMonsterId);
    if (!exists) {
      setSelectedMonsterId(firstViewableMonsterId);
    }
  }, [firstViewableMonsterId, monsters, selectedMonsterId]);

  const selectedMonster =
    monsters.find((monster) => monster.id === selectedMonsterId) ?? null;

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/80">
        <table className="min-w-[860px] w-full text-left text-xs text-slate-200">
          <thead className="bg-slate-800/80 text-[11px] uppercase tracking-wide text-slate-300">
            <tr>
              <th className="px-3 py-2">Monster ID</th>
              <th className="px-3 py-2">In Source</th>
              <th className="px-3 py-2">In Public Assets</th>
              <th className="px-3 py-2">GLB Files</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {monsters.map((monster) => {
              const canView = Boolean(monster.previewPath);
              const isSelected = selectedMonsterId === monster.id;
              return (
                <tr
                  key={monster.id}
                  className={`border-t border-slate-800 ${isSelected ? "bg-slate-800/40" : ""}`}
                >
                  <td className="px-3 py-2 font-mono font-semibold">{monster.id}</td>
                  <td className="px-3 py-2">{monster.inSource ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{monster.inPublic ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    {monster.glbFiles.length === 0 ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      monster.glbFiles.join(", ")
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={!canView}
                      onClick={() => setSelectedMonsterId(monster.id)}
                      className="rounded-md border border-sky-500/60 bg-sky-900/40 px-3 py-1 text-xs text-sky-100 transition-colors hover:bg-sky-800/60 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
            Mesh Preview
          </h2>
          <span className="text-xs text-slate-400">
            {selectedMonster?.id
              ? `Selected: ${selectedMonster.id}`
              : "Select a monster row to preview"}
          </span>
        </div>

        {selectedMonster?.previewPath ? (
          <MonsterMeshViewer meshPath={selectedMonster.previewPath} />
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/60 text-sm text-slate-400">
            This monster has no mesh file available in public assets.
          </div>
        )}
      </section>
    </div>
  );
}
