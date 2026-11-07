<script lang="ts">
  import { colorHex, type RoomView } from '@tb/shared';
  import EyeIcon from './EyeIcon.svelte';

  let { view, onWatch }: { view: RoomView; onWatch: (battleId: number) => void } = $props();
  const game = $derived(view.game!);
  const me = $derived(game.players.find((p) => p.id === view.you));
  const mySide = $derived(game.sides.find((s) => s.id === me?.sideId));
  const b = $derived(game.myBattle);
  const iWon = $derived(b?.winner === view.you);
  const sittingOut = $derived(game.sittingOut.includes(view.you));
  const live = $derived(game.battles.filter((x) => !x.finished).length);

  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name ?? '';
  const colorOf = (id: string) => {
    const side = game.sides.find((s) => s.id === game.players.find((p) => p.id === id)?.sideId);
    return side ? colorHex(side.color) : '#fff';
  };
</script>

<section class="column panel wrap rise">
  {#if mySide?.eliminated}
    <h2>You're out</h2>
    <p class="soft">Stay and watch the rest of the battle for the map.</p>
  {:else if sittingOut}
    <h2>You sit out this wave</h2>
    <p class="soft">Rounds this wave are all paired up. You're back next wave.</p>
  {:else if b}
    <h2 class={iWon ? 'won' : 'lost'}>{iWon ? 'Round won!' : 'Round lost'}</h2>
    <p class="result">
      <b>{b.myScore} - {b.opponentScore}</b>
      {#if b.sudden}<span class="soft">after sudden death</span>{/if}
      {#if b.forfeit}<span class="soft">{nameOf(b.opponentId)} left</span>{/if}
      {#if iWon}<span class="credit"><i class="coin"></i>+1</span>{/if}
    </p>
  {/if}

  <h3 class="soft">
    {live > 0 ? `Waiting for ${live} ${live === 1 ? 'round' : 'rounds'}` : 'All rounds finished'}
  </h3>
  <ul>
    {#each game.battles as x (x.id)}
      <li class:done={x.finished}>
        <span class="who" class:win={x.winner === x.a}><i class="hex" style="--c:{colorOf(x.a)}"></i><span class="name">{nameOf(x.a)}</span></span>
        <span class="mid">
          <b>{x.scoreA} - {x.scoreB}</b>
          <small class="soft">{x.finished ? 'Final' : x.sudden ? 'Sudden death' : x.question < 1 ? 'Starting' : `Q${x.question}`}</small>
        </span>
        <span class="who right" class:win={x.winner === x.b}><span class="name">{nameOf(x.b)}</span><i class="hex" style="--c:{colorOf(x.b)}"></i></span>
        {#if x.finished}
          <span></span>
        {:else}
          <button class="eye chip-btn" onclick={() => onWatch(x.id)} aria-label="Watch {nameOf(x.a)} against {nameOf(x.b)}"><EyeIcon /></button>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 56dvh;
    overflow-y: auto;
  }
  h2 {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.1;
  }
  .won {
    color: var(--gold);
  }
  .lost {
    color: #ffb3b1;
  }
  .result {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
  }
  .credit {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-weight: 700;
    color: var(--gold);
    margin-left: auto;
  }
  .coin {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: inset 0 0 0 3px #ffe08a;
    display: inline-block;
  }
  h3 {
    font-size: 15px;
    font-weight: 600;
    margin-top: 6px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 5px;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) 32px;
    gap: 6px;
    align-items: center;
    background: var(--panel-2);
    border-radius: 10px;
    padding: 5px 9px;
    font-size: 15px;
  }
  li.done {
    opacity: 0.72;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }
  .who.right {
    justify-content: flex-end;
  }
  .who.win {
    font-weight: 700;
    color: var(--gold);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mid {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }
  small {
    font-size: 12px;
  }
  .eye {
    appearance: none;
    position: relative;
    border: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--blue);
    box-shadow: 0 2px 0 var(--blue-edge);
    color: #fff;
    cursor: pointer;
    display: grid;
    place-items: center;
    font-size: 15px;
    padding: 0;
    touch-action: manipulation;
  }
  .eye:active {
    transform: translateY(2px);
    box-shadow: none;
  }
  /* Small to look at, but still easy to hit with a thumb. */
  .eye::after {
    content: '';
    position: absolute;
    inset: -6px;
  }
</style>
