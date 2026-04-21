import { fetch } from "@tauri-apps/plugin-http";
import type { AppConfig, SlackMessage } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLACK_API = "https://slack.com/api";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

// Simple in-memory cache for user display names so we don't hammer the API.
const userNameCache = new Map<string, string>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch recent messages from a Slack channel.
 *
 * Uses config.slack.userToken for conversations.history so the request
 * succeeds for any channel the user is in, even if the bot hasn't been
 * invited. Falls back to [] if userToken is not configured.
 *
 * @param config  Full app config.
 * @param channelId  The Slack channel ID.
 * @param limit  Number of messages to fetch (default 20, max 200).
 */
export async function fetchChannelMessages(
  config: AppConfig,
  channelId: string,
  limit = 20
): Promise<SlackMessage[]> {
  const token = config.slack.userToken || config.slack.token;
  const usingUserToken = !!config.slack.userToken;
  console.log(`[Slack] fetchChannelMessages channel=${channelId} usingUserToken=${usingUserToken} hasToken=${!!token}`);
  if (!token || !channelId) {
    console.warn(`[Slack] fetchChannelMessages skipped: token=${!!token} channelId=${!!channelId}`);
    return [];
  }

  const params = new URLSearchParams({
    channel: channelId,
    limit: String(Math.min(limit, 200)),
  });

  const url = `${SLACK_API}/conversations.history?${params.toString()}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: authHeaders(token),
  });

  if (!resp.ok) {
    throw new Error(
      `Slack conversations.history failed (${resp.status}): ${await resp.text()}`
    );
  }

  const data = await resp.json();
  console.log(`[Slack] fetchChannelMessages channel=${channelId} ok=${data.ok} error=${data.error ?? "none"} needed_scope=${data.needed ?? ""}`);
  if (!data.ok) {
    const errMsg = data.error ?? "unknown";
    if (errMsg === "missing_scope") {
      console.warn(
        `[Slack] missing_scope for channel ${channelId} — needed: ${data.needed}. Returning [].`
      );
      return [];
    }
    throw new Error(`Slack API error: ${errMsg}`);
  }

  const botToken = config.slack.token;

  // Filter eligible messages first so we can resolve all mentions in parallel.
  const eligible = (data.messages ?? []).filter(
    (msg: { subtype?: string }) => !msg.subtype || msg.subtype === "thread_broadcast"
  );

  // Pre-resolve all unique mention user IDs across the batch in parallel.
  const allMentionIds = new Set<string>();
  for (const msg of eligible) {
    for (const match of (msg.text ?? "").matchAll(/<@(U[A-Z0-9]+)>/g)) {
      allMentionIds.add(match[1]);
    }
  }
  await Promise.all([...allMentionIds].map((uid) => resolveUserName(botToken, uid)));

  const messages: SlackMessage[] = [];
  for (const msg of eligible) {
    const userId: string = msg.user ?? "";
    const userName = userId
      ? await resolveUserName(botToken, userId)
      : "Unknown";

    const text = await resolveMentions(botToken, msg.text ?? "");

    messages.push({
      ts: msg.ts,
      user: userId,
      userName,
      text,
      channel: channelId,
      channelName: "", // caller can enrich this if needed
      threadTs: msg.thread_ts,
      replyCount: msg.reply_count,
    });
  }

  return messages;
}

/**
 * Resolve a Slack user ID to a display name.
 * Results are cached for the lifetime of the app session.
 */
export async function fetchUserName(
  config: AppConfig,
  userId: string
): Promise<string> {
  try {
    return await resolveUserName(config.slack.token, userId);
  } catch (err) {
    console.error("fetchUserName failed:", err);
    return userId;
  }
}

// ---------------------------------------------------------------------------
// Situations to Monitor
// ---------------------------------------------------------------------------

const GROUP_A_NAMES = [
  "vinnie dauer",
  "alexia acevedo",
  "mark priestap",
  "ryan haig",
];

const GROUP_B_NAMES = [
  "andy gross",
  "jami lawniczak",
  "tasha hack",
  "mallori hartford",
  "alex hanes",
];

const GROUP_A_MENTION_TERMS = [
  "ecommerce-frontend-team",
  "alexia",
  "mark priestap",
  "ryan haig",
  "vinnie dauer",
];

/**
 * Fetch root messages from the last 48 hours whose threads qualify as
 * "Situations to Monitor":
 *
 * - Thread reply count meets the threshold (3 normally, 5 for code-review channel)
 * - Root message author is in Group A → always qualifies
 * - Root message author is in Group B → qualifies only if text mentions a
 *   Group A member by name or mentions the ecommerce-frontend-team
 *
 * Returns up to 5 qualifying root messages, newest first.
 */
export async function fetchSituationsToMonitor(
  config: AppConfig,
  channelId: string,
  channelName: string
): Promise<SlackMessage[]> {
  const token = config.slack.userToken || config.slack.token;
  if (!token || !channelId) return [];

  const isCodeReview = channelName.toLowerCase().includes("code-review");
  const minReplies = isCodeReview ? 5 : 3;

  const oldest = String(Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000));

  const params = new URLSearchParams({
    channel: channelId,
    limit: "200",
    oldest,
  });

  const url = `${SLACK_API}/conversations.history?${params.toString()}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: authHeaders(token),
  });

  if (!resp.ok) {
    throw new Error(
      `Slack conversations.history failed (${resp.status}): ${await resp.text()}`
    );
  }

  const data = await resp.json();
  if (!data.ok) {
    const errMsg = data.error ?? "unknown";
    if (errMsg === "missing_scope") {
      console.warn(
        `[Slack] fetchSituationsToMonitor: missing_scope for channel ${channelId}. Returning [].`
      );
      return [];
    }
    throw new Error(`Slack API error: ${errMsg}`);
  }

  const botToken = config.slack.token;

  // Only root messages (no subtype or thread_broadcast) with enough replies
  const eligible = (data.messages ?? []).filter(
    (msg: { subtype?: string; reply_count?: number; thread_ts?: string; ts?: string }) =>
      (!msg.subtype || msg.subtype === "thread_broadcast") &&
      (msg.reply_count ?? 0) >= minReplies &&
      // Ensure it's actually a root message (thread_ts equals ts, or no thread_ts)
      (!msg.thread_ts || msg.thread_ts === msg.ts)
  );

  // Pre-resolve all unique mention user IDs in parallel.
  const allMentionIds = new Set<string>();
  for (const msg of eligible) {
    for (const match of (msg.text ?? "").matchAll(/<@(U[A-Z0-9]+)>/g)) {
      allMentionIds.add(match[1]);
    }
    // Also pre-cache the author
    if (msg.user) allMentionIds.add(msg.user);
  }
  await Promise.all([...allMentionIds].map((uid) => resolveUserName(botToken, uid)));

  const results: SlackMessage[] = [];

  for (const msg of eligible) {
    if (results.length >= 5) break;

    const userId: string = msg.user ?? "";
    const userName = userId
      ? await resolveUserName(botToken, userId)
      : "Unknown";

    const userNameLower = userName.toLowerCase();
    const rawTextLower = (msg.text ?? "").toLowerCase();

    const isGroupA = GROUP_A_NAMES.some((name) => userNameLower.includes(name));
    const isGroupB = !isGroupA && GROUP_B_NAMES.some((name) => userNameLower.includes(name));

    if (!isGroupA && !isGroupB) continue;

    if (isGroupB) {
      const mentionsGroupA = GROUP_A_MENTION_TERMS.some((term) =>
        rawTextLower.includes(term)
      );
      if (!mentionsGroupA) continue;
    }

    const text = await resolveMentions(botToken, msg.text ?? "");

    results.push({
      ts: msg.ts,
      user: userId,
      userName,
      text,
      channel: channelId,
      channelName,
      threadTs: msg.thread_ts,
      replyCount: msg.reply_count,
    });
  }

  return results;
}

