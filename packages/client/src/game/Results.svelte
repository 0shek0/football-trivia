<script lang="ts">
  import { colorHex, type RoomView } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';
  import Leaderboard from './Leaderboard.svelte';

  let { view }: { view: RoomView } = $props();
  const game = $derived(view.game!);
  const secs = $derived(app.secondsLeft(app.phaseDeadline));
  const clock = $derived(secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${secs}s`);
  const isHost = $derived(view.hostId === view.you);

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
    <b class="time">Next in {clock}</b>
  </div>

  <div class="scroll">
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

    <Leaderboard {view} />
  </div>

  {#if isHost}
    <button class="btn go wide next" onclick={() => { haptic(20); app.send({ t: 'nextWave' }); }}>Start next wave now</button>
  {/if}
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 62dvh;
    padding: 10px 12px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex: none;
  }
  h2 {
    font-size: 20px;
    font-weight: 700;
  }
  .time {
    font-size: 16px;
    color: var(--gold);
    white-space: nowrap;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 3px;
  }
  li {
    display: flex;
    gap: 8px;
    align-items: center;
    background: var(--panel-2);
    border-radius: 8px;
    padding: 3px 10px;
    font-size: 14px;
    line-height: 1.2;
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
  .next {
    flex: none;
    margin-top: 2px;
  }
</style>
