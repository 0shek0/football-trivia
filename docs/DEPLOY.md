# Hosting the game

The game has two parts, hosted in two places:

| Part | What it does | Where |
|---|---|---|
| The page | Lobby, battle screens and map | Vercel |
| The game server | Rooms, live connections, timers, answer checking | Render |

Vercel only runs code for a moment per request, so it can't keep the live connections and timers a battle needs. Both services have free plans, and no database is needed.

## 1. Host the game server on Render

1. Sign in at [render.com](https://render.com) with GitHub.
2. Choose **New**, then **Blueprint**, and pick the `football-trivia` repository. Render reads the settings from `render.yaml`.
3. When it finishes, copy the service address. It looks like `https://trivia-battle-server.onrender.com`.
4. Check that opening that address with `/health` on the end shows `ok`.

## 2. Host the page on Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. Choose **Add New**, then **Project**, and import `football-trivia`. Vercel reads the build settings from `vercel.json`, so leave them as they are.
3. Under **Environment Variables**, add:
   - Name: `VITE_SERVER_URL`
   - Value: your Render address, starting with `wss://` instead of `https://`, for example `wss://trivia-battle-server.onrender.com`
4. Choose **Deploy**, and share the address Vercel gives you.

Both services redeploy by themselves whenever you push to GitHub. If the Render address ever changes, update `VITE_SERVER_URL` and redeploy on Vercel.

## Good to know on the free plans

- **Slow first visit:** Render's free server sleeps after 15 minutes without visitors. The next visitor waits up to a minute while it wakes, and the page shows "Connecting to the game server..." in the meantime.
- **Games in progress end on restart:** rooms live in the server's memory, so a redeploy ends any games running at that moment. Avoid pushing while people are playing.
- **Answers are public if the repository is public:** the question files include the answers, so anyone can read them on GitHub. Make the repository private to prevent that. Render and Vercel both still work with a private repository.
