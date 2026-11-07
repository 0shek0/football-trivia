import type { Rng, Tile } from './types';
import { pick, shuffled } from './rng';

export const HEX_DIRECTIONS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
] as const;

export function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function neighborsOf<T extends { q: number; r: number }>(tile: { q: number; r: number }, tiles: readonly T[]): T[] {
  return tiles.filter((t) => hexDistance(t, tile) === 1);
}

// A compact island: full inner rings plus a random part of the outer ring,
// which always stays connected because each ring touches the one inside it.
export function generateCoords(count: number, rng: Rng): { q: number; r: number }[] {
  const radius = Math.ceil(Math.sqrt(count)) + 1;
  const all: { q: number; r: number; d: number; jitter: number }[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const d = hexDistance({ q, r }, { q: 0, r: 0 });
      if (d <= radius) all.push({ q, r, d, jitter: rng() });
    }
  }
  all.sort((a, b) => a.d - b.d || a.jitter - b.jitter);
  return all.slice(0, count).map(({ q, r }) => ({ q, r }));
}

export interface TerritoryQuota {
  owner: string;
  tiles: number;
}

const MAP_ATTEMPTS = 30;

function landPatches(tiles: readonly Tile[]): Tile[][] {
  const seen = new Set<number>();
  const patches: Tile[][] = [];
  for (const start of tiles) {
    if (seen.has(start.id)) continue;
    const patch = [start];
    seen.add(start.id);
    for (let i = 0; i < patch.length; i++) {
      for (const n of neighborsOf(patch[i], tiles)) {
        if (n.owner === start.owner && !seen.has(n.id)) {
          seen.add(n.id);
          patch.push(n);
        }
      }
    }
    patches.push(patch);
  }
  return patches;
}

// Extra land patches beyond one per side, so 0 means every side's land is in one piece.
export function strandedPatches(tiles: readonly Tile[]): number {
  return landPatches(tiles).length - new Set(tiles.map((t) => t.owner)).size;
}

// Swaps stranded hexagons with other sides' hexagons, which keeps every side's count exact.
function repairStranded(tiles: Tile[]) {
  let stranded = strandedPatches(tiles);
  while (stranded > 0) {
    const patches = landPatches(tiles);
    const largest = new Map<string, number>();
    for (const p of patches) largest.set(p[0].owner, Math.max(largest.get(p[0].owner) ?? 0, p.length));
    const loose = patches.filter((p) => p.length < largest.get(p[0].owner)!).flat();
    let improved = false;
    search: for (const a of loose) {
      for (const b of tiles) {
        if (a.owner === b.owner) continue;
        [a.owner, b.owner] = [b.owner, a.owner];
        const after = strandedPatches(tiles);
        if (after < stranded) {
          stranded = after;
          improved = true;
          break search;
        }
        [a.owner, b.owner] = [b.owner, a.owner];
      }
    }
    if (!improved) return;
  }
}

// Growth can box a side in and strand a hexagon, so each try is repaired, and the first clean one wins.
export function generateMap(quotas: TerritoryQuota[], rng: Rng): Tile[] {
  let best: Tile[] | null = null;
  for (let i = 0; i < MAP_ATTEMPTS; i++) {
    const next = growTerritories(quotas, rng);
    repairStranded(next);
    if (strandedPatches(next) === 0) return next;
    if (!best || strandedPatches(next) < strandedPatches(best)) best = next;
  }
  return best!;
}

// Grows each side's land outward from spread-out seeds, so territories start grouped.
function growTerritories(quotas: TerritoryQuota[], rng: Rng): Tile[] {
  const total = quotas.reduce((sum, q) => sum + q.tiles, 0);
  const tiles: Tile[] = generateCoords(total, rng).map((c, id) => ({
    id,
    q: c.q,
    r: c.r,
    owner: '',
    decor: Math.floor(rng() * 1_000_000),
  }));

  const order = shuffled(quotas, rng);
  const seeds: Tile[] = [];
  const edge = tiles.filter((t) => neighborsOf(t, tiles).length < 6);
  seeds.push(pick(edge.length ? edge : tiles, rng));
  while (seeds.length < order.length) {
    let best = tiles[0];
    let bestDist = -1;
    for (const t of tiles) {
      if (seeds.includes(t)) continue;
      const d = Math.min(...seeds.map((s) => hexDistance(s, t)));
      if (d > bestDist) {
        best = t;
        bestDist = d;
      }
    }
    seeds.push(best);
  }

  const remaining = new Map(order.map((q) => [q.owner, q.tiles]));
  order.forEach((q, i) => {
    seeds[i].owner = q.owner;
    remaining.set(q.owner, q.tiles - 1);
  });

  let unowned = total - order.length;
  while (unowned > 0) {
    // The side with the most land still to place grows next, keeping growth even.
    const growing = [...remaining.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0][0];
    const seed = seeds[order.findIndex((q) => q.owner === growing)];
    const free = tiles.filter((t) => !t.owner);
    const touching = free.filter((t) => neighborsOf(t, tiles).some((n) => n.owner === growing));
    const options = touching.length ? touching : free;
    const closest = Math.min(...options.map((t) => hexDistance(t, seed)));
    const chosen = pick(options.filter((t) => hexDistance(t, seed) === closest), rng);
    chosen.owner = growing;
    remaining.set(growing, remaining.get(growing)! - 1);
    unowned--;
  }
  return tiles;
}
