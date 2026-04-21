import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, CalendarEvent } from "../types";

interface RawCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  is_all_day: boolean;
  location: string | null;
  join_url: string | null;
}

async function fetchCalendarEvents(offsetDays: number, calendarNames: string): Promise<CalendarEvent[]> {
  console.log(`[Calendar] invoke get_calendar_events offsetDays=${offsetDays}`);
  try {
    const raw = await invoke<RawCalendarEvent[]>("get_calendar_events", { offsetDays, calendarNames });
    const preview = raw.slice(0, 5).map((e) => `"${e.title}" @ ${e.start}`).join(", ");
    console.log(`[Calendar] got ${raw.length} events for offset ${offsetDays}. First up to 5: [${preview}]`, raw);
    return raw.map((e) => ({
      id: e.id,
      subject: e.title,
      start: parseAppleDate(e.start),
      end: parseAppleDate(e.end),
      isAllDay: e.is_all_day,
      location: e.location ?? undefined,
      organizer: "",
      joinUrl: e.join_url ?? undefined,
      responseStatus: "accepted" as const,
    }));
  } catch (err) {
    console.error(`[Calendar] invoke failed offsetDays=${offsetDays}:`, err);
    throw err;
  }
}

function parseAppleDate(str: string): string {
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toISOString();
}

function getNextBusinessDayOffset(): number {
  const day = new Date().getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
  if (day === 5) return 3; // Friday → Monday
  if (day === 6) return 2; // Saturday → Monday
  if (day === 0) return 1; // Sunday → Monday
  return 1; // weekday → tomorrow
}

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;


export function useTodayEvents(config: AppConfig) {
  const calendarNames = config.general.calendarNames ?? "";
  return useQuery<CalendarEvent[]>({
    queryKey: ["calendar", "todayEvents", calendarNames],
    queryFn: () => fetchCalendarEvents(0, calendarNames),
    enabled: isTauri,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useNextBusinessDayEvents(config: AppConfig) {
  const calendarNames = config.general.calendarNames ?? "";
  const offsetDays = getNextBusinessDayOffset();
  return useQuery<CalendarEvent[]>({
    queryKey: ["calendar", "nextBusinessDayEvents", offsetDays, calendarNames],
    queryFn: () => fetchCalendarEvents(offsetDays, calendarNames),
    enabled: isTauri,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
