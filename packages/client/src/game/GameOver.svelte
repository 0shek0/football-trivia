<script lang="ts">
  import { awards, colorHex, type RoomView } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';

  let { view }: { view: RoomView } = $props();
  const game = $derived(view.game!);
  const winner = $derived(game.sides.find((s) => s.id === game.winnerSide));
  const iWon = $derived(winner?.memberIds.includes(view.you) ?? false);
  const isHost = $derived(view.hostId === view.you);
  const stats = $derived(awards(game.players));

  const sideColor = (sideId: string) => {
    const side = game.sides.find((s) => s.id === sideId);
    return side ? colorHex(side.color) : '#fff';
  };
</script>

<section class="column panel wrap pop">
  <div class="scroll">
    {#if winner}
      <h2 class:won={iWon}><i class="hex" style="--c:{colorHex(winner.color)}"></i> {iWon ? 'Victory!' : `${winner.name} wins`}</h2>
      <p class="soft sub">
        {iWon ? 'The whole map is yours' : `${winner.name} controls the map`}, after {game.wave} {game.wave === 1 ? 'wave' : 'waves'}.
      </p>
    {:else}
      <h2>Game over</h2>
      <p class="soft sub">Everyone left the match.</p>
    {/if}

    {#if stats.length}
      <ul class="stats">
        {#each stats as award (award.key)}
          <li>
            <span class="title soft">{award.title}</span>
            <span class="who">
              {#each award.players as p (p.id)}
                <span class="player"><i class="hex" style="--c:{sideColor(p.sideId)}"></i>{p.name}</span>
              {/each}
            </span>
            <b class="value">{award.value} <small>{award.unit}</small></b>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

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
    gap: 8px;
    max-height: 66dvh;
    padding: 12px;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    text-align: center;
  }
  h2 {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.1;
  }
  .won {
    color: var(--gold);
    text-shadow: 0 3px 0 var(--gold-edge);
  }
  .sub {
    font-size: 15px;
    margin-top: 2px;
  }
  .stats {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 5px;
    text-align: left;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 8px;
    background: var(--panel-2);
    border-radius: 10px;
    padding: 6px 10px;
    align-items: center;
  }
  .title {
    grid-column: 1;
    font-size: 13px;
  }
  .who {
    grid-column: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
  }
  .player {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 700;
    font-size: 16px;
    min-width: 0;
  }
  .value {
    grid-column: 2;
    grid-row: 1 / span 2;
    font-size: 20px;
    color: var(--gold);
    text-align: right;
    line-height: 1.05;
  }
  small {
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-soft);
  }
  .actions {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .actions .btn {
    min-height: 44px;
    font-size: 16px;
  }
  .wait {
    font-size: 14px;
    text-align: center;
    margin-bottom: 4px;
  }
</style>
