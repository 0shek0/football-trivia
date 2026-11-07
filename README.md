# Trivia Battle

A 2-8 player online football trivia game on a low-poly hexagon map. Win trivia rounds to capture your rivals' land.

- Game rules: [docs/GAME_RULES.md](docs/GAME_RULES.md)
- Build plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. To play on a phone, connect it to the same Wi-Fi and open the Network address that the command prints.

## Test alone with bots

Create a room in the browser, then fill it using the room code:

```bash
npm run bots -- ROOMCODE 3
```

The full form is `npm run bots -- ROOMCODE [count] [how often they answer, 0-1] [answer delay in ms]`.

## Other commands

| Command | What it does |
|---|---|
| `npm test` | Runs all tests, including full simulated games |
| `npm run typecheck` | Checks types across every package |
| `npm run validate:questions` | Checks the question files for format errors and duplicates |
| `npm run build` then `npm start` | Runs the production build on one port (`PORT`, default 8787) |

## Changing the look

All colors, corner sizes and fonts are design tokens at the top of [packages/client/src/app.css](packages/client/src/app.css). Player colors are in [packages/shared/src/settings.ts](packages/shared/src/settings.ts), and the 3D map shapes are in [packages/client/src/lib/map/geometry.ts](packages/client/src/lib/map/geometry.ts).

## Adding questions

All questions are in Arabic and cover 1950-2024, and the validator rejects anything else. Standard questions live by topic in [content/questions/pools](content/questions/pools), and death questions in [death.json](content/questions/death.json). Answer order is shuffled when served:

```json
{ "q": "نص السؤال؟", "correct": "الإجابة الصحيحة", "wrong": ["خطأ 1", "خطأ 2", "خطأ 3"] }
```

After changing a topic file, rebuild the mixed 5-question sets and check them:

```bash
npm run build:questions
```

```bash
npm run validate:questions
```

## Hosting

See [docs/DEPLOY.md](docs/DEPLOY.md).

## Adding store items

Add items to `STORE_ITEMS` in [packages/shared/src/settings.ts](packages/shared/src/settings.ts). Buying and credits already work, but each item's effect still needs building.
