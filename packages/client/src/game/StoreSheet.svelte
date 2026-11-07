<script lang="ts">
  import type { RoomView } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';

  let { view, onClose }: { view: RoomView; onClose: () => void } = $props();
  const game = $derived(view.game!);
  const owned = (id: string) => game.inventory.filter((x) => x === id).length;
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>
<div class="sheet rise" role="dialog" aria-label="Store">
  <header>
    <h2>Store</h2>
    <span class="balance"><i class="coin"></i><b>{game.credits}</b></span>
    <button class="btn quiet small" onclick={onClose}>Close</button>
  </header>

  {#if game.store.length === 0}
    <div class="empty">
      <i class="hex" style="--c:var(--gold)"></i>
      <p><b>New items are coming soon</b></p>
      <p class="soft">Keep your credits. Every round you win earns 1.</p>
    </div>
  {:else}
    <ul>
      {#each game.store as item (item.id)}
        <li>
          <div class="info">
            <b>{item.name}{owned(item.id) ? ` x${owned(item.id)}` : ''}</b>
            <span class="soft">{item.description}</span>
          </div>
          <button class="btn gold small" disabled={game.credits < item.cost} onclick={() => { haptic(); app.send({ t: 'buy', itemId: item.id }); }}>
            <i class="coin"></i> {item.cost}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(10, 30, 46, 0.5);
    z-index: 20;
  }
  .sheet {
    position: absolute;
    left: 50%;
    bottom: 0;
    translate: -50% 0;
    width: 100%;
    max-width: 520px;
    max-height: 70dvh;
    overflow-y: auto;
    background: var(--panel);
    border-radius: 22px 22px 0 0;
    padding: 14px 16px calc(18px + var(--safe-bottom));
    z-index: 21;
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  h2 {
    font-size: 24px;
    font-weight: 700;
  }
  .balance {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 19px;
    margin-right: auto;
  }
  .coin {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: inset 0 0 0 3px #ffe08a;
    display: inline-block;
  }
  .empty {
    text-align: center;
    padding: 18px 0 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }
  .empty .hex {
    font-size: 40px;
    margin-bottom: 6px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  li {
    display: flex;
    gap: 10px;
    align-items: center;
    background: var(--panel-2);
    border-radius: 12px;
    padding: 10px;
  }
  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
</style>
