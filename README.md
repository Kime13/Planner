# Personal Planner

A goal-oriented personal planner web app built for structured self-management — from annual vision down to daily tasks. Designed and built entirely through vibe coding with [Claude Code](https://claude.ai/code) by a non-developer civil servant.

**Live app:** [https://kime13.github.io/Planner](https://kime13.github.io/Planner)

---

## Why I Built This

I'm a government official pivoting toward **Tech PM / AI Governance** roles at international organizations and tech companies. The standard productivity tools felt too generic — I needed something structured around a single annual goal that cascades into quarterly, monthly, weekly, and daily actions.

I had no prior coding experience. Instead of learning to code from scratch, I used Claude Code to go from idea to deployed app. Every feature in this planner reflects a real planning habit I wanted to systematize.

---

## Features

### Planning Hierarchy
| Level | What it tracks |
|-------|---------------|
| Annual | One core goal + 3 action pillars + progress ring |
| Quarterly | Q1–Q4 goals with individual progress tracking |
| Monthly | Goal notes per core action pillar |
| Weekly | Tasks organized by custom categories |
| Daily | All tasks / Top 3 priorities / What I actually did |

### Key Functionality
- **Google Sign-In** — Each user sees only their own data; login screen shown to unauthenticated visitors
- **Cross-device sync** — Firebase Firestore keeps data in sync across devices with localStorage as local cache (write-through, 500ms debounce)
- **Recurring tasks** — Set tasks to repeat daily / weekly (by weekday) / monthly; auto-injected into the relevant daily page
- **Custom categories** — Add, edit, and delete planner categories with color labels from the settings page
- **Custom planner name** — Set your own planner name on first login; shown across all pages
- **Inline editing on mobile** — Tap any task text to edit in-place; confirm with ✓ or cancel with ✕ (no accidental saves on blur)
- **Calendar view** — Monthly calendar with daily completion indicators

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML / CSS / JavaScript (ES5) |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Firebase Firestore (user-scoped document per account) |
| Hosting | GitHub Pages |
| Built with | [Claude Code](https://claude.ai/code) — AI-assisted vibe coding |

No frameworks. No build tools. No npm. Just static files that load fast on any device.

---

## Architecture

```
index.html      — Dashboard (annual → quarterly → monthly → weekly + settings)
daily.html      — Daily planner (tasks / priorities / actual)
app.js          — Data layer: localStorage read/write + all utility functions
sync.js         — Firebase Auth + Firestore sync layer
style.css       — All styles
```

**Data flow:**
1. On login → clear localStorage → fetch from Firestore → render
2. On any save → write to localStorage → debounced push to Firestore (500ms)
3. On logout → clear localStorage → show login screen

Firestore is initialized lazily inside the `onAuthStateChanged` callback to avoid permission errors before authentication is confirmed.

---

## Project Background

This planner was a personal challenge: build something I actually need, without being a developer, using AI as a co-builder. Every feature was spec'd by me based on real planning frustrations:

- I wanted recurring tasks so I'd never forget daily habits
- I wanted categories I could change as my priorities shift
- I wanted one place where my annual goal is always visible and connected to what I do each day

The entire codebase was built iteratively through conversation with Claude Code — debugging Firestore permission errors, fixing mobile UX issues, adding Firebase Auth, and cleaning up hardcoded sample data.

---

## Local Development

No build step needed. Open `index.html` directly in a browser, or serve with any static file server:

```bash
npx serve .
```

For Firestore to work, you'll need your own Firebase project. Replace the config in `sync.js` with your own credentials and set Firestore rules to allow authenticated reads/writes.

---

*Built by a non-developer civil servant. Powered by Claude Code.*
