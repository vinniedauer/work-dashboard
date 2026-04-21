import { fetch } from "@tauri-apps/plugin-http";

export interface MsDeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export type MsPollResult =
  | { status: "authorized"; accessToken: string; refreshToken: string }
  | { status: "pending" }
  | { status: "expired" }
  | { status: "error"; message: string };

const SCOPES =
  "offline_access https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read";

export async function requestDeviceCode(
  clientId: string,
  tenantId: string,
): Promise<MsDeviceCodeResponse> {
  const resp = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/devicecode`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(SCOPES)}`,
    },
  );

  if (!resp.ok) {
    throw new Error(`Device code request failed (${resp.status})`);
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

export async function pollForToken(
  clientId: string,
  tenantId: string,
  deviceCode: string,
): Promise<MsPollResult> {
  const resp = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:
        `client_id=${encodeURIComponent(clientId)}` +
        `&grant_type=urn:ietf:params:oauth:grant-type:device_code` +
        `&device_code=${encodeURIComponent(deviceCode)}`,
    },
  );

  const data = await resp.json();

  if (data.access_token) {
    return {
      status: "authorized",
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? "",
    };
  }

  switch (data.error) {
    case "authorization_pending":
    case "slow_down":
      return { status: "pending" };
    case "expired_token":
    case "code_expired":
      return { status: "expired" };
    default:
      return {
        status: "error",
        message: data.error_description ?? data.error ?? "Unknown error",
      };
  }
}
