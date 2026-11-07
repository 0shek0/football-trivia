<script lang="ts">
  import { colorHex, type RoomView } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';

  let { view }: { view: RoomView } = $props();
  const game = $derived(view.game!);
  const winner = $derived(game.sides.find((s) => s.id === game.winnerSide));
  const iWon = $derived(winner?.memberIds.includes(view.you) ?? false);
  const isHost = $derived(view.hostId === view.you);
</script>

<section class="column panel wrap pop">
  {#if winner}
    <i class="hex crown" style="--c:{colorHex(winner.color)}"></i>
    <h2 class:won={iWon}>{iWon ? 'Victory!' : `${winner.name} wins`}</h2>
    <p class="soft">
      {iWon ? 'The whole map is yours' : `${winner.name} controls the map`}, after {game.wave} {game.wave === 1 ? 'wave' : 'waves'}.
    </p>
  {:else}
    <h2>Game over</h2>
    <p class="soft">Everyone left the match.</p>
  {/if}

  <div class="actions">
    {#if isHost}
      <button class="btn go wide" onclick={() => { haptic(); app.send({ t: 'playAgain' }); }}>Back to lobby</button>
    {:else}
      <p class="soft wait">Waiting for the host to start another game</p>
    {/if}
    <button class="btn quiet wide" onclick={() => app.leave()}>Leave</button>
  </div>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
  }
  .crown {
    font-size: 40px;
  }
  h2 {
    font-size: 36px;
    font-weight: 700;
    line-height: 1.05;
  }
  .won {
    color: var(--gold);
    text-shadow: 0 4px 0 var(--gold-edge);
  }
  .actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
  }
  .wait {
    font-size: 15px;
    margin-bottom: 4px;
  }
</style>
