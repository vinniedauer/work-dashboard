# Work Dashboard

A personal macOS desktop dashboard built with [Tauri](https://tauri.app/) + React. Pulls live data from Jira, GitHub, Slack, and Outlook into a single glanceable window so you always know what to work on next.

---

## Features

- **Focus Bar** — Full-width strip at the top that computes your single most important next action across all data sources, stated in plain language.
- **My Work** — Your open Jira tickets, open PRs, and a local to-do list with inline editing.
- **My Meetings** — Today's calendar events from Outlook, with join links. Tomorrow's agenda shown below.
- **Team Pulse** — Open team PRs awaiting review, recent Jira bugs, Slack "waiting on you" threads, and situations to monitor.
- **Deployment Tracker** — Tracks upcoming eCom fix versions, their staging/production status, and a deployment checklist.
- **Replatform Monitor** — Your open tickets on the replatform board, sorted with "Selected for Development" at the top.

All panels are resizable. Data refreshes automatically every 5 minutes (configurable).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app/) (Rust backend) |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query v5 |
| Layout | react-resizable-panels |
| Build | Vite |

The calendar is read via a compiled Swift binary that uses EventKit — no Calendar.app activation on refresh.

---

## Setup

See **[SETUP.md](SETUP.md)** for full instructions on:
- Installing prerequisites (Node, Rust, Xcode command-line tools)
- Getting API tokens for Jira, GitHub, Slack, and Outlook
- Building and installing the `.app` bundle

Quick start for development:

```bash
npm install
npm run tauri dev
```

Production build:

```bash
npm run tauri build --bundles app
```

The `.app` bundle lands in `src-tauri/target/release/bundle/macos/`.

---

## Focus Bar Algorithm

The focus bar evaluates your situation in priority order and returns the single most urgent action:

1. **In a meeting right now** → focus on it
2. **Meeting starting within 15 minutes** → wrap up
3. **ECRP board ticket In Progress** → keep momentum
4. **ECRP board ticket Selected for Development** → start it
5. **Ezra has an open PR** (linked Jira ticket in "Ready for Review" or "In Code Review") → review it
6. **3+ open PRs from the team** → clear the review queue
7. **My PR has changes requested** → address feedback
8. **My PR is approved** → merge it
9. **Slack situation to monitor** → check the thread
10. **Open sprint tickets on EA/ER** → work the board with fewer completed story points

---

## Project Structure

```
src/
├── services/        API clients (Jira, GitHub, Slack, Outlook)
├── hooks/           TanStack Query hooks wrapping each service
├── components/
│   ├── layout/      Dashboard shell, Header, FocusBar
│   ├── panels/      MyWork, MyMeetings, TeamPulse, DeploymentTracker, ReplatformMonitor
│   └── common/      Shared UI (PanelCard)
├── types/           TypeScript interfaces
└── App.tsx          Router (/ → Dashboard, /settings → Settings)

src-tauri/
├── src/lib.rs              Rust commands (Reminders, calendar helper)
└── calendar_helper.swift   EventKit binary source
```

---

## Configuration

All credentials are stored locally via `@tauri-apps/plugin-store` (JSON file in the app's data directory — never leaves your machine). Access the Settings page from the gear icon in the header.
