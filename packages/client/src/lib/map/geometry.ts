import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Vector3 } from 'three';

type V3 = [number, number, number];

// Builds flat-shaded low-poly shapes: every triangle has its own normal and color.
export class Mesher {
  private positions: number[] = [];
  private colors: number[] = [];
  private transform = new Matrix4();
  private v = new Vector3();
  private c = new Color();

  at(x: number, y: number, z: number, rotY = 0, scale = 1): this {
    this.transform.makeRotationY(rotY).scale(new Vector3(scale, scale, scale)).setPosition(x, y, z);
    return this;
  }

  reset(): this {
    this.transform.identity();
    return this;
  }

  tri(a: V3, b: V3, c: V3, color: string | number, shade = 1) {
    this.c.set(color).multiplyScalar(shade);
    for (const p of [a, b, c]) {
      this.v.set(p[0], p[1], p[2]).applyMatrix4(this.transform);
      this.positions.push(this.v.x, this.v.y, this.v.z);
      this.colors.push(this.c.r, this.c.g, this.c.b);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: string | number, shade = 1) {
    this.tri(a, b, c, color, shade);
    this.tri(a, c, d, color, shade);
  }

  // A tapered band around the Y axis; offset turns hexagons to point along Z.
  ring(sides: number, rBottom: number, yBottom: number, rTop: number, yTop: number, color: string | number, shade = 1, offset = 0) {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2 + offset;
      const a1 = ((i + 1) / sides) * Math.PI * 2 + offset;
      const b0: V3 = [Math.sin(a0) * rBottom, yBottom, Math.cos(a0) * rBottom];
      const b1: V3 = [Math.sin(a1) * rBottom, yBottom, Math.cos(a1) * rBottom];
      const t0: V3 = [Math.sin(a0) * rTop, yTop, Math.cos(a0) * rTop];
      const t1: V3 = [Math.sin(a1) * rTop, yTop, Math.cos(a1) * rTop];
      this.quad(b0, b1, t1, t0, color, shade);
    }
  }

  cap(sides: number, r: number, y: number, color: string | number, shades?: number[], offset = 0) {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2 + offset;
      const a1 = ((i + 1) / sides) * Math.PI * 2 + offset;
      this.tri([0, y, 0], [Math.sin(a0) * r, y, Math.cos(a0) * r], [Math.sin(a1) * r, y, Math.cos(a1) * r], color, shades?.[i % shades.length] ?? 1);
    }
  }

  cone(sides: number, r: number, yBottom: number, yTop: number, color: string | number, offset = 0) {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2 + offset;
      const a1 = ((i + 1) / sides) * Math.PI * 2 + offset;
      this.tri([Math.sin(a0) * r, yBottom, Math.cos(a0) * r], [Math.sin(a1) * r, yBottom, Math.cos(a1) * r], [0, yTop, 0], color);
    }
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string | number) {
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals();
    return g;
  }
}

export const TILE_TOP_RADIUS = 0.86;
export const TILE_RADIUS = 0.975;

// White so each instance's color (its owner) shows through. A faceted top catches light.
export function tileTopGeometry(): BufferGeometry {
  const m = new Mesher();
  m.cap(6, TILE_TOP_RADIUS, 0, '#ffffff', [1, 0.95, 0.98, 0.93, 1, 0.96]);
  m.ring(6, TILE_RADIUS, -0.13, TILE_TOP_RADIUS, 0, '#ffffff', 0.84);
  return m.build();
}

export function tileBaseGeometry(): BufferGeometry {
  const m = new Mesher();
  m.ring(6, TILE_RADIUS, -0.5, TILE_RADIUS, -0.13, '#f1dfaa');
  m.ring(6, 0.86, -1.3, TILE_RADIUS, -0.5, '#b89a6a');
  return m.build();
}

export function foamGeometry(): BufferGeometry {
  const m = new Mesher();
  m.cap(6, 1.26, 0, '#bfeaf4');
  return m.build();
}

export function pinesGeometry(): BufferGeometry {
  const m = new Mesher();
  const tree = (x: number, z: number, s: number) => {
    m.at(x, 0, z, x * 3, s);
    m.ring(5, 0.07, 0, 0.06, 0.16, '#7a5230');
    m.cone(6, 0.3, 0.14, 0.52, '#2f8a48');
    m.cone(6, 0.23, 0.38, 0.72, '#3fa858');
    m.cone(6, 0.15, 0.6, 0.9, '#5cc06e');
  };
  tree(-0.2, 0.08, 1.05);
  tree(0.26, -0.18, 0.85);
  tree(0.22, 0.32, 0.7);
  return m.build();
}

