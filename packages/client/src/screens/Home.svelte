<script lang="ts">
  import { LIMITS } from '@tb/shared';
  import { app, haptic } from '../lib/store.svelte';

  type Step = 'start' | 'code' | 'name';

  const invite = (new URLSearchParams(location.search).get('room') ?? '').toUpperCase().slice(0, LIMITS.roomCodeLength);

  let step = $state<Step>(invite ? 'name' : 'start');
  let intent = $state<'create' | 'join'>(invite ? 'join' : 'create');
  let code = $state(invite);
  let name = $state(app.savedName);
  let busy = $state(false);

  const cleanCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LIMITS.roomCodeLength);
  const codeReady = $derived(code.length === LIMITS.roomCodeLength);
  const nameReady = $derived(name.trim().length >= LIMITS.name.min);

  // A failed join must return the player to wherever they can fix it.
  $effect(() => {
    if (!app.errorCode) return;
    busy = false;
    if (app.errorCode === 'room_not_found' || app.errorCode === 'game_in_progress' || app.errorCode === 'room_full') step = 'code';
  });

  function submitCode(e: Event) {
    e.preventDefault();
    if (!codeReady) return;
    app.clearError();
    step = 'name';
  }

  function submitName(e: Event) {
    e.preventDefault();
    if (!nameReady || busy) return;
    haptic();
    busy = true;
    app.clearError();
    const clean = name.trim();
    app.saveName(clean);
    app.send(intent === 'create' ? { t: 'create', name: clean } : { t: 'join', code, name: clean });
  }

  function back() {
    app.clearError();
    busy = false;
    step = step === 'name' && intent === 'join' ? 'code' : 'start';
  }
</script>

<div class="screen home">
  <header class="logo pop">
    <span class="hexes" aria-hidden="true"><i class="hex" style="--c:#e8483f"></i><i class="hex" style="--c:#f6cf35"></i><i class="hex" style="--c:#57bd4a"></i></span>
    <h1><span>TRIVIA</span><span>BATTLE</span></h1>
    <p>Football trivia. Capture the map.</p>
  </header>

  <div class="spacer"></div>

  <section class="column panel rise">
    {#if !app.online}<p class="soft waking" role="status">Connecting to the game server...</p>{/if}
    {#if step === 'start'}
      <button class="btn go wide" onclick={() => { intent = 'create'; step = 'name'; app.clearError(); }}>Create room</button>
      <button class="btn wide" onclick={() => { intent = 'join'; step = 'code'; app.clearError(); }}>Join with code</button>
    {:else if step === 'code'}
      <form onsubmit={submitCode}>
        <label for="code">Room code</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="code"
          class="field code"
          value={code}
          oninput={(e) => { code = cleanCode(e.currentTarget.value); e.currentTarget.value = code; }}
          autocapitalize="characters"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="go"
          maxlength={LIMITS.roomCodeLength}
          placeholder="ABC123"
          autofocus
        />
        {#if app.errorMessage}<p class="error" role="alert">{app.errorMessage}</p>{/if}
        <div class="row">
          <button type="button" class="btn quiet" onclick={back}>Back</button>
          <button class="btn go grow" disabled={!codeReady}>Next</button>
        </div>
      </form>
    {:else}
      <form onsubmit={submitName}>
        <label for="name">Your username</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="name"
          class="field"
          bind:value={name}
          autocomplete="nickname"
          enterkeyhint="go"
          maxlength={LIMITS.name.max}
          placeholder="Choose a name"
          autofocus
        />
        {#if intent === 'join'}<p class="soft hint">Joining room <b>{code}</b></p>{/if}
        {#if app.errorMessage}<p class="error" role="alert">{app.errorMessage}</p>{/if}
        <div class="row">
          <button type="button" class="btn quiet" onclick={back}>Back</button>
          <button class="btn go grow" disabled={!nameReady || busy}>{intent === 'create' ? 'Create room' : 'Join room'}</button>
        </div>
      </form>
    {/if}
  </section>
</div>

<style>
  .home {
    align-items: center;
  }
  .logo {
    text-align: center;
    margin-top: 2vh;
  }
  .hexes {
    display: flex;
    justify-content: center;
    gap: 4px;
    font-size: 22px;
    margin-bottom: 4px;
  }
  h1 {
    display: flex;
    flex-direction: column;
    font-size: clamp(44px, 13vw, 76px);
    font-weight: 700;
    line-height: 0.95;
    letter-spacing: 0.02em;
    text-shadow: 0 5px 0 #12405e;
  }
  h1 span + span {
    color: var(--gold);
  }
  .logo p {
    font-size: 17px;
    font-weight: 600;
    margin-top: 12px;
    text-shadow: 0 2px 0 rgba(10, 30, 46, 0.55);
  }
  .spacer {
    flex: 1;
    pointer-events: none;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 6px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  label {
    font-weight: 600;
    color: var(--text-soft);
  }
  .code {
    text-align: center;
    letter-spacing: 0.3em;
    font-size: 28px;
    text-transform: uppercase;
  }
  .row {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .grow {
    flex: 1;
  }
  .hint b {
    color: #fff;
    letter-spacing: 0.08em;
  }
  .error {
    color: #ffb3b1;
    font-weight: 600;
  }
  .waking {
    text-align: center;
    font-size: 15px;
  }
</style>
