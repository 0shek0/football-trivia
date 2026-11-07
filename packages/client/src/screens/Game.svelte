<script lang="ts">
  import { untrack } from 'svelte';
  import type { RoomView } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';
  import Battle from '../game/Battle.svelte';
  import CostAlert from '../game/CostAlert.svelte';
  import Countdown from '../game/Countdown.svelte';
  import GameOver from '../game/GameOver.svelte';
  import Hud from '../game/Hud.svelte';
  import Results from '../game/Results.svelte';
  import Spectate from '../game/Spectate.svelte';
  import StoreSheet from '../game/StoreSheet.svelte';
  import TeamNaming from '../game/TeamNaming.svelte';
  import Waiting from '../game/Waiting.svelte';

  let { view }: { view: RoomView } = $props();
  const game = $derived(view.game!);
  const inBattle = $derived(game.phase === 'wave' && game.myBattle !== null && game.myBattle.stage !== 'finished');

  let storeOpen = $state(false);
  // Questions take over the screen, so the store can't stay open over them.
  $effect(() => {
    if (inBattle) storeOpen = false;
  });

  // Kept here so the eye and back buttons respond before the server does.
  let watchId = $state<number | null>(null);
  const watched = $derived(game.phase === 'wave' ? (game.battles.find((x) => x.id === watchId) ?? null) : null);

  function watch(battleId: number | null) {
    haptic();
    watchId = battleId;
    app.send({ t: 'spectate', battleId });
  }

  // The wave ending takes everyone back to the map for the results.
  $effect(() => {
    if (game.phase !== 'wave') watchId = null;
  });
  // Shown once per break in which the cost went up, wherever the player is in the game.
  let costAlert = $state<{ wave: number; cost: number } | null>(null);
  let alertedWave = 0;
  $effect(() => {
    if (game.phase === 'intermission' && game.costJustRose && game.wave > alertedWave) {
      alertedWave = game.wave;
      const shown = { wave: game.wave, cost: game.cost };
      costAlert = shown;
      haptic(40);
      // Matches the alert's animation length.
      setTimeout(() => {
        if (costAlert?.wave === shown.wave) costAlert = null;
      }, 2600);
    }
  });

  // A tap made while offline never reached the server, so ask again on return.
  $effect(() => {
    const battleId = untrack(() => watchId);
    if (app.online && battleId !== null) app.send({ t: 'spectate', battleId });
  });
</script>

{#if inBattle}
  <Battle {view} />
{:else if watched}
  <Spectate {view} round={watched} onBack={() => watch(null)} />
{:else}
  <div class="screen">
    <Hud {view} onStore={() => (storeOpen = true)} />
    <div class="spacer"></div>
    {#if game.phase === 'team_naming'}
      <TeamNaming {view} />
    {:else if game.phase === 'countdown'}
      <Countdown {view} />
    {:else if game.phase === 'wave'}
      <Waiting {view} onWatch={watch} />
    {:else if game.phase === 'intermission'}
      <Results {view} />
    {:else}
      <GameOver {view} />
    {/if}
  </div>
{/if}

{#if costAlert}
  {#key costAlert.wave}
    <CostAlert cost={costAlert.cost} />
  {/key}
{/if}

{#if storeOpen}
  <StoreSheet {view} onClose={() => (storeOpen = false)} />
{/if}

<style>
  .spacer {
    flex: 1;
    pointer-events: none;
  }
</style>
