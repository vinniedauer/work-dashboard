import { fetch } from "@tauri-apps/plugin-http";

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export type PollResult =
  | { status: "authorized"; token: string }
  | { status: "pending" }
  | { status: "expired" }
  | { status: "error"; message: string };

/**
 * Initiate the GitHub Device Flow. Returns the user-facing code and URL to
 * display, plus the deviceCode needed for polling.
 *
 * Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */
export async function requestDeviceCode(
  clientId: string,
): Promise<DeviceCodeResponse> {
  const resp = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `client_id=${encodeURIComponent(clientId)}&scope=repo`,
  });

  if (!resp.ok) {
    throw new Error(`GitHub device code request failed (${resp.status})`);
  }

  const data = await resp.json();
  if (data.error) {
    throw new Error(data.error_description ?? data.error);
  }

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval ?? 5,
  };
}

/**
 * Poll GitHub once for an access token. Should be called repeatedly at the
 * interval returned by requestDeviceCode().
 */
export async function pollForToken(
  clientId: string,
  deviceCode: string,
): Promise<PollResult> {
  const resp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body:
      `client_id=${encodeURIComponent(clientId)}` +
      `&device_code=${encodeURIComponent(deviceCode)}` +
      `&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
  });

  if (!resp.ok) {
    return { status: "error", message: `HTTP ${resp.status}` };
  }

  const data = await resp.json();

  if (data.access_token) {
    return { status: "authorized", token: data.access_token };
  }

  switch (data.error) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      // GitHub wants us to back off — treat as pending; caller should
      // increase its interval, but we keep it simple here.
      return { status: "pending" };
    case "expired_token":
      return { status: "expired" };
    default:
      return {
        status: "error",
        message: data.error_description ?? data.error ?? "Unknown error",
      };
  }
}

/**
 * Fetch the authenticated user's login name using an existing token.
 * Used to auto-populate the username field after OAuth.
 */
export async function fetchAuthenticatedUser(token: string): Promise<string> {
  const resp = await fetch("https://api.github.com/user", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!resp.ok) throw new Error(`GitHub /user failed (${resp.status})`);
  const data = await resp.json();
  return data.login ?? "";
}
