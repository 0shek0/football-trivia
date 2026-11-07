<script lang="ts">
  import { colorHex, leaderboard, type RoomView } from '@tb/shared';

  let { view }: { view: RoomView } = $props();
  const game = $derived(view.game!);
  const rows = $derived(leaderboard(game.players));
  const sideColor = (sideId: string) => {
    const side = game.sides.find((s) => s.id === sideId);
    return side ? colorHex(side.color) : '#fff';
  };
</script>

<div class="board">
  <div class="heading">
    <h3>Leaderboard</h3>
    <span class="cols"><span class="right-col">Right</span><span>Wrong</span></span>
  </div>
  <ol>
    {#each rows as { rank, player } (player.id)}
      <li class:you={player.id === view.you} class:gone={player.left} class:first={rank === 1 && player.correct > 0}>
        <span class="rank">{rank}</span>
        <i class="hex" style="--c:{sideColor(player.sideId)}"></i>
        <span class="name">{player.name}{player.id === view.you ? ' (you)' : ''}</span>
        <b class="right-col">{player.correct}</b>
        <span class="wrong">{player.wrong}</span>
      </li>
    {/each}
  </ol>
</div>

<style>
  .heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
  }
  h3 {
    font-size: 16px;
    font-weight: 700;
  }
  .cols {
    display: flex;
    font-size: 12px;
    color: var(--text-soft);
    padding-right: 10px;
  }
  .cols span,
  .wrong {
    width: 42px;
    text-align: center;
    flex: none;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 3px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 7px;
    background: var(--panel-2);
    border-radius: 8px;
    padding: 1px 10px 1px 7px;
    font-size: 15px;
    min-height: 27px;
  }
  li.you {
    background: var(--panel-3);
    outline: 2px solid rgba(255, 255, 255, 0.55);
    outline-offset: -2px;
  }
  li.gone {
    opacity: 0.5;
  }
  .rank {
    width: 18px;
    text-align: center;
    font-weight: 700;
    color: var(--text-soft);
    flex: none;
  }
  li.first .rank {
    color: var(--gold);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  b.right-col {
    width: 42px;
    text-align: center;
    flex: none;
    font-size: 17px;
    color: #9be58f;
  }
  .wrong {
    color: #ffb3b1;
    font-weight: 600;
  }
</style>
