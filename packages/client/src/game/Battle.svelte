<script lang="ts">
  import { colorHex, LIMITS, type RoomView } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';

  let { view }: { view: RoomView } = $props();

  const game = $derived(view.game!);
  const b = $derived(game.myBattle!);
  const playerName = (id: string) => game.players.find((p) => p.id === id)?.name ?? '';
  const sideColor = (id: string) => {
    const sideId = game.players.find((p) => p.id === id)?.sideId;
    const side = game.sides.find((s) => s.id === sideId);
    return side ? colorHex(side.color) : '#fff';
  };

  const questionKey = $derived(`${b.id}-${b.sudden}-${b.question}`);
  const totalMs = $derived(game.questionTimeSec * 1000);

  // The tap shows immediately, before the server has confirmed it.
  let tapped = $state<{ key: string; option: number } | null>(null);
  const picked = $derived(b.myAnswer ?? (tapped?.key === questionKey ? tapped.option : null));

  const secs = $derived(app.secondsLeft(app.battleDeadline));
  const lowTime = $derived(b.stage === 'question' && secs <= 3);
  // Set once per question, so the bar animates smoothly and survives reconnects.
  let barDelay = $state(0);
  let barKey = $state('');
  $effect.pre(() => {
    if (b.stage === 'question' && barKey !== questionKey) {
      barKey = questionKey;
      barDelay = Math.max(0, totalMs - b.msLeft);
    }
  });

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

  const scorePips = Array.from({ length: LIMITS.questionsPerSet });
</script>

