import { useMemo } from "react";
import type { JiraBoardItem } from "../../types";
import PanelCard from "../common/PanelCard";

interface ReplatformMonitorProps {
  boardItems: JiraBoardItem[];
  loadingBoard: boolean;
  errorBoard: string | null;
}

// --- helpers ---


function statusBadge(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes("done") || lower.includes("closed") || lower.includes("resolved"))
    return "bg-green-500/20 text-green-400";
  if (lower.includes("progress") || lower.includes("active"))
    return "bg-blue-500/20 text-blue-400";
  if (lower.includes("review"))
    return "bg-purple-500/20 text-purple-400";
  return "bg-gray-700 text-gray-300";
}

// Canonical status columns for the Kanban overview
const STATUS_COLUMNS = ["To Do", "In Progress", "In Review", "Done"] as const;

function normalizeStatus(status: string): (typeof STATUS_COLUMNS)[number] {
  const lower = status.toLowerCase();
  if (lower.includes("done") || lower.includes("closed") || lower.includes("resolved"))
    return "Done";
  if (lower.includes("review")) return "In Review";
  if (lower.includes("progress")) return "In Progress";
  return "To Do";
}

const columnColors: Record<string, string> = {
  "To Do": "bg-gray-600",
  "In Progress": "bg-blue-500",
  "In Review": "bg-purple-500",
  Done: "bg-green-500",
};

// --- sub-sections ---

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">
      {label}
    </h3>
  );
}


function BoardOverview({ items }: { items: JiraBoardItem[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const col of STATUS_COLUMNS) c[col] = 0;
    for (const item of items) {
      const col = normalizeStatus(item.status);
      c[col] = (c[col] ?? 0) + 1;
    }
    return c;
  }, [items]);

  const total = items.length || 1; // avoid division by zero

  return (
    <div className="space-y-1.5">
      {STATUS_COLUMNS.map((col) => (
        <div key={col} className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 w-20 shrink-0">
            {col}
          </span>
          <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${columnColors[col]}`}
              style={{
                width: `${Math.max((counts[col] / total) * 100, counts[col] > 0 ? 4 : 0)}%`,
              }}
            />
          </div>
          <span className="text-[11px] font-mono text-gray-400 w-6 text-right shrink-0">
            {counts[col]}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-gray-400 text-right">
        {items.length} total items
      </p>
    </div>
  );
}

function priorityIcon(priority: string): string {
  switch (priority.toLowerCase()) {
    case "highest":
    case "critical":
      return "\u2B06";
    case "high":
      return "\u2197";
    case "medium":
      return "\u2796";
    case "low":
      return "\u2198";
    case "lowest":
      return "\u2B07";
    default:
      return "\u2796";
  }
}

function dueDateBadgeClass(dueDate: string): string {
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "bg-red-500/20 text-red-400";
  if (days <= 3) return "bg-amber-500/20 text-amber-400";
  return "bg-gray-700 text-gray-300";
}

function RecentBoardActivity({ items }: { items: JiraBoardItem[] }) {
  return (
    <div>
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic">No items assigned</p>
      )}
      {items.map((item) => (
        <a
          key={item.key}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-gray-800 transition-colors group"
        >
          <span className="text-xs shrink-0" title={item.priority}>
            {priorityIcon(item.priority)}
          </span>
          <span className="text-xs font-mono text-blue-400 shrink-0">
            {item.key}
          </span>
          <span className="text-sm text-gray-200 truncate flex-1">
            {item.summary}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusBadge(item.status)}`}
          >
            {item.status}
          </span>
          {item.dueDate && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${dueDateBadgeClass(item.dueDate)}`}
            >
              {new Date(item.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

// --- main component ---

export default function ReplatformMonitor({
  boardItems,
  loadingBoard,
  errorBoard,
}: ReplatformMonitorProps) {
  const isLoading = loadingBoard;
  const combinedError = errorBoard;

  const recentItems = useMemo(() => {
    const sorted = [...boardItems].sort((a, b) => {
      const aSelected = a.status.toLowerCase() === "selected for development" ? 0 : 1;
      const bSelected = b.status.toLowerCase() === "selected for development" ? 0 : 1;
      return aSelected - bSelected;
    });
    return sorted.slice(0, 10);
  }, [boardItems]);

  return (
    <PanelCard
      title="Replatform Monitor"
      icon=""
      isLoading={isLoading}
      error={combinedError || null}
    >
      {/* My Replatform Items */}
      <SectionHeader label="My Replatform Items" />
      <RecentBoardActivity items={recentItems} />

      {/* Board Overview */}
      <SectionHeader label="Board Overview" />
      {boardItems.length === 0 && !loadingBoard ? (
        <p className="text-xs text-gray-400 italic">No board data</p>
      ) : (
        <BoardOverview items={boardItems} />
      )}
    </PanelCard>
  );
}
