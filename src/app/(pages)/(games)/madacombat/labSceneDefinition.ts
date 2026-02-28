import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  PlayerAttackTarget,
  PlayerWorld,
  PlayerWorldTickArgs,
} from "../../../asset/entity/character/general/player";
import { createSceneResourceTracker } from "../../../asset/scenes/general/resourceTracker";
import type {
  SceneSetupContext,
  SceneSetupResult,
} from "../../../asset/scenes/general/sceneTypes";
import { MADA_LAB_STATE_KEY, type MadaLabState } from "./labConfig";

type BoxCollider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const GROUND_Y = -1.4;
const ROOM_WIDTH = 92;
const ROOM_DEPTH = 70;
const ROOM_HEIGHT = 18;
const MADA_MAX_HEALTH = 2800;
const UI_EMIT_INTERVAL_MS = 140;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const resolveRenderableBounds = (object: THREE.Object3D) => {
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  let hasMesh = false;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshBounds.setFromObject(mesh);
    if (!hasMesh) {
      bounds.copy(meshBounds);
      hasMesh = true;
    } else {
      bounds.union(meshBounds);
    }
  });
  if (!hasMesh) {
    bounds.setFromObject(object);
  }
  return bounds;
};

const createPuddleGeometry = (radiusX: number, radiusZ: number, phase: number) => {
  const shape = new THREE.Shape();
  const points = 14;
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const ripple =
      0.84 +
      0.1 * Math.sin(angle * 3 + phase) +
      0.06 * Math.cos(angle * 4 - phase * 0.7);
    const x = Math.cos(angle) * radiusX * ripple;
    const z = Math.sin(angle) * radiusZ * ripple;
    if (i === 0) {
      shape.moveTo(x, z);
    } else {
      shape.lineTo(x, z);
    }
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
};

