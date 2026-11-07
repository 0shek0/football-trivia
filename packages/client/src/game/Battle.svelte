<script lang="ts">
  import type { RoomView } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';
  import RoundBoard from './RoundBoard.svelte';

  let { view }: { view: RoomView } = $props();

  const game = $derived(view.game!);
  const b = $derived(game.myBattle!);
  const opponentName = $derived(game.players.find((p) => p.id === b.opponentId)?.name ?? '');

  const questionKey = $derived(`${b.id}-${b.sudden}-${b.question}`);

  // The tap shows immediately, before the server has confirmed it.
  let tapped = $state<{ key: string; option: number } | null>(null);
  const picked = $derived(b.myAnswer ?? (tapped?.key === questionKey ? tapped.option : null));

  function answer(option: number) {
    if (b.stage !== 'question' || picked !== null) return;
    tapped = { key: questionKey, option };
    haptic();
    app.send({ t: 'answer', battleId: b.id, question: b.question, option });
  }

  function optionState(i: number): string {
    if (b.stage === 'reveal') {
      if (i === b.correct) return 'right';
      if (i === picked) return 'wrong';
      return 'dim';
    }
    if (picked === null) return '';
    return i === picked ? 'picked' : 'dim';
  }
</script>

<RoundBoard
  {game}
  battleId={b.id}
  left={{ id: view.you, name: 'You', score: b.myScore }}
  right={{ id: b.opponentId, name: opponentName, score: b.opponentScore }}
  stage={b.stage}
  question={b.question}
  sudden={b.sudden}
  text={b.text}
  options={b.options}
  msLeft={b.msLeft}
  {optionState}
  onOption={answer}
>
  {#snippet status()}
    {#if b.stage === 'reveal'}
      {#if b.correct === b.opponentAnswer}
        <span class="op-right">{opponentName} got it right</span>
      {:else if b.opponentAnswer === null}
        <span>{opponentName} ran out of time</span>
      {:else}
        <span>{opponentName} got it wrong</span>
      {/if}
    {:else if b.opponentAnswered}
      <span class="op-right">{opponentName} has answered</span>
    {:else if picked !== null}
      <span>Waiting for {opponentName}...</span>
    {/if}
  {/snippet}
</RoundBoard>

<style>
  .op-right {
    color: var(--gold);
  }
</style>
