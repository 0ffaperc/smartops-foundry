# LifeOS V2 - Ready to Run

This folder was generated from the pasted implementation.

## Run it in the browser

```powershell
cd lifeos-v2-ready
npm install
npm run dev
```

Then open the local URL Vite prints, usually http://localhost:5173.

## Run it as a desktop app

```powershell
cd lifeos-v2-ready
npm install
npm run electron
```

The Electron script starts Vite first, waits until it is ready, then opens the desktop app.

## Build a Windows installer

```powershell
npm run electron:build
```

The built installer will appear in the `release` folder.

## Notes

- This app stores data in browser/Electron localStorage.
- The OpenRouter fields in Settings are placeholders. The current `src/lib/mockAi.js` uses mock AI functions, so no API key is required to run the app.
- Do not paste all the markdown into one file and run it. The code must exist as separate files with the exact paths in this folder.


## New in this build

- Added the **Orchestrator Agent** screen.
- It reads your LifeOS goals, tasks, habits, habit logs, and reviews.
- It can use your OpenRouter API key from Settings with the Orchestrator Model field.
- It falls back to a local mock assistant when no API key is set.
- It can convert lines starting with `TASK:` into real LifeOS tasks.

