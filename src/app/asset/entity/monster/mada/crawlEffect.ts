import * as THREE from "three";

const BASE_LIFETIME_S = 0.22;

type TrailSlice = {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
};

export const createMadaCrawlEffect = (scene: THREE.Scene) => {
  const trails: TrailSlice[] = [];

  const emitTearTrail = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    swipeDir: THREE.Vector3
  ) => {
    const segment = end.clone().sub(start);
    const length = segment.length();
    if (length <= 0.02) return;

    const center = start.clone().lerp(end, 0.5);
    const width = Math.max(0.08, Math.min(0.16, length * 0.22));
    const trailMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, Math.max(0.2, length * 1.4)),
      new THREE.MeshBasicMaterial({
        color: 0xff2a12,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    trailMesh.position.copy(center);
    trailMesh.lookAt(center.clone().add(swipeDir));
    trailMesh.rotateX(Math.PI / 2);
    scene.add(trailMesh);
    trails.push({
      mesh: trailMesh,
      life: BASE_LIFETIME_S,
      maxLife: BASE_LIFETIME_S,
    });
  };

  const update = (delta: number) => {
    for (let i = trails.length - 1; i >= 0; i--) {
      const trail = trails[i];
      trail.life -= delta;
      if (trail.life <= 0) {
        scene.remove(trail.mesh);
        trail.mesh.geometry.dispose();
        (trail.mesh.material as THREE.Material).dispose();
        trails.splice(i, 1);
        continue;
      }
      const t = 1 - trail.life / trail.maxLife;
      const material = trail.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.82 * (1 - t * t * 1.6));
      trail.mesh.scale.set(
        1 + t * 0.45,
        Math.max(0.75, 1 - t * 0.2),
        1
      );
    }
  };

  const dispose = () => {
    for (const trail of trails) {
      scene.remove(trail.mesh);
      trail.mesh.geometry.dispose();
      (trail.mesh.material as THREE.Material).dispose();
    }
    trails.length = 0;
  };

  return { emitTearTrail, update, dispose };
};