export function rocksGeometry(): BufferGeometry {
  const m = new Mesher();
  const rock = (x: number, z: number, s: number) => {
    m.at(x, 0, z, x * 5, s);
    m.ring(5, 0.42, 0, 0.26, 0.42, '#8d97a3');
    m.ring(5, 0.26, 0.42, 0.12, 0.72, '#a9b2bc');
    m.ring(5, 0.12, 0.72, 0.0, 0.92, '#f4f7fa');
  };
  rock(-0.1, -0.05, 1);
  rock(0.36, 0.26, 0.55);
  return m.build();
}

export function goalGeometry(): BufferGeometry {
  const m = new Mesher();
  const w = 0.04;
  m.box(-0.42, 0, -w, -0.42 + w * 2, 0.42, w, '#ffffff');
  m.box(0.42 - w * 2, 0, -w, 0.42, 0.42, w, '#ffffff');
  m.box(-0.42, 0.42, -w, 0.42, 0.42 + w * 2, w, '#ffffff');
  m.box(-0.42, 0, -0.26, -0.42 + w, 0.03, 0, '#dfe7ee');
  m.box(0.42 - w, 0, -0.26, 0.42, 0.03, 0, '#dfe7ee');
  // A little ball waiting on the spot
  m.at(0.05, 0.08, 0.34);
  m.ring(6, 0.08, -0.08, 0.1, 0, '#ffffff');
  m.ring(6, 0.1, 0, 0.05, 0.09, '#3a4654');
  return m.build();
}

// Tinted by owner: the stands around the pitch.
export function standsGeometry(): BufferGeometry {
  const m = new Mesher();
  const hw = 0.52;
  const hd = 0.36;
  const h = 0.24;
  const t = 0.13;
  m.box(-hw - t, 0, -hd - t, hw + t, h, -hd, '#ffffff');
  m.box(-hw - t, 0, hd, hw + t, h * 0.62, hd + t, '#ffffff');
  m.box(-hw - t, 0, -hd, -hw, h * 0.8, hd, '#ffffff');
  m.box(hw, 0, -hd, hw + t, h * 0.8, hd, '#ffffff');
  return m.build();
}

export function pitchGeometry(): BufferGeometry {
  const m = new Mesher();
  const y = 0.025;
  m.quad([-0.52, y, 0.36], [0.52, y, 0.36], [0.52, y, -0.36], [-0.52, y, -0.36], '#55c060');
  m.quad([-0.02, y + 0.003, 0.36], [0.02, y + 0.003, 0.36], [0.02, y + 0.003, -0.36], [-0.02, y + 0.003, -0.36], '#ffffff');
  m.at(0, y + 0.004, 0);
  m.cap(8, 0.09, 0, '#ffffff');
  return m.build();
}

// Tinted by owner.
export function flagGeometry(): BufferGeometry {
  const m = new Mesher();
  m.ring(5, 0.03, 0, 0.024, 0.86, '#ffffff', 0.92);
  m.quad([0.02, 0.56, 0], [0.42, 0.66, 0], [0.42, 0.66, 0.008], [0.02, 0.56, 0.008], '#ffffff', 0.6);
  m.tri([0.02, 0.56, 0.01], [0.46, 0.7, 0.01], [0.02, 0.86, 0.01], '#ffffff');
  m.tri([0.02, 0.86, -0.01], [0.46, 0.7, -0.01], [0.02, 0.56, -0.01], '#ffffff', 0.8);
  return m.build();
}

export function bushesGeometry(): BufferGeometry {
  const m = new Mesher();
  const bush = (x: number, z: number, s: number, color: string) => {
    m.at(x, 0, z, x * 7, s);
    m.ring(6, 0.17, 0, 0.2, 0.1, color);
    m.ring(6, 0.2, 0.1, 0.0, 0.3, color, 1.12);
  };
  bush(-0.3, 0.1, 1, '#3fa858');
  bush(0.05, -0.28, 0.8, '#55bd68');
  bush(0.32, 0.24, 0.9, '#2f8a48');
  return m.build();
}

// A faceted sea drawn once, with some lighter triangles for texture.
export function waterGeometry(size: number): BufferGeometry {
  const m = new Mesher();
  const step = 2.4;
  const count = Math.ceil(size / step);
  const pick = (a: number, b: number) => {
    const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return h - Math.floor(h);
  };
  for (let ix = -count; ix < count; ix++) {
    for (let iz = -count; iz < count; iz++) {
      const x0 = ix * step + (iz % 2 ? step / 2 : 0);
      const x1 = x0 + step;
      const z0 = iz * step;
      const z1 = z0 + step;
      const n = pick(ix, iz);
      const n2 = pick(iz + 9, ix + 3);
      const base = '#2a8fbd';
      m.tri([x0, 0, z1], [x1, 0, z1], [x0 + step / 2, 0, z0], base, 0.97 + n * 0.07);
      m.tri([x1, 0, z1], [x1 + step / 2, 0, z0], [x0 + step / 2, 0, z0], base, 0.95 + n2 * 0.08);
    }
  }
  return m.build();
}
