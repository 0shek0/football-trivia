<script lang="ts">
  import { colorHex, type BattleSummary, type RoomView } from '@tb/shared';
  import EyeIcon from './EyeIcon.svelte';
  import RoundBoard from './RoundBoard.svelte';

  let { view, round, onBack }: { view: RoomView; round: BattleSummary; onBack: () => void } = $props();

  const game = $derived(view.game!);
  // Empty for a moment after the eye is pressed, until the server's answer arrives.
  const live = $derived(game.spectating?.id === round.id ? game.spectating : null);
  const stage = $derived(round.finished ? 'finished' : (live?.stage ?? 'reveal'));

  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name ?? '';
  const colorOf = (id: string) => {
    const side = game.sides.find((s) => s.id === game.players.find((p) => p.id === id)?.sideId);
    return side ? colorHex(side.color) : '#fff';
  };

  const picks = $derived([
    { id: round.a, answer: live?.answerA ?? null },
    { id: round.b, answer: live?.answerB ?? null },
  ]);
  const rightNames = $derived(live ? picks.filter((p) => p.answer === live.correct).map((p) => nameOf(p.id)) : []);
  const stillThinking = $derived(picks.filter((p) => p.answer === null).map((p) => nameOf(p.id)));
  const loser = $derived(round.winner === round.a ? round.b : round.a);

  function optionState(i: number): string {
    if (stage !== 'reveal' || !live) return '';
    if (i === live.correct) return 'right';
    return picks.some((p) => p.answer === i) ? 'wrong' : 'dim';
  }
</script>

<RoundBoard
  {game}
  battleId={round.id}
  left={{ id: round.a, name: nameOf(round.a), score: round.scoreA }}
  right={{ id: round.b, name: nameOf(round.b), score: round.scoreB }}
  {stage}
  question={round.question}
  sudden={round.sudden}
  text={live?.text ?? null}
  options={live?.options ?? null}
  msLeft={live?.msLeft ?? 0}
  {optionState}
>
  {#snippet top()}
    <div class="bar">
      <button class="btn quiet small back" onclick={onBack}>
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        Back to map
      </button>
      <span class="soft watching"><EyeIcon /> Watching</span>
    </div>
  {/snippet}

  {#snippet status()}
    {#if stage === 'reveal' && live}
      {#if rightNames.length === 2}
        <span class="gold">Both got it right</span>
      {:else if rightNames.length === 1}
        <span class="gold">{rightNames[0]} got it right</span>
      {:else}
        <span>Nobody got it right</span>
      {/if}
    {:else if stage === 'question' && stillThinking.length === 1}
      <span>Waiting for {stillThinking[0]}...</span>
    {/if}
  {/snippet}

  {#snippet mark(i: number)}
    {@const here = picks.filter((p) => p.answer === i)}
    {#if here.length}
      <span class="capsules">
        {#each here as p (p.id)}
          <span class="capsule pop"><i class="hex" style="--c:{colorOf(p.id)}"></i><span class="who" dir="auto">{nameOf(p.id)}</span></span>
        {/each}
      </span>
    {/if}
  {/snippet}

  {#snippet finished()}
    <div class="final rise">
      {#if round.winner}
        <h2><i class="hex" style="--c:{colorOf(round.winner)}"></i> {nameOf(round.winner)} won the round</h2>
      {:else}
        <h2>Round over</h2>
      {/if}
      <b class="score">{round.scoreA} - {round.scoreB}</b>
      {#if live?.forfeit && round.winner}
        <p class="soft">{nameOf(loser)} left</p>
      {:else if round.sudden}
        <p class="soft">After sudden death</p>
      {/if}
      <button class="btn go wide" onclick={onBack}>Back to map</button>
    </div>
  {/snippet}
</RoundBoard>

<style>
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex: none;
    margin-bottom: 8px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .watching {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    font-weight: 600;
  }
  .gold {
    color: var(--gold);
  }
  .capsules {
    position: absolute;
    top: -9px;
    inset-inline-start: 8px;
    max-width: calc(100% - 16px);
    display: flex;
    gap: 4px;
    pointer-events: none;
  }
  .capsule {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    background: var(--ink);
    border: 2px solid #fff;
    border-radius: 999px;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    padding: 1px 8px 1px 5px;
  }
  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .final {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
  }
  .final h2 {
    font-size: 24px;
    font-weight: 700;
    color: var(--gold);
  }
  .score {
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
  }
  .final .btn {
    max-width: 320px;
    margin-top: 10px;
  }
  @media (max-height: 420px) {
    .bar {
      margin-bottom: 4px;
    }
    .back {
      min-height: 34px;
    }
  }
</style>
