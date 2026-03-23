import * as THREE from "three";

// Emit VFX for Mada's crawl claw strike: elongated streaks + bright sparks
// aligned to the swipe direction of the striking arm.

const STREAK_COUNT = 5;
const SPARK_COUNT = 3;
const BASE_LIFETIME_S = 0.2;

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
};

export const createMadaCrawlEffect = (scene: THREE.Scene) => {
  const particles: Particle[] = [];

  /**
   * Spawn a burst of slash/tear particles.
   * @param position   World-space emission point (right claw tip)
   * @param swipeDir   Approximate world-space direction of the swipe
   */
  const emit = (position: THREE.Vector3, swipeDir: THREE.Vector3) => {
    const dir = swipeDir.clone().normalize();

    // --- elongated streak particles ---
    for (let i = 0; i < STREAK_COUNT; i++) {
      const len = 0.32 + Math.random() * 0.48;
      const geo = new THREE.PlaneGeometry(0.055, len);
      const color =
        i === 0 ? 0xffffff : i < 3 ? 0xff3300 : 0xff8844;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85 + Math.random() * 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.set(
        position.x + (Math.random() - 0.5) * 0.35,
        position.y + (Math.random() - 0.5) * 0.35,
        position.z + (Math.random() - 0.5) * 0.35
      );

      const speed = 2.0 + Math.random() * 4.0;
      const vel = new THREE.Vector3(
        dir.x + (Math.random() - 0.5) * 0.8,
        dir.y + Math.random() * 0.4 + 0.1,
        dir.z + (Math.random() - 0.5) * 0.8
      )
        .normalize()
        .multiplyScalar(speed);

      // Orient the long axis of the plane along the velocity
      mesh.lookAt(mesh.position.clone().add(vel));
      mesh.rotateX(Math.PI / 2);

      const life = BASE_LIFETIME_S * (0.6 + Math.random() * 0.8);
      scene.add(mesh);
      particles.push({ mesh, velocity: vel, life, maxLife: life });
    }

    // --- small bright spark particles ---
    for (let i = 0; i < SPARK_COUNT; i++) {
      const geo = new THREE.PlaneGeometry(0.09, 0.09);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.set(
        position.x + (Math.random() - 0.5) * 0.2,
        position.y + (Math.random() - 0.5) * 0.2,
        position.z + (Math.random() - 0.5) * 0.2
      );

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3.5,
        Math.random() * 2.5 + 0.5,
        (Math.random() - 0.5) * 3.5
      );

      const life = BASE_LIFETIME_S * (0.35 + Math.random() * 0.5);
      scene.add(mesh);
      particles.push({ mesh, velocity: vel, life, maxLife: life });
    }
  };

  const update = (delta: number) => {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        particles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.velocity.y -= 6 * delta; // gravity pull
      const t = 1 - p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        1 - t * t * 1.5
      );
      p.mesh.scale.setScalar(Math.max(0.05, 1 - t * 0.55));
    }
  };

  const dispose = () => {
    for (const p of particles) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    particles.length = 0;
  };

  return { emit, update, dispose };
};