export const createMadaLabScene = (
  scene: THREE.Scene,
  context?: SceneSetupContext
): SceneSetupResult => {
  scene.background = new THREE.Color(0x031017);
  scene.fog = new THREE.Fog(0x031017, 38, 128);

  const resourceTracker = createSceneResourceTracker();
  const {
    trackMesh,
    trackObject,
    disposeObjectResources,
    disposeTrackedResources,
  } = resourceTracker;

  const bounds = {
    minX: -ROOM_WIDTH / 2 + 3,
    maxX: ROOM_WIDTH / 2 - 3,
    minZ: -ROOM_DEPTH / 2 + 3,
    maxZ: ROOM_DEPTH / 2 - 3,
  };

  const labGroup = new THREE.Group();
  const fxGroup = new THREE.Group();
  const solidGroup = new THREE.Group();
  labGroup.add(solidGroup, fxGroup);
  scene.add(labGroup);

  const attackTargets: PlayerAttackTarget[] = [];
  const colliders: BoxCollider[] = [];
  const animators: Array<(now: number, delta: number) => void> = [];

  let madaHealth = MADA_MAX_HEALTH;
  let electricActivity = 82;
  let shieldPulse = 0;
  let lastStateKey = "";
  let nextUiEmitAt = 0;
  let circuitBreakCount = 0;
  let fluidPatchCount = 0;

  const ambient = new THREE.AmbientLight(0xe4fbff, 2.1);
  scene.add(ambient);

  const addCollider = (
    x: number,
    z: number,
    width: number,
    depth: number,
    padding = 0.55
  ) => {
    colliders.push({
      minX: x - width / 2 - padding,
      maxX: x + width / 2 + padding,
      minZ: z - depth / 2 - padding,
      maxZ: z + depth / 2 + padding,
    });
  };

  const emitState = (force = false, now = performance.now()) => {
    if (!force && now < nextUiEmitAt) return;
    nextUiEmitAt = now + UI_EMIT_INTERVAL_MS;
    const containmentIntegrity = clamp(
      Math.round((madaHealth / MADA_MAX_HEALTH) * 100),
      0,
      100
    );
    const nextState: MadaLabState = {
      madaHealth: Math.max(0, Math.floor(madaHealth)),
      madaMaxHealth: MADA_MAX_HEALTH,
      containmentIntegrity,
      electricActivity: clamp(Math.round(electricActivity), 0, 100),
      fluidPatches: fluidPatchCount,
      circuitBreaks: circuitBreakCount,
      statusLabel:
        madaHealth <= 0
          ? "Containment failure"
          : containmentIntegrity <= 30
          ? "Containment unstable"
          : containmentIntegrity <= 60
          ? "Specimen destabilized"
          : "Specimen restrained",
    };
    const stateKey = JSON.stringify(nextState);
    if (!force && stateKey === lastStateKey) return;
    lastStateKey = stateKey;
    context?.onStateChange?.({
      [MADA_LAB_STATE_KEY]: nextState,
    });
  };

  const registerAnimator = (animate: (now: number, delta: number) => void) => {
    animators.push(animate);
  };

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b1a22,
    roughness: 0.9,
    metalness: 0.16,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x16252f,
    roughness: 0.88,
    metalness: 0.18,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x233744,
    roughness: 0.68,
    metalness: 0.28,
  });
  const glowCyan = new THREE.MeshBasicMaterial({ color: 0x7df7ff });
  const glowLime = new THREE.MeshBasicMaterial({ color: 0xb7ff5c });
  const glowAmber = new THREE.MeshBasicMaterial({ color: 0xffc54d });
  const glowRed = new THREE.MeshBasicMaterial({ color: 0xff6b6b });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = GROUND_Y;
  solidGroup.add(floor);
  trackMesh(floor);

  const centerRunway = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 50),
    new THREE.MeshStandardMaterial({
      color: 0x132833,
      roughness: 0.74,
      metalness: 0.22,
    })
  );
  centerRunway.rotation.x = -Math.PI / 2;
  centerRunway.position.set(0, GROUND_Y + 0.01, 1);
  solidGroup.add(centerRunway);
  trackMesh(centerRunway);

  const floorGridMaterial = new THREE.MeshBasicMaterial({
    color: 0x163541,
    transparent: true,
    opacity: 0.38,
  });
  for (let x = -30; x <= 30; x += 10) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.02, ROOM_DEPTH - 18),
      floorGridMaterial.clone()
    );
    stripe.position.set(x, GROUND_Y + 0.02, 0);
    solidGroup.add(stripe);
    trackMesh(stripe);
  }
  for (let z = -24; z <= 24; z += 8) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_WIDTH - 20, 0.02, 0.18),
      floorGridMaterial.clone()
    );
    stripe.position.set(0, GROUND_Y + 0.02, z);
    solidGroup.add(stripe);
    trackMesh(stripe);
  }

  const createWall = (width: number, height: number, depth: number) =>
    new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);

  const backWall = createWall(ROOM_WIDTH - 8, ROOM_HEIGHT, 1.4);
  backWall.position.set(0, GROUND_Y + ROOM_HEIGHT / 2, bounds.minZ - 0.8);
  solidGroup.add(backWall);
  trackMesh(backWall);

  const frontWall = createWall(ROOM_WIDTH - 8, ROOM_HEIGHT, 1.4);
  frontWall.position.set(0, GROUND_Y + ROOM_HEIGHT / 2, bounds.maxZ + 0.8);
  solidGroup.add(frontWall);
  trackMesh(frontWall);

  const leftWall = createWall(1.4, ROOM_HEIGHT, ROOM_DEPTH - 8);
  leftWall.position.set(bounds.minX - 0.8, GROUND_Y + ROOM_HEIGHT / 2, 0);
  solidGroup.add(leftWall);
  trackMesh(leftWall);

  const rightWall = createWall(1.4, ROOM_HEIGHT, ROOM_DEPTH - 8);
  rightWall.position.set(bounds.maxX + 0.8, GROUND_Y + ROOM_HEIGHT / 2, 0);
  solidGroup.add(rightWall);
  trackMesh(rightWall);

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_WIDTH - 8, 1.2, ROOM_DEPTH - 8),
    wallMaterial
  );
  ceiling.position.set(0, GROUND_Y + ROOM_HEIGHT + 0.5, 0);
  solidGroup.add(ceiling);
  trackMesh(ceiling);

  const createPanelWindow = (x: number) => {
    const panel = new THREE.Group();
    panel.position.set(x, GROUND_Y + 10.2, bounds.minZ + 0.24);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 7.2, 0.22),
      trimMaterial
    );
    panel.add(frame);

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 6.2, 0.16),
      new THREE.MeshBasicMaterial({
        color: 0x4fe8ff,
        transparent: true,
        opacity: 0.18,
      })
    );
    glass.position.z = 0.14;
    panel.add(glass);
    registerAnimator((now) => {
      const material = glass.material as THREE.MeshBasicMaterial;
      material.opacity = 0.12 + (0.5 + 0.5 * Math.sin(now * 0.0012 + x)) * 0.1;
    });

    solidGroup.add(panel);
    trackObject(panel);
  };

  [-11, 0, 11].forEach(createPanelWindow);

  const createCeilingStrip = (x: number, z: number, color: number, speed: number) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.18, 1),
      new THREE.MeshBasicMaterial({ color })
    );
    strip.position.set(x, GROUND_Y + ROOM_HEIGHT - 0.9, z);
    solidGroup.add(strip);
    trackMesh(strip);
    registerAnimator((now) => {
      const scale = 0.85 + (0.5 + 0.5 * Math.sin(now * 0.0018 * speed + x)) * 0.2;
      strip.scale.x = scale;
    });
  };

  [-28, -9, 9, 28].forEach((x, index) => {
    createCeilingStrip(x, 17, 0x7df7ff, 1 + index * 0.15);
    createCeilingStrip(x, -17, 0xb7ff5c, 1.2 + index * 0.15);
  });

  const createLabBench = (x: number, z: number, rotationY: number) => {
    const bench = new THREE.Group();
    bench.position.set(x, 0, z);
    bench.rotation.y = rotationY;

    const benchBody = new THREE.MeshStandardMaterial({
      color: 0x1a2933,
      roughness: 0.86,
      metalness: 0.16,
    });
    const benchTop = new THREE.MeshStandardMaterial({
      color: 0x30414c,
      roughness: 0.62,
      metalness: 0.22,
    });

    const top = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.2, 3.6), benchTop);
    top.position.y = GROUND_Y + 1.28;
    bench.add(top);

    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 0.18, 2.8),
      benchBody
    );
    shelf.position.y = GROUND_Y + 0.54;
    bench.add(shelf);

    [-3.5, -1.2, 1.2, 3.5].forEach((legX) => {
      const frontLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 1.1, 0.16),
        benchBody
      );
      frontLeg.position.set(legX, GROUND_Y + 0.54, -1.3);
      bench.add(frontLeg);
      const backLeg = frontLeg.clone();
      backLeg.position.z = 1.3;
      bench.add(backLeg);
    });

    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x7df7ff })
    );
    monitor.position.set(-2.2, GROUND_Y + 2.1, -0.2);
    bench.add(monitor);

    const device = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.7, 0.9),
      trimMaterial
    );
    device.position.set(1.1, GROUND_Y + 1.65, 0.4);
    bench.add(device);

    [-0.4, 0.45, 1.3].forEach((offset, index) => {
      const beaker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.52 + index * 0.08, 10),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0xb7ff5c : 0x7df7ff,
        })
      );
      beaker.position.set(offset, GROUND_Y + 1.56, -0.96);
      bench.add(beaker);
    });

    solidGroup.add(bench);
    trackObject(bench);
    addCollider(x, z, 8.6, 3.6, 0.7);
  };

  createLabBench(-24, 10, Math.PI * 0.08);
  createLabBench(24, 8, -Math.PI * 0.08);
  createLabBench(-22, -22, Math.PI * 0.08);
  createLabBench(22, -24, -Math.PI * 0.08);

  const createTankRack = (x: number, z: number, rotationY: number) => {
    const rack = new THREE.Group();
    rack.position.set(x, 0, z);
    rack.rotation.y = rotationY;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 4.8, 2.2),
      trimMaterial
    );
    frame.position.y = GROUND_Y + 2.4;
    rack.add(frame);

    [-1, 0, 1].forEach((offset, index) => {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 2.9, 12),
        wallMaterial
      );
      tank.position.set(offset, GROUND_Y + 2.15, 0);
      rack.add(tank);

      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 1.2 + index * 0.24, 10),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0x7df7ff : 0xb7ff5c,
        })
      );
      core.position.set(offset, GROUND_Y + 1.7, 0);
      rack.add(core);
      registerAnimator((now) => {
        core.position.y =
          GROUND_Y + 1.7 + Math.sin(now * 0.0014 + offset * 2) * 0.08;
      });
    });

    solidGroup.add(rack);
    trackObject(rack);
    addCollider(x, z, 4.2, 2.2, 0.6);
  };

  createTankRack(-35, 22, Math.PI / 2);
  createTankRack(35, 22, -Math.PI / 2);
  createTankRack(-35, -16, Math.PI / 2);
  createTankRack(35, -16, -Math.PI / 2);

  const createBrokenCircuitPanel = (
    x: number,
    y: number,
    z: number,
    rotationY: number,
    color: number,
    brokenIndex: number
  ) => {
    const panel = new THREE.Group();
    panel.position.set(x, y, z);
    panel.rotation.y = rotationY;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 5, 0.26),
      trimMaterial
    );
    panel.add(base);

    const traceMaterial = new THREE.MeshBasicMaterial({ color });
    const traces = [
      { x: -2.1, y: 1.5, w: 1.8, h: 0.12 },
      { x: -1.2, y: 0.9, w: 0.12, h: 1.2 },
      { x: -0.1, y: 0.9, w: 2.1, h: 0.12 },
      { x: 1.0, y: 0.1, w: 0.12, h: 1.5 },
      { x: 1.9, y: 0.1, w: 1.6, h: 0.12 },
      { x: -1.8, y: -0.8, w: 0.12, h: 1.1 },
      { x: -0.9, y: -1.4, w: 2, h: 0.12 },
      { x: 0.9, y: -1.4, w: 0.12, h: 1.2 },
    ];

    traces.forEach((trace, index) => {
      if (index === brokenIndex) {
        circuitBreakCount += 1;
        const shard = new THREE.Mesh(
          new THREE.BoxGeometry(trace.w, trace.h, 0.08),
          traceMaterial.clone()
        );
        shard.position.set(trace.x * 0.7, -2.4 - index * 0.08, 0.26);
        shard.rotation.z = 0.4 + index * 0.08;
        panel.add(shard);
        return;
      }
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(trace.w, trace.h, 0.08),
        traceMaterial
      );
      segment.position.set(trace.x, trace.y, 0.18);
      panel.add(segment);
    });

    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({ color })
    );
    spark.position.set(0.5, 1, 0.22);
    panel.add(spark);
    registerAnimator((now) => {
      spark.scale.setScalar(0.75 + (0.5 + 0.5 * Math.sin(now * 0.006 + x)) * 0.65);
    });

    solidGroup.add(panel);
    trackObject(panel);
  };

  createBrokenCircuitPanel(bounds.minX + 0.3, GROUND_Y + 10.4, -6, Math.PI / 2, 0x7df7ff, 1);
  createBrokenCircuitPanel(bounds.maxX - 0.3, GROUND_Y + 10.2, -4, -Math.PI / 2, 0xffc54d, 3);
  createBrokenCircuitPanel(bounds.minX + 0.3, GROUND_Y + 9.8, 18, Math.PI / 2, 0xb7ff5c, 5);
  createBrokenCircuitPanel(bounds.maxX - 0.3, GROUND_Y + 9.7, 18, -Math.PI / 2, 0xff6b6b, 6);

  const createEnergyRail = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: number,
    beadCount: number,
    speed: number
  ) => {
    const group = new THREE.Group();
    const direction = end.clone().sub(start);
    const length = direction.length();
    const yaw = Math.atan2(direction.x, direction.z);

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, length),
      new THREE.MeshBasicMaterial({ color })
    );
    bar.position.copy(start.clone().lerp(end, 0.5));
    bar.rotation.y = yaw;
    group.add(bar);

    const beads: THREE.Mesh[] = [];
    for (let i = 0; i < beadCount; i += 1) {
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshBasicMaterial({ color })
      );
      beads.push(bead);
      group.add(bead);
    }

    registerAnimator((now) => {
      for (let i = 0; i < beads.length; i += 1) {
        const bead = beads[i];
        const t = (now * 0.00022 * speed + i / beads.length) % 1;
        bead.position.copy(start).lerp(end, t);
        const scale = 0.75 + (0.5 + 0.5 * Math.sin(now * 0.006 + i)) * 0.35;
        bead.scale.setScalar(scale);
      }
    });

    fxGroup.add(group);
    trackObject(group);
  };

  const railY = GROUND_Y + 7.2;
  createEnergyRail(
    new THREE.Vector3(bounds.minX + 1.5, railY, bounds.minZ + 3),
    new THREE.Vector3(bounds.maxX - 1.5, railY, bounds.minZ + 3),
    0x7df7ff,
    8,
    1
  );
  createEnergyRail(
    new THREE.Vector3(bounds.minX + 1.5, railY, bounds.maxZ - 3),
    new THREE.Vector3(bounds.maxX - 1.5, railY, bounds.maxZ - 3),
    0xb7ff5c,
    8,
    1.1
  );
  createEnergyRail(
    new THREE.Vector3(bounds.minX + 3, railY, bounds.minZ + 6),
    new THREE.Vector3(bounds.minX + 3, railY, bounds.maxZ - 6),
    0xffc54d,
    6,
    1.2
  );
  createEnergyRail(
    new THREE.Vector3(bounds.maxX - 3, railY, bounds.minZ + 6),
    new THREE.Vector3(bounds.maxX - 3, railY, bounds.maxZ - 6),
    0x7df7ff,
    6,
    1.3
  );

  const createElectricColumn = (x: number, z: number, color: number, phase: number) => {
    const column = new THREE.Group();
    column.position.set(x, 0, z);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.1, 0.9, 12),
      trimMaterial
    );
    base.position.y = GROUND_Y + 0.45;
    column.add(base);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 5.1, 10),
      trimMaterial
    );
    stem.position.y = GROUND_Y + 3;
    column.add(stem);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.08, 10, 28),
      new THREE.MeshBasicMaterial({ color })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = GROUND_Y + 5.5;
    column.add(halo);

    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshBasicMaterial({ color })
    );
    bead.position.y = GROUND_Y + 5.5;
    column.add(bead);

    registerAnimator((now) => {
      halo.rotation.z += 0.02;
      bead.position.y = GROUND_Y + 5.3 + Math.sin(now * 0.002 + phase) * 0.35;
      bead.scale.setScalar(0.85 + (0.5 + 0.5 * Math.sin(now * 0.004 + phase)) * 0.4);
    });

    solidGroup.add(column);
    trackObject(column);
    addCollider(x, z, 2.2, 2.2, 0.45);
  };

  createElectricColumn(-38, -24, 0x7df7ff, 0.2);
  createElectricColumn(38, -24, 0xffc54d, 0.8);
  createElectricColumn(-38, 24, 0xb7ff5c, 1.4);
  createElectricColumn(38, 24, 0x7df7ff, 2.2);

  const createPuddle = (
    x: number,
    z: number,
    radiusX: number,
    radiusZ: number,
    color: number,
    phase: number
  ) => {
    const puddle = new THREE.Mesh(
      createPuddleGeometry(radiusX, radiusZ, phase),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62 })
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, GROUND_Y + 0.04, z);
    fxGroup.add(puddle);
    trackMesh(puddle);
    fluidPatchCount += 1;
  };

  [
    [-32, -4, 2.1, 1.4, 0xb7ff5c, 0.2],
    [-28, 18, 1.8, 1.1, 0x7df7ff, 0.6],
    [-18, -28, 2.4, 1.7, 0xb7ff5c, 1.1],
    [-9, 12, 1.4, 0.9, 0x4fffd6, 1.5],
    [-2, -20, 1.6, 1.1, 0x7df7ff, 2],
    [8, -4, 1.9, 1.2, 0xb7ff5c, 2.4],
    [10, 18, 1.5, 1, 0x7df7ff, 2.8],
    [14, -29, 2.2, 1.4, 0x8dff75, 3.3],
    [22, 24, 1.5, 1.1, 0xb7ff5c, 3.7],
    [28, -10, 1.8, 1.1, 0x7df7ff, 4.2],
    [31, 6, 1.5, 0.9, 0xb7ff5c, 4.7],
    [-36, 2, 1.2, 0.8, 0x7df7ff, 5.1],
    [0, -32, 2.8, 1.3, 0xb7ff5c, 5.5],
    [3, 26, 2.2, 1.2, 0x4fffd6, 5.9],
  ].forEach(([x, z, rx, rz, color, phase]) => {
    createPuddle(
      x as number,
      z as number,
      rx as number,
      rz as number,
      color as number,
      phase as number
    );
  });

  const chamber = new THREE.Group();
  chamber.position.set(0, 0, -12);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 6, 1.3, 24),
    trimMaterial
  );
  platform.position.y = GROUND_Y + 0.65;
  chamber.add(platform);

  const platformRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.9, 0.14, 10, 40),
    glowLime
  );
  platformRing.rotation.x = Math.PI / 2;
  platformRing.position.y = GROUND_Y + 1.45;
  chamber.add(platformRing);

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, 8.6, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x7df7ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    })
  );
  shell.position.y = GROUND_Y + 5.15;
  chamber.add(shell);

  const topCap = new THREE.Mesh(
    new THREE.TorusGeometry(4.25, 0.16, 10, 40),
    glowCyan
  );
  topCap.rotation.x = Math.PI / 2;
  topCap.position.y = GROUND_Y + 9.45;
  chamber.add(topCap);

  const middleBand = new THREE.Mesh(
    new THREE.TorusGeometry(4.42, 0.12, 10, 40),
    glowCyan
  );
  middleBand.rotation.x = Math.PI / 2;
  middleBand.position.y = GROUND_Y + 5.8;
  chamber.add(middleBand);

  [
    [-3.2, -3.2],
    [3.2, -3.2],
    [-3.2, 3.2],
    [3.2, 3.2],
  ].forEach(([x, z]) => {
    const strut = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 8.5, 0.34),
      trimMaterial
    );
    strut.position.set(x, GROUND_Y + 5.15, z);
    chamber.add(strut);
  });

  const crackGroup = new THREE.Group();
  [
    [1.2, 7.7, 0.18, 0.05],
    [0.8, 6.1, 0.12, -0.08],
    [-1.6, 5.4, -0.22, 0.04],
    [-1.8, 4.1, -0.1, -0.06],
    [2.1, 5.0, 0.24, -0.04],
  ].forEach(([x, y, z, rotZ]) => {
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.2, 0.04),
      glowCyan.clone()
    );
    crack.position.set(x as number, GROUND_Y + (y as number), z as number);
    crack.rotation.z = rotZ as number;
    crackGroup.add(crack);
  });
  chamber.add(crackGroup);

  registerAnimator((now, delta) => {
    const pulse = 0.72 + (0.5 + 0.5 * Math.sin(now * 0.0022)) * 0.25 + shieldPulse * 0.12;
    platformRing.scale.setScalar(pulse);
    topCap.rotation.z += delta * 0.6;
    middleBand.rotation.z -= delta * 0.35;
    shell.scale.setScalar(1 + shieldPulse * 0.04);
  });

  solidGroup.add(chamber);
  trackObject(chamber);
  addCollider(0, -12, 11.2, 11.2, 0.85);

  const madaRig = new THREE.Group();
  madaRig.position.set(0, GROUND_Y + 2, -12);
  const madaModelRoot = new THREE.Group();
  madaRig.add(madaModelRoot);
  labGroup.add(madaRig);

  const fallbackMaterial = new THREE.MeshStandardMaterial({
    color: 0x352930,
    roughness: 0.72,
    metalness: 0.08,
  });
  const fallbackBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.2, 2.6, 6, 12),
    fallbackMaterial
  );
  fallbackBody.position.y = 1.7;
  madaModelRoot.add(fallbackBody);
  trackMesh(fallbackBody);

  const loader = new GLTFLoader();
  let isDisposed = false;
  loader.load(
    "/assets/monsters/mada/mada.glb",
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        disposeObjectResources(gltf.scene);
        return;
      }

      const model = gltf.scene;
      const modelBounds = resolveRenderableBounds(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      modelBounds.getSize(size);
      const targetHeight = 5.6;
      const height = Math.max(0.001, size.y);
      model.scale.setScalar(targetHeight / height);
      model.updateMatrixWorld(true);

      const normalizedBounds = resolveRenderableBounds(model);
      normalizedBounds.getCenter(center);
      model.position.set(-center.x, -normalizedBounds.min.y, -center.z);
      model.updateMatrixWorld(true);

      while (madaModelRoot.children.length > 0) {
        madaModelRoot.remove(madaModelRoot.children[0]);
      }
      madaModelRoot.add(model);
      trackObject(model);
    },
    undefined,
    () => {}
  );

  const specimenFocus = new THREE.Vector3();
  const madaAttackTarget: PlayerAttackTarget = {
    id: "madaSubject",
    object: madaRig,
    category: "boss",
    label: "Mada Subject",
    isActive: () => madaHealth > 0,
    getHealth: () => madaHealth,
    getMaxHealth: () => MADA_MAX_HEALTH,
    onHit: (hit) => {
      if (madaHealth <= 0) return;
      madaHealth = Math.max(0, madaHealth - Math.max(1, Math.floor(hit.damage)));
      shieldPulse = Math.min(1.4, shieldPulse + 0.55);
      emitState(true, hit.now);
    },
  };
  attackTargets.push(madaAttackTarget);

  const worldTick = ({ now, delta, player }: PlayerWorldTickArgs) => {
    shieldPulse = Math.max(0, shieldPulse - delta * 1.5);
    electricActivity =
      60 +
      12 * (0.5 + 0.5 * Math.sin(now * 0.0024)) +
      shieldPulse * 20 +
      (madaHealth <= MADA_MAX_HEALTH * 0.35 ? 8 : 0);

    for (let i = 0; i < animators.length; i += 1) {
      animators[i](now, delta);
    }

    madaRig.position.y =
      GROUND_Y + 2 + Math.sin(now * 0.0018) * 0.16 + shieldPulse * 0.06;
    if (madaHealth > 0) {
      player.getWorldPosition(specimenFocus);
      specimenFocus.y = madaRig.position.y + 1.4;
      madaRig.lookAt(specimenFocus);
      madaRig.rotation.x = 0;
      madaRig.rotation.z = 0;
    } else {
      madaRig.rotation.y += delta * 0.35;
    }

    emitState(false, now);
  };

  const world: PlayerWorld = {
    sceneId: "madaLab",
    groundY: GROUND_Y,
    playerSpawn: new THREE.Vector3(0, GROUND_Y, 28),
    bounds,
    projectileColliders: [solidGroup],
    attackTargets,
    isBlocked: (x, z) => {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
        return true;
      }
      for (let i = 0; i < colliders.length; i += 1) {
        const collider = colliders[i];
        if (
          x >= collider.minX &&
          x <= collider.maxX &&
          z >= collider.minZ &&
          z <= collider.maxZ
        ) {
          return true;
        }
      }
      return false;
    },
    onTick: worldTick,
  };

  emitState(true);

  const dispose = () => {
    isDisposed = true;
    context?.onStateChange?.({});
    attackTargets.length = 0;
    scene.remove(labGroup);
    disposeTrackedResources();
  };

  return { world, dispose };
};
