<script lang="ts">
  import { COLORS, colorHex, LIMITS, type GameSettings, type RoomView } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';

  let { view }: { view: RoomView } = $props();

  const lobby = $derived(view.lobby!);
  const me = $derived(lobby.players.find((p) => p.id === view.you)!);
  const isHost = $derived(view.hostId === view.you);
  const s = $derived(lobby.settings);
  const teams = $derived(s.mode === 'teams');
  const myColor = $derived(teams ? lobby.teamColors[me.team] : me.color);
  const takenColors = $derived(new Set(teams ? lobby.teamColors : lobby.players.map((p) => p.color)));

  let tab = $state<'room' | 'settings'>('room');
  let shared = $state('');

  const inviteUrl = $derived(`${location.origin}/?room=${view.code}`);

  async function share() {
    haptic();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Trivia Battle', text: `Join my Trivia Battle room: ${view.code}`, url: inviteUrl });
        return;
      } catch {
        // Cancelled, or sharing isn't available here. Fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      shared = 'Link copied';
    } catch {
      shared = `Code: ${view.code}`;
    }
    setTimeout(() => (shared = ''), 2000);
  }

  const set = (patch: Partial<GameSettings>) => app.send({ t: 'settings', settings: patch });

  const steppers = $derived([
    { key: 'startingTiles', label: 'Starting hexagons per player', value: s.startingTiles, ...LIMITS.startingTiles, step: 1, unit: '' },
    { key: 'questionTimeSec', label: 'Time per question', value: s.questionTimeSec, ...LIMITS.questionTimeSec, step: 5, unit: ' s' },
    { key: 'roundsPerCostIncrease', label: 'Rounds per player before losing costs more', value: s.roundsPerCostIncrease, ...LIMITS.roundsPerCostIncrease, step: 1, unit: '' },
  ] as const);
</script>

