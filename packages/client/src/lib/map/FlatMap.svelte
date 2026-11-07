<script lang="ts">
  import type { MapTile } from './types';

  // Shown only on devices without WebGL, so the game still works everywhere.
  let { tiles }: { tiles: MapTile[] } = $props();

  const SQRT3 = Math.sqrt(3);
  const point = (t: MapTile) => ({ x: SQRT3 * (t.q + t.r / 2), y: 1.5 * t.r });
  const hexPoints = (x: number, y: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(x + Math.sin(a) * 0.96).toFixed(3)},${(y + Math.cos(a) * 0.96).toFixed(3)}`;
    }).join(' ');

  const viewBox = $derived.by(() => {
    if (tiles.length === 0) return '-4 -4 8 8';
    const pts = tiles.map(point);
    const minX = Math.min(...pts.map((p) => p.x)) - 2;
    const maxX = Math.max(...pts.map((p) => p.x)) + 2;
    const minY = Math.min(...pts.map((p) => p.y)) - 2;
    const maxY = Math.max(...pts.map((p) => p.y)) + 2;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  });
</script>

<svg {viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  {#each tiles as t (t.id)}
    {@const p = point(t)}
    <polygon points={hexPoints(p.x, p.y)} fill={t.color} />
  {/each}
</svg>

<style>
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  polygon {
    stroke: #f1dfaa;
    stroke-width: 0.1;
    transition: fill 400ms;
  }
</style>
