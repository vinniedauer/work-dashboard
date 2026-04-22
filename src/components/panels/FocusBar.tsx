import type { NextAction } from "../../hooks/useNextAction";

const categoryColors: Record<string, string> = {
  meeting: "bg-red-950 border-red-700 text-red-100",
  ticket:  "bg-blue-950 border-blue-700 text-blue-100",
  pr:      "bg-violet-950 border-violet-700 text-violet-100",
  slack:   "bg-yellow-950 border-yellow-700 text-yellow-100",
  board:   "bg-teal-950 border-teal-700 text-teal-100",
  idle:    "bg-gray-900 border-gray-700 text-gray-400",
};

const categoryIcons: Record<string, string> = {
  meeting: "📅",
  ticket:  "🎫",
  pr:      "🔀",
  slack:   "💬",
  board:   "📋",
  idle:    "✅",
};

interface FocusBarProps {
  action: NextAction;
  onDismissMeeting: (id: string) => void;
}

export default function FocusBar({ action, onDismissMeeting }: FocusBarProps) {
  const colors = categoryColors[action.category] ?? categoryColors.idle;
  const icon = categoryIcons[action.category] ?? "";

  const inner = (
    <span className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <span>{action.message}</span>
    </span>
  );

  return (
    <div className={`mx-4 mt-4 rounded-xl border px-6 py-3 text-lg font-medium flex items-center justify-between ${colors}`}>
      {action.url ? (
        <a
          href={action.url}
          target="_blank"
          rel="noreferrer"
          className="hover:underline cursor-pointer"
        >
          {inner}
        </a>
      ) : (
        inner
      )}

      {action.category === "meeting" && action.meetingId && (
        <button
          onClick={() => onDismissMeeting(action.meetingId!)}
          className="ml-6 shrink-0 text-sm font-semibold px-3 py-1 rounded-lg bg-red-800 hover:bg-red-700 text-red-100 border border-red-600 transition-colors"
        >
          Meeting Ended
        </button>
      )}
    </div>
  );
}
