# 🁣 Dominó — Cuban Rules Multiplayer

Real-time Cuban dominoes with WebSocket multiplayer. Teams 2v2, Free-for-All, Double-9 set, Capicú bonus, 100-point target.

---

## Project Structure

```
domino-game/
├── server/          ← Node.js + Socket.io backend
│   ├── src/
│   │   ├── index.js     ← Entry point, all socket events
│   │   ├── engine.js    ← Domino game logic (Cuban rules)
│   │   └── rooms.js     ← Room/lobby state manager
│   ├── package.json
│   └── railway.json     ← Railway deployment config
│
└── client/          ← React + Vite frontend
    ├── src/
    │   ├── App.jsx           ← Main app, all state + socket wiring
    │   ├── styles.css        ← Global styles
    │   ├── hooks/
    │   │   └── useSocket.js  ← Socket.io client hook
    │   ├── game/
    │   │   └── engine.js     ← Client-side game helpers
    │   └── components/
    │       ├── Domino.jsx    ← Tile rendering
    │       ├── HomeScreen.jsx
    │       ├── LobbyScreen.jsx
    │       ├── GameScreen.jsx ← Main game table
    │       └── Modals.jsx
    ├── index.html
    ├── vite.config.js
    └── vercel.json      ← Vercel deployment config
```

---

## ─── STEP 1: Install Prerequisites ───────────────────────────────────────────

You need:
- **Node.js 18+** → https://nodejs.org (download LTS)
- **Git** → https://git-scm.com
- A free **GitHub** account → https://github.com
- A free **Railway** account → https://railway.app (sign in with GitHub)
- A free **Vercel** account → https://vercel.com (sign in with GitHub)

---

## ─── STEP 2: Run Locally ─────────────────────────────────────────────────────

### 2a. Start the server

```bash
cd server
cp .env.example .env          # creates your .env file
npm install
npm run dev                   # starts on http://localhost:3001
```

You should see:
```
🁣  Dominó server running on port 3001
   Client URL: http://localhost:5173
```

### 2b. Start the client (new terminal tab)

```bash
cd client
cp .env.example .env          # creates your .env file
npm install
npm run dev                   # starts on http://localhost:5173
```

Open http://localhost:5173 in your browser. Hit **▶ Play vs Bots** to test immediately.

### 2c. Test multiplayer locally

Open two browser tabs both at http://localhost:5173:
- Tab 1: Create Room → note the 4-letter code
- Tab 2: Join Room → enter the code

---

## ─── STEP 3: Push to GitHub ──────────────────────────────────────────────────

```bash
# From the domino-game root folder:
git init
git add .
git commit -m "Initial commit — Cuban dominoes multiplayer"
```

Go to https://github.com/new and create a new repository called `domino-game` (leave it empty, don't add README).

Then run the commands GitHub shows you under "push an existing repository":
```bash
git remote add origin https://github.com/YOUR_USERNAME/domino-game.git
git branch -M main
git push -u origin main
```

---

## ─── STEP 4: Deploy the Server to Railway ───────────────────────────────────

1. Go to https://railway.app and sign in
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `domino-game` repository
4. Railway will detect the project — click **Configure** on it
5. Set the **Root Directory** to `server`
6. Railway will auto-detect Node.js and run `node src/index.js`

### Add environment variable on Railway:
- Click your service → **Variables** tab
- Add: `CLIENT_URL` = (leave blank for now, you'll fill in after Vercel deploy)

7. Click **Deploy** — Railway will give you a URL like `https://domino-game-production.up.railway.app`
8. **Copy this URL** — you need it for the next step

---

## ─── STEP 5: Deploy the Client to Vercel ────────────────────────────────────

1. Go to https://vercel.com and sign in
2. Click **Add New** → **Project**
3. Import your `domino-game` GitHub repository
4. Set **Root Directory** to `client`
5. Vercel auto-detects Vite — leave build settings as-is

### Add environment variable on Vercel:
- Under **Environment Variables**, add:
  - Name: `VITE_SERVER_URL`
  - Value: your Railway URL from Step 4 (e.g. `https://domino-game-production.up.railway.app`)

6. Click **Deploy**
7. Vercel gives you a URL like `https://domino-game.vercel.app`
8. **Copy this URL**

---

## ─── STEP 6: Connect Server ↔ Client ────────────────────────────────────────

Go back to Railway:
1. Click your service → **Variables**
2. Update `CLIENT_URL` to your Vercel URL (e.g. `https://domino-game.vercel.app`)
3. Railway will auto-redeploy

Your game is now live! Share your Vercel URL with friends.

---

## ─── STEP 7: Test Live Multiplayer ──────────────────────────────────────────

1. Open your Vercel URL on your phone
2. Open it again on a laptop
3. One person creates a room, shares the 4-letter code
4. Other person joins
5. Both players ready up → host clicks Start Game

---

## ─── Future Enhancements ────────────────────────────────────────────────────

The codebase is built to support:

| Feature | Where to add |
|---|---|
| Custom table skins | `GameScreen.jsx` → `FeltCanvas` component |
| Custom domino skins | `Domino.jsx` → pass skin props |
| Persistent scores / leaderboard | Add PostgreSQL via Railway plugin |
| Player avatars | Add `avatar` field to player object in `rooms.js` |
| Reconnect mid-game | `rooms.js` → `playerDisconnect` already marks disconnected |
| More rulesets (Puerto Rican, All Fives) | `server/src/engine.js` → swap scoring logic |
| Mobile touch drag | `GameScreen.jsx` → add `onTouchStart/Move/End` handlers |
| Sound effects | Client only — add Howler.js |

---

## Common Issues

**"Cannot connect to server"**
→ Make sure `VITE_SERVER_URL` in Vercel matches your Railway URL exactly (no trailing slash)

**"Room not found"**
→ Room codes expire when the server restarts. Railway free tier sleeps after inactivity — upgrade to Hobby ($5/mo) for always-on.

**CORS error in console**
→ Make sure `CLIENT_URL` in Railway matches your Vercel URL exactly

**Tiles not showing**
→ Hard refresh the browser (Ctrl+Shift+R / Cmd+Shift+R)
