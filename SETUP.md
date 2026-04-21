# Work Dashboard - Setup Guide

## Prerequisites

- Node.js 18+
- Rust (installed via `rustup`)
- macOS (for Apple Reminders integration and Tauri desktop builds)

## Getting Started

```bash
cd work-dashboard
npm install
npm run tauri dev   # starts both Vite dev server + Tauri window
```

For a production build:

```bash
npm run tauri build
```

The `.app` bundle will be in `src-tauri/target/release/bundle/macos/`.

---

## Configuring API Tokens

On first launch you'll be redirected to the Settings page. Here's how to get each token:

### Jira Cloud

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**, give it a name like "Work Dashboard"
3. Copy the token
4. In Settings, enter:
   - **Base URL**: `https://your-domain.atlassian.net`
   - **Email**: your Atlassian account email
   - **API Token**: the token you just created
   - **Project Keys**: the Jira project keys (e.g. `ECOM`, `ER`, `REPLAT`)
   - **RAID Board ID**: find this in the URL when viewing your RAID board (`/boards/123` → `123`)

> Note: Jira API tokens work with Okta SSO — they're tied to your Atlassian account, not Okta.

### GitHub

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)** or use fine-grained tokens
3. Scopes needed: `repo` (for private repos) or `public_repo`
4. If your org uses Okta SSO: after creating the token, click **Configure SSO** next to it and authorize it for your org
5. In Settings, enter:
   - **Personal Access Token**: the token
   - **Owner / Org**: your GitHub org name
   - **Repository**: the repo name (just the name, not the full URL)
   - **Your GitHub Username**: your GitHub username

### Slack

1. Go to https://api.slack.com/apps and click **Create New App** → **From scratch**
2. Name it "Work Dashboard", select your workspace
3. Go to **OAuth & Permissions** and add these **User Token Scopes**:
   - `channels:history` — read messages in public channels
   - `channels:read` — list channels
   - `users:read` — resolve user IDs to names
4. Click **Install to Workspace** and authorize
5. Copy the **User OAuth Token** (starts with `xoxp-`)
6. In Settings, enter:
   - **Bot Token**: paste the user token
   - **Channel IDs**: right-click a channel → **View channel details** → copy the Channel ID from the bottom

> You need _User_ token scopes (not Bot), since a bot token can't read channel history unless the bot is invited.

### Microsoft Outlook (Calendar)

This is the most involved setup because Microsoft Graph requires Azure AD app registration.

1. Go to https://portal.azure.com → **Azure Active Directory** → **App registrations** → **New registration**
2. Name: "Work Dashboard", Redirect URI: `http://localhost` (type: Public client)
3. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**:
   - `Calendars.Read`
4. Go to **Authentication** → ensure "Allow public client flows" is **Yes**
5. Note your **Application (client) ID** and **Directory (tenant) ID**
6. To get tokens, use the device code flow or authorization code flow. Example with curl:

```bash
# Request device code
curl -X POST "https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/devicecode" \
  -d "client_id={client-id}&scope=Calendars.Read offline_access"

# Follow the instructions to authenticate, then exchange for tokens
curl -X POST "https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token" \
  -d "client_id={client-id}&grant_type=device_code&device_code={device-code}"
```

7. Copy the `access_token` and `refresh_token` into Settings

> Access tokens expire after ~1 hour. A future improvement would be automatic token refresh.

### Apple Reminders

No configuration needed! The app uses AppleScript to read your Reminders. On first launch, macOS will prompt you to allow access — click **OK**.

---

## Architecture

```
src/
├── services/       API integration modules (Jira, GitHub, Slack, Outlook)
├── hooks/          React hooks wrapping each service with TanStack Query
├── components/
│   ├── layout/     Dashboard shell and Header
│   ├── panels/     The 4 dashboard panels + Settings page
│   └── common/     Reusable UI components (PanelCard)
├── types/          TypeScript type definitions
└── App.tsx         Router (/ → Dashboard, /settings → Settings)

src-tauri/
└── src/lib.rs      Rust backend (Apple Reminders via AppleScript)
```

## Auto-refresh

Data refreshes automatically every 5 minutes (configurable in Settings, 1-15 min range). Click the refresh icon in the header for a manual refresh.

## Deployment Tracker

The deployment panel automatically pairs up "eCom WWW" and "eCom ER" fix versions by their semver number and shows them as deployment events. The checklist reflects the standard deployment process (pre-merge → merge → verify → notify). Checklist state is local to each session.
