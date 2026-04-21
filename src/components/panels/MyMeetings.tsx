import { useMemo } from "react";
import type { CalendarEvent } from "../../types";
import PanelCard from "../common/PanelCard";

interface MyMeetingsProps {
  events: CalendarEvent[];
  nextDayEvents: CalendarEvent[];
  loadingEvents: boolean;
  errorEvents: string | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} \u2013 ${formatTime(end)}`;
}

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

function countdownLabel(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `in ${hours}h ${remaining}m` : `in ${hours}h`;
}

function EventRow({ event, isNext }: { event: CalendarEvent; isNext: boolean }) {
  const mins = minutesUntil(event.start);
  const upcoming = mins > 0 && mins <= 120;

  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 -mx-2 rounded ${isNext ? "bg-blue-500/10 border border-blue-500/20" : ""}`}
    >
      <span className="text-xs text-gray-400 font-mono shrink-0 w-24">
        {event.isAllDay ? "All day" : formatTimeRange(event.start, event.end)}
      </span>
      <span className="text-sm text-gray-200 truncate flex-1">{event.subject}</span>
      {upcoming && (
        <span className="text-[10px] text-blue-400 shrink-0">
          {countdownLabel(mins)}
        </span>
      )}
      {event.joinUrl && (
        <a
          href={event.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors shrink-0"
        >
          Join
        </a>
      )}
    </div>
  );
}

export default function MyMeetings({
  events,
  nextDayEvents,
  loadingEvents,
  errorEvents,
}: MyMeetingsProps) {
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events],
  );

  const nextEventId = useMemo(() => {
    const now = Date.now();
    return sortedEvents.find((e) => new Date(e.start).getTime() > now)?.id ?? null;
  }, [sortedEvents]);

  const { title, dayName } = useMemo(() => {
    if (nextEventId !== null) return { title: "Today's Meetings", dayName: "today" };
    const day = new Date().getDay();
    if (day >= 5 || day === 0) return { title: "Monday's Meetings", dayName: "Monday" };
    return { title: "Tomorrow's Meetings", dayName: "tomorrow" };
  }, [nextEventId]);

  const displayedEvents = useMemo(() => {
    if (title === "Today's Meetings") return sortedEvents;
    return [...nextDayEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
  }, [title, sortedEvents, nextDayEvents]);

  return (
    <PanelCard
      title={title}
      icon="📅"
      isLoading={false}
      error={errorEvents}
    >
      {loadingEvents && displayedEvents.length === 0 && (
        <p className="text-xs text-gray-400 italic">Loading…</p>
      )}
      {!loadingEvents && displayedEvents.length === 0 && (
        <p className="text-xs text-gray-400 italic">No meetings {dayName}</p>
      )}
      {displayedEvents.map((ev) => (
        <EventRow
          key={ev.id}
          event={ev}
          isNext={title === "Today's Meetings" && ev.id === nextEventId}
        />
      ))}
    </PanelCard>
  );
}
