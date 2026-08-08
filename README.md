# Outage Log

A power outage tracker with a log screen and a reliability report screen.
Data is stored in your browser's `localStorage` — nothing leaves your machine.

## Project structure

```
outage-tracker/
├── index.html          # HTML entry point, loads fonts + mounts React
├── package.json         # dependencies + scripts
├── vite.config.js        # build tool config
├── src/
│   ├── main.jsx          # React root
│   ├── App.jsx           # all app logic (log, report, form, storage)
│   └── index.css         # all styling
└── README.md
```

## Run it locally

1. Make sure you have [Node.js](https://nodejs.org) installed (v18+).
2. Open this folder in VS Code.
3. In the terminal:
   ```bash
   npm install
   npm run dev
   ```
4. Open the URL it prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

This outputs a static `dist/` folder you can host anywhere (Netlify, Vercel, GitHub Pages, etc.) — no backend required.

## Deploy to GitHub Pages

1. Push this project to a GitHub repo.
2. In `vite.config.js`, set `base` to match your repo name, e.g. `base: '/my-repo-name/'`. (If deploying to a `username.github.io` repo or a custom domain, use `base: '/'` instead.)
3. In the repo: **Settings → Pages → Source → GitHub Actions**.
4. Push to `main` — the included workflow at `.github/workflows/deploy.yml` will build and deploy automatically.
5. Your app will be live at `https://username.github.io/repo-name/`.

Note: `localStorage` is scoped per domain per browser, so data won't carry over from `localhost`, and it won't sync across devices/browsers. Use the in-app Export/Import JSON buttons to move data between them.

## Notes

- Data persists via `localStorage` under the key `outage-log-entries`. Clearing your browser's site data will erase it.
- Use **Export JSON** in-app to back up your log, and **Import JSON** to restore it or move it to another browser/device — imports merge by entry ID so you won't get duplicates.
- To swap in a real backend later, replace the `localStorage.getItem` / `localStorage.setItem` calls in `src/App.jsx` with API calls — the rest of the app doesn't need to change.
