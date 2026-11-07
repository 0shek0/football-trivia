<script lang="ts">
  let { cost }: { cost: number } = $props();
</script>

<!-- Fades itself out; Game.svelte removes it once the animation is over. -->
<div class="alert" role="status">
  <span class="label">Stakes raised!</span>
  <span class="amount"><b>{cost}</b><i class="hex" style="--c:var(--gold)"></i></span>
  <span class="line">Win or lose {cost} hexagons a round</span>
</div>

<style>
  .alert {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 60;
    translate: -50% -50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: max-content;
    max-width: calc(100vw - 32px);
    background: var(--ink);
    border: 3px solid var(--gold);
    border-radius: var(--radius);
    box-shadow: 0 6px 0 var(--gold-edge), 0 14px 40px rgba(0, 0, 0, 0.45);
    padding: 12px 26px 14px;
    text-align: center;
    pointer-events: none;
    animation: alert-life 2600ms ease-out both;
  }
  .label {
    color: var(--gold);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .amount {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 46px;
    line-height: 1.05;
  }
  .amount b {
    font-weight: 700;
  }
  .line {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-soft);
  }
  @keyframes alert-life {
    0% {
      opacity: 0;
      transform: scale(0.6);
    }
    9% {
      opacity: 1;
      transform: scale(1.08);
    }
    15% {
      transform: scale(1);
    }
    85% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(0.94);
    }
  }
  @keyframes alert-fade {
    0%,
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .alert {
      animation-name: alert-fade;
    }
  }
</style>
