import { useMemo, useState, useCallback } from "react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useConfig } from "../../hooks/useConfig";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import type { DeploymentEvent, JiraFixVersion } from "../../types";
import {
  useMyTickets,
  useMyDoneTickets,
  useTeamBugs,
  useFixVersions,
  useReplatformBoard,
  useTicketsByKeys,
} from "../../hooks/useJira";
import { useMyPullRequests, useTeamPullRequests, useBranchVersions } from "../../hooks/useGithub";
import { useChannelMessages, useSituationsToMonitor, useWaitingOnYou } from "../../hooks/useSlack";
import { useTodayEvents, useNextBusinessDayEvents } from "../../hooks/useOutlook";

import { useNextAction } from "../../hooks/useNextAction";
import Header from "./Header";
import FocusBar from "../panels/FocusBar";
import MyWork from "../panels/MyWork";
import MyMeetings from "../panels/MyMeetings";
import TeamPulse from "../panels/TeamPulse";
import DeploymentTracker from "../panels/DeploymentTracker";
import ReplatformMonitor from "../panels/ReplatformMonitor";

function errorMsg(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function Dashboard() {
  const { config } = useConfig();
  const { lastRefresh, refresh, isRefreshing } = useAutoRefresh(
    config.general.refreshIntervalMs,
  );

  // --- data hooks ---

  // My Work
  const myTickets = useMyTickets(config);
  const myPRs = useMyPullRequests(config);
  const todayEvents = useTodayEvents(config);
  const nextDayEvents = useNextBusinessDayEvents(config);

  const branchVersions = useBranchVersions(config);

  // Team Pulse
  const teamPRs = useTeamPullRequests(config);
  const teamBugs = useTeamBugs(config);
  const waitingOnYou = useWaitingOnYou(config);
  const situationsToMonitor = useSituationsToMonitor(config);

  // Deployment Tracker
  const fixVersions = useFixVersions(config);
  const deploySlack = useChannelMessages(config, config.slack.deployChannelId);

  // Extract Jira keys from all team PRs for status filtering
  const teamPRJiraKeys = useMemo(() => {
    const keys: string[] = [];
    for (const pr of teamPRs.data ?? []) {
      const m = `${pr.headRef} ${pr.title}`.match(/\b([A-Z]+-\d+)\b/);
      if (m) keys.push(m[1]);
    }
    return [...new Set(keys)];
  }, [teamPRs.data]);

  const teamPRTickets = useTicketsByKeys(config, teamPRJiraKeys);

  const filteredTeamPRs = useMemo(() => {
    const prs = teamPRs.data ?? [];
    if (teamPRTickets.isLoading) return prs.filter((pr) => !pr.isDraft);
    const ticketMap = new Map(
      (teamPRTickets.data ?? []).map((t) => [t.key, t])
    );
    const ecomKey = config.jira.ecomProjectKey.toUpperCase();
    const myEmail = config.jira.email.toLowerCase();
    return prs.filter((pr) => {
      if (pr.isDraft) return false;
      if (pr.reviewDecision === "APPROVED") return false;
      const m = `${pr.headRef} ${pr.title}`.match(/\b([A-Z]+-\d+)\b/);
      if (!m) return true;
      const ticket = ticketMap.get(m[1]);
      if (!ticket) return true;
      const status = ticket.status.toLowerCase();
      if (ticket.projectKey.toUpperCase() === ecomKey) {
        if (status === "ready for review") return true;
        if (status === "in code review") {
          return ticket.reviewers.some((r) => r === myEmail);
        }
        return false;
      }
      return status !== "in progress";
    });
  }, [teamPRs.data, teamPRTickets.data, teamPRTickets.isLoading, config.jira.ecomProjectKey, config.jira.email]);

  // Replatform Monitor
  const replatformBoard = useReplatformBoard(config);
  const myDoneTickets = useMyDoneTickets(config);

  const [dismissedMeetingIds, setDismissedMeetingIds] = useState<string[]>([]);
  const dismissMeeting = useCallback((id: string) => {
    setDismissedMeetingIds((prev) => [...prev, id]);
  }, []);

  const nextAction = useNextAction({
    todayEvents: todayEvents.data ?? [],
    boardItems: replatformBoard.data ?? [],
    teamPRs: filteredTeamPRs,
    myPRs: myPRs.data ?? [],
    situations: situationsToMonitor.data ?? [],
    myTickets: myTickets.data ?? [],
    myDoneTickets: myDoneTickets.data ?? [],
    config,
    dismissedMeetingIds,
  });

  const deploymentEvents = useMemo(
    () => deriveDeploymentEvents(fixVersions.data ?? [], config.jira.baseUrl),
    [fixVersions.data, config.jira.baseUrl],
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Header
        lastRefresh={lastRefresh}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      <FocusBar action={nextAction} onDismissMeeting={dismissMeeting} />

      {/* Resizable 2×2 layout */}
      <main className="flex-1 min-h-0 px-4 pb-4 pt-4 overflow-hidden">
        <PanelGroup orientation="horizontal" className="h-full">

          {/* Left column */}
          <Panel defaultSize={50} minSize={25}>
            <PanelGroup orientation="vertical" className="h-full">
              <Panel defaultSize={34} minSize={15} className="min-h-0">
                <div className="h-full pb-2 pr-2">
                  <MyWork
                    tickets={myTickets.data ?? []}
                    pullRequests={myPRs.data ?? []}
                    loadingTickets={myTickets.isLoading}
                    loadingPRs={myPRs.isLoading}
                    errorTickets={errorMsg(myTickets.error)}
                    errorPRs={errorMsg(myPRs.error)}
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="h-1.5 flex items-center justify-center group pr-2">
                <div className="w-8 h-0.5 rounded-full bg-gray-700 group-hover:bg-gray-500 group-data-[resize-handle-active]:bg-blue-500 transition-colors" />
              </PanelResizeHandle>
              <Panel defaultSize={22} minSize={15} className="min-h-0">
                <div className="h-full py-2 pr-2">
                  <MyMeetings
                    events={todayEvents.data ?? []}
                    nextDayEvents={nextDayEvents.data ?? []}
                    loadingEvents={todayEvents.isLoading}
                    errorEvents={errorMsg(todayEvents.error)}
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="h-1.5 flex items-center justify-center group pr-2">
                <div className="w-8 h-0.5 rounded-full bg-gray-700 group-hover:bg-gray-500 group-data-[resize-handle-active]:bg-blue-500 transition-colors" />
              </PanelResizeHandle>
              <Panel defaultSize={44} minSize={15} className="min-h-0">
                <div className="h-full pt-2 pr-2">
                  <DeploymentTracker
                    fixVersions={fixVersions.data ?? []}
                    deployments={deploymentEvents}
                    slackMessages={deploySlack.data ?? []}
                    branchVersions={branchVersions.data ?? { main: "", staging: "", production: "" }}
                    loadingVersions={fixVersions.isLoading}
                    loadingSlack={deploySlack.isLoading}
                    loadingBranchVersions={branchVersions.isLoading}
                    errorVersions={errorMsg(fixVersions.error)}
                    errorSlack={errorMsg(deploySlack.error)}
                  />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Vertical divider */}
          <PanelResizeHandle className="w-1.5 flex items-center justify-center group">
            <div className="h-8 w-0.5 rounded-full bg-gray-700 group-hover:bg-gray-500 group-data-[resize-handle-active]:bg-blue-500 transition-colors" />
          </PanelResizeHandle>

          {/* Right column */}
          <Panel defaultSize={50} minSize={25}>
            <PanelGroup orientation="vertical" className="h-full">
              <Panel defaultSize={50} minSize={20} className="min-h-0">
                <div className="h-full pb-2 pl-2">
                  <TeamPulse
                    reviewPRs={filteredTeamPRs}
                    bugs={teamBugs.data ?? []}
                    waitingOnYou={waitingOnYou.data ?? []}
                    situationsToMonitor={situationsToMonitor.data ?? []}
                    loadingPRs={teamPRs.isLoading}
                    loadingBugs={teamBugs.isLoading}
                    loadingSlack={waitingOnYou.isLoading}
                    loadingSituations={situationsToMonitor.isLoading}
                    errorPRs={errorMsg(teamPRs.error)}
                    errorBugs={errorMsg(teamBugs.error)}
                    errorSlack={errorMsg(waitingOnYou.error)}
                    errorSituations={errorMsg(situationsToMonitor.error)}
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="h-1.5 flex items-center justify-center group pl-2">
                <div className="w-8 h-0.5 rounded-full bg-gray-700 group-hover:bg-gray-500 group-data-[resize-handle-active]:bg-blue-500 transition-colors" />
              </PanelResizeHandle>
              <Panel defaultSize={50} minSize={20} className="min-h-0">
                <div className="h-full pt-2 pl-2">
                  <ReplatformMonitor
                    boardItems={replatformBoard.data ?? []}
                    loadingBoard={replatformBoard.isLoading}
                    errorBoard={errorMsg(replatformBoard.error)}
                  />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

        </PanelGroup>
      </main>
    </div>
  );
}

