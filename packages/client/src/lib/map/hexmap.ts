import {
  BoxGeometry, BufferGeometry, Color, DirectionalLight, DynamicDrawUsage, Group, HemisphereLight, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, Object3D, OrthographicCamera, Quaternion, Scene, Vector3, WebGLRenderer,
} from 'three';
import {
  bushesGeometry, flagGeometry, foamGeometry, goalGeometry, pinesGeometry, pitchGeometry, rocksGeometry, standsGeometry,
  tileBaseGeometry, tileTopGeometry, waterGeometry,
} from './geometry';
import type { HexMapApi, MapInsets, MapTile } from './types';

const SQRT3 = Math.sqrt(3);
const WATER_Y = -0.62;
const ENTER_MS = 420;
const CAPTURE_MS = 620;
const CAPTURE_GAP_MS = 240;
const PARTICLE_COUNT = 72;
const MAX_PX_PER_UNIT = 62;
const MAX_ZOOM = 3.2;
const MIN_ZOOM = 0.7;

const CAMERA_DIR = new Vector3(0, 1, 0.74).normalize();

type DecorKind = 'pines' | 'rocks' | 'bushes' | 'stadium' | 'goal' | 'flag' | 'none';

function decorKind(seed: number): DecorKind {
  const n = seed % 100;
  if (n < 30) return 'pines';
  if (n < 44) return 'bushes';
  if (n < 58) return 'rocks';
  if (n < 70) return 'stadium';
  if (n < 80) return 'flag';
  if (n < 88) return 'goal';
  return 'none';
}

interface DecorInstance {
  mesh: InstancedMesh;
  index: number;
  tinted: boolean;
  local: Matrix4;
}

interface TileState {
  tile: MapTile;
  index: number;
  x: number;
  z: number;
  shade: number;
  color: Color;
  decor: DecorInstance[];
}

type Anim =
  | { kind: 'enter'; tile: TileState; start: number }
  | { kind: 'capture'; tile: TileState; start: number; from: Color; to: Color; burst: boolean };

interface Particle {
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
}

