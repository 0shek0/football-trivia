<script lang="ts">
  import { colorHex, LIMITS, type RoomView } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';

  let { view }: { view: RoomView } = $props();
  const game = $derived(view.game!);
  const mySide = $derived(game.sides.find((s) => s.id === game.players.find((p) => p.id === view.you)?.sideId));
  const secs = $derived(app.secondsLeft(app.phaseDeadline));
  let name = $state('');
  const canSubmit = $derived(name.trim().length >= LIMITS.teamName.min);

  function submit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    haptic();
    app.send({ t: 'teamName', name: name.trim() });
  }
</script>

<section class="column panel wrap rise">
  <div class="head">
    <h2 class="title">Name your teams</h2>
    <b class="time" class:low={secs <= 10}>{secs}s</b>
  </div>

  {#if game.namingFor}
    <form onsubmit={submit}>
      <label for="team-name" class="soft">You were picked to name your team</label>
      <input id="team-name" class="field" bind:value={name} maxlength={LIMITS.teamName.max} placeholder="Team name" autocomplete="off" enterkeyhint="done" />
      <button class="btn go wide" disabled={!canSubmit}>Confirm name</button>
    </form>
    <p class="soft small">If time runs out, your team gets a random name.</p>
  {:else}
    <ul>
      {#each game.sides as s (s.id)}
        <li style="--c:{colorHex(s.color)}" class:mine={s.id === mySide?.id}>
          <i class="hex"></i>
          {#if s.named}<b>{s.name}</b>{:else}<span class="soft">Choosing a name...</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .title {
    font-size: 22px;
    font-weight: 700;
  }
  .time {
    font-size: 22px;
    color: var(--gold);
  }
  .time.low {
    color: #ff9c9a;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .small {
    font-size: 14px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--panel-2);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 17px;
  }
  li.mine {
    background: var(--panel-3);
  }
</style>