/**
 * Build DeploymentEvent entries from "eCom WWW" fix versions only,
 * sorted by scheduled release date ascending (undated at the end).
 */
function deriveDeploymentEvents(
  versions: JiraFixVersion[],
  jiraBaseUrl: string,
): DeploymentEvent[] {
  const base = jiraBaseUrl.replace(/\/+$/, "");

  const wwwVersions = versions.filter(
    (v) => !v.released && v.name.startsWith("eCom WWW"),
  );

  const events: DeploymentEvent[] = wwwVersions.map((v) => {
    const semver = v.name.match(/(\d+\.\d+\.\d+)/)?.[1] ?? v.name;
    return {
      version: semver,
      ecomVersion: v.name,
      erVersion: "",
      targetEnvironment: "production",
      scheduledDate: v.releaseDate ?? null,
      status: "planning",
      checklist: defaultChecklist(),
      relatedTickets: [],
      url: base ? `${base}/projects/${v.projectKey}/versions/${v.id}` : undefined,
    };
  });

  events.sort((a, b) => {
    if (a.scheduledDate && b.scheduledDate)
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    if (a.scheduledDate) return -1;
    if (b.scheduledDate) return 1;
    return 0;
  });

  return events;
}

function defaultChecklist() {
  return [
    { id: "1", label: "All PRs merged to main", checked: false, category: "pre-merge" as const },
    { id: "2", label: "QA sign-off received", checked: false, category: "pre-merge" as const },
    { id: "3", label: "Create release PR: main → staging", checked: false, category: "merge" as const },
    { id: "4", label: "Merge staging PR and verify staging environment", checked: false, category: "verify" as const },
    { id: "5", label: "Create release PR: staging → production", checked: false, category: "merge" as const },
    { id: "6", label: "Post pre-deployment notification in Slack", checked: false, category: "notify" as const },
    { id: "7", label: "Merge production PR", checked: false, category: "merge" as const },
    { id: "8", label: "Verify production deployment", checked: false, category: "verify" as const },
    { id: "9", label: "Post deployment-complete notification in Slack", checked: false, category: "notify" as const },
    { id: "10", label: "Update Jira fix version as released", checked: false, category: "notify" as const },
  ];
}
