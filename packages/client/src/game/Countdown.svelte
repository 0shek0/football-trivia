<script lang="ts">
  import { colorHex, type RoomView } from '@tb/shared';
  import { app } from '../lib/store.svelte';

  let { view }: { view: RoomView } = $props();
  const game = $derived(view.game!);
  const side = $derived(game.sides.find((s) => s.id === game.players.find((p) => p.id === view.you)?.sideId));
  const secs = $derived(app.secondsLeft(app.phaseDeadline));
</script>

<section class="column panel center rise">
  <p class="soft">First battles start in</p>
  {#key secs}<div class="big pop">{secs}</div>{/key}
  {#if side}
    <p class="you"><i class="hex" style="--c:{colorHex(side.color)}"></i> Your land: <b>{side.name}</b>, {side.tiles} hexagons</p>
  {/if}
  <p class="soft small">Win rounds to capture rival land. Own every hexagon to win.</p>
</section>

<style>
  .center {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }
  .big {
    font-size: 76px;
    font-weight: 700;
    line-height: 1;
    color: var(--gold);
    text-shadow: 0 5px 0 var(--gold-edge);
    margin: 4px 0 8px;
  }
  .you {
    font-size: 17px;
    font-weight: 600;
  }
  .small {
    font-size: 15px;
    margin-top: 2px;
  }
</style>
