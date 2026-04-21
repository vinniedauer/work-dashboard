import { useMemo } from "react";
import type {
  JiraFixVersion,
  DeploymentEvent,
  SlackMessage,
} from "../../types";
import PanelCard from "../common/PanelCard";

interface BranchVersions {
  main: string;
  staging: string;
  production: string;
}

interface DeploymentTrackerProps {
  fixVersions: JiraFixVersion[];
  deployments: DeploymentEvent[];
  slackMessages: SlackMessage[];
  branchVersions: BranchVersions;
  loadingVersions: boolean;
  loadingSlack: boolean;
  loadingBranchVersions: boolean;
  errorVersions: string | null;
  errorSlack: string | null;
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

function countdownDays(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "\u2026";
}

const envStatusColors: Record<string, string> = {
  planning: "bg-gray-600",
  ready: "bg-amber-500",
  "in-progress": "bg-blue-500",
  deployed: "bg-green-500",
};

// --- sub-sections ---

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">
      {label}
    </h3>
  );
}

function PipelineVisualization({
  branchVersions,
}: {
  deployments?: DeploymentEvent[];
  branchVersions: BranchVersions;
}) {
  const stages: { label: string; env: string; version: string; status: string }[] = [
    {
      label: "main",
      env: "main",
      version: branchVersions.main,
      status: "deployed",
    },
    {
      label: "staging",
      env: "staging",
      version: branchVersions.staging,
      status: "deployed",
    },
    {
      label: "production",
      env: "production",
      version: branchVersions.production,
      status: "deployed",
    },
  ];

  return (
    <div className="flex items-center gap-1 mb-1">
      {stages.map((stage, i) => (
        <div key={stage.env} className="flex items-center gap-1 flex-1 min-w-0">
          <div className="flex flex-col items-center flex-1 min-w-0">
            <div
              className={`w-full py-1.5 px-2 rounded text-center ${
                envStatusColors[stage.status] ?? "bg-gray-700"
              }`}
            >
              <p className="text-[10px] font-semibold text-white uppercase">
                {stage.label}
              </p>
              {stage.version && (
                <p className="text-[11px] text-white/90 truncate font-medium">
                  {stage.version}
                </p>
              )}
            </div>
          </div>
          {i < stages.length - 1 && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-gray-400 shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 0 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

function NextDeployment({ deployment }: { deployment: DeploymentEvent }) {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-blue-400 uppercase">
          Next Deployment
        </span>
        <div className="flex items-center gap-2">
          {deployment.url && (
            <a
              href={deployment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              View in Jira
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 shrink-0">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm6.75-3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V3.56L10.03 9.53a.75.75 0 0 1-1.06-1.06l5.97-5.97H11a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
              </svg>
            </a>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${envStatusColors[deployment.status]} text-white`}>
            {deployment.status}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="text-[11px] text-gray-400">Version</span>
          <p className="text-gray-200 font-mono text-xs">{deployment.ecomVersion}</p>
        </div>
        <div>
          <span className="text-[11px] text-gray-400">Will be deployed to</span>
          <p className="text-gray-200 capitalize text-xs">{deployment.targetEnvironment}</p>
        </div>
        <div className="col-span-2">
          <span className="text-[11px] text-gray-400">Scheduled</span>
          <p className="text-gray-200 text-xs">
            {deployment.scheduledDate
              ? new Date(deployment.scheduledDate).toLocaleDateString()
              : "TBD"}
            {deployment.scheduledDate && (
              <span className="text-[10px] text-gray-400 ml-1">
                ({countdownDays(deployment.scheduledDate)})
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}


function SlackRow({ message }: { message: SlackMessage }) {
  return (
    <div className="py-1.5 px-2 -mx-2 rounded hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs font-medium text-gray-300">
          {message.userName}
        </span>
        <span className="text-[10px] text-gray-400 ml-auto">
          {timeAgo(new Date(parseFloat(message.ts) * 1000).toISOString())}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">
        {truncate(message.text, 140)}
      </p>
    </div>
  );
}

// --- main component ---

export default function DeploymentTracker({
  fixVersions,
  deployments,
  slackMessages,
  branchVersions,
  loadingVersions,
  loadingSlack,
  loadingBranchVersions,
  errorVersions,
  errorSlack,
}: DeploymentTrackerProps) {
  const isLoading = loadingVersions || loadingSlack || loadingBranchVersions;
  const combinedError = [errorVersions, errorSlack].filter(Boolean).join("; ");

  // The next deployment is the first non-deployed one
  const nextDeployment = useMemo(
    () => deployments.find((d) => d.status !== "deployed") ?? null,
    [deployments],
  );

  // Filter deploy channel messages to only those mentioning Vinnie Dauer, @channel, or @here
  const filteredSlackMessages = useMemo(
    () =>
      slackMessages.filter((msg) =>
        /vinnie dauer|@channel|@here/i.test(msg.text),
      ),
    [slackMessages],
  );

  // Unreleased "eCom WWW" fix versions only
  const unreleased = useMemo(
    () =>
      fixVersions
        .filter((v) => !v.released && v.name.startsWith("eCom WWW"))
        .sort((a, b) => {
          if (a.releaseDate && b.releaseDate)
            return (
              new Date(a.releaseDate).getTime() -
              new Date(b.releaseDate).getTime()
            );
          if (a.releaseDate) return -1;
          if (b.releaseDate) return 1;
          return 0;
        }),
    [fixVersions],
  );

  return (
    <PanelCard
      title="Deployment Tracker"
      icon=""
      isLoading={isLoading}
      error={combinedError || null}
    >
      {/* Pipeline */}
      <SectionHeader label="Pipeline" />
      <PipelineVisualization deployments={deployments} branchVersions={branchVersions} />

      {/* Next Deployment */}
      {nextDeployment && (
        <>
          <div className="mt-3" />
          <NextDeployment deployment={nextDeployment} />
        </>
      )}

      {/* Upcoming Versions */}
      <SectionHeader label="Upcoming Versions" />
      {unreleased.length === 0 && !loadingVersions && (
        <p className="text-xs text-gray-400 italic">
          No unreleased fix versions
        </p>
      )}
      {unreleased.map((v) => (
        <div
          key={v.id}
          className="flex items-center gap-2 py-1 px-2 -mx-2 rounded hover:bg-gray-800/50"
        >
          <span className="text-xs font-mono text-gray-300 flex-1 truncate">
            {v.name}
          </span>
          <span className="text-[10px] text-gray-400 shrink-0">
            {v.projectKey}
          </span>
          {v.releaseDate && (
            <span className="text-[10px] text-gray-400 shrink-0">
              {new Date(v.releaseDate).toLocaleDateString()}
            </span>
          )}
        </div>
      ))}

      {/* Deploy Channel Messages */}
      <SectionHeader label="Deploy Channel" />
      {filteredSlackMessages.length === 0 && !loadingSlack && (
        <p className="text-xs text-gray-400 italic">No recent messages</p>
      )}
      {filteredSlackMessages.map((msg) => (
        <SlackRow key={msg.ts} message={msg} />
      ))}
    </PanelCard>
  );
}
