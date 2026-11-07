<script lang="ts">
  import type { Snippet } from 'svelte';
  import { colorHex, LIMITS, type BattleStage, type GameView } from '@tb/shared';
  import { app } from '../lib/store.svelte';

  interface Fighter {
    id: string;
    name: string;
    score: number;
  }

  // The round on screen, shared by the player's own round and the spectator's view of one.
  let {
    game,
    battleId,
    left,
    right,
    stage,
    question,
    sudden,
    text,
    options,
    msLeft,
    optionState,
    onOption,
    status,
    top,
    mark,
    finished,
  }: {
    game: GameView;
    battleId: number;
    left: Fighter;
    right: Fighter;
    stage: BattleStage;
    question: number;
    sudden: boolean;
    text: string | null;
    options: string[] | null;
    msLeft: number;
    optionState: (i: number) => string;
    onOption?: (i: number) => void;
    status: Snippet;
    top?: Snippet;
    mark?: Snippet<[number]>;
    finished?: Snippet;
  } = $props();

  const sideColor = (id: string) => {
    const sideId = game.players.find((p) => p.id === id)?.sideId;
    const side = game.sides.find((s) => s.id === sideId);
    return side ? colorHex(side.color) : '#fff';
  };

  const questionKey = $derived(`${battleId}-${sudden}-${question}`);
  const totalMs = $derived(game.questionTimeSec * 1000);

  const secs = $derived(app.secondsLeft(app.battleDeadline));
  const lowTime = $derived(stage === 'question' && secs <= 3);
  // Set once per question, so the bar animates smoothly and survives reconnects.
  let barDelay = $state(0);
  let barKey = $state('');
  $effect.pre(() => {
    if (stage === 'question' && barKey !== questionKey) {
      barKey = questionKey;
      barDelay = Math.max(0, totalMs - msLeft);
    }
  });

  const scorePips = Array.from({ length: LIMITS.questionsPerSet });
</script>

<div class="battle" class:sudden>
  <div class="inner">
    {@render top?.()}

    <header class="versus">
      <div class="fighter">
        <i class="hex" style="--c:{sideColor(left.id)}"></i>
        <span class="name">{left.name}</span>
        <b class="score">{left.score}</b>
      </div>
      <div class="middle">
        {#if sudden}
          <span class="round-label death">SUDDEN DEATH</span>
        {:else}
          <span class="round-label">{Math.max(1, question)} / {LIMITS.questionsPerSet}</span>
          <span class="pips" aria-hidden="true">
            {#each scorePips as _, i (i)}<i class:done={i < question - (stage === 'question' ? 1 : 0)} class:now={i === question - 1 && stage === 'question'}></i>{/each}
          </span>
        {/if}
      </div>
      <div class="fighter right">
        <b class="score">{right.score}</b>
        <span class="name">{right.name}</span>
        <i class="hex" style="--c:{sideColor(right.id)}"></i>
      </div>
    </header>

    {#if stage === 'intro'}
      <div class="intro">
        <div class="pop vs-name" style="--c:{sideColor(left.id)}"><i class="hex"></i> {left.name}</div>
        <div class="vs pop">VS</div>
        <div class="pop vs-name" style="--c:{sideColor(right.id)}"><i class="hex"></i> {right.name}</div>
        <p class="soft stakes">The loser gives up {game.cost} {game.cost === 1 ? 'hexagon' : 'hexagons'}</p>
      </div>
    {:else if stage === 'finished'}
      {@render finished?.()}
    {:else}
      <div class="timer" class:low={lowTime} aria-hidden="true">
        {#if stage === 'question'}
          {#key questionKey}
            <div class="fill" style="animation-duration:{totalMs}ms;animation-delay:-{barDelay}ms"></div>
          {/key}
        {/if}
      </div>

      {#key questionKey}
        <div class="card rise">
          <div class="clock" class:low={lowTime}>{stage === 'question' ? secs : ''}</div>
          <h2 lang="ar" dir="rtl">{text}</h2>
        </div>
      {/key}

      <div class="status" aria-live="polite">
        {@render status()}
      </div>

      <div class="options" class:marked={!!mark}>
        {#each options ?? [] as option, i (questionKey + i)}
          <button
            class="option {optionState(i)}"
            onpointerdown={() => onOption?.(i)}
            onclick={() => onOption?.(i)}
            disabled={stage !== 'question' || !onOption}
          >
            <span lang="ar" dir="rtl">{option}</span>
            {@render mark?.(i)}
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
  .options {
    display: grid;
    gap: 9px;
    flex: none;
  }
  /* Room for the marks that sit on the top edge of the first answers. */
  .options.marked {
    margin-top: 8px;
  }
  .option {
    appearance: none;
    position: relative;
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
