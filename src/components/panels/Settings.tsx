import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { openUrl as openerOpenUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { useConfig } from "../../hooks/useConfig";
import type { AppConfig } from "../../types";
import SlackConnect from "../common/SlackConnect";

function cloneConfig(c: AppConfig): AppConfig {
  return JSON.parse(JSON.stringify(c));
}

function msToMinutes(ms: number): number {
  return Math.round(ms / 60_000);
}

function minutesToMs(m: number): number {
  return m * 60_000;
}

/**
 * Opens a URL in the system browser.
 *
 * When running inside a Tauri webview (window.__TAURI_INTERNALS__ is present):
 *   1. Try tauri-plugin-opener (recommended for Tauri 2.1+)
 *   2. Try tauri-plugin-shell open()
 *   3. Fall back to the custom `open_url` Rust command (always available, no plugin needed)
 *
 * When running in a plain browser (dev mode via `npm run dev`):
 *   - window.__TAURI_INTERNALS__ is absent, so all IPC calls would throw.
 *     Fall back to window.open() immediately.
 */
async function openUrl(url: string): Promise<void> {
  const isTauri =
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window;

  if (!isTauri) {
    window.open(url, "_blank");
    return;
  }

  // Inside Tauri: try each method in order, propagating the last error if all fail.
  let lastError: unknown;

  try {
    await openerOpenUrl(url);
    return;
  } catch (e) {
    lastError = e;
  }

  try {
    await shellOpen(url);
    return;
  } catch (e) {
    lastError = e;
  }

  try {
    await invoke("open_url", { url });
    return;
  } catch (e) {
    lastError = e;
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon, defaultOpen = false, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900 hover:bg-gray-800/70 transition-colors text-left"
      >
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold text-gray-100 flex-1">{title}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && <div className="px-4 py-4 space-y-3 bg-gray-950">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  helpText?: string;
  readOnly?: boolean;
  action?: React.ReactNode;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  helpText,
  readOnly,
  action,
}: FieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium text-gray-400">{label}</label>
        {action}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full px-3 py-1.5 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors ${readOnly ? "opacity-60 cursor-default" : ""}`}
      />
      {helpText && <p className="text-[11px] text-gray-500 mt-1">{helpText}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExternalLinkButton
// ---------------------------------------------------------------------------

function ExternalLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  const [error, setError] = useState(false);

  const handleClick = useCallback(async () => {
    setError(false);
    try {
      await openUrl(href);
    } catch (err) {
      console.error("Failed to open URL:", href, err);
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  }, [href]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-1 text-[11px] transition-colors ${error ? "text-red-400" : "text-blue-400 hover:text-blue-300"}`}
    >
      {error ? "Failed to open" : children}
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 shrink-0">
        <path
          fillRule="evenodd"
          d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm6.75-3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V3.56L10.03 9.53a.75.75 0 0 1-1.06-1.06l5.97-5.97H11a.75.75 0 0 1-.75-.75Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SlackManifestGenerator
// ---------------------------------------------------------------------------

const SLACK_MANIFEST = JSON.stringify(
  {
    display_information: { name: "Work Dashboard" },
    features: {
      bot_user: { display_name: "Work Dashboard", always_online: false },
    },
    oauth_config: {
      redirect_urls: ["http://localhost/callback"],
      scopes: {
        bot: ["channels:history", "channels:read", "groups:history", "groups:read", "users:read"],
        user: ["channels:history", "groups:history", "im:history", "im:read"],
      },
    },
    settings: {
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  },
  null,
  2,
);

function SlackManifestGenerator() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(SLACK_MANIFEST);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="rounded-md bg-gray-800/60 border border-gray-700 px-3 py-2 text-[11px] text-gray-400 space-y-2">
      <div className="flex items-center justify-between">
        <p>
          Create a Slack app at{" "}
          <button
            type="button"
            onClick={() => openUrl("https://api.slack.com/apps")}
            className="text-blue-400 hover:text-blue-300 underline"
          >
            api.slack.com/apps
          </button>
          {" "}using "From an app manifest", then paste your Client ID and Secret below.
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-3 shrink-0 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-[11px] transition-colors"
        >
          {open ? "Hide manifest" : "Show manifest"}
        </button>
      </div>
      {open && (
        <div className="relative">
          <pre className="text-[10px] text-gray-300 bg-gray-900 rounded p-2 overflow-x-auto leading-relaxed">
            {SLACK_MANIFEST}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-2 right-2 px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-[10px] text-gray-300 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function Settings() {
  const navigate = useNavigate();
  const { config, updateConfig, loading } = useConfig();
  const [draft, setDraft] = useState<AppConfig>(cloneConfig(config));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");

  // Track whether this is the initial config sync (we don't want to auto-save that)
  const lastSavedRef = useRef<string>("");

  // Sync draft when config loads from store
  useEffect(() => {
    if (!loading) {
      const str = JSON.stringify(config);
      lastSavedRef.current = str;
      setDraft(cloneConfig(config));
    }
  }, [config, loading]);

  // Auto-save: debounced 800 ms after any draft change
  useEffect(() => {
    if (loading) return;
    // Skip if draft matches what's already saved (avoids re-saving after initial load)
    if (JSON.stringify(draft) === lastSavedRef.current) return;

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await updateConfig(draft);
        lastSavedRef.current = JSON.stringify(draft);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSaveError(String(err));
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 4000);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      // If the timer is cleared before firing, reset back to idle so the
      // "Saving…" indicator doesn't hang.
      setSaveStatus("idle");
    };
  }, [draft, loading, updateConfig]);

  const setJira = useCallback((field: keyof AppConfig["jira"], value: string) => {
    setDraft((prev) => ({ ...prev, jira: { ...prev.jira, [field]: value } }));
  }, []);

  const setGithub = useCallback((field: keyof AppConfig["github"], value: string) => {
    setDraft((prev) => ({ ...prev, github: { ...prev.github, [field]: value } }));
  }, []);

  const setSlack = useCallback((field: keyof AppConfig["slack"], value: string) => {
    setDraft((prev) => ({ ...prev, slack: { ...prev.slack, [field]: value } }));
  }, []);

const setRefreshInterval = useCallback((minutes: number) => {
    setDraft((prev) => ({
      ...prev,
      general: { ...prev.general, refreshIntervalMs: minutesToMs(minutes) },
    }));
  }, []);

  /** Immediate explicit save (e.g. from Save button) */
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      await updateConfig(draft);
      lastSavedRef.current = JSON.stringify(draft);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveError(String(err));
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  }, [draft, updateConfig]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="flex items-center gap-3 px-5 py-3 bg-gray-900 border-b border-gray-800">
        <button
          onClick={() => navigate("/")}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          title="Back to dashboard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 0 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-100">Settings</h1>

        <div className="ml-auto flex items-center gap-3">
          {/* Save status */}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500" />
              Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex flex-col items-end text-xs text-red-400">
              <span>Save failed</span>
              {saveError && (
                <span className="text-[10px] text-red-500 max-w-xs truncate" title={saveError}>
                  {saveError}
                </span>
              )}
            </span>
          )}

          {/* Explicit save button */}
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        {/* Jira */}
        <Section title="Jira" icon="🗒" defaultOpen>
          <Field
            label="Base URL"
            value={draft.jira.baseUrl}
            onChange={(v) => setJira("baseUrl", v)}
            placeholder="https://your-domain.atlassian.net"
          />
          <Field
            label="Email"
            value={draft.jira.email}
            onChange={(v) => setJira("email", v)}
            placeholder="you@company.com"
          />
          <Field
            label="API Token"
            value={draft.jira.apiToken}
            onChange={(v) => setJira("apiToken", v)}
            type="password"
            placeholder="Jira API token"
            action={
              <ExternalLinkButton href="https://id.atlassian.com/manage-profile/security/api-tokens">
                Get API Token
              </ExternalLinkButton>
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="eCommerce Project Key"
              value={draft.jira.ecomProjectKey}
              onChange={(v) => setJira("ecomProjectKey", v)}
              placeholder="ECOM"
            />
            <Field
              label="External Reporting Key"
              value={draft.jira.erProjectKey}
              onChange={(v) => setJira("erProjectKey", v)}
              placeholder="ER"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Replatform Project Key"
              value={draft.jira.replatformProjectKey}
              onChange={(v) => setJira("replatformProjectKey", v)}
              placeholder="REPLAT"
            />
            <Field
              label="RAID Board ID"
              value={draft.jira.raidBoardId}
              onChange={(v) => setJira("raidBoardId", v)}
              placeholder="123"
            />
          </div>
          <Field
            label="Deployment Version Prefix"
            value={draft.jira.deploymentVersionPrefix}
            onChange={(v) => setJira("deploymentVersionPrefix", v)}
            placeholder="eCom"
            helpText='Prefix used for fix version names, e.g. "eCom WWW - 10.94.0"'
          />
        </Section>

        {/* GitHub */}
        <Section title="GitHub" icon="🐙">
          <Field
            label="Personal Access Token"
            value={draft.github.token}
            onChange={(v) => setGithub("token", v)}
            type="password"
            placeholder="ghp_…"
            helpText='Requires "repo" and "read:user" scopes. If on SSO, authorize the token for your org at github.com/settings/tokens.'
            action={
              <ExternalLinkButton href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=Work+Dashboard">
                Create token
              </ExternalLinkButton>
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Owner / Org"
              value={draft.github.owner}
              onChange={(v) => setGithub("owner", v)}
              placeholder="my-org"
            />
            <Field
              label="Repository"
              value={draft.github.repo}
              onChange={(v) => setGithub("repo", v)}
              placeholder="my-repo"
            />
          </div>
          <Field
            label="Your GitHub Username"
            value={draft.github.username}
            onChange={(v) => setGithub("username", v)}
            placeholder="octocat"
            helpText="Leave blank to auto-detect from the token."
          />
        </Section>

        {/* Slack */}
        <Section title="Slack" icon="💬">
          <SlackManifestGenerator />
          <p className="text-[11px] text-amber-400/80">
            If you updated the manifest to add new user scopes, click "Re-authorize" (or disconnect and reconnect) below so Slack grants the new permissions.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Client ID"
              value={draft.slack.clientId}
              onChange={(v) => setSlack("clientId", v)}
              placeholder="1234567890.123…"
            />
            <Field
              label="Client Secret"
              value={draft.slack.clientSecret}
              onChange={(v) => setSlack("clientSecret", v)}
              type="password"
              placeholder="Client secret"
            />
          </div>
          <SlackConnect
            clientId={draft.slack.clientId}
            clientSecret={draft.slack.clientSecret}
            isConnected={!!draft.slack.token}
            connectedTeam={draft.slack.teamName}
            onAuthorized={({ token, teamName, userToken, userId }) => {
              setDraft((prev) => ({ ...prev, slack: { ...prev.slack, token, teamName, userToken, userId } }));
            }}
            onDisconnect={() => {
              setDraft((prev) => ({ ...prev, slack: { ...prev.slack, token: "", teamName: "" } }));
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="eCommerce Channel ID"
              value={draft.slack.ecomChannelId}
              onChange={(v) => setSlack("ecomChannelId", v)}
              placeholder="C01234ABCDE"
            />
            <Field
              label="Deploy Channel ID"
              value={draft.slack.deployChannelId}
              onChange={(v) => setSlack("deployChannelId", v)}
              placeholder="C01234FGHIJ"
            />
          </div>
          <Field
            label="Code Review Channel ID"
            value={draft.slack.codeReviewChannelId}
            onChange={(v) => setSlack("codeReviewChannelId", v)}
            placeholder="C01234KLMNO"
            helpText='Channel ID for "ecommerce-code-review". Used by Situations to Monitor (requires 5+ replies).'
          />
        </Section>

        {/* General */}
        <Section title="General" icon="⚙️">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Refresh Interval:{" "}
              <span className="text-gray-200">
                {msToMinutes(draft.general.refreshIntervalMs)} minutes
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={15}
              value={msToMinutes(draft.general.refreshIntervalMs)}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-800 accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>1 min</span>
              <span>15 min</span>
            </div>
          </div>

          <Field
            label="Calendar Names"
            value={draft.general.calendarNames}
            onChange={(v) =>
              setDraft((prev) => ({
                ...prev,
                general: { ...prev.general, calendarNames: v },
              }))
            }
            helpText="Comma-separated list of Apple Calendar names to show (e.g. Calendar, Work). Leave blank to show all."
          />
        </Section>
      </div>
    </div>
  );
}