const WAITING_ON_YOU_NAMES = [
  "mark priestap",
  "alexia acevedo",
  "ryan haig",
];

/**
 * Return DM conversations where the most recent message is FROM one of the
 * target people (not from Vinnie), meaning Vinnie needs to respond.
 *
 * Requires a Slack user token with im:history and im:read scopes
 * (config.slack.userToken).
 */
export async function fetchWaitingOnYou(
  config: AppConfig
): Promise<SlackMessage[]> {
  const { userToken, userId } = config.slack;
  if (!userToken) return [];

  // 1. Fetch list of IM (DM) channels
  const listParams = new URLSearchParams({ types: "im", limit: "100" });
  const listResp = await fetch(
    `${SLACK_API}/conversations.list?${listParams.toString()}`,
    { method: "GET", headers: authHeaders(userToken) }
  );
  if (!listResp.ok) {
    throw new Error(
      `Slack conversations.list failed (${listResp.status}): ${await listResp.text()}`
    );
  }
  const listData = await listResp.json();
  if (!listData.ok) {
    throw new Error(`Slack API error: ${listData.error ?? "unknown"}`);
  }

  // 2. Build userId→displayName map via users.list (bot token is fine here)
  const { token } = config.slack;
  const usersResp = await fetch(`${SLACK_API}/users.list`, {
    method: "GET",
    headers: authHeaders(token || userToken),
  });
  if (!usersResp.ok) {
    throw new Error(
      `Slack users.list failed (${usersResp.status}): ${await usersResp.text()}`
    );
  }
  const usersData = await usersResp.json();
  if (!usersData.ok) {
    throw new Error(`Slack API error: ${usersData.error ?? "unknown"}`);
  }

  // Map lowercase display name → userId
  const nameToId = new Map<string, string>();
  for (const member of usersData.members ?? []) {
    const displayName: string = (
      member.profile?.display_name ||
      member.real_name ||
      member.name ||
      ""
    ).toLowerCase();
    if (displayName) nameToId.set(displayName, member.id);
    // Also cache for resolveUserName
    const prettyName: string =
      member.profile?.display_name || member.real_name || member.name || member.id;
    userNameCache.set(member.id, prettyName);
  }

  // Build a map of targetUserId → channelId from the DM list
  const imChannels = new Map<string, string>(); // userId → channelId
  for (const ch of listData.channels ?? []) {
    if (ch.user) imChannels.set(ch.user, ch.id);
  }

  const results: SlackMessage[] = [];

  for (const targetName of WAITING_ON_YOU_NAMES) {
    // Find the Slack user ID for this target name
    let targetUserId: string | undefined;
    for (const [name, id] of nameToId.entries()) {
      if (name.includes(targetName)) {
        targetUserId = id;
        break;
      }
    }
    if (!targetUserId) continue;

    // Find their DM channel
    const imChannelId = imChannels.get(targetUserId);
    if (!imChannelId) continue;

    // Fetch the most recent messages in this DM
    const histParams = new URLSearchParams({ channel: imChannelId, limit: "20" });
    const histResp = await fetch(
      `${SLACK_API}/conversations.history?${histParams.toString()}`,
      { method: "GET", headers: authHeaders(userToken) }
    );
    if (!histResp.ok) continue;
    const histData = await histResp.json();
    if (!histData.ok) continue;

    const messages: Array<{ user: string; ts: string; text: string; thread_ts?: string; reply_count?: number }> =
      (histData.messages ?? []).filter(
        (m: { subtype?: string }) => !m.subtype || m.subtype === "thread_broadcast"
      );

    if (messages.length === 0) continue;

    // Most recent message is messages[0] (Slack returns newest-first)
    const latest = messages[0];

    // Waiting on you = most recent message is NOT from Vinnie
    if (latest.user === userId) continue;

    const resolveToken = token || userToken;
    const userName = await resolveUserName(resolveToken, latest.user);
    const text = await resolveMentions(resolveToken, latest.text ?? "");

    results.push({
      ts: latest.ts,
      user: latest.user,
      userName,
      text,
      channel: imChannelId,
      channelName: "",
      threadTs: latest.thread_ts,
      replyCount: latest.reply_count,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Internal helpers (exported for use by other modules)
// ---------------------------------------------------------------------------

export async function resolveUserName(
  token: string,
  userId: string
): Promise<string> {
  if (!userId) return "Unknown";

  const cached = userNameCache.get(userId);
  if (cached) return cached;

  const params = new URLSearchParams({ user: userId });
  const url = `${SLACK_API}/users.info?${params.toString()}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    console.warn(`[Slack] resolveUserName: HTTP ${resp.status} for user ${userId}`);
    return userId;
  }

  const data = await resp.json();
  if (!data.ok) {
    console.warn(`[Slack] resolveUserName: API error "${data.error ?? "unknown"}" for user ${userId}`);
    return userId;
  }

  const name =
    data.user?.profile?.display_name ||
    data.user?.real_name ||
    data.user?.name ||
    userId;

  userNameCache.set(userId, name);
  return name;
}

/**
 * Replace all `<@UXXXXXXX>` mention tokens in a message string with resolved
 * display names.  Unique user IDs are resolved in parallel (cached after the
 * first call) and then substituted in one pass.
 *
 * @param token   Bot token with `users:read` scope.
 * @param text    Raw Slack message text.
 * @returns       Text with mention tokens replaced by display names.
 */
export async function resolveMentions(token: string, text: string): Promise<string> {
  if (!text) return text;

  const userPattern = /<@(U[A-Z0-9]+)>/g;

  // Collect unique user IDs mentioned in the text.
  const uniqueIds = new Set<string>();
  for (const match of text.matchAll(userPattern)) {
    uniqueIds.add(match[1]);
  }

  // Resolve all unique user IDs in parallel.
  const resolvedMap = new Map<string, string>();
  await Promise.all(
    [...uniqueIds].map(async (uid) => {
      const name = await resolveUserName(token, uid);
      resolvedMap.set(uid, name);
    })
  );

  return text
    // User mentions: <@U012345> → display name
    .replace(userPattern, (_match, uid: string) => {
      const name = resolvedMap.get(uid);
      return name && name !== uid ? name : `@${uid}`;
    })
    // Team/subteam mentions: <!subteam^SXXXXXXXX|@team-name> → @team-name
    .replace(/<!subteam\^[A-Z0-9]+\|([^>]+)>/g, (_match, label: string) =>
      label.startsWith("@") ? label : `@${label}`
    )
    // Special broadcast mentions
    .replace(/<!channel>/g, "@channel")
    .replace(/<!here>/g, "@here")
    .replace(/<!everyone>/g, "@everyone");
}
