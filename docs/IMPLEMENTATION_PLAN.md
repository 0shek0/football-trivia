# Trivia Battle: Implementation Plan

Game behavior is defined in [GAME_RULES.md](GAME_RULES.md). This file covers how it gets built.

## Stack

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript throughout | Client and server share the same types and rules |
| Game server | Node.js with `ws` WebSockets | Timers and simultaneous rounds need one always-running authority |
| UI | Svelte 5 with Vite | Compiles to very little JavaScript, so screens load and react quickly |
| WebGL | Three.js | Light 3D hexagons with instancing, loaded only once needed |
| Tests | Vitest, plus Playwright at phone sizes | Rule edge cases are tested without a browser, and full flows with one |

### Visual style

Inspired by The Battle of Polytopia: low-poly tiles on open water, flat saturated colors, simple geometric decoration, and chunky rounded UI. All assets are original and made for this game, with football touches such as stadiums and flags.

### How the WebGL and UI fit together

- **WebGL** draws the hex map, capture animations and background effects.
- **Regular HTML** draws text and buttons, including questions, answers, lobby and store. Text stays sharp, taps respond instantly, and it is easy for you to restyle later.
- If a device has no WebGL, the map falls back to a simple flat version, so the game still works everywhere.

## Database

**No database is needed for this version**, and Supabase will not be touched.

- Rooms and games live in the server's memory and are discarded when they end.
- Questions are JSON files on the server and are never sent to browsers in bulk.

A database becomes useful if you later add accounts, credits that carry between games, stats or leaderboards, or a question editing screen. I'll tell you first if that happens.

**The trade-off:** restarting the server ends games in progress, and one server process holds all rooms. That is fine at launch, and rules stay separate from the network code so this can change later.

## Hosting

The page is hosted on Vercel. The server must be a long-running process, which Vercel can't run, so it goes on Railway. See [DEPLOY.md](DEPLOY.md).

## Project layout

```
docs/                 Rules and this plan
content/questions/    Standard sets and death questions (JSON)
packages/shared/      Types, message formats, settings limits
packages/engine/      Pure game rules with no network or timers
packages/server/      Rooms, WebSockets, timers, reconnects
packages/client/      Svelte UI and Three.js map
tools/                Question validator
```

The engine applies each event to the game state without any network or timer code. That lets tests play thousands of full games in seconds, and lets the server stay small.

## Mobile performance targets

**Speed**

- First screen: under 60 KB of compressed JavaScript. Three.js loads in the background from there.
- Answer taps highlight immediately, without waiting for the server.
- 60 fps on the map on a mid-range phone, drawn with a single instanced mesh and resolution capped at 2x.
- The map only redraws when something changes, and stops in background tabs, to save battery.

**Layout**

- Designed for portrait phones first, then adapted for tablet and desktop.
- Answer buttons sit in thumb reach, and each screen fits without page scrolling.
- Handles notches and mobile browser bars correctly.
- Sharing uses the phone's share sheet with a direct join link. Haptics are used where supported.

**Connection**

- Reconnects automatically and restores the current screen, because phones drop connections when switching apps, such as when sharing the room code.
- The server sends question deadlines as time remaining, so a phone's clock can't affect the timer.

## Status

First prototype is complete: M1-M7 are built, with the full Arabic question pool.

**Checked**

- 80 automated tests pass, including simulated games at every player count and team layout, and bots playing over real connections.
- Full games played in a browser at phone size, covering lobby, team naming, battles, sudden death, results, store, rejoining after a reload, and players leaving.
- First screen JavaScript is 30 KB compressed, against the 60 KB target. The 3D code adds 137 KB, loaded separately.

**Not checked yet**

- Real phones. Frame rate and tap feel have only been tried in an emulated phone viewport on a desktop.
- Multiple real people playing over mobile data.
- Question accuracy, which needs a human review.

**Not done yet**

- Automated browser tests (Playwright) and sound.
- Going live: the hosting files are ready, and [DEPLOY.md](DEPLOY.md) has the steps. Stretching questions toward 1500 is optional.

**Measured game length** in waves with the default settings, from 2000 simulated games each:

| Game | Typical | Slowest 1 in 10 | Worst seen | Worst seen when the cost stopped at 3 |
|---|---|---|---|---|
| 4 players, solo | 13 | 18 | 28 | 57 |
| 8 players, solo | 22 | 27 | 37 | 131 |
| 4v4 teams | 12 | 20 | 33 | 66 |

Long games used to come from evenly matched sides swapping hexagons at a cost of 3. The random costs from wave 20 now end them within a few more waves.

## Milestones

Each one ends with something that can be run or tested.

### M1: Project setup
Workspaces, TypeScript, Vite, Vitest, git, and a shared settings file.
**Done when:** client and server both start and connect locally.

### M2: Game engine
- Settings validation, including team sizes and minimum hexagons
- Map generator and starting territories
- Pairing scheduler with sit-outs and history clearing
- Question set allocation
- Round scoring and sudden death
- Capture selection, escalation, elimination, last stand, win detection
- Credits and the purchase system with an empty item list

**Done when:** tests pass for every rule, and simulated games at every player count and team layout finish without breaking a rule.

### M3: Multiplayer server
Room codes, joining, lobby actions, host controls, phase timers, simultaneous rounds, answer checking on the server, reconnects, leaving, and rate limits.
**Done when:** scripted bots play a complete 8-player game over real WebSockets.

### M4: Lobby UI
Home, create and join, username, ready, teams, colors, host settings, and sharing the code.
**Done when:** several phones can join one room and start a game.

### M5: WebGL map
Hex tiles, player colors, pan and zoom, capture animation, background effects, and the flat fallback.
**Done when:** a full 64-hexagon map holds the frame rate target at phone settings.

### M6: Battle UI
Question screen, timer, answer reveal, opponent status, sudden death, results, waiting screen, team naming, sit-outs, spectating, store screen, and game over.
**Done when:** a complete game is playable from start to finish on phones.

### M7: Question content
Validator covering format, 4 unique options, 1 correct answer, and duplicates. Written in batches:

1. Starter pool for testing: 50 sets and 50 death questions, added alongside M3
2. Up to 200 sets (1000 questions) and 200 death questions
3. Stretch to 300 sets (1500 questions)

Topics favor stable football history over current stats, which go out of date. **I can get facts wrong, so these need your review before launch.** Each question will have a stable ID so you can flag or fix individual ones.

### M8: Polish and launch
Testing on real phones, performance fixes, sound and haptics, and deployment.
**Done when:** the game is hosted and a full game runs across real devices on mobile data.

## After this plan

- Tweak the UI, which you plan to do once the main systems work
- Define store items, their effects and costs
