import { fetch } from "@tauri-apps/plugin-http";
import type { AppConfig, CalendarEvent } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Prefer: 'outlook.timezone="UTC"',
  };
}

/** Build start/end ISO strings for a day range starting from `startDate`. */
function dayRange(startDate: Date, days: number): { start: string; end: string } {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function mapEvent(raw: any): CalendarEvent {
  return {
    id: raw.id,
    subject: raw.subject ?? "(No subject)",
    start: raw.start?.dateTime
      ? new Date(raw.start.dateTime + "Z").toISOString()
      : "",
    end: raw.end?.dateTime
      ? new Date(raw.end.dateTime + "Z").toISOString()
      : "",
    isAllDay: raw.isAllDay ?? false,
    location: raw.location?.displayName || undefined,
    organizer: raw.organizer?.emailAddress?.name ?? "",
    joinUrl: raw.onlineMeeting?.joinUrl ?? raw.onlineMeetingUrl ?? undefined,
    responseStatus: mapResponseStatus(raw.responseStatus?.response),
  };
}

function mapResponseStatus(
  response: string | undefined
): CalendarEvent["responseStatus"] {
  switch (response) {
    case "accepted":
      return "accepted";
    case "tentativelyAccepted":
    case "tentative":
      return "tentative";
    case "declined":
      return "declined";
    default:
      return "none";
  }
}

async function fetchCalendarView(
  config: AppConfig,
  startDateTime: string,
  endDateTime: string
): Promise<CalendarEvent[]> {
  const { accessToken } = config.outlook;
  if (!accessToken) return [];

  const params = new URLSearchParams({
    startDateTime,
    endDateTime,
    $orderby: "start/dateTime",
    $top: "100",
    $select:
      "id,subject,start,end,isAllDay,location,organizer,onlineMeeting,onlineMeetingUrl,responseStatus",
  });

  const url = `${GRAPH_BASE}/me/calendarview?${params.toString()}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: authHeaders(accessToken),
  });

  if (!resp.ok) {
    throw new Error(
      `Graph calendarview failed (${resp.status}): ${await resp.text()}`
    );
  }

  const data = await resp.json();
  return (data.value ?? []).map(mapEvent);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch calendar events for today (00:00 - 23:59 UTC).
 */
export async function fetchTodayEvents(
  config: AppConfig
): Promise<CalendarEvent[]> {
  const { start, end } = dayRange(new Date(), 1);
  return await fetchCalendarView(config, start, end);
}

/**
 * Fetch calendar events for the next N days (including today).
 */
export async function fetchUpcomingEvents(
  config: AppConfig,
  days: number
): Promise<CalendarEvent[]> {
  try {
    const { start, end } = dayRange(new Date(), days);
    return await fetchCalendarView(config, start, end);
  } catch (err) {
    console.error("fetchUpcomingEvents failed:", err);
    return [];
  }
}
