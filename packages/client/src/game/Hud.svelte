<script lang="ts">
  import { colorHex, type RoomView } from '@tb/shared';

  let { view, onStore }: { view: RoomView; onStore: () => void } = $props();
  const game = $derived(view.game!);
  const mySide = $derived(game.players.find((p) => p.id === view.you)?.sideId);
  const ranked = $derived([...game.sides].sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.tiles - a.tiles));
</script>

<header class="hud column">
  <div class="row">
    <div class="stat">
      {#if game.wave > 0}<span class="soft">Wave</span> <b>{game.wave}</b>{:else}<span class="soft">Get ready</span>{/if}
    </div>
    <div class="stat cost" title="Hexagons a loss costs">
      <span class="soft">A loss costs</span>
      <b>{game.cost}</b><i class="hex" style="--c:var(--gold)"></i>
    </div>
    <button class="stat store chip-btn" onclick={onStore} aria-label="Open store, {game.credits} credits">
      <i class="coin"></i><b>{game.credits}</b>
    </button>
  </div>
  <div class="sides">
    {#each ranked as side (side.id)}
      <div class="side" class:out={side.eliminated} class:mine={side.id === mySide} style="--c:{colorHex(side.color)}">
        <i class="hex"></i>
        <span class="name">{side.name}</span>
        <b>{side.tiles}</b>
      </div>
    {/each}
  </div>
</header>

<style>
  .hud {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }
  .stat {
    background: var(--panel);
    border-radius: 11px;
    box-shadow: 0 3px 0 rgba(10, 30, 46, 0.55);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    font-size: 14px;
    min-height: 36px;
    white-space: nowrap;
  }
  .stat b {
    font-size: 17px;
  }
  .cost {
    flex: 1;
    justify-content: center;
  }
  .store {
    appearance: none;
    border: 0;
    color: #fff;
    cursor: pointer;
    font: inherit;
    background: var(--gold-edge);
    touch-action: manipulation;
    padding-inline: 12px;
  }
  .coin {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: inset 0 0 0 3px #ffe08a;
    display: inline-block;
  }
  .sides {
    display: flex;
    gap: 5px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 3px;
    -webkit-overflow-scrolling: touch;
  }
  .sides::-webkit-scrollbar {
    display: none;
  }
  .side {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--panel);
    box-shadow: 0 2px 0 rgba(10, 30, 46, 0.5);
    border-radius: 999px;
    padding: 3px 10px 3px 7px;
    font-size: 14px;
    flex: none;
    max-width: 150px;
    border: 2px solid transparent;
  }
  .side.mine {
    border-color: #fff;
  }
  .side.out {
    opacity: 0.45;
    text-decoration: line-through;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
