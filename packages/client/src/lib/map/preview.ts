import type { MapTile } from './types';

const hash = (q: number, r: number) => {
  let h = (q * 73856093) ^ (r * 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

const distance = (q: number, r: number) => (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;

// A stand-in island for the home screen and the lobby, where the real map doesn't exist yet.
export function previewTiles(owners: { color: string; tiles: number }[]): MapTile[] {
  const total = owners.reduce((sum, o) => sum + o.tiles, 0);
  const radius = Math.ceil(Math.sqrt(total)) + 1;
  const cells: { q: number; r: number; d: number; h: number; angle: number }[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const d = distance(q, r);
      if (d > radius) continue;
      const x = Math.sqrt(3) * (q + r / 2);
      const z = 1.5 * r;
      cells.push({ q, r, d, h: hash(q, r), angle: Math.atan2(z, x) });
    }
  }
  cells.sort((a, b) => a.d - b.d || a.h - b.h);
  const chosen = cells.slice(0, total).sort((a, b) => a.angle - b.angle);

  const tiles: MapTile[] = [];
  let index = 0;
  for (const owner of owners) {
    for (let i = 0; i < owner.tiles; i++) {
      const c = chosen[index];
      tiles.push({ id: index, q: c.q, r: c.r, color: owner.color, decor: c.h % 1_000_000 });
      index++;
    }
  }
  return tiles;
}
