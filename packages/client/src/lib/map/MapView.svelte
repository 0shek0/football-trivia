<script lang="ts">
  import { onMount } from 'svelte';
  import FlatMap from './FlatMap.svelte';
  import type { HexMapApi, MapInsets, MapTile } from './types';

  let {
    tiles,
    captureOrder = [],
    interactive = false,
    insets = { top: 0, bottom: 0 },
  }: { tiles: MapTile[]; captureOrder?: number[]; interactive?: boolean; insets?: MapInsets } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let map = $state<HexMapApi | null>(null);
  let flat = $state(false);

  const hasWebGL = () => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  };

  onMount(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    if (!hasWebGL()) {
      flat = true;
      return;
    }
    // The 3D code loads separately so the first screen appears immediately.
    import('./hexmap')
      .then(({ HexMap }) => {
        if (disposed) return;
        const instance = new HexMap(canvas!);
        map = instance;
        observer = new ResizeObserver(() => instance.resize());
        observer.observe(canvas!);
      })
      .catch((err) => {
        console.error('Falling back to the flat map', err);
        flat = true;
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      map?.destroy();
    };
  });

  $effect(() => {
    map?.setInsets(insets);
  });
  $effect(() => {
    map?.setInteractive(interactive);
  });
  $effect(() => {
    map?.setTiles(tiles, captureOrder);
  });
</script>

<div class="map">
  {#if flat}
    <FlatMap {tiles} />
  {:else}
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
  {/if}
</div>

<style>
  .map {
    position: absolute;
    inset: 0;
    background: var(--water);
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
