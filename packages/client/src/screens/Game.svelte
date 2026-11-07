<script lang="ts">
  import type { RoomView } from '@tb/shared';
  import Battle from '../game/Battle.svelte';
  import Countdown from '../game/Countdown.svelte';
  import GameOver from '../game/GameOver.svelte';
  import Hud from '../game/Hud.svelte';
  import Results from '../game/Results.svelte';
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
</script>

{#if inBattle}
  <Battle {view} />
{:else}
  <div class="screen">
    <Hud {view} onStore={() => (storeOpen = true)} />
    <div class="spacer"></div>
    {#if game.phase === 'team_naming'}
      <TeamNaming {view} />
    {:else if game.phase === 'countdown'}
      <Countdown {view} />
    {:else if game.phase === 'wave'}
      <Waiting {view} />
    {:else if game.phase === 'intermission'}
      <Results {view} />
    {:else}
      <GameOver {view} />
    {/if}
  </div>
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
