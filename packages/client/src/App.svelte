<script lang="ts">
  import { colorHex, COLORS } from '@tb/shared';
  import MapView from './lib/map/MapView.svelte';
  import { previewTiles } from './lib/map/preview';
  import type { MapInsets, MapTile } from './lib/map/types';
  import { app } from './lib/store.svelte';
  import Home from './screens/Home.svelte';
  import Lobby from './screens/Lobby.svelte';
  import Game from './screens/Game.svelte';

  app.init();

  const view = $derived(app.view);
  const lobby = $derived(view?.lobby ?? null);
  const game = $derived(view?.game ?? null);

  const demo = previewTiles(COLORS.map((c) => ({ color: c.hex, tiles: 5 })));

  const tiles = $derived.by<MapTile[]>(() => {
    if (game) {
      const colorOf = new Map(game.sides.map((s) => [s.id, colorHex(s.color)]));
      return game.tiles.map((t) => ({ id: t.id, q: t.q, r: t.r, color: colorOf.get(t.owner) ?? '#ffffff', decor: t.decor }));
    }
    if (lobby) {
      const each = lobby.settings.startingTiles;
      const owners =
        lobby.settings.mode === 'teams'
          ? lobby.teamColors.map((c, i) => ({ color: colorHex(c), tiles: lobby.players.filter((p) => p.team === i).length * each }))
          : lobby.players.map((p) => ({ color: colorHex(p.color), tiles: each }));
      return previewTiles(owners);
    }
    return demo;
  });

  const captureOrder = $derived(
    game?.lastWave.flatMap((e) => (e.type === 'capture' ? e.tiles : [])) ?? [],
  );

  let width = $state(innerWidth);
  let height = $state(innerHeight);

  // How much of the screen the UI covers, so the island stays visible beside it.
  const insets = $derived.by<MapInsets>(() => {
    // Matches the side panel layout in app.css for short, wide screens.
    if (width > height && height <= 520) {
      const right = Math.min(width * 0.46, 420) + 24;
      if (!view) return { top: 76, bottom: 8, right };
      if (lobby) return { top: 70, bottom: 8, right };
      return { top: 92, bottom: 8, right };
    }
    // The logo scales with screen width up to its maximum size.
    if (!view) return { top: width >= 560 ? 250 : 180, bottom: 190 };
    if (lobby) return { top: 90, bottom: Math.round(height * 0.62) };
    if (game?.phase === 'game_over') return { top: 110, bottom: Math.min(Math.round(height * 0.66), 470) };
    if (game?.phase === 'intermission') {
      // The leaderboard grows with the number of players, up to the panel's maximum.
      return { top: 110, bottom: Math.min(Math.round(height * 0.62), 210 + game.players.length * 32) };
    }
    return { top: 110, bottom: 260 };
  });
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

<MapView {tiles} {captureOrder} {insets} interactive={!!game} />

{#if game}
  <Game view={view!} />
{:else if lobby}
  <Lobby view={view!} />
{:else if app.resuming}
  <div class="screen resume"><p class="title-stroke">Rejoining your game...</p></div>
{:else}
  <Home />
{/if}

{#if !app.online && (view || app.resuming)}
  <div class="offline rise" role="status">Reconnecting...</div>
{/if}

<style>
  .resume {
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 600;
  }
  .offline {
    position: fixed;
    top: calc(8px + var(--safe-top));
    left: 50%;
    translate: -50% 0;
    background: var(--bad);
    border-radius: 999px;
    padding: 6px 16px;
    font-weight: 600;
    z-index: 50;
  }
</style>
