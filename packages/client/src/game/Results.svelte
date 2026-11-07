<script lang="ts">
  import { colorHex, type RoomView } from '@tb/shared';
  import { app } from '../lib/store.svelte';

  let { view }: { view: RoomView } = $props();
  const game = $derived(view.game!);
  const secs = $derived(app.secondsLeft(app.phaseDeadline));

  const side = (id: string) => game.sides.find((s) => s.id === id);
  const sideName = (id: string) => side(id)?.name ?? '';
  const sideColor = (id: string) => {
    const s = side(id);
    return s ? colorHex(s.color) : '#fff';
  };
  const playerName = (id: string) => game.players.find((p) => p.id === id)?.name ?? '';
  const hexes = (n: number) => `${n} ${n === 1 ? 'hexagon' : 'hexagons'}`;

  // 'hold' is an in-between step: the outcome shows up as 'saved' or a capture.
  const lines = $derived(game.lastWave.filter((e) => e.type !== 'hold'));
</script>

<section class="column panel wrap rise">
  <div class="head">
    <h2>Wave {game.wave} results</h2>
    <b class="time">{secs}s</b>
  </div>

  <ul>
    {#each lines as e, i (i)}
      <li class="rise" style="animation-delay:{i * 120}ms">
        {#if e.type === 'capture'}
          <i class="hex" style="--c:{sideColor(e.winnerSide)}"></i>
          <span><b>{sideName(e.winnerSide)}</b> took {hexes(e.tiles.length)} from <b>{sideName(e.loserSide)}</b></span>
        {:else if e.type === 'saved'}
          <i class="hex" style="--c:{sideColor(e.side)}"></i>
          <span class="gold"><b>Last stand!</b> {playerName(e.playerId)} saved {sideName(e.side)} on 1 hexagon</span>
        {:else if e.type === 'eliminated'}
          <i class="hex" style="--c:{sideColor(e.side)}"></i>
          <span class="bad"><b>{sideName(e.side)}</b> is out of the game</span>
        {/if}
      </li>
    {:else}
      <li class="soft">No land changed hands.</li>
    {/each}
  </ul>

  {#if game.costJustRose}
    <p class="warn">Losing now costs {hexes(game.cost)}!</p>
  {:else if game.wavesToNextCost !== null}
    <p class="soft note">A loss costs {hexes(game.cost)}. Rises in {game.wavesToNextCost} {game.wavesToNextCost === 1 ? 'wave' : 'waves'}.</p>
  {:else}
    <p class="soft note">A loss costs {hexes(game.cost)}, the maximum.</p>
  {/if}
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 48dvh;
    overflow-y: auto;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: 21px;
    font-weight: 700;
  }
  .time {
    font-size: 21px;
    color: var(--gold);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 5px;
  }
  li {
    display: flex;
    gap: 8px;
    align-items: center;
    background: var(--panel-2);
    border-radius: 10px;
    padding: 6px 10px;
    font-size: 15px;
  }
  .gold {
    color: var(--gold);
  }
  .bad {
    color: #ffb3b1;
  }
  .note {
    font-size: 14px;
  }
  .warn {
    font-weight: 700;
    color: var(--gold);
  }
</style>
