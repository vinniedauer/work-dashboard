import { useMemo, useState, useRef } from "react";
import type { JiraTicket, PullRequest } from "../../types";
import PanelCard from "../common/PanelCard";
import { useTodos } from "../../hooks/useTodos";

interface MyWorkProps {
  tickets: JiraTicket[];
  pullRequests: PullRequest[];
  loadingTickets: boolean;
  loadingPRs: boolean;
  errorTickets: string | null;
  errorPRs: string | null;
}

// --- helpers ---

function statusColor(statusCategory: string): string {
  switch (statusCategory) {
    case "done":
      return "bg-green-500/20 text-green-400";
    case "indeterminate":
      return "bg-blue-500/20 text-blue-400";
    case "new":
    default:
      return "bg-gray-700 text-gray-300";
  }
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

function reviewBadge(decision: string | null): {
  label: string;
  classes: string;
} {
  switch (decision) {
    case "APPROVED":
      return { label: "Approved", classes: "bg-green-500/20 text-green-400" };
    case "CHANGES_REQUESTED":
      return {
        label: "Changes Requested",
        classes: "bg-amber-500/20 text-amber-400",
      };
    case "REVIEW_REQUIRED":
      return { label: "Pending", classes: "bg-yellow-500/20 text-yellow-400" };
    default:
      return { label: "Pending", classes: "bg-gray-700 text-gray-300" };
  }
}

// --- sub-sections ---

function SectionHeader({ label, loading }: { label: string; loading?: boolean }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4 first:mt-0 flex items-center gap-2">
      {label}
      {loading && (
        <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-600 border-t-gray-400 animate-spin" />
      )}
    </h3>
  );
}

function TicketRow({ ticket }: { ticket: JiraTicket }) {
  return (
    <a
      href={ticket.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-gray-800 transition-colors group"
    >
      <span className="text-xs" title={ticket.priority}>
        {priorityIcon(ticket.priority)}
      </span>
      <span className="text-xs font-mono text-blue-400 shrink-0">
        {ticket.key}
      </span>
      <span className="text-sm text-gray-200 truncate flex-1">
        {ticket.summary}
      </span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusColor(ticket.statusCategory)}`}
      >
        {ticket.status}
      </span>
    </a>
  );
}

function PRRow({ pr }: { pr: PullRequest }) {
  const badge = reviewBadge(pr.reviewDecision);
  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-gray-800 transition-colors"
    >
      {/* PR icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="w-3.5 h-3.5 text-gray-400 shrink-0"
      >
        <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
      </svg>
      <span className="text-sm text-gray-200 truncate flex-1">{pr.title}</span>
      {pr.isDraft && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400 shrink-0">
          Draft
        </span>
      )}
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${badge.classes}`}
      >
        {badge.label}
      </span>
    </a>
  );
}


function TodoSection() {
  const { todos, addTodo, toggleTodo, deleteTodo, moveTodo, editTodo } = useTodos();
  const [inputValue, setInputValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const sortedTodos = useMemo(() => {
    const incomplete = todos.filter((t) => !t.completed);
    const complete = todos.filter((t) => t.completed);
    return [...incomplete, ...complete];
  }, [todos]);

  function handleAdd() {
    if (!inputValue.trim()) return;
    addTodo(inputValue);
    setInputValue("");
    inputRef.current?.focus();
  }

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAdd();
  }

  function startEdit(id: string, text: string) {
    setEditingId(id);
    setEditValue(text);
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 0);
  }

  function commitEdit() {
    if (editingId) {
      if (editValue.trim()) editTodo(editingId, editValue);
      setEditingId(null);
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditingId(null);
  }

  return (
    <>
      {sortedTodos.length === 0 && (
        <p className="text-xs text-gray-400 italic">No todos yet</p>
      )}
      {sortedTodos.map((todo) => {
        const originalIndex = todos.findIndex((t) => t.id === todo.id);
        const isFirst = originalIndex === 0;
        const isLast = originalIndex === todos.length - 1;
        const isEditing = editingId === todo.id;

        return (
          <div
            key={todo.id}
            className="group flex items-center gap-2 py-1 px-2 -mx-2 rounded hover:bg-gray-800/60 transition-colors"
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
              className="w-3.5 h-3.5 shrink-0 accent-gray-400 cursor-pointer"
            />

            {isEditing ? (
              <input
                ref={editRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={commitEdit}
                className="flex-1 min-w-0 bg-gray-700 text-gray-200 text-sm rounded px-1.5 py-0.5 border border-gray-500 focus:outline-none focus:border-gray-400"
              />
            ) : (
              <span
                onClick={() => startEdit(todo.id, todo.text)}
                className={`text-sm flex-1 truncate cursor-text ${todo.completed ? "text-gray-400 line-through" : "text-gray-200"}`}
              >
                {todo.text}
              </span>
            )}

            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => moveTodo(todo.id, "up")}
                disabled={isFirst}
                className="p-0.5 text-gray-400 hover:text-gray-300 disabled:opacity-0 disabled:pointer-events-none transition-colors"
                title="Move up"
              >
                ▲
              </button>
              <button
                onClick={() => moveTodo(todo.id, "down")}
                disabled={isLast}
                className="p-0.5 text-gray-400 hover:text-gray-300 disabled:opacity-0 disabled:pointer-events-none transition-colors"
                title="Move down"
              >
                ▼
              </button>
            </div>

            <button
              onClick={() => deleteTodo(todo.id)}
              className="text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm leading-none shrink-0"
              title="Delete"
            >
              ×
            </button>
          </div>
        );
      })}

      <div className="flex gap-2 mt-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="Add a todo…"
          className="flex-1 min-w-0 bg-gray-800 text-gray-200 text-sm rounded px-2 py-1 border border-gray-700 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors shrink-0"
        >
          Add
        </button>
      </div>
    </>
  );
}

// --- main component ---

export default function MyWork({
  tickets,
  pullRequests,
  loadingTickets,
  loadingPRs,
  errorTickets,
  errorPRs,
}: MyWorkProps) {
  const isLoading = loadingTickets || loadingPRs;
  const combinedError = [errorTickets, errorPRs].filter(Boolean).join("; ");

  const ticketsByProject = useMemo(() => {
    const groups: Record<string, JiraTicket[]> = {};
    for (const t of tickets) {
      const key = t.project || t.projectKey;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [tickets]);

  return (
    <PanelCard
      title="My Work"
      icon=""
      isLoading={isLoading}
      error={combinedError || null}
    >
      {/* My Tickets */}
      <SectionHeader label="My Tickets" />
      {tickets.length === 0 && !loadingTickets && (
        <p className="text-xs text-gray-400 italic">No tickets assigned</p>
      )}
      {Object.entries(ticketsByProject).map(([project, items]) => (
        <div key={project} className="mb-3">
          <h4 className="text-[11px] text-gray-400 font-medium mb-1">
            {project}
          </h4>
          {items.map((t) => (
            <TicketRow key={t.key} ticket={t} />
          ))}
        </div>
      ))}

      {/* My PRs */}
      <SectionHeader label="My PRs" />
      {pullRequests.length === 0 && !loadingPRs && (
        <p className="text-xs text-gray-400 italic">No open PRs</p>
      )}
      {pullRequests.map((pr) => (
        <PRRow key={pr.id} pr={pr} />
      ))}

      {/* Todos */}
      <SectionHeader label="Todos" />
      <TodoSection />
    </PanelCard>
  );
}
