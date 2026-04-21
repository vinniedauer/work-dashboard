import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import { fetch } from "@tauri-apps/plugin-http";

export interface SlackAuthResult {
  token: string;
  teamName: string;
  userToken: string;
  userId: string;
}

// Bot scopes needed by the dashboard
const BOT_SCOPES = "channels:history,channels:read,users:read";

// User scopes needed for DM access
const USER_SCOPES = "im:history,im:read";

export async function startSlackOAuth(
  clientId: string,
  clientSecret: string,
  signal: AbortSignal,
): Promise<SlackAuthResult> {
  // Start local callback server (Rust picks an available port)
  const port = await invoke<number>("start_oauth_server");
  const redirectUri = `http://localhost:${port}/callback`;

  const authUrl =
    `https://slack.com/oauth/v2/authorize?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(BOT_SCOPES)}` +
    `&user_scope=${encodeURIComponent(USER_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return new Promise(async (resolve, reject) => {
    let unlistenCode: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const cleanup = () => {
      unlistenCode?.();
      unlistenError?.();
    };

    signal.addEventListener("abort", () => {
      cleanup();
      reject(new Error("Cancelled"));
    });

    unlistenCode = await listen<{ code: string }>("oauth-callback", async (event) => {
      cleanup();
      try {
        const result = await exchangeCode(
          clientId,
          clientSecret,
          event.payload.code,
          redirectUri,
        );
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });

    unlistenError = await listen<{ error: string }>("oauth-callback-error", (event) => {
      cleanup();
      reject(new Error(event.payload.error));
    });

    await open(authUrl);
  });
}

async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<SlackAuthResult> {
  const resp = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      `client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      `&code=${encodeURIComponent(code)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`,
  });

  const data = await resp.json();

  if (!data.ok) {
    throw new Error(data.error ?? "Slack token exchange failed");
  }

  return {
    token: data.access_token as string,
    teamName: (data.team?.name as string) ?? "",
    userToken: (data.authed_user?.access_token as string) ?? "",
    userId: (data.authed_user?.id as string) ?? "",
  };
}
