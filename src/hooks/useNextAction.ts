import { useMemo } from "react";
import type {
  CalendarEvent,
  JiraBoardItem,
  JiraTicket,
  PullRequest,
  SlackMessage,
  AppConfig,
} from "../types";

export type ActionCategory =
  | "meeting"
  | "ticket"
  | "pr"
  | "slack"
  | "board"
  | "idle";

export interface NextAction {
  category: ActionCategory;
  message: string;
  url?: string;
  urgency: "high" | "normal" | "low";
  meetingId?: string;
}

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
};

function topPriority(tickets: JiraTicket[]): JiraTicket | undefined {
  return [...tickets].sort((a, b) => {
    const ra = PRIORITY_RANK[a.priority.toLowerCase()] ?? 5;
    const rb = PRIORITY_RANK[b.priority.toLowerCase()] ?? 5;
    return ra - rb;
  })[0];
}

function sumPoints(tickets: JiraTicket[]): number | null {
  const withPoints = tickets.filter((t) => t.storyPoints !== null);
  if (withPoints.length === 0) return null;
  return withPoints.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
}

function minsUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 60_000;
}

function compute(
  todayEvents: CalendarEvent[],
  boardItems: JiraBoardItem[],
  teamPRs: PullRequest[],
  myPRs: PullRequest[],
  situations: SlackMessage[],
  myTickets: JiraTicket[],
  myDoneTickets: JiraTicket[],
  config: AppConfig,
  dismissedMeetingIds: string[]
): NextAction {
  const dismissed = new Set(dismissedMeetingIds);
  const ecomKey = config.jira.ecomProjectKey.toUpperCase();
  const erKey = config.jira.erProjectKey.toUpperCase();

  // ── Debug: log candidate evaluation ────────────────────────────────────────
  const now0 = Date.now();
  console.group("[useNextAction] candidate evaluation");
  console.log("1a currentMeeting →", todayEvents.find(e => !e.isAllDay && new Date(e.start).getTime() <= now0 && new Date(e.end).getTime() > now0)?.subject ?? "none");
  console.log("1b soonMeeting    →", todayEvents.filter(e => !e.isAllDay).map(e => ({ s: e.subject, m: minsUntil(e.start) })).filter(x => x.m > 0 && x.m <= 15)[0]?.s ?? "none");
  console.log("2  boardItems     →", boardItems.map(i => `${i.key} [${i.status}]`));
  console.log("3a ezra PR        →", teamPRs.filter(pr => pr.author?.toLowerCase() === "highsmithcodes").map(pr => `${pr.title} draft=${pr.isDraft} decision=${pr.reviewDecision}`));
  console.log("   teamPRs all    →", teamPRs.map(pr => `${pr.author} | ${pr.title} | draft=${pr.isDraft} | decision=${pr.reviewDecision}`).slice(0, 10));
  console.log("3b queue PRs      →", teamPRs.filter(pr => ["priestap","haig-ryan-15","alexiaacevedo"].includes(pr.author?.toLowerCase() ?? "") && !pr.isDraft).map(pr => pr.title));
  console.log("4a changesReq     →", myPRs.filter(pr => !pr.isDraft && pr.reviewDecision === "CHANGES_REQUESTED").map(pr => pr.title));
  console.log("4b approved       →", myPRs.filter(pr => !pr.isDraft && pr.reviewDecision === "APPROVED").map(pr => pr.title));
  console.log("5  situations     →", situations.map(s => s.channelName));
  console.log("6/7 myTickets     →", myTickets.map(t => `${t.key} [${t.projectKey}] ${t.summary}`).slice(0, 10));
  console.groupEnd();
  // ───────────────────────────────────────────────────────────────────────────

  // ── Step 1a: Currently in a meeting ────────────────────────────────────────
  const now = Date.now();
  const currentMeeting = todayEvents.find(
    (e) =>
      !e.isAllDay &&
      !dismissed.has(e.id) &&
      new Date(e.start).getTime() <= now &&
      new Date(e.end).getTime() > now
  );
  if (currentMeeting) {
    return {
      category: "meeting",
      message: `You're in "${currentMeeting.subject}" right now — focus up.`,
      url: currentMeeting.joinUrl,
      urgency: "high",
      meetingId: currentMeeting.id,
    };
  }

  // ── Step 1b: Meeting in the next 15 minutes ─────────────────────────────────
  const soonMeeting = todayEvents
    .filter((e) => !e.isAllDay)
    .map((e) => ({ event: e, mins: minsUntil(e.start) }))
    .filter(({ mins }) => mins > 0 && mins <= 15)
    .sort((a, b) => a.mins - b.mins)[0];

  if (soonMeeting) {
    const m = Math.round(soonMeeting.mins);
    const label = m <= 1 ? "starts in less than a minute" : `starts in ${m} minutes`;
    return {
      category: "meeting",
      message: `"${soonMeeting.event.subject}" ${label} — wrap up what you're doing.`,
      url: soonMeeting.event.joinUrl,
      urgency: "high",
    };
  }

  // ── Step 2: Active ECRP ticket (In Progress first, then Selected for Dev) ──
  const inProgress = boardItems.find(
    (i) => i.status.toLowerCase() === "in progress"
  );
  if (inProgress) {
    return {
      category: "ticket",
      message: `Keep the momentum on ${inProgress.key} — you've already got it in progress.`,
      url: inProgress.url,
      urgency: "normal",
    };
  }
  const selectedForDev = boardItems.find(
    (i) => i.status.toLowerCase() === "selected for development"
  );
  if (selectedForDev) {
    return {
      category: "ticket",
      message: `Your next ECRP task is queued up: ${selectedForDev.key} — ${selectedForDev.summary}`,
      url: selectedForDev.url,
      urgency: "normal",
    };
  }

  // ── Step 3a: Ezra's PR needs review ────────────────────────────────────────
  const ezraPR = teamPRs.find(
    (pr) =>
      pr.author?.toLowerCase() === "highsmithcodes" &&
      !pr.isDraft
  );
  if (ezraPR) {
    return {
      category: "pr",
      message: `Ezra has a PR waiting on you: "${ezraPR.title}"`,
      url: ezraPR.url,
      urgency: "normal",
    };
  }

  // ── Step 3b: Review queue is piling up (priestap / haig-ryan-15 / AlexiaAcevedo) ─
  const reviewQueueAuthors = new Set(["priestap", "haig-ryan-15", "alexiaacevedo"]);
  const reviewQueuePRs = teamPRs.filter(
    (pr) =>
      reviewQueueAuthors.has(pr.author?.toLowerCase() ?? "") &&
      !pr.isDraft
  );
  if (reviewQueuePRs.length > 2) {
    return {
      category: "pr",
      message: `You've got ${reviewQueuePRs.length} PRs stacking up for review — time to clear the queue.`,
      url: reviewQueuePRs[0].url,
      urgency: "normal",
    };
  }

  // ── Step 4a: My PRs with review comments to address ────────────────────────
  const prWithChanges = myPRs
    .filter((pr) => !pr.isDraft)
    .find((pr) => pr.reviewDecision === "CHANGES_REQUESTED");
  if (prWithChanges) {
    return {
      category: "pr",
      message: `You've got review feedback to address on "${prWithChanges.title}"`,
      url: prWithChanges.url,
      urgency: "normal",
    };
  }

  // ── Step 4b: My approved PRs ready to merge ─────────────────────────────────
  const approvedPR = myPRs
    .filter((pr) => !pr.isDraft)
    .find((pr) => pr.reviewDecision === "APPROVED");
  if (approvedPR) {
    return {
      category: "pr",
      message: `"${approvedPR.title}" got approved — go ahead and merge it.`,
      url: approvedPR.url,
      urgency: "normal",
    };
  }

  // ── Step 5: Situation to monitor ────────────────────────────────────────────
  if (situations.length > 0) {
    const s = situations[0];
    return {
      category: "slack",
      message: `There's a thread in #${s.channelName} worth your attention.`,
      urgency: "normal",
    };
  }

  // ── Steps 6 & 7: EA / ER board tickets ──────────────────────────────────────
  const ecomNotDone = myTickets.filter((t) => t.projectKey === ecomKey);
  const erNotDone = myTickets.filter((t) => t.projectKey === erKey);

  if (ecomNotDone.length > 0 || erNotDone.length > 0) {
    // Step 7: Only one board has open tickets
    if (ecomNotDone.length > 0 && erNotDone.length === 0) {
      const top = topPriority(ecomNotDone)!;
      return {
        category: "board",
        message: `Focus on ${top.key}: ${top.summary}`,
        url: top.url,
        urgency: "normal",
      };
    }
    if (erNotDone.length > 0 && ecomNotDone.length === 0) {
      const top = topPriority(erNotDone)!;
      return {
        category: "board",
        message: `Focus on ${top.key}: ${top.summary}`,
        url: top.url,
        urgency: "normal",
      };
    }

    // Step 6: Both boards have open tickets — favor the one with fewer done points
    const ecomDone = myDoneTickets.filter((t) => t.projectKey === ecomKey);
    const erDone = myDoneTickets.filter((t) => t.projectKey === erKey);
    const ecomPoints = sumPoints(ecomDone) ?? ecomDone.length;
    const erPoints = sumPoints(erDone) ?? erDone.length;

    const [preferredTickets, preferredBoard] =
      ecomPoints <= erPoints
        ? [ecomNotDone, ecomKey]
        : [erNotDone, erKey];

    const top = topPriority(preferredTickets)!;
    return {
      category: "board",
      message: `${preferredBoard} needs more points closed this sprint — start with ${top.key}: ${top.summary}`,
      url: top.url,
      urgency: "normal",
    };
  }

  // ── All clear ────────────────────────────────────────────────────────────────
  return {
    category: "idle",
    message: "You're all caught up — enjoy the quiet while it lasts.",
    urgency: "low",
  };
}

interface UseNextActionInput {
  todayEvents: CalendarEvent[];
  boardItems: JiraBoardItem[];
  teamPRs: PullRequest[];
  myPRs: PullRequest[];
  situations: SlackMessage[];
  myTickets: JiraTicket[];
  myDoneTickets: JiraTicket[];
  config: AppConfig;
  dismissedMeetingIds: string[];
}

export function useNextAction(input: UseNextActionInput): NextAction {
  return useMemo(
    () =>
      compute(
        input.todayEvents,
        input.boardItems,
        input.teamPRs,
        input.myPRs,
        input.situations,
        input.myTickets,
        input.myDoneTickets,
        input.config,
        input.dismissedMeetingIds
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      input.todayEvents,
      input.boardItems,
      input.teamPRs,
      input.myPRs,
      input.situations,
      input.myTickets,
      input.myDoneTickets,
      input.dismissedMeetingIds,
    ]
  );
}
