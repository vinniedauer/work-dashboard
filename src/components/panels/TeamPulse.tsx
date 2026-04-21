import { useMemo } from "react";
import type {
  PullRequest,
  JiraTicket,
  SlackMessage,
} from "../../types";
import PanelCard from "../common/PanelCard";

interface TeamPulseProps {
  reviewPRs: PullRequest[];
  bugs: JiraTicket[];
  waitingOnYou: SlackMessage[];
  situationsToMonitor: SlackMessage[];
  loadingPRs: boolean;
  loadingBugs: boolean;
  loadingSlack: boolean;
  loadingSituations: boolean;
  errorPRs: string | null;
  errorBugs: string | null;
  errorSlack: string | null;
  errorSituations: string | null;
}

// --- helpers ---

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "\u2026";
}

function statusBadge(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes("done") || lower.includes("closed") || lower.includes("resolved"))
    return "bg-green-500/20 text-green-400";
  if (lower.includes("progress") || lower.includes("review"))
    return "bg-blue-500/20 text-blue-400";
  return "bg-gray-700 text-gray-300";
}

// --- sub-sections ---

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">
      {label}
    </h3>
  );
}

function ReviewPRRow({ pr }: { pr: PullRequest }) {
  const age = timeAgo(pr.createdAt);

  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-gray-800 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{pr.title}</p>
        <p className="text-[11px] text-gray-400">
          {pr.author} &middot; {age}
        </p>
      </div>
      {pr.isDraft && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400 shrink-0 mt-0.5">
          Draft
        </span>
      )}
    </a>
  );
}

function BugRow({ bug }: { bug: JiraTicket }) {
  return (
    <a
      href={bug.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-gray-800 transition-colors"
    >
      {/* Bug icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-3.5 h-3.5 text-red-400 shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M6.28 5.22a.75.75 0 0 1 0 1.06L5.06 7.5h1.19a4.5 4.5 0 0 1 7.5 0h1.19l-1.22-1.22a.75.75 0 0 1 1.06-1.06l2.5 2.5a.75.75 0 0 1-1.06 1.06L15 7.56v.69a4.49 4.49 0 0 1-.78 2.5h1.53l1.22-1.22a.75.75 0 0 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-1.06-1.06l1.22-1.22H13.2a4.49 4.49 0 0 1-6.4 0H5.31l1.22 1.22a.75.75 0 0 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1 1.06-1.06l1.22 1.22h1.53A4.49 4.49 0 0 1 5 8.25v-.69L3.78 8.78a.75.75 0 0 1-1.06-1.06l2.5-2.5a.75.75 0 0 1 1.06 0ZM10 6.5a3 3 0 0 0-3 3v1a3 3 0 1 0 6 0v-1a3 3 0 0 0-3-3Z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-xs font-mono text-red-400 shrink-0">
        {bug.key}
      </span>
      <span className="text-sm text-gray-200 truncate flex-1">
        {bug.summary}
      </span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusBadge(bug.status)}`}
      >
        {bug.status}
      </span>
    </a>
  );
}


function SlackRow({ message, showReplyCount }: { message: SlackMessage; showReplyCount?: boolean }) {
  return (
    <div className="py-1.5 px-2 -mx-2 rounded hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs font-medium text-gray-300">
          {message.userName}
        </span>
        {message.channelName && (
          <span className="text-[10px] text-gray-500 truncate">
            #{message.channelName}
          </span>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">
          {timeAgo(new Date(parseFloat(message.ts) * 1000).toISOString())}
        </span>
        {showReplyCount && (message.replyCount ?? 0) > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center gap-0.5 shrink-0"
            title={`${message.replyCount} replies`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3 h-3"
            >
              <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h9A1.5 1.5 0 0 1 13 3.5v5A1.5 1.5 0 0 1 11.5 10H7.21l-3.35 2.68A.75.75 0 0 1 2.75 12V10H2.5A1.5 1.5 0 0 1 1 8.5v-5Z" />
            </svg>
            {message.replyCount}
          </span>
        )}
        {!showReplyCount && message.threadTs && message.threadTs !== message.ts && (
          <span
            className="text-[10px] text-gray-400 flex items-center gap-0.5"
            title={`${message.replyCount ?? 0} replies`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3 h-3"
            >
              <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h9A1.5 1.5 0 0 1 13 3.5v5A1.5 1.5 0 0 1 11.5 10H7.21l-3.35 2.68A.75.75 0 0 1 2.75 12V10H2.5A1.5 1.5 0 0 1 1 8.5v-5Z" />
            </svg>
            {message.replyCount ?? 0}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">
        {truncate(message.text, 140)}
      </p>
    </div>
  );
}

// --- main component ---

export default function TeamPulse({
  reviewPRs,
  bugs,
  waitingOnYou,
  situationsToMonitor,
  loadingPRs,
  loadingBugs,
  loadingSlack,
  loadingSituations,
  errorPRs,
  errorBugs,
  errorSlack,
  errorSituations,
}: TeamPulseProps) {
  const isLoading = loadingPRs || loadingBugs || loadingSlack || loadingSituations;
  const combinedError = [errorPRs, errorBugs, errorSlack, errorSituations]
    .filter(Boolean)
    .join("; ");

  // Sort PRs by age, oldest first (needs attention sooner)
  const sortedPRs = useMemo(
    () =>
      [...reviewPRs].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [reviewPRs],
  );

  return (
    <PanelCard
      title="Team Pulse"
      icon=""
      isLoading={isLoading}
      error={combinedError || null}
    >
      {/* PRs Awaiting Review */}
      <SectionHeader label="PRs Awaiting Review" />
      {sortedPRs.length === 0 && !loadingPRs && (
        <p className="text-xs text-gray-400 italic">No PRs awaiting review</p>
      )}
      {sortedPRs.map((pr) => (
        <ReviewPRRow key={pr.id} pr={pr} />
      ))}

      {/* Recent Bugs */}
      <SectionHeader label="Recent Bugs" />
      {bugs.length === 0 && !loadingBugs && (
        <p className="text-xs text-gray-400 italic">No recent bugs</p>
      )}
      {bugs.map((bug) => (
        <BugRow key={bug.key} bug={bug} />
      ))}

      {/* Waiting on You */}
      <SectionHeader label="Waiting on You" />
      {waitingOnYou.length === 0 && !loadingSlack && (
        <p className="text-xs text-gray-400 italic">No messages waiting on you</p>
      )}
      {waitingOnYou.map((msg) => (
        <SlackRow key={msg.ts} message={msg} />
      ))}

      {/* Situations to Monitor */}
      <SectionHeader label="Situations to Monitor" />
      {situationsToMonitor.length === 0 && !loadingSituations && (
        <p className="text-xs text-gray-400 italic">No situations to monitor</p>
      )}
      {situationsToMonitor.map((msg) => (
        <SlackRow key={`${msg.channel}:${msg.ts}`} message={msg} showReplyCount />
      ))}
    </PanelCard>
  );
}