const easeOutBack = (t: number) => {
  const c = 1.70158;
  const p = t - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
};
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export class HexMap implements HexMapApi {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private island = new Group();
  private meshes: InstancedMesh[] = [];
  private tiles = new Map<number, TileState>();
  private top!: InstancedMesh;
  private base!: InstancedMesh;
  private foam!: InstancedMesh;
  private anims: Anim[] = [];
  private particles: Particle[] = [];
  private particleMesh: InstancedMesh;
  private nextParticle = 0;

  private geoTop = tileTopGeometry();
  private geoBase = tileBaseGeometry();
  private geoFoam = foamGeometry();
  private decorGeo: Record<'pines' | 'rocks' | 'bushes' | 'goal' | 'stands' | 'pitch' | 'flag', BufferGeometry> = {
    pines: pinesGeometry(),
    rocks: rocksGeometry(),
    bushes: bushesGeometry(),
    goal: goalGeometry(),
    stands: standsGeometry(),
    pitch: pitchGeometry(),
    flag: flagGeometry(),
  };
  private lit = new MeshLambertMaterial({ vertexColors: true });
  private unlit = new MeshBasicMaterial({ vertexColors: true });

  private width = 1;
  private height = 1;
  private insets: MapInsets = { top: 0, bottom: 0 };
  private bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  private fitHeight = 12;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private right = new Vector3();
  private up = new Vector3();

  private raf = 0;
  private lastFrame = 0;
  private interactive = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private destroyed = false;

  private m = new Matrix4();
  private q = new Quaternion();
  private p = new Vector3();
  private s = new Vector3();
  private dummy = new Object3D();
  private c = new Color();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.scene.background = new Color('#2a8fbd');

    this.scene.add(new HemisphereLight('#ffffff', '#6a97ad', 2.1));
    const sun = new DirectionalLight('#fff4dc', 1.5);
    sun.position.set(-3, 10, 6);
    this.scene.add(sun);

    const water = new Mesh(waterGeometry(90), this.unlit);
    water.position.y = WATER_Y - 0.02;
    this.scene.add(water);
    this.scene.add(this.island);

    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(CAMERA_DIR).multiplyScalar(120);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(this.camera.matrixWorld, 1);

    this.particleMesh = new InstancedMesh(new BoxGeometry(0.16, 0.16, 0.16), new MeshLambertMaterial(), PARTICLE_COUNT);
    this.particleMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.visible = false;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({ life: 0, maxLife: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 });
      this.particleMesh.setColorAt(i, this.c.set('#ffffff'));
    }
    this.scene.add(this.particleMesh);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.resize();
  }

  // --- Public ---

  setTiles(next: MapTile[], captureOrder: number[] = []) {
    const sameLayout = next.length === this.tiles.size && next.every((t) => {
      const old = this.tiles.get(t.id);
      return old && old.tile.q === t.q && old.tile.r === t.r;
    });
    if (!sameLayout) {
      this.rebuild(next);
      return;
    }
    const changed = next.filter((t) => this.tiles.get(t.id)!.tile.color !== t.color);
    if (changed.length === 0) return;
    const orderOf = (id: number) => {
      const i = captureOrder.indexOf(id);
      return i === -1 ? captureOrder.length : i;
    };
    changed.sort((a, b) => orderOf(a.id) - orderOf(b.id));
    const now = performance.now();
    changed.forEach((t, i) => {
      const state = this.tiles.get(t.id)!;
      state.tile = t;
      this.anims = this.anims.filter((a) => a.tile !== state);
      this.anims.push({
        kind: 'capture',
        tile: state,
        start: now + i * CAPTURE_GAP_MS,
        from: state.color.clone(),
        to: new Color(t.color).multiplyScalar(state.shade),
        burst: false,
      });
    });
    this.wake();
  }

  setInsets(insets: MapInsets) {
    this.insets = insets;
    this.updateCamera();
    this.requestRender();
  }

  setInteractive(on: boolean) {
    this.interactive = on;
    this.canvas.style.touchAction = on ? 'none' : 'auto';
    if (!on) {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.updateCamera();
      this.requestRender();
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.renderer.setSize(this.width, this.height, false);
    this.computeFit();
    this.updateCamera();
    // Resizing clears the canvas, so redraw now to avoid a blank flash when a phone rotates.
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointercancel', this.onPointerUp);
    c.removeEventListener('wheel', this.onWheel);
    c.removeEventListener('webglcontextlost', this.onContextLost);
    c.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer.dispose();
  }

  // --- Building ---

  private rebuild(next: MapTile[]) {
    const previous = new Set([...this.tiles.values()].map((t) => `${t.tile.q},${t.tile.r}`));
    for (const m of this.meshes) {
      this.island.remove(m);
      m.dispose();
    }
    this.meshes = [];
    this.tiles.clear();
    this.anims = [];

    const count = next.length;
    const make = (geo: BufferGeometry, n: number, material: MeshLambertMaterial | MeshBasicMaterial = this.lit) => {
      const mesh = new InstancedMesh(geo, material, n);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.island.add(mesh);
      this.meshes.push(mesh);
      return mesh;
    };

    this.foam = make(this.geoFoam, count, this.unlit);
    this.base = make(this.geoBase, count);
    this.top = make(this.geoTop, count);

    const kinds = next.map((t) => decorKind(t.decor));
    const countOf = (k: DecorKind) => kinds.filter((x) => x === k).length;
    const stadiums = countOf('stadium');
    const pools = {
      pines: make(this.decorGeo.pines, countOf('pines')),
      rocks: make(this.decorGeo.rocks, countOf('rocks')),
      bushes: make(this.decorGeo.bushes, countOf('bushes')),
      goal: make(this.decorGeo.goal, countOf('goal')),
      stands: make(this.decorGeo.stands, stadiums),
      pitch: make(this.decorGeo.pitch, stadiums),
      flag: make(this.decorGeo.flag, countOf('flag')),
    };
    const used = { pines: 0, rocks: 0, bushes: 0, goal: 0, stands: 0, pitch: 0, flag: 0 };

    const add = (state: TileState, key: keyof typeof pools, tinted: boolean, local: Matrix4) => {
      const mesh = pools[key];
      const index = used[key]++;
      state.decor.push({ mesh, index, tinted, local });
      mesh.setColorAt(index, this.c.set(tinted ? state.tile.color : '#ffffff'));
    };

    const now = performance.now();
    const distances = next.map((t) => (Math.abs(t.q) + Math.abs(t.q + t.r) + Math.abs(t.r)) / 2);
    next.forEach((tile, i) => {
      const shade = 0.96 + ((tile.decor >>> 3) % 9) * 0.01;
      const state: TileState = {
        tile,
        index: i,
        x: SQRT3 * (tile.q + tile.r / 2),
        z: 1.5 * tile.r,
        shade,
        color: new Color(tile.color).multiplyScalar(shade),
        decor: [],
      };
      this.tiles.set(tile.id, state);
      this.top.setColorAt(i, state.color);

      const seed = tile.decor;
      const rot = ((seed >>> 7) % 6) * (Math.PI / 3);
      const local = new Matrix4().makeRotationY(rot);
      switch (kinds[i]) {
        case 'pines':
          add(state, 'pines', false, local);
          break;
        case 'rocks':
          add(state, 'rocks', false, local);
          break;
        case 'bushes':
          add(state, 'bushes', false, local);
          break;
        case 'goal':
          add(state, 'goal', false, new Matrix4().makeRotationY(((seed >>> 7) % 3) * 0.32 - 0.32));
          break;
        case 'stadium': {
          const flat = new Matrix4().makeRotationY(((seed >>> 7) % 3) * (Math.PI / 3));
          add(state, 'stands', true, flat);
          add(state, 'pitch', false, flat);
          break;
        }
        case 'flag':
          add(state, 'flag', true, new Matrix4().makeTranslation(-0.1, 0, 0));
          break;
      }

      this.writeTile(state, i, 0, 1);
      if (!previous.has(`${tile.q},${tile.r}`)) {
        this.anims.push({ kind: 'enter', tile: state, start: now + distances[i] * 45 + (seed % 60) });
        this.writeTile(state, i, -2, 0.001);
      }
    });

    for (const m of this.meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.computeBounds();
    this.computeFit();
    this.updateCamera();
    this.wake();
  }

  private writeTile(state: TileState, index: number, lift: number, scale: number) {
    const y = lift;
    this.dummy.position.set(state.x, y, state.z);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.set(scale, scale, scale);
    this.dummy.updateMatrix();
    this.top.setMatrixAt(index, this.dummy.matrix);
    this.base.setMatrixAt(index, this.dummy.matrix);

    const foamScale = lift < -0.5 ? 0.001 : scale;
    this.dummy.position.set(state.x, WATER_Y, state.z);
    this.dummy.scale.set(foamScale, 1, foamScale);
    this.dummy.updateMatrix();
    this.foam.setMatrixAt(index, this.dummy.matrix);

    this.dummy.position.set(state.x, y, state.z);
    this.dummy.scale.set(scale, scale, scale);
    this.dummy.updateMatrix();
    for (const d of state.decor) {
      this.m.multiplyMatrices(this.dummy.matrix, d.local);
      d.mesh.setMatrixAt(d.index, this.m);
    }
  }

  // --- Camera ---

  private computeBounds() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const t of this.tiles.values()) {
      this.p.set(t.x, 0, t.z);
      const x = this.p.dot(this.right);
      const y = this.p.dot(this.up);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    if (minX === Infinity) minX = maxX = minY = maxY = 0;
    this.bounds = { minX, maxX, minY, maxY };
  }

  private computeFit() {
    const b = this.bounds;
    const { top, bottom, right = 0 } = this.insets;
    const usableW = Math.max(120, this.width - right);
    const usableH = Math.max(100, this.height - top - bottom);
    const pad = 3.1;
    const worldPerPx = Math.max((b.maxY - b.minY + pad) / usableH, (b.maxX - b.minX + pad) / usableW, 1 / MAX_PX_PER_UNIT);
    // fitHeight describes the whole canvas, of which only part is free of UI.
    this.fitHeight = worldPerPx * this.height;
  }

  private updateCamera() {
    this.computeFit();
    const viewH = this.fitHeight / this.zoom;
    const viewW = viewH * (this.width / this.height);
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.updateProjectionMatrix();

    const b = this.bounds;
    const worldPerPx = viewH / this.height;
    // Keep the island centered in the space the UI leaves free.
    const insetShift = ((this.insets.top - this.insets.bottom) / 2) * worldPerPx;
    const sideShift = ((this.insets.right ?? 0) / 2) * worldPerPx;
    const cx = (b.minX + b.maxX) / 2 + this.panX + sideShift;
    const cy = (b.minY + b.maxY) / 2 + this.panY + insetShift;
    this.p.copy(this.right).multiplyScalar(cx).addScaledVector(this.up, cy);
    this.camera.position.copy(this.p).addScaledVector(CAMERA_DIR, 120);
    this.camera.updateMatrixWorld();
  }

  private clampPan() {
    const b = this.bounds;
    const limitX = (b.maxX - b.minX) / 2 + 2;
    const limitY = (b.maxY - b.minY) / 2 + 2;
    this.panX = Math.min(limitX, Math.max(-limitX, this.panX));
    this.panY = Math.min(limitY, Math.max(-limitY, this.panY));
  }

  // --- Input ---

  private onPointerDown = (e: PointerEvent) => {
    if (!this.interactive) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) this.pinchDistance = this.currentPinch();
  };

  private onPointerMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev || !this.interactive) return;
    const worldPerPx = this.fitHeight / this.zoom / this.height;
    if (this.pointers.size === 1) {
      this.panX -= (e.clientX - prev.x) * worldPerPx;
      this.panY += (e.clientY - prev.y) * worldPerPx;
    }
    prev.x = e.clientX;
    prev.y = e.clientY;
    if (this.pointers.size === 2) {
      const d = this.currentPinch();
      if (this.pinchDistance > 0) this.setZoom(this.zoom * (d / this.pinchDistance));
      this.pinchDistance = d;
    }
    this.clampPan();
    this.updateCamera();
    this.requestRender();
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.pinchDistance = 0;
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.interactive) return;
    e.preventDefault();
    this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015));
    this.updateCamera();
    this.requestRender();
  };

  private setZoom(z: number) {
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  private currentPinch() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  private onContextRestored = () => this.requestRender();

  // --- Rendering: only runs while something is moving, to save battery ---

  private requestRender() {
    this.wake();
  }

  private wake() {
    if (this.raf || this.destroyed) return;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const animating = this.stepAnims(now);
    const particles = this.stepParticles(dt);
    this.renderer.render(this.scene, this.camera);
    if (animating || particles) this.wake();
  };

  private stepAnims(now: number): boolean {
    if (this.anims.length === 0) return false;
    let colors = false;
    const remaining: Anim[] = [];
    for (const a of this.anims) {
      const index = a.tile.index;
      const raw = now - a.start;
      if (raw < 0) {
        remaining.push(a);
        continue;
      }
      if (a.kind === 'enter') {
        const t = clamp01(raw / ENTER_MS);
        const e = easeOutBack(t);
        this.writeTile(a.tile, index, (1 - t) * -2 + (e - t) * 0.4, Math.max(0.001, e));
        if (t < 1) remaining.push(a);
        else this.writeTile(a.tile, index, 0, 1);
      } else {
        const t = clamp01(raw / CAPTURE_MS);
        const hop = Math.sin(t * Math.PI) * 1.5;
        const squash = 1 + Math.sin(t * Math.PI * 2) * 0.05;
        this.writeTile(a.tile, index, hop, squash);
        const blend = clamp01((t - 0.3) / 0.25);
        a.tile.color.copy(a.from).lerp(a.to, blend);
        this.top.setColorAt(index, a.tile.color);
        if (blend > 0) {
          this.c.set(a.tile.tile.color);
          for (const d of a.tile.decor) {
            if (!d.tinted) continue;
            d.mesh.setColorAt(d.index, this.c);
            if (d.mesh.instanceColor) d.mesh.instanceColor.needsUpdate = true;
          }
        }
        colors = true;
        if (!a.burst && t > 0.82) {
          a.burst = true;
          this.burst(a.tile);
        }
        if (t < 1) remaining.push(a);
        else this.writeTile(a.tile, index, 0, 1);
      }
    }
    this.anims = remaining;
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    if (colors && this.top.instanceColor) this.top.instanceColor.needsUpdate = true;
    // Runs once more after the last one ends, so the final positions get drawn.
    return true;
  }

  private burst(tile: TileState) {
    this.particleMesh.visible = true;
    for (let i = 0; i < 12; i++) {
      const p = this.particles[this.nextParticle];
      const angle = (i / 12) * Math.PI * 2 + Math.random();
      const speed = 2.2 + Math.random() * 2;
      p.life = p.maxLife = 0.55 + Math.random() * 0.25;
      p.x = tile.x;
      p.y = 0.2;
      p.z = tile.z;
      p.vx = Math.cos(angle) * speed;
      p.vz = Math.sin(angle) * speed;
      p.vy = 4 + Math.random() * 3;
      p.spin = Math.random() * 6;
      this.particleMesh.setColorAt(this.nextParticle, this.c.set(tile.tile.color));
      this.nextParticle = (this.nextParticle + 1) % PARTICLE_COUNT;
    }
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  private stepParticles(dt: number): boolean {
    if (!this.particleMesh.visible) return false;
    let alive = false;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = this.particles[i];
      if (p.life <= 0) {
        this.m.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, this.m);
        continue;
      }
      alive = true;
      p.life -= dt;
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.spin += dt * 8;
      const s = clamp01(p.life / p.maxLife);
      this.q.setFromAxisAngle(this.p.set(1, 1, 0).normalize(), p.spin);
      this.m.compose(this.p.set(p.x, p.y, p.z), this.q, this.s.set(s, s, s));
      this.particleMesh.setMatrixAt(i, this.m);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (!alive) this.particleMesh.visible = false;
    return alive;
  }
}
