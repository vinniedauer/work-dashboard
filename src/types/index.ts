// === Jira Types ===

export interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  statusCategory: "new" | "indeterminate" | "done";
  priority: string;
  assignee: string | null;
  project: string;
  projectKey: string;
  issueType: string;
  updated: string;
  url: string;
  storyPoints: number | null;
}

export interface JiraComment {
  id: string;
  author: string;
  body: string;
  created: string;
  issueKey: string;
  issueSummary: string;
}

export interface JiraFixVersion {
  id: string;
  name: string;
  description?: string;
  releaseDate?: string;
  released: boolean;
  archived?: boolean;
  projectKey: string;
}

export interface JiraBoardItem {
  key: string;
  summary: string;
  status: string;
  priority: string;
  assignee: string | null;
  labels: string[];
  dueDate: string | null;
  url: string;
}

// === GitHub Types ===

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  reviewDecision: string | null;
  reviews: PullRequestReview[];
  checksStatus: "pending" | "success" | "failure" | null;
  headRef: string;
  baseRef: string;
}

export interface PullRequestReview {
  author: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING";
  submittedAt: string;
}

// === Slack Types ===

export interface SlackMessage {
  ts: string;
  user: string;
  userName: string;
  text: string;
  channel: string;
  channelName: string;
  threadTs?: string;
  replyCount?: number;
}

// === Calendar Types ===

export interface CalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location?: string;
  organizer: string;
  joinUrl?: string;
  responseStatus: "accepted" | "tentative" | "declined" | "none";
}


// === Deployment Types ===

export interface DeploymentEvent {
  version: string;
  ecomVersion: string;
  erVersion: string;
  targetEnvironment: "staging" | "production";
  scheduledDate: string | null;
  status: "planning" | "ready" | "in-progress" | "deployed";
  checklist: DeploymentChecklistItem[];
  relatedTickets: JiraTicket[];
  url?: string;
}

export interface DeploymentChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: "pre-merge" | "merge" | "verify" | "notify";
}

// === RAID Types ===

export interface RaidItem {
  key: string;
  summary: string;
  type: "Risk" | "Action" | "Issue" | "Decision";
  status: string;
  assignee: string | null;
  priority: string;
  url: string;
}

// === Config Types ===

export interface AppConfig {
  jira: {
    baseUrl: string;
    email: string;
    apiToken: string;
    ecomProjectKey: string;
    erProjectKey: string;
    replatformProjectKey: string;
    raidBoardId: string;
    deploymentVersionPrefix: string;
  };
  github: {
    clientId: string;
    token: string;
    owner: string;
    repo: string;
    username: string;
  };
  slack: {
    clientId: string;
    clientSecret: string;
    token: string;
    teamName: string;
    ecomChannelId: string;
    deployChannelId: string;
    codeReviewChannelId: string;
    userToken: string;
    userId: string;
  };
  outlook: {
    clientId: string;
    tenantId: string;
    accessToken: string;
    refreshToken: string;
  };
  general: {
    refreshIntervalMs: number;
    calendarNames: string;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  jira: {
    baseUrl: "",
    email: "",
    apiToken: "",
    ecomProjectKey: "",
    erProjectKey: "",
    replatformProjectKey: "",
    raidBoardId: "",
    deploymentVersionPrefix: "eCom",
  },
  github: {
    clientId: "",
    token: "",
    owner: "",
    repo: "",
    username: "",
  },
  slack: {
    clientId: "",
    clientSecret: "",
    token: "",
    teamName: "",
    ecomChannelId: "",
    deployChannelId: "",
    codeReviewChannelId: "",
    userToken: "",
    userId: "",
  },
  outlook: {
    clientId: "",
    tenantId: "",
    accessToken: "",
    refreshToken: "",
  },
  general: {
    refreshIntervalMs: 5 * 60 * 1000,
    calendarNames: "",
  },
};