<div class="screen lobby">
  <header class="column top">
    <button class="btn quiet small" onclick={() => app.leave()}>Leave</button>
    <button class="code-chip" onclick={share} aria-label="Share room code {view.code}">
      <span class="soft">Room code</span>
      <b>{view.code}</b>
    </button>
    <button class="btn gold small" onclick={share}>{shared || 'Invite'}</button>
  </header>

  <div class="spacer"></div>

  <section class="column panel sheet rise">
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'room'} class:active={tab === 'room'} onclick={() => (tab = 'room')}>
        Players <span class="count">{lobby.players.length}/{LIMITS.maxPlayers}</span>
      </button>
      <button role="tab" aria-selected={tab === 'settings'} class:active={tab === 'settings'} onclick={() => (tab = 'settings')}>
        Settings
      </button>
    </div>

    <div class="scroll">
      {#if tab === 'room'}
        {#if teams}
          <div class="teams" style="--n:{s.teamCount}">
            {#each lobby.teamColors as color, i (i)}
              {@const members = lobby.players.filter((p) => p.team === i)}
              <div class="team" class:mine={me.team === i} style="--c:{colorHex(color)}">
                <h3><i class="hex"></i> Team {i + 1} <span class="soft">{members.length}/{LIMITS.maxTeamSize}</span></h3>
                {#each members as p (p.id)}
                  <div class="member" class:away={!p.connected}>
                    <span class="tick" class:on={p.ready || p.id === view.hostId}></span>
                    <span class="name">{p.name}</span>
                    {#if p.id === view.hostId}<span class="tag">Host</span>{/if}
                  </div>
                {/each}
                {#if me.team !== i}
                  <button class="btn quiet small wide" disabled={members.length >= LIMITS.maxTeamSize} onclick={() => { haptic(); app.send({ t: 'team', team: i }); }}>Switch</button>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <ul class="players">
            {#each lobby.players as p (p.id)}
              <li class:away={!p.connected} class:you={p.id === view.you} style="--c:{colorHex(p.color)}">
                <i class="hex big"></i>
                <span class="name">{p.name}{p.id === view.you ? ' (you)' : ''}</span>
                {#if p.id === view.hostId}<span class="tag">Host</span>
                {:else if p.ready}<span class="tag ready">Ready</span>
                {:else}<span class="tag wait">Not ready</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}

        <h3 class="label">{teams ? "Your team's color" : 'Your color'}</h3>
        <div class="colors">
          {#each COLORS as c (c.id)}
            {@const taken = takenColors.has(c.id) && c.id !== myColor}
            <button
              class="swatch chip-btn"
              class:selected={c.id === myColor}
              disabled={taken}
              style="--c:{c.hex}"
              aria-label="{c.name}{taken ? ', taken' : ''}"
              aria-pressed={c.id === myColor}
              onclick={() => { haptic(); app.send({ t: 'color', color: c.id }); }}
            ><i class="hex"></i></button>
          {/each}
        </div>
      {:else}
        {#if !isHost}<p class="soft note">Only the host can change these.</p>{/if}
        <h3 class="label first">Game mode</h3>
        <div class="segment">
          <button class:active={s.mode === 'solo'} disabled={!isHost} onclick={() => set({ mode: 'solo' })}>Solo</button>
          <button class:active={s.mode === 'teams'} disabled={!isHost} onclick={() => set({ mode: 'teams' })}>Teams</button>
        </div>

        {#if teams}
          <h3 class="label">Number of teams</h3>
          <div class="segment">
            {#each LIMITS.teamCounts as n (n)}
              <button class:active={s.teamCount === n} disabled={!isHost} onclick={() => set({ teamCount: n })}>{n}</button>
            {/each}
          </div>
        {/if}

        {#each steppers as st (st.key)}
          <div class="stepper">
            <span class="step-label">{st.label}</span>
            <div class="step-controls">
              <button class="btn quiet small" aria-label="Less" disabled={!isHost || st.value <= st.min} onclick={() => set({ [st.key]: st.value - st.step })}>-</button>
              <b>{st.value}{st.unit}</b>
              <button class="btn quiet small" aria-label="More" disabled={!isHost || st.value >= st.max} onclick={() => set({ [st.key]: st.value + st.step })}>+</button>
            </div>
          </div>
        {/each}
        <p class="soft note">Map size: <b>{lobby.mapSize}</b> hexagons</p>
      {/if}
    </div>

    <footer>
      {#if isHost}
        <button class="btn go wide" disabled={!!lobby.startError} onclick={() => { haptic(20); app.send({ t: 'start' }); }}>
          {lobby.startError ?? 'Start game'}
        </button>
      {:else}
        <button class="btn wide" class:go={!me.ready} class:quiet={me.ready} onclick={() => { haptic(); app.send({ t: 'ready', ready: !me.ready }); }}>
          {me.ready ? "Ready! Tap to cancel" : "I'm ready"}
        </button>
      {/if}
    </footer>
  </section>
</div>

<style>
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .code-chip {
    appearance: none;
    border: 0;
    background: var(--panel);
    box-shadow: 0 4px 0 rgba(10, 30, 46, 0.55);
    border-radius: var(--radius-sm);
    color: #fff;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    font: inherit;
    padding: 4px 14px 5px;
    line-height: 1.1;
  }
  .code-chip span {
    font-size: 11px;
  }
  .code-chip b {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--gold);
    -webkit-user-select: all;
    user-select: all;
  }
  .spacer {
    flex: 1;
    pointer-events: none;
    min-height: 24px;
  }
  .sheet {
    display: flex;
    flex-direction: column;
    max-height: 62dvh;
    padding: 10px 12px 8px;
    min-height: 0;
  }
  .tabs {
    display: flex;
    gap: 6px;
    background: var(--ink);
    border-radius: var(--radius-sm);
    padding: 4px;
    flex: none;
  }
  .tabs button,
  .segment button {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--text-soft);
    cursor: pointer;
    flex: 1;
    font: inherit;
    font-weight: 600;
    min-height: 40px;
    border-radius: 9px;
    touch-action: manipulation;
  }
  .tabs button.active,
  .segment button.active {
    background: var(--blue);
    color: #fff;
  }
  .segment {
    display: flex;
    gap: 4px;
    background: var(--ink);
    border-radius: var(--radius-sm);
    padding: 4px;
  }
  .segment button:disabled {
    cursor: default;
  }
  .count {
    opacity: 0.75;
    font-size: 14px;
  }
  .scroll {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px 2px;
    flex: 1;
    min-height: 0;
  }
  .players {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 5px;
  }
  .players li {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--panel-2);
    border-radius: 10px;
    padding: 6px 10px;
    min-height: 42px;
  }
  .players li.you {
    background: var(--panel-3);
  }
  .away {
    opacity: 0.5;
  }
  .hex.big {
    font-size: 22px;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .tag {
    font-size: 13px;
    font-weight: 600;
    background: var(--gold);
    color: var(--ink);
    padding: 2px 8px;
    border-radius: 999px;
    flex: none;
  }
  .tag.ready {
    background: var(--go);
    color: #fff;
  }
  .tag.wait {
    background: transparent;
    color: var(--text-soft);
    padding: 0;
  }
  .teams {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .team {
    background: var(--panel-2);
    border-radius: 12px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    border: 3px solid transparent;
  }
  .team.mine {
    border-color: var(--c);
  }
  .team h3 {
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .team h3 .soft {
    margin-left: auto;
    font-size: 13px;
  }
  .member {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    min-height: 24px;
  }
  .tick {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--panel-3);
    flex: none;
  }
  .tick.on {
    background: var(--go);
  }
  .label {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-soft);
    margin: 12px 0 6px;
  }
  .label.first {
    margin-top: 0;
  }
  .colors {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 4px;
  }
  .swatch {
    appearance: none;
    border: 0;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    padding: 0;
    border-radius: 10px;
    min-width: 0;
    height: 44px;
    touch-action: manipulation;
    transition: transform 80ms;
  }
  .swatch:active:not(:disabled) {
    transform: scale(0.88);
  }
  .swatch.selected {
    background: var(--panel-3);
    outline: 3px solid #fff;
    outline-offset: -3px;
  }
  .swatch:disabled {
    opacity: 0.22;
    cursor: default;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
  }
  .step-label {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-soft);
    line-height: 1.15;
  }
  .step-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
  }
  .step-controls b {
    min-width: 46px;
    text-align: center;
    font-size: 19px;
  }
  .step-controls .btn {
    width: 44px;
    padding: 0;
    font-size: 22px;
  }
  .note {
    margin: 10px 0 2px;
    font-size: 15px;
  }
  .note b {
    color: #fff;
  }
  footer {
    flex: none;
    padding-top: 6px;
  }
  footer .btn {
    margin-bottom: 5px;
    font-size: 17px;
  }
</style>
