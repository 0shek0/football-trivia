# Hosting the game

The game has two parts, hosted in two places:

| Part | What it does | Where |
|---|---|---|
| The page | Lobby, battle screens and map | Vercel |
| The game server | Rooms, live connections, timers, answer checking | Railway |

Vercel only runs code for a moment per request, so it can't keep the live connections and timers a battle needs. No database is needed.

## 1. Host the game server on Railway

1. Sign in at [railway.com](https://railway.com) with GitHub.
2. Choose **New Project**, then **Deploy from GitHub repo**, and pick `football-trivia`.
3. If Railway offers a separate service for each package, keep one and remove the rest. The root directory must stay at the top of the repo, because the server needs the shared code and question files.
4. Open the service's **Settings** and check these two values. Railway should detect them by itself:
   - Build command: `npm run build`
   - Start command: `npm start`
5. In **Settings**, under **Networking**, then **Public Networking**, choose **Generate Domain**. If it asks for a port, accept the one it detects.
6. Open the domain with `/health` on the end, for example `https://your-service.up.railway.app/health`. It should show `ok`.
7. Set the region closest to your players in **Settings**, under **Scale**, then **Regions**. For players in the Arab world, EU West (Amsterdam) is the closest of the four Railway regions.

Opening the Railway domain on its own also shows a fully working copy of the game, which is handy for checking the server before moving on.

## 2. Host the page on Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. Choose **Add New**, then **Project**, and import `football-trivia`. Leave **Root Directory** at the top of the repo (`./`), even if Vercel suggests `packages/client`. Otherwise the build fails with "No Output Directory named dist". Vercel reads the build settings from `vercel.json`, so leave them as they are.
3. Under **Environment Variables**, add:
   - Name: `VITE_SERVER_URL`
   - Value: your Railway domain, starting with `wss://` instead of `https://`, for example `wss://your-service.up.railway.app`
4. Choose **Deploy**, and share the address Vercel gives you.

Both services redeploy by themselves whenever you push to GitHub. If the Railway domain ever changes, update `VITE_SERVER_URL` and redeploy on Vercel.

## Good to know

- **Cost:** Railway's trial is a one-time $5 credit that lasts 30 days, with no card needed. After that, the Hobby plan is $5 a month including $5 of usage, and heavier use costs more. Check [Railway's pricing](https://railway.com/pricing), as this can change.
- **Games in progress end on restart:** rooms live in the server's memory, so a redeploy ends any games running at that moment. Avoid pushing while people are playing.
- **Answers are public if the repository is public:** the question files include the answers, so anyone can read them on GitHub. Make the repository private to prevent that. Railway and Vercel both still work with a private repository.