<div class="battle" class:sudden={b.sudden}>
  <div class="inner">
    <header class="versus">
      <div class="fighter">
        <i class="hex" style="--c:{sideColor(view.you)}"></i>
        <span class="name">You</span>
        <b class="score">{b.myScore}</b>
      </div>
      <div class="middle">
        {#if b.sudden}
          <span class="round-label death">SUDDEN DEATH</span>
        {:else}
          <span class="round-label">{Math.max(1, b.question)} / {LIMITS.questionsPerSet}</span>
          <span class="pips" aria-hidden="true">
            {#each scorePips as _, i (i)}<i class:done={i < b.question - (b.stage === 'question' ? 1 : 0)} class:now={i === b.question - 1 && b.stage === 'question'}></i>{/each}
          </span>
        {/if}
      </div>
      <div class="fighter right">
        <b class="score">{b.opponentScore}</b>
        <span class="name">{playerName(b.opponentId)}</span>
        <i class="hex" style="--c:{sideColor(b.opponentId)}"></i>
      </div>
    </header>

    {#if b.stage === 'intro'}
      <div class="intro">
        <div class="pop vs-name" style="--c:{sideColor(view.you)}"><i class="hex"></i> You</div>
        <div class="vs pop">VS</div>
        <div class="pop vs-name" style="--c:{sideColor(b.opponentId)}"><i class="hex"></i> {playerName(b.opponentId)}</div>
        <p class="soft stakes">The loser gives up {game.cost} {game.cost === 1 ? 'hexagon' : 'hexagons'}</p>
      </div>
    {:else}
      <div class="timer" class:low={lowTime} aria-hidden="true">
        {#if b.stage === 'question'}
          {#key questionKey}
            <div class="fill" style="animation-duration:{totalMs}ms;animation-delay:-{barDelay}ms"></div>
          {/key}
        {/if}
      </div>

      {#key questionKey}
        <div class="card rise">
          <div class="clock" class:low={lowTime}>{b.stage === 'question' ? secs : ''}</div>
          <h2 lang="ar" dir="rtl">{b.text}</h2>
        </div>
      {/key}

      <div class="status" aria-live="polite">
        {#if b.stage === 'reveal'}
          {#if b.correct === b.opponentAnswer}
            <span class="op-right">{playerName(b.opponentId)} got it right</span>
          {:else if b.opponentAnswer === null}
            <span>{playerName(b.opponentId)} ran out of time</span>
          {:else}
            <span>{playerName(b.opponentId)} got it wrong</span>
          {/if}
        {:else if b.opponentAnswered}
          <span class="op-right">{playerName(b.opponentId)} has answered</span>
        {:else if picked !== null}
          <span>Waiting for {playerName(b.opponentId)}...</span>
        {/if}
      </div>

      <div class="options">
        {#each b.options ?? [] as option, i (questionKey + i)}
          <button
            class="option {optionState(i)}"
            onpointerdown={() => answer(i)}
            onclick={() => answer(i)}
            disabled={b.stage !== 'question'}
          >
            <span lang="ar" dir="rtl">{option}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .battle {
    position: absolute;
    inset: 0;
    background: var(--ink);
    display: flex;
    justify-content: center;
    padding: calc(10px + var(--safe-top)) 14px calc(14px + var(--safe-bottom));
    transition: background 200ms;
  }
  .battle.sudden {
    background: #46101a;
  }
  .inner {
    width: 100%;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .versus {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    flex: none;
  }
  .fighter {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .fighter.right {
    justify-content: flex-end;
  }
  .fighter .hex {
    font-size: 18px;
  }
  .fighter .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .score {
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
  }
  .middle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .round-label {
    color: var(--text-soft);
    font-size: 14px;
    font-weight: 600;
  }
  .round-label.death {
    color: #ffd4d3;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .pips {
    display: flex;
    gap: 3px;
  }
  .pips i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--panel-3);
  }
  .pips i.done {
    background: var(--text-soft);
  }
  .pips i.now {
    background: var(--gold);
  }
  .intro {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
  }
  .vs {
    font-size: 64px;
    font-weight: 700;
    color: var(--gold);
    line-height: 1;
    text-shadow: 0 5px 0 var(--gold-edge);
    margin: 6px 0;
  }
  .vs-name {
    font-size: 26px;
    font-weight: 700;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .stakes {
    margin-top: 16px;
    font-size: 16px;
  }
  .timer {
    height: 10px;
    border-radius: 999px;
    background: var(--panel-2);
    overflow: hidden;
    margin: 10px 0 12px;
    flex: none;
  }
  .fill {
    height: 100%;
    width: 100%;
    background: var(--go);
    border-radius: inherit;
    transform-origin: left center;
    /* Transform-only, so it stays smooth even if the page is busy */
    animation-name: drain;
    animation-timing-function: linear;
    animation-fill-mode: both;
  }
  .timer.low .fill {
    background: var(--bad);
  }
  @keyframes drain {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }
  .card {
    position: relative;
    flex: 1 1 auto;
    min-height: 90px;
    background: var(--panel);
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 34px 16px 18px;
    text-align: center;
    overflow-y: auto;
  }
  .sudden .card {
    background: #6b1f2a;
  }
  h2 {
    font-size: clamp(20px, 5.6vw, 27px);
    font-weight: 600;
    line-height: 1.22;
  }
  .clock {
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 19px;
    font-weight: 700;
    color: var(--text-soft);
  }
  .clock.low {
    color: #ff9c9a;
  }
  .status {
    min-height: 30px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-soft);
    font-size: 15px;
    font-weight: 600;
    text-align: center;
  }
  .op-right {
    color: var(--gold);
  }
  .options {
    display: grid;
    gap: 9px;
    flex: none;
  }
  .option {
    appearance: none;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--blue);
    box-shadow: 0 5px 0 var(--blue-edge);
    color: #fff;
    cursor: pointer;
    font: inherit;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.15;
    min-height: 58px;
    padding: 8px 14px;
    margin-bottom: 4px;
    touch-action: manipulation;
    transition: transform 50ms ease-out, box-shadow 50ms ease-out, background 90ms, opacity 90ms;
  }
  .option:active:not(:disabled),
  .option.picked {
    transform: translateY(4px);
    box-shadow: 0 1px 0 var(--blue-edge);
  }
  .option:disabled {
    cursor: default;
  }
  .option.picked {
    background: var(--gold);
    box-shadow: 0 1px 0 var(--gold-edge);
    color: var(--ink);
  }
  .option.dim {
    opacity: 0.45;
  }
  .option.right {
    background: var(--go);
    box-shadow: 0 5px 0 var(--go-edge);
    /* Scale only: the right answer must stay visible even if animations stall. */
    animation: answer-pop 180ms cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  @keyframes answer-pop {
    from {
      transform: scale(0.94);
    }
    to {
      transform: scale(1);
    }
  }
  .option.wrong {
    background: var(--bad);
    box-shadow: 0 5px 0 var(--bad-edge);
  }

  /* Short landscape screens: two columns so answers still fit */
  @media (max-height: 520px), (min-width: 700px) {
    .options {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-height: 420px) {
    .option {
      min-height: 44px;
      font-size: 16px;
    }
    h2 {
      font-size: 18px;
    }
    .card {
      padding: 8px 40px 8px 12px;
    }
    .timer {
      margin: 6px 0;
    }
    .status {
      min-height: 22px;
    }
  }
</style>
